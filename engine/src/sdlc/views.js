// @ts-check

import { checkDoD } from "./dod/index.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord|string|null|undefined} ref
 * @returns {string|null}
 */
function refId(ref) {
  return typeof ref === "string" ? ref : (typeof ref?.id === "string" ? ref.id : null);
}

/**
 * @param {unknown} refs
 * @returns {string[]}
 */
function refIds(refs) {
  return Array.isArray(refs) ? refs.map(refId).filter((id) => typeof id === "string") : [];
}

/**
 * @param {AnyRecord} statement
 * @returns {{ id: string, kind: string, name: string|null, status: string|null }}
 */
function summary(statement) {
  return {
    id: statement.id,
    kind: statement.kind,
    name: statement.name || null,
    status: statement.status || null
  };
}

/**
 * @param {AnyRecord[]} items
 * @returns {AnyRecord[]}
 */
function sortById(items) {
  return items.slice().sort((/** @type {AnyRecord} */ a, /** @type {AnyRecord} */ b) => a.id.localeCompare(b.id));
}

/**
 * @param {Map<string, AnyRecord>} index
 * @param {string[]} ids
 * @returns {AnyRecord[]}
 */
function statementsForIds(index, ids) {
  return ids.flatMap((id) => {
    const item = index.get(id);
    return item ? [item] : [];
  });
}

/**
 * @param {AnyRecord} graph
 * @returns {Map<string, AnyRecord>}
 */
function byId(graph) {
  return graph.byId instanceof Map
    ? graph.byId
    : new Map((graph.statements || []).map((/** @type {AnyRecord} */ statement) => [statement.id, statement]));
}

/**
 * @param {AnyRecord} graph
 * @returns {AnyRecord[]}
 */
function tasks(graph) {
  return (graph.byKind?.task || []).filter((/** @type {AnyRecord} */ task) => !task.archived);
}

/**
 * @param {AnyRecord} graph
 * @returns {AnyRecord[]}
 */
function bugs(graph) {
  return (graph.byKind?.bug || []).filter((/** @type {AnyRecord} */ bug) => !bug.archived);
}

/**
 * @param {AnyRecord} task
 * @returns {string[]}
 */
function claimantIds(task) {
  return refIds(task.claimedBy);
}

/**
 * @param {AnyRecord} task
 * @param {Map<string, AnyRecord>} index
 * @returns {string[]}
 */
function unresolvedBlockerIds(task, index) {
  return refIds(task.blockedBy).filter((id) => {
    const target = index.get(id);
    return target && target.status !== "done";
  });
}

/**
 * @param {AnyRecord} task
 * @returns {AnyRecord}
 */
function taskRecord(task) {
  return {
    ...summary(task),
    priority: task.priority || null,
    disposition: task.disposition || null,
    work_type: task.workType || null,
    claimed_by: claimantIds(task),
    satisfies: refIds(task.satisfies),
    acceptance_refs: refIds(task.acceptanceRefs),
    verification_refs: refIds(task.verificationRefs),
    blocked_by: refIds(task.blockedBy)
  };
}

/**
 * @param {AnyRecord} graph
 * @returns {AnyRecord}
 */
export function buildSdlcAvailablePayload(graph) {
  const allTasks = tasks(graph);
  const activeStatuses = new Set(["unclaimed", "claimed", "in-progress", "blocked"]);
  const activeRequirementIds = new Set(
    allTasks
      .filter((task) => activeStatuses.has(task.status))
      .flatMap((task) => refIds(task.satisfies))
  );
  const approvedRequirementsWithoutActiveTasks = (graph.byKind?.requirement || [])
    .filter((/** @type {AnyRecord} */ requirement) => !requirement.archived && requirement.status === "approved")
    .filter((/** @type {AnyRecord} */ requirement) => !activeRequirementIds.has(requirement.id))
    .map(summary);
  return {
    type: "sdlc_available_query",
    version: 1,
    unclaimed_tasks: allTasks
      .filter((task) => task.status === "unclaimed" && (task.disposition || "active") === "active")
      .map(taskRecord)
      .sort((/** @type {AnyRecord} */ a, /** @type {AnyRecord} */ b) => a.id.localeCompare(b.id)),
    open_bugs: sortById(bugs(graph)
      .filter((bug) => !["verified", "wont-fix"].includes(String(bug.status)))
      .map(summary)),
    approved_requirements_without_active_tasks: approvedRequirementsWithoutActiveTasks
  };
}

/**
 * @param {AnyRecord} graph
 * @param {string|null} actorId
 * @returns {AnyRecord}
 */
export function buildSdlcClaimedPayload(graph, actorId = null) {
  const claimedTasks = tasks(graph)
    .filter((task) => ["claimed", "in-progress"].includes(String(task.status)))
    .filter((task) => !actorId || claimantIds(task).includes(actorId))
    .map(taskRecord)
    .sort((/** @type {AnyRecord} */ a, /** @type {AnyRecord} */ b) => a.id.localeCompare(b.id));
  const grouped = new Map();
  for (const task of claimedTasks) {
    for (const actor of task.claimed_by.length > 0 ? task.claimed_by : ["unassigned"]) {
      if (!grouped.has(actor)) grouped.set(actor, []);
      grouped.get(actor).push(task);
    }
  }
  return {
    type: "sdlc_claimed_query",
    version: 1,
    actor: actorId,
    claimed_tasks: claimedTasks,
    by_actor: [...grouped.entries()].map(([actor, actorTasks]) => ({ actor, tasks: actorTasks }))
  };
}

/**
 * @param {AnyRecord} graph
 * @param {string|null} taskId
 * @returns {AnyRecord}
 */
export function buildSdlcBlockersPayload(graph, taskId = null) {
  const index = byId(graph);
  const selected = taskId
    ? tasks(graph).filter((task) => task.id === taskId)
    : tasks(graph).filter((task) => refIds(task.blockedBy).length > 0 || refIds(task.blocks).length > 0);
  const blockedTasks = selected.map((task) => {
    const blockers = unresolvedBlockerIds(task, index);
    return {
      ...taskRecord(task),
      unresolved_blockers: statementsForIds(index, blockers).map(summary)
    };
  });
  const reciprocal_issues = [];
  for (const task of tasks(graph)) {
    for (const blockedId of refIds(task.blocks)) {
      const blocked = index.get(blockedId);
      if (!blocked) continue;
      if (!refIds(blocked.blockedBy).includes(task.id)) {
        reciprocal_issues.push({
          task: task.id,
          blocks: blockedId,
          message: `${task.id} blocks ${blockedId}, but ${blockedId} does not list ${task.id} in blocked_by`
        });
      }
    }
  }
  return {
    type: "sdlc_blockers_query",
    version: 1,
    task: taskId,
    blocked_tasks: blockedTasks,
    reciprocal_issues
  };
}

/**
 * @param {AnyRecord} graph
 * @param {string|null} taskId
 * @returns {AnyRecord}
 */
export function buildSdlcProofGapsPayload(graph, taskId = null) {
  const index = byId(graph);
  const selected = taskId
    ? tasks(graph).filter((task) => task.id === taskId)
    : tasks(graph).filter((task) => task.status !== "done");
  return {
    type: "sdlc_proof_gaps_query",
    version: 1,
    task: taskId,
    gaps: selected.map((task) => {
      const dod = checkDoD("task", task, "done", { byId: index });
      return {
        task: taskRecord(task),
        ready_for_done: dod.satisfied,
        errors: dod.errors,
        warnings: dod.warnings,
        missing: {
          satisfies: refIds(task.satisfies).length === 0,
          acceptance_refs: refIds(task.acceptanceRefs).length === 0,
          verification_refs: refIds(task.verificationRefs).length === 0
        }
      };
    })
  };
}

/**
 * @param {AnyRecord} graph
 * @param {string} taskId
 * @param {{ actor?: string|null }} [options]
 * @returns {AnyRecord}
 */
export function buildSdlcStartPacket(graph, taskId, options = {}) {
  const index = byId(graph);
  const task = index.get(taskId);
  if (!task || task.kind !== "task") {
    return { ok: false, error: `Task '${taskId}' not found` };
  }
  const actor = options.actor || null;
  const claims = claimantIds(task);
  const blockers = unresolvedBlockerIds(task, index);
  const blockedByOtherActor = claims.length > 0 && actor && !claims.includes(actor);
  const requirementIds = refIds(task.satisfies);
  const acIds = refIds(task.acceptanceRefs);
  const verificationIds = refIds(task.verificationRefs);
  const requirements = statementsForIds(index, requirementIds);
  const ruleIds = new Set(requirements.flatMap((req) => [
    ...refIds(req.introducesRules),
    ...refIds(req.respectsRules)
  ]));
  const rules = statementsForIds(index, [...ruleIds]);
  const decisionIds = new Set([
    ...refIds(task.introducesDecisions),
    ...rules.flatMap((rule) => refIds(rule.sourceOfTruth))
  ]);
  const proofGaps = buildSdlcProofGapsPayload(graph, taskId).gaps[0] || null;
  return {
    ok: true,
    type: "sdlc_start_packet",
    version: 1,
    actor,
    task: taskRecord(task),
    requirements: requirements.map(summary),
    acceptance_criteria: statementsForIds(index, acIds).map(summary),
    verifications: statementsForIds(index, verificationIds).map(summary),
    rules: rules.map(summary),
    decisions: statementsForIds(index, [...decisionIds]).map(summary),
    blockers: statementsForIds(index, blockers).map(summary),
    plans: statementsForIds(index, refIds(task.plans)).map(summary),
    proof_gaps: proofGaps,
    can_start: blockers.length === 0 && !blockedByOtherActor && ["unclaimed", "claimed", "in-progress"].includes(String(task.status)),
    refusal_reasons: [
      ...(blockers.length > 0 ? [`blocked_by tasks not yet done: ${blockers.join(", ")}`] : []),
      ...(blockedByOtherActor ? [`task is claimed by ${claims.join(", ")}`] : []),
      ...(!["unclaimed", "claimed", "in-progress"].includes(String(task.status)) ? [`task status '${task.status}' cannot be started`] : [])
    ],
    next_commands: [
      `topogram query slice ./topo --task ${taskId} --json`,
      `topogram query single-agent-plan ./topo --mode implementation --task ${taskId} --json`,
      `topogram query sdlc-proof-gaps ./topo --task ${taskId} --json`,
      `topogram query verification-targets ./topo --task ${taskId} --json`,
      `topogram sdlc complete ${taskId} . --verification <verification-id> --actor ${actor || "<actor>"} --write`
    ]
  };
}
