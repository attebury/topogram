// @ts-check

/**
 * @typedef {Object} GeneratorManifest
 * @property {string} id
 * @property {string} version
 * @property {"api"|"web"|"database"|"native"} surface
 * @property {"api"|"web"|"database"|"native"} [targetKind]
 * @property {string[]} projectionPlatforms
 * @property {string[]} inputs
 * @property {string[]} outputs
 * @property {Record<string, string>} stack
 * @property {Record<string, boolean>} capabilities
 * @property {"bundled"|"package"} source
 * @property {string} [profile]
 * @property {string} [package]
 * @property {string} [export]
 * @property {boolean} [planned]
 */

/** @type {GeneratorManifest[]} */
export const GENERATOR_MANIFESTS = [
  {
    id: "topogram/hono",
    version: "1",
    surface: "api",
    targetKind: "api",
    projectionPlatforms: ["api"],
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
    targetKind: "api",
    projectionPlatforms: ["api"],
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
    targetKind: "web",
    projectionPlatforms: ["ui_web"],
    inputs: ["ui-web-contract"],
    outputs: ["web-app", "generation-coverage"],
    stack: { runtime: "browser", framework: "vanilla", language: "javascript" },
    capabilities: { routes: true, components: false, coverage: false },
    source: "bundled",
    profile: "vanilla"
  },
  {
    id: "topogram/sveltekit",
    version: "1",
    surface: "web",
    targetKind: "web",
    projectionPlatforms: ["ui_web"],
    inputs: ["ui-web-contract", "api-contracts"],
    outputs: ["web-app", "generation-coverage"],
    stack: { runtime: "node", framework: "sveltekit", language: "typescript" },
    capabilities: { routes: true, components: true, coverage: true },
    source: "bundled",
    profile: "sveltekit"
  },
  {
    id: "topogram/react",
    version: "1",
    surface: "web",
    targetKind: "web",
    projectionPlatforms: ["ui_web"],
    inputs: ["ui-web-contract", "api-contracts"],
    outputs: ["web-app", "generation-coverage"],
    stack: { runtime: "browser", framework: "react", language: "typescript" },
    capabilities: { routes: true, components: true, coverage: true },
    source: "bundled",
    profile: "react"
  },
  {
    id: "topogram/swiftui",
    version: "1",
    surface: "native",
    targetKind: "native",
    projectionPlatforms: ["ui_ios"],
    inputs: ["ui-web-contract", "api-contracts"],
    outputs: ["native-app"],
    stack: { platform: "ios", framework: "swiftui", language: "swift" },
    capabilities: { routes: true, components: false, coverage: false },
    source: "bundled",
    profile: "swiftui"
  },
  {
    id: "topogram/postgres",
    version: "1",
    surface: "database",
    targetKind: "database",
    projectionPlatforms: ["db_postgres"],
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
    targetKind: "database",
    projectionPlatforms: ["db_sqlite"],
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
    targetKind: "native",
    projectionPlatforms: ["ui_android"],
    inputs: ["ui-web-contract", "api-contracts"],
    outputs: ["native-app"],
    stack: { platform: "android", framework: "compose", language: "kotlin" },
    capabilities: { routes: true, components: false, coverage: false },
    source: "bundled",
    profile: "compose",
    planned: true
  }
];

const GENERATOR_BY_ID = new Map(GENERATOR_MANIFESTS.map((manifest) => [manifest.id, manifest]));

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
 * @param {string} generatorId
 * @returns {GeneratorManifest|null}
 */
export function getGeneratorManifest(generatorId) {
  return GENERATOR_BY_ID.get(generatorId) || null;
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
  if (!isStringArray(manifest.projectionPlatforms, true)) {
    errors.push(`${label} projectionPlatforms must be a non-empty string array`);
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
    return "api";
  }
  return projection?.platform || "";
}

/**
 * @param {GeneratorManifest|null|undefined} manifest
 * @param {string} componentType
 * @param {Record<string, any>|null|undefined} projection
 * @returns {boolean}
 */
export function isGeneratorCompatible(manifest, componentType, projection) {
  if (!manifest || manifest.planned || manifest.surface !== componentType) {
    return false;
  }
  return manifest.projectionPlatforms.includes(projectionCompatibilityKey(projection));
}
