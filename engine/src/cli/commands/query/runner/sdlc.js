// @ts-check

import { parsePath } from "../../../../parser.js";
import { resolveWorkspace } from "../../../../resolver.js";
import {
  buildSdlcAvailablePayload,
  buildSdlcBlockersPayload,
  buildSdlcClaimedPayload,
  buildSdlcProofGapsPayload
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
  if (!["sdlc-available", "sdlc-claimed", "sdlc-blockers", "sdlc-proof-gaps"].includes(queryName)) {
    return null;
  }
  const graph = resolveGraph(context.inputPath);
  if (!graph) return 1;
  if (queryName === "sdlc-available") {
    return printJson(buildSdlcAvailablePayload(graph));
  }
  if (queryName === "sdlc-claimed") {
    return printJson(buildSdlcClaimedPayload(graph, context.actorId || null));
  }
  if (queryName === "sdlc-blockers") {
    return printJson(buildSdlcBlockersPayload(graph, context.taskId || null));
  }
  return printJson(buildSdlcProofGapsPayload(graph, context.taskId || null));
}
