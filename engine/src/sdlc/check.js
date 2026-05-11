// `sdlc check` — workspace-wide SDLC sanity scan.
//
// Surfaces:
//   * Status drift (current status doesn't match last history entry)
//   * DoD violations on currently-recorded status
//   * Stale documents (linked component changed since publish)
//   * Reciprocal blocks/blocked_by mismatches
//
// Returns { ok, errors, warnings } so the CLI can exit non-zero in
// `--strict` mode.

import { checkDoD } from "./dod/index.js";
import { detectDriftedStatus, readHistory } from "./history.js";
import { planStepHistoryId } from "./plan-steps.js";

const SDLC_KINDS = new Set([
  "pitch",
  "requirement",
  "acceptance_criterion",
  "task",
  "plan",
  "bug"
]);

function checkBlockingReciprocity(graph) {
  const warnings = [];
  const tasks = (graph.byKind?.task || []).filter((task) => !task.archived);
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  for (const task of tasks) {
    for (const ref of task.blocks || []) {
      const targetId = typeof ref === "string" ? ref : ref?.id;
      const target = tasksById.get(targetId);
      if (!target) continue;
      const reciprocal = (target.blockedBy || []).some((r) => (typeof r === "string" ? r : r?.id) === task.id);
      if (!reciprocal) {
        warnings.push({
          id: task.id,
          message: `task ${task.id} blocks ${target.id}, but ${target.id} does not list ${task.id} in blocked_by`
        });
      }
    }
  }
  return warnings;
}

export function checkWorkspace(workspaceRoot, resolved) {
  const errors = [];
  const warnings = [];
  const history = readHistory(workspaceRoot);
  if (history.__error) {
    warnings.push({ message: `cannot read SDLC history sidecar: ${history.__error}` });
  }

  const byId = new Map(resolved.graph.statements.map((s) => [s.id, s]));

  for (const statement of resolved.graph.statements) {
    if (statement.archived) continue;
    if (!SDLC_KINDS.has(statement.kind)) continue;

    const drift = detectDriftedStatus(history, statement);
    if (drift) {
      warnings.push({
        id: statement.id,
        message: `status drift: history records '${drift.historyStatus}' but current is '${drift.currentStatus}'`
      });
    }

    if (statement.kind === "plan") {
      for (const step of statement.steps || []) {
        const stepDrift = detectDriftedStatus(history, {
          id: planStepHistoryId(statement.id, step.id),
          kind: "plan_step",
          status: step.status
        });
        if (stepDrift) {
          warnings.push({
            id: statement.id,
            message: `step status drift: history records '${stepDrift.historyStatus}' for ${step.id} but current is '${stepDrift.currentStatus}'`
          });
        }
      }
    }

    // Re-run DoD against the *current* status to surface "approved without
    // ACs" or similar ongoing violations.
    const dod = checkDoD(statement.kind, statement, statement.status, { byId });
    for (const err of dod.errors) {
      errors.push({ id: statement.id, message: `DoD: ${err}` });
    }
    for (const warn of dod.warnings) {
      warnings.push({ id: statement.id, message: `DoD: ${warn}` });
    }
  }

  for (const w of checkBlockingReciprocity(resolved.graph)) {
    warnings.push(w);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
