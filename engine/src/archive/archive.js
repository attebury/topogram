// Archive: move a terminal-status statement out of the active workspace
// and into a year-bucketed JSONL file.
//
// Strategy:
//   1. Validate the statement is in a status eligible for archiving.
//   2. Build the archive entry (frozen snapshot + transitions).
//   3. Append to `sdlc/_archive/{kind}s-{year}.jsonl`.
//   4. Surgically remove the statement block from its source `.tg` file.
//
// `archiveBatch` is the bulk counterpart used by `release`.

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";

import { parsePath } from "../parser.js";
import { resolveWorkspace } from "../resolver/index.js";
import { isArchivableStatus } from "../sdlc/transitions/index.js";
import { readHistory } from "../sdlc/history.js";
import { appendEntry } from "./jsonl.js";
import { buildArchiveEntry, isArchivableKind } from "./schema.js";

function findAstStatement(ast, id) {
  for (const file of ast.files) {
    for (const statement of file.statements) {
      if (statement.id === id) {
        return { file, statement };
      }
    }
  }
  return null;
}

function removeStatementBlock(source, statement) {
  // The statement runs from `loc.start.offset` to `loc.end.offset`. Trim
  // any leading whitespace on the same line and any trailing newline.
  let start = statement.loc.start.offset;
  let end = statement.loc.end.offset;
  while (start > 0 && (source[start - 1] === " " || source[start - 1] === "\t")) {
    start -= 1;
  }
  while (end < source.length && (source[end] === " " || source[end] === "\t")) {
    end += 1;
  }
  if (source[end] === "\n") end += 1;
  while (start > 0 && source[start - 1] === "\n" && source[start - 2] === "\n") {
    start -= 1;
  }
  return source.slice(0, start) + source.slice(end);
}

export function archiveStatement(workspaceRoot, id, options = {}) {
  const ast = parsePath(workspaceRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return { ok: false, error: "workspace failed validation; cannot archive", validation: resolved.validation };
  }

  const located = findAstStatement(ast, id);
  if (!located) return { ok: false, error: `Statement '${id}' not found` };

  const { statement: astStatement } = located;
  const resolvedStatement = resolved.graph.statements.find((s) => s.id === id);
  if (!resolvedStatement) return { ok: false, error: `Statement '${id}' not in resolved graph` };

  if (!isArchivableKind(resolvedStatement.kind)) {
    return { ok: false, error: `Kind '${resolvedStatement.kind}' is not archivable` };
  }
  if (!isArchivableStatus(resolvedStatement.kind, resolvedStatement.status) && !options.force) {
    return {
      ok: false,
      error: `Status '${resolvedStatement.status}' is not archive-eligible for ${resolvedStatement.kind}`
    };
  }

  const history = readHistory(workspaceRoot);
  const transitions = (history[id] || []).slice();
  const entry = buildArchiveEntry(resolvedStatement, transitions, {
    by: options.by,
    release: options.release,
    reason: options.reason
  });

  if (options.dryRun) {
    return {
      ok: true,
      id,
      kind: resolvedStatement.kind,
      status: resolvedStatement.status,
      file: astStatement.loc.file,
      dryRun: true,
      entry
    };
  }

  const archiveFile = appendEntry(workspaceRoot, resolvedStatement.kind, entry);

  const sourcePath = astStatement.loc.file;
  const original = readFileSync(sourcePath, "utf8");
  const rewritten = removeStatementBlock(original, astStatement);
  if (rewritten.trim().length === 0) {
    unlinkSync(sourcePath);
  } else {
    writeFileSync(sourcePath, rewritten, "utf8");
  }

  return {
    ok: true,
    id,
    kind: resolvedStatement.kind,
    status: resolvedStatement.status,
    file: sourcePath,
    archiveFile,
    dryRun: false
  };
}

export function archiveBatch(workspaceRoot, ids, options = {}) {
  const results = [];
  for (const id of ids) {
    results.push(archiveStatement(workspaceRoot, id, options));
  }
  return {
    ok: results.every((r) => r.ok),
    results
  };
}

export function archiveEligibleStatements(resolved, options = {}) {
  const beforeIso = options.before || null;
  const wantStatuses = options.statuses ? new Set(options.statuses) : null;
  const eligible = [];
  for (const s of resolved.graph.statements) {
    if (s.archived) continue;
    if (!isArchivableKind(s.kind)) continue;
    if (!isArchivableStatus(s.kind, s.status)) continue;
    if (wantStatuses && !wantStatuses.has(s.status)) continue;
    if (beforeIso && s.updated && s.updated > beforeIso) continue;
    eligible.push(s.id);
  }
  return eligible;
}
