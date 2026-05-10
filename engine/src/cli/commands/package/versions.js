// @ts-check

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareSemver(left, right) {
  const leftParts = left.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
}

/**
 * @param {string|null} value
 * @returns {string|null}
 */
export function normalizeRegistryUrl(value) {
  if (!value) {
    return null;
  }
  return value.trim().replace(/\/+$/, "");
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isPackageVersion(value) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}
