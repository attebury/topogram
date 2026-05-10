// @ts-check

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
    screens: (ownerProjection.uiScreens || []).map(/** @param {any} screen */ (screen) => ({
      id: screen.id,
      kind: screen.kind,
      title: screen.title || screen.id
    })),
    routes: (projection.uiRoutes || []).map(/** @param {any} route */ (route) => ({
      screenId: route.screenId,
      path: route.path
    })),
    widgets: (ownerProjection.widgetBindings || []).map(/** @param {import("../shared/types.d.ts").ContextWidgetUsage} usage */ (usage) => widgetUsagePacket(usage, ownerProjection)),
    designTokens: designIntentPacket(ownerProjection),
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
 * @param {import("../shared/types.d.ts").ContextWidgetUsage} usage
 * @param {import("../shared/types.d.ts").ContextProjection | null} projection
 * @returns {any}
 */
function widgetUsagePacket(usage, projection = null) {
  const screen = (projection?.uiScreens || []).find(/** @param {any} entry */ (entry) => entry.id === usage.screenId) || null;
  const region = (projection?.uiScreenRegions || []).find(/** @param {any} entry */ (entry) =>
    entry.screenId === usage.screenId && entry.region === usage.region
  ) || null;
  return {
    screenId: usage.screenId || null,
    screen: screen
      ? {
          id: screen.id,
          kind: screen.kind || null,
          title: screen.title || screen.id
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
    eventBindings: (usage.eventBindings || []).map(/** @param {any} binding */ (binding) => ({
      event: binding.event || null,
      action: binding.action || null,
      target: binding.target?.id || binding.target || null
    }))
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
    }
  ];
}
