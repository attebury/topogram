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
 * @param {AnyRecord} pitch
 * @returns {AnyRecord}
 */
function pitchRecord(pitch) {
  return {
    ...summary(pitch),
    priority: pitch.priority || null,
    appetite: pitch.appetite || null,
    domain: pitch.resolvedDomain?.id || null,
    requirements: Array.isArray(pitch.requirements) ? pitch.requirements.slice().sort() : [],
    decisions: [
      ...(Array.isArray(pitch.decisions) ? pitch.decisions.map(refId).filter(Boolean) : []),
      ...(Array.isArray(pitch.decisionsFromPitch) ? pitch.decisionsFromPitch : [])
    ].sort()
  };
}

/**
 * @param {AnyRecord} requirement
 * @returns {AnyRecord}
 */
function requirementRecord(requirement) {
  return {
    ...summary(requirement),
    priority: requirement.priority || null,
    domain: requirement.resolvedDomain?.id || null,
    pitch: refId(requirement.pitch),
    acceptance_refs: refIds(requirement.acceptanceCriteria),
    task_refs: refIds(requirement.tasks),
    affects: refIds(requirement.affects)
  };
}

/**
 * @param {AnyRecord} journey
 * @returns {AnyRecord}
 */
function journeyRecord(journey) {
  return {
    ...summary(journey),
    domain: journey.resolvedDomain?.id || null,
    actors: refIds(journey.actors),
    related_capabilities: refIds(journey.relatedCapabilities),
    steps: Array.isArray(journey.steps) ? journey.steps.length : 0,
    alternates: Array.isArray(journey.alternates) ? journey.alternates.length : 0
  };
}

/**
 * @param {AnyRecord} plan
 * @returns {AnyRecord}
 */
function planRecord(plan) {
  return {
    ...summary(plan),
    task: refId(plan.task),
    steps: Array.isArray(plan.steps) ? plan.steps.length : 0,
    next_step: Array.isArray(plan.steps)
      ? (plan.steps.find((/** @type {AnyRecord} */ step) => step.status !== "done" && step.status !== "skipped")?.id || null)
      : null
  };
}

/**
 * @param {unknown} value
 * @returns {Date|null}
 */
function dateOrNull(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {Date|null} date
 * @returns {string|null}
 */
function isoOrNull(date) {
  return date ? date.toISOString() : null;
}

/**
 * @param {Date|null} start
 * @param {Date} end
 * @returns {number|null}
 */
function ageDays(start, end) {
  if (!start) return null;
  const days = (end.getTime() - start.getTime()) / 86400000;
  return Number.isFinite(days) ? Number(days.toFixed(2)) : null;
}

/**
 * @param {Record<string, any>} history
 * @param {string} id
 * @returns {AnyRecord[]}
 */
function historyEntries(history, id) {
  const entries = history && Array.isArray(history[id]) ? history[id] : [];
  return entries
    .filter((entry) => entry && typeof entry === "object")
    .slice()
    .sort((left, right) => {
      const leftDate = dateOrNull(left.at)?.getTime() ?? 0;
      const rightDate = dateOrNull(right.at)?.getTime() ?? 0;
      return leftDate - rightDate;
    });
}

/**
 * @param {AnyRecord} statement
 * @param {Record<string, any>} history
 * @returns {Date|null}
 */
function currentStatusSince(statement, history) {
  const entries = historyEntries(history, statement.id);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].to === statement.status) {
      return dateOrNull(entries[index].at);
    }
  }
  return null;
}

/**
 * @param {AnyRecord} task
 * @param {Record<string, any>} history
 * @param {Date} now
 * @returns {AnyRecord}
 */
function timedTaskRecord(task, history, now) {
  const since = currentStatusSince(task, history);
  return {
    ...taskRecord(task),
    status_since: isoOrNull(since),
    age_days: ageDays(since, now)
  };
}

/**
 * @param {number[]} values
 * @returns {{ count: number, average_days: number|null, median_days: number|null, min_days: number|null, max_days: number|null }}
 */
function durationStats(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) {
    return { count: 0, average_days: null, median_days: null, min_days: null, max_days: null };
  }
  const sum = sorted.reduce((total, value) => total + value, 0);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return {
    count: sorted.length,
    average_days: Number((sum / sorted.length).toFixed(2)),
    median_days: Number(median.toFixed(2)),
    min_days: Number(sorted[0].toFixed(2)),
    max_days: Number(sorted[sorted.length - 1].toFixed(2))
  };
}

/**
 * @param {AnyRecord[]} taskList
 * @param {Record<string, any>} history
 * @returns {AnyRecord}
 */
function transitionDurationStats(taskList, history) {
  const claimedToInProgress = [];
  const inProgressToDone = [];
  for (const task of taskList) {
    const entries = historyEntries(history, task.id);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const fromDate = dateOrNull(entry.at);
      if (!fromDate) continue;
      if (entry.to === "claimed") {
        const next = entries.slice(index + 1).find((candidate) => candidate.to === "in-progress");
        const nextDate = dateOrNull(next?.at);
        if (nextDate) claimedToInProgress.push((nextDate.getTime() - fromDate.getTime()) / 86400000);
      }
      if (entry.to === "in-progress") {
        const next = entries.slice(index + 1).find((candidate) => candidate.to === "done");
        const nextDate = dateOrNull(next?.at);
        if (nextDate) inProgressToDone.push((nextDate.getTime() - fromDate.getTime()) / 86400000);
      }
    }
  }
  return {
    claimed_to_in_progress: durationStats(claimedToInProgress),
    in_progress_to_done: durationStats(inProgressToDone)
  };
}

/**
 * @param {AnyRecord[]} items
 * @returns {Record<string, Record<string, number>>}
 */
function countByKindAndStatus(items) {
  /** @type {Record<string, Record<string, number>>} */
  const counts = {};
  for (const item of items) {
    if (!item || item.archived) continue;
    const kind = item.kind || "unknown";
    const status = item.status || "unknown";
    counts[kind] ||= {};
    counts[kind][status] = (counts[kind][status] || 0) + 1;
  }
  return counts;
}

/**
 * @param {AnyRecord|null|undefined} policy
 * @returns {{ maxInProgressTasks: number|null, maxClaimedTasksPerActor: number|null, claimedDays: number|null, inProgressDays: number|null }}
 */
function pressureThresholds(policy) {
  const wipLimits = policy?.wipLimits || {};
  const staleWork = policy?.staleWork || {};
  return {
    maxInProgressTasks: Number.isFinite(wipLimits.maxInProgressTasks) ? Number(wipLimits.maxInProgressTasks) : null,
    maxClaimedTasksPerActor: Number.isFinite(wipLimits.maxClaimedTasksPerActor) ? Number(wipLimits.maxClaimedTasksPerActor) : null,
    claimedDays: Number.isFinite(staleWork.claimedDays) ? Number(staleWork.claimedDays) : null,
    inProgressDays: Number.isFinite(staleWork.inProgressDays) ? Number(staleWork.inProgressDays) : null
  };
}

/**
 * @param {AnyRecord} graph
 * @param {Record<string, any>} [history]
 * @param {AnyRecord|null} [policy]
 * @param {{ now?: Date|string }} [options]
 * @returns {AnyRecord}
 */
export function buildSdlcStaleWorkPayload(graph, history = {}, policy = null, options = {}) {
  const now = typeof options.now === "string" ? (dateOrNull(options.now) || new Date()) : (options.now || new Date());
  const thresholds = pressureThresholds(policy);
  const allTasks = tasks(graph);
  const inProgress = allTasks.filter((task) => task.status === "in-progress").map((task) => timedTaskRecord(task, history, now));
  const claimed = allTasks.filter((task) => task.status === "claimed").map((task) => timedTaskRecord(task, history, now));
  const byActorMap = new Map();
  for (const task of [...claimed, ...inProgress]) {
    for (const actor of task.claimed_by.length > 0 ? task.claimed_by : ["unassigned"]) {
      if (!byActorMap.has(actor)) byActorMap.set(actor, { actor, claimed: 0, in_progress: 0, tasks: [] });
      const row = byActorMap.get(actor);
      if (task.status === "claimed") row.claimed += 1;
      if (task.status === "in-progress") row.in_progress += 1;
      row.tasks.push(task.id);
    }
  }
  const claimedDays = thresholds.claimedDays;
  const inProgressDays = thresholds.inProgressDays;
  const claimedStale = claimedDays == null
    ? []
    : claimed.filter((task) => task.age_days != null && task.age_days > claimedDays);
  const inProgressStale = inProgressDays == null
    ? []
    : inProgress.filter((task) => task.age_days != null && task.age_days > inProgressDays);
  const breaches = [];
  if (thresholds.maxInProgressTasks != null && inProgress.length > thresholds.maxInProgressTasks) {
    breaches.push({
      kind: "max_in_progress_tasks",
      count: inProgress.length,
      limit: thresholds.maxInProgressTasks,
      task_ids: inProgress.map((task) => task.id)
    });
  }
  const byActor = [...byActorMap.values()].sort((left, right) => left.actor.localeCompare(right.actor));
  if (thresholds.maxClaimedTasksPerActor != null) {
    for (const actor of byActor) {
      if (actor.claimed > thresholds.maxClaimedTasksPerActor) {
        breaches.push({
          kind: "max_claimed_tasks_per_actor",
          actor: actor.actor,
          count: actor.claimed,
          limit: thresholds.maxClaimedTasksPerActor,
          task_ids: actor.tasks
        });
      }
    }
  }
  for (const task of claimedStale) {
    breaches.push({ kind: "stale_claimed_task", task: task.id, age_days: task.age_days, limit_days: thresholds.claimedDays });
  }
  for (const task of inProgressStale) {
    breaches.push({ kind: "stale_in_progress_task", task: task.id, age_days: task.age_days, limit_days: thresholds.inProgressDays });
  }
  return {
    type: "sdlc_stale_work_query",
    version: 1,
    ok: breaches.length === 0,
    now: now.toISOString(),
    policy: {
      configured: Object.values(thresholds).some((value) => value != null),
      wipLimits: {
        maxInProgressTasks: thresholds.maxInProgressTasks,
        maxClaimedTasksPerActor: thresholds.maxClaimedTasksPerActor
      },
      staleWork: {
        claimedDays: thresholds.claimedDays,
        inProgressDays: thresholds.inProgressDays
      }
    },
    wip: {
      claimed_count: claimed.length,
      in_progress_count: inProgress.length,
      by_actor: byActor
    },
    stale: {
      claimed: claimedStale,
      in_progress: inProgressStale,
      missing_history: [...claimed, ...inProgress].filter((task) => task.status_since == null).map((task) => task.id)
    },
    breaches,
    nextCommands: [
      "topogram query sdlc-claimed ./topo --json",
      "topogram query sdlc-proof-gaps ./topo --json",
      "topogram sdlc prep commit . --json"
    ]
  };
}

/**
 * @param {AnyRecord} graph
 * @returns {AnyRecord}
 */
export function buildSdlcAvailablePayload(graph) {
  const allTasks = tasks(graph);
  const activeStatuses = new Set(["unclaimed", "claimed", "in-progress", "blocked"]);
  const activeOrCoveredRequirementIds = new Set(
    allTasks
      .filter((task) => activeStatuses.has(task.status) || task.status === "done")
      .flatMap((task) => refIds(task.satisfies))
  );
  const approvedRequirementsWithoutActiveTasks = (graph.byKind?.requirement || [])
    .filter((/** @type {AnyRecord} */ requirement) => !requirement.archived && requirement.status === "approved")
    .filter((/** @type {AnyRecord} */ requirement) => !activeOrCoveredRequirementIds.has(requirement.id))
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
 * @returns {AnyRecord}
 */
export function buildSdlcBacklogPayload(graph) {
  const pitchBacklogStatuses = new Set(["draft", "shaped", "submitted"]);
  const requirementBacklogStatuses = new Set(["draft", "in-review"]);
  const journeyBacklogStatuses = new Set(["draft"]);
  const planBacklogStatuses = new Set(["draft"]);
  const pitches = sortById((graph.byKind?.pitch || [])
    .filter((/** @type {AnyRecord} */ pitch) => !pitch.archived && pitchBacklogStatuses.has(String(pitch.status)))
    .map(pitchRecord));
  const requirements = sortById((graph.byKind?.requirement || [])
    .filter((/** @type {AnyRecord} */ requirement) => !requirement.archived && requirementBacklogStatuses.has(String(requirement.status)))
    .map(requirementRecord));
  const journeys = sortById((graph.byKind?.journey || [])
    .filter((/** @type {AnyRecord} */ journey) => !journey.archived && journeyBacklogStatuses.has(String(journey.status)))
    .map(journeyRecord));
  const plans = sortById((graph.byKind?.plan || [])
    .filter((/** @type {AnyRecord} */ plan) => !plan.archived && planBacklogStatuses.has(String(plan.status)))
    .map(planRecord));
  return {
    type: "sdlc_backlog_query",
    version: 1,
    counts: {
      total: pitches.length + requirements.length + journeys.length + plans.length,
      pitches: {
        draft: pitches.filter((pitch) => pitch.status === "draft").length,
        shaped: pitches.filter((pitch) => pitch.status === "shaped").length,
        submitted: pitches.filter((pitch) => pitch.status === "submitted").length
      },
      requirements: {
        draft: requirements.filter((requirement) => requirement.status === "draft").length,
        in_review: requirements.filter((requirement) => requirement.status === "in-review").length
      },
      journeys: {
        draft: journeys.length
      },
      plans: {
        draft: plans.length
      }
    },
    pitches,
    requirements,
    journeys,
    plans,
    nextCommands: [
      "topogram query slice ./topo --pitch <pitch-id> --format markdown",
      "topogram query slice ./topo --requirement <req-id> --format markdown",
      "topogram sdlc transition <pitch-id> covered . --actor <actor> --note \"<why>\"",
      "topogram sdlc new task <slug> ."
    ]
  };
}

/**
 * @param {AnyRecord} graph
 * @returns {AnyRecord}
 */
export function buildSdlcCloseoutCandidatesPayload(graph) {
  const allTasks = tasks(graph);
  const activeStatuses = new Set(["unclaimed", "claimed", "in-progress", "blocked"]);
  const approvedRequirements = (graph.byKind?.requirement || [])
    .filter((/** @type {AnyRecord} */ requirement) => !requirement.archived && requirement.status === "approved");
  const candidates = approvedRequirements.flatMap((/** @type {AnyRecord} */ requirement) => {
    const satisfyingTasks = allTasks.filter((task) => refIds(task.satisfies).includes(requirement.id));
    const doneTasks = satisfyingTasks.filter((task) => task.status === "done");
    const activeTasks = satisfyingTasks.filter((task) => activeStatuses.has(task.status));
    if (doneTasks.length === 0 || activeTasks.length > 0) {
      return [];
    }
    return [{
      requirement: summary(requirement),
      done_tasks: doneTasks.map(taskRecord).sort((/** @type {AnyRecord} */ a, /** @type {AnyRecord} */ b) => a.id.localeCompare(b.id)),
      active_tasks: activeTasks.map(taskRecord).sort((/** @type {AnyRecord} */ a, /** @type {AnyRecord} */ b) => a.id.localeCompare(b.id)),
      recommended_command: `topogram sdlc transition ${requirement.id} satisfied . --actor <actor> --note "<proof>"`
    }];
  });
  return {
    type: "sdlc_closeout_candidates_query",
    version: 1,
    candidates: candidates.sort((/** @type {AnyRecord} */ a, /** @type {AnyRecord} */ b) => a.requirement.id.localeCompare(b.requirement.id))
  };
}

/**
 * @param {AnyRecord} graph
 * @param {Record<string, any>} [history]
 * @param {AnyRecord|null} [policy]
 * @param {{ now?: Date|string }} [options]
 * @returns {AnyRecord}
 */
export function buildSdlcMetricsPayload(graph, history = {}, policy = null, options = {}) {
  const now = typeof options.now === "string" ? (dateOrNull(options.now) || new Date()) : (options.now || new Date());
  const allTasks = tasks(graph);
  const allRequirements = (graph.byKind?.requirement || []).filter((/** @type {AnyRecord} */ requirement) => !requirement.archived);
  const closeouts = buildSdlcCloseoutCandidatesPayload(graph);
  const proofGaps = buildSdlcProofGapsPayload(graph);
  const staleWork = buildSdlcStaleWorkPayload(graph, history, policy, { now });
  const doneTasks = allTasks.filter((task) => task.status === "done");
  const claimedTasks = allTasks.filter((task) => task.status === "claimed");
  const inProgressTasks = allTasks.filter((task) => task.status === "in-progress");
  const historyIds = Object.entries(history || {})
    .filter(([id, entries]) => id !== "__error" && Array.isArray(entries) && entries.length > 0)
    .map(([id]) => id);
  return {
    type: "sdlc_metrics_query",
    version: 1,
    now: now.toISOString(),
    counts: {
      by_kind_status: countByKindAndStatus(graph.statements || []),
      tasks: {
        total: allTasks.length,
        claimed: claimedTasks.length,
        in_progress: inProgressTasks.length,
        done: doneTasks.length,
        open_wip: claimedTasks.length + inProgressTasks.length
      },
      requirements: {
        total: allRequirements.length,
        approved: allRequirements.filter(/** @param {AnyRecord} requirement */ (requirement) => requirement.status === "approved").length,
        ongoing: allRequirements.filter(/** @param {AnyRecord} requirement */ (requirement) => requirement.status === "ongoing").length,
        satisfied: allRequirements.filter(/** @param {AnyRecord} requirement */ (requirement) => requirement.status === "satisfied").length,
        closeout_candidates: closeouts.candidates.length
      },
      proof_gaps: proofGaps.gaps.filter(/** @param {AnyRecord} gap */ (gap) => !gap.ready_for_done).length,
      stale_work_breaches: staleWork.breaches.length
    },
    wip: staleWork.wip,
    stale_work: {
      ok: staleWork.ok,
      breaches: staleWork.breaches,
      stale: staleWork.stale
    },
    ongoing_requirements: sortById(allRequirements.filter(/** @param {AnyRecord} requirement */ (requirement) => requirement.status === "ongoing").map(summary)),
    closeout_candidates: closeouts.candidates.map(/** @param {AnyRecord} candidate */ (candidate) => candidate.requirement),
    transition_durations: transitionDurationStats(allTasks, history),
    history: {
      statements_with_history: historyIds.length,
      entries: historyIds.reduce((total, id) => total + (Array.isArray(history[id]) ? history[id].length : 0), 0),
      missing_history_for_wip: staleWork.stale.missing_history
    }
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
