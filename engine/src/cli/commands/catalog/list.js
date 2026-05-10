// @ts-check

import {
  catalogSourceOrDefault,
  loadCatalog
} from "../../../catalog.js";
import { shellCommandArg } from "./shared.js";

/**
 * @param {string|null} source
 * @returns {{ ok: boolean, source: string, catalog: any, entries: any[], diagnostics: any[], errors: string[] }}
 */
export function buildCatalogListPayload(source) {
  const loaded = loadCatalog(source || null);
  return {
    ok: true,
    source: loaded.source,
    catalog: {
      version: loaded.catalog.version,
      entries: loaded.catalog.entries.length
    },
    entries: loaded.catalog.entries,
    diagnostics: loaded.diagnostics,
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildCatalogListPayload>} payload
 * @returns {void}
 */
export function printCatalogList(payload) {
  console.log("Catalog entries:");
  console.log("Template entries create starters with `topogram new`; topogram entries copy editable Topogram source.");
  console.log(`Catalog: ${payload.source}`);
  console.log(`Version: ${payload.catalog.version}`);
  const catalogOption = payload.source === catalogSourceOrDefault(null)
    ? ""
    : ` --catalog ${shellCommandArg(payload.source)}`;
  for (const entry of payload.entries) {
    console.log(`- ${entry.id} (${entry.kind})`);
    console.log(`  Package: ${entry.package}@${entry.defaultVersion}`);
    console.log(`  Description: ${entry.description}`);
    console.log(`  Trust scope: ${entry.trust.scope}`);
    console.log(`  Executable implementation: ${entry.trust.includesExecutableImplementation ? "yes" : "no"}`);
    if (entry.kind === "template") {
      console.log(`  New: topogram new ./my-app --template ${shellCommandArg(entry.id)}${catalogOption}`);
    } else {
      console.log(`  Copy: topogram catalog copy ${shellCommandArg(entry.id)} ./${entry.id}-topogram${catalogOption}`);
    }
  }
}
