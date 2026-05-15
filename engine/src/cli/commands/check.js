// @ts-check

import { loadImplementationProvider } from "../../example-implementation.js";
import { parsePath } from "../../parser.js";
import { sanitizePublicPayload, stablePublicStringify, toPortablePath } from "../../public-paths.js";
import {
  formatProjectConfigErrors,
  loadProjectConfig,
  projectConfigOrDefault,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "../../project-config.js";
import { resolveWorkspace } from "../../resolver.js";
import { validateProjectImplementationTrust } from "../../template-trust.js";
import { formatValidationErrors } from "../../validator.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @typedef {{ message: string, loc: any }} ValidationError
 */

/**
 * @returns {void}
 */
export function printCheckHelp() {
  console.log("Usage: topogram check [path] [--json]");
  console.log("");
  console.log("Validates Topogram files, project configuration, topology, generator compatibility, generator policy, output ownership, and template policy.");
  console.log("");
  console.log("Defaults: path is ./topo.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram check");
  console.log("  topogram check --json");
  console.log("  topogram check ./topo");
}

/**
 * @param {AnyRecord} component
 * @returns {{ uses_api: string|null, uses_database: string|null }}
 */
function topologyComponentReferences(component) {
  return {
    uses_api: component.uses_api || null,
    uses_database: component.uses_database || null
  };
}

/**
 * @param {AnyRecord} component
 * @returns {unknown}
 */
function topologyComponentPort(component) {
  return Object.prototype.hasOwnProperty.call(component, "port") ? component.port : null;
}

/**
 * @param {AnyRecord|null|undefined} config
 * @returns {{ outputs: Array<AnyRecord>, runtimes: Array<AnyRecord>, edges: Array<AnyRecord> }}
 */
function summarizeProjectTopology(config) {
  const outputs = Object.entries(config?.outputs || {})
    .map(([name, output]) => ({
      name,
      path: /** @type {AnyRecord} */ (output)?.path || null,
      ownership: /** @type {AnyRecord} */ (output)?.ownership || null
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const runtimeInputs = /** @type {Array<AnyRecord>} */ (config?.topology?.runtimes || []);
  const runtimes = runtimeInputs
    .map((component) => ({
      id: component.id,
      kind: component.kind,
      projection: component.projection,
      generator: {
        id: component.generator?.id || null,
        version: component.generator?.version || null
      },
      port: topologyComponentPort(component),
      migration: component.kind === "database" && component.migration
        ? {
            ownership: component.migration.ownership || null,
            tool: component.migration.tool || null,
            apply: component.migration.apply || null,
            statePath: component.migration.statePath || null,
            snapshotPath: component.migration.snapshotPath || null,
            schemaPath: component.migration.schemaPath || null,
            migrationsPath: component.migration.migrationsPath || null
          }
        : null,
      references: topologyComponentReferences(component)
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  /** @type {Array<AnyRecord>} */
  const edges = runtimes.flatMap((component) => {
    const references = [];
    if (component.references.uses_api) {
      references.push({
        from: component.id,
        to: component.references.uses_api,
        type: "calls_api"
      });
    }
    if (component.references.uses_database) {
      references.push({
        from: component.id,
        to: component.references.uses_database,
        type: "uses_database"
      });
    }
    return references;
  }).sort((left, right) => `${left.from}:${left.type}:${left.to}`.localeCompare(`${right.from}:${right.type}:${right.to}`));
  return {
    outputs,
    runtimes,
    edges
  };
}

/**
 * @param {AnyRecord|null|undefined} topology
 * @returns {AnyRecord|null}
 */
function publicProjectTopology(topology) {
  if (!topology || typeof topology !== "object") {
    return topology || null;
  }
  return {
    ...Object.fromEntries(Object.entries(topology).filter(([key]) => key !== "components")),
    runtimes: topology.runtimes || []
  };
}

/**
 * @param {AnyRecord} component
 * @returns {string}
 */
function formatTopologyComponent(component) {
  const generator = component.generator.id
    ? `${component.generator.id}${component.generator.version ? `@${component.generator.version}` : ""}`
    : "unbound generator";
  const port = component.port == null ? "no port" : `port ${component.port}`;
  const refs = Object.entries(component.references)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key} ${value}`);
  const suffix = refs.length ? ` -> ${refs.join(", ")}` : "";
  const migration = component.migration
    ? ` [migration ${component.migration.ownership}/${component.migration.tool}, apply=${component.migration.apply}]`
    : "";
  return `  - ${component.id}: ${component.kind} ${component.projection} via ${generator} (${port})${suffix}${migration}`;
}

/**
 * @param {{ outputs: Array<AnyRecord>, runtimes: Array<AnyRecord>, edges: Array<AnyRecord> }} topology
 * @returns {void}
 */
export function printTopologySummary(topology) {
  console.log("Project topology:");
  if (topology.outputs.length > 0) {
    console.log("  Outputs:");
    for (const output of topology.outputs) {
      console.log(`  - ${output.name}: ${output.path || "unset"} (${output.ownership || "unknown"})`);
    }
  }
  if (topology.runtimes.length > 0) {
    console.log("  Runtimes:");
    for (const component of topology.runtimes) {
      console.log(formatTopologyComponent(component));
    }
  }
  if (topology.edges.length > 0) {
    console.log("  Edges:");
    for (const edge of topology.edges) {
      console.log(`  - ${edge.from} ${edge.type} ${edge.to}`);
    }
  }
}

/**
 * @param {{ inputPath: string, ast: AnyRecord, resolved: AnyRecord, projectConfigInfo: AnyRecord|null|undefined, projectValidation: AnyRecord }} input
 * @returns {AnyRecord}
 */
export function checkSummaryPayload({ inputPath, ast, resolved, projectConfigInfo, projectValidation }) {
  const files = /** @type {Array<AnyRecord>} */ (ast.files || []);
  const statementCount = files.flatMap((file) => file.statements).length;
  const projectInfo = projectConfigInfo || {
    configPath: null,
    compatibility: false,
    config: { topology: null }
  };
  const topogramErrors = resolved.ok
    ? []
    : /** @type {Array<AnyRecord>} */ (resolved.validation.errors || []);
  const projectErrors = /** @type {Array<AnyRecord>} */ (projectValidation.errors || []);
  const resolvedTopology = summarizeProjectTopology(projectInfo.config);
  return {
    ok: resolved.ok && projectValidation.ok,
    inputPath,
    topogram: {
      files: files.length,
      statements: statementCount,
      valid: resolved.ok
    },
    project: {
      configPath: projectInfo.configPath,
      compatibility: Boolean(projectInfo.compatibility),
      valid: projectValidation.ok,
      topology: publicProjectTopology(projectInfo.config.topology),
      resolvedTopology
    },
    errors: [
      ...topogramErrors.map((error) => ({
        source: "topogram",
        message: error.message,
        loc: error.loc
      })),
      ...projectErrors.map((error) => ({
        source: "project",
        message: error.message,
        loc: error.loc
      }))
    ]
  };
}

/**
 * @param {...{ ok?: boolean, errors?: ValidationError[] }|null|undefined} results
 * @returns {{ ok: boolean, errors: ValidationError[] }}
 */
export function combineProjectValidationResults(...results) {
  /** @type {ValidationError[]} */
  const errors = [];
  for (const result of results) {
    errors.push(...(result?.errors || []));
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * @param {string|null|undefined} inputPath
 * @param {{ json?: boolean }} [options]
 * @returns {Promise<number>}
 */
export async function runCheckCommand(inputPath, options = {}) {
  const topogramPath = inputPath || "./topo";
  const ast = parsePath(topogramPath);
  const resolved = resolveWorkspace(ast);
  const implementation = await loadImplementationProvider(topogramPath).catch(() => null);
  const explicitProjectConfig = loadProjectConfig(topogramPath);
  const projectConfigInfo = explicitProjectConfig ||
    (implementation ? projectConfigOrDefault(topogramPath, resolved.ok ? resolved.graph : null, implementation) : null);
  const projectValidation = projectConfigInfo
    ? combineProjectValidationResults(
        validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null, { configDir: projectConfigInfo.configDir }),
        validateProjectOutputOwnership(projectConfigInfo),
        validateProjectImplementationTrust(projectConfigInfo)
      )
    : { ok: false, errors: [{ message: "Missing topogram.project.json or compatible topogram.implementation.json", loc: null }] };
  const payload = checkSummaryPayload({ inputPath: topogramPath, ast, resolved, projectConfigInfo, projectValidation });
  const publicContext = {
    projectRoot: projectConfigInfo?.configDir || process.cwd(),
    workspaceRoot: topogramPath,
    cwd: process.cwd()
  };
  if (options.json) {
    console.log(stablePublicStringify(payload, publicContext));
  } else if (payload.ok) {
    const publicPayload = sanitizePublicPayload(payload, publicContext);
    console.log(`Topogram check passed for ${toPortablePath(topogramPath, publicContext)}.`);
    console.log(`Validated ${publicPayload.topogram.files} file(s) and ${publicPayload.topogram.statements} statement(s).`);
    console.log(`Project config: ${publicPayload.project.configPath || "compatibility defaults"}`);
    printTopologySummary(publicPayload.project.resolvedTopology);
  } else {
    if (!resolved.ok) {
      console.error(formatValidationErrors(resolved.validation));
    }
    if (!projectValidation.ok) {
      console.error(formatProjectConfigErrors(projectValidation, projectConfigInfo?.configPath || "topogram.project.json"));
    }
  }
  return payload.ok ? 0 : 1;
}
