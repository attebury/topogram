// Kanban-style status board for SDLC artifacts.
//
// Output shape: rows = status columns, columns = artifact summaries.
// Filter to a single kind via `--kind pitch|task|bug`. Default lists all
// SDLC kinds in parallel. Archived entries are hidden by default (callers
// pass `includeArchived: true` to surface them).

import {
  summarizeBug,
  summarizePlan,
  summarizePitch,
  summarizeRequirement,
  summarizeTask
} from "../context/shared.js";
import {
  defaultActiveStatuses,
  filterStatements
} from "../../sdlc/status-filter.js";

const SUMMARIZERS = {
  pitch: summarizePitch,
  requirement: summarizeRequirement,
  task: summarizeTask,
  plan: summarizePlan,
  bug: summarizeBug
};

const SUPPORTED_KINDS = Object.keys(SUMMARIZERS);

function buildLanesForKind(graph, kind, options) {
  const all = graph.byKind?.[kind] || [];
  const visible = filterStatements(all, options);
  const lanes = {};
  const statuses = defaultActiveStatuses(kind);
  if (statuses) {
    for (const status of statuses) {
      lanes[status] = [];
    }
  }
  const summarize = SUMMARIZERS[kind];
  for (const item of visible) {
    if (!lanes[item.status]) lanes[item.status] = [];
    lanes[item.status].push(summarize(item));
  }
  return lanes;
}

export function generateSdlcBoard(graph, options = {}) {
  const wantedKinds = options.kind ? [options.kind] : SUPPORTED_KINDS;
  const board = {};
  const counts = {};
  for (const kind of wantedKinds) {
    if (!SUMMARIZERS[kind]) {
      throw new Error(`Unsupported board kind '${kind}' (allowed: ${SUPPORTED_KINDS.join(", ")})`);
    }
    board[kind] = buildLanesForKind(graph, kind, options);
    counts[kind] = Object.fromEntries(
      Object.entries(board[kind]).map(([status, items]) => [status, items.length])
    );
  }
  return {
    type: "sdlc_board",
    version: 1,
    kinds: wantedKinds,
    counts,
    board
  };
}
