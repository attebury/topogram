// @ts-check

import fs from "node:fs";

import {
  buildImportPlanPayload,
  buildMultiAgentPlanPayload,
  buildResolvedWorkflowContextPayload,
  buildSingleAgentPlanPayload,
  buildWorkflowPresetState
} from "../../../agent-ops/query-builders.js";
import { parsePath } from "../../../parser.js";
import {
  adoptionPlanPath,
  buildMaintainedBundle,
  buildTaskMode,
  normalizeTopogramPath,
  readJson,
  requireReconcileArtifacts,
  resultOk,
  workflowPresetSelectors
} from "./workspace.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} context
 * @param {string} queryFamily
 * @returns {AnyRecord}
 */
export function buildImportPlanForContext(context, queryFamily) {
  const topogramRoot = normalizeTopogramPath(context.inputPath);
  const planPath = adoptionPlanPath(topogramRoot);
  if (!fs.existsSync(planPath)) {
    throw new Error(`No agent adoption plan found at '${planPath}'`);
  }
  const adoptionPlan = readJson(planPath);
  const ast = parsePath(context.inputPath);
  const taskModeResult = buildTaskMode(ast, {}, "extract-adopt");
  if (!resultOk(taskModeResult)) {
    return taskModeResult;
  }
  const maintainedBundleResult = buildMaintainedBundle(ast);
  if (!resultOk(maintainedBundleResult)) {
    return maintainedBundleResult;
  }
  const workflowPresets = buildWorkflowPresetState({
    workspace: topogramRoot,
    selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, queryFamily)
  });
  return {
    ok: true,
    topogramRoot,
    taskModeResult,
    maintainedBundleResult,
    adoptionPlan,
    importPlan: buildImportPlanPayload(
      adoptionPlan,
      taskModeResult.artifact,
      maintainedBundleResult.artifact.maintained_boundary || null,
      workflowPresets
    )
  };
}

/**
 * @param {AnyRecord} context
 * @param {string} queryFamily
 * @returns {AnyRecord}
 */
export function buildImportAdoptAgentContext(context, queryFamily) {
  const topogramRoot = normalizeTopogramPath(context.inputPath);
  const artifacts = requireReconcileArtifacts(topogramRoot, queryFamily);
  const ast = parsePath(context.inputPath);
  const taskModeResult = buildTaskMode(ast, {}, "extract-adopt");
  if (!resultOk(taskModeResult)) {
    return taskModeResult;
  }
  const adoptionPlanArtifact = readJson(artifacts.adoptionPlanPath);
  const reconcileReport = readJson(artifacts.reportPath);
  const adoptionStatus = readJson(artifacts.adoptionStatusPath);
  const workflowPresets = buildWorkflowPresetState({
    workspace: topogramRoot,
    selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, queryFamily)
  });
  const importPlan = buildImportPlanPayload(adoptionPlanArtifact, taskModeResult.artifact, null, workflowPresets);
  const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
    workspace: topogramRoot,
    taskModeArtifact: taskModeResult.artifact,
    importPlan,
    selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, queryFamily)
  });
  const singleAgentPlan = buildSingleAgentPlanPayload({
    workspace: topogramRoot,
    taskModeArtifact: taskModeResult.artifact,
    importPlan,
    resolvedWorkflowContext
  });
  const multiAgentPlan = buildMultiAgentPlanPayload({
    workspace: topogramRoot,
    singleAgentPlan,
    importPlan,
    report: reconcileReport,
    adoptionStatus,
    resolvedWorkflowContext
  });
  return {
    ok: true,
    topogramRoot,
    taskModeResult,
    adoptionPlanArtifact,
    reconcileReport,
    adoptionStatus,
    importPlan,
    resolvedWorkflowContext,
    singleAgentPlan,
    multiAgentPlan
  };
}
