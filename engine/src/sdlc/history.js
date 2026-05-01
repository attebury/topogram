// SDLC history sidecar.
//
// Stored at `<topogram-root>/.topogram-sdlc-history.json` as a
// JSON object keyed by statement id. Each entry is an append-only array of
// transition records:
//
//   {
//     "task_audit_logging": [
//       { "from": "claimed", "to": "in-progress", "at": "2026-05-01T12:00:00Z", "by": "agent-7", "note": "..." },
//       { "from": "in-progress", "to": "done", "at": "2026-05-02T09:30:00Z", "by": "agent-7" }
//     ]
//   }
//
// `topogram check` consults this file to surface "status edited outside the
// CLI" warnings when an artifact's current status doesn't match the last
// recorded transition.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { topogramRootForSdlc } from "./paths.js";

const HISTORY_FILENAME = ".topogram-sdlc-history.json";

export function historyPath(workspaceRoot) {
  return path.join(topogramRootForSdlc(workspaceRoot), HISTORY_FILENAME);
}

export function readHistory(workspaceRoot) {
  const file = historyPath(workspaceRoot);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    return { __error: err.message };
  }
}

export function writeHistory(workspaceRoot, history) {
  const file = historyPath(workspaceRoot);
  writeFileSync(file, JSON.stringify(history, null, 2) + "\n", "utf8");
}

export function appendTransition(workspaceRoot, id, record) {
  const history = readHistory(workspaceRoot);
  if (history.__error) {
    throw new Error(`Cannot read history file: ${history.__error}`);
  }
  if (!history[id]) history[id] = [];
  history[id].push({
    from: record.from,
    to: record.to,
    at: record.at || new Date().toISOString(),
    by: record.by || null,
    note: record.note || null
  });
  writeHistory(workspaceRoot, history);
  return history[id];
}

export function lastTransition(history, id) {
  const entries = history[id];
  if (!entries || entries.length === 0) return null;
  return entries[entries.length - 1];
}

export function detectDriftedStatus(history, statement) {
  // If the last recorded transition's `to` doesn't match the statement's
  // current status, the artifact was edited outside the CLI.
  const last = lastTransition(history, statement.id);
  if (!last) return null;
  if (last.to !== statement.status) {
    return {
      id: statement.id,
      kind: statement.kind,
      historyStatus: last.to,
      currentStatus: statement.status
    };
  }
  return null;
}
