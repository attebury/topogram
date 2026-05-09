// @ts-check

import path from "node:path";

/**
 * @param {string} value
 * @returns {string}
 */
export function toPosixPath(value) {
  return String(value || "").replaceAll("\\", "/").replaceAll(path.sep, "/");
}

/**
 * @param {string} base
 * @param {string} filePath
 * @returns {string}
 */
export function relativeTo(base, filePath) {
  return toPosixPath(path.relative(base, filePath));
}
