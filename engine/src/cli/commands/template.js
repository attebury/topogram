// @ts-check

import {
  catalogEntryPackageSpec,
  catalogSourceOrDefault,
  catalogTemplateListItem,
  findCatalogEntry,
  isCatalogSourceDisabled,
  loadCatalog
} from "../../catalog.js";

/**
 * @returns {void}
 */
export function printTemplateHelp() {
  console.log("Usage: topogram template list [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram template explain [path] [--json]");
  console.log("   or: topogram template status [path] [--latest] [--json]");
  console.log("   or: topogram template detach [path] [--dry-run] [--remove-policy] [--json]");
  console.log("   or: topogram template check <template-spec-or-path> [--json]");
  console.log("   or: topogram template policy init [path] [--json]");
  console.log("   or: topogram template policy check [path] [--json]");
  console.log("   or: topogram template policy explain [path] [--json]");
  console.log("   or: topogram template policy pin <template-id@version> [path] [--json]");
  console.log("   or: topogram template update [path] --status|--recommend|--plan|--check|--apply [--template <spec>|--latest] [--json] [--out <path>]");
  console.log("");
  console.log("Template commands inspect catalog-backed starters, project provenance, trust policy, and update plans.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram template list");
  console.log("  topogram template explain");
  console.log("  topogram template status");
  console.log("  topogram template status --latest");
  console.log("  topogram template policy check");
  console.log("  topogram template check ./local-template");
  console.log("  topogram template update --recommend");
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} value
 * @returns {string}
 */
function shellCommandArg(value) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value);
}

/**
 * @param {string} spec
 * @returns {string}
 */
function packageNameFromPackageSpec(spec) {
  if (spec.startsWith("@")) {
    const segments = spec.split("/");
    if (segments.length < 2) {
      throw new Error(`Invalid scoped package spec '${spec}'.`);
    }
    const scope = segments[0];
    const nameAndVersion = segments.slice(1).join("/");
    const versionIndex = nameAndVersion.indexOf("@");
    return `${scope}/${versionIndex >= 0 ? nameAndVersion.slice(0, versionIndex) : nameAndVersion}`;
  }
  const versionIndex = spec.indexOf("@");
  return versionIndex >= 0 ? spec.slice(0, versionIndex) : spec;
}

/**
 * @param {any} entry
 * @param {string} source
 * @returns {{ primary: string, followUp: string[] }}
 */
function catalogShowCommands(entry, source) {
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
 * @param {string} id
 * @param {string|null} source
 * @returns {{ ok: boolean, source: string, catalog: { version: string }, entry: any|null, packageSpec: string|null, commands: { primary: string|null, followUp: string[] }, diagnostics: any[], errors: string[] }}
 */
function buildCatalogShowPayload(id, source) {
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
 * @param {{ catalogSource?: string|null }} [options]
 * @returns {{ ok: boolean, catalog: { source: string|null, loaded: boolean }, templates: Array<Record<string, any>>, diagnostics: Array<Record<string, any>>, errors: string[] }}
 */
export function buildTemplateListPayload(options = {}) {
  const catalogSource = catalogSourceOrDefault(options.catalogSource || null);
  /** @type {Array<Record<string, any>>} */
  const templates = [];
  /** @type {Array<Record<string, any>>} */
  const diagnostics = [];
  let catalogLoaded = false;
  if (!isCatalogSourceDisabled(catalogSource)) {
    try {
      const loaded = loadCatalog(catalogSource);
      catalogLoaded = true;
      const entries = /** @type {any[]} */ (loaded.catalog.entries || []);
      templates.push(
        ...entries
          .filter((entry) => entry.kind === "template")
          .map((entry) => templateListItemFromCatalogEntry(entry, loaded.source))
      );
    } catch (error) {
      diagnostics.push({
        code: "catalog_unavailable",
        severity: "warning",
        message: messageFromError(error),
        path: catalogSource,
        suggestedFix: "Run `topogram catalog list` after authenticating, or pass a local template path/package spec directly."
      });
    }
  }
  return {
    ok: true,
    catalog: {
      source: isCatalogSourceDisabled(catalogSource) ? null : catalogSource,
      loaded: catalogLoaded
    },
    templates,
    diagnostics,
    errors: []
  };
}

/**
 * @param {any} entry
 * @param {string} source
 * @returns {Record<string, any>}
 */
function templateListItemFromCatalogEntry(entry, source) {
  const item = catalogTemplateListItem(entry);
  const commands = catalogShowCommands(entry, source);
  return {
    ...item,
    surfaces: Array.isArray(item.surfaces) ? item.surfaces : [],
    generators: Array.isArray(item.generators) ? item.generators : [],
    stack: typeof item.stack === "string" ? item.stack : null,
    isDefault: item.id === "hello-web",
    recommendedCommand: commands.primary,
    commands
  };
}

/**
 * @param {ReturnType<typeof buildTemplateListPayload>} payload
 * @returns {void}
 */
export function printTemplateList(payload) {
  console.log("Template starters:");
  console.log("Catalog aliases resolve to versioned package installs. Local paths and full package specs can also be used with `topogram new`.");
  if (payload.catalog.source) {
    console.log(`Catalog: ${payload.catalog.source} (${payload.catalog.loaded ? "loaded" : "unavailable"})`);
  } else {
    console.log("Catalog: disabled");
  }
  for (const template of payload.templates) {
    const defaultLabel = template.isDefault ? " (default)" : "";
    const stack = template.stack || "not declared";
    const surfaces = Array.isArray(template.surfaces) && template.surfaces.length > 0
      ? template.surfaces.join(", ")
      : "not declared";
    const command = template.recommendedCommand || `topogram new ./my-app --template ${shellCommandArg(template.id)}`;
    console.log(`- ${template.id}@${template.version}${defaultLabel}`);
    console.log(`  Source: ${template.source} | Surfaces: ${surfaces} | Stack: ${stack} | Executable implementation: ${template.includesExecutableImplementation ? "yes" : "no"}`);
    console.log(`  New: ${command}`);
  }
  for (const diagnostic of payload.diagnostics) {
    console.warn(`Warning: ${diagnostic.message}`);
  }
}

/**
 * @param {Record<string, any>} template
 * @param {"catalog"} sourceKind
 * @param {string|null} packageSpec
 * @param {{ primary: string|null, followUp: string[] }} commands
 * @returns {{ surfaces: string[], generators: string[], stack: string|null, packageSpec: string|null, packageName: string|null, version: string|null, executableImplementation: boolean, policyImpact: string, recommendedCommand: string|null, followUp: string[], notes: string[] }}
 */
function templateDecisionSummary(template, sourceKind, packageSpec, commands) {
  const trust = template.trust && typeof template.trust === "object" ? template.trust : null;
  const executable = trust
    ? Boolean(trust.includesExecutableImplementation)
    : Boolean(template.includesExecutableImplementation);
  const surfaces = Array.isArray(template.surfaces) ? template.surfaces : [];
  const generators = Array.isArray(template.generators) ? template.generators : [];
  const stack = typeof template.stack === "string" && template.stack ? template.stack : null;
  const notes = [];
  if (sourceKind === "catalog") {
    notes.push("Catalog templates resolve to versioned package installs; the catalog is an index, not the template payload.");
  }
  if (surfaces.length === 0) {
    notes.push("Surface metadata is not declared in this catalog entry.");
  }
  if (generators.length === 0) {
    notes.push("Generator metadata is not declared in this catalog entry.");
  }
  return {
    surfaces,
    generators,
    stack,
    packageSpec,
    packageName: template.package || (packageSpec ? packageNameFromPackageSpec(packageSpec) : null),
    version: template.defaultVersion || template.version || null,
    executableImplementation: executable,
    policyImpact: executable
      ? "Copies implementation/ code into the project; topogram new does not execute it, but topogram generate may load it after local trust is recorded."
      : "No executable implementation trust is required for this template.",
    recommendedCommand: commands.primary,
    followUp: commands.followUp,
    notes
  };
}

/**
 * @param {string} id
 * @param {string|null} source
 * @returns {{ ok: boolean, source: "catalog"|null, catalog: { source: string|null, version: string|null }, template: Record<string, any>|null, packageSpec: string|null, decision: ReturnType<typeof templateDecisionSummary>|null, commands: { primary: string|null, followUp: string[] }, diagnostics: any[], errors: string[] }}
 */
export function buildTemplateShowPayload(id, source) {
  if (!id || id.startsWith("-")) {
    throw new Error("topogram template show requires <id>.");
  }
  const catalogPayload = buildCatalogShowPayload(id, source);
  if (!catalogPayload.ok || !catalogPayload.entry) {
    return {
      ok: false,
      source: "catalog",
      catalog: {
        source: catalogPayload.source,
        version: catalogPayload.catalog.version
      },
      template: null,
      packageSpec: null,
      decision: null,
      commands: { primary: null, followUp: [] },
      diagnostics: catalogPayload.diagnostics,
      errors: catalogPayload.errors
    };
  }
  if (catalogPayload.entry.kind !== "template") {
    const diagnostic = {
      code: "catalog_entry_not_template",
      severity: "error",
      message: `Catalog entry '${id}' is a ${catalogPayload.entry.kind}, not a template.`,
      path: catalogPayload.source,
      suggestedFix: "Use `topogram catalog show` for non-template catalog entries."
    };
    return {
      ok: false,
      source: "catalog",
      catalog: {
        source: catalogPayload.source,
        version: catalogPayload.catalog.version
      },
      template: catalogPayload.entry,
      packageSpec: catalogPayload.packageSpec,
      decision: null,
      commands: catalogPayload.commands,
      diagnostics: [...catalogPayload.diagnostics, diagnostic],
      errors: [diagnostic.message]
    };
  }
  return {
    ok: true,
    source: "catalog",
    catalog: {
      source: catalogPayload.source,
      version: catalogPayload.catalog.version
    },
    template: catalogPayload.entry,
    packageSpec: catalogPayload.packageSpec,
    decision: templateDecisionSummary(catalogPayload.entry, "catalog", catalogPayload.packageSpec, catalogPayload.commands),
    commands: catalogPayload.commands,
    diagnostics: catalogPayload.diagnostics,
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildTemplateShowPayload>} payload
 * @returns {void}
 */
export function printTemplateShow(payload) {
  if (!payload.ok || !payload.template) {
    console.log("Template not found.");
    if (payload.catalog.source) {
      console.log(`Catalog: ${payload.catalog.source}`);
    }
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`${label}: ${diagnostic.message}`);
    }
    return;
  }
  const template = payload.template;
  console.log(`Template: ${template.id}`);
  console.log(`Source: ${payload.source}`);
  if (template.name) {
    const defaultLabel = template.isDefault ? " (default)" : "";
    console.log(`Name: ${template.name}${defaultLabel}`);
  }
  if (payload.catalog.source) {
    console.log(`Catalog: ${payload.catalog.source}`);
  }
  if (payload.packageSpec) {
    console.log(`Package: ${payload.packageSpec}`);
  }
  if (template.description) {
    console.log(`Description: ${template.description}`);
  }
  if (payload.decision) {
    console.log("");
    console.log("What it creates:");
    console.log(`  Surfaces: ${payload.decision.surfaces.join(", ") || "not declared"}`);
    console.log(`  Stack: ${payload.decision.stack || "not declared"}`);
    console.log(`  Generators: ${payload.decision.generators.join(", ") || "not declared"}`);
    console.log(`  Package: ${payload.decision.packageSpec || "not declared"}`);
    console.log(`  Executable implementation: ${payload.decision.executableImplementation ? "yes" : "no"}`);
    console.log(`  Policy impact: ${payload.decision.policyImpact}`);
    for (const note of payload.decision.notes) {
      console.log(`  Note: ${note}`);
    }
  }
  console.log("");
  console.log("Details:");
  if (Array.isArray(template.tags) && template.tags.length > 0) {
    console.log(`Tags: ${template.tags.join(", ")}`);
  }
  if (template.trust?.scope) {
    console.log(`Trust scope: ${template.trust.scope}`);
  }
  const executable = template.trust
    ? template.trust.includesExecutableImplementation
    : template.includesExecutableImplementation;
  console.log(`Executable implementation: ${executable ? "yes" : "no"}`);
  if (template.trust?.notes) {
    console.log(`Trust notes: ${template.trust.notes}`);
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
  for (const diagnostic of payload.diagnostics) {
    if (diagnostic.severity === "warning") {
      console.warn(`Warning: ${diagnostic.message}`);
    }
  }
}
