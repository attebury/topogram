// @ts-check

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  buildTopogramSourceStatus,
  catalogSourceOrDefault,
  catalogTemplateListItem,
  isCatalogSourceDisabled,
  loadCatalog
} from "../../catalog.js";
import { stableStringify } from "../../format.js";
import { assertSafeNpmSpec, localNpmrcEnv } from "../../npm-safety.js";
import {
  getTemplateTrustStatus,
  TEMPLATE_TRUST_FILE
} from "../../template-trust.js";
import {
  buildCatalogShowPayload,
  catalogShowCommands,
  shellCommandArg
} from "./catalog.js";

const TEMPLATE_FILES_MANIFEST = ".topogram-template-files.json";
const TEMPLATE_POLICY_FILE = "topogram.template-policy.json";

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

/**
 * @param {Record<string, any>|null|undefined} projectConfig
 * @returns {{ id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null, sourceRoot: string|null, catalog: Record<string, any>|null, includesExecutableImplementation: boolean|null }}
 */
export function templateMetadataFromProjectConfig(projectConfig) {
  const template = projectConfig?.template || {};
  return {
    id: typeof template.id === "string" ? template.id : null,
    version: typeof template.version === "string" ? template.version : null,
    source: typeof template.source === "string" ? template.source : null,
    sourceSpec: typeof template.sourceSpec === "string" ? template.sourceSpec : null,
    requested: typeof template.requested === "string" ? template.requested : null,
    sourceRoot: typeof template.sourceRoot === "string" ? template.sourceRoot : null,
    catalog: template.catalog && typeof template.catalog === "object" && !Array.isArray(template.catalog)
      ? template.catalog
      : null,
    includesExecutableImplementation: typeof template.includesExecutableImplementation === "boolean"
      ? template.includesExecutableImplementation
      : null
  };
}

/**
 * @param {string} packageName
 * @returns {string}
 */
function latestVersionForPackage(packageName) {
  assertSafeNpmSpec(packageName);
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = childProcess.spawnSync(npmBin, ["view", "--json", "--", packageName, "version"], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...localNpmrcEnv(process.cwd()),
      PATH: process.env.PATH || ""
    }
  });
  if (result.status !== 0) {
    throw new Error(`Failed to inspect latest version for '${packageName}'.\n${result.stderr || result.stdout}`.trim());
  }
  const raw = (result.stdout || "").trim();
  if (!raw) {
    throw new Error(`npm view returned no version for '${packageName}'.`);
  }
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "string" || !parsed) {
    throw new Error(`npm view returned an invalid version for '${packageName}'.`);
  }
  return parsed;
}

/**
 * @param {ReturnType<typeof templateMetadataFromProjectConfig>} template
 * @returns {{ checked: boolean, supported: boolean, packageName: string|null, version: string|null, isCurrent: boolean|null, candidateSpec: string|null, reason: string|null }}
 */
export function latestTemplateInfo(template) {
  if (template.source !== "package") {
    return {
      checked: true,
      supported: false,
      packageName: null,
      version: null,
      isCurrent: null,
      candidateSpec: null,
      reason: "Latest-version lookup is only supported for package-backed templates."
    };
  }
  const packageName = packageNameFromPackageSpec(template.sourceSpec || template.requested || template.id || "");
  const version = latestVersionForPackage(packageName);
  return {
    checked: true,
    supported: true,
    packageName,
    version,
    isCurrent: template.version === version,
    candidateSpec: `${packageName}@${version}`,
    reason: null
  };
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} projectConfigInfo
 * @param {{ latest?: boolean }} [options]
 * @returns {{ ok: boolean, template: ReturnType<typeof templateMetadataFromProjectConfig>, trust: ReturnType<typeof getTemplateTrustStatus>|null, latest: { checked: boolean, supported?: boolean, packageName?: string|null, version?: string|null, isCurrent?: boolean|null, candidateSpec?: string|null, reason: string|null }, recommendations: string[] }}
 */
export function buildTemplateStatusPayload(projectConfigInfo, options = {}) {
  const template = templateMetadataFromProjectConfig(projectConfigInfo.config);
  const recommendations = [];
  /** @type {ReturnType<typeof getTemplateTrustStatus>|null} */
  let trust = null;
  if (projectConfigInfo.config.implementation) {
    trust = getTemplateTrustStatus({
      config: projectConfigInfo.config.implementation,
      configPath: projectConfigInfo.configPath,
      configDir: projectConfigInfo.configDir
    }, projectConfigInfo.config);
    if (!trust.ok) {
      recommendations.push("Run `topogram trust diff` to review implementation changes, then `topogram trust template` to trust the current files.");
    }
  }
  if (!template.id) {
    recommendations.push("No template metadata found in topogram.project.json.");
  }
  const latest = options.latest
    ? latestTemplateInfo(template)
    : {
        checked: false,
        supported: false,
        packageName: null,
        version: null,
        isCurrent: null,
        candidateSpec: null,
        reason: "Registry lookups are not performed by default."
      };
  if (latest.checked && latest.supported && latest.candidateSpec && latest.isCurrent === false) {
    recommendations.push(`Run \`topogram template update --recommend --template ${latest.candidateSpec}\` to review the latest template.`);
  }
  return {
    ok: trust ? trust.ok : true,
    template,
    trust,
    latest,
    recommendations
  };
}

/**
 * @param {ReturnType<typeof buildTemplateStatusPayload>} payload
 * @returns {void}
 */
export function printTemplateStatus(payload) {
  if (!payload.template.id) {
    console.log("Template status: detached");
  } else if (payload.trust?.requiresTrust) {
    console.log(`Template status: attached; implementation trust: ${payload.ok ? "trusted" : "review required"}`);
  } else {
    console.log("Template status: attached; implementation trust: not required");
  }
  if (payload.template.id) {
    console.log(`Template: ${payload.template.id}@${payload.template.version || "unknown"}`);
  }
  if (payload.template.source) {
    console.log(`Source: ${payload.template.source}`);
  }
  if (payload.template.sourceSpec) {
    console.log(`Source spec: ${payload.template.sourceSpec}`);
  }
  if (payload.template.requested) {
    console.log(`Requested: ${payload.template.requested}`);
  }
  if (payload.template.catalog) {
    console.log(`Catalog: ${payload.template.catalog.id || "unknown"} from ${payload.template.catalog.source || "unknown"}`);
  }
  if (payload.template.sourceRoot) {
    console.log(`Source root: ${payload.template.sourceRoot}`);
  }
  if (!payload.latest.checked) {
    console.log("Latest version: not checked");
  } else if (!payload.latest.supported) {
    console.log(`Latest version: not checked (${payload.latest.reason})`);
  } else {
    console.log(`Latest version: ${payload.latest.version}`);
    if (payload.latest.packageName) {
      console.log(`Latest package: ${payload.latest.packageName}`);
    }
    if (payload.latest.candidateSpec) {
      console.log(`Latest candidate: ${payload.latest.candidateSpec}`);
    }
    console.log(`Latest status: ${payload.latest.isCurrent ? "current" : "update available"}`);
  }
  if (payload.trust) {
    if (payload.trust.trustRecord?.trustedAt) {
      console.log(`Trusted at: ${payload.trust.trustRecord.trustedAt}`);
    }
    if (payload.trust.implementation.module) {
      console.log(`Implementation: ${payload.trust.implementation.module}`);
    }
    if (payload.trust.content.trustedDigest) {
      console.log(`Trusted digest: ${payload.trust.content.trustedDigest}`);
    }
    if (payload.trust.content.currentDigest) {
      console.log(`Current digest: ${payload.trust.content.currentDigest}`);
    }
    for (const issue of payload.trust.issues) {
      console.log(`Issue: ${issue}`);
    }
    for (const filePath of payload.trust.content.changed) {
      console.log(`Changed: ${filePath}`);
    }
    for (const filePath of payload.trust.content.added) {
      console.log(`Added: ${filePath}`);
    }
    for (const filePath of payload.trust.content.removed) {
      console.log(`Removed: ${filePath}`);
    }
  }
  for (const recommendation of payload.recommendations) {
    console.log(recommendation);
  }
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} projectConfigInfo
 * @returns {{ ok: boolean, projectRoot: string, projectConfigPath: string|null, attached: boolean, ownership: "template-attached"|"project-owned", template: ReturnType<typeof templateMetadataFromProjectConfig>, trust: ReturnType<typeof getTemplateTrustStatus>|null, baseline: ReturnType<typeof buildTemplateOwnedBaselineStatus>, source: ReturnType<typeof buildTopogramSourceStatus>, commands: { status: string, detachDryRun: string|null, detach: string|null, updateCheck: string|null, trustStatus: string|null, trustTemplate: string|null, check: string, generate: string }, summary: string[], diagnostics: any[], errors: string[] }}
 */
export function buildTemplateExplainPayload(projectConfigInfo) {
  const template = templateMetadataFromProjectConfig(projectConfigInfo.config);
  const attached = Boolean(template.id);
  const projectRoot = projectConfigInfo.configDir;
  const baseline = buildTemplateOwnedBaselineStatus(projectRoot);
  const source = buildTopogramSourceStatus(projectRoot);
  /** @type {ReturnType<typeof getTemplateTrustStatus>|null} */
  let trust = null;
  if (projectConfigInfo.config.implementation) {
    trust = getTemplateTrustStatus({
      config: projectConfigInfo.config.implementation,
      configPath: projectConfigInfo.configPath,
      configDir: projectConfigInfo.configDir
    }, projectConfigInfo.config);
  }
  const summary = [];
  if (attached) {
    summary.push("This project is still attached to its starter template.");
    summary.push("Local edits are allowed; template update checks are opt-in.");
  } else {
    summary.push("This project is detached from starter-template update tracking.");
    summary.push("The project owns its Topogram files and template updates no longer apply.");
  }
  if (baseline.state === "diverged") {
    summary.push("Template-derived files have local changes; those changes are project-owned.");
  } else if (baseline.state === "matches-template") {
    summary.push("Template-derived files still match the recorded template baseline.");
  }
  if (trust?.requiresTrust && trust.ok) {
    summary.push("Executable implementation trust is retained and currently matches reviewed files.");
  } else if (trust?.requiresTrust && !trust.ok) {
    summary.push("Executable implementation changed since it was trusted and needs review.");
  } else {
    summary.push("No executable implementation trust review is required.");
  }
  return {
    ok: trust ? trust.ok : true,
    projectRoot,
    projectConfigPath: projectConfigInfo.configPath,
    attached,
    ownership: attached ? "template-attached" : "project-owned",
    template,
    trust,
    baseline,
    source,
    commands: {
      status: "topogram source status --local",
      detachDryRun: attached ? "topogram template detach --dry-run" : null,
      detach: attached ? "topogram template detach" : null,
      updateCheck: attached ? "topogram template update --check" : null,
      trustStatus: trust?.requiresTrust ? "topogram trust status" : null,
      trustTemplate: trust?.requiresTrust && !trust.ok ? "topogram trust template" : null,
      check: "topogram check",
      generate: "topogram generate"
    },
    summary,
    diagnostics: source.diagnostics,
    errors: trust && !trust.ok ? trust.issues : []
  };
}

/**
 * @param {ReturnType<typeof buildTemplateExplainPayload>} payload
 * @returns {void}
 */
export function printTemplateExplain(payload) {
  console.log(`Template lifecycle: ${payload.attached ? "attached" : "detached"}`);
  console.log(`Ownership: ${payload.ownership}`);
  console.log(`Project: ${payload.projectRoot}`);
  if (payload.projectConfigPath) {
    console.log(`Project config: ${payload.projectConfigPath}`);
  }
  if (payload.template.id) {
    console.log(`Template: ${payload.template.id}@${payload.template.version || "unknown"}`);
    console.log(`Requested: ${payload.template.requested || "unknown"}`);
    console.log(`Source: ${payload.template.sourceSpec || payload.template.source || "unknown"}`);
    if (payload.template.catalog) {
      console.log(`Catalog: ${payload.template.catalog.id || "unknown"} from ${payload.template.catalog.source || "unknown"}`);
    }
  } else {
    console.log("Template: none");
  }
  console.log(`Template baseline: ${payload.baseline.state}`);
  console.log(`Template baseline meaning: ${payload.baseline.meaning}`);
  if (payload.baseline.content.changed.length > 0) {
    console.log(`Template baseline changed files: ${payload.baseline.content.changed.length}`);
  }
  if (payload.baseline.content.removed.length > 0) {
    console.log(`Template baseline removed files: ${payload.baseline.content.removed.length}`);
  }
  if (payload.trust) {
    console.log(`Implementation trust: ${payload.trust.requiresTrust ? (payload.trust.ok ? "trusted" : "review required") : "not required"}`);
    if (payload.trust.implementation.module) {
      console.log(`Implementation: ${payload.trust.implementation.module}`);
    }
  } else {
    console.log("Implementation trust: not required");
  }
  console.log("");
  console.log("Summary:");
  for (const line of payload.summary) {
    console.log(`- ${line}`);
  }
  console.log("");
  console.log("Useful commands:");
  console.log(`  ${payload.commands.status}`);
  if (payload.commands.detachDryRun) {
    console.log(`  ${payload.commands.detachDryRun}`);
  }
  if (payload.commands.detach) {
    console.log(`  ${payload.commands.detach}`);
  }
  if (payload.commands.updateCheck) {
    console.log(`  ${payload.commands.updateCheck}`);
  }
  if (payload.commands.trustStatus) {
    console.log(`  ${payload.commands.trustStatus}`);
  }
  if (payload.commands.trustTemplate) {
    console.log(`  ${payload.commands.trustTemplate}`);
  }
  console.log(`  ${payload.commands.check}`);
  console.log(`  ${payload.commands.generate}`);
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
  }
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} projectConfigInfo
 * @param {{ dryRun?: boolean, removePolicy?: boolean }} [options]
 * @returns {{ ok: boolean, detached: boolean, dryRun: boolean, projectConfigPath: string, removedTemplate: Record<string, any>|null, implementationTrust: { retained: boolean, removed: boolean, path: string, reason: string }, removedFiles: string[], plannedRemovals: string[], preservedFiles: string[], diagnostics: any[], errors: any[] }}
 */
export function buildTemplateDetachPayload(projectConfigInfo, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const removePolicy = Boolean(options.removePolicy);
  const projectRoot = projectConfigInfo.configDir;
  const projectConfigPath = projectConfigInfo.configPath || path.join(projectRoot, "topogram.project.json");
  const nextConfig = JSON.parse(JSON.stringify(projectConfigInfo.config || {}));
  const removedTemplate = nextConfig.template && typeof nextConfig.template === "object" && !Array.isArray(nextConfig.template)
    ? nextConfig.template
    : null;
  const removedFiles = [];
  const plannedRemovals = [];
  const preservedFiles = [];
  const diagnostics = [];

  if (removedTemplate) {
    delete nextConfig.template;
  }

  const manifestPath = path.join(projectRoot, TEMPLATE_FILES_MANIFEST);
  const policyPath = path.join(projectRoot, TEMPLATE_POLICY_FILE);
  const trustPath = path.join(projectRoot, TEMPLATE_TRUST_FILE);
  const implementationRemains = Boolean(projectConfigInfo.config?.implementation);

  /** @param {string} filePath */
  const maybeRemove = (filePath) => {
    if (!fs.existsSync(filePath)) {
      return;
    }
    plannedRemovals.push(filePath);
    if (!dryRun) {
      fs.rmSync(filePath);
      removedFiles.push(filePath);
    }
  };

  maybeRemove(manifestPath);
  if (removePolicy) {
    maybeRemove(policyPath);
  } else if (fs.existsSync(policyPath)) {
    preservedFiles.push(policyPath);
  }

  const implementationTrust = {
    retained: false,
    removed: false,
    path: trustPath,
    reason: "not-present"
  };
  if (fs.existsSync(trustPath)) {
    if (implementationRemains) {
      implementationTrust.retained = true;
      implementationTrust.reason = "implementation-remains";
      preservedFiles.push(trustPath);
    } else {
      implementationTrust.removed = !dryRun;
      implementationTrust.reason = "no-implementation-config";
      plannedRemovals.push(trustPath);
      if (!dryRun) {
        fs.rmSync(trustPath);
        removedFiles.push(trustPath);
      }
    }
  }

  if (!removedTemplate) {
    diagnostics.push({
      code: "template_already_detached",
      severity: "warning",
      message: "topogram.project.json has no template metadata.",
      path: projectConfigPath,
      suggestedFix: "No detach action is required."
    });
  }

  if (!dryRun && removedTemplate) {
    fs.writeFileSync(projectConfigPath, `${stableStringify(nextConfig)}\n`, "utf8");
  }

  return {
    ok: true,
    detached: Boolean(removedTemplate),
    dryRun,
    projectConfigPath,
    removedTemplate,
    implementationTrust,
    removedFiles,
    plannedRemovals,
    preservedFiles,
    diagnostics,
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildTemplateDetachPayload>} payload
 * @returns {void}
 */
export function printTemplateDetachPayload(payload) {
  if (payload.dryRun) {
    console.log(payload.detached ? "Template detach plan ready." : "Template detach plan: already detached.");
  } else {
    console.log(payload.detached ? "Template detached." : "Template already detached.");
  }
  console.log(`Project config: ${payload.projectConfigPath}`);
  if (payload.removedTemplate?.id) {
    console.log(`Removed template metadata: ${payload.removedTemplate.id}@${payload.removedTemplate.version || "unknown"}`);
  }
  if (payload.plannedRemovals.length > 0) {
    console.log(payload.dryRun ? "Would remove:" : "Removed:");
    for (const filePath of (payload.dryRun ? payload.plannedRemovals : payload.removedFiles)) {
      console.log(`- ${filePath}`);
    }
  }
  if (payload.preservedFiles.length > 0) {
    console.log("Preserved:");
    for (const filePath of payload.preservedFiles) {
      console.log(`- ${filePath}`);
    }
  }
  if (payload.implementationTrust.retained) {
    console.log("Implementation trust retained because implementation config remains.");
  } else if (payload.implementationTrust.removed) {
    console.log("Implementation trust removed because no implementation config remains.");
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
  }
  console.log("Next: run `topogram source status --local`, then `topogram check`.");
}

/**
 * @param {string} filePath
 * @returns {{ sha256: string, size: number }}
 */
function projectFileHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length
  };
}

/**
 * @param {string} projectRoot
 * @param {string} relativePath
 * @returns {{ sha256: string, size: number }}
 */
function templateBaselineFileHash(projectRoot, relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  if (relativePath === "topogram.project.json") {
    const content = `${stableStringify(JSON.parse(fs.readFileSync(filePath, "utf8")))}\n`;
    return {
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
      size: Buffer.byteLength(content)
    };
  }
  return projectFileHash(filePath);
}

/**
 * @param {string} projectRoot
 * @returns {{ exists: boolean, path: string, status: "missing"|"clean"|"changed", state: "missing"|"matches-template"|"diverged", meaning: "no-template-baseline"|"matches-template-baseline"|"local-project-owns-changes", changedAllowed: boolean, localOwnership: boolean, blocksCheck: boolean, blocksGenerate: boolean, nextCommand: string|null, content: { changed: string[], added: string[], removed: string[] }, trustedFiles: number }}
 */
export function buildTemplateOwnedBaselineStatus(projectRoot) {
  const manifestPath = path.join(projectRoot, TEMPLATE_FILES_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    return {
      exists: false,
      path: manifestPath,
      status: "missing",
      state: "missing",
      meaning: "no-template-baseline",
      changedAllowed: true,
      localOwnership: false,
      blocksCheck: false,
      blocksGenerate: false,
      nextCommand: null,
      content: { changed: [], added: [], removed: [] },
      trustedFiles: 0
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const trustedFiles = Array.isArray(manifest.files) ? manifest.files : [];
  const changed = [];
  const removed = [];
  for (const file of trustedFiles) {
    const relativePath = String(file.path || "");
    if (!relativePath) {
      continue;
    }
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      removed.push(relativePath);
      continue;
    }
    const current = templateBaselineFileHash(projectRoot, relativePath);
    if (current.sha256 !== file.sha256 || current.size !== file.size) {
      changed.push(relativePath);
    }
  }
  const status = changed.length || removed.length ? "changed" : "clean";
  const diverged = status === "changed";
  return {
    exists: true,
    path: manifestPath,
    status,
    state: diverged ? "diverged" : "matches-template",
    meaning: diverged ? "local-project-owns-changes" : "matches-template-baseline",
    changedAllowed: true,
    localOwnership: diverged,
    blocksCheck: false,
    blocksGenerate: false,
    nextCommand: diverged ? "topogram template update --check" : null,
    content: {
      changed: changed.sort((a, b) => a.localeCompare(b)),
      added: [],
      removed: removed.sort((a, b) => a.localeCompare(b))
    },
    trustedFiles: trustedFiles.length
  };
}
