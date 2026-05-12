import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  idHintify,
  isPrimaryImportSource,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function inferScreenId(viewName) {
  if (/CountriesList/i.test(viewName)) return "country_list";
  if (/CountryDetails/i.test(viewName)) return "country_detail";
  if (/ModalFlag/i.test(viewName)) return "country_flag_modal";
  return idHintify(canonicalCandidateTerm(viewName.replace(/View$/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2")));
}

function inferRoutePath(screenId) {
  if (screenId === "country_list") return "/countries";
  if (screenId === "country_detail") return "/countries/:alpha3Code";
  if (screenId === "country_flag_modal") return "/countries/:alpha3Code/flag";
  return `/${screenId.replace(/_/g, "-")}`;
}

function entityIdForScreen(screenId) {
  if (/country/.test(screenId)) return screenId === "country_detail" || screenId === "country_list" || screenId === "country_flag_modal" ? "entity_country" : "entity_country";
  return null;
}

function parseSwiftUIView(filePath, text, repoRoot) {
  const views = [];
  for (const match of String(text || "").matchAll(/struct\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*View\s*\{/g)) {
    const viewName = match[1];
    if (/^(ErrorView|ImageView|CountryCell|DetailRow)$/.test(viewName)) continue;
    const screenId = inferScreenId(viewName);
    const routePath = inferRoutePath(screenId);
    const entityId = entityIdForScreen(screenId);
    const provenance = `${relativeTo(repoRoot, filePath)}#${viewName}`;
    const capabilityHints = [];
    if (/loadCountriesList|refreshCountriesList/.test(text)) capabilityHints.push("cap_list_countries");
    if (/loadCountryDetails/.test(text)) capabilityHints.push("cap_get_country_details");
    views.push({
      screen: makeCandidateRecord({
        kind: "screen",
        idHint: screenId,
        label: titleCase(screenId),
        confidence: "high",
        sourceKind: "route_code",
        provenance,
        track: "ui",
        entity_id: entityId,
        concept_id: entityId || `surface_${screenId}`,
        screen_kind: /detail/.test(screenId) ? "detail" : /modal/.test(screenId) ? "flow" : "list",
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
        concept_id: entityId || `surface_${screenId}`,
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
        concept_id: entityId || `surface_${screenId}`,
        capability_hint: capabilityHint,
        prominence: "primary"
      }))
    });
  }
  return views;
}

function swiftUiNavigationSummary(text) {
  const source = String(text || "");
  return {
    shellKind:
      /\bNavigationSplitView\b/.test(source) ? "split_view"
      : /\bTabView\b/.test(source) ? "bottom_tabs"
      : /\bNavigationStack\b|\bNavigationView\b/.test(source) ? "topbar"
      : null,
    patterns: [
      ...new Set([
        /\bNavigationStack\b|\bNavigationView\b/.test(source) ? "stack_navigation" : null,
        /\bTabView\b/.test(source) ? "bottom_tabs" : null,
        /\bNavigationSplitView\b/.test(source) ? "split_view" : null,
        /\bPicker\b|\bSegmentedPickerStyle\b/.test(source) ? "segmented_control" : null
      ].filter(Boolean))
    ],
    features: [
      ...new Set([
        /\.sheet\s*\(/.test(source) ? "sheet" : null,
        /\.popover\s*\(/.test(source) ? "popover" : null,
        /\.refreshable\s*\{/.test(source) ? "pull_to_refresh" : null,
        /\.searchable\s*\(/.test(source) ? "search" : null
      ].filter(Boolean))
    ]
  };
}

export const swiftUiExtractor = {
  id: "ui.swiftui",
  track: "ui",
  detect(context) {
    const files = findImportFiles(context.paths, (filePath) => /\.swift$/i.test(filePath) && isPrimaryImportSource(context.paths, filePath))
      .filter((filePath) => /:\s*View\b/.test(context.helpers.readTextIfExists(filePath) || ""));
    return {
      score: files.length > 0 ? 84 : 0,
      reasons: files.length > 0 ? ["Found SwiftUI views"] : []
    };
  },
  extract(context) {
    const files = findImportFiles(context.paths, (filePath) => /\.swift$/i.test(filePath) && isPrimaryImportSource(context.paths, filePath))
      .filter((filePath) => /:\s*View\b/.test(context.helpers.readTextIfExists(filePath) || ""));
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };
    for (const filePath of files) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const parsed = parseSwiftUIView(filePath, text, context.paths.repoRoot);
      if (parsed.length === 0) continue;
      const summary = swiftUiNavigationSummary(text);
      findings.push({
        kind: "swiftui_views",
        file: relativeTo(context.paths.repoRoot, filePath),
        screen_count: parsed.length
      });
      if (summary.shellKind) {
        candidates.actions.push(makeCandidateRecord({
          kind: "ui_shell",
          idHint: `${idHintify(summary.shellKind)}_shell`,
          label: titleCase(summary.shellKind),
          confidence: "medium",
          sourceKind: "layout_code",
          provenance: relativeTo(context.paths.repoRoot, filePath),
          track: "ui",
          shell_kind: summary.shellKind
        }));
      }
      for (const pattern of summary.patterns) {
        candidates.actions.push(makeCandidateRecord({
          kind: "navigation",
          idHint: `swiftui_${idHintify(pattern)}`,
          label: pattern,
          confidence: "medium",
          sourceKind: "layout_code",
          provenance: relativeTo(context.paths.repoRoot, filePath),
          track: "ui",
          navigation_pattern: pattern
        }));
      }
      for (const feature of summary.features) {
        candidates.actions.push(makeCandidateRecord({
          kind: "ui_presentation",
          idHint: `swiftui_${idHintify(feature)}`,
          label: feature,
          confidence: "low",
          sourceKind: "layout_code",
          provenance: relativeTo(context.paths.repoRoot, filePath),
          track: "ui",
          presentation: feature
        }));
      }
      for (const entry of parsed) {
        candidates.screens.push(entry.screen);
        candidates.routes.push(entry.route);
        candidates.actions.push(...entry.actions);
      }
    }
    if (candidates.screens.length > 0) {
      candidates.stacks.push("swiftui");
    }
    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
