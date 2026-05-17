// @ts-check

import { buildUiSharedRealization } from "../../../realization/ui/build-ui-shared-realization.js";
import { buildWebRealization } from "../../../realization/ui/build-web-realization.js";

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {import("../shared/types.d.ts").ContextProjection} projection
 * @returns {any}
 */
export function uiAgentPacketForProjection(graph, projection) {
  const projectionType = projection.type || projection.type || null;
  if (projectionType !== "ui_contract" && !String(projectionType || "").endsWith("_surface")) {
    return null;
  }
  const sharedProjection = projectionType === "ui_contract"
    ? projection
    : sharedUiProjectionFor(graph, projection);
  const ownerProjection = sharedProjection || projection;
  const contract = uiContractForProjection(graph, projection);
  const contractScreens = /** @type {any[]} */ (contract?.screens || []);
  return {
    type: "ui_agent_packet",
    version: 1,
    ownership: {
      widgetPlacement: "ui_contract",
      designIntent: "ui_contract",
      concreteSurfaceOwns: ["routes", "surface_hints"]
    },
    sharedProjection: sharedProjection
      ? {
          id: sharedProjection.id,
          name: sharedProjection.name || sharedProjection.id
        }
      : null,
    screens: contractScreens.map(/** @param {any} screen */ (screen) => ({
      id: screen.id,
      kind: screen.kind,
      title: screen.title || screen.id,
      route: screen.route || null,
      regions: screen.regions || [],
      displayFields: screen.displayFields || [],
      widgets: screen.widgets || []
    })),
    routes: contractScreens.filter((screen) => screen.route).map(/** @param {any} screen */ (screen) => ({
      screenId: screen.id,
      path: screen.route
    })),
    widgets: contractScreens.flatMap(/** @param {any} screen */ (screen) =>
      (screen.widgets || []).map(/** @param {any} usage */ (usage) => widgetUsagePacket(usage, ownerProjection, screen))
    ),
    designTokens: contract?.designTokens || designIntentPacket(ownerProjection),
    requiredGates: uiRequiredGates(projection.id)
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {import("../shared/types.d.ts").ContextWidget} widget
 * @param {Iterable<string>} projectionIds
 * @returns {any}
 */
export function uiAgentPacketForWidget(graph, widget, projectionIds) {
  const projectionSet = new Set(projectionIds);
  const sourceUsages = /** @type {any[]} */ ([]);
  for (const projection of graph.byKind.projection || []) {
    for (const usage of projection.widgetBindings || []) {
      if (usage.widget?.id !== widget.id) continue;
      const projectionType = projection.type || projection.type || null;
      sourceUsages.push({
        projection: {
          id: projection.id,
          type: projectionType,
          ownership: projectionType === "ui_contract" ? "owner" : "concrete"
        },
        usage: widgetUsagePacket(usage, projection),
        designTokens: designIntentPacket(projection)
      });
      projectionSet.add(projection.id);
    }
  }

  return {
    type: "ui_agent_packet",
    version: 1,
    ownership: {
      widgetContract: "widget",
      widgetPlacement: "ui_contract",
      concreteSurfacesInherit: true
    },
    widget: {
      id: widget.id,
      name: widget.name || widget.id,
      category: widget.category || null,
      patterns: widget.widgetContract?.patterns || [],
      regions: widget.widgetContract?.regions || [],
      behaviors: widget.widgetContract?.behaviors || []
    },
    sourceUsages,
    inheritedBy: [...projectionSet]
      .filter((projectionId) => !sourceUsages.some(/** @param {any} entry */ (entry) => entry.projection.id === projectionId))
      .sort(),
    requiredGates: uiRequiredGates(null, widget.id)
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} screenId
 * @param {string|null|undefined} projectionId
 * @returns {any}
 */
export function uiAgentPacketForScreen(graph, screenId, projectionId = null) {
  const projection = projectionId
    ? projectionById(graph, projectionId)
    : projectionForScreen(graph, screenId);
  if (!projection) {
    throw new Error(`No UI projection found for screen '${screenId}'`);
  }
  const contract = uiContractForProjection(graph, projection);
  const contractScreens = /** @type {any[]} */ (contract?.screens || []);
  const screen = contractScreens.find((entry) => entry.id === screenId);
  if (!screen) {
    throw new Error(`No screen found with id '${screenId}'${projectionId ? ` in projection '${projectionId}'` : ""}`);
  }
  const capabilityIds = [
    screen.loadCapability?.id,
    screen.submitCapability?.id,
    screen.detailCapability?.id,
    screen.actions?.primary?.id,
    screen.actions?.secondary?.id,
    screen.actions?.destructive?.id,
    screen.actions?.terminal?.id,
    ...(/** @type {any[]} */ (screen.actions?.screen || [])).map((entry) => entry.capability?.id)
  ].filter(Boolean);
  const shapeIds = [
    screen.inputShape?.id,
    screen.viewShape?.id,
    screen.itemShape?.id,
    ...(/** @type {any[]} */ (screen.widgets || [])).flatMap((usage) => usage.display?.sourceShape?.id ? [usage.display.sourceShape.id] : [])
  ].filter(Boolean);
  return {
    type: "ui_agent_packet",
    version: 1,
    ownership: {
      widgetPlacement: "ui_contract",
      designIntent: "ui_contract",
      concreteSurfaceOwns: ["screen_routes", "surface_hints"]
    },
    projection: {
      id: projection.id,
      name: projection.name || projection.id,
      type: projection.type || null
    },
    uiContract: contract?.uiContract || (projection.type === "ui_contract" ? { id: projection.id, name: projection.name || projection.id, type: projection.type } : null),
    screen,
    route: screen.route || null,
    regions: screen.regions || [],
    widgets: (/** @type {any[]} */ (screen.widgets || [])).map((usage) => widgetUsagePacket(usage, projection, screen)),
    behaviorRealizations: (/** @type {any[]} */ (screen.widgets || [])).flatMap((usage) => usage.behaviorRealizations || []),
    displayFields: screen.displayFields || [],
    designTokens: contract?.designTokens || null,
    visibilityRules: screen.visibility || [],
    related: {
      capabilities: [...new Set(capabilityIds)].sort(),
      shapes: [...new Set(shapeIds)].sort(),
      widgets: [...new Set((/** @type {any[]} */ (screen.widgets || [])).map((usage) => usage.widget?.id).filter(Boolean))].sort()
    },
    requiredGates: uiRequiredGates(projection.id)
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {import("../shared/types.d.ts").ContextProjection} projection
 * @returns {any}
 */
function sharedUiProjectionFor(graph, projection) {
  for (const reference of projection.realizes || []) {
    const candidate = (graph.byKind.projection || []).find(/** @param {any} entry */ (entry) => entry.id === reference.id);
    if ((candidate?.type || candidate?.type) === "ui_contract") {
      return candidate;
    }
  }
  return null;
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} projectionId
 * @returns {any|null}
 */
function projectionById(graph, projectionId) {
  return (graph.byKind.projection || []).find(/** @param {any} entry */ (entry) => entry.id === projectionId) || null;
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {string} screenId
 * @returns {any|null}
 */
function projectionForScreen(graph, screenId) {
  const projections = /** @type {any[]} */ (graph.byKind.projection || []);
  const uiContracts = projections.filter((entry) => (entry.type || null) === "ui_contract");
  const owner = uiContracts.find((projection) =>
    (/** @type {any[]} */ (projection.uiScreens || [])).some((screen) => screen.id === screenId)
  );
  const surface = projections.find((projection) =>
    String(projection.type || "").endsWith("_surface") &&
    (/** @type {any[]} */ (projection.uiRoutes || [])).some((route) => route.screenId === screenId)
  );
  return surface || owner || null;
}

/**
 * @param {import("../shared/types.d.ts").ContextGraph} graph
 * @param {import("../shared/types.d.ts").ContextProjection} projection
 * @returns {any}
 */
function uiContractForProjection(graph, projection) {
  const projectionType = projection.type || null;
  if (projectionType === "ui_contract") {
    return buildUiSharedRealization(graph, { projectionId: projection.id });
  }
  if (String(projectionType).endsWith("_surface")) {
    return buildWebRealization(graph, { projectionId: projection.id }).contract;
  }
  return null;
}

/**
 * @param {import("../shared/types.d.ts").ContextWidgetUsage} usage
 * @param {import("../shared/types.d.ts").ContextProjection | null} projection
 * @param {any|null} [contractScreen]
 * @returns {any}
 */
function widgetUsagePacket(usage, projection = null, contractScreen = null) {
  const screen = (projection?.uiScreens || []).find(/** @param {any} entry */ (entry) => entry.id === usage.screenId) || null;
  const region = (projection?.uiScreenRegions || []).find(/** @param {any} entry */ (entry) =>
    entry.screenId === usage.screenId && entry.region === usage.region
  ) || (/** @type {any[]} */ (contractScreen?.regions || [])).find(/** @param {any} entry */ (entry) => entry.region === usage.region) || null;
  const effectiveScreen = contractScreen || screen;
  return {
    screenId: usage.screenId || effectiveScreen?.id || null,
    screen: effectiveScreen
      ? {
          id: effectiveScreen.id,
          kind: effectiveScreen.kind || null,
          title: effectiveScreen.title || effectiveScreen.id
        }
      : null,
    region: usage.region || null,
    regionContract: region
      ? {
          name: region.region || null,
          pattern: region.pattern || null,
          placement: region.placement || null,
          title: region.title || null,
          state: region.state || null,
          variant: region.variant || null
        }
      : null,
    widgetId: usage.widget?.id || null,
    dataBindings: (usage.dataBindings || []).map(/** @param {any} binding */ (binding) => ({
      prop: binding.prop || null,
      source: binding.source?.id || binding.source || null
    })),
    display: usage.display || null,
    displayFields: usage.displayFields || usage.display?.fields || [],
    behaviorRealizations: usage.behaviorRealizations || [],
    eventBindings: (usage.eventBindings || []).map(/** @param {any} binding */ (binding) => ({
      event: binding.event || null,
      action: binding.action || null,
      target: binding.target?.id || binding.target || null
    })),
    route: contractScreen?.route || null
  };
}

/**
 * @param {import("../shared/types.d.ts").ContextProjection} projection
 * @returns {any}
 */
function designIntentPacket(projection) {
  return (projection.uiDesign || []).map(/** @param {any} entry */ (entry) => ({
    key: entry.key,
    role: entry.role,
    value: entry.value
  }));
}

/**
 * @param {string | null} projectionId
 * @param {string | null} widgetId
 * @returns {any}
 */
function uiRequiredGates(projectionId = null, widgetId = null) {
  return [
    { command: "topogram check", reason: "Validate shared UI ownership, taxonomy, references, and topology." },
    {
      command: `topogram widget check${projectionId ? ` --projection ${projectionId}` : ""}${widgetId ? ` --widget ${widgetId}` : ""}`,
      reason: "Validate widget placement, props, events, regions, and patterns."
    },
    {
      command: `topogram widget behavior${projectionId ? ` --projection ${projectionId}` : ""}${widgetId ? ` --widget ${widgetId}` : ""}`,
      reason: "Inspect behavior realizations and partial bindings before code changes."
    },
    {
      command: `topogram emit ui-realization-report${projectionId ? ` --projection ${projectionId}` : ""} --json`,
      reason: "Confirm screens, regions, widgets, display fields, behavior, and design tokens are realizable by the web generator."
    }
  ];
}
