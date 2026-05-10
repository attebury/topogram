// @ts-check

import { resolveTopoRoot, resolveWorkspaceContext } from "../workspace-paths.js";

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeTopogramPath(inputPath) {
  return resolveTopoRoot(inputPath);
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeProjectRoot(inputPath) {
  return resolveWorkspaceContext(inputPath).projectRoot;
}
