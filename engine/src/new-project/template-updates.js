// @ts-check

import fs from "node:fs";
import path from "node:path";

import { writeTemplateTrustRecord } from "../template-trust.js";
import { TEMPLATE_FILES_MANIFEST } from "./constants.js";
import { currentTemplateMetadata, projectTemplateMetadata } from "./metadata.js";
import { resolveTemplate } from "./template-resolution.js";
import { issueMessagesFromDiagnostics, templatePolicyDiagnosticsForProject, templateUpdateDiagnostic } from "./template-policy.js";
import { candidateTemplateFiles, currentTemplateOwnedFileHashes, currentTemplateOwnedFiles, fileHash, fileMatchesBaseline, fileSnapshot, includesTemplateImplementation, normalizeTemplateUpdateActionPath, readTemplateFilesManifest, unifiedTextDiff, updateTemplateFilesManifestRecord, writeCandidateFile, writeTemplateFilesManifest } from "./template-snapshots.js";

/** @typedef {import("./types.js").CreateNewProjectOptions} CreateNewProjectOptions */
/** @typedef {import("./types.js").TemplateUpdatePlanOptions} TemplateUpdatePlanOptions */
/** @typedef {import("./types.js").TemplateUpdateFileActionOptions} TemplateUpdateFileActionOptions */
/** @typedef {import("./types.js").TemplateOwnedFileRecord} TemplateOwnedFileRecord */
/** @typedef {import("./types.js").TemplateManifest} TemplateManifest */
/** @typedef {import("./types.js").TemplateTopologySummary} TemplateTopologySummary */
/** @typedef {import("./types.js").TemplatePolicy} TemplatePolicy */
/** @typedef {import("./types.js").TemplatePolicyInfo} TemplatePolicyInfo */
/** @typedef {import("./types.js").TemplateUpdateDiagnostic} TemplateUpdateDiagnostic */
/** @typedef {import("./types.js").ResolvedTemplate} ResolvedTemplate */
/** @typedef {import("./types.js").CatalogTemplateProvenance} CatalogTemplateProvenance */

/**
 * @param {TemplateUpdatePlanOptions} options
 * @returns {{ ok: boolean, mode: "plan", writes: false, current: { id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null }, candidate: { id: string, version: string, source: string, sourceSpec: string, requested: string }, compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: { added: number, changed: number, currentOnly: number, unchanged: number }, files: Array<{ path: string, kind: "added"|"changed"|"current-only"|"unchanged", current: { sha256: string, size: number }|null, candidate: { sha256: string, size: number }|null, binary: boolean, diffOmitted: boolean, unifiedDiff: string|null }> }}
 */
export function buildTemplateUpdatePlan({
  projectRoot,
  projectConfig,
  templateName = null,
  templatesRoot
}) {
  const currentTemplate = projectConfig.template || {};
  const templateSpec = templateName || currentTemplate.sourceSpec || currentTemplate.requested || currentTemplate.id;
  if (!templateSpec || typeof templateSpec !== "string") {
    throw new Error("Cannot plan template update because topogram.project.json has no template source spec.");
  }
  const candidateTemplate = resolveTemplate(templateSpec, templatesRoot);
  const candidateMetadata = projectTemplateMetadata(candidateTemplate);
  /** @type {TemplateUpdateDiagnostic[]} */
  const diagnostics = templatePolicyDiagnosticsForProject(projectRoot, candidateTemplate, "policy");
  if (currentTemplate.id && currentTemplate.id !== candidateMetadata.id) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_id_mismatch",
      message: `Candidate template id '${candidateMetadata.id}' does not match current template id '${currentTemplate.id}'.`,
      path: path.join(projectRoot, "topogram.project.json"),
      suggestedFix: "Use a template with the same id, or create a new project from the other template.",
      step: "resolve-candidate"
    }));
  }
  const candidateFiles = candidateTemplateFiles(candidateTemplate, projectConfig);
  const currentFiles = currentTemplateOwnedFiles(
    projectRoot,
    Boolean(includesTemplateImplementation(projectConfig) || candidateMetadata.includesExecutableImplementation),
    projectConfig
  );
  const allPaths = new Set([...candidateFiles.keys(), ...currentFiles.keys()]);
  /** @type {Array<{ path: string, kind: "added"|"changed"|"current-only"|"unchanged", current: { sha256: string, size: number }|null, candidate: { sha256: string, size: number }|null, binary: boolean, diffOmitted: boolean, unifiedDiff: string|null }>} */
  const files = [];

  for (const relativePath of [...allPaths].sort((a, b) => a.localeCompare(b))) {
    const candidateFile = candidateFiles.get(relativePath) || null;
    const currentFile = currentFiles.get(relativePath) || null;
    const candidateSnapshot = candidateFile
      ? fileSnapshot(candidateFile.absolutePath, candidateFile.content)
      : null;
    const currentSnapshot = currentFile
      ? fileSnapshot(currentFile.absolutePath, currentFile.content)
      : null;
    let kind = /** @type {"added"|"changed"|"current-only"|"unchanged"} */ ("unchanged");
    if (!currentSnapshot && candidateSnapshot) {
      kind = "added";
    } else if (currentSnapshot && !candidateSnapshot) {
      kind = "current-only";
    } else if (currentSnapshot && candidateSnapshot && (
      currentSnapshot.sha256 !== candidateSnapshot.sha256 ||
      currentSnapshot.size !== candidateSnapshot.size
    )) {
      kind = "changed";
    }
    const binary = Boolean(currentSnapshot?.binary || candidateSnapshot?.binary);
    const diffOmitted = binary || Boolean(currentSnapshot?.diffOmitted || candidateSnapshot?.diffOmitted);
    files.push({
      path: relativePath,
      kind,
      current: currentSnapshot ? { sha256: currentSnapshot.sha256, size: currentSnapshot.size } : null,
      candidate: candidateSnapshot ? { sha256: candidateSnapshot.sha256, size: candidateSnapshot.size } : null,
      binary,
      diffOmitted,
      unifiedDiff: diffOmitted
        ? null
        : unifiedTextDiff(relativePath, currentSnapshot?.text || null, candidateSnapshot?.text || null)
    });
  }
  const visibleFiles = files.filter((file) => file.kind !== "unchanged");
  const summary = {
    added: visibleFiles.filter((file) => file.kind === "added").length,
    changed: visibleFiles.filter((file) => file.kind === "changed").length,
    currentOnly: visibleFiles.filter((file) => file.kind === "current-only").length,
    unchanged: files.filter((file) => file.kind === "unchanged").length
  };
  const issues = issueMessagesFromDiagnostics(diagnostics);
  return {
    ok: issues.length === 0,
    mode: "plan",
    writes: false,
    current: currentTemplateMetadata(projectConfig),
    candidate: {
      id: candidateMetadata.id,
      version: candidateMetadata.version,
      source: candidateMetadata.source,
      sourceSpec: candidateMetadata.sourceSpec,
      requested: candidateMetadata.requested
    },
    compatible: issues.length === 0,
    issues,
    diagnostics,
    summary,
    files: visibleFiles
  };
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @returns {{ ok: boolean, mode: "check", writes: false, current: ReturnType<typeof buildTemplateUpdatePlan>["current"], candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"], compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], files: ReturnType<typeof buildTemplateUpdatePlan>["files"] }}
 */
export function buildTemplateUpdateCheck(options) {
  const plan = buildTemplateUpdatePlan(options);
  const diagnostics = [...plan.diagnostics];
  if (plan.ok && plan.files.length > 0) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_update_available",
      message: `Template update has ${plan.files.length} template-owned file change(s).`,
      path: options.projectRoot,
      suggestedFix: "Run `topogram template update --plan` to review, then `topogram template update --apply` after approval.",
      step: "check"
    }));
  }
  const issues = issueMessagesFromDiagnostics(diagnostics);
  return {
    ...plan,
    ok: issues.length === 0,
    mode: "check",
    writes: false,
    issues,
    diagnostics
  };
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @param {ReturnType<typeof buildTemplateUpdatePlan>} plan
 * @param {"apply"|"status"} mode
 * @returns {{ diagnostics: TemplateUpdateDiagnostic[], issues: string[], skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }> }}
 */
function analyzeTemplateUpdateApplication(options, plan, mode) {
  /** @type {Array<{ path: string, kind: "current-only", reason: string }>} */
  const skipped = [];
  /** @type {Array<{ path: string, reason: string }>} */
  const conflicts = [];
  /** @type {TemplateUpdateDiagnostic[]} */
  const diagnostics = [...plan.diagnostics];
  if (!plan.ok) {
    return {
      diagnostics,
      issues: issueMessagesFromDiagnostics(diagnostics),
      skipped,
      conflicts
    };
  }

  const baselineManifest = readTemplateFilesManifest(options.projectRoot);
  if (!baselineManifest) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_baseline_missing",
      message: `Cannot apply template update because ${TEMPLATE_FILES_MANIFEST} is missing. Review current template-owned files, then run 'topogram trust template' to record the baseline before applying template updates.`,
      path: path.join(options.projectRoot, TEMPLATE_FILES_MANIFEST),
      suggestedFix: "Review current template-owned files, then run `topogram trust template` to record the baseline before applying template updates.",
      step: "baseline"
    }));
  }
  const baselineByPath = new Map((baselineManifest?.files || []).map((file) => [file.path, file]));
  const currentHashes = currentTemplateOwnedFileHashes(options.projectRoot, options.projectConfig);
  for (const file of plan.files) {
    if (file.kind === "current-only") {
      skipped.push({
        path: file.path,
        kind: "current-only",
        reason: "Deletes are not applied by template update --apply in this milestone."
      });
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_current_only_skipped",
        severity: "warning",
        message: `Current-only file '${file.path}' needs manual delete review. Deletes are not applied by template update --apply in this milestone.`,
        path: path.join(options.projectRoot, file.path),
        suggestedFix: "Delete the file manually after review if it should be removed from this project.",
        step: mode
      }));
      continue;
    }
    if (file.kind !== "added" && file.kind !== "changed") {
      continue;
    }
    const baseline = baselineByPath.get(file.path) || null;
    const currentHash = currentHashes.get(file.path) || null;
    if (!fileMatchesBaseline(baseline, currentHash)) {
      const reason = baseline
        ? "Current file differs from the last trusted template-owned baseline."
        : "Current file is not part of the trusted template-owned baseline.";
      conflicts.push({
        path: file.path,
        reason
      });
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_update_conflict",
        message: `Template update conflict in '${file.path}': ${reason}`,
        path: path.join(options.projectRoot, file.path),
        suggestedFix: "Review local edits; keep them manually or refresh the baseline with `topogram trust template` after review.",
        step: "conflict-check"
      }));
    }
  }
  return {
    diagnostics,
    issues: issueMessagesFromDiagnostics(diagnostics),
    skipped,
    conflicts
  };
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @returns {{ ok: boolean, mode: "status", writes: false, current: ReturnType<typeof buildTemplateUpdatePlan>["current"], candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"], compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], applied: Array<{ path: string, kind: "added"|"changed" }>, skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }>, files: ReturnType<typeof buildTemplateUpdatePlan>["files"] }}
 */
export function buildTemplateUpdateStatus(options) {
  const plan = buildTemplateUpdatePlan(options);
  const analysis = analyzeTemplateUpdateApplication(options, plan, "status");
  const diagnostics = [...analysis.diagnostics];
  if (plan.ok && plan.files.length > 0) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_update_available",
      message: `Template update has ${plan.files.length} template-owned file change(s).`,
      path: options.projectRoot,
      suggestedFix: "Run `topogram template update --plan` to review, then `topogram template update --apply` after approval.",
      step: "status"
    }));
  }
  const issues = issueMessagesFromDiagnostics(diagnostics);
  return {
    ...plan,
    ok: issues.length === 0,
    mode: "status",
    writes: false,
    issues,
    diagnostics,
    applied: [],
    skipped: analysis.skipped,
    conflicts: analysis.conflicts
  };
}

/**
 * @param {string} projectRoot
 * @param {string} action
 * @returns {TemplateUpdateDiagnostic}
 */
function templateBaselineMissingDiagnostic(projectRoot, action) {
  return templateUpdateDiagnostic({
    code: "template_baseline_missing",
    message: `Cannot ${action} because ${TEMPLATE_FILES_MANIFEST} is missing. Review current template-owned files, then run 'topogram trust template' to record the baseline before applying template updates.`,
    path: path.join(projectRoot, TEMPLATE_FILES_MANIFEST),
    suggestedFix: "Review current template-owned files, then run `topogram trust template` to record the baseline before applying template updates.",
    step: "baseline"
  });
}

/**
 * @param {TemplateUpdateDiagnostic[]} diagnostics
 * @param {ReturnType<typeof buildTemplateUpdatePlan>|null} plan
 * @param {TemplateUpdateFileActionOptions["action"]} action
 * @param {string} relativePath
 * @param {Array<{ path: string, kind: "added"|"changed" }>} applied
 * @param {Array<{ path: string, kind: "accepted-current" }>} accepted
 * @param {Array<{ path: string, kind: "current-only" }>} deleted
 * @param {Array<{ path: string, reason: string }>} conflicts
 * @param {ReturnType<typeof currentTemplateMetadata>} [current]
 * @returns {{ ok: boolean, mode: TemplateUpdateFileActionOptions["action"], writes: boolean, current: ReturnType<typeof currentTemplateMetadata>, candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"]|null, compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], applied: Array<{ path: string, kind: "added"|"changed" }>, accepted: Array<{ path: string, kind: "accepted-current" }>, deleted: Array<{ path: string, kind: "current-only" }>, skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }>, files: ReturnType<typeof buildTemplateUpdatePlan>["files"], action: TemplateUpdateFileActionOptions["action"], path: string }}
 */
function templateUpdateFileActionResult(diagnostics, plan, action, relativePath, applied, accepted, deleted, conflicts, current = { id: null, version: null, source: null, sourceSpec: null, requested: null }) {
  const issues = issueMessagesFromDiagnostics(diagnostics);
  return {
    ...(plan || {}),
    ok: issues.length === 0,
    mode: action,
    writes: applied.length > 0 || accepted.length > 0 || deleted.length > 0,
    current: plan?.current || current,
    candidate: plan?.candidate || null,
    compatible: plan?.compatible || issues.length === 0,
    issues,
    diagnostics,
    summary: plan?.summary || { added: 0, changed: 0, currentOnly: 0, unchanged: 0 },
    applied,
    accepted,
    deleted,
    skipped: [],
    conflicts,
    files: plan?.files || [],
    action,
    path: relativePath
  };
}

/**
 * @param {TemplateUpdateFileActionOptions} options
 * @returns {{ ok: boolean, mode: "accept-current"|"accept-candidate"|"delete-current", writes: boolean, current: ReturnType<typeof currentTemplateMetadata>, candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"]|null, compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], applied: Array<{ path: string, kind: "added"|"changed" }>, accepted: Array<{ path: string, kind: "accepted-current" }>, deleted: Array<{ path: string, kind: "current-only" }>, skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }>, files: ReturnType<typeof buildTemplateUpdatePlan>["files"], action: "accept-current"|"accept-candidate"|"delete-current", path: string }}
 */
export function applyTemplateUpdateFileAction(options) {
  const relativePath = normalizeTemplateUpdateActionPath(options.filePath);
  /** @type {TemplateUpdateDiagnostic[]} */
  const diagnostics = [];
  /** @type {Array<{ path: string, kind: "added"|"changed" }>} */
  const applied = [];
  /** @type {Array<{ path: string, kind: "accepted-current" }>} */
  const accepted = [];
  /** @type {Array<{ path: string, kind: "current-only" }>} */
  const deleted = [];
  /** @type {Array<{ path: string, reason: string }>} */
  const conflicts = [];
  const baselineManifest = readTemplateFilesManifest(options.projectRoot);
  const current = currentTemplateMetadata(options.projectConfig);
  if (!baselineManifest) {
    diagnostics.push(templateBaselineMissingDiagnostic(options.projectRoot, options.action));
    return templateUpdateFileActionResult(diagnostics, null, options.action, relativePath, applied, accepted, deleted, conflicts, current);
  }

  if (options.action === "accept-current") {
    const currentHashes = currentTemplateOwnedFileHashes(options.projectRoot, options.projectConfig);
    const currentHash = currentHashes.get(relativePath) || null;
    if (!currentHash) {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_file_not_current",
        message: `Cannot accept current file '${relativePath}' because it is not a current template-owned file.`,
        path: path.join(options.projectRoot, relativePath),
        suggestedFix: "Pass a file under topo/, topogram.project.json, or trusted implementation/.",
        step: "accept-current"
      }));
      return templateUpdateFileActionResult(diagnostics, null, options.action, relativePath, applied, accepted, deleted, conflicts, current);
    }
    updateTemplateFilesManifestRecord(options.projectRoot, baselineManifest, relativePath, currentHash);
    accepted.push({ path: relativePath, kind: "accepted-current" });
    return templateUpdateFileActionResult(diagnostics, null, options.action, relativePath, applied, accepted, deleted, conflicts, current);
  }

  const plan = buildTemplateUpdatePlan(options);
  diagnostics.push(...plan.diagnostics);
  if (!plan.ok) {
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }
  const file = plan.files.find((item) => item.path === relativePath) || null;
  if (!file) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_file_unchanged",
      message: `Template-owned file '${relativePath}' has no candidate update action.`,
      path: path.join(options.projectRoot, relativePath),
      suggestedFix: "Run `topogram template update --status` to see files that need adoption.",
      step: options.action
    }));
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }

  const baselineByPath = new Map(baselineManifest.files.map((record) => [record.path, record]));
  const currentHashes = currentTemplateOwnedFileHashes(options.projectRoot, options.projectConfig);
  const baseline = baselineByPath.get(relativePath) || null;
  const currentHash = currentHashes.get(relativePath) || null;

  if (options.action === "delete-current") {
    if (file.kind !== "current-only") {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_delete_not_current_only",
        message: `Cannot delete '${relativePath}' because it is not a current-only template-owned file.`,
        path: path.join(options.projectRoot, relativePath),
        suggestedFix: "Use delete-current only for files the candidate template removed.",
        step: "delete-current"
      }));
      return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
    }
    if (!fileMatchesBaseline(baseline, currentHash)) {
      const reason = baseline
        ? "Current file differs from the last trusted template-owned baseline."
        : "Current file is not part of the trusted template-owned baseline.";
      conflicts.push({ path: relativePath, reason });
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_update_conflict",
        message: `Template delete conflict in '${relativePath}': ${reason}`,
        path: path.join(options.projectRoot, relativePath),
        suggestedFix: "Review local edits before deleting, or accept current as the new baseline.",
        step: "delete-current"
      }));
      return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
    }
    fs.rmSync(path.join(options.projectRoot, relativePath));
    updateTemplateFilesManifestRecord(options.projectRoot, baselineManifest, relativePath, null);
    deleted.push({ path: relativePath, kind: "current-only" });
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }

  if (file.kind !== "added" && file.kind !== "changed") {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_candidate_not_applicable",
      message: `Cannot accept candidate for '${relativePath}' because the candidate has no added or changed file.`,
      path: path.join(options.projectRoot, relativePath),
      suggestedFix: "Use accept-candidate only for added or changed candidate files.",
      step: "accept-candidate"
    }));
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }
  if (file.kind === "changed" && !fileMatchesBaseline(baseline, currentHash)) {
    const reason = baseline
      ? "Current file differs from the last trusted template-owned baseline."
      : "Current file is not part of the trusted template-owned baseline.";
    conflicts.push({ path: relativePath, reason });
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_update_conflict",
      message: `Template candidate conflict in '${relativePath}': ${reason}`,
      path: path.join(options.projectRoot, relativePath),
      suggestedFix: "Review local edits before accepting the candidate file.",
      step: "accept-candidate"
    }));
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }
  const currentTemplate = options.projectConfig.template || {};
  const templateSpec = options.templateName || currentTemplate.sourceSpec || currentTemplate.requested || currentTemplate.id;
  const candidateTemplate = resolveTemplate(templateSpec, options.templatesRoot);
  const candidateFile = candidateTemplateFiles(candidateTemplate, options.projectConfig).get(relativePath);
  if (!candidateFile) {
    throw new Error(`Cannot accept missing candidate template file: ${relativePath}`);
  }
  writeCandidateFile(candidateFile, path.join(options.projectRoot, relativePath));
  const nextHash = fileHash({
    absolutePath: path.join(options.projectRoot, relativePath),
    content: null
  });
  updateTemplateFilesManifestRecord(options.projectRoot, baselineManifest, relativePath, {
    path: relativePath,
    sha256: nextHash.sha256,
    size: nextHash.size
  });
  applied.push({ path: relativePath, kind: file.kind });
  return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @returns {{ ok: boolean, mode: "apply", writes: boolean, current: ReturnType<typeof buildTemplateUpdatePlan>["current"], candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"], compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], applied: Array<{ path: string, kind: "added"|"changed" }>, skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }>, files: ReturnType<typeof buildTemplateUpdatePlan>["files"] }}
 */
export function applyTemplateUpdate(options) {
  const plan = buildTemplateUpdatePlan(options);
  /** @type {Array<{ path: string, kind: "added"|"changed" }>} */
  const applied = [];
  const analysis = analyzeTemplateUpdateApplication(options, plan, "apply");
  const { diagnostics, issues, skipped, conflicts } = analysis;
  if (!plan.ok || issues.length > 0) {
    return {
      ...plan,
      ok: false,
      mode: "apply",
      writes: false,
      applied,
      skipped,
      conflicts,
      issues,
      diagnostics
    };
  }

  const currentTemplate = options.projectConfig.template || {};
  const templateSpec = options.templateName || currentTemplate.sourceSpec || currentTemplate.requested || currentTemplate.id;
  const candidateTemplate = resolveTemplate(templateSpec, options.templatesRoot);
  const candidateFiles = candidateTemplateFiles(candidateTemplate, options.projectConfig);
  for (const file of plan.files) {
    if (file.kind !== "added" && file.kind !== "changed") {
      continue;
    }
    const candidateFile = candidateFiles.get(file.path);
    if (!candidateFile) {
      throw new Error(`Cannot apply missing candidate template file: ${file.path}`);
    }
    writeCandidateFile(candidateFile, path.join(options.projectRoot, file.path));
    applied.push({ path: file.path, kind: file.kind });
  }

  if (applied.length > 0) {
    const nextProjectConfig = JSON.parse(fs.readFileSync(path.join(options.projectRoot, "topogram.project.json"), "utf8"));
    writeTemplateFilesManifest(options.projectRoot, nextProjectConfig);
    if (nextProjectConfig.implementation) {
      writeTemplateTrustRecord(options.projectRoot, nextProjectConfig);
    }
  }
  return {
    ...plan,
    ok: true,
    mode: "apply",
    writes: applied.length > 0,
    issues,
    diagnostics,
    applied,
    skipped,
    conflicts
  };
}
