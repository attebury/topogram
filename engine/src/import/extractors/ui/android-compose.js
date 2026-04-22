import {
  canonicalCandidateTerm,
  dedupeCandidateRecords,
  findImportFiles,
  idHintify,
  makeCandidateRecord,
  relativeTo,
  titleCase
} from "../../core/shared.js";

function screenKindFromId(id) {
  if (/detail/i.test(id)) return "detail";
  if (/settings/i.test(id)) return "settings";
  if (/home|list/i.test(id)) return "list";
  return "flow";
}

function entityIdFromScreenId(id) {
  if (/pokemon/i.test(id) || /home|detail/i.test(id)) return "entity_pokemon";
  if (/settings/i.test(id)) return null;
  return `entity_${canonicalCandidateTerm(id)}`;
}

function parseNavHostEntries(text) {
  const entries = [];
  for (const match of String(text || "").matchAll(/entry<[^>]*?\.([A-Za-z_][A-Za-z0-9_]*)>\s*(?:\([\s\S]*?\))?\s*\{[\s\S]*?\b([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
    entries.push({
      navKey: match[1],
      composable: match[2]
    });
  }
  return entries;
}

function parseNavigationActions(text) {
  const actions = [];
  for (const match of String(text || "").matchAll(/navigate(?:To)?\(?\s*(?:PokedexScreen\.)?([A-Z][A-Za-z0-9_]+)/g)) {
    actions.push(match[1]);
  }
  return [...new Set(actions)];
}

function composeNavigationSummary(text) {
  const source = String(text || "");
  return {
    shellKind:
      /\bNavigationRail\b/.test(source) ? "sidebar"
      : /\bNavigationBar\b/.test(source) ? "bottom_tabs"
      : /\bScaffold\b|\bTopAppBar\b/.test(source) ? "topbar"
      : null,
    patterns: [
      ...new Set([
        /\bNavHost\b|\bNavController\b/.test(source) ? "stack_navigation" : null,
        /\bNavigationBar\b/.test(source) ? "bottom_tabs" : null,
        /\bNavigationRail\b/.test(source) ? "navigation_rail" : null,
        /\bTabRow\b|\bScrollableTabRow\b|\bHorizontalPager\b/.test(source) ? "tabs" : null
      ].filter(Boolean))
    ],
    features: [
      ...new Set([
        /\bModalBottomSheet\b|\bBottomSheetScaffold\b/.test(source) ? "sheet" : null,
        /\bModalBottomSheet\b|\bBottomSheetScaffold\b/.test(source) ? "bottom_sheet" : null,
        /\bFloatingActionButton\b|\bExtendedFloatingActionButton\b/.test(source) ? "fab" : null,
        /\bpullRefresh\b|\bPullRefreshIndicator\b/.test(source) ? "pull_to_refresh" : null,
        /\bSearchBar\b|\bSearchView\b/.test(source) ? "search" : null
      ].filter(Boolean))
    ]
  };
}

function mergeComposeSummaries(summaries) {
  const shellKind =
    summaries.find((entry) => entry.shellKind === "sidebar")?.shellKind
    || summaries.find((entry) => entry.shellKind === "bottom_tabs")?.shellKind
    || summaries.find((entry) => entry.shellKind === "topbar")?.shellKind
    || null;
  return {
    shellKind,
    patterns: [...new Set(summaries.flatMap((entry) => entry.patterns || []))].sort(),
    features: [...new Set(summaries.flatMap((entry) => entry.features || []))].sort()
  };
}

export const androidComposeUiExtractor = {
  id: "ui.android-compose",
  track: "ui",
  detect(context) {
    const composeFiles = findImportFiles(context.paths, (filePath) => /\.kt$/i.test(filePath))
      .filter((filePath) => /@Composable/.test(context.helpers.readTextIfExists(filePath) || ""));
    const score = composeFiles.length > 0 ? 84 : 0;
    return {
      score,
      reasons: score > 0 ? ["Found Android Jetpack Compose screens"] : []
    };
  },
  extract(context) {
    const navFiles = findImportFiles(context.paths, (filePath) => /NavHost\.kt$/i.test(filePath) || /navigation\/.+\.kt$/i.test(filePath));
    const composeFiles = findImportFiles(context.paths, (filePath) => /\.kt$/i.test(filePath))
      .filter((filePath) => /@Composable/.test(context.helpers.readTextIfExists(filePath) || ""));
    const findings = [];
    const candidates = { screens: [], routes: [], actions: [], stacks: [] };
    const composableByName = new Map();
    const composeSummaries = [];

    for (const filePath of composeFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      composeSummaries.push({
        provenance: relativeTo(context.paths.repoRoot, filePath),
        ...composeNavigationSummary(text)
      });
      for (const match of text.matchAll(/@Composable[\s\S]*?fun\s+([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
        composableByName.set(match[1], {
          filePath,
          text
        });
      }
    }

    const aggregateSummary = mergeComposeSummaries(composeSummaries);
    if (aggregateSummary.shellKind) {
      candidates.actions.push(makeCandidateRecord({
        kind: "ui_shell",
        idHint: `${idHintify(aggregateSummary.shellKind)}_shell`,
        label: titleCase(aggregateSummary.shellKind),
        confidence: "medium",
        sourceKind: "layout_code",
        provenance: composeSummaries.map((entry) => entry.provenance),
        track: "ui",
        shell_kind: aggregateSummary.shellKind
      }));
    }
    for (const pattern of aggregateSummary.patterns) {
      candidates.actions.push(makeCandidateRecord({
        kind: "ui_navigation",
        idHint: `compose_${idHintify(pattern)}`,
        label: pattern,
        confidence: "medium",
        sourceKind: "layout_code",
        provenance: composeSummaries.filter((entry) => entry.patterns.includes(pattern)).map((entry) => entry.provenance),
        track: "ui",
        navigation_pattern: pattern
      }));
    }
    for (const feature of aggregateSummary.features) {
      candidates.actions.push(makeCandidateRecord({
        kind: "ui_presentation",
        idHint: `compose_${idHintify(feature)}`,
        label: feature,
        confidence: "low",
        sourceKind: "layout_code",
        provenance: composeSummaries.filter((entry) => entry.features.includes(feature)).map((entry) => entry.provenance),
        track: "ui",
        presentation: feature
      }));
    }

    for (const filePath of navFiles) {
      const text = context.helpers.readTextIfExists(filePath) || "";
      const provenanceFile = relativeTo(context.paths.repoRoot, filePath);
      for (const entry of parseNavHostEntries(text)) {
        const screenStem = canonicalCandidateTerm(entry.navKey.replace(/Screen$/, ""));
        const screenId = /details/i.test(entry.navKey) ? "pokemon_detail" : /home/i.test(entry.navKey) ? "pokemon_list" : /settings/i.test(entry.navKey) ? "settings" : idHintify(screenStem);
        const routePath = /detail/i.test(screenId) ? "/pokemon/:name" : screenId === "pokemon_list" ? "/pokemon" : screenId === "settings" ? "/settings" : `/${screenStem.replace(/_/g, "-")}`;
        const entityId = entityIdFromScreenId(screenId);
        candidates.screens.push(makeCandidateRecord({
          kind: "screen",
          idHint: screenId,
          label: titleCase(screenId),
          confidence: "high",
          sourceKind: "route_code",
          provenance: `${provenanceFile}#${entry.navKey}`,
          track: "ui",
          entity_id: entityId,
          concept_id: entityId || `surface_${screenId}`,
          screen_kind: screenKindFromId(screenId),
          route_path: routePath
        }));
        candidates.routes.push(makeCandidateRecord({
          kind: "ui_route",
          idHint: `${screenId}_route`,
          label: routePath,
          confidence: "high",
          sourceKind: "route_code",
          provenance: `${provenanceFile}#${entry.navKey}`,
          track: "ui",
          screen_id: screenId,
          entity_id: entityId,
          concept_id: entityId || `surface_${screenId}`,
          path: routePath
        }));

        const screenFile = composableByName.get(entry.composable);
        const actions = parseNavigationActions(screenFile?.text || "");
        for (const action of actions) {
          const capabilityHint = /detail/i.test(action) ? "cap_get_pokemon" : /settings/i.test(action) ? null : "cap_list_pokemons";
          if (!capabilityHint) continue;
          candidates.actions.push(makeCandidateRecord({
            kind: "ui_action",
            idHint: `${screenId}_${idHintify(capabilityHint)}`,
            label: capabilityHint,
            confidence: "medium",
            sourceKind: "route_code",
            provenance: `${relativeTo(context.paths.repoRoot, screenFile?.filePath || filePath)}#${entry.composable}`,
            track: "ui",
            screen_id: screenId,
            entity_id: entityId,
            concept_id: entityId || `surface_${screenId}`,
            capability_hint: capabilityHint,
            prominence: "primary"
          }));
        }
      }
    }

    if (candidates.screens.length > 0) {
      findings.push({
        kind: "android_compose_navigation",
        screen_count: candidates.screens.length,
        route_count: candidates.routes.length
      });
      candidates.stacks.push("android_compose");
    }

    candidates.screens = dedupeCandidateRecords(candidates.screens, (record) => record.id_hint);
    candidates.routes = dedupeCandidateRecords(candidates.routes, (record) => record.id_hint);
    candidates.actions = dedupeCandidateRecords(candidates.actions, (record) => record.id_hint);
    candidates.stacks = [...new Set(candidates.stacks)].sort();
    return { findings, candidates };
  }
};
