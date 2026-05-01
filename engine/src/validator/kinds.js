export const STATEMENT_KINDS = new Set([
  "term",
  "actor",
  "role",
  "enum",
  "entity",
  "shape",
  "rule",
  "capability",
  "component",
  "decision",
  "projection",
  "orchestration",
  "verification",
  "operation"
]);

export const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
export const GLOBAL_STATUSES = new Set(["draft", "proposed", "active", "deprecated"]);
export const DECISION_STATUSES = new Set(["draft", "proposed", "accepted", "rejected", "deprecated"]);
export const RULE_SEVERITIES = new Set(["error", "warning", "info"]);
export const VERIFICATION_METHODS = new Set(["smoke", "runtime", "contract", "journey", "manual"]);
export const UI_SCREEN_KINDS = new Set(["list", "detail", "form", "dashboard", "job_status", "board", "calendar", "feed", "inbox", "settings", "wizard", "report", "analytics"]);
export const UI_COLLECTION_PRESENTATIONS = new Set(["table", "data_grid", "cards", "list", "board", "calendar", "gallery"]);
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

export const FIELD_SPECS = {
  term: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "aliases", "excludes", "status"]
  },
  actor: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "status"]
  },
  role: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "status"]
  },
  enum: {
    required: ["values"],
    allowed: ["values"]
  },
  entity: {
    required: ["name", "description", "fields", "status"],
    allowed: ["name", "description", "fields", "keys", "relations", "invariants", "uses_terms", "status"]
  },
  shape: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "include", "exclude", "rename", "overrides", "fields", "derived_from", "status"]
  },
  rule: {
    required: ["name", "description", "applies_to", "status"],
    allowed: ["name", "description", "applies_to", "actors", "roles", "condition", "requirement", "severity", "source_of_truth", "status"]
  },
  capability: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "actors", "roles", "reads", "creates", "updates", "deletes", "input", "output", "status"]
  },
  component: {
    required: ["name", "description", "props", "status"],
    allowed: ["name", "description", "category", "props", "events", "slots", "behavior", "patterns", "regions", "lookups", "dependencies", "consumers", "version", "approvals", "status"]
  },
  decision: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "context", "consequences", "status"]
  },
  projection: {
    required: ["name", "description", "platform", "realizes", "outputs", "status"],
    allowed: [
      "name",
      "description",
      "platform",
      "realizes",
      "outputs",
      "http",
      "http_errors",
      "http_fields",
      "http_responses",
      "http_preconditions",
      "http_idempotency",
      "http_cache",
      "http_delete",
      "http_async",
      "http_status",
      "http_download",
      "http_authz",
      "http_callbacks",
      "ui_screens",
      "ui_collections",
      "ui_actions",
      "ui_visibility",
      "ui_lookups",
      "ui_routes",
      "ui_web",
      "ui_ios",
      "ui_app_shell",
      "ui_navigation",
      "ui_screen_regions",
      "db_tables",
      "db_columns",
      "db_keys",
      "db_indexes",
      "db_relations",
      "db_lifecycle",
      "generator_defaults",
      "status"
    ]
  },
  orchestration: {
    required: ["name", "description", "inputs", "steps", "outputs", "status"],
    allowed: ["name", "description", "inputs", "steps", "outputs", "status"]
  },
  verification: {
    required: ["name", "description", "validates", "method", "scenarios", "status"],
    allowed: ["name", "description", "validates", "method", "scenarios", "status"]
  },
  operation: {
    required: ["name", "description", "observes", "metrics", "alerts", "status"],
    allowed: ["name", "description", "observes", "metrics", "alerts", "status"]
  }
};
