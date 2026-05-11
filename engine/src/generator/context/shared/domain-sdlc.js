import { stableSortedStrings } from "./primitives.js";

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} domainId
 * @returns {any}
 */
export function domainById(graph, domainId) {
  return (graph?.byKind?.domain || []).find(/** @param {import("./types.d.ts").ContextStatement} domain */ (domain) => domain.id === domainId) || null;
}

/**
 * @param {import("./types.d.ts").ContextStatement | null} domain
 * @returns {any}
 */
export function summarizeDomain(domain) {
  if (!domain) return null;
  const members = domain.members || {};
  return {
    id: domain.id,
    kind: "domain",
    name: domain.name,
    description: domain.description,
    status: domain.status,
    in_scope: [...(domain.inScope || [])],
    out_of_scope: [...(domain.outOfScope || [])],
    aliases: [...(domain.aliases || [])],
    parent_domain: domain.parentDomain ? domain.parentDomain.id : null,
    members_count: Object.values(members).reduce(/** @param {any} total @param {any} list */ (total, list) => total + list.length, 0)
  };
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @returns {any}
 */
export function domainsByStatement(graph) {
  const map = new Map();
  for (const statement of (graph?.statements || [])) {
    if (statement.resolvedDomain && statement.resolvedDomain.id) {
      map.set(statement.id, statement.resolvedDomain.id);
    }
  }
  return map;
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} domainId
 * @returns {any}
 */
export function relatedCapabilitiesForDomain(graph, domainId) {
  const domain = domainById(graph, domainId);
  if (!domain) return [];
  return [...(domain.members?.capabilities || [])].sort();
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} domainId
 * @returns {any}
 */
export function relatedEntitiesForDomain(graph, domainId) {
  const domain = domainById(graph, domainId);
  if (!domain) return [];
  return [...(domain.members?.entities || [])].sort();
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} domainId
 * @returns {any}
 */
export function relatedRulesForDomain(graph, domainId) {
  const domain = domainById(graph, domainId);
  if (!domain) return [];
  return [...(domain.members?.rules || [])].sort();
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} domainId
 * @returns {any}
 */
export function relatedVerificationsForDomain(graph, domainId) {
  const domain = domainById(graph, domainId);
  if (!domain) return [];
  return [...(domain.members?.verifications || [])].sort();
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} domainId
 * @returns {any}
 */
export function relatedProjectionsForDomain(graph, domainId) {
  const capabilityIds = new Set(relatedCapabilitiesForDomain(graph, domainId));
  if (capabilityIds.size === 0) return [];
  const projectionIds = (graph?.byKind?.projection || [])
    .filter(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => (projection.realizes || []).some(/** @param {any} entry */ (entry) => capabilityIds.has(entry.id)))
    .map(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => projection.id);
  return stableSortedStrings(projectionIds);
}

// Phase 2 SDLC look-up helpers. Mirror the existing `*ById` pattern.
/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any}
 */
export function pitchById(graph, id) {
  return (graph?.byKind?.pitch || []).find(/** @param {any} s */ (s) => s.id === id) || null;
}
/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any}
 */
export function requirementById(graph, id) {
  return (graph?.byKind?.requirement || []).find(/** @param {any} s */ (s) => s.id === id) || null;
}
/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any}
 */
export function acceptanceCriterionById(graph, id) {
  return (graph?.byKind?.acceptance_criterion || []).find(/** @param {any} s */ (s) => s.id === id) || null;
}
/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any}
 */
export function taskById(graph, id) {
  return (graph?.byKind?.task || []).find(/** @param {any} s */ (s) => s.id === id) || null;
}
/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any}
 */
export function planById(graph, id) {
  return (graph?.byKind?.plan || []).find(/** @param {any} s */ (s) => s.id === id) || null;
}
/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any}
 */
export function bugById(graph, id) {
  return (graph?.byKind?.bug || []).find(/** @param {any} s */ (s) => s.id === id) || null;
}
/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any}
 */
export function documentById(graph, id) {
  return (graph?.docs || []).find(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.id === id) || null;
}

/**
 * @param {any} pitch
 * @returns {any}
 */
export function summarizePitch(pitch) {
  if (!pitch) return null;
  return {
    id: pitch.id,
    name: pitch.name,
    status: pitch.status,
    priority: pitch.priority,
    appetite: pitch.appetite,
    domain: pitch.resolvedDomain ? pitch.resolvedDomain.id : null
  };
}
/**
 * @param {any} req
 * @returns {any}
 */
export function summarizeRequirement(req) {
  if (!req) return null;
  return {
    id: req.id,
    name: req.name,
    status: req.status,
    priority: req.priority,
    pitch: req.pitch?.id || null,
    domain: req.resolvedDomain ? req.resolvedDomain.id : null
  };
}
/**
 * @param {any} ac
 * @returns {any}
 */
export function summarizeAcceptanceCriterion(ac) {
  if (!ac) return null;
  return {
    id: ac.id,
    name: ac.name,
    status: ac.status,
    requirement: ac.requirement?.id || null
  };
}
/**
 * @param {any} task
 * @returns {any}
 */
export function summarizeTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    priority: task.priority,
    work_type: task.workType,
    disposition: task.disposition || null,
    claimed_by: (task.claimedBy || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean),
    domain: task.resolvedDomain ? task.resolvedDomain.id : null
  };
}
/**
 * @param {any} plan
 * @returns {any}
 */
export function summarizePlan(plan) {
  if (!plan) return null;
  const steps = plan.steps || [];
  return {
    id: plan.id,
    name: plan.name,
    status: plan.status,
    priority: plan.priority,
    task: plan.task?.id || null,
    step_count: steps.length,
    incomplete_steps: steps.filter(/** @param {any} step */ (step) => step.status !== "done" && step.status !== "skipped").map(/** @param {any} step */ (step) => step.id),
    domain: plan.resolvedDomain ? plan.resolvedDomain.id : null
  };
}
/**
 * @param {any} bug
 * @returns {any}
 */
export function summarizeBug(bug) {
  if (!bug) return null;
  return {
    id: bug.id,
    name: bug.name,
    status: bug.status,
    severity: bug.severity,
    priority: bug.priority,
    domain: bug.resolvedDomain ? bug.resolvedDomain.id : null
  };
}
/**
 * @param {import("./types.d.ts").ContextDoc} doc
 * @returns {any}
 */
export function summarizeDocument(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    status: doc.status,
    domain: doc.domain || null
  };
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {any} workflowId
 * @returns {any}
 */
export function getWorkflowDoc(graph, workflowId) {
  const doc = (graph.docs || []).find(/** @param {any} item */ (item) => item.kind === "workflow" && item.id === workflowId);
  if (!doc) {
    throw new Error(`No workflow doc found with id '${workflowId}'`);
  }
  return doc;
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {any} journeyId
 * @returns {any}
 */
export function getJourneyDoc(graph, journeyId) {
  const doc = (graph.docs || []).find(/** @param {any} item */ (item) => item.kind === "journey" && item.id === journeyId);
  if (!doc) {
    throw new Error(`No journey doc found with id '${journeyId}'`);
  }
  return doc;
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {any} kind
 * @param {string} id
 * @returns {any}
 */
export function getStatement(graph, kind, id) {
  const statement = (graph.byKind[kind] || []).find(/** @param {any} item */ (item) => item.id === id);
  if (!statement) {
    throw new Error(`No ${kind} found with id '${id}'`);
  }
  return statement;
}
