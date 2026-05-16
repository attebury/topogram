// @ts-check

export const STATEMENT_KINDS = new Set([
  "term",
  "actor",
  "role",
  "enum",
  "entity",
  "shape",
  "rule",
  "capability",
  "widget",
  "decision",
  "projection",
  "orchestration",
  "verification",
  "operation",
  "domain",
  "journey",
  "pitch",
  "requirement",
  "acceptance_criterion",
  "task",
  "plan",
  "bug"
]);

export const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
export const DOMAIN_IDENTIFIER_PATTERN = /^dom_[a-z][a-z0-9_]*$/;
export const PITCH_IDENTIFIER_PATTERN = /^pitch_[a-z][a-z0-9_]*$/;
export const REQUIREMENT_IDENTIFIER_PATTERN = /^req_[a-z][a-z0-9_]*$/;
export const ACCEPTANCE_CRITERION_IDENTIFIER_PATTERN = /^ac_[a-z][a-z0-9_]*$/;
export const TASK_IDENTIFIER_PATTERN = /^task_[a-z][a-z0-9_]*$/;
export const PLAN_IDENTIFIER_PATTERN = /^plan_[a-z][a-z0-9_]*$/;
export const BUG_IDENTIFIER_PATTERN = /^bug_[a-z][a-z0-9_]*$/;
export const JOURNEY_IDENTIFIER_PATTERN = /^journey_[a-z][a-z0-9_]*$/;
export const DOCUMENT_IDENTIFIER_PATTERN = /^doc_[a-z][a-z0-9_]*$/;

export const GLOBAL_STATUSES = new Set(["draft", "proposed", "active", "deprecated"]);
export const DECISION_STATUSES = new Set(["draft", "proposed", "accepted", "rejected", "deprecated"]);
export const RULE_SEVERITIES = new Set(["error", "warning", "info"]);

// Phase 2 SDLC status sets (per-kind state machines).
export const PITCH_STATUSES = new Set(["draft", "shaped", "submitted", "approved", "covered", "superseded", "rejected"]);
export const REQUIREMENT_STATUSES = new Set(["draft", "in-review", "approved", "satisfied", "ongoing", "superseded"]);
export const ACCEPTANCE_CRITERION_STATUSES = new Set(["draft", "approved", "superseded"]);
export const TASK_STATUSES = new Set(["unclaimed", "claimed", "in-progress", "done", "blocked"]);
export const PLAN_STATUSES = new Set(["draft", "active", "complete", "superseded"]);
export const PLAN_STEP_STATUSES = new Set(["pending", "in-progress", "blocked", "done", "skipped"]);
export const BUG_STATUSES = new Set(["open", "in-progress", "fixed", "verified", "wont-fix"]);
export const JOURNEY_STATUSES = new Set(["draft", "canonical", "active", "deprecated"]);
export const TASK_DISPOSITIONS = new Set(["active", "follow_up", "deferred", "backlog", "blocker"]);

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
  plan: PLAN_STATUSES,
  bug: BUG_STATUSES,
  journey: JOURNEY_STATUSES
};
export const VERIFICATION_METHODS = new Set(["smoke", "runtime", "contract", "journey", "manual"]);
export const CLI_COMMAND_EFFECTS = new Set(["read_only", "writes_workspace", "writes_app", "network", "package_install", "git", "filesystem"]);
export const CLI_COMMAND_OPTION_TYPES = new Set(["string", "boolean", "number", "integer", "enum", "path", "list"]);
export const CLI_COMMAND_OUTPUT_FORMATS = new Set(["json", "human", "file", "exit_code"]);

export {
  UI_APP_SHELL_KINDS,
  UI_WINDOWING_MODES,
  UI_SCREEN_KINDS,
  UI_COLLECTION_PRESENTATIONS,
  UI_NAVIGATION_PATTERNS,
  UI_REGION_KINDS,
  UI_PATTERN_KINDS,
  UI_ACTION_PRESENTATIONS,
  UI_STATE_KINDS,
  UI_PLATFORM_PATTERNS,
  UI_DESIGN_DENSITIES,
  UI_DESIGN_TONES,
  UI_DESIGN_RADIUS_SCALES,
  UI_DESIGN_COLOR_ROLES,
  UI_DESIGN_TYPOGRAPHY_ROLES,
  UI_DESIGN_ACTION_ROLES,
  UI_DESIGN_ACCESSIBILITY_VALUES,
  WIDGET_CATEGORIES,
  WIDGET_BEHAVIOR_KINDS,
  WIDGET_BEHAVIOR_DIRECTIVES,
  WIDGET_SELECTION_MODES,
  WIDGET_PAGINATION_MODES
} from "../ui/taxonomy.js";

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
  "journey",
  "pitch",
  "requirement",
  "task",
  "plan",
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
  widget: {
    required: ["name", "description", "props", "status"],
    allowed: ["name", "description", "category", "props", "events", "slots", "behavior", "behaviors", "patterns", "regions", "lookups", "dependencies", "version", "approvals", "status"]
  },
  decision: {
    required: ["name", "description", "status"],
    allowed: ["name", "description", "context", "consequences", "pitch", "supersedes", "domain", "status"]
  },
  projection: {
    required: ["name", "description", "type", "realizes", "outputs", "status"],
    allowed: [
      "name",
      "description",
      "type",
      "realizes",
      "outputs",
      "endpoints",
      "error_responses",
      "wire_fields",
      "responses",
      "preconditions",
      "idempotency",
      "cache",
      "delete_semantics",
      "async_jobs",
      "async_status",
      "downloads",
      "authorization",
      "callbacks",
      "commands",
      "command_options",
      "command_outputs",
      "command_effects",
      "command_examples",
      "screens",
      "collection_views",
      "screen_actions",
      "visibility_rules",
      "field_lookups",
      "screen_routes",
      "web_hints",
      "ios_hints",
      "app_shell",
      "navigation",
      "screen_regions",
      "widget_bindings",
      "design_tokens",
      "tables",
      "columns",
      "keys",
      "indexes",
      "relations",
      "lifecycle",
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
  journey: {
    required: ["name", "description", "status", "actors", "goal", "step"],
    allowed: [
      "name",
      "description",
      "status",
      "actors",
      "roles",
      "goal",
      "trigger",
      "step",
      "alternate",
      "success_signals",
      "failure_signals",
      "related_capabilities",
      "related_entities",
      "related_rules",
      "related_workflows",
      "related_projections",
      "related_widgets",
      "related_verifications",
      "related_decisions",
      "related_docs",
      "tags",
      "domain",
      "updated"
    ]
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
      "disposition",
      "affects",
      "satisfies",
      "acceptance_refs",
      "verification_refs",
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
  plan: {
    required: ["name", "description", "task", "status", "steps"],
    allowed: [
      "name",
      "description",
      "task",
      "status",
      "priority",
      "notes",
      "outcome",
      "steps",
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
