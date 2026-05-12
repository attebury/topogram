import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function screenIdFromClass(className) {
  return idHintify(canonicalCandidateTerm(className.replace(/Page$/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
}

function entityIdFromScreen(screenId) {
  if (/^todo_(item|list)$/.test(screenId)) return "entity_todo-item";
  if (/main/.test(screenId)) return "entity_item";
  return `entity_${canonicalCandidateTerm(screenId)}`;
}

function parseShellContent(text) {
  const screens = [];
  for (const match of String(text || "").matchAll(/ShellContent[^>]*Title="([^"]+)"[^>]*ContentTemplate="\{DataTemplate\s+views:([A-Za-z_][A-Za-z0-9_]*)\}"[^>]*Route="([^"]+)"/g)) {
    screens.push({
      title: match[1],
      pageClass: match[2],
      route: match[3]
    });
  }
  return screens;
}

function parseCommands(text) {
  return [...String(text || "").matchAll(/Command="\{Binding\s+([A-Za-z_][A-Za-z0-9_]*)\}"/g)]
    .map((entry) => entry[1]);
}

function parseClickedHandlers(text) {
  return [...String(text || "").matchAll(/Clicked="([A-Za-z_][A-Za-z0-9_]*)"/g)]
    .map((entry) => entry[1]);
}

function capabilityHintForHandler(screenId, handlerName) {
  const normalized = String(handlerName || "").replace(/^On/, "").replace(/Clicked$|ButtonClicked$|SelectionChanged$/g, "").toLowerCase();
  if (/save/.test(normalized)) return `cap_update_${canonicalCandidateTerm(screenId)}`;
  if (/delete/.test(normalized)) return `cap_delete_${canonicalCandidateTerm(screenId)}`;
  if (/add/.test(normalized)) return `cap_create_${canonicalCandidateTerm(screenId)}`;
  if (/selection/.test(normalized)) return `cap_get_${canonicalCandidateTerm(screenId)}`;
  if (/cancel/.test(normalized)) return null;
  return `cap_${idHintify(normalized)}_${canonicalCandidateTerm(screenId)}`;
}

export const mauiXamlUiExtractor = {
  id: "ui.maui-xaml",
  track: "ui",
  detect(context) {
    const xamlFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.xaml$/i.test(filePath));
    const score = xamlFiles.some((filePath) => /ContentPage|Shell/.test(context.helpers.readTextIfExists(filePath) || "")) ? 82 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found .NET MAUI XAML views and shell content"] : []
    };
  },
  extract(context) {
    const shellFiles = findPrimaryImportFiles(context.paths, (filePath) => /AppShell\.xaml$/i.test(filePath));
    const viewFiles = findPrimaryImportFiles(context.paths, (filePath) => /\/Views\/.+\.xaml$/i.test(filePath));
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };
    const shellEntries = shellFiles.flatMap((filePath) => parseShellContent(context.helpers.readTextIfExists(filePath) || ""));
    const shellByPage = new Map(shellEntries.map((entry) => [entry.pageClass, entry]));

    for (const filePath of viewFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const className = text.match(/x:Class="[^"]+\.([A-Za-z_][A-Za-z0-9_]*)"/)?.[1] || filePath.split("/").pop()?.replace(/\.xaml$/, "") || "page";
      const shellEntry = shellByPage.get(className);
      const screenId = screenIdFromClass(className);
      const routePath = shellEntry ? `/${shellEntry.route.replace(/^\/+/, "")}` : `/${screenId.replace(/_/g, "-")}`;
      const provenance = `${relativeTo(context.paths.repoRoot, filePath)}#${className}`;
      const entityId = entityIdFromScreen(screenId);
      candidates.screens.push(makeCandidateRecord({
        kind: "screen",
        idHint: screenId,
        label: shellEntry?.title || titleCase(screenId),
        confidence: "high",
        sourceKind: "route_code",
        provenance,
        track: "ui",
        entity_id: entityId,
        concept_id: entityId,
        screen_kind: "flow",
        route_path: routePath
      }));
      candidates.routes.push(makeCandidateRecord({
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
      }));
      for (const commandName of [...parseCommands(text), ...parseClickedHandlers(text)]) {
        const capabilityHint = capabilityHintForHandler(screenId, commandName);
        candidates.actions.push(makeCandidateRecord({
          kind: "ui_action",
          idHint: `${screenId}_${idHintify(commandName)}`,
          label: commandName,
          confidence: "medium",
          sourceKind: "route_code",
          provenance,
          track: "ui",
          screen_id: screenId,
          entity_id: entityId,
          concept_id: entityId,
          capability_hint: capabilityHint,
          prominence: "primary"
        }));
      }
      findings.push({ kind: "maui_xaml_view", file: relativeTo(context.paths.repoRoot, filePath), screen_id: screenId });
    }

    if (candidates.screens.length > 0) {
      candidates.stacks.push("maui_xaml");
    }
    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
