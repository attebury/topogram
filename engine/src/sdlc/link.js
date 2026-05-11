// @ts-check

import fs from "node:fs";

import { parsePath } from "../parser.js";
import { resolveWorkspace } from "../resolver.js";
import { resolveTopoRoot } from "../workspace-paths.js";

/**
 * @typedef {{ field: string, property: string, mode: "list"|"single" }} LinkRule
 */

/** @type {Map<string, LinkRule>} */
const LINK_RULES = new Map([
  ["task:requirement", { field: "satisfies", property: "satisfies", mode: "list" }],
  ["task:acceptance_criterion", { field: "acceptance_refs", property: "acceptanceRefs", mode: "list" }],
  ["task:verification", { field: "verification_refs", property: "verificationRefs", mode: "list" }],
  ["bug:task", { field: "fixed_in", property: "fixedIn", mode: "list" }],
  ["bug:verification", { field: "fixed_in_verification", property: "fixedInVerification", mode: "list" }],
  ["acceptance_criterion:requirement", { field: "requirement", property: "requirement", mode: "single" }]
]);

/**
 * @param {Record<string, any>} workspaceAst
 * @param {string} id
 * @returns {Record<string, any>|null}
 */
function findAstStatement(workspaceAst, id) {
  for (const file of workspaceAst.files || []) {
    for (const statement of file.statements || []) {
      if (statement.id === id) {
        return statement;
      }
    }
  }
  return null;
}

/**
 * @param {Record<string, any>} statement
 * @param {string} key
 * @returns {Record<string, any>|null}
 */
function findAstField(statement, key) {
  return (statement.fields || []).find(/** @param {any} field */ (field) => field.key === key) || null;
}

/**
 * @param {Record<string, any>|null|undefined} ref
 * @returns {string|null}
 */
function refId(ref) {
  return typeof ref === "string" ? ref : (typeof ref?.id === "string" ? ref.id : null);
}

/**
 * @param {Record<string, any>} statement
 * @param {LinkRule} rule
 * @returns {string[]}
 */
function currentLinkIds(statement, rule) {
  const value = statement[rule.property];
  if (rule.mode === "single") {
    const id = refId(value);
    return id ? [id] : [];
  }
  return Array.isArray(value)
    ? value.map(refId).filter((id) => typeof id === "string")
    : [];
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
 * @param {Record<string, any>} statement
 * @returns {number}
 */
function insertionOffset(statement) {
  const statusField = findAstField(statement, "status");
  if (statusField) {
    return statusField.loc.start.offset;
  }
  return Math.max(statement.loc.end.offset - 2, statement.loc.start.offset);
}

/**
 * @param {string} source
 * @param {Record<string, any>} astStatement
 * @param {LinkRule} rule
 * @param {string[]} ids
 * @returns {string}
 */
function rewriteLinkField(source, astStatement, rule, ids) {
  const value = rule.mode === "single" ? ids[0] : `[${ids.join(" ")}]`;
  const replacement = `  ${rule.field} ${value}\n`;
  const existing = findAstField(astStatement, rule.field);
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
 * @param {string} fromId
 * @param {string} toId
 * @param {{ write?: boolean }} [options]
 * @returns {Record<string, any>}
 */
export function linkSdlcRecord(workspaceRoot, fromId, toId, options = {}) {
  const sdlcRoot = resolveTopoRoot(workspaceRoot || ".");
  const ast = parsePath(sdlcRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return { ok: false, error: "workspace failed validation; cannot link SDLC records", validation: resolved.validation };
  }

  const from = resolved.graph.byId?.get(fromId) || resolved.graph.statements.find(/** @param {any} statement */ (statement) => statement.id === fromId);
  const to = resolved.graph.byId?.get(toId) || resolved.graph.statements.find(/** @param {any} statement */ (statement) => statement.id === toId);
  if (!from) {
    return { ok: false, error: `Statement '${fromId}' not found` };
  }
  if (!to) {
    return { ok: false, error: `Statement '${toId}' not found` };
  }
  const rule = LINK_RULES.get(`${from.kind}:${to.kind}`);
  if (!rule) {
    return { ok: false, error: `No supported SDLC link from ${from.kind} to ${to.kind}` };
  }

  const current = currentLinkIds(from, rule);
  const next = rule.mode === "single" ? [toId] : [...new Set([...current, toId])];
  if (rule.mode === "single" && current[0] && current[0] !== toId) {
    return { ok: false, error: `${fromId} already links ${rule.field} to ${current[0]}` };
  }
  const astStatement = findAstStatement(ast, fromId);
  if (!astStatement) {
    return { ok: false, error: `Source statement '${fromId}' not found` };
  }

  const file = astStatement.loc.file;
  const original = fs.readFileSync(file, "utf8");
  const rewritten = rewriteLinkField(original, astStatement, rule, next);
  if (options.write) {
    fs.writeFileSync(file, rewritten, "utf8");
  }

  return {
    ok: true,
    from: { id: fromId, kind: from.kind },
    to: { id: toId, kind: to.kind },
    field: rule.field,
    file,
    before: current,
    after: next,
    dryRun: !options.write,
    written: Boolean(options.write)
  };
}
