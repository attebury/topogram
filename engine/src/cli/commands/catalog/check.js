// @ts-check

import { checkCatalogSource } from "../../../catalog.js";

/**
 * @param {string} source
 * @returns {ReturnType<typeof checkCatalogSource>}
 */
export function buildCatalogCheckPayload(source) {
  if (!source) {
    throw new Error("topogram catalog check requires <path-or-url>.");
  }
  return checkCatalogSource(source);
}

/**
 * @param {ReturnType<typeof checkCatalogSource>} payload
 * @returns {void}
 */
export function printCatalogCheck(payload) {
  console.log(payload.ok ? "Catalog check passed." : "Catalog check failed.");
  console.log(`Source: ${payload.source}`);
  if (payload.catalog) {
    console.log(`Version: ${payload.catalog.version}`);
    console.log(`Entries: ${payload.catalog.entries.length}`);
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
  }
}
