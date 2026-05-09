// @ts-check

import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeTopogramPath(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return absolute;
  }
  const candidate = path.join(absolute, "topogram");
  return fs.existsSync(candidate) ? candidate : absolute;
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeProjectRoot(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return path.dirname(absolute);
  }
  return absolute;
}
