import { groupBy, refIds, stableSortedStrings } from "./primitives.js";
import { summarizeJourneyDoc, summarizeStatement } from "./summaries.js";

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @returns {any}
 */
export function buildIndexes(graph) {
  const statementById = new Map((graph.statements || []).map(/** @param {import("./types.d.ts").ContextStatement} statement */ (statement) => [statement.id, statement]));
  const docsById = new Map((graph.docs || []).map(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => [doc.id, doc]));
  const docsByKind = groupBy(graph.docs || [], /** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.kind || "unknown");

  return {
    statementById,
    docsById,
    docsByKind
  };
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {(doc: import("./types.d.ts").ContextDoc) => boolean} predicate
 * @returns {any}
 */
export function relatedDocs(graph, predicate) {
  return (graph.docs || []).filter(predicate);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {(id: string) => boolean} predicate
 * @returns {any}
 */
export function verificationsFor(graph, predicate) {
  return stableSortedStrings(
    (graph.byKind.verification || [])
      .filter(/** @param {any} verification */ (verification) => (verification.validates || []).some(/** @param {any} target */ (target) => predicate(target.id)))
      .map(/** @param {any} verification */ (verification) => verification.id)
  );
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} capabilityId
 * @returns {any}
 */
export function relatedJourneysForCapability(graph, capabilityId) {
  return relatedDocs(
    graph,
    /** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.kind === "journey" && (doc.relatedCapabilities || []).includes(capabilityId)
  );
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} capabilityId
 * @returns {any}
 */
export function relatedWorkflowDocsForCapability(graph, capabilityId) {
  return relatedDocs(
    graph,
    /** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.kind === "workflow" && (doc.relatedCapabilities || []).includes(capabilityId)
  );
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} targetId
 * @returns {any}
 */
export function relatedRulesForTarget(graph, targetId) {
  return stableSortedStrings(
    (graph.byKind.rule || [])
      .filter(/** @param {any} rule */ (rule) => (rule.appliesTo || []).some(/** @param {any} target */ (target) => target.id === targetId))
      .map(/** @param {any} rule */ (rule) => rule.id)
  );
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} capabilityId
 * @returns {any}
 */
export function relatedProjectionsForCapability(graph, capabilityId) {
  return stableSortedStrings(
    (graph.byKind.projection || [])
      .filter(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => (projection.realizes || []).some(/** @param {any} target */ (target) => target.id === capabilityId))
      .map(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => projection.id)
  );
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} entityId
 * @returns {any}
 */
export function relatedCapabilitiesForEntity(graph, entityId) {
  return stableSortedStrings(
    (graph.byKind.capability || [])
      .filter(
        /** @param {import("./types.d.ts").ContextCapability} capability */ (capability) =>
          refIds(capability.reads).includes(entityId) ||
          refIds(capability.creates).includes(entityId) ||
          refIds(capability.updates).includes(entityId) ||
          refIds(capability.deletes).includes(entityId)
      )
      .map(/** @param {import("./types.d.ts").ContextCapability} capability */ (capability) => capability.id)
  );
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} entityId
 * @returns {any}
 */
export function relatedShapesForEntity(graph, entityId) {
  return stableSortedStrings(
    (graph.byKind.shape || [])
      .filter(/** @param {import("./types.d.ts").ContextShape} shape */ (shape) => refIds(shape.derivedFrom).includes(entityId))
      .map(/** @param {import("./types.d.ts").ContextShape} shape */ (shape) => shape.id)
  );
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} entityId
 * @returns {any}
 */
export function relatedProjectionsForEntity(graph, entityId) {
  return stableSortedStrings(
    (graph.byKind.projection || [])
      .filter(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => {
        const dbMatches = (projection.dbTables || []).some(/** @param {any} entry */ (entry) => entry.entity?.id === entityId);
        const httpMatches = (projection.http || []).some(/** @param {any} entry */ (entry) => entry.entity?.id === entityId);
        return dbMatches || httpMatches;
      })
      .map(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => projection.id)
  );
}

/**
 * @param {import("./types.d.ts").ContextProjection} projection
 * @returns {any}
 */
export function relatedCapabilitiesForProjection(projection) {
  const ids = [
    ...(projection.realizes || []).map(/** @param {any} entry */ (entry) => entry.id),
    ...(projection.http || []).map(/** @param {any} entry */ (entry) => entry.capability?.id),
    ...(projection.uiActions || []).map(/** @param {any} entry */ (entry) => entry.capability?.id),
    ...(projection.uiVisibility || []).map(/** @param {any} entry */ (entry) => entry.capability?.id),
    ...(projection.uiLookups || []).map(/** @param {any} entry */ (entry) => entry.capability?.id)
  ];
  return stableSortedStrings(ids);
}

/**
 * @param {import("./types.d.ts").ContextProjection} projection
 * @returns {any}
 */
export function relatedEntitiesForProjection(projection) {
  const ids = [
    ...(projection.dbTables || []).map(/** @param {any} entry */ (entry) => entry.entity?.id),
    ...(projection.dbColumns || []).map(/** @param {any} entry */ (entry) => entry.entity?.id),
    ...(projection.dbRelations || []).map(/** @param {any} entry */ (entry) => entry.source?.id),
    ...(projection.dbRelations || []).map(/** @param {any} entry */ (entry) => entry.target?.id)
  ];
  return stableSortedStrings(ids);
}

/**
 * @param {import("./types.d.ts").ContextProjection} projection
 * @returns {any}
 */
export function relatedShapesForProjection(projection) {
  const ids = [
    ...(projection.uiScreens || []).map(/** @param {any} entry */ (entry) => entry.viewShape?.id),
    ...(projection.uiScreens || []).map(/** @param {any} entry */ (entry) => entry.editShape?.id),
    ...(projection.uiCollections || []).map(/** @param {any} entry */ (entry) => entry.itemShape?.id),
    ...(projection.httpResponses || []).map(/** @param {any} entry */ (entry) => entry.shape?.id),
    ...(projection.http || []).map(/** @param {any} entry */ (entry) => entry.requestShape?.id)
  ];
  return stableSortedStrings(ids);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} shapeId
 * @returns {any}
 */
export function relatedProjectionsForShape(graph, shapeId) {
  const directProjectionIds = stableSortedStrings((graph?.byKind?.projection || [])
    .filter(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => relatedShapesForProjection(projection).includes(shapeId))
    .map(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => projection.id));
  const viaCapabilities = stableSortedStrings((graph?.byKind?.capability || [])
    .filter(/** @param {import("./types.d.ts").ContextCapability} capability */ (capability) => [...(capability.input || []), ...(capability.output || [])].some(/** @param {any} item */ (item) => item.id === shapeId))
    .flatMap(/** @param {import("./types.d.ts").ContextCapability} capability */ (capability) => relatedProjectionsForCapability(graph, capability.id)));

  return stableSortedStrings([...directProjectionIds, ...viaCapabilities]);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} widgetId
 * @returns {any}
 */
export function widgetById(graph, widgetId) {
  return (graph?.byKind?.widget || []).find(/** @param {import("./types.d.ts").ContextWidget} widget */ (widget) => widget.id === widgetId) || null;
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} projectionId
 * @returns {any}
 */
export function projectionById(graph, projectionId) {
  return (graph?.byKind?.projection || []).find(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => projection.id === projectionId) || null;
}

/**
 * @param {import("./types.d.ts").ContextProjection} projection
 * @returns {any}
 */
export function realizedProjectionIds(projection) {
  return stableSortedStrings((projection?.realizes || [])
    .filter(/** @param {any} target */ (target) => target.target?.kind === "projection" || String(target.id || "").startsWith("proj_"))
    .map(/** @param {any} target */ (target) => target.id));
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {Iterable<string>} projectionIds
 * @returns {any}
 */
export function downstreamProjectionIds(graph, projectionIds) {
  const visited = new Set(projectionIds);
  const queue = [...projectionIds];

  while (queue.length > 0) {
    const currentId = queue.shift();
    for (const projection of graph?.byKind?.projection || []) {
      if (visited.has(projection.id)) {
        continue;
      }
      if (realizedProjectionIds(projection).includes(currentId)) {
        visited.add(projection.id);
        queue.push(projection.id);
      }
    }
  }

  return stableSortedStrings([...visited]);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {import("./types.d.ts").ContextProjection} projection
 * @returns {any}
 */
export function relatedWidgetsForProjection(graph, projection) {
  const directIds = (projection?.widgetBindings || []).map(/** @param {any} entry */ (entry) => entry.widget?.id).filter(Boolean);
  const inheritedIds = realizedProjectionIds(projection)
    .map(/** @param {string} projectionId */ (projectionId) => projectionById(graph, projectionId))
    .filter(Boolean)
    .flatMap(/** @param {any} realizedProjection */ (realizedProjection) => relatedWidgetsForProjection(graph, realizedProjection));
  return stableSortedStrings([...directIds, ...inheritedIds]);
}

/**
 * @param {import("./types.d.ts").ContextWidget} widget
 * @returns {any}
 */
export function relatedShapesForWidget(widget) {
  if (!widget) return [];
  const ids = [
    ...(widget.events || []).map(/** @param {any} event */ (event) => event.shape?.id),
    ...(widget.lookups || [])
      .filter(/** @param {any} lookup */ (lookup) => lookup?.target?.kind === "shape" || String(lookup?.id || "").startsWith("shape_"))
      .map(/** @param {any} lookup */ (lookup) => lookup.id),
    ...(widget.dependencies || [])
      .filter(/** @param {any} dependency */ (dependency) => referenceKind(dependency) === "shape")
      .map(/** @param {any} dependency */ (dependency) => dependency.id)
  ];
  return stableSortedStrings(ids);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} widgetId
 * @returns {any}
 */
export function relatedProjectionsForWidget(graph, widgetId) {
  const widget = widgetById(graph, widgetId);
  if (!widget) return [];
  const explicitProjectionIds = stableSortedStrings((graph?.byKind?.projection || [])
    .filter(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => (projection.widgetBindings || []).some(/** @param {any} entry */ (entry) => entry.widget?.id === widgetId))
    .map(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => projection.id));
  const dependencyProjectionIds = stableSortedStrings((widget.dependencies || []).flatMap(/** @param {any} dependency */ (dependency) => {
    const kind = referenceKind(dependency);
    if (kind === "projection") {
      return [dependency.id];
    }
    if (kind === "capability") {
      return relatedProjectionsForCapability(graph, dependency.id);
    }
    if (kind === "entity") {
      return relatedProjectionsForEntity(graph, dependency.id);
    }
    if (kind === "shape") {
      return relatedProjectionsForShape(graph, dependency.id);
    }
    return [];
  }));
  const widgetPatterns = new Set(widget.patterns || []);
  const widgetRegions = new Set(widget.regions || []);
  const viaUiRegions = stableSortedStrings((graph?.byKind?.projection || [])
    .filter(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => (projection.uiScreenRegions || []).some(/** @param {any} region */ (region) =>
      (region.pattern && widgetPatterns.has(region.pattern)) ||
      (region.region && widgetRegions.has(region.region))
    ))
    .map(/** @param {import("./types.d.ts").ContextProjection} projection */ (projection) => projection.id));

  return downstreamProjectionIds(graph, stableSortedStrings([...explicitProjectionIds, ...dependencyProjectionIds, ...viaUiRegions]));
}

/**
 * @param {import("./types.d.ts").ContextReference} reference
 * @returns {any}
 */
export function referenceKind(reference) {
  if (reference?.target?.kind) {
    return reference.target.kind;
  }
  const id = String(reference?.id || "");
  const prefix = id.split("_")[0];
  if (prefix === "proj") {
    return "projection";
  }
  if (prefix === "cap") {
    return "capability";
  }
  return prefix || null;
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {Iterable<string>} targetIds
 * @returns {any}
 */
export function verificationIdsForTarget(graph, targetIds) {
  const set = new Set(targetIds || []);
  return verificationsFor(graph, /** @param {string} targetId */ (targetId) => set.has(targetId));
}

/**
 * @param {import("./types.d.ts").ContextDoc} doc
 * @returns {any}
 */
export function summarizeDoc(doc) {
  return summarizeJourneyDoc(doc);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {string} id
 * @returns {any}
 */
export function summarizeById(graph, id) {
  const statement = (graph.statements || []).find(/** @param {any} item */ (item) => item.id === id);
  if (statement) {
    return summarizeStatement(statement);
  }

  const doc = (graph.docs || []).find(/** @param {any} item */ (item) => item.id === id);
  return doc ? summarizeDoc(doc) : null;
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {Iterable<string>} ids
 * @returns {any}
 */
export function summarizeStatementsByIds(graph, ids) {
  return stableSortedStrings(ids).map(/** @param {string} id */ (id) => summarizeById(graph, id)).filter(Boolean);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {Iterable<string>} ids
 * @returns {any}
 */
export function summarizeDocsByIds(graph, ids) {
  return stableSortedStrings(ids)
    .map(/** @param {string} id */ (id) => (graph.docs || []).find(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.id === id))
    .filter(Boolean)
    .map(summarizeDoc);
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @returns {any}
 */
export function workspaceInventory(graph) {
  return {
    capabilities: stableSortedStrings((graph.byKind.capability || []).map(/** @param {any} item */ (item) => item.id)),
    workflows: stableSortedStrings((graph.docs || []).filter(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.kind === "workflow").map(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.id)),
    journeys: stableSortedStrings((graph.docs || []).filter(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.kind === "journey").map(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.id)),
    entities: stableSortedStrings((graph.byKind.entity || []).map(/** @param {any} item */ (item) => item.id)),
    projections: stableSortedStrings((graph.byKind.projection || []).map(/** @param {any} item */ (item) => item.id)),
    widgets: stableSortedStrings((graph.byKind.widget || []).map(/** @param {any} item */ (item) => item.id)),
    verifications: stableSortedStrings((graph.byKind.verification || []).map(/** @param {any} item */ (item) => item.id)),
    domains: stableSortedStrings((graph.byKind.domain || []).map(/** @param {any} item */ (item) => item.id)),
    pitches: stableSortedStrings((graph.byKind.pitch || []).map(/** @param {any} item */ (item) => item.id)),
    requirements: stableSortedStrings((graph.byKind.requirement || []).map(/** @param {any} item */ (item) => item.id)),
    acceptance_criteria: stableSortedStrings((graph.byKind.acceptance_criterion || []).map(/** @param {any} item */ (item) => item.id)),
    tasks: stableSortedStrings((graph.byKind.task || []).map(/** @param {any} item */ (item) => item.id)),
    bugs: stableSortedStrings((graph.byKind.bug || []).map(/** @param {any} item */ (item) => item.id)),
    documents: stableSortedStrings((graph.docs || []).map(/** @param {import("./types.d.ts").ContextDoc} doc */ (doc) => doc.id))
  };
}

/**
 * @param {import("./types.d.ts").ContextSelectionOptions} options
 * @returns {any}
 */
export function ensureContextSelection(options = {}) {
  const selectors = /** @type {any[]} */ ([
    options.capabilityId ? ["capability", options.capabilityId] : null,
    options.workflowId ? ["workflow", options.workflowId] : null,
    options.projectionId ? ["projection", options.projectionId] : null,
    (options.widgetId || options.componentId) ? ["widget", options.widgetId || options.componentId] : null,
    options.entityId ? ["entity", options.entityId] : null,
    options.journeyId ? ["journey", options.journeyId] : null,
    options.surfaceId ? ["surface", options.surfaceId] : null,
    options.domainId ? ["domain", options.domainId] : null,
    options.pitchId ? ["pitch", options.pitchId] : null,
    options.requirementId ? ["requirement", options.requirementId] : null,
    options.acceptanceId ? ["acceptance_criterion", options.acceptanceId] : null,
    options.taskId ? ["task", options.taskId] : null,
    options.planId ? ["plan", options.planId] : null,
    options.bugId ? ["bug", options.bugId] : null,
    options.documentId ? ["document", options.documentId] : null
  ].filter(Boolean));

  if (selectors.length !== 1) {
    throw new Error(
      "Context selection requires exactly one of --capability, --workflow, --projection, --widget, --entity, --journey, --surface, --domain, --pitch, --requirement, --acceptance, --task, --plan, --bug, or --document"
    );
  }

  return {
    kind: selectors[0][0],
    id: selectors[0][1]
  };
}
