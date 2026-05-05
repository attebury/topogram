import { getProjection, uiProjectionCandidates } from "../../generator/surfaces/shared.js";
import { buildComponentBehaviorRealizations } from "../../component-behavior.js";

function toBooleanFlag(value, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function buildAppShellContract(projection) {
  const values = Object.fromEntries((projection.uiAppShell || []).map((entry) => [entry.key, entry.value]));
  return {
    brand: values.brand || projection.name || projection.id,
    shell: values.shell || "topbar",
    primaryNav: values.primary_nav || "primary",
    secondaryNav: values.secondary_nav || "secondary",
    utilityNav: values.utility_nav || "utility",
    footer: values.footer || "none",
    globalSearch: toBooleanFlag(values.global_search, false),
    notifications: toBooleanFlag(values.notifications, false),
    accountMenu: toBooleanFlag(values.account_menu, false),
    workspaceSwitcher: toBooleanFlag(values.workspace_switcher, false),
    windowing: values.windowing || "single_window"
  };
}

function toSortEntry(entry) {
  return {
    field: entry.field,
    direction: entry.direction
  };
}

function ownershipFieldByCapability(graph) {
  const output = new Map();

  for (const projection of graph.byKind.projection || []) {
    for (const entry of projection.httpAuthz || []) {
      const capabilityId = entry.capability?.id;
      if (!capabilityId || !entry.ownershipField || output.has(capabilityId)) {
        continue;
      }
      output.set(capabilityId, entry.ownershipField);
    }
  }

  return output;
}

function deriveDefaultPattern(screen, collectionEntries) {
  if (screen.kind === "detail") return "detail_panel";
  if (screen.kind === "form") return "edit_form";
  if (screen.kind === "board") return "board_view";
  if (screen.kind === "calendar") return "calendar_view";
  if (screen.kind === "dashboard" || screen.kind === "analytics" || screen.kind === "report") return "summary_stats";
  if (screen.kind === "feed" || screen.kind === "inbox") return "activity_feed";
  const view = collectionEntries.find((entry) => entry.operation === "view")?.value;
  if (view === "data_grid") return "data_grid_view";
  if (view === "table") return "resource_table";
  if (view === "cards" || view === "gallery") return "resource_cards";
  if (screen.kind === "list") return "resource_table";
  return null;
}

function componentById(graph, componentId) {
  return (graph.byKind.component || []).find((component) => component.id === componentId) || null;
}

function componentContractFor(graph, componentId) {
  const component = componentById(graph, componentId);
  return component?.componentContract || null;
}

function summarizeComponentRef(graph, componentId) {
  const component = componentById(graph, componentId);
  if (!component) {
    return { id: componentId, name: componentId, category: null, version: null };
  }
  return {
    id: component.id,
    name: component.name || component.id,
    category: component.category || null,
    version: component.version || null
  };
}

function regionContractFor(regionEntries, regionName) {
  return (regionEntries || []).find((entry) => entry.region === regionName) || null;
}

export function buildComponentUsageContract(graph, entry, options = {}) {
  const componentId = entry.component?.id || null;
  const contract = componentId ? componentContractFor(graph, componentId) : null;
  const region = options.region || null;
  return {
    type: "ui_component_usage",
    region: entry.region || null,
    pattern: region?.pattern || null,
    placement: region?.placement || null,
    component: componentId ? summarizeComponentRef(graph, componentId) : null,
    dataBindings: (entry.dataBindings || []).map((binding) => ({
      prop: binding.prop || null,
      source: binding.source || null
    })),
    eventBindings: (entry.eventBindings || []).map((binding) => ({
      event: binding.event || null,
      action: binding.action || null,
      target: binding.target || null
    })),
    behaviorRealizations: buildComponentBehaviorRealizations(contract, entry)
  };
}

export function buildComponentContractMap(graph, componentUsages) {
  return Object.fromEntries(
    [...new Set(componentUsages.map((entry) => entry.component?.id).filter(Boolean))]
      .sort()
      .map((componentId) => [componentId, componentContractFor(graph, componentId)])
      .filter(([, contract]) => contract)
  );
}

function buildNavigationContract(projection, screens) {
  const routeMap = new Map((projection.uiRoutes || []).map((entry) => [entry.screenId, entry]));
  const screenEntries = (projection.uiNavigation || []).filter((entry) => entry.targetKind === "screen");
  const groupEntries = (projection.uiNavigation || []).filter((entry) => entry.targetKind === "group");
  const groups = groupEntries.map((entry) => ({
    id: entry.targetId,
    label: entry.directives.label || entry.targetId,
    placement: entry.directives.placement || "primary",
    pattern: entry.directives.pattern || null,
    icon: entry.directives.icon || null,
    order: entry.directives.order || null
  }));
  const byScreen = new Map(screenEntries.map((entry) => [entry.targetId, entry]));

  const items = screens.map((screen) => {
    const entry = byScreen.get(screen.id);
    const directives = entry?.directives || {};
    const route = routeMap.get(screen.id)?.path || null;
    const derivedVisible = route ? !route.includes(":") && !["detail"].includes(screen.kind) : false;
    return {
      screenId: screen.id,
      route,
      label: directives.label || screen.title || screen.id,
      groupId: directives.group || null,
      placement: directives.placement || "primary",
      pattern: directives.pattern || null,
      visible: directives.visible ? directives.visible === "true" : derivedVisible,
      default: directives.default === "true",
      breadcrumb: directives.breadcrumb || null,
      sitemap: directives.sitemap || "include",
      order: directives.order || null
    };
  });

  return {
    groups,
    items,
    patterns: [
      ...new Set([
        ...groups.map((group) => group.pattern).filter(Boolean),
        ...items.map((item) => item.pattern).filter(Boolean)
      ])
    ].sort(),
    defaultScreenId: items.find((item) => item.default)?.screenId || items.find((item) => item.visible)?.screenId || null
  };
}

function buildUiScreenContract(graph, projection, screen, ownershipFields) {
  const collectionEntries = (projection.uiCollections || []).filter((entry) => entry.screenId === screen.id);
  const actionEntries = (projection.uiActions || []).filter((entry) => entry.screenId === screen.id);
  const lookupEntries = (projection.uiLookups || []).filter((entry) => entry.screenId === screen.id);
  const regionEntries = (projection.uiScreenRegions || []).filter((entry) => entry.screenId === screen.id);
  const componentEntries = (projection.uiComponents || []).filter((entry) => entry.screenId === screen.id);
  const screenActionIds = new Set(
    [
      screen.primaryAction?.id,
      screen.secondaryAction?.id,
      screen.destructiveAction?.id,
      screen.terminalAction?.id,
      ...actionEntries.map((entry) => entry.capability?.id)
    ].filter(Boolean)
  );
  const visibilityEntries = (projection.uiVisibility || []).filter((entry) => screenActionIds.has(entry.capability?.id));
  const patterns = new Set(regionEntries.map((entry) => entry.pattern).filter(Boolean));
  const derivedDefaultPattern = deriveDefaultPattern(screen, collectionEntries);
  if (derivedDefaultPattern) {
    patterns.add(derivedDefaultPattern);
  }

  return {
    type: "ui_screen_contract",
    id: screen.id,
    kind: screen.kind,
    title: screen.title,
    loadCapability: screen.load,
    submitCapability: screen.submit,
    detailCapability: screen.detailCapability,
    inputShape: screen.inputShape,
    viewShape: screen.viewShape,
    itemShape: screen.itemShape,
    emptyState:
      screen.emptyTitle || screen.emptyBody
        ? {
            title: screen.emptyTitle,
            body: screen.emptyBody
          }
        : null,
    navigation: {
      successNavigate: screen.successNavigate,
      successRefresh: screen.successRefresh
    },
    states: {
      loading: screen.loadingState || "auto",
      empty: screen.emptyTitle || screen.emptyBody ? "empty_state_panel" : "auto",
      error: screen.errorState || "auto",
      unauthorized: screen.unauthorizedState || "auto",
      notFound: screen.notFoundState || "auto",
      success: screen.successState || "auto"
    },
    actions: {
      primary: screen.primaryAction,
      secondary: screen.secondaryAction,
      destructive: screen.destructiveAction,
      terminal: screen.terminalAction,
      screen: actionEntries.map((entry) => ({
        capability: entry.capability,
        prominence: entry.prominence,
        placement: entry.placement || null
      }))
    },
    collection: {
      filters: collectionEntries.filter((entry) => entry.operation === "filter").map((entry) => entry.field),
      search: collectionEntries.filter((entry) => entry.operation === "search").map((entry) => entry.field),
      pagination: collectionEntries.find((entry) => entry.operation === "pagination")?.field || null,
      views: collectionEntries.filter((entry) => entry.operation === "view").map((entry) => entry.value),
      refresh: collectionEntries.find((entry) => entry.operation === "refresh")?.value || "manual",
      groupBy: collectionEntries.filter((entry) => entry.operation === "group").map((entry) => entry.field),
      sort: collectionEntries
        .filter((entry) => entry.operation === "sort")
        .map(toSortEntry)
    },
    visibility: visibilityEntries.map((entry) => ({
      capability: entry.capability,
      predicate: entry.predicate,
      value: entry.value,
      claimValue: entry.claimValue || null,
      ownershipField: entry.predicate === "ownership" ? ownershipFields.get(entry.capability?.id || "") || null : null
    })),
    lookups: lookupEntries.map((entry) => ({
      field: entry.field,
      entity: entry.entity,
      labelField: entry.labelField,
      emptyLabel: entry.emptyLabel || null
    })),
    regions: regionEntries.map((entry) => ({
      region: entry.region,
      pattern: entry.pattern || null,
      placement: entry.placement || null,
      title: entry.title || null,
      state: entry.state || null,
      variant: entry.variant || null
    })),
    components: componentEntries.map((entry) => buildComponentUsageContract(graph, entry, {
      region: regionContractFor(regionEntries, entry.region)
    })),
    patterns: [...patterns]
  };
}

export function buildUiSharedRealization(graph, options = {}) {
  const projections = options.projectionId ? [getProjection(graph, options.projectionId)] : uiProjectionCandidates(graph);
  const ownershipFields = ownershipFieldByCapability(graph);

  if (options.projectionId) {
    const projection = projections[0];
    const componentUsages = projection.uiComponents || [];
    const screens = (projection.uiScreens || []).map((screen) => buildUiScreenContract(graph, projection, screen, ownershipFields));
    return {
      projection: {
        id: projection.id,
        name: projection.name || projection.id,
        platform: projection.platform
      },
      realizes: projection.realizes,
      outputs: projection.outputs,
      components: buildComponentContractMap(graph, componentUsages),
      appShell: buildAppShellContract(projection),
      navigation: buildNavigationContract(projection, screens),
      screens
    };
  }

  const output = {};
  for (const projection of projections) {
    const componentUsages = projection.uiComponents || [];
    const screens = (projection.uiScreens || []).map((screen) => buildUiScreenContract(graph, projection, screen, ownershipFields));
    output[projection.id] = {
      projection: {
        id: projection.id,
        name: projection.name || projection.id,
        platform: projection.platform
      },
      realizes: projection.realizes,
      outputs: projection.outputs,
      components: buildComponentContractMap(graph, componentUsages),
      appShell: buildAppShellContract(projection),
      navigation: buildNavigationContract(projection, screens),
      screens
    };
  }
  return output;
}
