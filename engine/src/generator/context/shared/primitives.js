/**
 * @param {Iterable<unknown>} values
 * @returns {any}
 */
export function stableSortedStrings(values) {
  return [...new Set(Array.from(values || []).filter(Boolean))].sort();
}

/**
 * @param {unknown} value
 * @returns {any}
 */
export function seamIdHint(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "maintained_surface";
}

/**
 * @param {unknown} value
 * @returns {any}
 */
export function titleCaseWords(value) {
  return String(value || "")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(/** @param {string} part */ (part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * @param {any} items
 * @returns {any}
 */
export function refIds(items) {
  return stableSortedStrings((items || []).map(/** @param {any} item */ (item) => item?.id || item?.target?.id));
}

/**
 * @param {any} items
 * @returns {any}
 */
export function docIds(items) {
  return stableSortedStrings((items || []).map(/** @param {any} item */ (item) => item?.id));
}

/**
 * @param {any} items
 * @param {any} keyFn
 * @returns {any}
 */
export function groupBy(items, keyFn) {
  const grouped = /** @type {Record<string, any[]>} */ ({});
  for (const item of items) {
    const key = keyFn(item);
    if (!Object.hasOwn(grouped, key)) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  }
  return grouped;
}
