// @ts-check

/**
 * @param {any} catalog
 * @param {string} id
 * @param {"template"|"topogram"|null} [kind]
 * @returns {any|null}
 */
export function findCatalogEntry(catalog, id, kind = null) {
  return catalog.entries.find((/** @type {any} */ entry) => entry.id === id && (!kind || entry.kind === kind)) || null;
}

/**
 * @param {any} entry
 * @param {string|null|undefined} version
 * @returns {string}
 */
export function catalogEntryPackageSpec(entry, version = null) {
  return `${entry.package}@${version || entry.defaultVersion}`;
}

/**
 * @param {any} entry
 * @returns {any}
 */
export function catalogTemplateListItem(entry) {
  return {
    id: entry.id,
    version: entry.defaultVersion,
    source: "catalog",
    name: entry.id,
    package: entry.package,
    defaultVersion: entry.defaultVersion,
    description: entry.description,
    tags: entry.tags,
    ...(entry.surfaces ? { surfaces: entry.surfaces } : {}),
    ...(entry.generators ? { generators: entry.generators } : {}),
    ...(entry.stack ? { stack: entry.stack } : {}),
    includesExecutableImplementation: entry.trust.includesExecutableImplementation,
    trust: entry.trust
  };
}
