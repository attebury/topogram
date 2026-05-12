// @ts-check

import fs from "node:fs";

import {
  buildCanonicalWritesPayloadForChangePlan,
  buildCanonicalWritesPayloadForImportPlan,
  buildResolvedWorkflowContextPayload,
  buildReviewPacketPayloadForChangePlan,
  buildReviewPacketPayloadForImportPlan,
  buildRiskSummaryPayload,
  classifyRisk,
  proceedDecisionFromRisk
} from "../../../../agent-ops/query-builders.js";
import { parsePath } from "../../../../parser.js";
import { buildChangePlanContext } from "../change-plan.js";
import { buildImportPlanForContext } from "../extract-adopt.js";
import {
  adoptionPlanPath,
  buildTaskMode,
  normalizeTopogramPath,
  printValidationFailure,
  readJson,
  resultOk,
  selectorOptions,
  shouldUseImportAdoptPath,
  workflowPresetSelectors
} from "../workspace.js";
import { printJson } from "./output.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} context
 * @returns {number|null}
 */
export function runChangeQuery(context) {
  const queryName = context.commandArgs?.queryName;
  const selectors = selectorOptions(context);

  if (queryName === "change-plan") {
    const built = buildChangePlanContext(context, "modeling");
    const failure = validateChangePlanBuild(built);
    if (failure !== null) return failure;
    return printJson(built.changePlan);
  }

  if (queryName === "risk-summary") {
    if (hasImportPlan(context)) {
      const built = buildImportPlanForContext(context, "risk-summary");
      if (!resultOk(built)) return printValidationFailure(built);
      const risk = classifyRisk({
        importPlan: built.importPlan,
        verificationTargets: built.importPlan.verification_targets,
        maintainedRisk: built.importPlan.maintained_risk || null
      });
      return printJson(buildRiskSummaryPayload({
        source: "extract-plan",
        risk,
        nextAction: built.importPlan.next_action || null,
        maintainedRisk: built.importPlan.maintained_risk || null
      }));
    }
    const built = buildChangePlanContext(context, "modeling");
    const failure = validateChangePlanBuild(built);
    if (failure !== null) return failure;
    const risk = riskFromChangePlanBuild(built);
    return printJson(buildRiskSummaryPayload({
      source: "change-plan",
      risk,
      nextAction: built.changePlan.next_action || null,
      maintainedRisk: built.maintainedRisk
    }));
  }

  if (queryName === "canonical-writes") {
    if (hasImportPlan(context)) {
      const adoptionPlan = readJson(adoptionPlanPath(normalizeTopogramPath(context.inputPath)));
      return printJson(buildCanonicalWritesPayloadForImportPlan(adoptionPlan.imported_proposal_surfaces || []));
    }
    const result = buildTaskMode(parsePath(context.inputPath), selectors, context.modeId || "modeling", context.fromTopogramPath);
    if (!resultOk(result)) return printValidationFailure(result);
    return printJson(buildCanonicalWritesPayloadForChangePlan(result.artifact.write_scope));
  }

  if (queryName === "proceed-decision") {
    if (hasImportPlan(context)) {
      const built = buildImportPlanForContext(context, "proceed-decision");
      if (!resultOk(built)) return printValidationFailure(built);
      const risk = classifyRisk({
        importPlan: built.importPlan,
        verificationTargets: built.importPlan.verification_targets,
        maintainedRisk: built.importPlan.maintained_risk || null
      });
      const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
        workspace: built.topogramRoot,
        taskModeArtifact: built.taskModeResult.artifact,
        importPlan: built.importPlan,
        selectors: workflowPresetSelectors(built.taskModeResult.artifact, context.providerId, context.presetId, "proceed-decision")
      });
      return printJson(proceedDecisionFromRisk(
        risk,
        built.importPlan.next_action,
        built.importPlan.write_scope,
        built.importPlan.verification_targets,
        built.importPlan.maintained_risk || null,
        built.importPlan.workflow_presets || null,
        resolvedWorkflowContext
      ));
    }
    const built = buildChangePlanContext(context, "modeling");
    const failure = validateChangePlanBuild(built);
    if (failure !== null) return failure;
    const risk = riskFromChangePlanBuild(built);
    return printJson(proceedDecisionFromRisk(
      risk,
      built.changePlan.next_action || null,
      built.changePlan.write_scope || null,
      built.changePlan.verification_targets || null,
      built.maintainedRisk,
      null,
      null
    ));
  }

  if (queryName === "review-packet") {
    if (hasImportPlan(context)) {
      const built = buildImportPlanForContext(context, "review-packet");
      if (!resultOk(built)) return printValidationFailure(built);
      const risk = classifyRisk({
        importPlan: built.importPlan,
        verificationTargets: built.importPlan.verification_targets,
        maintainedRisk: built.importPlan.maintained_risk || null
      });
      return printJson(buildReviewPacketPayloadForImportPlan({ importPlan: built.importPlan, risk }));
    }
    const built = buildChangePlanContext(context, "modeling");
    const failure = validateChangePlanBuild(built);
    if (failure !== null) return failure;
    const risk = riskFromChangePlanBuild(built);
    return printJson(buildReviewPacketPayloadForChangePlan({ changePlan: built.changePlan, risk }));
  }

  return null;
}

/**
 * @param {AnyRecord} context
 * @returns {boolean}
 */
function hasImportPlan(context) {
  return shouldUseImportAdoptPath(context) && fs.existsSync(adoptionPlanPath(normalizeTopogramPath(context.inputPath)));
}

/**
 * @param {AnyRecord} built
 * @returns {number|null}
 */
function validateChangePlanBuild(built) {
  if (!resultOk(built.resolved)) return printValidationFailure(built.resolved);
  if (!resultOk(built.taskModeResult)) return printValidationFailure(built.taskModeResult);
  if (built.sliceResult && !resultOk(built.sliceResult)) return printValidationFailure(built.sliceResult);
  if (built.diffResult && !resultOk(built.diffResult)) return printValidationFailure(built.diffResult);
  if (built.maintainedBundleResult && !resultOk(built.maintainedBundleResult)) return printValidationFailure(built.maintainedBundleResult);
  return null;
}

/**
 * @param {AnyRecord} built
 * @returns {AnyRecord}
 */
function riskFromChangePlanBuild(built) {
  return classifyRisk({
    reviewBoundary: built.changePlan.review_boundary,
    maintainedBoundary: built.changePlan.maintained_boundary,
    diffSummary: built.diffSummary,
    verificationTargets: built.changePlan.verification_targets,
    maintainedRisk: built.maintainedRisk
  });
}
