// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../../format.js";
import { loadProjectConfig } from "../../../project-config.js";
import {
  applyTemplateUpdate,
  applyTemplateUpdateFileAction,
  buildTemplateUpdateCheck,
  buildTemplateUpdatePlan,
  buildTemplateUpdateStatus
} from "../../../new-project.js";
import { TEMPLATES_ROOT } from "./constants.js";
import { templateCheckDiagnostic } from "./diagnostics.js";
import { latestTemplateInfo, messageFromError, templateMetadataFromProjectConfig } from "./shared.js";

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
