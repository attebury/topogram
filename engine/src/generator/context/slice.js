import {
  acceptanceCriterionById,
  bugById,
  buildDefaultWriteScope,
  componentById,
  documentById,
  domainById,
  ensureContextSelection,
  getJourneyDoc,
  getStatement,
  getWorkflowDoc,
  pitchById,
  relatedCapabilitiesForEntity,
  relatedCapabilitiesForProjection,
  relatedEntitiesForDomain,
  relatedJourneysForCapability,
  relatedProjectionsForCapability,
  relatedProjectionsForComponent,
  relatedProjectionsForDomain,
  relatedProjectionsForEntity,
  relatedRulesForDomain,
  relatedRulesForTarget,
  relatedShapesForComponent,
  relatedShapesForEntity,
  relatedShapesForProjection,
  relatedVerificationsForDomain,
  relatedWorkflowDocsForCapability,
  relatedEntitiesForProjection,
  recommendedVerificationTargets,
  requirementById,
  summarizeAcceptanceCriterion,
  summarizeBug,
  summarizeById,
  summarizeDocsByIds,
  summarizeDocument,
  summarizeDomain,
  summarizePitch,
  summarizeProjection,
  summarizeRequirement,
  summarizeStatementsByIds,
  summarizeTask,
  taskById,
  verificationIdsForTarget
} from "./shared.js";
import {
  defaultOwnershipBoundary,
  reviewBoundaryForAcceptanceCriterion,
  reviewBoundaryForBug,
  reviewBoundaryForCapability,
  reviewBoundaryForDocument,
  reviewBoundaryForDomain,
  reviewBoundaryForEntity,
  reviewBoundaryForJourneyDoc,
  reviewBoundaryForPitch,
  reviewBoundaryForRequirement,
  reviewBoundaryForTask,
  reviewBoundaryForWorkflowDoc
} from "../../policy/review-boundaries.js";

function capabilitySlice(graph, capabilityId) {
  const capability = getStatement(graph, "capability", capabilityId);
  const shapes = [...new Set([...(capability.input || []).map((item) => item.id), ...(capability.output || []).map((item) => item.id)])].sort();
  const entities = [...new Set([
    ...(capability.reads || []).map((item) => item.id),
    ...(capability.creates || []).map((item) => item.id),
    ...(capability.updates || []).map((item) => item.id),
    ...(capability.deletes || []).map((item) => item.id)
  ])].sort();
  const rules = relatedRulesForTarget(graph, capabilityId);
  const workflows = relatedWorkflowDocsForCapability(graph, capabilityId).map((doc) => doc.id).sort();
  const projections = relatedProjectionsForCapability(graph, capabilityId);
  const journeys = relatedJourneysForCapability(graph, capabilityId).map((doc) => doc.id).sort();
  const verifications = verificationIdsForTarget(graph, [capabilityId, ...projections, ...shapes, ...entities]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "capability",
      id: capabilityId
    },
    summary: summarizeById(graph, capabilityId),
    depends_on: {
      shapes,
      entities,
      rules,
      workflows,
      projections,
      journeys,
      verifications
    },
    related: {
      shapes: summarizeStatementsByIds(graph, shapes),
      entities: summarizeStatementsByIds(graph, entities),
      rules: summarizeStatementsByIds(graph, rules),
      workflows: summarizeDocsByIds(graph, workflows),
      journeys: summarizeDocsByIds(graph, journeys),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [capabilityId, ...projections, ...shapes, ...entities], {
      rationale: "Capability slice should point agents at the smallest verification set covering affected API/UI/DB surfaces."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForCapability(capability),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function workflowSlice(graph, workflowId) {
  const workflow = getWorkflowDoc(graph, workflowId);
  const capabilities = [...(workflow.relatedCapabilities || [])].sort();
  const entities = [...new Set(capabilities.flatMap((capabilityId) => {
    const capability = getStatement(graph, "capability", capabilityId);
    return [
      ...(capability.reads || []).map((item) => item.id),
      ...(capability.creates || []).map((item) => item.id),
      ...(capability.updates || []).map((item) => item.id),
      ...(capability.deletes || []).map((item) => item.id)
    ];
  }))].sort();
  const rules = [...new Set(capabilities.flatMap((capabilityId) => relatedRulesForTarget(graph, capabilityId)))].sort();
  const journeys = (graph.docs || [])
    .filter((doc) => doc.kind === "journey" && (doc.relatedWorkflows || []).includes(workflowId))
    .map((doc) => doc.id)
    .sort();
  const verifications = verificationIdsForTarget(graph, [...capabilities, ...entities, workflowId]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "workflow",
      id: workflowId
    },
    summary: summarizeById(graph, workflowId),
    depends_on: {
      capabilities,
      entities,
      rules,
      journeys,
      verifications
    },
    related: {
      capabilities: summarizeStatementsByIds(graph, capabilities),
      entities: summarizeStatementsByIds(graph, entities),
      rules: summarizeStatementsByIds(graph, rules),
      journeys: summarizeDocsByIds(graph, journeys)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [...capabilities, ...entities, workflowId], {
      rationale: "Workflow changes should re-run workflow-linked verification and human review on semantic behavior."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForWorkflowDoc(workflow),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function projectionSlice(graph, projectionId) {
  const projection = getStatement(graph, "projection", projectionId);
  const capabilities = relatedCapabilitiesForProjection(projection);
  const entities = relatedEntitiesForProjection(projection);
  const shapes = relatedShapesForProjection(projection);
  const rules = [...new Set(capabilities.flatMap((capabilityId) => relatedRulesForTarget(graph, capabilityId)))].sort();
  const verifications = verificationIdsForTarget(graph, [projectionId, ...capabilities, ...entities, ...shapes]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "projection",
      id: projectionId
    },
    summary: summarizeProjection(projection),
    depends_on: {
      entities,
      shapes,
      capabilities,
      rules,
      verifications
    },
    related: {
      entities: summarizeStatementsByIds(graph, entities),
      shapes: summarizeStatementsByIds(graph, shapes),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      rules: summarizeStatementsByIds(graph, rules)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [projectionId, ...capabilities, ...entities, ...shapes], {
      rationale: "Projection slices affect generated contract and runtime surfaces, so verification should follow the projection closure."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: projection.reviewBoundary || {
      automation_class: "review_required",
      reasons: ["projection_surface"]
    },
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function entitySlice(graph, entityId) {
  const entity = getStatement(graph, "entity", entityId);
  const shapes = relatedShapesForEntity(graph, entityId);
  const capabilities = relatedCapabilitiesForEntity(graph, entityId);
  const rules = [...new Set([
    ...relatedRulesForTarget(graph, entityId),
    ...capabilities.flatMap((capabilityId) => relatedRulesForTarget(graph, capabilityId))
  ])].sort();
  const projections = relatedProjectionsForEntity(graph, entityId);
  const verifications = verificationIdsForTarget(graph, [entityId, ...shapes, ...capabilities, ...projections]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "entity",
      id: entityId
    },
    summary: summarizeById(graph, entityId),
    depends_on: {
      shapes,
      capabilities,
      rules,
      projections,
      verifications
    },
    related: {
      shapes: summarizeStatementsByIds(graph, shapes),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      rules: summarizeStatementsByIds(graph, rules),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [entityId, ...shapes, ...capabilities, ...projections], {
      rationale: "Entity changes usually affect schema, projection, and capability semantics together."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: reviewBoundaryForEntity(entity),
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function componentSlice(graph, componentId) {
  const component = componentById(graph, componentId);
  if (!component) {
    throw new Error(`No component found with id '${componentId}'`);
  }
  const shapes = relatedShapesForComponent(component);
  const projections = relatedProjectionsForComponent(graph, componentId);
  const componentDependencies = [...new Set((component.dependencies || [])
    .filter((dep) => dep?.target?.kind === "component" || String(dep?.id || "").startsWith("component_"))
    .map((dep) => dep.id))].sort();
  const verifications = verificationIdsForTarget(graph, [componentId, ...projections, ...shapes]);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "component",
      id: componentId
    },
    summary: summarizeById(graph, componentId),
    depends_on: {
      shapes,
      components: componentDependencies,
      projections,
      verifications
    },
    related: {
      shapes: summarizeStatementsByIds(graph, shapes),
      components: summarizeStatementsByIds(graph, componentDependencies),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [componentId, ...projections, ...shapes], {
      rationale: "Component changes affect every consumer projection — verification should follow the component contract closure."
    }),
    write_scope: buildDefaultWriteScope(),
    review_boundary: {
      automation_class: "review_required",
      reasons: ["component_surface"]
    },
    ownership_boundary: defaultOwnershipBoundary()
  };
}

function journeySlice(graph, journeyId) {
  const journey = getJourneyDoc(graph, journeyId);
  const capabilities = [...(journey.relatedCapabilities || [])].sort();
  const workflows = [...(journey.relatedWorkflows || [])].sort();
  const projections = [...(journey.relatedProjections || [])].sort();
  const verifications = verificationIdsForTarget(graph, [...capabilities, ...workflows, ...projections, journeyId]);

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
      workflows,
      projections,
      verifications
    },
    related: {
      capabilities: summarizeStatementsByIds(graph, capabilities),
      workflows: summarizeDocsByIds(graph, workflows),
      projections: summarizeStatementsByIds(graph, projections)
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

function domainSlice(graph, domainId) {
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
        "Domain slices should re-run verification covering the domain's capabilities, entities, and platform projections."
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

function pitchSlice(graph, pitchId) {
  const pitch = pitchById(graph, pitchId);
  if (!pitch) throw new Error(`No pitch found with id '${pitchId}'`);

  const requirements = (pitch.requirements || []).slice().sort();
  const decisions = [
    ...(pitch.decisions || []).map((d) => (typeof d === "string" ? d : d?.id)).filter(Boolean),
    ...(pitch.decisionsFromPitch || [])
  ];
  const decisionIds = [...new Set(decisions)].sort();
  const affects = (pitch.affects || []).map((a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort();
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

function requirementSlice(graph, requirementId) {
  const req = requirementById(graph, requirementId);
  if (!req) throw new Error(`No requirement found with id '${requirementId}'`);

  const acceptance = (req.acceptanceCriteria || []).slice().sort();
  const tasks = (req.tasks || []).slice().sort();
  const documents = (req.documents || []).slice().sort();
  const rules = (req.rules || []).slice().sort();
  const introducesRules = (req.introducesRules || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const respectsRules = (req.respectsRules || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const affects = (req.affects || []).map((a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort();
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

function acceptanceCriterionSlice(graph, acId) {
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

function taskSlice(graph, taskId) {
  const task = taskById(graph, taskId);
  if (!task) throw new Error(`No task found with id '${taskId}'`);

  const satisfies = (task.satisfies || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const acRefs = (task.acceptanceRefs || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const blockedBy = (task.blockedBy || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const blocks = (task.blocks || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const affects = (task.affects || []).map((a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort();
  const verifications = verificationIdsForTarget(graph, [taskId, ...affects, ...acRefs]);

  return {
    type: "context_slice",
    version: 1,
    focus: { kind: "task", id: taskId },
    summary: summarizeTask(task),
    depends_on: {
      satisfies,
      acceptance_refs: acRefs,
      blocked_by: blockedBy,
      blocks,
      affects,
      verifications
    },
    related: {
      satisfies: summarizeStatementsByIds(graph, satisfies),
      acceptance_refs: summarizeStatementsByIds(graph, acRefs),
      blocked_by: summarizeStatementsByIds(graph, blockedBy),
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

function bugSlice(graph, bugId) {
  const bug = bugById(graph, bugId);
  if (!bug) throw new Error(`No bug found with id '${bugId}'`);

  const violates = (bug.violates || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const surfacesRule = (bug.surfacesRule || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const fixedIn = (bug.fixedIn || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const fixedInVerification = (bug.fixedInVerification || []).map((r) => (typeof r === "string" ? r : r?.id)).filter(Boolean).sort();
  const verifiedBy = (bug.verifiedBy || []).slice().sort();
  const affects = (bug.affects || []).map((a) => (typeof a === "string" ? a : a?.id)).filter(Boolean).sort();
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

function documentSlice(graph, documentId) {
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

export function generateContextSlice(graph, options = {}) {
  const selection = ensureContextSelection({
    capabilityId: options.capabilityId,
    workflowId: options.workflowId,
    projectionId: options.projectionId,
    componentId: options.componentId,
    entityId: options.entityId,
    journeyId: options.journeyId,
    surfaceId: options.surfaceId,
    domainId: options.domainId,
    pitchId: options.pitchId,
    requirementId: options.requirementId,
    acceptanceId: options.acceptanceId,
    taskId: options.taskId,
    bugId: options.bugId,
    documentId: options.documentId
  });

  if (selection.kind === "capability") return capabilitySlice(graph, selection.id);
  if (selection.kind === "workflow") return workflowSlice(graph, selection.id);
  if (selection.kind === "projection") return projectionSlice(graph, selection.id);
  if (selection.kind === "component") return componentSlice(graph, selection.id);
  if (selection.kind === "entity") return entitySlice(graph, selection.id);
  if (selection.kind === "journey") return journeySlice(graph, selection.id);
  if (selection.kind === "domain") return domainSlice(graph, selection.id);
  if (selection.kind === "pitch") return pitchSlice(graph, selection.id);
  if (selection.kind === "requirement") return requirementSlice(graph, selection.id);
  if (selection.kind === "acceptance_criterion") return acceptanceCriterionSlice(graph, selection.id);
  if (selection.kind === "task") return taskSlice(graph, selection.id);
  if (selection.kind === "bug") return bugSlice(graph, selection.id);
  if (selection.kind === "document") return documentSlice(graph, selection.id);

  throw new Error(`Unsupported context slice kind '${selection.kind}'`);
}
