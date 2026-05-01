import {
  buildDefaultWriteScope,
  componentById,
  ensureContextSelection,
  getJourneyDoc,
  getStatement,
  getWorkflowDoc,
  relatedCapabilitiesForEntity,
  relatedCapabilitiesForProjection,
  relatedJourneysForCapability,
  relatedProjectionsForCapability,
  relatedProjectionsForComponent,
  relatedProjectionsForEntity,
  relatedRulesForTarget,
  relatedShapesForComponent,
  relatedShapesForEntity,
  relatedShapesForProjection,
  relatedWorkflowDocsForCapability,
  relatedEntitiesForProjection,
  recommendedVerificationTargets,
  summarizeById,
  summarizeDocsByIds,
  summarizeProjection,
  summarizeStatementsByIds,
  verificationIdsForTarget
} from "./shared.js";
import {
  defaultOwnershipBoundary,
  reviewBoundaryForCapability,
  reviewBoundaryForEntity,
  reviewBoundaryForJourneyDoc,
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
  const dependencyIds = componentDependencyIdsByKind(component);
  const shapes = relatedShapesForComponent(component);
  const entities = dependencyIds.entity;
  const capabilities = dependencyIds.capability;
  const projections = relatedProjectionsForComponent(graph, componentId);
  const componentDependencies = dependencyIds.component;
  const verificationScope = [componentId, ...shapes, ...entities, ...capabilities, ...projections, ...componentDependencies];
  const verifications = verificationIdsForTarget(graph, verificationScope);

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
      entities,
      capabilities,
      components: componentDependencies,
      projections,
      verifications
    },
    related: {
      shapes: summarizeStatementsByIds(graph, shapes),
      entities: summarizeStatementsByIds(graph, entities),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      components: summarizeStatementsByIds(graph, componentDependencies),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, verificationScope, {
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

function componentDependencyIdsByKind(component) {
  const ids = {
    shape: [],
    entity: [],
    capability: [],
    projection: [],
    component: []
  };

  for (const dependency of component.dependencies || []) {
    const kind = componentDependencyKind(dependency);
    if (kind && Object.hasOwn(ids, kind)) {
      ids[kind].push(dependency.id);
    }
  }

  return Object.fromEntries(
    Object.entries(ids).map(([kind, values]) => [kind, [...new Set(values.filter(Boolean))].sort()])
  );
}

function componentDependencyKind(dependency) {
  if (dependency?.target?.kind) {
    return dependency.target.kind;
  }
  const id = String(dependency?.id || "");
  const prefix = id.split("_")[0];
  if (prefix === "proj") {
    return "projection";
  }
  if (prefix === "cap") {
    return "capability";
  }
  return prefix || null;
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

export function generateContextSlice(graph, options = {}) {
  const selection = ensureContextSelection({
    capabilityId: options.capabilityId,
    workflowId: options.workflowId,
    projectionId: options.projectionId,
    componentId: options.componentId,
    entityId: options.entityId,
    journeyId: options.journeyId,
    surfaceId: options.surfaceId
  });

  if (selection.kind === "capability") {
    return capabilitySlice(graph, selection.id);
  }
  if (selection.kind === "workflow") {
    return workflowSlice(graph, selection.id);
  }
  if (selection.kind === "projection") {
    return projectionSlice(graph, selection.id);
  }
  if (selection.kind === "component") {
    return componentSlice(graph, selection.id);
  }
  if (selection.kind === "entity") {
    return entitySlice(graph, selection.id);
  }
  if (selection.kind === "journey") {
    return journeySlice(graph, selection.id);
  }

  throw new Error(`Unsupported context slice kind '${selection.kind}'`);
}
