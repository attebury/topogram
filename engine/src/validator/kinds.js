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
  "operation",
  "domain",
  "pitch",
  "requirement",
  "acceptance_criterion",
  "task",
  "bug"
]);

export const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
export const DOMAIN_IDENTIFIER_PATTERN = /^dom_[a-z][a-z0-9_]*$/;
export const PITCH_IDENTIFIER_PATTERN = /^pitch_[a-z][a-z0-9_]*$/;
export const REQUIREMENT_IDENTIFIER_PATTERN = /^req_[a-z][a-z0-9_]*$/;
export const ACCEPTANCE_CRITERION_IDENTIFIER_PATTERN = /^ac_[a-z][a-z0-9_]*$/;
export const TASK_IDENTIFIER_PATTERN = /^task_[a-z][a-z0-9_]*$/;
export const BUG_IDENTIFIER_PATTERN = /^bug_[a-z][a-z0-9_]*$/;
export const DOCUMENT_IDENTIFIER_PATTERN = /^doc_[a-z][a-z0-9_]*$/;

export const GLOBAL_STATUSES = new Set(["draft", "proposed", "active", "deprecated"]);
export const DECISION_STATUSES = new Set(["draft", "proposed", "accepted", "rejected", "deprecated"]);
export const RULE_SEVERITIES = new Set(["error", "warning", "info"]);

// Phase 2 SDLC status sets (per-kind state machines).
export const PITCH_STATUSES = new Set(["draft", "shaped", "submitted", "approved", "rejected"]);
export const REQUIREMENT_STATUSES = new Set(["draft", "in-review", "approved", "superseded"]);
export const ACCEPTANCE_CRITERION_STATUSES = new Set(["draft", "approved", "superseded"]);
export const TASK_STATUSES = new Set(["unclaimed", "claimed", "in-progress", "done", "blocked"]);
export const BUG_STATUSES = new Set(["open", "in-progress", "fixed", "verified", "wont-fix"]);

export const PRIORITY_VALUES = new Set(["critical", "high", "medium", "low"]);
export const WORK_TYPES = new Set([
  "implementation",
  "review",
  "testing",
  "integration",
  "design",
  "documentation",
  "bugfix"
]);
export const BUG_SEVERITIES = new Set(["critical", "high", "medium", "low"]);
export const DOC_TYPES = new Set([
  "user-guide",
  "api",
  "architecture",
  "operations",
  "getting-started",
  "reference",
  "development"
]);
export const AUDIENCES = new Set(["developers", "operators", "end-users", "all"]);

// Per-kind status table — used by `validateStatus` to dispatch the
// allowed status set without long if/else chains.
export const STATUS_SETS_BY_KIND = {
  decision: DECISION_STATUSES,
  pitch: PITCH_STATUSES,
  requirement: REQUIREMENT_STATUSES,
  acceptance_criterion: ACCEPTANCE_CRITERION_STATUSES,
  task: TASK_STATUSES,
  bug: BUG_STATUSES
};
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

// Kinds that may carry an optional singular `domain dom_x` field. Keep this
// set in sync with the `allowed[]` arrays in FIELD_SPECS below; the cross-kind
// validator in `validator/index.js` consults this set when checking the
// reference target. Phase 2 added the SDLC kinds (pitch, requirement, task,
// bug) to this set; acceptance_criterion stays domainless and inherits via
// its requirement.
export const DOMAIN_TAGGABLE_KINDS = new Set([
  "capability",
  "entity",
  "rule",
  "verification",
  "orchestration",
  "operation",
  "decision",
  "pitch",
  "requirement",
  "task",
  "bug"
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
    allowed: ["name", "description", "fields", "keys", "relations", "invariants", "uses_terms", "domain", "status"]
  },
  shape: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "include", "exclude", "rename", "overrides", "fields", "derived_from", "status"]
  },
  rule: {
    required: ["name", "description", "applies_to", "status"],
    allowed: ["name", "description", "applies_to", "actors", "roles", "condition", "requirement", "from_requirement", "severity", "source_of_truth", "domain", "status"]
  },
  capability: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "actors", "roles", "reads", "creates", "updates", "deletes", "input", "output", "domain", "status"]
  },
  component: {
    required: ["name", "description", "props", "status"],
    allowed: ["name", "description", "category", "props", "events", "slots", "behavior", "behaviors", "patterns", "regions", "lookups", "dependencies", "version", "approvals", "status"]
  },
  decision: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "context", "consequences", "pitch", "supersedes", "domain", "status"]
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
      "ui_components",
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
    allowed: ["name", "description", "inputs", "steps", "outputs", "domain", "status"]
  },
  verification: {
    required: ["name", "description", "validates", "method", "scenarios", "status"],
    allowed: [
      "name",
      "description",
      "validates",
      "method",
      "scenarios",
      "requirement_refs",
      "acceptance_refs",
      "fixes_bugs",
      "domain",
      "status"
    ]
  },
  operation: {
    required: ["name", "description", "observes", "metrics", "alerts", "status"],
    allowed: ["name", "description", "observes", "metrics", "alerts", "domain", "status"]
  },
  domain: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "in_scope", "out_of_scope", "owners", "parent_domain", "aliases", "status"]
  },
  pitch: {
    required: ["name", "description", "status", "priority"],
    allowed: [
      "name",
      "description",
      "status",
      "priority",
      "appetite",
      "problem",
      "solution_sketch",
      "rabbit_holes",
      "no_go_areas",
      "affects",
      "decisions",
      "domain",
      "updated",
      "approvals"
    ]
  },
  requirement: {
    required: ["name", "description", "status", "priority"],
    allowed: [
      "name",
      "description",
      "status",
      "priority",
      "pitch",
      "affects",
      "introduces_rules",
      "respects_rules",
      "supersedes",
      "domain",
      "updated",
      "approvals"
    ]
  },
  acceptance_criterion: {
    required: ["name", "description", "status", "requirement"],
    allowed: ["name", "description", "status", "requirement", "supersedes", "updated"]
  },
  task: {
    required: ["name", "description", "status", "priority", "work_type"],
    allowed: [
      "name",
      "description",
      "status",
      "priority",
      "work_type",
      "affects",
      "satisfies",
      "acceptance_refs",
      "blocks",
      "blocked_by",
      "claimed_by",
      "introduces_decisions",
      "modifies",
      "introduces",
      "removes",
      "domain",
      "updated"
    ]
  },
  bug: {
    required: ["name", "description", "status", "severity", "priority"],
    allowed: [
      "name",
      "description",
      "status",
      "severity",
      "priority",
      "affects",
      "violates",
      "surfaces_rule",
      "introduced_in",
      "fixed_in",
      "fixed_in_release",
      "fixed_in_verification",
      "reproduction",
      "modifies",
      "introduces",
      "removes",
      "domain",
      "updated"
    ]
  }
};
