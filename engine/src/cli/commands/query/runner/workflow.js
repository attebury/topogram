// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../../../format.js";
import { parsePath } from "../../../../parser.js";
import { resolveWorkspace } from "../../../../resolver.js";
import {
  buildImportPlanPayload,
  buildResolvedWorkflowContextPayload,
  buildSingleAgentPlanPayload,
  buildWorkflowPresetActivationPayload,
  buildWorkflowPresetCustomizationPayload,
  buildWorkflowPresetDiffPayload,
  buildWorkflowPresetState
} from "../../../../agent-ops/query-builders.js";
import {
  adoptionPlanPath,
  artifactOrNull,
  buildMaintainedBundle,
  buildSlice,
  buildTaskMode,
  generatorTargetsForWorkflowContext,
  hasSelectors,
  normalizeTopogramPath,
  printValidationFailure,
  readJson,
  resultOk,
  selectorOptions,
  workflowPresetSelectors
} from "../workspace.js";
import { resolveRecommendedQueryFamily } from "../workflow-context.js";
import { printJson } from "./output.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} context
 * @returns {number|null}
 */
export function runWorkflowQuery(context) {
  const queryName = context.commandArgs?.queryName;
  const selectors = selectorOptions(context);

  if (queryName === "next-action") {
    const result = buildTaskMode(parsePath(context.inputPath), selectors, context.modeId || "extract-adopt", context.fromTopogramPath);
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson({
      type: "next_action_query",
      mode: result.artifact.mode,
      summary: result.artifact.summary || null,
      next_action: result.artifact.next_action || null,
      recommended_query_family: resolveRecommendedQueryFamily(result.artifact.next_action || null, result.artifact.mode),
      immediate_artifacts: (result.artifact.preferred_context_artifacts || []).slice(0, 2),
      preferred_context_artifacts: result.artifact.preferred_context_artifacts || [],
      review_emphasis: result.artifact.review_emphasis || [],
      write_scope: result.artifact.write_scope || null,
      verification_targets: result.artifact.verification_targets || null
    });
  }

  if (queryName === "single-agent-plan") {
    return runSingleAgentPlan(context, selectors);
  }

  if (queryName === "resolved-workflow-context") {
    return runResolvedWorkflowContext(context, selectors);
  }

  if (queryName === "workflow-preset-activation") {
    if (!context.modeId) {
      throw new Error("query workflow-preset-activation requires --mode <modeling|maintained-app-edit|extract-adopt|diff-review|verification>.");
    }
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const taskModeResult = buildTaskMode(parsePath(context.inputPath), selectors, context.modeId, context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    let importPlan = null;
    if (context.modeId === "extract-adopt" && fs.existsSync(adoptionPlanPath(topogramRoot))) {
      const workflowPresets = buildWorkflowPresetState({
        workspace: topogramRoot,
        selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, "workflow-preset-activation")
      });
      importPlan = buildImportPlanPayload(readJson(adoptionPlanPath(topogramRoot)), taskModeResult.artifact, null, workflowPresets);
    }
    return printJson(buildWorkflowPresetActivationPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, "workflow-preset-activation")
    }));
  }

  if (queryName === "workflow-preset-diff") {
    if (!context.providerId) {
      throw new Error("query workflow-preset-diff requires --provider <id>.");
    }
    return printJson(buildWorkflowPresetDiffPayload({
      workspace: normalizeTopogramPath(context.inputPath),
      providerId: context.providerId,
      presetId: context.presetId
    }));
  }

  if (queryName === "workflow-preset-customization" || context.commandArgs?.workflowPresetCommand === "customize") {
    return runWorkflowPresetCustomization(context, queryName);
  }

  return null;
}

/**
 * @param {AnyRecord} context
 * @param {AnyRecord} selectors
 * @returns {number}
 */
function runSingleAgentPlan(context, selectors) {
  if (!context.modeId) {
    throw new Error("query single-agent-plan requires --mode <modeling|maintained-app-edit|extract-adopt|diff-review|verification>.");
  }
  const ast = parsePath(context.inputPath);
  const result = buildTaskMode(ast, selectors, context.modeId, context.fromTopogramPath);
  if (!resultOk(result)) return printValidationFailure(result);
  const sliceResult = hasSelectors(context) ? buildSlice(ast, selectors) : null;
  if (sliceResult && !resultOk(sliceResult)) return printValidationFailure(sliceResult);
  const resolved = resolveWorkspace(ast);
  if (!resultOk(resolved)) return printValidationFailure(resolved);
  const generatorTargets = generatorTargetsForWorkflowContext({
    graph: resolved.graph,
    taskModeArtifact: result.artifact,
    sliceArtifact: artifactOrNull(sliceResult)
  });
  const topogramRoot = normalizeTopogramPath(context.inputPath);
  let importPlan = null;
  if (context.modeId === "extract-adopt" && fs.existsSync(adoptionPlanPath(topogramRoot))) {
    const workflowPresets = buildWorkflowPresetState({
      workspace: topogramRoot,
      selectors: workflowPresetSelectors(result.artifact, context.providerId, context.presetId, "single-agent-plan")
    });
    importPlan = buildImportPlanPayload(readJson(adoptionPlanPath(topogramRoot)), result.artifact, null, workflowPresets);
  }
  const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
    workspace: topogramRoot,
    taskModeArtifact: result.artifact,
    generatorTargets,
    selectors: workflowPresetSelectors(result.artifact, context.providerId, context.presetId, "single-agent-plan"),
    importPlan
  });
  return printJson(buildSingleAgentPlanPayload({
    workspace: topogramRoot,
    taskModeArtifact: result.artifact,
    importPlan,
    resolvedWorkflowContext
  }));
}

/**
 * @param {AnyRecord} context
 * @param {AnyRecord} selectors
 * @returns {number}
 */
function runResolvedWorkflowContext(context, selectors) {
  if (!context.modeId) {
    throw new Error("query resolved-workflow-context requires --mode <modeling|maintained-app-edit|extract-adopt|diff-review|verification>.");
  }
  const topogramRoot = normalizeTopogramPath(context.inputPath);
  const ast = parsePath(context.inputPath);
  const taskModeResult = buildTaskMode(ast, selectors, context.modeId, context.fromTopogramPath);
  if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
  const resolved = resolveWorkspace(ast);
  if (!resultOk(resolved)) return printValidationFailure(resolved);
  const sliceResult = hasSelectors(context) ? buildSlice(ast, selectors) : null;
  if (sliceResult && !resultOk(sliceResult)) return printValidationFailure(sliceResult);
  const includeMaintainedBoundary =
    context.modeId === "maintained-app-edit" ||
    context.surfaceId === "maintained-boundary" ||
    context.fromTopogramPath;
  const maintainedBundleResult = includeMaintainedBoundary ? buildMaintainedBundle(ast) : null;
  if (maintainedBundleResult && !resultOk(maintainedBundleResult)) return printValidationFailure(maintainedBundleResult);
  const generatorTargets = generatorTargetsForWorkflowContext({
    graph: resolved.graph,
    taskModeArtifact: taskModeResult.artifact,
    sliceArtifact: artifactOrNull(sliceResult),
    maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
  });
  let importPlan = null;
  if (context.modeId === "extract-adopt" && fs.existsSync(adoptionPlanPath(topogramRoot))) {
    const workflowPresets = buildWorkflowPresetState({
      workspace: topogramRoot,
      selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, "resolved-workflow-context")
    });
    importPlan = buildImportPlanPayload(
      readJson(adoptionPlanPath(topogramRoot)),
      taskModeResult.artifact,
      maintainedBundleResult?.artifact?.maintained_boundary || null,
      workflowPresets
    );
  }
  return printJson(buildResolvedWorkflowContextPayload({
    workspace: topogramRoot,
    taskModeArtifact: taskModeResult.artifact,
    importPlan,
    reviewBoundary: sliceResult?.artifact?.review_boundary || null,
    maintainedBoundary: maintainedBundleResult?.artifact?.maintained_boundary || null,
    generatorTargets,
    selectors: workflowPresetSelectors(taskModeResult.artifact, context.providerId, context.presetId, "resolved-workflow-context")
  }));
}

/**
 * @param {AnyRecord} context
 * @param {string|undefined} queryName
 * @returns {number}
 */
function runWorkflowPresetCustomization(context, queryName) {
  if (!context.providerId || !context.presetId) {
    throw new Error(`${queryName ? "query workflow-preset-customization" : "workflow-preset customize"} requires --provider <id> and --preset <id>.`);
  }
  const topogramRoot = normalizeTopogramPath(context.inputPath);
  const payload = buildWorkflowPresetCustomizationPayload({
    workspace: topogramRoot,
    providerId: context.providerId,
    presetId: context.presetId
  });
  if (queryName === "workflow-preset-customization" || !context.shouldWrite) {
    return printJson(payload);
  }
  const targetPath = path.resolve(topogramRoot, context.outPath || payload.recommended_local_path);
  if (fs.existsSync(targetPath)) {
    throw new Error(`Refusing to overwrite existing workflow preset customization at '${targetPath}'.`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${stableStringify(payload.customization_template)}\n`);
  return printJson({
    ...payload,
    written: true,
    written_path: targetPath
  });
}
