import { stableStringify } from "../format.js";

function normalizeVisibility(visibility = []) {
  return [...visibility]
    .map((entry) => ({
      capabilityId: entry.capabilityId ?? null,
      predicate: entry.predicate ?? null,
      value: entry.value ?? null,
      ownershipField: entry.ownershipField ?? null,
      claimValue: entry.claimValue ?? null
    }))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function normalizeScreen(screen) {
  return {
    id: screen.id ?? null,
    route: screen.route ?? null,
    kind: screen.kind ?? null,
    title: screen.title ?? null,
    loadCapabilityId: screen.loadCapability?.id ?? screen.loadCapabilityId ?? null,
    viewShapeId: screen.viewShape?.id ?? screen.viewShapeId ?? null,
    primaryActionId: screen.actions?.primary?.id ?? null,
    secondaryActionId: screen.actions?.secondary?.id ?? null,
    destructiveActionId: screen.actions?.destructive?.id ?? null,
    screenActionIds: (screen.actions?.screen ?? []).map((action) => action.id ?? null).filter(Boolean).sort(),
    visibility: normalizeVisibility(screen.visibility)
  };
}

function normalizeNavigationItem(item) {
  return {
    screenId: item.screenId ?? null,
    route: item.route ?? null,
    label: item.label ?? null,
    placement: item.placement ?? null,
    visible: item.visible ?? null,
    breadcrumb: item.breadcrumb ?? null,
    pattern: item.pattern ?? null
  };
}

function normalizeUiContract(contract) {
  return {
    appShell: contract.appShell ?? {},
    navigation: {
      defaultScreenId: contract.navigation?.defaultScreenId ?? null,
      items: (contract.navigation?.items ?? []).map(normalizeNavigationItem).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
      patterns: [...(contract.navigation?.patterns ?? [])].sort()
    },
    screens: (contract.screens ?? []).map(normalizeScreen).sort((a, b) => a.id.localeCompare(b.id))
  };
}

function extractServerContractObject(moduleSource) {
  const match = moduleSource.match(/export const serverContract = (\{[\s\S]*\}) as const;\s*$/);
  if (!match) {
    throw new Error("Could not parse emitted server-contract module");
  }
  return JSON.parse(match[1]);
}

function normalizeServerAuthz(authz = []) {
  return [...authz]
    .map((entry) => ({
      role: entry.role ?? null,
      permission: entry.permission ?? null,
      claim: entry.claim ?? null,
      claimValue: entry.claimValue ?? null,
      ownership: entry.ownership ?? null,
      ownershipField: entry.ownershipField ?? null
    }))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function normalizeRoute(route) {
  return {
    capabilityId: route.capabilityId ?? null,
    method: route.method ?? null,
    path: route.path ?? null,
    successStatus: route.successStatus ?? null,
    requestFields: (route.requestContract?.fields ?? [])
      .map((field) => ({
        name: field.name ?? null,
        required: field.required ?? null,
        location: field.transport?.location ?? null,
        wireName: field.transport?.wireName ?? null
      }))
      .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
    errorCases: (route.errorCases ?? [])
      .map((entry) => ({
        code: entry.code ?? null,
        status: entry.status ?? null,
        source: entry.source ?? null
      }))
      .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
    endpoint: {
      auth: route.endpoint?.auth ?? null,
      authz: normalizeServerAuthz(route.endpoint?.authz),
      preconditions: (route.endpoint?.preconditions ?? []).map((entry) => ({
        header: entry.header ?? null,
        required: entry.required ?? null,
        error: entry.error ?? null,
        code: entry.code ?? null
      })),
      idempotency: (route.endpoint?.idempotency ?? []).map((entry) => ({
        header: entry.header ?? null,
        required: entry.required ?? null,
        error: entry.error ?? null,
        code: entry.code ?? null
      }))
    }
  };
}

function normalizeServerContract(contract) {
  return {
    projection: {
      id: contract.projection?.id ?? null,
      type: contract.projection?.type ?? null
    },
    routes: (contract.routes ?? []).map(normalizeRoute).sort((a, b) => {
      const leftKey = `${a.method}:${a.path}:${a.capabilityId}`;
      const rightKey = `${b.method}:${b.path}:${b.capabilityId}`;
      return leftKey.localeCompare(rightKey);
    })
  };
}

function buildScreenDiffs(leftScreens, rightScreens) {
  const rightById = new Map(rightScreens.map((screen) => [screen.id, screen]));
  const leftById = new Map(leftScreens.map((screen) => [screen.id, screen]));
  const diffs = [];

  for (const screen of leftScreens) {
    const other = rightById.get(screen.id);
    if (!other) {
      diffs.push({ type: "missing_on_right", screenId: screen.id });
      continue;
    }
    if (stableStringify(screen) !== stableStringify(other)) {
      diffs.push({ type: "screen_mismatch", screenId: screen.id });
    }
  }

  for (const screen of rightScreens) {
    if (!leftById.has(screen.id)) {
      diffs.push({ type: "missing_on_left", screenId: screen.id });
    }
  }

  return diffs;
}

function buildRouteDiffs(leftRoutes, rightRoutes) {
  const rightByKey = new Map(rightRoutes.map((route) => [`${route.method}:${route.path}:${route.capabilityId}`, route]));
  const leftByKey = new Map(leftRoutes.map((route) => [`${route.method}:${route.path}:${route.capabilityId}`, route]));
  const diffs = [];

  for (const route of leftRoutes) {
    const key = `${route.method}:${route.path}:${route.capabilityId}`;
    const other = rightByKey.get(key);
    if (!other) {
      diffs.push({ type: "missing_on_right", route: key });
      continue;
    }
    if (stableStringify(route) !== stableStringify(other)) {
      diffs.push({ type: "route_mismatch", route: key });
    }
  }

  for (const route of rightRoutes) {
    const key = `${route.method}:${route.path}:${route.capabilityId}`;
    if (!leftByKey.has(key)) {
      diffs.push({ type: "missing_on_left", route: key });
    }
  }

  return diffs;
}

export function auditUiContractPair(leftContract, rightContract) {
  const left = normalizeUiContract(leftContract);
  const right = normalizeUiContract(rightContract);
  const screenDiffs = buildScreenDiffs(left.screens, right.screens);
  const navigationParity = stableStringify(left.navigation) === stableStringify(right.navigation);
  const appShellParity = stableStringify(left.appShell) === stableStringify(right.appShell);

  return {
    seam: "ui_surface_contract",
    semanticParity: screenDiffs.length === 0 && navigationParity && appShellParity,
    summary: {
      screenCount: left.screens.length,
      navigationItemCount: left.navigation.items.length
    },
    differences: {
      appShell: appShellParity ? [] : ["app_shell_mismatch"],
      navigation: navigationParity ? [] : ["navigation_mismatch"],
      screens: screenDiffs
    }
  };
}

export function auditServerContractModules(leftModuleSource, rightModuleSource) {
  const left = normalizeServerContract(extractServerContractObject(leftModuleSource));
  const right = normalizeServerContract(extractServerContractObject(rightModuleSource));
  const routeDiffs = buildRouteDiffs(left.routes, right.routes);

  return {
    seam: "server_contract",
    semanticParity: routeDiffs.length === 0,
    summary: {
      routeCount: left.routes.length,
      capabilityIds: left.routes.map((route) => route.capabilityId)
    },
    differences: {
      routes: routeDiffs
    }
  };
}
