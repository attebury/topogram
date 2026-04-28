// @ts-check

import fs from "node:fs";
import path from "node:path";

import {
  getGeneratorManifest,
  isGeneratorCompatible
} from "./generator/registry.js";

/**
 * @typedef {Object} GeneratorBinding
 * @property {string} id
 * @property {string} version
 */

/**
 * @typedef {Object} RuntimeTopologyComponent
 * @property {string} id
 * @property {"api"|"web"|"database"|"native"} type
 * @property {string} projection
 * @property {GeneratorBinding} generator
 * @property {number|null} [port]
 * @property {string} [api]
 * @property {string} [database]
 * @property {Record<string, string>} [env]
 */

/**
 * @typedef {Object} ProjectConfig
 * @property {string} version
 * @property {Record<string, { path: string, ownership: "generated"|"maintained" }>} outputs
 * @property {{ components: RuntimeTopologyComponent[] }} topology
 * @property {{ id?: string, module?: string, export?: string, implementation_module?: string, implementation_export?: string }} [implementation]
 */

const PROJECT_CONFIG_FILE = "topogram.project.json";
const LEGACY_IMPLEMENTATION_FILE = "topogram.implementation.json";
const GENERATED_OUTPUT_SENTINEL = ".topogram-generated.json";
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

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

function normalizeRoot(root) {
  return String(root || "").replace(/\\/g, "/");
}

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

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

export function findProjectConfig(root) {
  return findConfigFile(root, PROJECT_CONFIG_FILE);
}

export function findLegacyImplementationConfig(root) {
  return findConfigFile(root, LEGACY_IMPLEMENTATION_FILE);
}

export function defaultProjectConfigForGraph(graph, implementation = null) {
  const runtimeReference = implementation?.runtime?.reference || {};
  const apiProjection = (graph.byKind.projection || []).find((projection) => (projection.http || []).length > 0);
  const webProjection =
    (graph.byKind.projection || []).find((projection) => projection.id === "proj_ui_web") ||
    (graph.byKind.projection || []).find((projection) => projection.platform === "ui_web");
  const dbProjection =
    (graph.byKind.projection || []).find((projection) => projection.id === runtimeReference.localDbProjectionId) ||
    (graph.byKind.projection || []).find((projection) => projection.platform === "db_postgres") ||
    (graph.byKind.projection || []).find((projection) => projection.platform === "db_sqlite");
  const ports = runtimeReference.ports || {};
  const dbGenerator = dbProjection?.platform === "db_sqlite" ? "topogram/sqlite" : "topogram/postgres";

  return {
    version: "0.1",
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
      components: [
        ...(apiProjection && dbProjection
          ? [{
              id: "api",
              type: "api",
              projection: apiProjection.id,
              generator: { id: "topogram/hono", version: "1" },
              port: ports.server || 3000,
              database: "db"
            }]
          : []),
        ...(webProjection
          ? [{
              id: "web",
              type: "web",
              projection: webProjection.id,
              generator: { id: "topogram/sveltekit", version: "1" },
              port: ports.web || 5173,
              api: "api"
            }]
          : []),
        ...(dbProjection
          ? [{
              id: "db",
              type: "database",
              projection: dbProjection.id,
              generator: { id: dbGenerator, version: "1" },
              port: dbProjection.platform === "db_sqlite" ? null : 5432
            }]
          : [])
      ]
    }
  };
}

export function loadProjectConfig(root) {
  const found = findProjectConfig(root);
  if (!found) {
    return null;
  }
  return {
    ...found,
    compatibility: false
  };
}

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

function pushError(errors, message, loc = null) {
  errors.push({ message, loc });
}

function projectionById(graph) {
  return new Map((graph?.byKind?.projection || []).map((projection) => [projection.id, projection]));
}

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

function componentLabel(component) {
  return component?.id ? `Component '${component.id}'` : "Topology component";
}

function validateComponentShape(errors, component, seenIds) {
  if (!component || typeof component !== "object" || Array.isArray(component)) {
    pushError(errors, "Topology component must be an object");
    return false;
  }
  if (typeof component.id !== "string" || !IDENTIFIER_PATTERN.test(component.id)) {
    pushError(errors, `${componentLabel(component)} id must match ${IDENTIFIER_PATTERN}`);
  } else if (seenIds.has(component.id)) {
    pushError(errors, `Duplicate topology component id '${component.id}'`);
  } else {
    seenIds.add(component.id);
  }
  if (!["api", "web", "database", "native"].includes(component.type)) {
    pushError(errors, `${componentLabel(component)} type must be api, web, database, or native`);
  }
  if (typeof component.projection !== "string" || component.projection.length === 0) {
    pushError(errors, `${componentLabel(component)} projection must be a non-empty string`);
  }
  if (!component.generator || typeof component.generator !== "object") {
    pushError(errors, `${componentLabel(component)} generator must be an object`);
  } else {
    if (typeof component.generator.id !== "string" || component.generator.id.length === 0) {
      pushError(errors, `${componentLabel(component)} generator.id must be a non-empty string`);
    }
    if (typeof component.generator.version !== "string" || component.generator.version.length === 0) {
      pushError(errors, `${componentLabel(component)} generator.version must be a non-empty string`);
    }
  }
  if (component.port != null && (!Number.isInteger(component.port) || component.port <= 0 || component.port > 65535)) {
    pushError(errors, `${componentLabel(component)} port must be an integer from 1 to 65535`);
  }
  return true;
}

function validateComponentCompatibility(errors, component, projections) {
  const projection = projections.get(component.projection);
  if (!projection) {
    pushError(errors, `${componentLabel(component)} references missing projection '${component.projection}'`);
    return;
  }

  const manifest = getGeneratorManifest(component.generator?.id);
  if (!manifest) {
    pushError(errors, `${componentLabel(component)} uses unknown generator '${component.generator?.id}'`);
    return;
  }
  if (manifest.planned) {
    pushError(errors, `${componentLabel(component)} uses planned generator '${manifest.id}', which is not implemented yet`);
  }
  if (manifest.version !== component.generator.version) {
    pushError(errors, `${componentLabel(component)} generator '${manifest.id}' version '${component.generator.version}' is unsupported; expected '${manifest.version}'`);
  }
  if (!isGeneratorCompatible(manifest, component.type, projection)) {
    pushError(errors, `${componentLabel(component)} generator '${manifest.id}' is incompatible with projection '${projection.id}'`);
  }
}

function validateTopologyReferences(errors, components) {
  const byId = new Map(components.map((component) => [component.id, component]));
  const usedPorts = new Map();
  for (const component of components) {
    if (component.port != null) {
      const existing = usedPorts.get(component.port);
      if (existing) {
        pushError(errors, `Port ${component.port} is used by both '${existing}' and '${component.id}'`);
      } else {
        usedPorts.set(component.port, component.id);
      }
    }
    if (component.type === "api") {
      if (!component.database) {
        pushError(errors, `${componentLabel(component)} must reference a database component`);
      } else if (byId.get(component.database)?.type !== "database") {
        pushError(errors, `${componentLabel(component)} references missing database component '${component.database}'`);
      }
    }
    if (component.type === "web") {
      if (!component.api) {
        pushError(errors, `${componentLabel(component)} must reference an api component`);
      } else if (byId.get(component.api)?.type !== "api") {
        pushError(errors, `${componentLabel(component)} references missing api component '${component.api}'`);
      }
    }
  }
}

export function validateProjectConfig(config, graph = null) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, errors: [{ message: "topogram.project.json must contain a JSON object", loc: null }] };
  }
  if (typeof config.version !== "string" || config.version.length === 0) {
    pushError(errors, "topogram.project.json version must be a non-empty string");
  }
  validateOutputConfig(errors, config);
  if (!config.topology || typeof config.topology !== "object" || !Array.isArray(config.topology.components)) {
    pushError(errors, "topogram.project.json topology.components must be an array");
  } else {
    const seenIds = new Set();
    for (const component of config.topology.components) {
      validateComponentShape(errors, component, seenIds);
    }
    if (graph) {
      const projections = projectionById(graph);
      for (const component of config.topology.components) {
        validateComponentCompatibility(errors, component, projections);
      }
      validateTopologyReferences(errors, config.topology.components);
    }
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

export function formatProjectConfigErrors(result, configPath = PROJECT_CONFIG_FILE) {
  return result.errors
    .map((error) => `${normalizeRoot(configPath)} ${error.message}`)
    .join("\n");
}

export function resolveOutputPath(configInfo, outputName) {
  const output = configInfo?.config?.outputs?.[outputName];
  if (!output?.path) {
    return null;
  }
  const baseDir = configInfo.configDir || process.cwd();
  return resolveComparablePath(path.resolve(baseDir, output.path));
}

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

export function validateProjectOutputOwnership(configInfo) {
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
