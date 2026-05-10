// @ts-check

import {
  buildDefaultWriteScope,
  ensureContextSelection,
  getStatement,
  getWorkflowDoc,
  relatedCapabilitiesForEntity,
  relatedCapabilitiesForProjection,
  relatedEntitiesForProjection,
  relatedJourneysForCapability,
  relatedProjectionsForCapability,
  relatedProjectionsForEntity,
  relatedProjectionsForWidget,
  relatedRulesForTarget,
  relatedShapesForEntity,
  relatedShapesForProjection,
  relatedShapesForWidget,
  relatedWidgetsForProjection,
  relatedWorkflowDocsForCapability,
  summarizeById,
  summarizeDocsByIds,
  summarizeProjection,
  summarizeStatementsByIds,
  verificationIdsForTarget,
  recommendedVerificationTargets,
  widgetById
} from "../shared.js";
import {
  defaultOwnershipBoundary,
  reviewBoundaryForCapability,
  reviewBoundaryForEntity,
  reviewBoundaryForWorkflowDoc
} from "../../../policy/review-boundaries.js";
import { uiAgentPacketForProjection, uiAgentPacketForWidget } from "./ui-packets.js";
import {
  acceptanceCriterionSlice,
  bugSlice,
  documentSlice,
  domainSlice,
  journeySlice,
  pitchSlice,
  requirementSlice,
  taskSlice
} from "./sdlc.js";

/**
 * @param {any} graph
 * @param {any} capabilityId
 * @returns {any}
 */
function capabilitySlice(graph, capabilityId) {
  const capability = getStatement(graph, "capability", capabilityId);
  const shapes = [...new Set([...(capability.input || []).map(/** @param {any} item */ (item) => item.id), ...(capability.output || []).map(/** @param {any} item */ (item) => item.id)])].sort();
  const entities = [...new Set([
    ...(capability.reads || []).map(/** @param {any} item */ (item) => item.id),
    ...(capability.creates || []).map(/** @param {any} item */ (item) => item.id),
    ...(capability.updates || []).map(/** @param {any} item */ (item) => item.id),
    ...(capability.deletes || []).map(/** @param {any} item */ (item) => item.id)
  ])].sort();
  const rules = relatedRulesForTarget(graph, capabilityId);
  const workflows = relatedWorkflowDocsForCapability(graph, capabilityId).map(/** @param {any} doc */ (doc) => doc.id).sort();
  const projections = relatedProjectionsForCapability(graph, capabilityId);
  const journeys = relatedJourneysForCapability(graph, capabilityId).map(/** @param {any} doc */ (doc) => doc.id).sort();
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

/**
 * @param {any} graph
 * @param {any} workflowId
 * @returns {any}
 */
function workflowSlice(graph, workflowId) {
  const workflow = getWorkflowDoc(graph, workflowId);
  const capabilities = [...(workflow.relatedCapabilities || [])].sort();
  const entities = [...new Set(capabilities.flatMap(/** @param {any} capabilityId */ (capabilityId) => {
    const capability = getStatement(graph, "capability", capabilityId);
    return [
      ...(capability.reads || []).map(/** @param {any} item */ (item) => item.id),
      ...(capability.creates || []).map(/** @param {any} item */ (item) => item.id),
      ...(capability.updates || []).map(/** @param {any} item */ (item) => item.id),
      ...(capability.deletes || []).map(/** @param {any} item */ (item) => item.id)
    ];
  }))].sort();
  const rules = [...new Set(capabilities.flatMap(/** @param {any} capabilityId */ (capabilityId) => relatedRulesForTarget(graph, capabilityId)))].sort();
  const journeys = (graph.docs || [])
    .filter(/** @param {any} doc */ (doc) => doc.kind === "journey" && (doc.relatedWorkflows || []).includes(workflowId))
    .map(/** @param {any} doc */ (doc) => doc.id)
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

/**
 * @param {any} graph
 * @param {any} projectionId
 * @returns {any}
 */
function projectionSlice(graph, projectionId) {
  const projection = getStatement(graph, "projection", projectionId);
  const capabilities = relatedCapabilitiesForProjection(projection);
  const entities = relatedEntitiesForProjection(projection);
  const shapes = relatedShapesForProjection(projection);
  const widgets = relatedWidgetsForProjection(graph, projection);
  const rules = [...new Set(capabilities.flatMap(/** @param {any} capabilityId */ (capabilityId) => relatedRulesForTarget(graph, capabilityId)))].sort();
  const verifications = verificationIdsForTarget(graph, [projectionId, ...capabilities, ...entities, ...shapes, ...widgets]);

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
      widgets,
      rules,
      verifications
    },
    related: {
      entities: summarizeStatementsByIds(graph, entities),
      shapes: summarizeStatementsByIds(graph, shapes),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      widgets: summarizeStatementsByIds(graph, widgets),
      rules: summarizeStatementsByIds(graph, rules)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, [projectionId, ...capabilities, ...entities, ...shapes, ...widgets], {
      rationale: "Projection slices affect generated contract and runtime surfaces, so verification should follow the projection closure."
    }),
    ui_agent_packet: uiAgentPacketForProjection(graph, projection),
    write_scope: buildDefaultWriteScope(),
    review_boundary: projection.reviewBoundary || {
      automation_class: "review_required",
      reasons: ["projection_surface"]
    },
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {any} graph
 * @param {any} entityId
 * @returns {any}
 */
function entitySlice(graph, entityId) {
  const entity = getStatement(graph, "entity", entityId);
  const shapes = relatedShapesForEntity(graph, entityId);
  const capabilities = relatedCapabilitiesForEntity(graph, entityId);
  const rules = [...new Set([
    ...relatedRulesForTarget(graph, entityId),
    ...capabilities.flatMap(/** @param {any} capabilityId */ (capabilityId) => relatedRulesForTarget(graph, capabilityId))
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

/**
 * @param {any} graph
 * @param {any} widgetId
 * @returns {any}
 */
function widgetSlice(graph, widgetId) {
  const widget = widgetById(graph, widgetId);
  if (!widget) {
    throw new Error(`No widget found with id '${widgetId}'`);
  }
  const dependencyIds = widgetDependencyIdsByKind(widget);
  const shapes = relatedShapesForWidget(widget);
  const entities = dependencyIds.entity;
  const capabilities = dependencyIds.capability;
  const projections = relatedProjectionsForWidget(graph, widgetId);
  const widgetDependencies = dependencyIds.widget;
  const verificationScope = [widgetId, ...shapes, ...entities, ...capabilities, ...projections, ...widgetDependencies];
  const verifications = verificationIdsForTarget(graph, verificationScope);

  return {
    type: "context_slice",
    version: 1,
    focus: {
      kind: "widget",
      id: widgetId
    },
    summary: summarizeById(graph, widgetId),
    depends_on: {
      shapes,
      entities,
      capabilities,
      widgets: widgetDependencies,
      projections,
      verifications
    },
    related: {
      shapes: summarizeStatementsByIds(graph, shapes),
      entities: summarizeStatementsByIds(graph, entities),
      capabilities: summarizeStatementsByIds(graph, capabilities),
      widgets: summarizeStatementsByIds(graph, widgetDependencies),
      projections: summarizeStatementsByIds(graph, projections)
    },
    verification: summarizeStatementsByIds(graph, verifications),
    verification_targets: recommendedVerificationTargets(graph, verificationScope, {
      rationale: "Widget changes affect every related projection, so verification should follow the widget contract closure."
    }),
    ui_agent_packet: uiAgentPacketForWidget(graph, widget, projections),
    write_scope: buildDefaultWriteScope(),
    review_boundary: {
      automation_class: "review_required",
      reasons: ["widget_surface"]
    },
    ownership_boundary: defaultOwnershipBoundary()
  };
}

/**
 * @param {any} widget
 * @returns {any}
 */
function widgetDependencyIdsByKind(widget) {
  const ids = /** @type {Record<string, string[]>} */ ({
    shape: [],
    entity: [],
    capability: [],
    projection: [],
    widget: []
  });

  for (const dependency of widget.dependencies || []) {
    const kind = widgetDependencyKind(dependency);
    if (kind && Object.hasOwn(ids, kind)) {
      ids[kind].push(dependency.id);
    }
  }

  return Object.fromEntries(
    Object.entries(ids).map(([kind, values]) => [kind, [...new Set(values.filter(Boolean))].sort()])
  );
}

/**
 * @param {any} dependency
 * @returns {any}
 */
function widgetDependencyKind(dependency) {
  if (dependency?.target?.kind) {
    return dependency.target.kind === "component" ? "widget" : dependency.target.kind;
  }
  const id = String(dependency?.id || "");
  const prefix = id.split("_")[0];
  if (prefix === "proj") {
    return "projection";
  }
  if (prefix === "cap") {
    return "capability";
  }
  if (prefix === "component") {
    return "widget";
  }
  return prefix || null;
}


/**
 * @param {any} graph
 * @param {any} options
 * @returns {any}
 */
export function generateContextSlice(graph, options = {}) {
  const selection = ensureContextSelection({
    capabilityId: options.capabilityId,
    workflowId: options.workflowId,
    projectionId: options.projectionId,
    componentId: options.widgetId || options.componentId,
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
  if (selection.kind === "widget") return widgetSlice(graph, selection.id);
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
