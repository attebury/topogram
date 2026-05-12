// @ts-check

import fs from "node:fs";
import path from "node:path";

import {
  buildAuthHintsQueryPayload,
  buildAuthReviewPacketPayload,
  buildHandoffStatusPayload,
  buildLaneStatusPayload,
  buildWorkPacketPayload
} from "../../../../agent-ops/query-builders.js";
import { buildImportAdoptAgentContext, buildImportPlanForContext } from "../extract-adopt.js";
import { normalizeTopogramPath, printValidationFailure, readJson, resultOk } from "../workspace.js";
import { printJson } from "./output.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} context
 * @returns {number|null}
 */
export function runImportAdoptQuery(context) {
  const queryName = context.commandArgs?.queryName;

  if (queryName === "extract-plan") {
    const built = buildImportPlanForContext(context, "extract-plan");
    if (!resultOk(built)) return printValidationFailure(built);
    return printJson(built.importPlan);
  }

  if (queryName === "multi-agent-plan") {
    if (context.modeId !== "extract-adopt") {
      throw new Error("query multi-agent-plan currently supports only --mode extract-adopt.");
    }
    const built = buildImportAdoptAgentContext(context, "multi-agent-plan");
    if (!resultOk(built)) return printValidationFailure(built);
    return printJson(built.multiAgentPlan);
  }

  if (queryName === "work-packet") {
    if (context.modeId !== "extract-adopt") {
      throw new Error("query work-packet currently supports only --mode extract-adopt.");
    }
    if (!context.laneId) {
      throw new Error("query work-packet requires --lane <id>.");
    }
    const built = buildImportAdoptAgentContext(context, "work-packet");
    if (!resultOk(built)) return printValidationFailure(built);
    return printJson(buildWorkPacketPayload({
      workspace: built.topogramRoot,
      multiAgentPlan: built.multiAgentPlan,
      laneId: context.laneId
    }));
  }

  if (queryName === "lane-status" || queryName === "handoff-status") {
    if (context.modeId !== "extract-adopt") {
      throw new Error(`query ${queryName} currently supports only --mode extract-adopt.`);
    }
    const built = buildImportAdoptAgentContext(context, queryName);
    if (!resultOk(built)) return printValidationFailure(built);
    const payload = queryName === "lane-status"
      ? buildLaneStatusPayload({
          workspace: built.topogramRoot,
          multiAgentPlan: built.multiAgentPlan,
          report: built.reconcileReport,
          adoptionStatus: built.adoptionStatus
        })
      : buildHandoffStatusPayload({
          workspace: built.topogramRoot,
          multiAgentPlan: built.multiAgentPlan,
          report: built.reconcileReport,
          adoptionStatus: built.adoptionStatus
        });
    return printJson(payload);
  }

  if (queryName === "auth-hints") {
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const reportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    if (!fs.existsSync(reportPath) || !fs.existsSync(adoptionStatusPath)) {
      throw new Error(`No reconcile auth-hint artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }
    return printJson(buildAuthHintsQueryPayload(readJson(reportPath), readJson(adoptionStatusPath)));
  }

  if (queryName === "auth-review-packet") {
    if (!context.bundleSlug) {
      throw new Error("query auth-review-packet requires --bundle <slug>.");
    }
    const topogramRoot = normalizeTopogramPath(context.inputPath);
    const reportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    if (!fs.existsSync(reportPath) || !fs.existsSync(adoptionStatusPath)) {
      throw new Error(`No reconcile auth-review artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }
    const reconcileReport = readJson(reportPath);
    const packet = buildAuthReviewPacketPayload(reconcileReport, readJson(adoptionStatusPath), context.bundleSlug);
    if (!packet) {
      const knownBundles = (reconcileReport.candidate_model_bundles || []).map((/** @type {AnyRecord} */ bundle) => bundle.slug).sort();
      throw new Error(`No auth review bundle '${context.bundleSlug}' found in '${path.join(topogramRoot, "candidates", "reconcile")}'. Known bundles: ${knownBundles.length ? knownBundles.join(", ") : "none"}.`);
    }
    return printJson(packet);
  }

  return null;
}
