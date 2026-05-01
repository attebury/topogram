// Default-active status filtering for SDLC queries.
//
// Most CLI surfaces (board, slice, traceability) want to omit terminal
// statuses unless the caller passes `--include-status` or
// `--include-archived`. This module centralizes the rules.

import {
  isArchivableStatus,
  isTerminalStatus
} from "./transitions/index.js";

const ALWAYS_VISIBLE_TERMINAL_STATUSES = new Set([
  "approved",
  "superseded",
  "verified",
  "wont-fix",
  "done"
]);

export function defaultActiveStatuses(kind) {
  // For a given kind, the statuses that show up in queries by default.
  // Terminal statuses are still visible if they aren't archive-eligible
  // (e.g. requirement.superseded is terminal but stays for traceability).
  switch (kind) {
    case "pitch":
      return new Set(["draft", "shaped", "submitted", "approved"]);
    case "requirement":
      return new Set(["draft", "in-review", "approved", "superseded"]);
    case "acceptance_criterion":
      return new Set(["draft", "approved", "superseded"]);
    case "task":
      return new Set(["unclaimed", "claimed", "in-progress", "blocked"]);
    case "bug":
      return new Set(["open", "in-progress", "fixed"]);
    case "document":
      return new Set(["draft", "review", "published"]);
    default:
      return null;
  }
}

export function filterStatements(statements, options = {}) {
  const includeArchived = options.includeArchived === true;
  const includeStatuses = options.includeStatuses ? new Set(options.includeStatuses) : null;
  return statements.filter((s) => {
    if (s.archived && !includeArchived) return false;
    const defaults = defaultActiveStatuses(s.kind);
    if (!defaults) return true;
    if (includeStatuses && includeStatuses.has(s.status)) return true;
    return defaults.has(s.status);
  });
}

export { isTerminalStatus, isArchivableStatus, ALWAYS_VISIBLE_TERMINAL_STATUSES };
