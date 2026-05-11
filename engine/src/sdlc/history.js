// SDLC history sidecar.
//
// Stored at `<topogram-root>/sdlc/.topogram-sdlc-history.json` as a
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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sdlcRootForSdlc, topogramRootForSdlc } from "./paths.js";

const HISTORY_FILENAME = ".topogram-sdlc-history.json";

export function historyPath(workspaceRoot) {
  return path.join(sdlcRootForSdlc(workspaceRoot), HISTORY_FILENAME);
}

function legacyHistoryPath(workspaceRoot) {
  return path.join(topogramRootForSdlc(workspaceRoot), HISTORY_FILENAME);
}

export function readHistory(workspaceRoot) {
  let file = historyPath(workspaceRoot);
  if (!existsSync(file)) {
    const legacyFile = legacyHistoryPath(workspaceRoot);
    if (existsSync(legacyFile)) {
      file = legacyFile;
    }
  }
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    return { __error: err.message };
  }
}

export function validateHistory(history) {
  const warnings = [];
  if (!history || typeof history !== "object" || Array.isArray(history)) {
    return [{ message: "SDLC history sidecar must be a JSON object keyed by statement id" }];
  }
  for (const [id, entries] of Object.entries(history)) {
    if (id === "__error") continue;
    if (!Array.isArray(entries)) {
      warnings.push({ id, message: `SDLC history entry '${id}' must be an array of transition records` });
      continue;
    }
    entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        warnings.push({ id, message: `SDLC history entry '${id}' transition ${index + 1} must be an object` });
        return;
      }
      for (const key of ["from", "to", "at"]) {
        if (typeof entry[key] !== "string" || entry[key].trim() === "") {
          warnings.push({ id, message: `SDLC history entry '${id}' transition ${index + 1} must include string '${key}'` });
        }
      }
      for (const key of ["by", "note"]) {
        if (entry[key] !== null && entry[key] !== undefined && typeof entry[key] !== "string") {
          warnings.push({ id, message: `SDLC history entry '${id}' transition ${index + 1} field '${key}' must be a string or null` });
        }
      }
    });
  }
  return warnings;
}

export function writeHistory(workspaceRoot, history) {
  const file = historyPath(workspaceRoot);
  const dir = path.dirname(file);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
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
  if (!Array.isArray(entries) || entries.length === 0) return null;
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
