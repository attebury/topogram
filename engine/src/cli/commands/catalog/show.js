// @ts-check

import {
  catalogEntryPackageSpec,
  catalogSourceOrDefault,
  findCatalogEntry,
  loadCatalog,
  TOPOGRAM_SOURCE_FILE
} from "../../../catalog.js";
import { shellCommandArg } from "./shared.js";

/**
 * @param {string} id
 * @param {string|null} source
 * @returns {{ ok: boolean, source: string, catalog: { version: string }, entry: any|null, packageSpec: string|null, commands: { primary: string|null, followUp: string[] }, diagnostics: any[], errors: string[] }}
 */
export function buildCatalogShowPayload(id, source) {
  if (!id || id.startsWith("-")) {
    throw new Error("topogram catalog show requires <id>.");
  }
  const loaded = loadCatalog(source || null);
  const entry = findCatalogEntry(loaded.catalog, id, null);
  if (!entry) {
    const diagnostic = {
      code: "catalog_entry_not_found",
      severity: "error",
      message: `Catalog entry '${id}' was not found in ${loaded.source}.`,
      path: loaded.source,
      suggestedFix: "Run `topogram catalog list` to see available entries."
    };
    return {
      ok: false,
      source: loaded.source,
      catalog: { version: loaded.catalog.version },
      entry: null,
      packageSpec: null,
      commands: { primary: null, followUp: [] },
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  return {
    ok: true,
    source: loaded.source,
    catalog: { version: loaded.catalog.version },
    entry,
    packageSpec: catalogEntryPackageSpec(entry),
    commands: catalogShowCommands(entry, loaded.source),
    diagnostics: loaded.diagnostics,
    errors: []
  };
}

/**
 * @param {any} entry
 * @param {string} source
 * @returns {{ primary: string, followUp: string[] }}
 */
export function catalogShowCommands(entry, source) {
  const catalogOption = source === catalogSourceOrDefault(null)
    ? ""
    : ` --catalog ${shellCommandArg(source)}`;
  if (entry.kind === "template") {
    const target = "./my-app";
    return {
      primary: `topogram new ${target} --template ${shellCommandArg(entry.id)}${catalogOption}`,
      followUp: [
        `cd ${target}`,
        "npm install",
        "npm run check",
        "npm run generate"
      ]
    };
  }
  const target = `./${entry.id}-topogram`;
  return {
    primary: `topogram catalog copy ${shellCommandArg(entry.id)} ${target}${catalogOption}`,
    followUp: [
      `cd ${target}`,
      "topogram source status --local",
      "topogram check",
      "topogram generate"
    ]
  };
}

/**
 * @param {ReturnType<typeof buildCatalogShowPayload>} payload
 * @returns {void}
 */
export function printCatalogShow(payload) {
  if (!payload.ok || !payload.entry) {
    console.log("Catalog entry not found.");
    console.log(`Catalog: ${payload.source}`);
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`${label}: ${diagnostic.message}`);
    }
    return;
  }
  const { entry } = payload;
  console.log(`Catalog entry: ${entry.id}`);
  console.log(`Kind: ${entry.kind}`);
  if (entry.kind === "template") {
    console.log("Action: creates a starter app workspace with `topogram new`.");
  } else {
    console.log("Action: copies editable Topogram source with `topogram catalog copy`.");
    console.log("Executable implementation: no (topogram entries cannot include implementation/ in v1).");
  }
  console.log(`Catalog: ${payload.source}`);
  console.log(`Package: ${payload.packageSpec}`);
  console.log(`Description: ${entry.description}`);
  console.log(`Tags: ${entry.tags.join(", ") || "none"}`);
  console.log(`Trust scope: ${entry.trust.scope}`);
  if (entry.kind === "template") {
    console.log(`Executable implementation: ${entry.trust.includesExecutableImplementation ? "yes" : "no"}`);
  }
  if (entry.trust.notes) {
    console.log(`Trust notes: ${entry.trust.notes}`);
  }
  console.log("");
  console.log("Recommended command:");
  console.log(`  ${payload.commands.primary}`);
  if (payload.commands.followUp.length > 0) {
    console.log("Follow-up:");
    for (const command of payload.commands.followUp) {
      console.log(`  ${command}`);
    }
  }
  if (entry.kind === "topogram") {
    console.log("");
    console.log(`${TOPOGRAM_SOURCE_FILE} will record copy provenance only. Local edits are allowed.`);
  }
}
