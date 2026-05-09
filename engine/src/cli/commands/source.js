// @ts-check

import fs from "node:fs";
import path from "node:path";

import {
  buildTopogramSourceStatus,
  TOPOGRAM_SOURCE_FILE
} from "../../catalog.js";
import { loadProjectConfig } from "../../project-config.js";
import {
  getTemplateTrustStatus,
  TEMPLATE_TRUST_FILE
} from "../../template-trust.js";
import {
  checkTemplatePackageStatus,
  localTemplatePackageStatus
} from "./package.js";
import { buildTemplateOwnedBaselineStatus } from "./template.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @returns {void}
 */
export function printSourceHelp() {
  console.log("Usage: topogram source status [path] [--local|--remote] [--json]");
  console.log("");
  console.log("Reports source provenance, template attachment state, and whether local edits affect template-owned files.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram source status");
  console.log("  topogram source status --local");
  console.log("  topogram source status --remote");
  console.log("  topogram source status --json");
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
function normalizeTopogramPath(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return absolute;
  }
  const candidate = path.join(absolute, "topogram");
  return fs.existsSync(candidate) ? candidate : absolute;
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeProjectRoot(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return path.dirname(absolute);
  }
  return absolute;
}

/**
 * @param {string} projectRoot
 * @param {{ local?: boolean }} [options]
 * @returns {ReturnType<typeof buildTopogramSourceStatus> & { project: AnyRecord }}
 */
export function buildProjectSourceStatus(projectRoot, options = {}) {
  const resolvedRoot = normalizeProjectRoot(projectRoot);
  const sourceStatus = buildTopogramSourceStatus(resolvedRoot);
  const projectConfigInfo = loadProjectConfig(normalizeTopogramPath(resolvedRoot));
  const template = projectConfigInfo?.config?.template || null;
  const baseline = buildTemplateOwnedBaselineStatus(resolvedRoot);
  /** @type {AnyRecord} */
  let trust = {
    requiresTrust: false,
    ok: true,
    status: "not-required",
    path: path.join(resolvedRoot, TEMPLATE_TRUST_FILE),
    template: null,
    implementation: null,
    content: { trustedDigest: null, currentDigest: null, changed: [], added: [], removed: [] },
    issues: []
  };
  if (projectConfigInfo?.config?.implementation) {
    const trustStatus = getTemplateTrustStatus({
      config: projectConfigInfo.config.implementation,
      configPath: projectConfigInfo.configPath,
      configDir: projectConfigInfo.configDir
    }, projectConfigInfo.config);
    trust = {
      requiresTrust: trustStatus.requiresTrust,
      ok: trustStatus.ok,
      status: trustStatus.requiresTrust ? (trustStatus.ok ? "trusted" : "review-required") : "not-required",
      path: trustStatus.trustPath,
      template: trustStatus.template,
      implementation: trustStatus.implementation,
      content: trustStatus.content,
      issues: trustStatus.issues
    };
  }
  const packageStatus = template?.source === "package" && template.sourceSpec
    ? (options.local ? localTemplatePackageStatus(template.sourceSpec) : checkTemplatePackageStatus(template.sourceSpec))
    : null;
  const projectDiagnostics = [];
  if (!projectConfigInfo) {
    projectDiagnostics.push({
      code: "project_config_missing",
      severity: "warning",
      message: "topogram.project.json was not found.",
      path: path.join(resolvedRoot, "topogram.project.json"),
      suggestedFix: "Run `topogram check` from a Topogram project root."
    });
  }
  return {
    ...sourceStatus,
    project: {
      root: resolvedRoot,
      config: projectConfigInfo
        ? { exists: true, path: projectConfigInfo.configPath }
        : { exists: false, path: path.join(resolvedRoot, "topogram.project.json") },
      catalog: template?.catalog || sourceStatus.source?.catalog || null,
      template: template
        ? {
            id: template.id || null,
            version: template.version || null,
            requested: template.requested || null,
            source: template.source || null,
            sourceSpec: template.sourceSpec || null,
            includesExecutableImplementation: typeof template.includesExecutableImplementation === "boolean"
              ? template.includesExecutableImplementation
              : null
          }
        : null,
      package: packageStatus,
      packageChecks: {
        mode: options.local ? "local" : "remote",
        skipped: Boolean(options.local),
        reason: options.local ? "Package registry checks were skipped because --local was used." : null
      },
      trust,
      templateBaseline: baseline,
      diagnostics: projectDiagnostics
    },
    diagnostics: [...sourceStatus.diagnostics, ...projectDiagnostics]
  };
}

/**
 * @param {ReturnType<typeof buildProjectSourceStatus>} payload
 * @returns {void}
 */
export function printTopogramSourceStatus(payload) {
  if (payload.project?.package && payload.project?.packageChecks?.mode === "remote") {
    console.log("Package checks: remote. Use --local to skip registry access.");
  } else if (payload.project?.package && payload.project?.packageChecks?.mode === "local") {
    console.log("Package checks: local. Registry access skipped.");
  }
  if (!payload.exists) {
    console.log("Topogram source status: no provenance");
    console.log(`Expected: ${payload.path}`);
    console.log(`${TOPOGRAM_SOURCE_FILE} was not found. This workspace may not have been copied from a catalog topogram entry.`);
  } else {
    console.log(`Topogram source status: ${payload.status}`);
    console.log(`File: ${payload.path}`);
    if (payload.source?.catalog?.id) {
      console.log(`Catalog: ${payload.source.catalog.id}${payload.source.catalog.source ? ` from ${payload.source.catalog.source}` : ""}`);
    }
    if (payload.source?.package?.spec) {
      console.log(`Package: ${payload.source.package.spec}`);
    }
  }
  if (payload.project?.config?.exists) {
    console.log(`Project config: ${payload.project.config.path}`);
  }
  if (payload.project?.catalog?.id) {
    console.log(`Project catalog: ${payload.project.catalog.id}${payload.project.catalog.source ? ` from ${payload.project.catalog.source}` : ""}`);
  }
  if (payload.project?.template?.id) {
    console.log("Template attachment: attached");
    console.log(`Template: ${payload.project.template.id}@${payload.project.template.version || "unknown"}`);
    console.log(`Template source: ${payload.project.template.sourceSpec || payload.project.template.source || "unknown"}`);
    console.log(`Executable implementation: ${payload.project.template.includesExecutableImplementation ? "yes" : "no"}`);
  } else if (payload.project?.config?.exists) {
    console.log("Template attachment: detached");
    console.log("Template ownership: project-owned");
  }
  if (payload.project?.package?.package) {
    const packageStatus = payload.project.package;
    if (packageStatus.checked === false) {
      console.log(`Template package: ${packageStatus.packageSpec} (not checked, local mode)`);
    } else {
      const currentLabel = packageStatus.current === null ? "unknown" : (packageStatus.current ? "current" : "update available");
      console.log(`Template package: ${packageStatus.packageSpec} (${packageStatus.ok ? "reachable" : "unreachable"}, ${currentLabel})`);
      if (packageStatus.latestVersion) {
        console.log(`Latest template package version: ${packageStatus.latestVersion}`);
      }
    }
  }
  if (payload.project?.trust) {
    console.log(`Implementation trust: ${payload.project.trust.status}`);
    if (payload.project.trust.content.trustedDigest) {
      console.log(`Trusted digest: ${payload.project.trust.content.trustedDigest}`);
    }
    if (payload.project.trust.content.currentDigest) {
      console.log(`Current digest: ${payload.project.trust.content.currentDigest}`);
    }
  }
  if (payload.project?.templateBaseline) {
    const baseline = payload.project.templateBaseline;
    const blockLabel = baseline.blocksCheck || baseline.blocksGenerate
      ? "may block workflow"
      : "does not block check/generate";
    console.log(`Template baseline: ${baseline.state} (${baseline.trustedFiles} file(s), ${blockLabel})`);
    console.log(`Template baseline meaning: ${baseline.meaning}`);
    if (baseline.localOwnership) {
      console.log("Template baseline ownership: local project owns these changes");
    }
    console.log(`Template baseline changed: ${baseline.content.changed.length}`);
    console.log(`Template baseline removed: ${baseline.content.removed.length}`);
  }
  for (const kind of ["changed", "added", "removed"]) {
    const files = payload.content[kind] || [];
    console.log(`${kind[0].toUpperCase()}${kind.slice(1)}: ${files.length}`);
    for (const file of files) {
      console.log(`- ${file}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
  }
  if (payload.project?.package?.diagnostics?.length) {
    for (const diagnostic of payload.project.package.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`${label}: ${diagnostic.message}`);
      if (diagnostic.suggestedFix) {
        console.log(`Fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
  if (payload.project?.trust?.issues?.length) {
    for (const issue of payload.project.trust.issues) {
      console.log(`Issue: ${issue}`);
    }
  }
  console.log("");
  console.log(`${TOPOGRAM_SOURCE_FILE} records catalog-copy provenance only. Local edits are allowed.`);
  console.log("Template attachment controls update tracking. Detaching makes the project fully owned by this workspace.");
  console.log("Template baseline drift does not block `topogram check` or `topogram generate`.");
  console.log("Implementation trust is separate and can block check/generate when review is required.");
  if (payload.project?.trust?.status === "review-required") {
    console.log("Next: review implementation changes, then run `topogram trust status` or `topogram trust template`.");
  } else if (payload.exists && payload.status === "changed") {
    console.log("Next: review the listed files, then run `topogram check` and `topogram generate` when ready.");
  } else if (payload.project?.templateBaseline?.state === "diverged") {
    console.log("Next: local template-derived changes are owned by this project. Run `topogram template update --check` only when reviewing upstream template changes.");
  } else if (!payload.exists) {
    console.log("Next: use `topogram catalog copy <id> <target>` for pure topogram provenance, or continue with template/project provenance above.");
  } else {
    console.log("Next: run `topogram check` or `topogram generate`.");
  }
}
