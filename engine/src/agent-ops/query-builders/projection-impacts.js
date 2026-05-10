import {
  getJourneyDoc,
  getStatement,
  getWorkflowDoc,
  relatedProjectionsForCapability,
  relatedProjectionsForEntity,
  relatedProjectionsForWidget,
  relatedShapesForProjection,
  relatedWidgetsForProjection,
  widgetById
} from "../../generator/context/shared.js";
import { generatorDefaultsMap } from "../../generator/surfaces/shared.js";
import {
  stableSortedStrings,
  targetWidgetId
} from "./common.js";
export function projectionKindForImpact(projection) {
  if (!projection) return "unknown";
  if ((projection.http || []).length > 0 || projection.type === "api" || projection.type === "backend") {
    return "api";
  }
  if (
    (projection.uiRoutes || []).length > 0 ||
    (projection.uiWeb || []).length > 0 ||
    (projection.uiIos || []).length > 0 ||
    (projection.uiScreens || []).length > 0 ||
    projection.type === "web_surface" ||
    projection.type === "ios_surface" ||
    projection.type === "ui_contract"
  ) {
    return "ui";
  }
  if (
    (projection.dbTables || []).length > 0 ||
    (projection.dbColumns || []).length > 0 ||
    (projection.dbRelations || []).length > 0 ||
    String(projection.type || "").startsWith("db_")
  ) {
    return "db";
  }
  return "unknown";
}

export function projectionSummaryForImpact(projection) {
  if (!projection) return null;
  return {
    projection_id: projection.id,
    kind: projectionKindForImpact(projection),
    type: projection.type || null,
    outputs: stableSortedStrings(projection.outputs || [])
  };
}

export function projectionById(graph, projectionId) {
  return (graph?.byKind?.projection || []).find((projection) => projection.id === projectionId) || null;
}

export function impactsFromProjectionIds(graph, projectionIds, impactSource, reasonBuilder) {
  return projectionIds
    .map((projectionId) => {
      const projection = projectionById(graph, projectionId);
      if (!projection) return null;
      return {
        ...projectionSummaryForImpact(projection),
        impact_source: impactSource,
        reason: reasonBuilder(projection)
      };
    })
    .filter(Boolean);
}

export function addImpact(map, impact) {
  if (!impact?.projection_id) return;
  const existing = map.get(impact.projection_id);
  if (!existing) {
    map.set(impact.projection_id, {
      ...impact,
      impact_sources: [impact.impact_source],
      reasons: [impact.reason]
    });
    return;
  }

  const priority = [
    "direct_projection_change",
    "selected_projection",
    "changed_capability",
    "changed_entity",
    "changed_shape",
    "changed_widget",
    "changed_rule",
    "changed_workflow",
    "changed_journey",
    "selected_rule",
    "selected_capability",
    "selected_entity",
    "selected_workflow",
    "selected_journey"
  ];
  existing.impact_sources = stableSortedStrings([...(existing.impact_sources || []), impact.impact_source]);
  existing.reasons = stableSortedStrings([...(existing.reasons || []), impact.reason]);
  const currentPriority = priority.indexOf(existing.impact_source);
  const nextPriority = priority.indexOf(impact.impact_source);
  if (currentPriority === -1 || (nextPriority !== -1 && nextPriority < currentPriority)) {
    existing.impact_source = impact.impact_source;
    existing.reason = impact.reason;
  }
}

export function projectionImpactsFromRule(graph, ruleId, selected = false) {
  let rule;
  try {
    rule = getStatement(graph, "rule", ruleId);
  } catch {
    return [];
  }
  const impacts = [];
  for (const target of rule.appliesTo || []) {
    if (target.id?.startsWith("cap_")) {
      impacts.push(...impactsFromProjectionIds(
        graph,
        relatedProjectionsForCapability(graph, target.id),
        selected ? "selected_rule" : "changed_rule",
        (projection) => `Projection ${projection.id} is affected because rule ${ruleId} applies to capability ${target.id}.`
      ));
    } else if (target.id?.startsWith("entity_")) {
      impacts.push(...impactsFromProjectionIds(
        graph,
        relatedProjectionsForEntity(graph, target.id),
        selected ? "selected_rule" : "changed_rule",
        (projection) => `Projection ${projection.id} is affected because rule ${ruleId} applies to entity ${target.id}.`
      ));
    } else if (target.kind === "projection" || target.id?.startsWith("proj_")) {
      impacts.push(...impactsFromProjectionIds(
        graph,
        [target.id],
        selected ? "selected_rule" : "changed_rule",
        () => `Projection ${target.id} is affected because rule ${ruleId} applies directly to that projection.`
      ));
    }
  }
  return impacts;
}

export function projectionImpactsFromWorkflow(graph, workflowId, selected = false) {
  let workflow;
  try {
    workflow = getWorkflowDoc(graph, workflowId);
  } catch {
    return [];
  }
  const direct = stableSortedStrings(workflow.relatedProjections || []);
  const viaCapabilities = stableSortedStrings((workflow.relatedCapabilities || []).flatMap((capabilityId) =>
    relatedProjectionsForCapability(graph, capabilityId)
  ));

  return [
    ...impactsFromProjectionIds(
      graph,
      direct,
      selected ? "selected_workflow" : "changed_workflow",
      (projection) => `Projection ${projection.id} is affected because workflow ${workflowId} links to that projection directly.`
    ),
    ...impactsFromProjectionIds(
      graph,
      viaCapabilities.filter((id) => !direct.includes(id)),
      selected ? "selected_workflow" : "changed_workflow",
      (projection) => `Projection ${projection.id} is affected because workflow ${workflowId} includes related capabilities realized by that projection.`
    )
  ];
}

export function projectionImpactsFromJourney(graph, journeyId, selected = false) {
  let journey;
  try {
    journey = getJourneyDoc(graph, journeyId);
  } catch {
    return [];
  }
  const direct = stableSortedStrings(journey.relatedProjections || []);
  const viaCapabilities = stableSortedStrings((journey.relatedCapabilities || []).flatMap((capabilityId) =>
    relatedProjectionsForCapability(graph, capabilityId)
  ));
  const viaWorkflows = stableSortedStrings((journey.relatedWorkflows || []).flatMap((workflowId) => {
    try {
      const workflow = getWorkflowDoc(graph, workflowId);
      return workflow.relatedProjections || [];
    } catch {
      return [];
    }
  }));

  return [
    ...impactsFromProjectionIds(
      graph,
      direct,
      selected ? "selected_journey" : "changed_journey",
      (projection) => `Projection ${projection.id} is affected because journey ${journeyId} links to that projection directly.`
    ),
    ...impactsFromProjectionIds(
      graph,
      [...viaCapabilities, ...viaWorkflows].filter((id) => !direct.includes(id)),
      selected ? "selected_journey" : "changed_journey",
      (projection) => `Projection ${projection.id} is affected because journey ${journeyId} links to related workflow or capability surfaces realized by that projection.`
    )
  ];
}

export function projectionImpactsFromShape(graph, shapeId) {
  const directProjectionIds = stableSortedStrings((graph?.byKind?.projection || [])
    .filter((projection) => relatedShapesForProjection(projection).includes(shapeId))
    .map((projection) => projection.id));
  const viaCapabilities = stableSortedStrings((graph?.byKind?.capability || [])
    .filter((capability) => [...(capability.input || []), ...(capability.output || [])].some((item) => item.id === shapeId))
    .flatMap((capability) => relatedProjectionsForCapability(graph, capability.id)));

  return [
    ...impactsFromProjectionIds(
      graph,
      directProjectionIds,
      "changed_shape",
      (projection) => `Projection ${projection.id} is affected because it references changed shape ${shapeId} directly.`
    ),
    ...impactsFromProjectionIds(
      graph,
      viaCapabilities.filter((id) => !directProjectionIds.includes(id)),
      "changed_shape",
      (projection) => `Projection ${projection.id} is affected because changed shape ${shapeId} is used by related capabilities realized by that projection.`
    )
  ];
}

export function projectionImpactsFromWidget(graph, widgetId) {
  const widget = widgetById(graph, widgetId);
  if (!widget) {
    return [];
  }

  return impactsFromProjectionIds(
    graph,
    relatedProjectionsForWidget(graph, widgetId),
    "changed_widget",
    (projection) => `Projection ${projection.id} is affected because widget ${widgetId} is used by that UI surface.`
  ).map((impact) => ({
    ...impact,
    widget_ids: stableSortedStrings([widgetId])
  }));
}

export function buildProjectionImpacts(graph, { sliceArtifact, diffArtifact }) {
  const impactMap = new Map();

  if (diffArtifact) {
    for (const entry of diffArtifact.projections || []) {
      addImpact(impactMap, {
        ...projectionSummaryForImpact(projectionById(graph, entry.id)),
        impact_source: "direct_projection_change",
        reason: `Projection ${entry.id} changed directly in the semantic diff.`
      });
    }

    for (const entry of diffArtifact.capabilities || []) {
      for (const impact of impactsFromProjectionIds(
        graph,
        relatedProjectionsForCapability(graph, entry.id),
        "changed_capability",
        (projection) => `Projection ${projection.id} is affected because changed capability ${entry.id} is realized by that projection.`
      )) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.entities || []) {
      for (const impact of impactsFromProjectionIds(
        graph,
        relatedProjectionsForEntity(graph, entry.id),
        "changed_entity",
        (projection) => `Projection ${projection.id} is affected because changed entity ${entry.id} participates in that projection.`
      )) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.shapes || []) {
      for (const impact of projectionImpactsFromShape(graph, entry.id)) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.widgets || diffArtifact.components || []) {
      for (const impact of projectionImpactsFromWidget(graph, entry.id)) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.rules || []) {
      for (const impact of projectionImpactsFromRule(graph, entry.id)) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.workflows || []) {
      for (const impact of projectionImpactsFromWorkflow(graph, entry.id)) addImpact(impactMap, impact);
    }

    for (const entry of diffArtifact.journeys || []) {
      for (const impact of projectionImpactsFromJourney(graph, entry.id)) addImpact(impactMap, impact);
    }
  } else if (sliceArtifact?.focus) {
    const { kind, id } = sliceArtifact.focus;
    if (kind === "projection") {
      addImpact(impactMap, {
        ...projectionSummaryForImpact(projectionById(graph, id)),
        impact_source: "selected_projection",
        reason: `Projection ${id} is the selected focus surface.`
      });
    } else if (kind === "capability") {
      for (const impact of impactsFromProjectionIds(
        graph,
        stableSortedStrings(sliceArtifact.depends_on?.projections || relatedProjectionsForCapability(graph, id)),
        "selected_capability",
        (projection) => `Projection ${projection.id} is in scope because selected capability ${id} is realized by that projection.`
      )) addImpact(impactMap, impact);
    } else if (kind === "entity") {
      for (const impact of impactsFromProjectionIds(
        graph,
        stableSortedStrings(sliceArtifact.depends_on?.projections || relatedProjectionsForEntity(graph, id)),
        "selected_entity",
        (projection) => `Projection ${projection.id} is in scope because selected entity ${id} participates in that projection.`
      )) addImpact(impactMap, impact);
    } else if (kind === "widget") {
      for (const impact of projectionImpactsFromWidget(graph, id)) addImpact(impactMap, impact);
    } else if (kind === "workflow") {
      for (const impact of projectionImpactsFromWorkflow(graph, id, true)) addImpact(impactMap, impact);
    } else if (kind === "journey") {
      for (const impact of projectionImpactsFromJourney(graph, id, true)) addImpact(impactMap, impact);
    }
  }

  return [...impactMap.values()]
    .map((impact) => ({
      ...impact,
      impact_sources: stableSortedStrings(impact.impact_sources || []),
      reasons: stableSortedStrings(impact.reasons || [])
    }))
    .sort((a, b) => a.projection_id.localeCompare(b.projection_id));
}

export function buildGeneratorTargets(graph, projectionImpacts = [], diffArtifact = null) {
  const targets = [];
  const addTarget = (target) => {
    if (!target?.target) return;
    if (target.component_id && !target.widget_id) {
      target.widget_id = target.component_id;
      delete target.component_id;
    }
    if (!target.projection_id && !target.widget_id) return;
    if (!targets.some((entry) =>
      entry.target === target.target &&
      entry.projection_id === target.projection_id &&
      targetWidgetId(entry) === targetWidgetId(target)
    )) {
      targets.push(target);
    }
  };

  for (const entry of diffArtifact?.widgets || diffArtifact?.components || []) {
    addTarget({
      target: "ui-widget-contract",
      widget_id: entry.id,
      required: true,
      reason: `Widget ${entry.id} changed directly, so its widget contract should be refreshed.`
    });
    addTarget({
      target: "widget-behavior-report",
      widget_id: entry.id,
      required: true,
      reason: `Widget ${entry.id} changed directly, so behavior realizations should be reviewed across affected projections.`
    });
  }

  for (const impact of projectionImpacts) {
    const projection = projectionById(graph, impact.projection_id);
    if (!projection) continue;
    const profile = generatorDefaultsMap(projection).profile || null;
    const outputs = stableSortedStrings(projection.outputs || []);

    if (impact.kind === "api") {
      addTarget({
        target: "api-contract-graph",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is API-facing, so API contract regeneration is required.`
      });
      addTarget({
        target: "server-contract",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is API-facing, so the server contract should stay aligned.`
      });
      addTarget({
        target: "api-contract-debug",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} may benefit from API contract debug output during review.`
      });
    }

    if (projection.type === "ui_contract") {
      addTarget({
        target: "ui-contract-graph",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is a shared UI surface, so the UI contract should be refreshed.`
      });
      addTarget({
        target: "ui-contract-debug",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} may benefit from UI contract debug output during review.`
      });
    }

    const widgetIds = stableSortedStrings([
      ...(impact.widget_ids || []),
      ...(impact.kind === "ui" ? relatedWidgetsForProjection(graph, projection) : [])
    ]);

    for (const widgetId of widgetIds) {
      addTarget({
        target: "ui-widget-contract",
        widget_id: widgetId,
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is affected by widget ${widgetId}, so the widget contract should be refreshed.`
      });
      addTarget({
        target: "widget-behavior-report",
        widget_id: widgetId,
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is affected by widget ${widgetId}, so behavior data/event/action wiring should be reviewed.`
      });
    }

    if (projection.type === "web_surface") {
      addTarget({
        target: "ui-surface-contract",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is a web UI surface, so the web UI contract should be refreshed.`
      });
      addTarget({
        target: "ui-surface-debug",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} may benefit from UI web debug output during review.`
      });
      if (outputs.includes("web_app") && profile === "sveltekit") {
        addTarget({
          target: "sveltekit-app",
          projection_id: impact.projection_id,
          required: false,
          reason: `Projection ${impact.projection_id} emits a web app with SvelteKit profile, so the app scaffold may need regeneration.`
        });
      }
    }

    if (projection.type === "ios_surface") {
      addTarget({
        target: "swiftui-app",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} is a native iOS UI surface, so the SwiftUI client scaffold may need regeneration.`
      });
    }

    if (String(projection.type || "").startsWith("db_")) {
      addTarget({
        target: "db-contract-graph",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is database-facing, so the DB contract graph should be refreshed.`
      });
      addTarget({
        target: "db-contract-debug",
        projection_id: impact.projection_id,
        required: false,
        reason: `Projection ${impact.projection_id} may benefit from DB contract debug output during review.`
      });
      addTarget({
        target: "db-schema-snapshot",
        projection_id: impact.projection_id,
        required: true,
        reason: `Projection ${impact.projection_id} is database-facing, so the schema snapshot should stay aligned.`
      });

      const schemaSensitiveDiff = Boolean(
        diffArtifact &&
        (
          (diffArtifact.entities || []).length > 0 ||
          (diffArtifact.shapes || []).length > 0 ||
          (diffArtifact.projections || []).some((entry) => entry.id === impact.projection_id)
        )
      );
      if (schemaSensitiveDiff) {
        addTarget({
          target: "db-migration-plan",
          projection_id: impact.projection_id,
          required: false,
          reason: `Projection ${impact.projection_id} has schema-sensitive diff inputs, so reviewing a migration plan is recommended.`
        });
      }
    }
  }

  return targets.sort((a, b) => {
    const projectionCompare = String(a.projection_id || "").localeCompare(String(b.projection_id || ""));
    if (projectionCompare !== 0) return projectionCompare;
    const componentCompare = String(targetWidgetId(a) || "").localeCompare(String(targetWidgetId(b) || ""));
    if (componentCompare !== 0) return componentCompare;
    return projectionCompare !== 0 ? projectionCompare : a.target.localeCompare(b.target);
  });
}
