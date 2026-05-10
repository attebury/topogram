// @ts-check

/**
 * @param {any} value
 * @returns {any}
 */
function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    /** @type {Record<string, any>} */
    const sorted = {};
    for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
      sorted[key] = sortJsonValue(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * @param {any} value
 * @returns {string}
 */
export function stableJsonStringify(value) {
  return JSON.stringify(sortJsonValue(value), null, 2);
}
