// @ts-check

import fs from "node:fs";
import path from "node:path";

import { buildTopogramSourceStatus } from "../../../catalog.js";
import { stableStringify } from "../../../format.js";
import {
  getTemplateTrustStatus,
  TEMPLATE_TRUST_FILE
} from "../../../template-trust.js";
import { TEMPLATE_FILES_MANIFEST, TEMPLATE_POLICY_FILE } from "./constants.js";
import { buildTemplateOwnedBaselineStatus } from "./baseline.js";
import { latestTemplateInfo, templateMetadataFromProjectConfig } from "./shared.js";

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
