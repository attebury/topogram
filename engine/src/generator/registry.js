// @ts-check

/**
 * @typedef {Object} GeneratorManifest
 * @property {string} id
 * @property {string} version
 * @property {"api"|"web"|"database"|"native"} targetKind
 * @property {string[]} projectionPlatforms
 * @property {string} profile
 * @property {boolean} [planned]
 */

/** @type {GeneratorManifest[]} */
export const GENERATOR_MANIFESTS = [
  {
    id: "topogram/hono",
    version: "1",
    targetKind: "api",
    projectionPlatforms: ["api"],
    profile: "hono"
  },
  {
    id: "topogram/express",
    version: "1",
    targetKind: "api",
    projectionPlatforms: ["api"],
    profile: "express"
  },
  {
    id: "topogram/sveltekit",
    version: "1",
    targetKind: "web",
    projectionPlatforms: ["ui_web"],
    profile: "sveltekit"
  },
  {
    id: "topogram/react",
    version: "1",
    targetKind: "web",
    projectionPlatforms: ["ui_web"],
    profile: "react"
  },
  {
    id: "topogram/swiftui",
    version: "1",
    targetKind: "native",
    projectionPlatforms: ["ui_ios"],
    profile: "swiftui"
  },
  {
    id: "topogram/postgres",
    version: "1",
    targetKind: "database",
    projectionPlatforms: ["db_postgres"],
    profile: "postgres"
  },
  {
    id: "topogram/sqlite",
    version: "1",
    targetKind: "database",
    projectionPlatforms: ["db_sqlite"],
    profile: "sqlite"
  },
  {
    id: "topogram/android-compose",
    version: "1",
    targetKind: "native",
    projectionPlatforms: ["ui_android"],
    profile: "compose",
    planned: true
  }
];

const GENERATOR_BY_ID = new Map(GENERATOR_MANIFESTS.map((manifest) => [manifest.id, manifest]));

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
  if (!manifest || manifest.planned || manifest.targetKind !== componentType) {
    return false;
  }
  return manifest.projectionPlatforms.includes(projectionCompatibilityKey(projection));
}
