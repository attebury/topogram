// @ts-check

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildTopogramSourceStatus,
  catalogSourceOrDefault,
  catalogTemplateListItem,
  isCatalogSourceDisabled,
  loadCatalog
} from "../../catalog.js";
import { stableStringify } from "../../format.js";
import { parsePath } from "../../parser.js";
import { assertSafeNpmSpec, localNpmrcEnv } from "../../npm-safety.js";
import {
  createNewProject,
  applyTemplateUpdate,
  applyTemplateUpdateFileAction,
  buildTemplateUpdateCheck,
  buildTemplateUpdatePlan,
  buildTemplateUpdateStatus,
  loadTemplatePolicy,
  packageScopeFromSpec,
  resolveTemplate,
  templatePolicyDiagnosticsForTemplate,
  writeTemplatePolicy,
  writeTemplatePolicyForProject
} from "../../new-project.js";
import {
  formatProjectConfigErrors,
  loadProjectConfig,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "../../project-config.js";
import { resolveWorkspace } from "../../resolver.js";
import {
  getTemplateTrustStatus,
  implementationRequiresTrust,
  TEMPLATE_TRUST_FILE,
  templateTrustRecoveryGuidance,
  validateProjectImplementationTrust
} from "../../template-trust.js";
import {
  buildCatalogShowPayload,
  catalogShowCommands,
  shellCommandArg
} from "./catalog.js";
import { runNpmForPackageUpdate } from "./package.js";

const TEMPLATE_FILES_MANIFEST = ".topogram-template-files.json";
const TEMPLATE_POLICY_FILE = "topogram.template-policy.json";
const ENGINE_ROOT = decodeURIComponent(new URL("../../../", import.meta.url).pathname);
const TEMPLATES_ROOT = path.join(ENGINE_ROOT, "templates");

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
 * @param  {...{ ok: boolean, errors?: any[] }|null|undefined} results
 * @returns {{ ok: boolean, errors: any[] }}
 */
function combineProjectValidationResults(...results) {
  const errors = [];
  for (const result of results) {
    errors.push(...(result?.errors || []));
  }
  return {
    ok: errors.length === 0,
    errors
  };
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
 * @param {any} plan
 * @returns {void}
 */
export function printTemplateUpdatePlan(plan) {
  const isApply = plan.mode === "apply";
  const isCheck = plan.mode === "check";
  const isStatus = plan.mode === "status";
  const isFileAction = ["accept-current", "accept-candidate", "delete-current"].includes(plan.mode);
  if (isApply) {
    console.log(plan.ok ? "Template update apply: complete" : "Template update apply: refused");
  } else if (isStatus) {
    console.log(plan.ok ? "Template update status: aligned" : "Template update status: action needed");
  } else if (isCheck) {
    console.log(plan.ok ? "Template update check: aligned" : "Template update check: out of date");
  } else if (isFileAction) {
    console.log(plan.ok ? `Template update ${plan.mode}: complete` : `Template update ${plan.mode}: refused`);
  } else {
    console.log(plan.ok ? "Template update plan: ready for review" : "Template update plan: incompatible");
  }
  console.log(`Current: ${plan.current?.id || "unknown"}@${plan.current?.version || "unknown"}`);
  console.log(`Candidate: ${plan.candidate?.id || "unknown"}@${plan.candidate?.version || "unknown"}`);
  console.log(`Writes: ${plan.writes ? "applied" : "none"}`);
  if (plan.reportPath) {
    console.log(`Report: ${plan.reportPath}`);
  }
  console.log(`Added: ${plan.summary.added}`);
  console.log(`Changed: ${plan.summary.changed}`);
  console.log(`Current-only: ${plan.summary.currentOnly}`);
  console.log(`Unchanged: ${plan.summary.unchanged}`);
  if (isApply || isStatus || isFileAction) {
    const appliedCount = (plan.applied || []).length;
    const acceptedCount = (plan.accepted || []).length;
    const deletedCount = (plan.deleted || []).length;
    const skippedCount = (plan.skipped || []).length;
    const conflictCount = (plan.conflicts || []).length;
    if (isApply && appliedCount === 0 && skippedCount === 0 && conflictCount === 0 && plan.files.length === 0) {
      console.log("No changes to apply.");
    }
    if (isStatus && plan.files.length === 0 && conflictCount === 0 && skippedCount === 0 && (plan.diagnostics || []).length === 0) {
      console.log("No template update action needed.");
    }
    if (isApply && appliedCount > 0) {
      console.log(`Applied ${appliedCount} file(s).`);
    }
    if (isFileAction && appliedCount > 0) {
      console.log(`Accepted candidate for ${appliedCount} file(s).`);
    }
    if (acceptedCount > 0) {
      console.log(`Accepted current baseline for ${acceptedCount} file(s).`);
    }
    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} current-only file(s).`);
    }
    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} current-only file(s).`);
    }
    if (conflictCount > 0) {
      console.log(`Refused due to ${conflictCount} conflict(s).`);
    }
  }
  const diagnostics = Array.isArray(plan.diagnostics) ? plan.diagnostics : [];
  for (const diagnostic of diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
    if (diagnostic.step) {
      console.log(`  step: ${diagnostic.step}`);
    }
  }
  for (const conflict of plan.conflicts || []) {
    console.log(`Conflict: ${conflict.path}`);
    console.log(`  reason: ${conflict.reason}`);
  }
  for (const applied of plan.applied || []) {
    console.log(`Applied: ${applied.path}`);
  }
  for (const skipped of plan.skipped || []) {
    console.log(`Skipped: ${skipped.path}`);
    console.log(`  reason: ${skipped.reason}`);
  }
  for (const accepted of plan.accepted || []) {
    console.log(`Accepted current: ${accepted.path}`);
  }
  for (const deleted of plan.deleted || []) {
    console.log(`Deleted: ${deleted.path}`);
  }
  for (const file of plan.files) {
    console.log("");
    console.log(`${file.kind.toUpperCase()}: ${file.path}`);
    if (file.current) {
      console.log(`  current sha256: ${file.current.sha256}`);
      console.log(`  current size: ${file.current.size}`);
    }
    if (file.candidate) {
      console.log(`  candidate sha256: ${file.candidate.sha256}`);
      console.log(`  candidate size: ${file.candidate.size}`);
    }
    if (file.binary) {
      console.log("  diff: binary file");
    } else if (file.diffOmitted && !file.unifiedDiff) {
      console.log("  diff: hash-only");
    }
    if (file.unifiedDiff) {
      console.log(file.unifiedDiff.trimEnd());
    }
  }
  if (plan.files.length === 0) {
    console.log("No template-owned file changes found.");
  }
  if (!isApply && !isCheck && !isStatus && !isFileAction) {
    console.log("");
    console.log("This command did not write files. Review the plan before applying template updates.");
  } else if (isCheck || isStatus) {
    console.log("");
    console.log("This command did not write files.");
  }
}

/**
 * @param {any} status
 * @returns {any}
 */
export function buildTemplateUpdateRecommendationPayload(status) {
  /** @type {Array<{ action: string, command: string|null, reason: string, path: string|null }>} */
  const recommendations = [];
  /** @type {any[]} */
  const diagnostics = Array.isArray(status.diagnostics)
    ? status.diagnostics.map((/** @type {any} */ diagnostic) => diagnostic.code === "template_update_available"
      ? { ...diagnostic, severity: "warning" }
      : diagnostic)
    : [];
  const errorDiagnostics = diagnostics.filter((/** @type {any} */ diagnostic) => diagnostic.severity === "error");
  const conflicts = Array.isArray(status.conflicts) ? status.conflicts : [];
  const skipped = Array.isArray(status.skipped) ? status.skipped : [];
  const files = Array.isArray(status.files) ? status.files : [];
  const addedChanged = files.filter((/** @type {any} */ file) => file.kind === "added" || file.kind === "changed");

  if (errorDiagnostics.length > 0) {
    recommendations.push({
      action: "resolve-errors",
      command: "topogram template update --status",
      reason: "Template policy, compatibility, baseline, or conflict errors must be resolved before applying candidate files.",
      path: null
    });
  }
  for (const conflict of conflicts) {
    recommendations.push({
      action: "review-conflict",
      command: `topogram template update --accept-current ${conflict.path}`,
      reason: "Local edits differ from the last trusted template-owned baseline. Accept current after review, or apply the candidate manually.",
      path: conflict.path
    });
  }
  if (addedChanged.length > 0 && conflicts.length === 0 && errorDiagnostics.length === 0) {
    recommendations.push({
      action: "apply-candidate",
      command: "topogram template update --apply",
      reason: `${addedChanged.length} added or changed candidate file(s) can be applied without local conflicts.`,
      path: null
    });
  }
  for (const item of skipped) {
    recommendations.push({
      action: "review-delete",
      command: `topogram template update --delete-current ${item.path}`,
      reason: "The candidate no longer owns this current file. Delete it only after review.",
      path: item.path
    });
  }
  if (files.length === 0 && errorDiagnostics.length === 0) {
    recommendations.push({
      action: "none",
      command: null,
      reason: "Current project files already match the candidate template.",
      path: null
    });
  }
  if (status.candidate?.id && status.candidate?.version && errorDiagnostics.length === 0) {
    recommendations.push({
      action: "pin-reviewed-version",
      command: `topogram template policy pin ${status.candidate.id}@${status.candidate.version}`,
      reason: "After reviewing or applying this candidate, pin the template version in project policy.",
      path: null
    });
  }
  return {
    ...status,
    ok: errorDiagnostics.length === 0,
    mode: "recommend",
    writes: false,
    issues: errorDiagnostics.map((/** @type {any} */ diagnostic) => diagnostic.message),
    diagnostics,
    recommendations
  };
}

/**
 * @param {ReturnType<typeof buildTemplateUpdateRecommendationPayload>} payload
 * @returns {void}
 */
export function printTemplateUpdateRecommendation(payload) {
  console.log(payload.ok ? "Template update recommendation: ready" : "Template update recommendation: blocked");
  console.log(`Current: ${payload.current?.id || "unknown"}@${payload.current?.version || "unknown"}`);
  console.log(`Candidate: ${payload.candidate?.id || "unknown"}@${payload.candidate?.version || "unknown"}`);
  console.log(`Added: ${payload.summary.added}`);
  console.log(`Changed: ${payload.summary.changed}`);
  console.log(`Current-only: ${payload.summary.currentOnly}`);
  console.log(`Conflicts: ${payload.conflicts.length}`);
  if (payload.reportPath) {
    console.log(`Report: ${payload.reportPath}`);
  }
  for (const diagnostic of payload.diagnostics || []) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
  console.log("");
  console.log("Recommended next steps:");
  for (const recommendation of payload.recommendations) {
    console.log(`- ${recommendation.reason}`);
    if (recommendation.command) {
      console.log(`  ${recommendation.command}`);
    }
  }
}

/**
 * @param {{ args: string[], inputPath: string, templateIndex: number, templateName: string|null|undefined, useLatestTemplate: boolean, outPath?: string|null }} options
 * @returns {any}
 */
export function buildTemplateUpdateCliPayload(options) {
  const { args, inputPath, templateIndex, templateName, useLatestTemplate, outPath = null } = options;
  const applyUpdate = args.includes("--apply");
  const checkUpdate = args.includes("--check");
  const planUpdate = args.includes("--plan");
  const statusUpdate = args.includes("--status");
  const recommendUpdate = args.includes("--recommend");
  const acceptCurrentIndex = args.indexOf("--accept-current");
  const acceptCandidateIndex = args.indexOf("--accept-candidate");
  const deleteCurrentIndex = args.indexOf("--delete-current");
  const acceptCurrentUpdate = acceptCurrentIndex >= 0;
  const acceptCandidateUpdate = acceptCandidateIndex >= 0;
  const deleteCurrentUpdate = deleteCurrentIndex >= 0;
  const fileAction = acceptCurrentUpdate ? "accept-current" : acceptCandidateUpdate ? "accept-candidate" : deleteCurrentUpdate ? "delete-current" : null;
  const fileActionIndex = acceptCurrentUpdate ? acceptCurrentIndex : acceptCandidateUpdate ? acceptCandidateIndex : deleteCurrentUpdate ? deleteCurrentIndex : -1;
  const fileActionPath = fileActionIndex >= 0 ? args[fileActionIndex + 1] : null;
  const updateModeCount = [applyUpdate, checkUpdate, planUpdate, statusUpdate, recommendUpdate, acceptCurrentUpdate, acceptCandidateUpdate, deleteCurrentUpdate].filter(Boolean).length;
  if (updateModeCount > 1) {
    throw new Error("Choose one template update mode or file adoption action.");
  }
  if (updateModeCount === 0) {
    throw new Error("Template update requires `--status`, `--recommend`, `--plan`, `--check`, `--apply`, `--accept-current <file>`, `--accept-candidate <file>`, or `--delete-current <file>`.");
  }
  if (fileAction && (!fileActionPath || fileActionPath.startsWith("-"))) {
    throw new Error(`Template update ${fileAction} requires a relative file path.`);
  }
  const projectConfigInfo = loadProjectConfig(inputPath);
  if (!projectConfigInfo) {
    throw new Error("Cannot update template without topogram.project.json.");
  }
  if (!projectConfigInfo.config.template?.id && !projectConfigInfo.config.template?.sourceSpec) {
    throw new Error("Cannot update template because this project is detached from template metadata.");
  }
  const requestedTemplateName = templateIndex >= 0
    ? templateName
    : useLatestTemplate
      ? latestTemplateInfo(templateMetadataFromProjectConfig(projectConfigInfo.config)).candidateSpec
      : null;
  if (useLatestTemplate && !requestedTemplateName) {
    throw new Error("Cannot use --latest because the current template is not package-backed.");
  }
  let update;
  try {
    const updateOptions = {
      projectRoot: projectConfigInfo.configDir,
      projectConfig: projectConfigInfo.config,
      templateName: requestedTemplateName,
      templatesRoot: TEMPLATES_ROOT
    };
    update = fileAction
      ? applyTemplateUpdateFileAction({ ...updateOptions, action: fileAction, filePath: fileActionPath || "" })
      : recommendUpdate
        ? buildTemplateUpdateRecommendationPayload(buildTemplateUpdateStatus(updateOptions))
        : (applyUpdate ? applyTemplateUpdate : checkUpdate ? buildTemplateUpdateCheck : statusUpdate ? buildTemplateUpdateStatus : buildTemplateUpdatePlan)(updateOptions);
  } catch (error) {
    const message = messageFromError(error);
    update = {
      ok: false,
      mode: fileAction || (applyUpdate ? "apply" : checkUpdate ? "check" : statusUpdate ? "status" : recommendUpdate ? "recommend" : "plan"),
      writes: false,
      current: {
        id: typeof projectConfigInfo.config.template?.id === "string" ? projectConfigInfo.config.template.id : null,
        version: typeof projectConfigInfo.config.template?.version === "string" ? projectConfigInfo.config.template.version : null
      },
      candidate: null,
      compatible: false,
      issues: [message],
      diagnostics: [templateCheckDiagnostic({
        code: "template_resolve_failed",
        message,
        path: templateIndex >= 0 && typeof templateName === "string" && path.isAbsolute(templateName) ? templateName : null,
        suggestedFix: "Check the template path or package spec, and verify private registry authentication if this is a package template.",
        step: "resolve-candidate"
      })],
      summary: { added: 0, changed: 0, currentOnly: 0, unchanged: 0 },
      files: [],
      applied: [],
      skipped: [],
      conflicts: [],
      recommendations: recommendUpdate ? [{
        action: "resolve-errors",
        command: "topogram template update --status",
        reason: "Resolve the candidate template before choosing an update action.",
        path: null
      }] : undefined
    };
  }
  if (outPath) {
    const reportPath = path.resolve(outPath);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${stableStringify(update)}\n`, "utf8");
    update.reportPath = reportPath;
  }
  return update;
}

/**
 * @typedef {Object} TemplateCheckDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 * @property {string|null} step
 */

/**
 * @param {Record<string, any>} input
 * @returns {TemplateCheckDiagnostic}
 */
export function templateCheckDiagnostic(input) {
  return {
    code: String(input.code || "template_check_failed"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Template check failed."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null,
    step: typeof input.step === "string" ? input.step : null
  };
}

/**
 * @param {string} templateSpec
 * @param {string} relativePath
 * @returns {string|null}
 */
function localTemplatePath(templateSpec, relativePath) {
  if (
    templateSpec === "." ||
    templateSpec.startsWith("./") ||
    templateSpec.startsWith("../") ||
    path.isAbsolute(templateSpec)
  ) {
    return path.join(path.resolve(templateSpec), relativePath);
  }
  return null;
}

/**
 * @param {string} message
 * @param {string} templateSpec
 * @param {string} step
 * @returns {TemplateCheckDiagnostic}
 */
function diagnosticForTemplateCreateFailure(message, templateSpec, step) {
  if (message.includes("is missing topogram-template.json")) {
    return templateCheckDiagnostic({
      code: "template_manifest_missing",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Add topogram-template.json with id, version, kind, and topogramVersion.",
      step
    });
  }
  if (message.includes("contains implementation/") && message.includes("includesExecutableImplementation: true")) {
    return templateCheckDiagnostic({
      code: "template_implementation_undeclared",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Set includesExecutableImplementation to true after reviewing implementation/, or remove implementation/.",
      step
    });
  }
  if (message.includes("is missing required string field") || message.includes("topogram-template.json")) {
    return templateCheckDiagnostic({
      code: "template_manifest_invalid",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Fix topogram-template.json so it matches the template manifest schema.",
      step
    });
  }
  if (message.includes("is missing topogram/")) {
    return templateCheckDiagnostic({
      code: "template_topogram_missing",
      message,
      path: localTemplatePath(templateSpec, "topogram"),
      suggestedFix: "Add a topogram/ directory with the reusable Topogram source files.",
      step
    });
  }
  if (message.includes("is missing topogram.project.json")) {
    return templateCheckDiagnostic({
      code: "template_project_config_missing",
      message,
      path: localTemplatePath(templateSpec, "topogram.project.json"),
      suggestedFix: "Add topogram.project.json beside topogram/ with outputs and topology.runtimes.",
      step
    });
  }
  if (message.includes("is missing implementation/")) {
    return templateCheckDiagnostic({
      code: "template_implementation_missing",
      message,
      path: localTemplatePath(templateSpec, "implementation"),
      suggestedFix: "Add implementation/ or set includesExecutableImplementation to false.",
      step
    });
  }
  if (message.includes("unsupported symlink")) {
    return templateCheckDiagnostic({
      code: "template_symlink_unsupported",
      message,
      path: path.isAbsolute(templateSpec) ? templateSpec : null,
      suggestedFix: "Replace template symlinks with real files or directories, then rerun `topogram new` or `topogram template check`.",
      step
    });
  }
  return templateCheckDiagnostic({
    code: "template_create_failed",
    message,
    path: path.isAbsolute(templateSpec) ? templateSpec : null,
    suggestedFix: "Fix the template pack so topogram new can create a starter from it.",
    step
  });
}

/**
 * @param {{ message: string, loc?: any }} error
 * @param {string} step
 * @param {string|null} configPath
 * @returns {TemplateCheckDiagnostic}
 */
function diagnosticForStarterCheckFailure(error, step, configPath) {
  const locFile = typeof error?.loc?.file === "string" ? error.loc.file : null;
  const isTrust = error.message.includes(TEMPLATE_TRUST_FILE) ||
    error.message.includes("unsupported symlink") ||
    error.message.includes("must be under implementation/");
  return templateCheckDiagnostic({
    code: isTrust ? "template_trust_invalid" : "starter_check_failed",
    message: error.message,
    path: locFile || configPath,
    suggestedFix: isTrust
      ? templateTrustRecoveryGuidance(error.message)
      : "Fix the generated Topogram source or topogram.project.json so topogram check passes.",
    step
  });
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {Record<string, any>} [details]
 * @param {TemplateCheckDiagnostic[]} [diagnostics]
 * @returns {{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }}
 */
function templateCheckStep(name, ok, details = {}, diagnostics = []) {
  return { name, ok, details, diagnostics };
}

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
function templateCheckGeneratorDependencies(projectRoot) {
  const packagePath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    return [];
  }
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };
  return Object.keys(dependencies).filter((name) =>
    name.includes("topogram-generator") || name.startsWith("@topogram/generator-")
  ).sort();
}

/**
 * @param {string} projectRoot
 * @param {string[]} dependencies
 * @returns {TemplateCheckDiagnostic|null}
 */
function installTemplateCheckGeneratorDependencies(projectRoot, dependencies) {
  if (dependencies.length === 0) {
    return null;
  }
  const result = runNpmForPackageUpdate(["install", "--ignore-scripts"], projectRoot);
  if (result.status === 0) {
    return null;
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  return templateCheckDiagnostic({
    code: "template_generator_dependencies_install_failed",
    message: `Failed to install package-backed generator dependencies: ${dependencies.join(", ")}.`,
    path: path.join(projectRoot, "package.json"),
    suggestedFix: `Run npm install before checking this package-backed generator template.${output ? ` ${output.split(/\r?\n/).slice(-3).join(" ")}` : ""}`,
    step: "generator-dependencies"
  });
}

/**
 * @param {string} templateSpec
 * @returns {{ ok: boolean, templateSpec: string, projectRoot: string|null, steps: Array<{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }>, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
export function buildTemplateCheckPayload(templateSpec) {
  if (!templateSpec) {
    throw new Error("topogram template check requires <template-spec-or-path>.");
  }
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-"));
  const projectRoot = path.join(runRoot, "starter");
  /** @type {Array<{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }>} */
  const steps = [];
  /** @type {TemplateCheckDiagnostic[]} */
  const diagnostics = [];
  try {
    const callerPolicyInfo = loadTemplatePolicy(process.cwd());
    if (callerPolicyInfo.exists) {
      const resolvedTemplate = resolveTemplate(templateSpec, TEMPLATES_ROOT);
      const policyDiagnostics = templatePolicyDiagnosticsForTemplate(callerPolicyInfo, resolvedTemplate, "template-check-policy");
      if (policyDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        const stepDiagnostics = policyDiagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
        diagnostics.push(...stepDiagnostics);
        steps.push(templateCheckStep("template-policy", false, {
          path: callerPolicyInfo.path
        }, stepDiagnostics));
        return {
          ok: false,
          templateSpec,
          projectRoot: null,
          steps,
          diagnostics,
          errors: diagnostics.map((diagnostic) => diagnostic.message)
        };
      }
    }
    const created = createNewProject({
      targetPath: projectRoot,
      templateName: templateSpec,
      engineRoot: ENGINE_ROOT,
      templatesRoot: TEMPLATES_ROOT
    });
    steps.push(templateCheckStep("create-starter", true, {
      template: created.templateName,
      warnings: created.warnings.length
    }));
    const generatorDependencies = templateCheckGeneratorDependencies(projectRoot);
    const installDiagnostic = installTemplateCheckGeneratorDependencies(projectRoot, generatorDependencies);
    if (installDiagnostic) {
      diagnostics.push(installDiagnostic);
      steps.push(templateCheckStep("generator-dependencies", false, {
        dependencies: generatorDependencies
      }, [installDiagnostic]));
      return {
        ok: false,
        templateSpec,
        projectRoot,
        steps,
        diagnostics,
        errors: diagnostics.map((diagnostic) => diagnostic.message)
      };
    }
    if (generatorDependencies.length > 0) {
      steps.push(templateCheckStep("generator-dependencies", true, {
        dependencies: generatorDependencies
      }));
    }
  } catch (error) {
    const stepDiagnostics = [
      diagnosticForTemplateCreateFailure(messageFromError(error), templateSpec, "create-starter")
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("create-starter", false, {}, stepDiagnostics));
    return {
      ok: false,
      templateSpec,
      projectRoot: null,
      steps,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }

  const projectConfigInfo = loadProjectConfig(projectRoot);
  if (!projectConfigInfo) {
    const stepDiagnostics = [
      templateCheckDiagnostic({
        code: "starter_project_config_missing",
        message: "Generated starter is missing topogram.project.json.",
        path: path.join(projectRoot, "topogram.project.json"),
        suggestedFix: "Ensure the template includes topogram.project.json at its root.",
        step: "project-config"
      })
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("project-config", false, {}, stepDiagnostics));
    return {
      ok: false,
      templateSpec,
      projectRoot,
      steps,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }
  steps.push(templateCheckStep("project-config", true, {
    path: projectConfigInfo.configPath,
    template: projectConfigInfo.config.template?.id || null
  }));

  const ast = parsePath(path.join(projectRoot, "topogram"));
  const resolved = resolveWorkspace(ast);
  const projectValidation = combineProjectValidationResults(
    validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null, { configDir: projectConfigInfo.configDir }),
    validateProjectOutputOwnership(projectConfigInfo),
    validateProjectImplementationTrust(projectConfigInfo)
  );
  const starterCheckOk = resolved.ok && projectValidation.ok;
  const starterDiagnostics = [
    ...(resolved.ok ? [] : resolved.validation.errors),
    ...projectValidation.errors
  ].map((error) => diagnosticForStarterCheckFailure(error, "starter-check", projectConfigInfo.configPath));
  steps.push(templateCheckStep("starter-check", starterCheckOk, {
    files: ast.files.length,
    statements: ast.files.flatMap((/** @type {{ statements: any[] }} */ file) => file.statements).length
  }, starterDiagnostics));
  if (!starterCheckOk) {
    diagnostics.push(...starterDiagnostics);
  }

  const implementationInfo = projectConfigInfo.config.implementation
    ? {
        config: projectConfigInfo.config.implementation,
        configPath: projectConfigInfo.configPath,
        configDir: projectConfigInfo.configDir
      }
    : null;
  if (implementationInfo && implementationRequiresTrust(implementationInfo, projectConfigInfo.config)) {
    const trustStatus = getTemplateTrustStatus(implementationInfo, projectConfigInfo.config);
    const trustDiagnostics = trustStatus.issues.map((issue) => templateCheckDiagnostic({
      code: "template_trust_invalid",
      message: issue,
      path: trustStatus.trustPath,
      suggestedFix: templateTrustRecoveryGuidance(issue),
      step: "executable-implementation-trust"
    }));
    steps.push(templateCheckStep("executable-implementation-trust", trustStatus.ok, {
      requiresTrust: true,
      trustPath: trustStatus.trustPath,
      trustedFiles: trustStatus.trustRecord?.content?.files?.length || 0
    }, trustDiagnostics));
    if (!trustStatus.ok) {
      diagnostics.push(...trustDiagnostics);
    }
  } else {
    steps.push(templateCheckStep("executable-implementation-trust", true, {
      requiresTrust: false
    }));
  }

  try {
    const updatePlan = buildTemplateUpdatePlan({
      projectRoot,
      projectConfig: projectConfigInfo.config,
      templateName: null,
      templatesRoot: TEMPLATES_ROOT
    });
    steps.push(templateCheckStep("template-update-plan", updatePlan.ok, {
      writes: updatePlan.writes,
      added: updatePlan.summary.added,
      changed: updatePlan.summary.changed,
      currentOnly: updatePlan.summary.currentOnly
    }));
    if (!updatePlan.ok) {
      const stepDiagnostics = updatePlan.issues.map((issue) => templateCheckDiagnostic({
        code: "template_update_plan_failed",
        message: issue,
        path: projectConfigInfo.configPath,
        suggestedFix: "Fix template metadata so a no-write update plan can be produced.",
        step: "template-update-plan"
      }));
      steps[steps.length - 1].diagnostics.push(...stepDiagnostics);
      diagnostics.push(...stepDiagnostics);
    }
  } catch (error) {
    const stepDiagnostics = [
      templateCheckDiagnostic({
        code: "template_update_plan_failed",
        message: messageFromError(error),
        path: projectConfigInfo.configPath,
        suggestedFix: "Fix template metadata so a no-write update plan can be produced.",
        step: "template-update-plan"
      })
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("template-update-plan", false, {}, stepDiagnostics));
  }

  return {
    ok: steps.every((step) => step.ok),
    templateSpec,
    projectRoot,
    steps,
    diagnostics,
    errors: diagnostics.map((diagnostic) => diagnostic.message)
  };
}

/**
 * @param {ReturnType<typeof loadProjectConfig>} projectConfigInfo
 * @returns {{ requested: string, root: string, manifest: { id: string, version: string, kind: string, topogramVersion: string, includesExecutableImplementation: boolean }, source: "local"|"package", packageSpec: string|null }}
 */
function currentPolicyTemplate(projectConfigInfo) {
  const template = projectConfigInfo?.config.template || {};
  const source = template.source === "local" || template.source === "package"
    ? template.source
    : "local";
  return {
    requested: typeof template.requested === "string" ? template.requested : String(template.id || "unknown"),
    root: projectConfigInfo?.configDir || process.cwd(),
    manifest: {
      id: typeof template.id === "string" ? template.id : "unknown",
      version: typeof template.version === "string" ? template.version : "unknown",
      kind: "starter",
      topogramVersion: "*",
      includesExecutableImplementation: Boolean(template.includesExecutableImplementation)
    },
    source,
    packageSpec: typeof template.sourceSpec === "string" ? template.sourceSpec : null
  };
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
export function buildTemplatePolicyCheckPayload(projectPath) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_project_missing",
      message: "Cannot check template policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), "topogram.template-policy.json"),
      exists: false,
      policy: null,
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policyInfo = loadTemplatePolicy(projectConfigInfo.configDir);
  /** @type {TemplateCheckDiagnostic[]} */
  const diagnostics = policyInfo.diagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
  if (!policyInfo.exists) {
    diagnostics.push(templateCheckDiagnostic({
      code: "template_policy_missing",
      severity: "warning",
      message: "No topogram.template-policy.json found. Template operations are permissive until a policy is defined.",
      path: policyInfo.path,
      suggestedFix: "Run `topogram template policy init` to create a project template policy.",
      step: "policy"
    }));
  } else if (policyInfo.policy) {
    const currentTemplate = currentPolicyTemplate(projectConfigInfo);
    diagnostics.push(...templatePolicyDiagnosticsForTemplate(policyInfo, currentTemplate, "policy")
      .map((diagnostic) => templateCheckDiagnostic(diagnostic)));
  }
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    path: policyInfo.path,
    exists: policyInfo.exists,
    policy: policyInfo.policy,
    diagnostics,
    errors
  };
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} actual
 * @param {string} expected
 * @param {string} message
 * @param {string|null} fix
 * @returns {{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }}
 */
function templatePolicyRule(name, ok, actual, expected, message, fix = null) {
  return { name, ok, actual, expected, message, fix };
}

/**
 * @param {string} name
 * @returns {string}
 */
function templatePolicyRuleLabel(name) {
  return ({
    "policy-file": "Policy file",
    "allowed-source": "Allowed source",
    "allowed-template-id": "Allowed template id",
    "allowed-package-scope": "Allowed package scope",
    "pinned-version": "Pinned version",
    "executable-implementation": "Executable implementation"
  })[name] || name;
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, template: any, catalog: any, package: any, rules: Array<{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }>, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
export function buildTemplatePolicyExplainPayload(projectPath) {
  const check = buildTemplatePolicyCheckPayload(projectPath);
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    return {
      ...check,
      template: null,
      catalog: null,
      package: null,
      rules: []
    };
  }
  const templateMetadata = projectConfigInfo.config.template || {};
  const currentTemplate = currentPolicyTemplate(projectConfigInfo);
  const policy = check.policy;
  const packageScope = currentTemplate.source === "package"
    ? packageScopeFromSpec(currentTemplate.packageSpec || currentTemplate.requested)
    : null;
  const rules = [];
  rules.push(templatePolicyRule(
    "policy-file",
    check.exists,
    check.exists ? "present" : "missing",
    "present",
    check.exists
      ? "Project has a template policy file."
      : "Project has no template policy file; template operations are permissive until one is defined.",
    check.exists ? null : "Run `topogram template policy init`."
  ));
  if (policy) {
    rules.push(templatePolicyRule(
      "allowed-source",
      policy.allowedSources.length === 0 || policy.allowedSources.includes(currentTemplate.source),
      currentTemplate.source,
      policy.allowedSources.length > 0 ? policy.allowedSources.join(", ") : "(any)",
      "Current template source must be allowed by allowedSources.",
      `Add '${currentTemplate.source}' to allowedSources after review, or run \`topogram template policy init\`.`
    ));
    rules.push(templatePolicyRule(
      "allowed-template-id",
      policy.allowedTemplateIds.length === 0 || policy.allowedTemplateIds.includes(currentTemplate.manifest.id),
      currentTemplate.manifest.id,
      policy.allowedTemplateIds.length > 0 ? policy.allowedTemplateIds.join(", ") : "(any)",
      "Current template id must be allowed by allowedTemplateIds.",
      `Run \`topogram template policy pin ${currentTemplate.manifest.id}@${currentTemplate.manifest.version}\` after review.`
    ));
    if (currentTemplate.source === "package") {
      rules.push(templatePolicyRule(
        "allowed-package-scope",
        !policy.allowedPackageScopes ||
          policy.allowedPackageScopes.length === 0 ||
          Boolean(packageScope && policy.allowedPackageScopes.includes(packageScope)),
        packageScope || "(unscoped)",
        policy.allowedPackageScopes && policy.allowedPackageScopes.length > 0 ? policy.allowedPackageScopes.join(", ") : "(any)",
        "Package-backed template source must be in an allowed package scope.",
        `Add '${packageScope || "(unscoped)"}' to allowedPackageScopes after review.`
      ));
    }
    const pinnedVersion = policy.pinnedVersions?.[currentTemplate.manifest.id] || null;
    rules.push(templatePolicyRule(
      "pinned-version",
      !pinnedVersion || pinnedVersion === currentTemplate.manifest.version,
      currentTemplate.manifest.version,
      pinnedVersion || "(unpinned)",
      "Pinned version must match the current template version when a pin exists.",
      `Run \`topogram template policy pin ${currentTemplate.manifest.id}@${currentTemplate.manifest.version}\` after review.`
    ));
    rules.push(templatePolicyRule(
      "executable-implementation",
      !currentTemplate.manifest.includesExecutableImplementation || policy.executableImplementation !== "deny",
      currentTemplate.manifest.includesExecutableImplementation ? "yes" : "no",
      policy.executableImplementation,
      "Executable template implementation must be allowed when implementation/ is present.",
      "Review implementation/, then set executableImplementation to 'allow' or choose a non-executable template."
    ));
  }
  return {
    ...check,
    template: {
      id: currentTemplate.manifest.id,
      version: currentTemplate.manifest.version,
      source: currentTemplate.source,
      requested: currentTemplate.requested,
      sourceSpec: currentTemplate.packageSpec,
      includesExecutableImplementation: currentTemplate.manifest.includesExecutableImplementation
    },
    catalog: templateMetadata.catalog || null,
    package: currentTemplate.source === "package" ? {
      spec: currentTemplate.packageSpec,
      scope: packageScope
    } : null,
    rules
  };
}

/**
 * @param {ReturnType<typeof buildTemplatePolicyExplainPayload>} payload
 * @returns {void}
 */
export function printTemplatePolicyExplainPayload(payload) {
  console.log(payload.ok ? "Template policy: allowed" : "Template policy: denied");
  console.log(payload.ok
    ? "Decision: the current template is allowed by this project's template policy."
    : "Decision: the current template is blocked by this project's template policy.");
  console.log(`Policy file: ${payload.path}`);
  console.log(`Policy file exists: ${payload.exists ? "yes" : "no"}`);
  if (payload.template) {
    console.log(`Template: ${payload.template.id}@${payload.template.version}`);
    console.log(`Source: ${payload.template.source}`);
    console.log(`Requested: ${payload.template.requested}`);
    if (payload.template.sourceSpec) {
      console.log(`Source spec: ${payload.template.sourceSpec}`);
    }
    console.log(`Executable implementation: ${payload.template.includesExecutableImplementation ? "yes" : "no"}`);
  }
  if (payload.catalog?.id) {
    console.log(`Catalog: ${payload.catalog.id} from ${payload.catalog.source || "unknown"}`);
    console.log(`Catalog package: ${payload.catalog.packageSpec || payload.catalog.package || "unknown"}`);
  }
  if (payload.package) {
    console.log(`Package scope: ${payload.package.scope || "(unscoped)"}`);
  }
  if (payload.rules.length > 0) {
    console.log("");
    console.log("Policy checks:");
  }
  for (const rule of payload.rules) {
    console.log(`${rule.ok ? "PASS" : "FAIL"} ${templatePolicyRuleLabel(rule.name)}: ${rule.message}`);
    console.log(`  actual: ${rule.actual}`);
    console.log(`  expected: ${rule.expected}`);
    if (!rule.ok && rule.fix) {
      console.log(`  fix: ${rule.fix}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {{ ok: boolean, path: string, exists: boolean, policy: any, diagnostics: TemplateCheckDiagnostic[] }} payload
 * @returns {void}
 */
export function printTemplatePolicyCheckPayload(payload) {
  console.log(payload.ok ? "Template policy check passed" : "Template policy check failed");
  console.log(`Policy: ${payload.path}`);
  console.log(`Exists: ${payload.exists ? "yes" : "no"}`);
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {string|null|undefined} spec
 * @returns {{ id: string, version: string }|null}
 */
function parseTemplateVersionPin(spec) {
  if (!spec) {
    return null;
  }
  const separator = spec.lastIndexOf("@");
  if (separator <= 0 || separator === spec.length - 1) {
    throw new Error("Template policy pin requires a template id and version, for example @scope/template@0.2.0.");
  }
  return {
    id: spec.slice(0, separator),
    version: spec.slice(separator + 1)
  };
}

/**
 * @param {string} projectPath
 * @param {string|null|undefined} spec
 * @returns {{ ok: boolean, path: string, policy: any, pinned: { id: string, version: string }, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
export function buildTemplatePolicyPinPayload(projectPath, spec) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_project_missing",
      message: "Cannot pin template policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), "topogram.template-policy.json"),
      policy: null,
      pinned: { id: "", version: "" },
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const parsed = parseTemplateVersionPin(spec);
  const currentTemplate = projectConfigInfo.config.template || {};
  const pin = parsed || {
    id: typeof currentTemplate.id === "string" ? currentTemplate.id : "",
    version: typeof currentTemplate.version === "string" ? currentTemplate.version : ""
  };
  if (!pin.id || !pin.version) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_pin_missing_version",
      message: "Cannot pin a template version without a template id and version.",
      path: projectConfigInfo.configPath,
      suggestedFix: "Pass a pin such as @scope/template@0.2.0, or ensure topogram.project.json records template.id and template.version.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(projectConfigInfo.configDir, "topogram.template-policy.json"),
      policy: null,
      pinned: pin,
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }

  const existing = loadTemplatePolicy(projectConfigInfo.configDir);
  const diagnostics = existing.diagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      ok: false,
      path: existing.path,
      policy: existing.policy,
      pinned: pin,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }
  const policy = existing.policy || writeTemplatePolicyForProject(projectConfigInfo.configDir, projectConfigInfo.config);
  const allowedTemplateIds = policy.allowedTemplateIds.includes(pin.id)
    ? policy.allowedTemplateIds
    : [...policy.allowedTemplateIds, pin.id];
  const allowedPackageScopes = [...(policy.allowedPackageScopes || [])];
  if (pin.id.startsWith("@")) {
    const scope = pin.id.split("/")[0];
    if (scope && !allowedPackageScopes.includes(scope)) {
      allowedPackageScopes.push(scope);
    }
  }
  const nextPolicy = {
    ...policy,
    allowedTemplateIds,
    allowedPackageScopes,
    pinnedVersions: {
      ...(policy.pinnedVersions || {}),
      [pin.id]: pin.version
    }
  };
  writeTemplatePolicy(projectConfigInfo.configDir, nextPolicy);
  return {
    ok: true,
    path: path.join(projectConfigInfo.configDir, "topogram.template-policy.json"),
    policy: nextPolicy,
    pinned: pin,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {{ ok: boolean, path: string, pinned: { id: string, version: string }, diagnostics: TemplateCheckDiagnostic[] }} payload
 * @returns {void}
 */
export function printTemplatePolicyPinPayload(payload) {
  console.log(payload.ok ? "Template policy pin updated" : "Template policy pin failed");
  console.log(`Policy: ${payload.path}`);
  if (payload.pinned.id) {
    console.log(`Pinned: ${payload.pinned.id}@${payload.pinned.version || "unknown"}`);
  }
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {Record<string, any>} details
 * @returns {string[]}
 */
function formatTemplateCheckDetails(details) {
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `  ${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
}

/**
 * @param {ReturnType<typeof buildTemplateCheckPayload>} payload
 * @returns {void}
 */
export function printTemplateCheckPayload(payload) {
  console.log(payload.ok ? "Template check passed" : "Template check failed");
  console.log(`Template spec: ${payload.templateSpec}`);
  if (payload.projectRoot) {
    console.log(`Temp starter: ${payload.projectRoot}`);
  }
  for (const step of payload.steps) {
    console.log(`${step.ok ? "PASS" : "FAIL"} ${step.name}`);
    for (const detail of formatTemplateCheckDetails(step.details)) {
      console.log(detail);
    }
    for (const diagnostic of step.diagnostics) {
      console.log(`  [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
      if (diagnostic.path) {
        console.log(`    path: ${diagnostic.path}`);
      }
      if (diagnostic.suggestedFix) {
        console.log(`    fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
  const stepDiagnostics = new Set(payload.steps.flatMap((step) => step.diagnostics));
  for (const diagnostic of payload.diagnostics.filter((item) => !stepDiagnostics.has(item))) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
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
