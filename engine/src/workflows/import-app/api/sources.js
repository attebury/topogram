// @ts-check

import path from "node:path";

import { findImportFiles, selectPreferredImportFiles } from "../shared.js";

/** @param {WorkspacePaths} paths @returns {any} */
export function discoverApiSources(paths) {
  const allOpenApiFiles = findImportFiles(
    paths,
    (/** @type {any} */ filePath) =>
      /(openapi|swagger)\.(json|ya?ml)$/i.test(path.basename(filePath))
  );
  const openApiFiles = selectPreferredImportFiles(paths, allOpenApiFiles, "openapi");
  const routeFiles = findImportFiles(
    paths,
    (/** @type {any} */ filePath) =>
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) &&
      /(server|api|routes|src)/i.test(filePath)
  );
  return { openApiFiles, routeFiles };
}
