// SDLC transition orchestrator.
//
// `transitionStatement(workspace, id, targetStatus, options)`:
//   1. Locate the statement in the resolved graph.
//   2. Validate the transition with the kind's state machine.
//   3. Run DoD (Definition of Done) checks. Errors block; warnings advise.
//   4. Surgically rewrite the `status` value in the source `.tg` file.
//   5. Append a history record to `.topogram-sdlc-history.json`.
//
// The rewrite is byte-precise — we only swap the status symbol token, so
// formatting, comments, and adjacent fields are untouched.

import { readFileSync, writeFileSync } from "node:fs";

import { parsePath } from "../parser.js";
import { resolveWorkspace } from "../resolver/index.js";
import { validateTransition, isArchivableStatus } from "./transitions/index.js";
import { checkDoD } from "./dod/index.js";
import { appendTransition } from "./history.js";

function findStatementInAst(workspaceAst, id) {
  for (const file of workspaceAst.files) {
    for (const statement of file.statements) {
      if (statement.id === id) {
        return statement;
      }
    }
  }
  return null;
}

function findStatusField(statement) {
  for (const field of statement.fields) {
    if (field.key === "status") return field;
  }
  return null;
}

function rewriteStatusInSource(source, statusField, newStatus) {
  const start = statusField.value.loc.start.offset;
  const end = statusField.value.loc.end.offset;
  return source.slice(0, start) + newStatus + source.slice(end);
}

export function transitionStatement(workspaceRoot, id, targetStatus, options = {}) {
  const ast = parsePath(workspaceRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return {
      ok: false,
      error: "workspace failed validation; cannot transition",
      validation: resolved.validation
    };
  }

  const astStatement = findStatementInAst(ast, id);
  if (!astStatement) {
    return { ok: false, error: `Statement '${id}' not found` };
  }

  const resolvedStatement = resolved.graph.statements.find((s) => s.id === id);
  if (!resolvedStatement) {
    return { ok: false, error: `Statement '${id}' not found in resolved graph` };
  }

  const fromStatus = resolvedStatement.status;
  const transition = validateTransition(astStatement.kind, fromStatus, targetStatus);
  if (!transition.ok) {
    return { ok: false, error: transition.error };
  }

  const byId = new Map(resolved.graph.statements.map((s) => [s.id, s]));
  const dod = checkDoD(astStatement.kind, resolvedStatement, targetStatus, { byId });
  if (!dod.satisfied && !options.force) {
    return {
      ok: false,
      error: `Definition of Done not satisfied: ${dod.errors.join("; ")}`,
      dod
    };
  }

  const statusField = findStatusField(astStatement);
  if (!statusField) {
    return { ok: false, error: `Statement '${id}' has no status field to rewrite` };
  }

  const sourcePath = astStatement.loc.file;
  const original = readFileSync(sourcePath, "utf8");
  const rewritten = rewriteStatusInSource(original, statusField, targetStatus);

  if (!options.dryRun) {
    writeFileSync(sourcePath, rewritten, "utf8");
    appendTransition(workspaceRoot, id, {
      from: fromStatus,
      to: targetStatus,
      by: options.actor || null,
      note: options.note || null
    });
  }

  return {
    ok: true,
    id,
    kind: astStatement.kind,
    from: fromStatus,
    to: targetStatus,
    file: sourcePath,
    archivable: isArchivableStatus(astStatement.kind, targetStatus),
    dod,
    dryRun: options.dryRun === true
  };
}
