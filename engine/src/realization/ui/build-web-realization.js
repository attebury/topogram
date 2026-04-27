import { buildApiRealization } from "../api/index.js";
import { generatorDefaultsMap, getProjection, sharedUiProjectionForWeb } from "../../generator/apps/shared.js";
import { buildUiSharedRealization } from "./build-ui-shared-realization.js";

function collectCapabilityIds(contract) {
  const capabilityIds = new Set();
  for (const screen of contract.screens || []) {
    if (screen.loadCapability?.id) capabilityIds.add(screen.loadCapability.id);
    if (screen.submitCapability?.id) capabilityIds.add(screen.submitCapability.id);
    if (screen.actions?.primary?.id) capabilityIds.add(screen.actions.primary.id);
    if (screen.actions?.secondary?.id) capabilityIds.add(screen.actions.secondary.id);
    if (screen.actions?.destructive?.id) capabilityIds.add(screen.actions.destructive.id);
    if (screen.actions?.terminal?.id) capabilityIds.add(screen.actions.terminal.id);
    for (const action of screen.actions?.screen || []) {
      capabilityIds.add(action.capability.id);
    }
  }
  return [...capabilityIds].sort();
}

export function buildWebRealization(graph, options = {}) {
  if (!options.projectionId) {
    throw new Error("Routed UI realization requires --projection <id>");
  }

  const projection = getProjection(graph, options.projectionId);
  const surfaceHints =
    projection.platform === "ui_ios" ? projection.uiIos || [] : projection.uiWeb || [];
  const sharedProjection = sharedUiProjectionForWeb(graph, projection);
  const sharedContract = sharedProjection
    ? buildUiSharedRealization(graph, { projectionId: sharedProjection.id })
    : {
        projection: null,
        realizes: [],
        outputs: [],
        screens: []
      };

  const routeMap = new Map((projection.uiRoutes || []).map((entry) => [entry.screenId, entry]));
  const uiWebByScreen = new Map();
  const uiWebByAction = new Map();

  for (const entry of surfaceHints) {
    if (entry.targetKind === "screen") {
      if (!uiWebByScreen.has(entry.targetId)) {
        uiWebByScreen.set(entry.targetId, []);
      }
      uiWebByScreen.get(entry.targetId).push(entry);
    } else if (entry.targetKind === "action") {
      if (!uiWebByAction.has(entry.targetId)) {
        uiWebByAction.set(entry.targetId, []);
      }
      uiWebByAction.get(entry.targetId).push(entry);
    }
  }

  const contract = {
    projection: {
      id: projection.id,
      name: projection.name || projection.id,
      platform: projection.platform
    },
    sharedProjection: sharedProjection
      ? {
          id: sharedProjection.id,
          name: sharedProjection.name || sharedProjection.id
        }
      : null,
    generatorDefaults: generatorDefaultsMap(projection),
    outputs: projection.outputs,
    appShell: sharedContract.appShell || null,
    navigation: {
      groups: sharedContract.navigation?.groups || [],
      patterns: sharedContract.navigation?.patterns || [],
      defaultScreenId: sharedContract.navigation?.defaultScreenId || null,
      items: (sharedContract.navigation?.items || []).map((item) => ({
        ...item,
        route: routeMap.get(item.screenId)?.path || item.route || null
      }))
    },
    screens: sharedContract.screens.map((screen) => ({
      ...screen,
      route: routeMap.get(screen.id)?.path || null,
      web: Object.fromEntries((uiWebByScreen.get(screen.id) || []).map((entry) => [entry.directive, entry.value])),
      actionWeb: Object.fromEntries(
        [...screen.actions.screen, screen.actions.primary, screen.actions.secondary, screen.actions.destructive, screen.actions.terminal]
          .filter(Boolean)
          .map((action) => {
            const actionId = action.capability?.id || action.id;
            const entries = uiWebByAction.get(actionId) || [];
            return [actionId, Object.fromEntries(entries.map((entry) => [entry.directive, entry.value]))];
          })
      )
    })),
    sitemap: (sharedContract.navigation?.items || [])
      .map((item) => ({
        screenId: item.screenId,
        label: item.label,
        route: routeMap.get(item.screenId)?.path || item.route || null,
        include: item.sitemap !== "exclude"
      }))
      .filter((entry) => entry.route)
  };
  const capabilityIds = collectCapabilityIds(contract);
  const apiContracts = {};
  for (const capabilityId of capabilityIds) {
    apiContracts[capabilityId] = buildApiRealization(graph, { capabilityId });
  }

  const isNativeUi = projection.platform === "ui_ios";

  return {
    type: isNativeUi ? "native_ui_realization" : "web_app_realization",
    app: {
      id: contract.projection.id,
      family: isNativeUi ? "native" : "web",
      target: contract.generatorDefaults.profile || (isNativeUi ? "swiftui" : "sveltekit"),
      name: contract.projection.name
    },
    contract,
    capabilityIds,
    apiContracts
  };
}
