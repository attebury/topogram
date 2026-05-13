// @ts-check

/**
 * @typedef {Record<string, any>} AnyRecord
 */

const DONE_TASK_STATUSES = new Set(["done"]);

/**
 * @param {unknown} refs
 * @returns {string[]}
 */
function refIds(refs) {
  if (!Array.isArray(refs)) {
    return [];
  }
  return refs
    .map((ref) => {
      if (typeof ref === "string") {
        return ref;
      }
      if (ref && typeof ref === "object" && "id" in ref) {
        return String(ref.id);
      }
      return "";
    })
    .filter(Boolean);
}

/**
 * @param {AnyRecord} statement
 * @returns {{ id: string, name: string|null, status: string|null, file: string|null }}
 */
function summary(statement) {
  return {
    id: String(statement.id || ""),
    name: typeof statement.name === "string" ? statement.name : null,
    status: typeof statement.status === "string" ? statement.status : null,
    file: typeof statement.loc?.file === "string" ? statement.loc.file : null
  };
}

/**
 * @param {Map<string, AnyRecord[]>} map
 * @param {string} key
 * @param {AnyRecord} value
 */
function pushMap(map, key, value) {
  const values = map.get(key) || [];
  values.push(value);
  map.set(key, values);
}

/**
 * @param {AnyRecord} graph
 * @param {string} id
 * @returns {AnyRecord|null}
 */
function byId(graph, id) {
  const value = graph?.byId?.get ? graph.byId.get(id) : graph?.byId?.[id];
  if (value && typeof value === "object") {
    return value;
  }
  const byKind = graph?.byKind || {};
  for (const statements of Object.values(byKind)) {
    if (!Array.isArray(statements)) {
      continue;
    }
    const found = statements.find((statement) => statement?.id === id);
    if (found && typeof found === "object") {
      return found;
    }
  }
  return value && typeof value === "object" ? value : null;
}

/**
 * Reports SDLC status hygiene issues that are easy to miss after implementation:
 * draft requirements or acceptance criteria that already have completed task
 * evidence, and approved acceptance criteria whose parent requirement is still
 * draft. The audit is read-only.
 *
 * @param {string} workspaceRoot
 * @param {AnyRecord} resolved
 * @returns {AnyRecord}
 */
export function auditWorkspace(workspaceRoot, resolved) {
  const graph = resolved.graph || {};
  const byKind = graph.byKind || {};
  /** @type {AnyRecord[]} */
  const tasks = Array.isArray(byKind.task) ? byKind.task : [];
  /** @type {AnyRecord[]} */
  const requirements = Array.isArray(byKind.requirement) ? byKind.requirement : [];
  /** @type {AnyRecord[]} */
  const acceptanceCriteria = Array.isArray(byKind.acceptance_criterion) ? byKind.acceptance_criterion : [];
  /** @type {AnyRecord[]} */
  const pitches = Array.isArray(byKind.pitch) ? byKind.pitch : [];

  const doneTasks = tasks.filter((task) => DONE_TASK_STATUSES.has(String(task.status || "")));
  /** @type {Map<string, AnyRecord[]>} */
  const doneTasksByRequirement = new Map();
  /** @type {Map<string, AnyRecord[]>} */
  const doneTasksByAcceptance = new Map();

  for (const task of doneTasks) {
    for (const id of refIds(task.satisfies)) {
      pushMap(doneTasksByRequirement, id, task);
    }
    for (const id of refIds(task.acceptanceRefs)) {
      pushMap(doneTasksByAcceptance, id, task);
    }
  }

  const draftRequirementsWithCompletedTasks = requirements
    .filter((requirement) => requirement.status === "draft" && doneTasksByRequirement.has(String(requirement.id || "")))
    .map((requirement) => ({
      ...summary(requirement),
      completedTasks: (doneTasksByRequirement.get(String(requirement.id || "")) || []).map(summary),
      recommendedCommand: `topogram sdlc transition ${requirement.id} in-review . --actor <actor> --note "<reason>"`
    }));

  const draftAcceptanceCriteriaWithCompletedTasks = acceptanceCriteria
    .filter((criterion) => criterion.status === "draft" && doneTasksByAcceptance.has(String(criterion.id || "")))
    .map((criterion) => ({
      ...summary(criterion),
      completedTasks: (doneTasksByAcceptance.get(String(criterion.id || "")) || []).map(summary),
      recommendedCommand: `topogram sdlc transition ${criterion.id} approved . --actor <actor> --note "<reason>"`
    }));

  const approvedAcceptanceCriteriaWithDraftRequirements = acceptanceCriteria
    .filter((criterion) => {
      if (criterion.status !== "approved") {
        return false;
      }
      const requirementId = criterion.requirement?.id || "";
      const requirement = requirementId ? byId(graph, requirementId) : null;
      return requirement?.status === "draft";
    })
    .map((criterion) => {
      const requirement = byId(graph, criterion.requirement?.id || "");
      return {
        ...summary(criterion),
        requirement: requirement ? summary(requirement) : null,
        recommendedCommand: requirement
          ? `topogram sdlc transition ${requirement.id} in-review . --actor <actor> --note "<reason>"`
          : null
      };
    });

  const doneTasksWithDraftReferences = doneTasks
    .map((task) => {
      const draftRequirements = refIds(task.satisfies)
        .map((id) => byId(graph, id))
        .filter((statement) => statement?.status === "draft")
        .map((statement) => summary(/** @type {AnyRecord} */ (statement)));
      const draftAcceptanceCriteria = refIds(task.acceptanceRefs)
        .map((id) => byId(graph, id))
        .filter((statement) => statement?.status === "draft")
        .map((statement) => summary(/** @type {AnyRecord} */ (statement)));
      return {
        ...summary(task),
        draftRequirements,
        draftAcceptanceCriteria
      };
    })
    .filter((task) => task.draftRequirements.length > 0 || task.draftAcceptanceCriteria.length > 0);

  const counts = {
    draftRequirementsWithCompletedTasks: draftRequirementsWithCompletedTasks.length,
    draftAcceptanceCriteriaWithCompletedTasks: draftAcceptanceCriteriaWithCompletedTasks.length,
    approvedAcceptanceCriteriaWithDraftRequirements: approvedAcceptanceCriteriaWithDraftRequirements.length,
    doneTasksWithDraftReferences: doneTasksWithDraftReferences.length,
    remainingDraftPitches: pitches.filter((pitch) => pitch.status === "draft").length,
    remainingDraftRequirements: requirements.filter((requirement) => requirement.status === "draft").length,
    remainingDraftAcceptanceCriteria: acceptanceCriteria.filter((criterion) => criterion.status === "draft").length
  };
  const actionableFindings =
    counts.draftRequirementsWithCompletedTasks +
    counts.draftAcceptanceCriteriaWithCompletedTasks +
    counts.approvedAcceptanceCriteriaWithDraftRequirements +
    counts.doneTasksWithDraftReferences;

  return {
    type: "sdlc_audit",
    version: "1",
    ok: actionableFindings === 0,
    workspaceRoot,
    counts,
    findings: {
      draftRequirementsWithCompletedTasks,
      draftAcceptanceCriteriaWithCompletedTasks,
      approvedAcceptanceCriteriaWithDraftRequirements,
      doneTasksWithDraftReferences
    },
    remainingDrafts: {
      pitches: pitches.filter((pitch) => pitch.status === "draft").map(summary),
      requirements: requirements.filter((requirement) => requirement.status === "draft").map(summary),
      acceptanceCriteria: acceptanceCriteria.filter((criterion) => criterion.status === "draft").map(summary)
    },
    nextCommands: [
      "topogram sdlc check --strict",
      "topogram sdlc prep commit . --json"
    ]
  };
}
