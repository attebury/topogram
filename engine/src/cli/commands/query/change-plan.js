// @ts-check

import { buildMaintainedRiskSummary, buildChangePlanPayload, summarizeDiffArtifact } from "../../../agent-ops/query-builders.js";
import { parsePath } from "../../../parser.js";
import { resolveWorkspace } from "../../../resolver.js";
import {
  artifactOrNull,
  buildDiff,
  buildMaintainedBundle,
  buildSlice,
  buildTaskMode,
  hasSelectors,
  resultOk,
  selectorOptions
} from "./workspace.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} context
 * @param {string} defaultMode
 * @returns {{ ast: AnyRecord, resolved: AnyRecord, taskModeResult: AnyRecord, sliceResult: AnyRecord|null, diffResult: AnyRecord|null, maintainedBundleResult: AnyRecord|null, changePlan: AnyRecord, diffSummary: AnyRecord|null, maintainedRisk: AnyRecord }}
 */
export function buildChangePlanContext(context, defaultMode = "modeling") {
  const ast = parsePath(context.inputPath);
  const resolved = resolveWorkspace(ast);
  if (!resultOk(resolved)) {
    return /** @type {any} */ ({ ast, resolved });
  }
  const selectors = selectorOptions(context);
  const effectiveModeId = context.modeId || defaultMode;
  const taskModeResult = buildTaskMode(ast, selectors, effectiveModeId, context.fromTopogramPath);
  if (!resultOk(taskModeResult)) {
    return /** @type {any} */ ({ ast, resolved, taskModeResult });
  }
  const sliceResult = hasSelectors(context) ? buildSlice(ast, selectors) : null;
  if (sliceResult && !resultOk(sliceResult)) {
    return /** @type {any} */ ({ ast, resolved, taskModeResult, sliceResult });
  }
  const diffResult = buildDiff(ast, context.fromTopogramPath);
  if (diffResult && !resultOk(diffResult)) {
    return /** @type {any} */ ({ ast, resolved, taskModeResult, sliceResult, diffResult });
  }
  const includeMaintainedBoundary =
    effectiveModeId === "maintained-app-edit" ||
    context.surfaceId === "maintained-boundary" ||
    Boolean(diffResult?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact);
  const maintainedBundleResult = includeMaintainedBoundary ? buildMaintainedBundle(ast) : null;
  if (maintainedBundleResult && !resultOk(maintainedBundleResult)) {
    return /** @type {any} */ ({ ast, resolved, taskModeResult, sliceResult, diffResult, maintainedBundleResult });
  }
  const changePlan = buildChangePlanPayload({
    graph: resolved.graph,
    taskModeArtifact: taskModeResult.artifact,
    sliceArtifact: artifactOrNull(sliceResult),
    diffArtifact: artifactOrNull(diffResult),
    maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
  });
  const diffSummary = changePlan.diff_summary || summarizeDiffArtifact(diffResult?.artifact || null);
  const maintainedRisk = buildMaintainedRiskSummary({
    maintainedImpacts: changePlan.maintained_impacts,
    maintainedBoundary: changePlan.maintained_boundary,
    diffSummary
  });
  return { ast, resolved, taskModeResult, sliceResult, diffResult, maintainedBundleResult, changePlan, diffSummary, maintainedRisk };
}
