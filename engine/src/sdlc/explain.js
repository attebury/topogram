// `sdlc explain <id>` — agent-facing inspector.
//
// Returns a structured payload an agent can script against. The
// `next_action` shape is intentionally stable across versions:
//
//   {
//     kind: "transition" | "work" | "wait" | "review" | "none",
//     to?: <statusName>,            // when kind === "transition"
//     reason: <human-readable>,
//     blockers?: [<id>, ...]        // when kind === "wait"
//   }

import { checkDoD } from "./dod/index.js";
import { legalTransitionsFor, isTerminalStatus } from "./transitions/index.js";
import { defaultActiveStatuses } from "./status-filter.js";
import { readHistory, lastTransition, detectDriftedStatus } from "./history.js";
import { planStepHistoryId } from "./plan-steps.js";

function pickNextStatus(legal) {
  // Prefer the canonical forward path (skipping rollback options).
  const FORWARD_BIAS = [
    "in-review",
    "approved",
    "submitted",
    "shaped",
    "in-progress",
    "done",
    "claimed",
    "fixed",
    "verified",
    "review",
    "published"
  ];
  for (const candidate of FORWARD_BIAS) {
    if (legal.includes(candidate)) return candidate;
  }
  return legal[0] || null;
}

function buildBlockers(statement, byId) {
  if (statement.kind !== "task") return [];
  const blockers = statement.blockedBy || [];
  return blockers
    .map((ref) => {
      const id = typeof ref === "string" ? ref : ref?.id;
      const target = byId.get(id);
      return target && target.status !== "done" ? id : null;
    })
    .filter(Boolean);
}

function summarizePlan(plan, history) {
  const steps = (plan.steps || []).map((step) => ({
    id: step.id,
    status: step.status,
    description: step.description,
    notes: step.notes || null,
    outcome: step.outcome || null,
    last_transition: lastTransition(history, planStepHistoryId(plan.id, step.id))
  }));
  return {
    id: plan.id,
    status: plan.status,
    task: plan.task?.id || null,
    steps,
    next_step: steps.find((step) => step.status !== "done" && step.status !== "skipped") || null
  };
}

function plansForTask(graph, task, history) {
  const planIds = task.kind === "task" ? task.plans || [] : [];
  return planIds
    .map((id) => graph.statements.find((statement) => statement.id === id && statement.kind === "plan" && !statement.archived))
    .filter(Boolean)
    .map((plan) => summarizePlan(plan, history));
}

function recommendedQueries(statement) {
  if (statement.kind === "task") {
    return [
      `topogram query slice ./topo --task ${statement.id} --json`,
      `topogram query single-agent-plan ./topo --mode modeling --task ${statement.id} --json`
    ];
  }
  if (statement.kind === "bug") {
    return [
      `topogram query slice ./topo --bug ${statement.id} --json`,
      `topogram query single-agent-plan ./topo --mode modeling --bug ${statement.id} --json`
    ];
  }
  if (statement.kind === "plan") {
    return [
      `topogram sdlc plan explain ${statement.id} --json`,
      `topogram query slice ./topo --plan ${statement.id} --json`
    ];
  }
  return [`topogram query slice ./topo --${statement.kind} ${statement.id} --json`];
}

export function explain(workspaceRoot, resolved, id, options = {}) {
  const statement = resolved.graph.statements.find((s) => s.id === id);
  if (!statement) {
    return { ok: false, error: `Statement '${id}' not found` };
  }

  const byId = new Map(resolved.graph.statements.map((s) => [s.id, s]));
  const history = readHistory(workspaceRoot);
  const last = lastTransition(history, id);
  const drift = detectDriftedStatus(history, statement);
  const blockers = buildBlockers(statement, byId);

  const legal = legalTransitionsFor(statement.kind, statement.status);
  const nextStatus = pickNextStatus(legal);
  const dod = nextStatus ? checkDoD(statement.kind, statement, nextStatus, { byId }) : { satisfied: true, errors: [], warnings: [] };
  const dodCurrent = checkDoD(statement.kind, statement, statement.status, { byId });

  let nextAction;
  if (blockers.length > 0) {
    nextAction = {
      kind: "wait",
      reason: `blocked_by tasks not yet done`,
      blockers
    };
  } else if (drift) {
    nextAction = {
      kind: "review",
      reason: `status drift: history says '${drift.historyStatus}', current says '${drift.currentStatus}'`
    };
  } else if (!dodCurrent.satisfied) {
    nextAction = {
      kind: "work",
      reason: `current-status DoD failing: ${dodCurrent.errors.join("; ")}`
    };
  } else if (isTerminalStatus(statement.kind, statement.status)) {
    nextAction = { kind: "none", reason: "terminal status" };
  } else if (nextStatus && dod.satisfied) {
    nextAction = {
      kind: "transition",
      to: nextStatus,
      reason: `forward path is open (${statement.status} → ${nextStatus})`
    };
  } else if (nextStatus) {
    nextAction = {
      kind: "work",
      reason: `next status '${nextStatus}' DoD not satisfied: ${dod.errors.join("; ")}`
    };
  } else {
    nextAction = { kind: "none", reason: "no legal forward transitions" };
  }

  return {
    ok: true,
    id: statement.id,
    kind: statement.kind,
    status: statement.status,
    legal_transitions: legal,
    dod_current: dodCurrent,
    dod_next: nextStatus ? { target: nextStatus, ...dod } : null,
    last_transition: last,
    drift,
    blockers,
    plans: statement.kind === "task" ? plansForTask(resolved.graph, statement, history) : undefined,
    plan: statement.kind === "plan" ? summarizePlan(statement, history) : undefined,
    recommended_queries: recommendedQueries(statement),
    next_action: nextAction,
    history: options.includeHistory ? history[id] || [] : undefined
  };
}
