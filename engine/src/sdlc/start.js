// @ts-check

import fs from "node:fs";

import { parsePath } from "../parser.js";
import { resolveWorkspace } from "../resolver.js";
import { resolveTopoRoot } from "../workspace-paths.js";
import { transitionStatement } from "./transition.js";
import { buildSdlcStartPacket } from "./views.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} workspaceAst
 * @param {string} id
 * @returns {AnyRecord|null}
 */
function findAstStatement(workspaceAst, id) {
  for (const file of workspaceAst.files || []) {
    for (const statement of file.statements || []) {
      if (statement.id === id) return statement;
    }
  }
  return null;
}

/**
 * @param {AnyRecord} statement
 * @param {string} key
 * @returns {AnyRecord|null}
 */
function findAstField(statement, key) {
  return (statement.fields || []).find((/** @type {AnyRecord} */ field) => field.key === key) || null;
}

/**
 * @param {string} source
 * @param {number} offset
 * @returns {{ start: number, end: number }}
 */
function lineRangeForOffset(source, offset) {
  const start = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const newline = source.indexOf("\n", offset);
  const end = newline >= 0 ? newline + 1 : source.length;
  return { start, end };
}

/**
 * @param {AnyRecord} statement
 * @returns {number}
 */
function insertionOffset(statement) {
  const statusField = findAstField(statement, "status");
  return statusField ? statusField.loc.start.offset : Math.max(statement.loc.end.offset - 2, statement.loc.start.offset);
}

/**
 * @param {string} source
 * @param {AnyRecord} astStatement
 * @param {string} actor
 * @returns {string}
 */
function rewriteClaimedBy(source, astStatement, actor) {
  const replacement = `  claimed_by [${actor}]\n`;
  const existing = findAstField(astStatement, "claimed_by");
  if (existing) {
    const range = lineRangeForOffset(source, existing.loc.start.offset);
    return `${source.slice(0, range.start)}${replacement}${source.slice(range.end)}`;
  }
  const offset = insertionOffset(astStatement);
  const range = lineRangeForOffset(source, offset);
  return `${source.slice(0, range.start)}${replacement}${source.slice(range.start)}`;
}

/**
 * @param {string} workspaceRoot
 * @param {string} taskId
 * @param {string} actor
 * @returns {{ ok: true, written: boolean, file: string|null } | { ok: false, error: string }}
 */
function ensureClaimedBy(workspaceRoot, taskId, actor) {
  const ast = parsePath(workspaceRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return { ok: false, error: "workspace failed validation; cannot claim task" };
  }
  const task = resolved.graph.byId?.get(taskId) || resolved.graph.statements.find((/** @type {AnyRecord} */ statement) => statement.id === taskId);
  if (!task || task.kind !== "task") {
    return { ok: false, error: `Task '${taskId}' not found` };
  }
  const claimants = Array.isArray(task.claimedBy)
    ? task.claimedBy.map((/** @type {any} */ ref) => typeof ref === "string" ? ref : ref?.id).filter(Boolean)
    : [];
  if (claimants.length > 0 && !claimants.includes(actor)) {
    return { ok: false, error: `Task '${taskId}' is already claimed by ${claimants.join(", ")}` };
  }
  if (claimants.includes(actor)) {
    return { ok: true, written: false, file: null };
  }
  const astStatement = findAstStatement(ast, taskId);
  if (!astStatement) {
    return { ok: false, error: `Source statement '${taskId}' not found` };
  }
  const file = astStatement.loc.file;
  const original = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, rewriteClaimedBy(original, astStatement, actor), "utf8");
  return { ok: true, written: true, file };
}

/**
 * @param {string} workspaceRoot
 * @returns {{ ok: true, resolved: AnyRecord } | { ok: false, error: string, validation?: any }}
 */
function resolveSdlc(workspaceRoot) {
  const ast = parsePath(workspaceRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return { ok: false, error: "workspace failed validation; cannot start task", validation: resolved.validation };
  }
  return { ok: true, resolved };
}

/**
 * @param {AnyRecord} graph
 * @param {string} taskId
 * @returns {AnyRecord|null}
 */
function findGraphTask(graph, taskId) {
  return graph.byId?.get?.(taskId) || (graph.statements || []).find((/** @type {AnyRecord} */ statement) => statement.id === taskId) || null;
}

/**
 * @param {string} workspaceRoot
 * @param {string} taskId
 * @param {{ actor?: string|null, write?: boolean, dryRun?: boolean, note?: string|null }} [options]
 * @returns {AnyRecord}
 */
export function startTask(workspaceRoot, taskId, options = {}) {
  const sdlcRoot = resolveTopoRoot(workspaceRoot || ".");
  const actor = options.actor || null;
  const initial = resolveSdlc(sdlcRoot);
  if (!initial.ok) return initial;
  const packet = buildSdlcStartPacket(initial.resolved.graph, taskId, { actor });
  if (!packet.ok || !options.write || options.dryRun) {
    return { ...packet, dryRun: true, written: false, transitions: [] };
  }
  if (!actor) {
    return { ok: false, error: "sdlc start --write requires --actor <actor>", packet };
  }
  if (!packet.can_start) {
    return { ok: false, error: `Task '${taskId}' cannot be started`, packet };
  }

  /** @type {AnyRecord[]} */
  const transitions = [];
  if (packet.task.status === "unclaimed") {
    const claim = ensureClaimedBy(sdlcRoot, taskId, actor);
    if (!claim.ok) return { ok: false, error: claim.error, packet };
    const claimed = transitionStatement(sdlcRoot, taskId, "claimed", {
      actor,
      note: options.note || "task started"
    });
    transitions.push(claimed);
    if (!claimed.ok) return { ok: false, error: claimed.error, transitions, packet };
  }

  const afterClaim = resolveSdlc(sdlcRoot);
  if (!afterClaim.ok) return { ...afterClaim, transitions, packet };
  const currentTask = findGraphTask(afterClaim.resolved.graph, taskId);
  if (currentTask?.status === "claimed") {
    const started = transitionStatement(sdlcRoot, taskId, "in-progress", {
      actor,
      note: options.note || "task started"
    });
    transitions.push(started);
    if (!started.ok) return { ok: false, error: started.error, transitions, packet };
  }

  const finalResolved = resolveSdlc(sdlcRoot);
  if (!finalResolved.ok) return { ...finalResolved, transitions, packet };
  return {
    ...buildSdlcStartPacket(finalResolved.resolved.graph, taskId, { actor }),
    dryRun: false,
    written: true,
    transitions
  };
}
