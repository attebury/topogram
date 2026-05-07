// @ts-check

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { UI_GENERATOR_RENDERED_COMPONENT_PATTERNS } from "../ui/taxonomy.js";

/**
 * @typedef {Object} GeneratorManifest
 * @property {string} id
 * @property {string} version
 * @property {"api"|"web"|"database"|"native"} surface
 * @property {string[]} runtimeKinds
 * @property {string[]} projectionTypes
 * @property {string[]} inputs
 * @property {string[]} outputs
 * @property {Record<string, string>} stack
 * @property {Record<string, boolean>} capabilities
 * @property {{ patterns?: string[], behaviors?: string[], unsupported?: "error"|"warning"|"contract-only" }} [widgetSupport]
 * @property {"bundled"|"package"} source
 * @property {string} [profile]
 * @property {string} [package]
 * @property {string} [export]
 * @property {boolean} [planned]
 */

const RENDERED_COMPONENT_PATTERNS = [...UI_GENERATOR_RENDERED_COMPONENT_PATTERNS];

/** @type {GeneratorManifest[]} */
export const GENERATOR_MANIFESTS = [
  {
    id: "topogram/hono",
    version: "1",
    surface: "api",
    runtimeKinds: ["api_service"],
    projectionTypes: ["api_contract"],
    inputs: ["server-contract", "api-contracts"],
    outputs: ["api-service"],
    stack: { runtime: "node", framework: "hono", language: "typescript" },
    capabilities: { http: true, stateless: true, persistence: true },
    source: "bundled",
    profile: "hono"
  },
  {
    id: "topogram/express",
    version: "1",
    surface: "api",
    runtimeKinds: ["api_service"],
    projectionTypes: ["api_contract"],
    inputs: ["server-contract", "api-contracts"],
    outputs: ["api-service"],
    stack: { runtime: "node", framework: "express", language: "typescript" },
    capabilities: { http: true, stateless: true, persistence: true },
    source: "bundled",
    profile: "express"
  },
  {
    id: "topogram/vanilla-web",
    version: "1",
    surface: "web",
    runtimeKinds: ["web_surface"],
    projectionTypes: ["web_surface"],
    inputs: ["ui-surface-contract"],
    outputs: ["web-app", "generation-coverage"],
    stack: { runtime: "browser", framework: "vanilla", language: "javascript" },
    capabilities: { routes: true, components: false, coverage: true },
    widgetSupport: { patterns: [], behaviors: [], unsupported: "contract-only" },
    source: "bundled",
    profile: "vanilla"
  },
  {
    id: "topogram/sveltekit",
    version: "1",
    surface: "web",
    runtimeKinds: ["web_surface"],
    projectionTypes: ["web_surface"],
    inputs: ["ui-surface-contract", "api-contracts"],
    outputs: ["web-app", "generation-coverage"],
    stack: { runtime: "node", framework: "sveltekit", language: "typescript" },
    capabilities: { routes: true, components: true, coverage: true },
    widgetSupport: {
      patterns: RENDERED_COMPONENT_PATTERNS,
      behaviors: ["selection", "sorting", "filtering", "search", "pagination", "bulk_action", "optimistic_update"],
      unsupported: "warning"
    },
    source: "bundled",
    profile: "sveltekit"
  },
  {
    id: "topogram/react",
    version: "1",
    surface: "web",
    runtimeKinds: ["web_surface"],
    projectionTypes: ["web_surface"],
    inputs: ["ui-surface-contract", "api-contracts"],
    outputs: ["web-app", "generation-coverage"],
    stack: { runtime: "browser", framework: "react", language: "typescript" },
    capabilities: { routes: true, components: true, coverage: true },
    widgetSupport: {
      patterns: RENDERED_COMPONENT_PATTERNS,
      behaviors: ["selection", "sorting", "filtering", "search", "pagination", "bulk_action", "optimistic_update"],
      unsupported: "warning"
    },
    source: "bundled",
    profile: "react"
  },
  {
    id: "topogram/swiftui",
    version: "1",
    surface: "native",
    runtimeKinds: ["ios_surface"],
    projectionTypes: ["ios_surface"],
    inputs: ["ui-surface-contract", "api-contracts"],
    outputs: ["native-app"],
    stack: { platform: "ios", framework: "swiftui", language: "swift" },
    capabilities: { routes: true, components: false, coverage: false },
    widgetSupport: { patterns: [], behaviors: [], unsupported: "contract-only" },
    source: "bundled",
    profile: "swiftui"
  },
  {
    id: "topogram/postgres",
    version: "1",
    surface: "database",
    runtimeKinds: ["database"],
    projectionTypes: ["db_contract"],
    inputs: ["db-contract", "db-lifecycle-plan"],
    outputs: ["db-lifecycle-bundle", "sql-schema", "sql-migration", "prisma-schema", "drizzle-schema"],
    stack: { database: "postgres", language: "sql" },
    capabilities: { lifecycle: true, migrations: true, prisma: true, drizzle: true },
    source: "bundled",
    profile: "postgres"
  },
  {
    id: "topogram/sqlite",
    version: "1",
    surface: "database",
    runtimeKinds: ["database"],
    projectionTypes: ["db_contract"],
    inputs: ["db-contract", "db-lifecycle-plan"],
    outputs: ["db-lifecycle-bundle", "sql-schema", "sql-migration", "prisma-schema"],
    stack: { database: "sqlite", language: "sql" },
    capabilities: { lifecycle: true, migrations: true, prisma: true, drizzle: false },
    source: "bundled",
    profile: "sqlite"
  },
  {
    id: "topogram/android-compose",
    version: "1",
    surface: "native",
    runtimeKinds: ["android_surface"],
    projectionTypes: ["android_surface"],
    inputs: ["ui-surface-contract", "api-contracts"],
    outputs: ["native-app"],
    stack: { platform: "android", framework: "compose", language: "kotlin" },
    capabilities: { routes: true, components: false, coverage: false },
    widgetSupport: { patterns: [], behaviors: [], unsupported: "contract-only" },
    source: "bundled",
    profile: "compose",
    planned: true
  }
];

const GENERATOR_BY_ID = new Map(GENERATOR_MANIFESTS.map((manifest) => [manifest.id, manifest]));

/**
 * @typedef {Object} GeneratorBinding
 * @property {string} id
 * @property {string} version
 * @property {string} [package]
 */

/**
 * @typedef {Object} ResolvedGeneratorManifest
 * @property {GeneratorManifest|null} manifest
 * @property {string[]} errors
 * @property {"bundled"|"package"|null} source
 * @property {string|null} manifestPath
 * @property {string|null} packageRoot
 */

/**
 * @param {any} value
 * @param {boolean} [nonEmpty]
 * @returns {boolean}
 */
function isStringArray(value, nonEmpty = false) {
  return Array.isArray(value) &&
    (!nonEmpty || value.length > 0) &&
    value.every((entry) => typeof entry === "string" && entry.length > 0);
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
 * @param {string} generatorId
 * @returns {GeneratorManifest|null}
 */
export function getGeneratorManifest(generatorId) {
  return GENERATOR_BY_ID.get(generatorId) || null;
}

/**
 * @param {string|null|undefined} rootDir
 * @returns {string}
 */
function packageResolutionBase(rootDir) {
  return path.join(rootDir || process.cwd(), "package.json");
}

/**
 * @param {string|null|undefined} packageName
 * @returns {string|null}
 */
export function packageGeneratorInstallCommand(packageName) {
  return packageName ? `npm install -D ${packageName}` : null;
}

/**
 * @param {string|null|undefined} packageName
 * @returns {string|null}
 */
export function packageGeneratorInstallHint(packageName) {
  const command = packageGeneratorInstallCommand(packageName);
  return command ? `Install it from the project root with: ${command}` : null;
}

/**
 * @param {string} packageName
 * @param {string|null|undefined} rootDir
 * @returns {{ manifestPath: string|null, packageRoot: string|null, error: string|null }}
 */
export function resolvePackageGeneratorManifestPath(packageName, rootDir = process.cwd()) {
  const requireFromRoot = createRequire(packageResolutionBase(rootDir));
  try {
    const manifestPath = requireFromRoot.resolve(`${packageName}/topogram-generator.json`);
    return {
      manifestPath,
      packageRoot: path.dirname(manifestPath),
      error: null
    };
  } catch (manifestError) {
    try {
      const packageJsonPath = requireFromRoot.resolve(`${packageName}/package.json`);
      const packageRoot = path.dirname(packageJsonPath);
      const manifestPath = path.join(packageRoot, "topogram-generator.json");
      if (!fs.existsSync(manifestPath)) {
        return {
          manifestPath: null,
          packageRoot,
          error: `Generator package '${packageName}' is missing topogram-generator.json`
        };
      }
      return {
        manifestPath,
        packageRoot,
        error: null
      };
    } catch {
      const detail = manifestError instanceof Error ? manifestError.message : String(manifestError);
      const installHint = packageGeneratorInstallHint(packageName);
      return {
        manifestPath: null,
        packageRoot: null,
        error: `Generator package '${packageName}' could not be resolved from '${rootDir || process.cwd()}': ${detail}${installHint ? `. ${installHint}` : ""}`
      };
    }
  }
}

/**
 * @param {string} packageName
 * @param {string|null|undefined} rootDir
 * @returns {{ manifest: GeneratorManifest|null, errors: string[], manifestPath: string|null, packageRoot: string|null }}
 */
export function loadPackageGeneratorManifest(packageName, rootDir = process.cwd()) {
  const resolved = resolvePackageGeneratorManifestPath(packageName, rootDir);
  if (!resolved.manifestPath) {
    return {
      manifest: null,
      errors: [resolved.error || `Generator package '${packageName}' could not be resolved`],
      manifestPath: null,
      packageRoot: resolved.packageRoot
    };
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(resolved.manifestPath, "utf8"));
    const validation = validateGeneratorManifest(manifest);
    return {
      manifest: validation.ok ? manifest : null,
      errors: validation.errors,
      manifestPath: resolved.manifestPath,
      packageRoot: resolved.packageRoot
    };
  } catch (error) {
    return {
      manifest: null,
      errors: [`Generator package '${packageName}' manifest could not be read: ${error instanceof Error ? error.message : String(error)}`],
      manifestPath: resolved.manifestPath,
      packageRoot: resolved.packageRoot
    };
  }
}

/**
 * @param {GeneratorBinding|string|null|undefined} bindingOrId
 * @param {{ rootDir?: string|null, configDir?: string|null }} [options]
 * @returns {ResolvedGeneratorManifest}
 */
export function resolveGeneratorManifestForBinding(bindingOrId, options = {}) {
  const binding = typeof bindingOrId === "string"
    ? { id: bindingOrId, version: "" }
    : bindingOrId;
  const generatorId = binding?.id || "";
  const bundled = getGeneratorManifest(generatorId);
  if (bundled) {
    return {
      manifest: bundled,
      errors: [],
      source: "bundled",
      manifestPath: null,
      packageRoot: null
    };
  }
  if (!binding?.package) {
    return {
      manifest: null,
      errors: [`Generator '${generatorId || "unknown"}' is not bundled and does not declare a package`],
      source: null,
      manifestPath: null,
      packageRoot: null
    };
  }
  const rootDir = options.configDir || options.rootDir || process.cwd();
  const loaded = loadPackageGeneratorManifest(binding.package, rootDir);
  if (!loaded.manifest) {
    return {
      manifest: null,
      errors: loaded.errors,
      source: "package",
      manifestPath: loaded.manifestPath,
      packageRoot: loaded.packageRoot
    };
  }
  /** @type {string[]} */
  const errors = [];
  if (loaded.manifest.source !== "package") {
    errors.push(`Generator package '${binding.package}' manifest source must be package`);
  }
  if (loaded.manifest.package !== binding.package) {
    errors.push(`Generator package '${binding.package}' manifest package must match '${binding.package}'`);
  }
  if (loaded.manifest.id !== binding.id) {
    errors.push(`Generator package '${binding.package}' manifest id '${loaded.manifest.id}' does not match binding '${binding.id}'`);
  }
  if (binding.version && loaded.manifest.version !== binding.version) {
    errors.push(`Generator package '${binding.package}' manifest version '${loaded.manifest.version}' does not match binding '${binding.version}'`);
  }
  return {
    manifest: errors.length === 0 ? loaded.manifest : null,
    errors,
    source: "package",
    manifestPath: loaded.manifestPath,
    packageRoot: loaded.packageRoot
  };
}

/**
 * @param {string|undefined|null} generatorId
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
export function generatorProfile(generatorId, fallback = null) {
  return generatorId ? getGeneratorManifest(generatorId)?.profile || fallback : fallback;
}

/**
 * @param {any} manifest
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateGeneratorManifest(manifest) {
  /** @type {string[]} */
  const errors = [];
  const label = manifest?.id ? `Generator '${manifest.id}'` : "Generator manifest";
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok: false, errors: ["Generator manifest must be an object"] };
  }
  if (typeof manifest.id !== "string" || manifest.id.length === 0) {
    errors.push(`${label} id must be a non-empty string`);
  }
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    errors.push(`${label} version must be a non-empty string`);
  }
  if (!["api", "web", "database", "native"].includes(manifest.surface)) {
    errors.push(`${label} surface must be api, web, database, or native`);
  }
  if (manifest.targetKind != null) {
    errors.push(`${label} ${renameDiagnostic("'targetKind'", "'runtimeKinds'", `"runtimeKinds": ["web_surface"]`)}`);
  }
  if (!isStringArray(manifest.runtimeKinds, true)) {
    errors.push(`${label} runtimeKinds must be a non-empty string array`);
  }
  if (manifest["projectionPlatforms"] != null) {
    errors.push(`${label} ${renameDiagnostic("'projectionPlatforms'", "'projectionTypes'", `"projectionTypes": ["web_surface"]`)}`);
  }
  if (!isStringArray(manifest.projectionTypes, true)) {
    errors.push(`${label} projectionTypes must be a non-empty string array`);
  }
  if (!isStringArray(manifest.inputs)) {
    errors.push(`${label} inputs must be a string array`);
  }
  if (!isStringArray(manifest.outputs)) {
    errors.push(`${label} outputs must be a string array`);
  }
  if (!manifest.stack || typeof manifest.stack !== "object" || Array.isArray(manifest.stack)) {
    errors.push(`${label} stack must be an object`);
  }
  if (!manifest.capabilities || typeof manifest.capabilities !== "object" || Array.isArray(manifest.capabilities)) {
    errors.push(`${label} capabilities must be an object`);
  }
  if (manifest["componentSupport"] != null) {
    errors.push(`${label} ${renameDiagnostic("'componentSupport'", "'widgetSupport'", `"widgetSupport": { "patterns": ["resource_table"] }`)}`);
  }
  if (manifest.widgetSupport != null) {
    if (typeof manifest.widgetSupport !== "object" || Array.isArray(manifest.widgetSupport)) {
      errors.push(`${label} widgetSupport must be an object when present`);
    } else {
      if (manifest.widgetSupport.patterns != null && !isStringArray(manifest.widgetSupport.patterns)) {
        errors.push(`${label} widgetSupport.patterns must be a string array`);
      }
      if (manifest.widgetSupport.behaviors != null && !isStringArray(manifest.widgetSupport.behaviors)) {
        errors.push(`${label} widgetSupport.behaviors must be a string array`);
      }
      if (
        manifest.widgetSupport.unsupported != null &&
        !["error", "warning", "contract-only"].includes(manifest.widgetSupport.unsupported)
      ) {
        errors.push(`${label} widgetSupport.unsupported must be error, warning, or contract-only`);
      }
    }
  }
  if (!["bundled", "package"].includes(manifest.source)) {
    errors.push(`${label} source must be bundled or package`);
  }
  if (manifest.source === "package" && (typeof manifest.package !== "string" || manifest.package.length === 0)) {
    errors.push(`${label} package source must include package`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateGeneratorRegistry() {
  const errors = [];
  const seen = new Set();
  for (const manifest of GENERATOR_MANIFESTS) {
    const result = validateGeneratorManifest(manifest);
    errors.push(...result.errors);
    const key = `${manifest.id}@${manifest.version}`;
    if (seen.has(key)) {
      errors.push(`Duplicate generator manifest '${key}'`);
    }
    seen.add(key);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {Record<string, any>|null|undefined} projection
 * @returns {boolean}
 */
export function isApiProjection(projection) {
  return Array.isArray(projection?.http) && projection.http.length > 0;
}

/**
 * @param {Record<string, any>|null|undefined} projection
 * @returns {string}
 */
export function projectionCompatibilityKey(projection) {
  if (isApiProjection(projection)) {
    return "api_contract";
  }
  return projection?.type || projection?.platform || "";
}

/**
 * @param {GeneratorManifest|null|undefined} manifest
 * @param {string} runtimeKind
 * @param {Record<string, any>|null|undefined} projection
 * @returns {boolean}
 */
export function isGeneratorCompatible(manifest, runtimeKind, projection) {
  if (!manifest || manifest.planned || !manifest.runtimeKinds.includes(runtimeKind)) {
    return false;
  }
  return manifest.projectionTypes.includes(projectionCompatibilityKey(projection));
}
