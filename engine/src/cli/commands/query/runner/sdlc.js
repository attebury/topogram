// @ts-check

import { parsePath } from "../../../../parser.js";
import { resolveWorkspace } from "../../../../resolver.js";
import { readHistory } from "../../../../sdlc/history.js";
import { loadSdlcPolicy, policyProjectRoot } from "../../../../sdlc/policy.js";
import {
  buildSdlcAvailablePayload,
  buildSdlcBacklogPayload,
  buildSdlcBlockersPayload,
  buildSdlcClaimedPayload,
  buildSdlcCloseoutCandidatesPayload,
  buildSdlcMetricsPayload,
  buildSdlcProofGapsPayload,
  buildSdlcStaleWorkPayload
} from "../../../../sdlc/views.js";
import { printValidationFailure, resultOk } from "../workspace.js";
import { printJson } from "./output.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} inputPath
 * @returns {AnyRecord|null}
 */
function resolveGraph(inputPath) {
  const resolved = resolveWorkspace(parsePath(inputPath));
  if (!resultOk(resolved)) {
    printValidationFailure(resolved);
    return null;
  }
  return resolved.graph;
}

/**
 * @param {AnyRecord} context
 * @returns {number|null}
 */
export function runSdlcQuery(context) {
  const queryName = context.commandArgs?.queryName;
  if (!["sdlc-backlog", "sdlc-available", "sdlc-claimed", "sdlc-blockers", "sdlc-proof-gaps", "sdlc-closeout-candidates", "sdlc-metrics", "sdlc-stale-work"].includes(queryName)) {
    return null;
  }
  const graph = resolveGraph(context.inputPath);
  if (!graph) return 1;
  const history = readHistory(context.inputPath);
  const policy = loadSdlcPolicy(policyProjectRoot(context.inputPath)).policy;
  if (queryName === "sdlc-backlog") {
    return printJson(buildSdlcBacklogPayload(graph));
  }
  if (queryName === "sdlc-available") {
    return printJson(buildSdlcAvailablePayload(graph));
  }
  if (queryName === "sdlc-closeout-candidates") {
    return printJson(buildSdlcCloseoutCandidatesPayload(graph));
  }
  if (queryName === "sdlc-metrics") {
    return printJson(buildSdlcMetricsPayload(graph, history, policy));
  }
  if (queryName === "sdlc-stale-work") {
    return printJson(buildSdlcStaleWorkPayload(graph, history, policy));
  }
  if (queryName === "sdlc-claimed") {
    return printJson(buildSdlcClaimedPayload(graph, context.actorId || null));
  }
  if (queryName === "sdlc-blockers") {
    return printJson(buildSdlcBlockersPayload(graph, context.taskId || null));
  }
  return printJson(buildSdlcProofGapsPayload(graph, context.taskId || null));
}
