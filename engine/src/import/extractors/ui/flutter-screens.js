import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function featureStemFromPath(filePath) {
  return canonicalCandidateTerm(filePath.match(/\/features\/([^/]+)\//)?.[1] || "item");
}

function inferScreenId(filePath) {
  const fileStem = filePath.split("/").pop()?.replace(/\.dart$/, "") || "screen";
  const normalized = idHintify(fileStem);
  return normalized.replace(/_screen$/, "");
}

function inferScreenKind(screenId) {
  if (/detail/.test(screenId)) return "detail";
  if (/create|edit/.test(screenId)) return "form";
  if (/list/.test(screenId)) return "list";
  return "flow";
}

function inferRoutePath(featureStem, screenId) {
  if (screenId === `${featureStem}_list`) return `/${featureStem}s`;
  if (screenId === `create_${featureStem}`) return `/${featureStem}s/new`;
  if (screenId === `${featureStem}_detail`) return `/${featureStem}s/:id`;
  return `/${screenId.replace(/_/g, "-")}`;
}

function inferCapabilityHints(featureStem, screenId, text) {
  const hints = new Set();
  if (/refresh|get[A-Z][A-Za-z0-9_]*List|Fetched\(/.test(text) || /ListView\.builder/.test(text)) {
    hints.add(`cap_list_${featureStem}s`);
  }
  if (/create[A-Z]|FloatingActionButton|note_add|Icons\.add/.test(text) || /Mode\.create/.test(text) || /Create[A-Z]/.test(screenId)) {
    hints.add(`cap_create_${featureStem}`);
  }
  if (/update[A-Z]|Mode\.update|Icons\.edit/.test(text) || /edit/.test(screenId)) {
    hints.add(`cap_update_${featureStem}`);
  }
  if (/delete[A-Z]|Icons\.delete|DeleteDialog/.test(text)) {
    hints.add(`cap_delete_${featureStem}`);
  }
  if (/detail/.test(screenId) || /Navigator\.push/.test(text)) {
    hints.add(`cap_list_${featureStem}s`);
  }
  return [...hints];
}

function parseScreenFile(filePath, text, repoRoot) {
  const widgetMatch = String(text || "").match(/class\s+([A-Za-z_][A-Za-z0-9_]*)\s+extends\s+(?:StatefulWidget|StatelessWidget)/);
  if (!widgetMatch) return null;
  const featureStem = featureStemFromPath(filePath);
  const screenId = inferScreenId(filePath);
  const routePath = inferRoutePath(featureStem, screenId);
  const entityId = `entity_${featureStem}`;
  const provenance = `${relativeTo(repoRoot, filePath)}#${widgetMatch[1]}`;
  const capabilityHints = inferCapabilityHints(featureStem, screenId, text);
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

export const flutterScreensUiExtractor = {
  id: "ui.flutter-screens",
  track: "ui",
  detect(context) {
    const files = findPrimaryImportFiles(
      context.paths,
      (filePath) => /\/lib\/features\/.+\/presentation\/screens\/.+_screen\.dart$/i.test(filePath)
    );
    const score = files.length > 0 ? 84 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Flutter feature presentation screens"] : []
    };
  },
  extract(context) {
    const files = findPrimaryImportFiles(
      context.paths,
      (filePath) => /\/lib\/features\/.+\/presentation\/screens\/.+_screen\.dart$/i.test(filePath)
    );
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };
    for (const filePath of files) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const parsed = parseScreenFile(filePath, text, context.paths.repoRoot);
      if (!parsed) continue;
      findings.push({
        kind: "flutter_screen",
        file: relativeTo(context.paths.repoRoot, filePath),
        screen_id: parsed.screen.id_hint
      });
      candidates.screens.push(parsed.screen);
      candidates.routes.push(parsed.route);
      candidates.actions.push(...parsed.actions);
    }
    if (candidates.screens.length > 0) {
      candidates.stacks.push("flutter_material");
    }
    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
