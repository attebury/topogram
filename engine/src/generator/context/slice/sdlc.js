// @ts-check

import {
  acceptanceCriterionById,
  bugById,
  buildDefaultWriteScope,
  documentById,
  domainById,
  getJourneyDoc,
  pitchById,
  planById,
  recommendedVerificationTargets,
  relatedEntitiesForDomain,
  relatedProjectionsForDomain,
  relatedRulesForDomain,
  relatedVerificationsForDomain,
  requirementById,
  summarizeAcceptanceCriterion,
  summarizeBug,
  summarizeById,
  summarizeDocsByIds,
  summarizeDocument,
  summarizeDomain,
  summarizePitch,
  summarizePlan,
  summarizeRequirement,
  summarizeStatementsByIds,
  summarizeTask,
  taskById,
  verificationIdsForTarget
} from "../shared.js";
import {
  defaultOwnershipBoundary,
  reviewBoundaryForAcceptanceCriterion,
  reviewBoundaryForBug,
  reviewBoundaryForDocument,
  reviewBoundaryForDomain,
  reviewBoundaryForJourneyDoc,
  reviewBoundaryForPitch,
  reviewBoundaryForRequirement,
  reviewBoundaryForTask
} from "../../../policy/review-boundaries.js";

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} journeyId
 * @returns {any}
 */
export function journeySlice(graph, journeyId) {
  const journey = getJourneyDoc(graph, journeyId);
  const capabilities = [...(journey.relatedCapabilities || [])].sort();
  const entities = [...(journey.relatedEntities || [])].sort();
  const rules = [...(journey.relatedRules || [])].sort();
  const workflows = [...(journey.relatedWorkflows || [])].sort();
  const projections = [...(journey.relatedProjections || [])].sort();
  const widgets = [...(journey.relatedWidgets || [])].sort();
  const declaredVerifications = [...(journey.relatedVerifications || [])].sort();
  const verifications = [...new Set([
    ...declaredVerifications,
    ...verificationIdsForTarget(graph, [...capabilities, ...workflows, ...projections, ...widgets, journeyId])
  ])].sort();

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "journey",
      id: journeyId
    },
    summary: summarizeById(graph, journeyId),
    depends_on: {
      capabilities,
      entities,
      rules,
      workflows,
      projections,
      widgets,
      verifications
    },
    steps: (journey.steps || []).map(/** @param {any} step */ (step) => ({
      id: step.id,
      intent: step.intent,
      commands: [...(step.commands || [])],
      expects: [...(step.expects || [])],
      after: [...(step.after || [])],
      notes: step.notes || null
    })),
    alternates: (journey.alternates || []).map(/** @param {any} alternate */ (alternate) => ({
      id: alternate.id,
      from: alternate.from,
      condition: alternate.condition,
      commands: [...(alternate.commands || [])],
      expects: [...(alternate.expects || [])],
      notes: alternate.notes || null
    })),
    related: {
      capabilities: summarizeStatementsByIds(graph, capabilities),
      entities: summarizeStatementsByIds(graph, entities),
      rules: summarizeStatementsByIds(graph, rules),
      workflows: summarizeDocsByIds(graph, workflows),
      projections: summarizeStatementsByIds(graph, projections),
      widgets: summarizeStatementsByIds(graph, widgets)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [...capabilities, ...workflows, ...projections, journeyId], {
      rationale: "Journey slices should target workflow-facing verification rather than a full workspace rerun."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForJourneyDoc(journey),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} domainId
 * @returns {any}
 */
export function domainSlice(graph, domainId) {
  const domain = domainById(graph, domainId);
  if (!domain) {
    throw new Error(`No domain found with id '${domainId}'`);
  }
  const capabilities = [...(domain.members?.capabilities || [])].sort();
  const entities = relatedEntitiesForDomain(graph, domainId);
  const rules = relatedRulesForDomain(graph, domainId);
  const verifications = relatedVerificationsForDomain(graph, domainId);
  const orchestrations = [...(domain.members?.orchestrations || [])].sort();
  const operations = [...(domain.members?.operations || [])].sort();
  const decisions = [...(domain.members?.decisions || [])].sort();
  const projections = relatedProjectionsForDomain(graph, domainId);

  // Verification targets cover the union of capability/entity/projection IDs in
  // the domain so a domain-scoped change re-runs the right verification set
  // without pulling in the whole workspace.
  const verificationTargets = recommendedVerificationTargets(
    graph,
    [domainId, ...capabilities, ...entities, ...projections],
    {
      rationale:
        "Domain slices should re-run verification covering the domain's capabilities, entities, and projection types."
    }
  );

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "domain",
      id: domainId
    },
    summary: summarizeDomain(domain),
    depends_on: {
      capabilities,
      entities,
      rules,
      verifications,
      orchestrations,
      operations,
      decisions,
      projections
    },
    related: {
      capabilities: summarizeStatementsByIds(graph, capabilities),
      entities: summarizeStatementsByIds(graph, entities),
      rules: summarizeStatementsByIds(graph, rules),
      orchestrations: summarizeStatementsByIds(graph, orchestrations),
      operations: summarizeStatementsByIds(graph, operations),
      decisions: summarizeStatementsByIds(graph, decisions),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: verificationTargets,
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForDomain(),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

// Phase 2 — SDLC slices.
//
// SDLC slices follow the same shape as feature slices: focus + summary +
// depends_on + related + verification + write_scope + review_boundary. They
// give an agent a single payload covering an artifact's chain (pitch →
// requirement → AC → task → bug → verification → document) without
// re-walking the graph.

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} pitchId
 * @returns {any}
 */
export function pitchSlice(graph, pitchId) {
  const pitch = pitchById(graph, pitchId);
  if (!pitch) throw new Error(`No pitch found with id '${pitchId}'`);

  const requirements = (pitch.requirements || []).slice().sort();
  const decisions = [
    ...(pitch.decisions || []).map(/** @param {any} d */ (d) => (typeof d === "string" ? d : d?.id)).filter(Boolean),
    ...(pitch.decisionsFromPitch || [])
  ];
  const decisionIds = [...new Set(decisions)].sort();
  const affects = (pitch.affects || []).map(/** @param {any} a */ (a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort();
  const verifications = verificationIdsForTarget(graph, [pitchId, ...affects]);

  return {
    type: "context_slice",
    version: 1,
    focus: { kind: "pitch", id: pitchId },
    summary: summarizePitch(pitch),
    depends_on: {
      requirements,
      decisions: decisionIds,
      affects,
      verifications
    },
    related: {
      requirements: summarizeStatementsByIds(graph, requirements),
      decisions: summarizeStatementsByIds(graph, decisionIds),
      affects: summarizeStatementsByIds(graph, affects)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [pitchId, ...affects], {
      rationale: "Pitch slice covers verification touching any of its affected surfaces."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForPitch(),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} requirementId
 * @returns {any}
 */
export function requirementSlice(graph, requirementId) {
  const req = requirementById(graph, requirementId);
  if (!req) throw new Error(`No requirement found with id '${requirementId}'`);

  const acceptance = (req.acceptanceCriteria || []).slice().sort();
  const tasks = (req.tasks || []).slice().sort();
  const documents = (req.documents || []).slice().sort();
  const rules = (req.rules || []).slice().sort();
  const introducesRules = (req.introducesRules || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const respectsRules = (req.respectsRules || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const affects = (req.affects || []).map(/** @param {any} a */ (a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort();
  const verifications = verificationIdsForTarget(graph, [requirementId, ...affects, ...acceptance]);

  return {
    type: "context_slice",
    version: 1,
    focus: { kind: "requirement", id: requirementId },
    summary: summarizeRequirement(req),
    depends_on: {
      pitch: req.pitch?.id || null,
      acceptance_criteria: acceptance,
      tasks,
      documents,
      rules,
      introduces_rules: introducesRules,
      respects_rules: respectsRules,
      affects,
      verifications
    },
    related: {
      acceptance_criteria: summarizeStatementsByIds(graph, acceptance),
      tasks: summarizeStatementsByIds(graph, tasks),
      rules: summarizeStatementsByIds(graph, [...rules, ...introducesRules, ...respectsRules]),
      affects: summarizeStatementsByIds(graph, affects),
      documents: summarizeDocsByIds(graph, documents)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [requirementId, ...affects, ...acceptance], {
      rationale: "Requirement slice covers verification tied to its acceptance criteria and affected surfaces."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForRequirement(),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} acId
 * @returns {any}
 */
export function acceptanceCriterionSlice(graph, acId) {
  const ac = acceptanceCriterionById(graph, acId);
  if (!ac) throw new Error(`No acceptance_criterion found with id '${acId}'`);

  const tasks = (ac.tasks || []).slice().sort();
  const verifications = (ac.verifications || []).slice().sort();
  const requirementId = ac.requirement?.id || null;

  return {
    type: "context_slice",
    version: 1,
    focus: { kind: "acceptance_criterion", id: acId },
    summary: summarizeAcceptanceCriterion(ac),
    depends_on: {
      requirement: requirementId,
      tasks,
      verifications
    },
    related: {
      tasks: summarizeStatementsByIds(graph, tasks),
      requirement: requirementId ? summarizeStatementsByIds(graph, [requirementId]) : []
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [acId, ...(requirementId ? [requirementId] : [])], {
      rationale: "AC slice points at verification proving this acceptance criterion."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForAcceptanceCriterion(),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} taskId
 * @returns {any}
 */
export function taskSlice(graph, taskId) {
  const task = taskById(graph, taskId);
  if (!task) throw new Error(`No task found with id '${taskId}'`);

  const satisfies = (task.satisfies || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const acRefs = (task.acceptanceRefs || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const verificationRefs = (task.verificationRefs || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const blockedBy = (task.blockedBy || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const blocks = (task.blocks || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const affects = (task.affects || []).map(/** @param {any} a */ (a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort();
  const plans = (task.plans || []).slice().sort();
  const verifications = [...new Set([...verificationRefs, ...verificationIdsForTarget(graph, [taskId, ...affects, ...acRefs])])].sort();

  return {
    type: "context_slice",
    version: 1,
    focus: { kind: "task", id: taskId },
    summary: summarizeTask(task),
    depends_on: {
      satisfies,
      acceptance_refs: acRefs,
      verification_refs: verificationRefs,
      blocked_by: blockedBy,
      blocks,
      plans,
      affects,
      verifications
    },
    related: {
      satisfies: summarizeStatementsByIds(graph, satisfies),
      acceptance_refs: summarizeStatementsByIds(graph, acRefs),
      verification_refs: summarizeStatementsByIds(graph, verificationRefs),
      blocked_by: summarizeStatementsByIds(graph, blockedBy),
      plans: summarizeStatementsByIds(graph, plans),
      affects: summarizeStatementsByIds(graph, affects)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [taskId, ...affects, ...acRefs], {
      rationale: "Task slice points at verification covering the surfaces this task touches."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForTask(),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} planId
 * @returns {any}
 */
export function planSlice(graph, planId) {
  const plan = planById(graph, planId);
  if (!plan) throw new Error(`No plan found with id '${planId}'`);

  const taskId = plan.task?.id || null;
  const task = taskId ? taskById(graph, taskId) : null;
  const satisfies = task ? (task.satisfies || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort() : [];
  const acRefs = task ? (task.acceptanceRefs || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort() : [];
  const verificationRefs = task ? (task.verificationRefs || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort() : [];
  const affects = task ? (task.affects || []).map(/** @param {any} a */ (a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort() : [];
  const verifications = [...new Set([...verificationRefs, ...verificationIdsForTarget(graph, [planId, ...(taskId ? [taskId] : []), ...affects, ...acRefs])])].sort();

  return {
    type: "context_slice",
    version: 1,
    focus: { kind: "plan", id: planId },
    summary: summarizePlan(plan),
    depends_on: {
      task: taskId,
      satisfies,
      acceptance_refs: acRefs,
      verification_refs: verificationRefs,
      affects,
      verifications
    },
    related: {
      task: task ? [summarizeTask(task)] : [],
      satisfies: summarizeStatementsByIds(graph, satisfies),
      acceptance_refs: summarizeStatementsByIds(graph, acRefs),
      verification_refs: summarizeStatementsByIds(graph, verificationRefs),
      affects: summarizeStatementsByIds(graph, affects)
    },
    steps: plan.steps || [],
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [planId, ...(taskId ? [taskId] : []), ...affects, ...acRefs], {
      rationale: "Plan slice points at verification for the owning task and affected surfaces."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForTask(),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} bugId
 * @returns {any}
 */
export function bugSlice(graph, bugId) {
  const bug = bugById(graph, bugId);
  if (!bug) throw new Error(`No bug found with id '${bugId}'`);

  const violates = (bug.violates || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const surfacesRule = (bug.surfacesRule || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const fixedIn = (bug.fixedIn || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const fixedInVerification = (bug.fixedInVerification || []).map(/** @param {any} r */ (r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const verifiedBy = (bug.verifiedBy || []).slice().sort();
  const affects = (bug.affects || []).map(/** @param {any} a */ (a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort();
  const verifications = [...new Set([...fixedInVerification, ...verifiedBy, ...verificationIdsForTarget(graph, [bugId, ...affects])])].sort();

  return {
    type: "context_slice",
    version: 1,
    focus: { kind: "bug", id: bugId },
    summary: summarizeBug(bug),
    depends_on: {
      violates,
      surfaces_rule: surfacesRule,
      fixed_in: fixedIn,
      fixed_in_verification: fixedInVerification,
      affects,
      verifications
    },
    related: {
      violates: summarizeStatementsByIds(graph, violates),
      affects: summarizeStatementsByIds(graph, affects),
      fixed_in: summarizeStatementsByIds(graph, fixedIn)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [bugId, ...affects, ...violates], {
      rationale: "Bug slice points at verification proving the regression is closed."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForBug(),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} documentId
 * @returns {any}
 */
export function documentSlice(graph, documentId) {
  const doc = documentById(graph, documentId);
  if (!doc) throw new Error(`No document found with id '${documentId}'`);

  const relatedEntities = (doc.relatedEntities || []).slice().sort();
  const relatedCapabilities = (doc.relatedCapabilities || []).slice().sort();
  const relatedProjections = (doc.relatedProjections || []).slice().sort();
  const relatedRules = (doc.relatedRules || []).slice().sort();

  return {
    type: "context_slice",
    version: 1,
    focus: { kind: "document", id: documentId },
    summary: summarizeDocument(doc),
    depends_on: {
      related_entities: relatedEntities,
      related_capabilities: relatedCapabilities,
      related_projections: relatedProjections,
      related_rules: relatedRules
    },
    related: {
      entities: summarizeStatementsByIds(graph, relatedEntities),
      capabilities: summarizeStatementsByIds(graph, relatedCapabilities),
      projections: summarizeStatementsByIds(graph, relatedProjections),
      rules: summarizeStatementsByIds(graph, relatedRules)
    },
    verification: [],
    verification_targets: [],
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForDocument(doc),
    ownership_boundary: defaultOwnershipBoundary()
  };
}
