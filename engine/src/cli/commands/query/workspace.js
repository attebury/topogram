// @ts-check

import fs from "node:fs";
import path from "node:path";

import { generateWorkspace } from "../../../generator.js";
import { formatValidationErrors } from "../../../validator.js";
import { buildChangePlanPayload } from "../../../agent-ops/query-builders.js";
import { buildExtractionContext, readExtractionContext } from "../../../extraction-context.js";
import { resolveTopoRoot } from "../../../workspace-paths.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeTopogramPath(inputPath) {
  return resolveTopoRoot(inputPath);
}

/**
 * @param {AnyRecord} taskModeArtifact
 * @param {string|null} providerId
 * @param {string|null} presetId
 * @param {string|null} queryFamily
 * @returns {AnyRecord}
 */
export function workflowPresetSelectors(taskModeArtifact, providerId = null, presetId = null, queryFamily = null) {
  const categories = [];
  if (taskModeArtifact?.mode === "extract-adopt") categories.push("provider_adoption");
  if (taskModeArtifact?.mode === "maintained-app-edit") categories.push("maintained_app");
  if ((taskModeArtifact?.verification_targets?.maintained_app_checks || []).length > 0) categories.push("maintained_boundary");
  return {
    mode: taskModeArtifact?.mode || null,
    task_class: taskModeArtifact?.mode || null,
    provider_id: providerId,
    preset_id: presetId,
    query_family: queryFamily,
    integration_categories: categories
  };
}

/**
 * @param {AnyRecord} options
 * @returns {AnyRecord[]}
 */
export function generatorTargetsForWorkflowContext(options = {}) {
  const { graph, taskModeArtifact, sliceArtifact = null, diffArtifact = null, maintainedBoundaryArtifact = null } = options;
  if (!graph || !taskModeArtifact) {
    return [];
  }
  return buildChangePlanPayload({
    graph,
    taskModeArtifact,
    sliceArtifact,
    diffArtifact,
    maintainedBoundaryArtifact
  }).generator_targets || [];
}

/**
 * @param {AnyRecord} options
 * @returns {boolean}
 */
export function importAdoptOnlyRequested(options = {}) {
  return options.modeId === "extract-adopt" && !(
    options.capabilityId ||
    options.workflowId ||
    options.projectionId ||
    options.componentId ||
    options.entityId ||
    options.journeyId ||
    options.surfaceId ||
    options.domainId ||
    options.pitchId ||
    options.requirementId ||
    options.acceptanceId ||
    options.taskId ||
    options.planId ||
    options.bugId ||
    options.documentId ||
    options.fromTopogramPath
  );
}

/**
 * @param {AnyRecord} result
 * @returns {boolean}
 */
export function resultOk(result) {
  return Boolean(result?.ok);
}

/**
 * @param {AnyRecord} result
 * @returns {number}
 */
export function printValidationFailure(result) {
  console.error(formatValidationErrors(result.validation));
  return 1;
}

/**
 * @param {AnyRecord} ast
 * @param {AnyRecord} selectors
 * @param {string} modeId
 * @param {string|null} fromTopogramPath
 * @returns {AnyRecord}
 */
export function buildTaskMode(ast, selectors, modeId, fromTopogramPath = null) {
  return generateWorkspace(ast, {
    target: "context-task-mode",
    modeId,
    ...selectors,
    widgetId: selectors.componentId,
    fromTopogramPath
  });
}

/**
 * @param {AnyRecord} ast
 * @param {AnyRecord} selectors
 * @returns {AnyRecord}
 */
export function buildSlice(ast, selectors) {
  return generateWorkspace(ast, {
    target: "context-slice",
    ...selectors,
    widgetId: selectors.componentId
  });
}

/**
 * @param {AnyRecord} ast
 * @returns {AnyRecord}
 */
export function buildMaintainedBundle(ast) {
  return generateWorkspace(ast, {
    target: "context-bundle",
    taskId: "maintained-app"
  });
}

/**
 * @param {AnyRecord} ast
 * @param {string|null} fromTopogramPath
 * @returns {AnyRecord|null}
 */
export function buildDiff(ast, fromTopogramPath) {
  return fromTopogramPath
    ? generateWorkspace(ast, {
        target: "context-diff",
        fromTopogramPath
      })
    : null;
}

/**
 * @param {AnyRecord|null} result
 * @returns {AnyRecord|null}
 */
export function artifactOrNull(result) {
  return result?.artifact || null;
}

/**
 * @param {string} topogramRoot
 * @returns {string}
 */
export function adoptionPlanPath(topogramRoot) {
  return path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
}

/**
 * @param {string} topogramRoot
 * @param {string} label
 * @returns {{ reportPath: string, adoptionStatusPath: string, adoptionPlanPath: string }}
 */
export function requireReconcileArtifacts(topogramRoot, label) {
  const reportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
  const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
  const planPath = adoptionPlanPath(topogramRoot);
  if (!fs.existsSync(reportPath) || !fs.existsSync(adoptionStatusPath) || !fs.existsSync(planPath)) {
    throw new Error(`No reconcile ${label} artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
  }
  return { reportPath, adoptionStatusPath, adoptionPlanPath: planPath };
}

/**
 * @param {string} filePath
 * @returns {AnyRecord}
 */
export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export { buildExtractionContext, readExtractionContext };

/**
 * @param {AnyRecord} options
 * @returns {boolean}
 */
export function hasSelectors(options) {
  return Boolean(
    options.capabilityId ||
    options.workflowId ||
    options.projectionId ||
    options.componentId ||
    options.entityId ||
    options.journeyId ||
    options.surfaceId ||
    options.domainId ||
    options.pitchId ||
    options.requirementId ||
    options.acceptanceId ||
    options.taskId ||
    options.planId ||
    options.bugId ||
    options.documentId
  );
}

/**
 * @param {AnyRecord} options
 * @returns {boolean}
 */
export function shouldUseImportAdoptPath(options) {
  const selectorOrDiff = hasSelectors(options) || Boolean(options.fromTopogramPath);
  return importAdoptOnlyRequested(options) || (!selectorOrDiff && !options.modeId);
}

/**
 * @param {AnyRecord} options
 * @returns {AnyRecord}
 */
export function selectorOptions(options) {
  return {
    capabilityId: options.capabilityId,
    workflowId: options.workflowId,
    projectionId: options.projectionId,
    componentId: options.componentId,
    entityId: options.entityId,
    journeyId: options.journeyId,
    surfaceId: options.surfaceId,
    domainId: options.domainId,
    pitchId: options.pitchId,
    requirementId: options.requirementId,
    acceptanceId: options.acceptanceId,
    taskId: options.taskId,
    planId: options.planId,
    bugId: options.bugId,
    documentId: options.documentId
  };
}

/**
 * @param {AnyRecord} nextAction
 * @param {string|null} mode
 * @returns {string}
 */
export function resolveRecommendedQueryFamily(nextAction, mode) {
  switch (nextAction?.kind) {
    case "review_staged":
    case "review_bundle":
    case "inspect_review_group":
    case "inspect_proposal_surface":
    case "customize_workflow_preset":
    case "refresh_workflow_preset_customization":
    case "import_declared_workflow_preset":
      return "extract-plan";
    case "review_diff_impact":
    case "inspect_projection":
    case "inspect_diff":
    case "review_diff_boundaries":
      return "change-plan";
    case "inspect_maintained_impact":
    case "inspect_boundary_before_edit":
    case "run_maintained_checks":
      return "maintained-boundary";
    case "inspect_verification_targets":
      return "verification-targets";
    case "inspect_workspace_digest":
      return "single-agent-plan";
    default:
      break;
  }
  if (mode === "extract-adopt") return "extract-plan";
  if (mode === "maintained-app-edit") return "maintained-boundary";
  if (mode === "verification") return "verification-targets";
  return "change-plan";
}
