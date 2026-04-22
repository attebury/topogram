import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function featureStemFromPath(filePath) {
  return canonicalCandidateTerm(filePath.match(/\/src\/([^/]+)\//)?.[1] || "item");
}

function inferScreenId(filePath) {
  const fileStem = filePath.split("/").pop()?.replace(/\.tsx$/, "") || "screen";
  const normalized = fileStem
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2");
  return idHintify(normalized)
    .replace(/_screen$/, "")
    .replace(/^posts$/, "post_list")
    .replace(/^post$/, "post_detail");
}

function inferScreenKind(screenId) {
  if (/detail$/.test(screenId)) return "detail";
  if (/list$/.test(screenId)) return "list";
  return "flow";
}

function inferRoutePath(featureStem, screenId) {
  if (screenId === `${featureStem}s` || screenId === `${featureStem}_list`) {
    return `/${featureStem}s`;
  }
  if (screenId === featureStem || screenId === `${featureStem}_detail`) {
    return `/${featureStem}s/:id`;
  }
  return `/${screenId.replace(/_/g, "-")}`;
}

function parseNavigatorRoutes(text) {
  const routes = new Map();
  for (const match of String(text || "").matchAll(/<Stack\.Screen\s+name="([^"]+)"\s+component=\{([A-Za-z_][A-Za-z0-9_]*)\}\s*\/>/g)) {
    routes.set(match[2], match[1]);
  }
  return routes;
}

function parseScreenFile(filePath, text, repoRoot, routeNamesByComponent) {
  const componentMatch =
    String(text || "").match(/export\s+default\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/) ||
    String(text || "").match(/const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:observer\()?/);
  if (!componentMatch) return null;
  const componentName = componentMatch[1];
  if (/NotFound/i.test(componentName)) return null;
  const featureStem = featureStemFromPath(filePath);
  const screenId = inferScreenId(filePath);
  const routeName = routeNamesByComponent.get(componentName) || componentName.replace(/Screen$/, "");
  const routePath =
    routeName === "Posts" ? `/${featureStem}s`
    : routeName === "Post" ? `/${featureStem}s/:id`
    : inferRoutePath(featureStem, screenId);
  const entityId = `entity_${featureStem}`;
  const provenance = `${relativeTo(repoRoot, filePath)}#${componentName}`;
  const capabilityHints = [];
  if (/getPosts\(/.test(text) || /FlatList/.test(text)) {
    capabilityHints.push(`cap_list_${featureStem}s`);
  }
  if (/findPost\(/.test(text) || /route\.params/.test(text)) {
    capabilityHints.push(`cap_get_${featureStem}`);
  }
  return {
    screen: makeCandidateRecord({
      kind: "screen",
      idHint: screenId,
      label: titleCase(screenId),
      confidence: "high",
      sourceKind: "route_code",
      provenance,
      track: "ui",
      entity_id: entityId,
      concept_id: entityId,
      screen_kind: inferScreenKind(screenId),
      route_path: routePath,
      capability_hints: capabilityHints
    }),
    route: makeCandidateRecord({
      kind: "ui_route",
      idHint: `${screenId}_route`,
      label: routePath,
      confidence: "high",
      sourceKind: "route_code",
      provenance,
      track: "ui",
      screen_id: screenId,
      entity_id: entityId,
      concept_id: entityId,
      path: routePath
    }),
    actions: capabilityHints.map((capabilityHint) => makeCandidateRecord({
      kind: "ui_action",
      idHint: `${screenId}_${idHintify(capabilityHint)}`,
      label: capabilityHint,
      confidence: "medium",
      sourceKind: "route_code",
      provenance,
      track: "ui",
      screen_id: screenId,
      entity_id: entityId,
      concept_id: entityId,
      capability_hint: capabilityHint,
      prominence: "primary"
    }))
  };
}

export const reactNativeScreensExtractor = {
  id: "ui.react-native-screens",
  track: "ui",
  detect(context) {
    const files = findImportFiles(
      context.paths,
      (filePath) => /\/src\/.+\/presentation\/screens\/.+Screen\.tsx$/i.test(filePath)
    );
    const score = files.length > 0 ? 83 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found React Native presentation screens"] : []
    };
  },
  extract(context) {
    const screenFiles = findImportFiles(
      context.paths,
      (filePath) => /\/src\/.+\/presentation\/screens\/.+Screen\.tsx$/i.test(filePath)
    );
    const navigatorFile = findImportFiles(
      context.paths,
      (filePath) => /\/src\/core\/presentation\/navigation\/RootNavigator\.tsx$/i.test(filePath)
    )[0];
    const routeNamesByComponent = parseNavigatorRoutes(context.helpers.readTextIfExists(navigatorFile) || "");
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };
    for (const filePath of screenFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const parsed = parseScreenFile(filePath, text, context.paths.repoRoot, routeNamesByComponent);
      if (!parsed) continue;
      findings.push({
        kind: "react_native_screen",
        file: relativeTo(context.paths.repoRoot, filePath),
        screen_id: parsed.screen.id_hint
      });
      candidates.screens.push(parsed.screen);
      candidates.routes.push(parsed.route);
      candidates.actions.push(...parsed.actions);
    }
    if (candidates.screens.length > 0) {
      candidates.stacks.push("react_native");
    }
    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
