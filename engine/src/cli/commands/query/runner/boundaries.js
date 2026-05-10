// @ts-check

import { recommendedVerificationTargets } from "../../../../generator/context/shared.js";
import { parsePath } from "../../../../parser.js";
import { resolveWorkspace } from "../../../../resolver.js";
import {
  buildMaintainedConformancePayload,
  buildMaintainedDriftPayload,
  buildSeamCheckPayload
} from "../../../../agent-ops/query-builders.js";
import {
  artifactOrNull,
  buildDiff,
  buildMaintainedBundle,
  buildSlice,
  buildTaskMode,
  hasSelectors,
  printValidationFailure,
  resultOk,
  selectorOptions
} from "../workspace.js";
import { printJson } from "./output.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} context
 * @returns {number|null}
 */
export function runBoundaryQuery(context) {
  const queryName = context.commandArgs?.queryName;
  const selectors = selectorOptions(context);

  if (queryName === "maintained-drift") {
    if (!context.fromTopogramPath) {
      throw new Error("query maintained-drift requires --from-topogram <path>.");
    }
    const ast = parsePath(context.inputPath);
    const diffResult = buildDiff(ast, context.fromTopogramPath);
    if (diffResult && !resultOk(diffResult)) return printValidationFailure(diffResult);
    const maintainedBundleResult = buildMaintainedBundle(ast);
    if (!resultOk(maintainedBundleResult)) return printValidationFailure(maintainedBundleResult);
    const taskModeResult = buildTaskMode(ast, {}, "diff-review", context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    return printJson(buildMaintainedDriftPayload({
      diffArtifact: diffResult?.artifact || null,
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null
    }));
  }

  if (queryName === "maintained-conformance") {
    const ast = parsePath(context.inputPath);
    const resolved = resolveWorkspace(ast);
    if (!resultOk(resolved)) return printValidationFailure(resolved);
    const diffResult = buildDiff(ast, context.fromTopogramPath);
    if (diffResult && !resultOk(diffResult)) return printValidationFailure(diffResult);
    const maintainedBundleResult = buildMaintainedBundle(ast);
    if (!resultOk(maintainedBundleResult)) return printValidationFailure(maintainedBundleResult);
    const taskModeResult = buildTaskMode(ast, {}, context.fromTopogramPath ? "diff-review" : "verification", context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    return printJson(buildMaintainedConformancePayload({
      graph: resolved.graph,
      diffArtifact: artifactOrNull(diffResult),
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null
    }));
  }

  if (queryName === "seam-check") {
    const ast = parsePath(context.inputPath);
    const resolved = resolveWorkspace(ast);
    if (!resultOk(resolved)) return printValidationFailure(resolved);
    const diffResult = buildDiff(ast, context.fromTopogramPath);
    if (diffResult && !resultOk(diffResult)) return printValidationFailure(diffResult);
    const maintainedBundleResult = buildMaintainedBundle(ast);
    if (!resultOk(maintainedBundleResult)) return printValidationFailure(maintainedBundleResult);
    const taskModeResult = buildTaskMode(ast, {}, context.fromTopogramPath ? "diff-review" : "verification", context.fromTopogramPath);
    if (!resultOk(taskModeResult)) return printValidationFailure(taskModeResult);
    return printJson(buildSeamCheckPayload({
      graph: resolved.graph,
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      diffArtifact: artifactOrNull(diffResult),
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null,
      seamId: context.seamId
    }));
  }

  if (queryName === "review-boundary") {
    const result = buildSlice(parsePath(context.inputPath), selectors);
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson({
      type: "review_boundary_query",
      focus: result.artifact.focus,
      review_boundary: result.artifact.review_boundary,
      ownership_boundary: result.artifact.ownership_boundary,
      write_scope: result.artifact.write_scope || null,
      verification_targets: result.artifact.verification_targets || null
    });
  }

  if (queryName === "write-scope") {
    return runWriteScopeQuery(context, selectors);
  }

  if (queryName === "verification-targets") {
    return runVerificationTargetsQuery(context, selectors);
  }

  return null;
}

/**
 * @param {AnyRecord} context
 * @param {AnyRecord} selectors
 * @returns {number}
 */
function runWriteScopeQuery(context, selectors) {
  const ast = parsePath(context.inputPath);
  if (context.modeId || (!hasSelectors(context) && !context.fromTopogramPath)) {
    const result = buildTaskMode(ast, selectors, context.modeId || "verification", context.fromTopogramPath);
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson({
      type: "write_scope_query",
      source: "context-task-mode",
      mode: result.artifact.mode,
      summary: result.artifact.summary || null,
      rationale: "Task mode write scope is the safest file-boundary contract for the selected operating mode.",
      write_scope: result.artifact.write_scope || null
    });
  }
  if (context.surfaceId === "maintained-boundary") {
    const result = buildMaintainedBundle(ast);
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson({
      type: "write_scope_query",
      source: "maintained-boundary",
      summary: {
        maintained_file_count: (result.artifact.maintained_boundary?.maintained_files_in_scope || []).length
      },
      rationale: "Maintained-boundary write scope isolates the human-owned application files currently in scope.",
      write_scope: result.artifact.write_scope || null
    });
  }
  const result = buildSlice(ast, selectors);
  if (!resultOk(result)) return printValidationFailure(result);
  return printJson({
    type: "write_scope_query",
    source: "context-slice",
    focus: result.artifact.focus,
    summary: result.artifact.summary || null,
    rationale: "Slice write scope is the narrowest file-boundary contract attached to the selected semantic surface.",
    write_scope: result.artifact.write_scope || null
  });
}

/**
 * @param {AnyRecord} context
 * @param {AnyRecord} selectors
 * @returns {number}
 */
function runVerificationTargetsQuery(context, selectors) {
  const ast = parsePath(context.inputPath);
  if (context.modeId || (!hasSelectors(context) && !context.fromTopogramPath)) {
    const result = buildTaskMode(ast, selectors, context.modeId || "verification", context.fromTopogramPath);
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson({
      type: "verification_targets_query",
      source: "context-task-mode",
      mode: result.artifact.mode,
      summary: result.artifact.summary || null,
      verification_targets: result.artifact.verification_targets || null
    });
  }
  if (context.fromTopogramPath) {
    const resolved = resolveWorkspace(ast);
    if (!resultOk(resolved)) return printValidationFailure(resolved);
    const result = buildDiff(ast, context.fromTopogramPath);
    if (result && !resultOk(result)) return printValidationFailure(result);
    const affectedVerificationIds = (result?.artifact?.affected_verifications || []).map((/** @type {AnyRecord} */ item) => item.id);
    const verificationTargets = recommendedVerificationTargets(resolved.graph, affectedVerificationIds, {
      includeMaintainedApp: Boolean(result?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact),
      rationale: "Diff verification targets should cover the affected semantic proof set and any maintained-app proof gates."
    });
    return printJson({
      type: "verification_targets_query",
      source: "context-diff",
      summary: {
        baseline_root: result?.artifact?.baseline_root,
        affected_verification_count: affectedVerificationIds.length,
        maintained_code_impact: Boolean(result?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact)
      },
      verification_targets: verificationTargets,
      affected_verifications: result?.artifact?.affected_verifications || []
    });
  }
  const result = buildSlice(ast, selectors);
  if (!resultOk(result)) return printValidationFailure(result);
  return printJson({
    type: "verification_targets_query",
    source: "context-slice",
    focus: result.artifact.focus,
    summary: result.artifact.summary || null,
    verification_targets: result.artifact.verification_targets || null
  });
}
