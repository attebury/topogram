// @ts-check

import fs from "node:fs";
import path from "node:path";

import {
  isGeneratorCompatible,
  resolveGeneratorManifestForBinding,
  validateGeneratorManifest
} from "../generator/registry.js";
import { validateProjectGeneratorPolicy } from "../generator-policy.js";
import { DEFAULT_WORKSPACE_PATH, normalizeWorkspaceConfigPath } from "../workspace-paths.js";

/**
 * @typedef {Object} GeneratorBinding
 * @property {string} id
 * @property {string} version
 * @property {string} [package]
 */

/**
 * @typedef {Object} RuntimeMigrationStrategy
 * @property {"generated"|"maintained"} ownership
 * @property {"sql"|"prisma"|"drizzle"} tool
 * @property {"never"|"script"} apply
 * @property {string} [statePath]
 * @property {string} [snapshotPath]
 * @property {string} [schemaPath]
 * @property {string} [migrationsPath]
 */

/**
 * @typedef {Object} RuntimeTopologyRuntime
 * @property {string} id
 * @property {"api_service"|"web_surface"|"ios_surface"|"android_surface"|"database"} kind
 * @property {string} projection
 * @property {GeneratorBinding} generator
 * @property {number|null} [port]
 * @property {string} [uses_api]
 * @property {string} [uses_database]
 * @property {Record<string, string>} [env]
 * @property {RuntimeMigrationStrategy} [migration]
 */

/**
 * @typedef {Object} ProjectConfig
 * @property {string} version
 * @property {string} [workspace]
 * @property {Record<string, { path: string, ownership: "generated"|"maintained" }>} outputs
 * @property {{ runtimes: RuntimeTopologyRuntime[] }} topology
 * @property {{ id?: string, module?: string, export?: string, implementation_module?: string, implementation_export?: string }} [implementation]
 * @property {Record<string, any>} [template]
 */

/**
 * @typedef {Object} ProjectConfigInfo
 * @property {ProjectConfig} config
 * @property {string|null} configPath
 * @property {string} configDir
 * @property {boolean} [compatibility]
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} message
 * @property {any} loc
 */

const PROJECT_CONFIG_FILE = "topogram.project.json";
const LEGACY_IMPLEMENTATION_FILE = "topogram.implementation.json";
const GENERATED_OUTPUT_SENTINEL = ".topogram-generated.json";
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
const MIGRATION_OWNERSHIPS = new Set(["generated", "maintained"]);
const MIGRATION_TOOLS = new Set(["sql", "prisma", "drizzle"]);
const MIGRATION_APPLY_MODES = new Set(["never", "script"]);
const MIGRATION_PATH_FIELDS = ["statePath", "snapshotPath", "schemaPath", "migrationsPath"];

/**
 * @param {string|null|undefined} root
 * @returns {string|null}
 */
function normalizeSearchRoot(root) {
  if (!root) {
    return null;
  }
  const absolute = path.resolve(root);
  try {
    return fs.realpathSync(absolute);
  } catch {
    return absolute;
  }
}

/**
 * @param {string} root
 * @returns {string}
 */
function normalizeRoot(root) {
  return String(root || "").replace(/\\/g, "/");
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function resolveComparablePath(filePath) {
  const absolute = path.resolve(filePath);
  try {
    return fs.existsSync(absolute)
      ? fs.realpathSync(absolute)
      : path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute));
  } catch {
    return absolute;
  }
}

/**
 * @param {string} filePath
 * @returns {any}
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * @param {string} oldName
 * @param {string} newName
 * @param {string} example
 * @returns {string}
 */
function renameDiagnostic(oldName, newName, example) {
  return `${oldName} was renamed to ${newName}. Example fix: ${example}`;
}

/**
 * @param {string} root
 * @param {string} fileName
 * @returns {{ config: any, configPath: string, configDir: string }|null}
 */
function findConfigFile(root, fileName) {
  let current = normalizeSearchRoot(root);
  while (current && current !== path.dirname(current)) {
    const candidate = path.join(current, fileName);
    if (fs.existsSync(candidate)) {
      return {
        config: readJson(candidate),
        configPath: candidate,
        configDir: path.dirname(candidate)
      };
    }
    current = path.dirname(current);
  }
  return null;
}

/**
 * @param {string} root
 * @returns {{ config: any, configPath: string, configDir: string }|null}
 */
export function findProjectConfig(root) {
  return findConfigFile(root, PROJECT_CONFIG_FILE);
}

/**
 * @param {string} root
 * @returns {{ config: any, configPath: string, configDir: string }|null}
 */
export function findLegacyImplementationConfig(root) {
  return findConfigFile(root, LEGACY_IMPLEMENTATION_FILE);
}

/**
 * @param {Record<string, any>} graph
 * @param {Record<string, any>|null} [implementation]
 * @returns {ProjectConfig}
 */
export function defaultProjectConfigForGraph(graph, implementation = null) {
  const runtimeReference = implementation?.runtime?.reference || {};
  /** @type {Array<Record<string, any>>} */
  const projections = graph.byKind.projection || [];
  const apiProjection = projections.find((projection) => (projection.http || []).length > 0 || projection.type === "api_contract");
  const webProjection =
    projections.find((projection) => projection.id === "proj_web") ||
    projections.find((projection) => projection.type === "web_surface");
  const dbProjection =
    projections.find((projection) => projection.id === runtimeReference.localDbProjectionId) ||
    projections.find((projection) => projection.type === "db_contract");
  const ports = runtimeReference.ports || {};
  const dbProfile = (dbProjection?.generatorDefaults || []).find((/** @type {Record<string, any>} */ entry) => entry.key === "profile")?.value;
  const dbGenerator = dbProfile === "sqlite_sql" ? "topogram/sqlite" : "topogram/postgres";
  const dbRuntimeId = dbProfile === "sqlite_sql" ? "app_sqlite" : "app_postgres";
  /** @type {RuntimeTopologyRuntime[]} */
  const runtimes = [
    ...(apiProjection
      ? [{
          id: "app_api",
          kind: /** @type {"api_service"} */ ("api_service"),
          projection: apiProjection.id,
          generator: { id: "topogram/hono", version: "1" },
          port: ports.server || 3000,
          ...(dbProjection ? { uses_database: dbRuntimeId } : {})
        }]
      : []),
    ...(webProjection
      ? [{
          id: "app_sveltekit",
          kind: /** @type {"web_surface"} */ ("web_surface"),
          projection: webProjection.id,
          generator: { id: "topogram/sveltekit", version: "1" },
          port: ports.web || 5173,
          ...(apiProjection ? { uses_api: "app_api" } : {})
        }]
      : []),
    ...(dbProjection
      ? [{
          id: dbRuntimeId,
          kind: /** @type {"database"} */ ("database"),
          projection: dbProjection.id,
          generator: { id: dbGenerator, version: "1" },
          port: dbProfile === "sqlite_sql" ? null : 5432
        }]
      : [])
  ];

  return {
    version: "0.1",
    workspace: DEFAULT_WORKSPACE_PATH,
    implementation: implementation?.exampleId
      ? {
          id: implementation.exampleId
        }
      : undefined,
    outputs: {
      app: {
        path: "./app",
        ownership: "generated"
      }
    },
    topology: {
      runtimes
    }
  };
}

/**
 * @param {ValidationError[]} errors
 * @param {any} config
 * @returns {void}
 */
function validateWorkspaceConfig(errors, config) {
  if (Object.prototype.hasOwnProperty.call(config, "workspaces")) {
    pushError(errors, "topogram.project.json workspaces[] is not supported yet; use workspace instead");
  }
  if (!Object.prototype.hasOwnProperty.call(config, "workspace")) {
    return;
  }
  if (typeof config.workspace !== "string") {
    pushError(errors, "topogram.project.json workspace must be a non-empty relative path");
    return;
  }
  try {
    normalizeWorkspaceConfigPath(config.workspace);
  } catch (error) {
    pushError(errors, error instanceof Error ? error.message : String(error));
  }
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isProjectRelativePath(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  if (path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.posix.normalize(value.replace(/\\/g, "/"));
  return normalized !== ".." && !normalized.startsWith("../");
}

/**
 * @param {string} root
 * @returns {ProjectConfigInfo|null}
 */
export function loadProjectConfig(root) {
  const found = findProjectConfig(root);
  if (!found) {
    return null;
  }
  return {
    ...found,
    config: found.config,
    compatibility: false
  };
}

/**
 * @param {string} root
 * @param {Record<string, any>|null} [graph]
 * @param {Record<string, any>|null} [implementation]
 * @returns {ProjectConfigInfo|null}
 */
export function projectConfigOrDefault(root, graph = null, implementation = null) {
  const found = loadProjectConfig(root);
  if (found) {
    return found;
  }
  if (!graph) {
    return null;
  }
  return {
    config: defaultProjectConfigForGraph(graph, implementation),
    configPath: null,
    configDir: path.dirname(path.resolve(root)),
    compatibility: true
  };
}

/**
 * @param {ValidationError[]} errors
 * @param {string} message
 * @param {any} [loc]
 * @returns {void}
 */
function pushError(errors, message, loc = null) {
  errors.push({ message, loc });
}

/**
 * @param {Record<string, any>} graph
 * @returns {Map<string, Record<string, any>>}
 */
function projectionById(graph) {
  /** @type {Array<Record<string, any>>} */
  const projections = graph?.byKind?.projection || [];
  return new Map(projections.map((projection) => [projection.id, projection]));
}

/**
 * @param {ValidationError[]} errors
 * @param {any} config
 * @returns {void}
 */
function validateOutputConfig(errors, config) {
  if (!config.outputs || typeof config.outputs !== "object" || Array.isArray(config.outputs)) {
    pushError(errors, "topogram.project.json outputs must be an object");
    return;
  }
  for (const [name, output] of Object.entries(config.outputs)) {
    if (!output || typeof output !== "object" || Array.isArray(output)) {
      pushError(errors, `Output '${name}' must be an object`);
      continue;
    }
    if (!["generated", "maintained"].includes(output.ownership)) {
      pushError(errors, `Output '${name}' ownership must be generated or maintained`);
    }
    if (typeof output.path !== "string" || output.path.length === 0) {
      pushError(errors, `Output '${name}' path must be a non-empty string`);
    }
  }
}

/**
 * @param {any} runtime
 * @returns {string}
 */
function runtimeLabel(runtime) {
  return runtime?.id ? `Runtime '${runtime.id}'` : "Topology runtime";
}

/**
 * @param {ValidationError[]} errors
 * @param {any} runtime
 * @param {Set<string>} seenIds
 * @returns {boolean}
 */
function validateRuntimeShape(errors, runtime, seenIds) {
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
    pushError(errors, "Topology runtime must be an object");
    return false;
  }
  if (typeof runtime.id !== "string" || !IDENTIFIER_PATTERN.test(runtime.id)) {
    pushError(errors, `${runtimeLabel(runtime)} id must match ${IDENTIFIER_PATTERN}`);
  } else if (seenIds.has(runtime.id)) {
    pushError(errors, `Duplicate topology runtime id '${runtime.id}'`);
  } else {
    seenIds.add(runtime.id);
  }
  if (runtime.type != null) {
    pushError(errors, `${runtimeLabel(runtime)} ${renameDiagnostic("'type'", "'kind'", `"kind": "api_service"`)}`);
  }
  if (runtime.database != null) {
    pushError(errors, `${runtimeLabel(runtime)} ${renameDiagnostic("'database'", "'uses_database'", `"uses_database": "app_db"`)}`);
  }
  if (runtime.api != null) {
    pushError(errors, `${runtimeLabel(runtime)} ${renameDiagnostic("'api'", "'uses_api'", `"uses_api": "app_api"`)}`);
  }
  if (!["api_service", "web_surface", "ios_surface", "android_surface", "database"].includes(runtime.kind)) {
    pushError(errors, `${runtimeLabel(runtime)} kind must be api_service, web_surface, ios_surface, android_surface, or database`);
  }
  if (typeof runtime.projection !== "string" || runtime.projection.length === 0) {
    pushError(errors, `${runtimeLabel(runtime)} projection must be a non-empty string`);
  }
  if (!runtime.generator || typeof runtime.generator !== "object") {
    pushError(errors, `${runtimeLabel(runtime)} generator must be an object`);
  } else {
    if (typeof runtime.generator.id !== "string" || runtime.generator.id.length === 0) {
      pushError(errors, `${runtimeLabel(runtime)} generator.id must be a non-empty string`);
    }
    if (typeof runtime.generator.version !== "string" || runtime.generator.version.length === 0) {
      pushError(errors, `${runtimeLabel(runtime)} generator.version must be a non-empty string`);
    }
    if (runtime.generator.package != null && (typeof runtime.generator.package !== "string" || runtime.generator.package.length === 0)) {
      pushError(errors, `${runtimeLabel(runtime)} generator.package must be a non-empty string when provided`);
    }
  }
  if (runtime.port != null && (!Number.isInteger(runtime.port) || runtime.port <= 0 || runtime.port > 65535)) {
    pushError(errors, `${runtimeLabel(runtime)} port must be an integer from 1 to 65535`);
  }
  validateRuntimeMigrationStrategy(errors, runtime);
  return true;
}

/**
 * @param {ValidationError[]} errors
 * @param {any} runtime
 * @returns {void}
 */
function validateRuntimeMigrationStrategy(errors, runtime) {
  if (runtime.migration == null) {
    return;
  }
  if (runtime.kind !== "database") {
    pushError(errors, `${runtimeLabel(runtime)} migration is only supported on database runtimes`);
    return;
  }
  const migration = runtime.migration;
  if (!migration || typeof migration !== "object" || Array.isArray(migration)) {
    pushError(errors, `${runtimeLabel(runtime)} migration must be an object`);
    return;
  }
  if (!MIGRATION_OWNERSHIPS.has(migration.ownership)) {
    pushError(errors, `${runtimeLabel(runtime)} migration.ownership must be generated or maintained`);
  }
  if (!MIGRATION_TOOLS.has(migration.tool)) {
    pushError(errors, `${runtimeLabel(runtime)} migration.tool must be sql, prisma, or drizzle`);
  }
  if (!MIGRATION_APPLY_MODES.has(migration.apply)) {
    pushError(errors, `${runtimeLabel(runtime)} migration.apply must be never or script`);
  }
  if (migration.ownership === "maintained" && migration.apply !== "never") {
    pushError(errors, `${runtimeLabel(runtime)} maintained migration.apply must be never`);
  }
  if (migration.ownership === "generated" && migration.apply !== "script") {
    pushError(errors, `${runtimeLabel(runtime)} generated migration.apply must be script`);
  }
  for (const field of MIGRATION_PATH_FIELDS) {
    if (migration[field] != null && !isProjectRelativePath(migration[field])) {
      pushError(errors, `${runtimeLabel(runtime)} migration.${field} must be a non-empty relative path that stays inside the project root`);
    }
  }
  if (migration.ownership === "generated" && typeof migration.statePath !== "string") {
    pushError(errors, `${runtimeLabel(runtime)} generated migration requires statePath`);
  }
  if (migration.ownership === "maintained" && typeof migration.snapshotPath !== "string") {
    pushError(errors, `${runtimeLabel(runtime)} maintained migration requires snapshotPath`);
  }
  if (migration.ownership === "maintained" && migration.tool === "prisma") {
    if (typeof migration.schemaPath !== "string") {
      pushError(errors, `${runtimeLabel(runtime)} maintained prisma migration requires schemaPath`);
    }
    if (typeof migration.migrationsPath !== "string") {
      pushError(errors, `${runtimeLabel(runtime)} maintained prisma migration requires migrationsPath`);
    }
  }
  if (migration.ownership === "maintained" && migration.tool === "drizzle") {
    if (typeof migration.schemaPath !== "string") {
      pushError(errors, `${runtimeLabel(runtime)} maintained drizzle migration requires schemaPath`);
    }
    if (typeof migration.migrationsPath !== "string") {
      pushError(errors, `${runtimeLabel(runtime)} maintained drizzle migration requires migrationsPath`);
    }
  }
  if (migration.ownership === "maintained" && migration.tool === "sql" && typeof migration.migrationsPath !== "string") {
    pushError(errors, `${runtimeLabel(runtime)} maintained sql migration requires migrationsPath`);
  }
}

/**
 * @param {ValidationError[]} errors
 * @param {RuntimeTopologyRuntime} runtime
 * @param {Map<string, Record<string, any>>} projections
 * @param {{ configDir?: string|null, rootDir?: string|null }} [options]
 * @returns {void}
 */
function validateRuntimeCompatibility(errors, runtime, projections, options = {}) {
  const projection = projections.get(runtime.projection);
  if (!projection) {
    pushError(errors, `${runtimeLabel(runtime)} references missing projection '${runtime.projection}'`);
    return;
  }

  const resolvedManifest = resolveGeneratorManifestForBinding(runtime.generator, options);
  const manifest = resolvedManifest.manifest;
  if (!manifest) {
    const details = resolvedManifest.errors.length > 0 ? `: ${resolvedManifest.errors.join("; ")}` : "";
    pushError(errors, `${runtimeLabel(runtime)} for projection '${projection.id}' uses unknown generator '${runtime.generator?.id}' version '${runtime.generator?.version || "unknown"}'${details}`);
    return;
  }
  const manifestValidation = validateGeneratorManifest(manifest);
  if (!manifestValidation.ok) {
    for (const message of manifestValidation.errors) {
      pushError(errors, `${runtimeLabel(runtime)} generator manifest invalid: ${message}`);
    }
  }
  if (manifest.planned) {
    pushError(errors, `${runtimeLabel(runtime)} for projection '${projection.id}' uses planned generator '${manifest.id}@${manifest.version}', which is not implemented yet`);
  }
  if (manifest.version !== runtime.generator.version) {
    pushError(errors, `${runtimeLabel(runtime)} for projection '${projection.id}' generator '${manifest.id}' version '${runtime.generator.version}' is unsupported; expected '${manifest.version}'`);
  }
  if (!isGeneratorCompatible(manifest, runtime.kind, projection)) {
    pushError(errors, `${runtimeLabel(runtime)} for projection '${projection.id}' generator '${manifest.id}@${manifest.version}' is incompatible with runtime kind '${runtime.kind}' and projection type '${projection.type || "api_contract"}'`);
  }
}

/**
 * @param {ValidationError[]} errors
 * @param {RuntimeTopologyRuntime[]} runtimes
 * @returns {void}
 */
function validateTopologyReferences(errors, runtimes) {
  const byId = new Map(runtimes.map((runtime) => [runtime.id, runtime]));
  const usedPorts = new Map();
  for (const runtime of runtimes) {
    if (runtime.port != null) {
      const existing = usedPorts.get(runtime.port);
      if (existing) {
        pushError(errors, `Port ${runtime.port} is used by both '${existing}' and '${runtime.id}'`);
      } else {
        usedPorts.set(runtime.port, runtime.id);
      }
    }
    if (runtime.kind === "api_service") {
      if (runtime.uses_database && byId.get(runtime.uses_database)?.kind !== "database") {
        pushError(errors, `${runtimeLabel(runtime)} references missing database runtime '${runtime.uses_database}'`);
      }
    }
    if (["web_surface", "ios_surface", "android_surface"].includes(runtime.kind)) {
      if (runtime.uses_api && byId.get(runtime.uses_api)?.kind !== "api_service") {
        pushError(errors, `${runtimeLabel(runtime)} references missing api runtime '${runtime.uses_api}'`);
      }
    }
  }
}

/**
 * @param {any} config
 * @param {Record<string, any>|null} [graph]
 * @param {{ configDir?: string|null, rootDir?: string|null }} [options]
 * @returns {{ ok: boolean, errors: ValidationError[] }}
 */
export function validateProjectConfig(config, graph = null, options = {}) {
  /** @type {ValidationError[]} */
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, errors: [{ message: "topogram.project.json must contain a JSON object", loc: null }] };
  }
  if (typeof config.version !== "string" || config.version.length === 0) {
    pushError(errors, "topogram.project.json version must be a non-empty string");
  }
  validateWorkspaceConfig(errors, config);
  validateOutputConfig(errors, config);
  if (config.topology?.components != null) {
    pushError(errors, `topogram.project.json ${renameDiagnostic("'topology.components'", "'topology.runtimes'", `"topology": { "runtimes": [] }`)}`);
  }
  if (!config.topology || typeof config.topology !== "object" || !Array.isArray(config.topology.runtimes)) {
    pushError(errors, "topogram.project.json topology.runtimes must be an array");
  } else {
    const seenIds = new Set();
    for (const runtime of config.topology.runtimes) {
      validateRuntimeShape(errors, runtime, seenIds);
    }
    const generatorPolicy = validateProjectGeneratorPolicy(config, options);
    for (const error of generatorPolicy.errors) {
      pushError(errors, error.message, error.loc);
    }
    if (graph) {
      const projections = projectionById(graph);
      for (const runtime of config.topology.runtimes) {
        validateRuntimeCompatibility(errors, runtime, projections, options);
      }
      validateTopologyReferences(errors, config.topology.runtimes);
    }
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * @param {{ errors: ValidationError[] }} result
 * @param {string} [configPath]
 * @returns {string}
 */
export function formatProjectConfigErrors(result, configPath = PROJECT_CONFIG_FILE) {
  return result.errors
    .map((error) => `${normalizeRoot(configPath)} ${error.message}`)
    .join("\n");
}

/**
 * @param {ProjectConfigInfo|null|undefined} configInfo
 * @param {string} outputName
 * @returns {string|null}
 */
export function resolveOutputPath(configInfo, outputName) {
  const output = configInfo?.config?.outputs?.[outputName];
  if (!configInfo || !output?.path) {
    return null;
  }
  const baseDir = configInfo.configDir || process.cwd();
  return resolveComparablePath(path.resolve(baseDir, output.path));
}

/**
 * @param {ProjectConfigInfo|null|undefined} configInfo
 * @param {string} outDir
 * @returns {{ name: string, ownership: string, path: string }|null}
 */
export function outputOwnershipForPath(configInfo, outDir) {
  if (!configInfo?.config?.outputs) {
    return null;
  }
  const resolvedOutDir = resolveComparablePath(outDir);
  for (const [name, output] of Object.entries(configInfo.config.outputs)) {
    if (!output?.path) {
      continue;
    }
    const resolvedOutput = resolveComparablePath(path.resolve(configInfo.configDir || process.cwd(), output.path));
    if (resolvedOutput === resolvedOutDir) {
      return {
        name,
        ownership: output.ownership,
        path: resolvedOutput
      };
    }
  }
  return null;
}

/**
 * @param {ProjectConfigInfo|null|undefined} configInfo
 * @returns {{ ok: boolean, errors: ValidationError[] }}
 */
export function validateProjectOutputOwnership(configInfo) {
  /** @type {ValidationError[]} */
  const errors = [];
  if (!configInfo?.config?.outputs) {
    return { ok: true, errors };
  }
  for (const [name, output] of Object.entries(configInfo.config.outputs)) {
    if (!output?.path || !["generated", "maintained"].includes(output.ownership)) {
      continue;
    }
    const resolvedOutput = resolveComparablePath(path.resolve(configInfo.configDir || process.cwd(), output.path));
    const sentinelPath = path.join(resolvedOutput, GENERATED_OUTPUT_SENTINEL);
    if (output.ownership === "generated" && fs.existsSync(resolvedOutput) && !fs.existsSync(sentinelPath)) {
      pushError(
        errors,
        `Generated output '${name}' at '${normalizeRoot(resolvedOutput)}' is missing ${GENERATED_OUTPUT_SENTINEL}`
      );
    }
    if (output.ownership === "maintained" && fs.existsSync(sentinelPath)) {
      pushError(
        errors,
        `Maintained output '${name}' at '${normalizeRoot(resolvedOutput)}' contains ${GENERATED_OUTPUT_SENTINEL}`
      );
    }
  }
  return {
    ok: errors.length === 0,
    errors
  };
}
