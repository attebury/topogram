// @ts-check

export const UI_APP_SHELL_KINDS = new Set([
  "topbar",
  "sidebar",
  "dual_nav",
  "workspace",
  "wizard",
  "bottom_tabs",
  "split_view",
  "menu_bar"
]);

export const UI_WINDOWING_MODES = new Set(["single_window", "multi_window"]);

export const UI_SCREEN_KINDS = new Set([
  "list",
  "detail",
  "form",
  "dashboard",
  "job_status",
  "board",
  "calendar",
  "feed",
  "inbox",
  "settings",
  "wizard",
  "report",
  "analytics"
]);

export const UI_COLLECTION_PRESENTATIONS = new Set([
  "table",
  "data_grid",
  "cards",
  "list",
  "board",
  "calendar",
  "gallery"
]);

export const UI_NAVIGATION_PATTERNS = new Set([
  "primary",
  "tabs",
  "stack_navigation",
  "bottom_tabs",
  "segmented_control",
  "command_palette",
  "split_view",
  "navigation_rail"
]);

export const UI_REGION_KINDS = new Set([
  "hero",
  "toolbar",
  "filters",
  "search",
  "results",
  "summary",
  "metadata",
  "aside",
  "related",
  "activity",
  "comments",
  "timeline",
  "tabs",
  "bulk_actions",
  "footer_actions"
]);

export const UI_PATTERN_KINDS = new Set([
  "resource_table",
  "data_grid_view",
  "resource_cards",
  "detail_panel",
  "edit_form",
  "lookup_select",
  "action_bar",
  "status_badge",
  "summary_stats",
  "activity_feed",
  "comment_thread",
  "timeline_view",
  "board_view",
  "calendar_view",
  "settings_section",
  "wizard_stepper",
  "audit_log",
  "search_results",
  "empty_state_panel",
  "inspector_pane",
  "master_detail"
]);

export const UI_ACTION_PRESENTATIONS = new Set([
  "button",
  "menu_item",
  "split_button",
  "bulk_action",
  "modal",
  "drawer",
  "inline_confirm",
  "sheet",
  "bottom_sheet",
  "fab",
  "popover"
]);

export const UI_STATE_KINDS = new Set([
  "loading",
  "empty",
  "error",
  "unauthorized",
  "not_found",
  "success"
]);

export const UI_PLATFORM_PATTERNS = new Set([
  "bottom_tabs",
  "stack_navigation",
  "split_view",
  "master_detail",
  "navigation_rail",
  "fab",
  "sheet",
  "bottom_sheet",
  "pull_to_refresh",
  "segmented_control",
  "command_palette",
  "inspector_pane",
  "multi_pane_layout",
  "resizable_split",
  "menu_bar",
  "multi_window"
]);

export const UI_DESIGN_DENSITIES = new Set(["compact", "comfortable", "spacious"]);
export const UI_DESIGN_TONES = new Set(["operational", "neutral", "editorial", "playful"]);
export const UI_DESIGN_RADIUS_SCALES = new Set(["none", "small", "medium", "large"]);
export const UI_DESIGN_COLOR_ROLES = new Set(["primary", "secondary", "surface", "text", "muted", "danger", "success", "warning", "info"]);
export const UI_DESIGN_TYPOGRAPHY_ROLES = new Set(["body", "heading", "label", "mono", "numeric"]);
export const UI_DESIGN_ACTION_ROLES = new Set(["primary", "secondary", "destructive", "contextual", "bulk"]);
export const UI_DESIGN_ACCESSIBILITY_VALUES = {
  contrast: new Set(["aa", "aaa", "high"]),
  motion: new Set(["standard", "reduced"]),
  focus: new Set(["visible", "required"]),
  min_touch_target: new Set(["compact", "comfortable"])
};

export const UI_GENERATOR_RENDERED_COMPONENT_PATTERNS = new Set([
  "summary_stats",
  "board_view",
  "calendar_view",
  "resource_table",
  "data_grid_view"
]);

export const WIDGET_CATEGORIES = new Set([
  "collection",
  "form",
  "display",
  "navigation",
  "dialog",
  "feedback",
  "lookup",
  "layout",
  "service"
]);

export const WIDGET_BEHAVIOR_KINDS = new Set([
  "selection",
  "sorting",
  "filtering",
  "search",
  "pagination",
  "grouping",
  "drag_drop",
  "inline_edit",
  "bulk_action",
  "optimistic_update",
  "realtime_update",
  "keyboard_navigation"
]);

export const WIDGET_BEHAVIOR_DIRECTIVES = {
  selection: new Set(["mode", "state", "emits"]),
  sorting: new Set(["fields", "default"]),
  filtering: new Set(["fields"]),
  search: new Set(["fields"]),
  pagination: new Set(["mode", "page_size"]),
  grouping: new Set(["fields"]),
  drag_drop: new Set(["axis", "reorder"]),
  inline_edit: new Set(["fields", "submit", "emits"]),
  bulk_action: new Set(["actions", "state", "emits"]),
  optimistic_update: new Set(["actions", "rollback"]),
  realtime_update: new Set(["source", "merge"]),
  keyboard_navigation: new Set(["scope", "shortcuts"])
};

export const WIDGET_SELECTION_MODES = new Set(["single", "multi", "none"]);
export const WIDGET_PAGINATION_MODES = new Set(["cursor", "paged", "infinite", "none"]);

/**
 * @param {string[]} presentations
 * @returns {string}
 */
export function collectionPatternFromPresentations(presentations = []) {
  if (presentations.includes("data_grid")) return "data_grid_view";
  if (presentations.includes("table")) return "resource_table";
  if (presentations.includes("cards")) return "resource_cards";
  if (presentations.includes("board")) return "board_view";
  if (presentations.includes("calendar")) return "calendar_view";
  if (presentations.includes("gallery")) return "resource_cards";
  return "search_results";
}

/**
 * @param {string|null|undefined} pattern
 * @returns {string}
 */
export function presentationFromPattern(pattern) {
  if (pattern === "data_grid_view") return "data_grid";
  if (pattern === "resource_table") return "table";
  if (pattern === "resource_cards") return "cards";
  if (pattern === "board_view") return "board";
  if (pattern === "calendar_view") return "calendar";
  return "list";
}

/**
 * @param {{ kind?: string|null }} screen
 * @param {{ operation?: string|null, value?: string|null }[]} collectionEntries
 * @returns {string|null}
 */
export function defaultPatternForScreen(screen, collectionEntries = []) {
  if (screen.kind === "detail") return "detail_panel";
  if (screen.kind === "form") return "edit_form";
  if (screen.kind === "board") return "board_view";
  if (screen.kind === "calendar") return "calendar_view";
  if (screen.kind === "dashboard" || screen.kind === "analytics" || screen.kind === "report") return "summary_stats";
  if (screen.kind === "feed" || screen.kind === "inbox") return "activity_feed";
  const view = collectionEntries.find((entry) => entry.operation === "view")?.value;
  if (view) return collectionPatternFromPresentations([view]);
  if (screen.kind === "list") return "resource_table";
  return null;
}
