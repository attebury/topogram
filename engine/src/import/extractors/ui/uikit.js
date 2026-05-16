import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findPrimaryImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function screenIdFromController(className) {
  return idHintify(
    canonicalCandidateTerm(
      className
        .replace(/(Table|Collection)?ViewController$/, "")
        .replace(/ViewController$/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    )
  );
}

function screenKindFromClass(className, screenId) {
  if (/TableViewController$/.test(className) || /CollectionViewController$/.test(className)) return "list";
  if (/Settings|Onboarding|Theme|Search/i.test(className) || /settings|onboarding|theme|search/.test(screenId)) return "settings";
  if (/Home/i.test(className) || /home/.test(screenId)) return "flow";
  if (/About|Tip/i.test(className)) return "detail";
  return "flow";
}

function conceptIdFromScreen(screenId) {
  if (/^setting$|settings|theme|about|search/.test(screenId)) {
    return "surface_settings";
  }
  if (/onboarding|default_browser|show_me_how|get_started|tooltip|terms_of_service|privacy_policy/.test(screenId)) return "surface_onboarding";
  return `surface_${screenId}`;
}

function routePathFromScreen(screenId) {
  if (screenId === "browser") return "/browser";
  if (screenId === "home") return "/";
  return `/${screenId.replace(/_/g, "-")}`;
}

function navigationActions(text) {
  const actions = [];
  for (const match of String(text || "").matchAll(/pushViewController\(\s*([A-Z][A-Za-z0-9_]*)\(/g)) {
    actions.push({ kind: "push", targetClass: match[1] });
  }
  for (const match of String(text || "").matchAll(/present\(\s*([A-Z][A-Za-z0-9_]*)\(/g)) {
    actions.push({ kind: "present", targetClass: match[1] });
  }
  for (const match of String(text || "").matchAll(/show\(\s*([A-Z][A-Za-z0-9_]*)\(/g)) {
    actions.push({ kind: "show", targetClass: match[1] });
  }
  return actions;
}

function shouldIgnoreFile(filePath) {
  return /Tests\/|Preview Files\/|UIHelpers\/|Extensions\/|Widgets\/|InternalSettings\/.*View\.swift$/.test(filePath);
}

export const uiKitExtractor = {
  id: "ui.uikit",
  track: "ui",
  detect(context) {
    const controllerFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.swift$/i.test(filePath))
      .filter((filePath) => !shouldIgnoreFile(filePath))
      .filter((filePath) => /(UIViewController|UITableViewController|UICollectionViewController)/.test(context.helpers.readTextIfExists(filePath) || ""));
    return {
      score: controllerFiles.length > 0 ? 87 : 0,
      reasons: controllerFiles.length > 0 ? ["Found UIKit view controllers"] : []
    };
  },
  extract(context) {
    const controllerFiles = findPrimaryImportFiles(context.paths, (filePath) => /\.swift$/i.test(filePath))
      .filter((filePath) => !shouldIgnoreFile(filePath))
      .filter((filePath) => /(UIViewController|UITableViewController|UICollectionViewController)/.test(context.helpers.readTextIfExists(filePath) || ""));
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };
    const classIndex = new Map();

    for (const filePath of controllerFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      for (const match of text.matchAll(/(?:final\s+)?class\s+([A-Z][A-Za-z0-9_]*)\s*:\s*([A-Za-z0-9_, ]*(?:UIViewController|UITableViewController|UICollectionViewController)[A-Za-z0-9_, ]*)/g)) {
        classIndex.set(match[1], { filePath, text, base: match[2] });
      }
    }

    for (const [className, entry] of classIndex.entries()) {
      const screenId = screenIdFromController(className);
      const routePath = routePathFromScreen(screenId);
      const conceptId = conceptIdFromScreen(screenId);
      const provenance = `${relativeTo(context.paths.repoRoot, entry.filePath)}#${className}`;
      candidates.screens.push(makeCandidateRecord({
        kind: "screen",
        idHint: screenId,
        label: titleCase(screenId),
        confidence: "high",
        sourceKind: "route_code",
        provenance,
        track: "ui",
        entity_id: null,
        concept_id: conceptId,
        screen_kind: screenKindFromClass(className, screenId),
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
        entity_id: null,
        concept_id: conceptId,
        path: routePath
      }));
      for (const action of navigationActions(entry.text)) {
        const targetScreenId = screenIdFromController(action.targetClass);
        candidates.actions.push(makeCandidateRecord({
          kind: "ui_action",
          idHint: `${screenId}_${action.kind}_${targetScreenId}`,
          label: `${action.kind} ${targetScreenId}`,
          confidence: "medium",
          sourceKind: "route_code",
          provenance,
          track: "ui",
          screen_id: screenId,
          entity_id: null,
          concept_id: conceptId,
          capability_hint: null,
          prominence: "primary"
        }));
      }
      findings.push({
        kind: "uikit_controller",
        file: relativeTo(context.paths.repoRoot, entry.filePath),
        screen_id: screenId
      });
    }

    if (candidates.screens.length > 0) {
      candidates.actions.push(makeCandidateRecord({
        kind: "navigation",
        idHint: "uikit_stack_navigation",
        label: "stack_navigation",
        confidence: "medium",
        sourceKind: "layout_code",
        provenance: controllerFiles.map((filePath) => relativeTo(context.paths.repoRoot, filePath)),
        track: "ui",
        navigation_pattern: "stack_navigation"
      }));
      candidates.actions.push(makeCandidateRecord({
        kind: "ui_shell",
        idHint: "uikit_navigation_shell",
        label: "Navigation",
        confidence: "medium",
        sourceKind: "layout_code",
        provenance: controllerFiles.map((filePath) => relativeTo(context.paths.repoRoot, filePath)),
        track: "ui",
        shell_kind: "topbar"
      }));
      candidates.stacks.push("uikit");
    }

    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
