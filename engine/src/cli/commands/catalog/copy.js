// @ts-check

import path from "node:path";

import {
  copyCatalogTopogramEntry,
  findCatalogEntry,
  loadCatalog,
  TOPOGRAM_SOURCE_FILE
} from "../../../catalog.js";
import { shellCommandArg } from "./shared.js";

/**
 * @param {string} id
 * @param {string} targetPath
 * @param {{ source?: string|null, version?: string|null }} options
 * @returns {{ ok: boolean, source: string, id: string, kind: "topogram", packageSpec: string, targetPath: string, provenancePath: string, files: string[], diagnostics: any[], errors: string[] }}
 */
export function buildCatalogCopyPayload(id, targetPath, options) {
  if (!id || id.startsWith("-")) {
    throw new Error("topogram catalog copy requires <id>.");
  }
  if (!targetPath || targetPath.startsWith("-")) {
    throw new Error("topogram catalog copy requires <target>.");
  }
  const loaded = loadCatalog(options.source || null);
  const entry = findCatalogEntry(loaded.catalog, id, "topogram");
  if (!entry) {
    throw new Error(`Catalog topogram entry '${id}' was not found in ${loaded.source}.`);
  }
  const copied = copyCatalogTopogramEntry(entry, targetPath, {
    catalogSource: loaded.source,
    version: options.version || null
  });
  return {
    source: loaded.source,
    ...copied,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildCatalogCopyPayload>} payload
 * @returns {void}
 */
export function printCatalogCopy(payload) {
  console.log(`Copied catalog topogram '${payload.id}' to ${payload.targetPath}.`);
  console.log(`Package: ${payload.packageSpec}`);
  console.log(`Source provenance: ${payload.provenancePath}`);
  console.log(`Files: ${payload.files.length}`);
  console.log(`${TOPOGRAM_SOURCE_FILE} records catalog-copy provenance only. Local edits are allowed.`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${shellCommandArg(path.relative(process.cwd(), payload.targetPath) || ".")}`);
  console.log("  topogram source status --local");
  console.log("  topogram check");
  console.log("  topogram generate");
}
