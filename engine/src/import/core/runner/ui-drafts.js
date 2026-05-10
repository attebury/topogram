// @ts-check

import { ensureTrailingNewline } from "../shared.js";
import {
  capabilityHintsForScreen,
  importedApiCapabilityIds,
  inferredDataSourceForWidget,
  uiWidgetCandidates
} from "./candidates.js";

/**
 * @param {any[]} values
 * @returns {string[]}
 */
function uniqueSorted(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort();
}

/**
 * @param {string} workspaceRoot
 * @returns {string}
 */
function projectionIdStem(workspaceRoot) {
  const base = String(workspaceRoot || "").split(/[\\/]/).filter(Boolean).pop() || "imported_app";
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "imported_app";
}

/**
 * @param {any} widget
 * @returns {string}
 */
function widgetCandidateFileName(widget) {
  return `${String(widget.id_hint || "widget")
    .replace(/^component_/, "")
    .replace(/_/g, "-")}.tg`;
}

/**
 * @param {any} widget
 * @returns {string}
 */
function renderWidgetCandidate(widget) {
  const evidenceCount = (widget.evidence || widget.provenance || []).length;
  const missingDecisions = widget.missing_decisions || [
    "confirm widget reuse boundary",
    "confirm prop names and data source",
    "confirm events and behavior"
  ];
  const inferredEvents = Array.isArray(widget.inferred_events) ? widget.inferred_events : [];
  const inferredEventComments = inferredEvents.length > 0
    ? `${inferredEvents.map((/** @type {any} */ event) =>
        `  # Inferred event: ${event.name || "event"} ${event.action || "action"} ${event.target_screen || event.target || "target"}; requires payload shape review before adding an events block.`
      ).join("\n")}\n`
    : "";
  return `widget ${widget.id_hint} {
  # Import metadata: confidence ${widget.confidence || "unknown"}; evidence ${evidenceCount}; inferred pattern ${widget.pattern || widget.inferred_pattern || "search_results"}; inferred region ${widget.region || widget.inferred_region || "results"}.
  # Missing decisions: ${missingDecisions.join("; ")}.
${inferredEventComments}  # Event declarations are intentionally omitted until payload shapes are reviewed.
  name "${widget.label || widget.id_hint}"
  description "Candidate reusable widget inferred from imported UI evidence. Review props, behavior, events, and reuse before adoption."
  category collection
  props {
    ${widget.data_prop || "rows"} array required
  }
  patterns [${widget.pattern || "search_results"}]
  regions [${widget.region || "results"}]
  status proposed
}
`;
}

/**
 * @param {any[]} widgetCandidates
 * @param {Record<string, any>} allCandidates
 * @returns {string[]}
 */
function uiWidgetLinesForCandidates(widgetCandidates, allCandidates) {
  return widgetCandidates
    .filter((widget) => widget.screen_id && widget.region && widget.id_hint)
    .map((widget) => {
      const dataSource = inferredDataSourceForWidget(widget, allCandidates);
      const dataBinding = dataSource
        ? ` data ${widget.data_prop || "rows"} from ${dataSource}`
        : "";
      return `    screen ${widget.screen_id} region ${widget.region} widget ${widget.id_hint}${dataBinding}`;
    });
}

/**
 * @param {any} context
 * @param {any} candidates
 * @param {Record<string, any>} allCandidates
 * @returns {Record<string, string>}
 */
export function draftUiProjectionFiles(context, candidates, allCandidates = {}) {
  const ui = candidates || { screens: [], routes: [], actions: [], stacks: [] };
  /** @type {any[]} */
  const screens = [...(ui.screens || [])].sort((a, b) => String(a.route_path || "").localeCompare(String(b.route_path || "")) || a.id_hint.localeCompare(b.id_hint));
  /** @type {any[]} */
  const uiRoutes = ui.routes || [];
  /** @type {Map<string, string>} */
  const routes = new Map(uiRoutes.map((route) => [route.screen_id, route.path]));
  /** @type {any[]} */
  const actions = ui.actions || [];
  const widgetCandidates = [...uiWidgetCandidates(ui)].sort((a, b) => a.id_hint.localeCompare(b.id_hint));
  const shell = actions.find((entry) => entry.kind === "ui_shell")?.shell_kind || "topbar";
  const navigationPatterns = uniqueSorted(actions.filter((entry) => entry.kind === "navigation").map((entry) => entry.navigation_pattern));
  const presentations = uniqueSorted(actions.filter((entry) => entry.kind === "ui_presentation").map((entry) => entry.presentation));
  const capabilityHints = uniqueSorted([
    ...screens.flatMap((screen) => capabilityHintsForScreen(screen)),
    ...actions.map((entry) => entry.capability_hint).filter(Boolean),
    ...importedApiCapabilityIds(allCandidates)
  ]);
  const stem = projectionIdStem(context.paths.workspaceRoot);
  const defaultScreenId = screens.find((screen) => screen.screen_kind === "list")?.id_hint || screens[0]?.id_hint || null;

  const uiScreensBlock = screens.length > 0
    ? screens.map((screen) => {
        const directives = [`kind ${screen.screen_kind || "flow"}`, `title "${screen.label || screen.id_hint}"`];
        const screenCapabilityHints = capabilityHintsForScreen(screen);
        if (screenCapabilityHints.length > 0) {
          const loadHint = screenCapabilityHints.find((hint) => /^cap_(list|get)_/.test(hint));
          const submitHint = screenCapabilityHints.find((hint) => /^cap_(create|update|sign_in|follow|delete)_/.test(hint));
          if (loadHint && ["list", "detail", "job_status", "feed", "inbox", "dashboard", "analytics", "report"].includes(screen.screen_kind)) {
            directives.push(`load ${loadHint}`);
          }
          if (submitHint && ["form", "wizard", "settings", "flow"].includes(screen.screen_kind)) {
            directives.push(`submit ${submitHint}`);
          }
        }
        return `    screen ${screen.id_hint} ${directives.join(" ")}`;
      }).join("\n")
    : "    // No imported screens detected";

  const collectionScreens = screens.filter((screen) => screen.screen_kind === "list");
  const uiCollectionsLines = [];
  for (const screen of collectionScreens) {
    const screenPresentations = presentations.filter((presentation) =>
      ["table", "data_grid", "cards", "board", "calendar", "gallery", "list"].includes(presentation)
    );
    const preferredView =
      screenPresentations.find((presentation) => ["data_grid", "table", "cards", "list"].includes(presentation))
      || "list";
    uiCollectionsLines.push(`    screen ${screen.id_hint} view ${preferredView}`);
    if (presentations.includes("pull_to_refresh")) {
      uiCollectionsLines.push(`    screen ${screen.id_hint} refresh pull_to_refresh`);
    }
    if (presentations.includes("search")) {
      uiCollectionsLines.push(`    screen ${screen.id_hint} search query`);
    }
  }

  const uiActionsLines = actions
    .filter((entry) => entry.kind === "ui_action" && entry.screen_id && entry.capability_hint)
    .map((entry) => `    screen ${entry.screen_id} action ${entry.capability_hint} prominence ${entry.prominence || "secondary"}`);

  const uiNavigationLines = [];
  if (defaultScreenId) {
    if (navigationPatterns.includes("command_palette")) {
      uiNavigationLines.push(`    group workspace label "Workspace" placement primary pattern command_palette`);
    } else {
      uiNavigationLines.push(`    group workspace label "Workspace" placement primary`);
    }
  }
  for (const screen of screens) {
    const directives = [
      "group workspace",
      `label "${screen.label || screen.id_hint}"`,
      screen.id_hint === defaultScreenId ? "default true" : null,
      screen.id_hint === defaultScreenId || screen.screen_kind === "list" ? "visible true" : "visible false"
    ].filter(Boolean);
    const matchedPattern =
      navigationPatterns.find((pattern) =>
        (pattern === "stack_navigation" && screen.screen_kind === "detail")
        || (pattern === "segmented_control" && screen.screen_kind === "list")
        || (pattern === "bottom_tabs" && screen.screen_kind === "list")
      ) || null;
    if (matchedPattern) {
      directives.push(`pattern ${matchedPattern}`);
    }
    if (screen.screen_kind === "detail" && defaultScreenId && screen.id_hint !== defaultScreenId) {
      directives.push(`breadcrumb ${defaultScreenId}`);
      directives.push("sitemap exclude");
    }
    uiNavigationLines.push(`    screen ${screen.id_hint} ${directives.join(" ")}`);
  }

  const uiScreenRegionLines = [];
  for (const screen of screens) {
    if (screen.screen_kind === "list") {
      uiScreenRegionLines.push(`    screen ${screen.id_hint} region toolbar pattern action_bar placement primary`);
      const preferredPattern =
        presentations.includes("data_grid") ? "data_grid_view"
        : presentations.includes("table") ? "resource_table"
        : presentations.includes("cards") ? "resource_cards"
        : "search_results";
      uiScreenRegionLines.push(`    screen ${screen.id_hint} region results pattern ${preferredPattern} placement primary`);
    }
    if (screen.screen_kind === "detail") {
      uiScreenRegionLines.push(`    screen ${screen.id_hint} region summary pattern detail_panel placement primary`);
      if (presentations.includes("inspector_pane")) {
        uiScreenRegionLines.push(`    screen ${screen.id_hint} region aside pattern inspector_pane placement supporting`);
      }
    }
  }
  const uiWidgetLines = uiWidgetLinesForCandidates(widgetCandidates, allCandidates);

  const uiSharedDraft = `projection proj_ui_contract_imported_${stem} {
  name "Imported UI Contract Draft"
  description "Drafted from imported UI candidates. Review and adapt before adoption."

  type ui_contract
  realizes [
${capabilityHints.length > 0 ? capabilityHints.map((hint) => `    ${hint}`).join(",\n") : "    // add capability ids"}
  ]
  outputs [ui_contract]

  app_shell {
    brand "Imported ${stem.replace(/_/g, " ")}"
    shell ${shell}
${presentations.includes("search") ? "    global_search true\n" : ""}${presentations.includes("multi_window") ? "    windowing multi_window\n" : ""}  }

  design_tokens {
    density comfortable
    tone operational
    radius_scale medium
    color_role primary accent
    color_role danger critical
    typography_role body readable
    typography_role heading prominent
    action_role primary prominent
    action_role destructive danger
    accessibility contrast aa
    accessibility focus visible
  }

  screens {
${uiScreensBlock}
  }

${uiCollectionsLines.length > 0 ? `  collection_views {\n${uiCollectionsLines.join("\n")}\n  }\n\n` : ""}${uiActionsLines.length > 0 ? `  screen_actions {\n${uiActionsLines.join("\n")}\n  }\n\n` : ""}  navigation {
${uiNavigationLines.join("\n")}
  }

${uiScreenRegionLines.length > 0 ? `  screen_regions {\n${uiScreenRegionLines.join("\n")}\n  }\n\n` : ""}${uiWidgetLines.length > 0 ? `  widget_bindings {\n${uiWidgetLines.join("\n")}\n  }\n\n` : ""}  status proposed
}
`;

  const webCapHints = capabilityHints.length > 0 ? capabilityHints.join(",\n    ") : "// add capability ids";
  const uiRouteLines = screens
    .filter((screen) => routes.has(screen.id_hint))
    .map((screen) => `    screen ${screen.id_hint} path ${routes.get(screen.id_hint)}`);
  const uiWebLines = [];
  for (const screen of screens) {
    if (!routes.has(screen.id_hint)) continue;
    if (screen.id_hint === defaultScreenId) {
      uiWebLines.push(`    screen ${screen.id_hint} shell ${shell}`);
    }
    if (screen.screen_kind === "list") {
      const preferredCollection =
        presentations.includes("data_grid") ? "data_grid"
        : presentations.includes("table") ? "table"
        : presentations.includes("cards") ? "cards"
        : "list";
      uiWebLines.push(`    screen ${screen.id_hint} collection ${preferredCollection}`);
      if (presentations.includes("cards")) {
        uiWebLines.push(`    screen ${screen.id_hint} mobile_variant cards`);
      }
    }
    if (screen.screen_kind === "detail" && presentations.includes("sheet")) {
      uiWebLines.push(`    screen ${screen.id_hint} present sheet`);
    }
    if (screen.screen_kind === "detail" && presentations.includes("popover")) {
      uiWebLines.push(`    screen ${screen.id_hint} present popover`);
    }
  }
  for (const entry of actions.filter((action) => action.kind === "ui_action" && action.capability_hint)) {
    const actionPresent =
      presentations.includes("fab") ? "fab"
      : presentations.includes("popover") ? "popover"
      : "button";
    uiWebLines.push(`    action ${entry.capability_hint} present ${actionPresent}`);
  }

  const uiWebDraft = `projection proj_web_surface_imported_${stem} {
  name "Imported Web Surface Draft"
  description "Drafted from imported UI candidates. Review and adapt before adoption."

  type web_surface
  realizes [
    proj_ui_contract_imported_${stem},
    ${webCapHints}
  ]
  outputs [ui_contract, web_app]

  screen_routes {
${uiRouteLines.length > 0 ? uiRouteLines.join("\n") : "    // add routes"}
  }

${uiWebLines.length > 0 ? `  web_hints {\n${uiWebLines.join("\n")}\n  }\n\n` : ""}  generator_defaults {
    profile react
    language typescript
    styling css
  }

  status proposed
}
`;

  const coverage = `# Imported UI Projection Drafts

- Draft UI contract projection: \`candidates/app/ui/drafts/proj-ui-contract.tg\`
- Draft web surface projection: \`candidates/app/ui/drafts/proj-web-surface.tg\`
- Draft widget candidates: ${widgetCandidates.length}
- Imported screens: ${screens.length}
- Imported routes: ${(ui.routes || []).length}
- Imported UI actions/presentations: ${actions.length}
- Imported navigation patterns: ${navigationPatterns.length ? navigationPatterns.join(", ") : "none"}
- Imported presentations: ${presentations.length ? presentations.join(", ") : "none"}

## Review Notes

- These files are drafts, not adopted canonical projections.
- Capability ids come from imported hints and may need renaming or pruning.
- Widget candidates are suggested reusable contracts, not canonical ownership.
- Review widget props, events, behavior, regions, and patterns before adopting.
- Search and refresh directives are inferred heuristically.
- Navigation groups currently default to a single \`workspace\` group unless stronger grouping evidence exists.
`;

  /** @type {Record<string, string>} */
  const files = {
    "candidates/app/ui/drafts/proj-ui-contract.tg": ensureTrailingNewline(uiSharedDraft),
    "candidates/app/ui/drafts/proj-web-surface.tg": ensureTrailingNewline(uiWebDraft),
    "candidates/app/ui/drafts/README.md": ensureTrailingNewline(coverage)
  };
  for (const widget of widgetCandidates) {
    files[`candidates/app/ui/drafts/widgets/${widgetCandidateFileName(widget)}`] = ensureTrailingNewline(renderWidgetCandidate(widget));
  }
  return files;
}
