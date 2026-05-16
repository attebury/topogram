// @ts-check

import {
  FIELD_SPECS,
  GLOBAL_STATUSES,
  RULE_SEVERITIES,
  STATEMENT_KINDS,
  STATUS_SETS_BY_KIND,
  VERIFICATION_METHODS
} from "./kinds.js";
import {
  pushError,
  symbolValue,
  valueAsArray
} from "./utils.js";

/**
 * @param {string} oldName
 * @param {string} newName
 * @param {string} example
 * @returns {string}
 */
function renameDiagnostic(oldName, newName, example) {
  return `${oldName} was renamed to ${newName}. Example fix: ${example}`;
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {string} key
 * @param {string[]} expectedTypes
 * @returns {void}
 */
function ensureSingleValueField(errors, statement, fieldMap, key, expectedTypes) {
  const fields = fieldMap.get(key) || [];
  if (fields.length > 1) {
    for (const field of fields.slice(1)) {
      pushError(errors, `Duplicate field '${key}' on ${statement.kind} ${statement.id}`, field.loc);
    }
  }

  const field = fields[0];
  if (!field) {
    return;
  }

  if (!expectedTypes.includes(field.value.type)) {
    pushError(
      errors,
      `Field '${key}' on ${statement.kind} ${statement.id} must be ${expectedTypes.join(" or ")}, found ${field.value.type}`,
      field.loc
    );
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateFieldPresence(errors, statement, fieldMap) {
  const spec = FIELD_SPECS[statement.kind];
  if (!spec) {
    return;
  }

  /** @type {Map<string, [string, string]>} */
  const renamedFields = new Map([
    ["platform", ["type", "type web_surface"]],
    ["ui_components", ["widget_bindings", "widget_bindings { screen item_list region results widget widget_data_grid }"]],
    ["ui_design", ["design_tokens", "design_tokens { density comfortable tone operational }"]],
    ["ui_routes", ["screen_routes", "screen_routes { screen item_list path /items }"]],
    ["ui_screens", ["screens", "screens { item_list list title \"Items\" }"]],
    ["ui_screen_regions", ["screen_regions", "screen_regions { screen item_list region results pattern resource_table }"]],
    ["ui_navigation", ["navigation", "navigation { primary item_list label \"Items\" }"]],
    ["ui_app_shell", ["app_shell", "app_shell { shell sidebar }"]],
    ["ui_collections", ["collection_views", "collection_views { item_list presentation table }"]],
    ["ui_actions", ["screen_actions", "screen_actions { screen item_list action create target cap_create_item }"]],
    ["ui_visibility", ["visibility_rules", "visibility_rules { screen item_list when cap_list_items }"]],
    ["ui_lookups", ["field_lookups", "field_lookups { field owner_id source cap_list_users }"]],
    ["web_surface", ["web_hints", "web_hints { router file_based }"]],
    ["ios_surface", ["ios_hints", "ios_hints { navigation stack }"]],
    ["http", ["endpoints", "endpoints { cap_list_items method GET path /items success 200 }"]],
    ["http_errors", ["error_responses", "error_responses { cap_list_items 404 shape_error }"]],
    ["http_fields", ["wire_fields", "wire_fields { shape_item title title }"]],
    ["http_responses", ["responses", "responses { cap_list_items 200 shape_item_list }"]],
    ["http_preconditions", ["preconditions", "preconditions { cap_update_item rule_item_exists }"]],
    ["http_idempotency", ["idempotency", "idempotency { cap_create_item key request_id }"]],
    ["http_cache", ["cache", "cache { cap_list_items max_age 60 }"]],
    ["http_delete", ["delete_semantics", "delete_semantics { cap_delete_item mode soft_delete }"]],
    ["http_async", ["async_jobs", "async_jobs { cap_export_items job task_export }"]],
    ["http_status", ["async_status", "async_status { cap_export_items path /exports/{job_id} }"]],
    ["http_download", ["downloads", "downloads { cap_download_export content_type text/csv }"]],
    ["http_authz", ["authorization", "authorization { cap_update_item role editor }"]],
    ["http_callbacks", ["callbacks", "callbacks { cap_export_items event completed }"]],
    ["db_tables", ["tables", "tables { entity_item table items }"]],
    ["db_columns", ["columns", "columns { entity_item field title column title }"]],
    ["db_keys", ["keys", "keys { entity_item primary [id] }"]],
    ["db_indexes", ["indexes", "indexes { entity_item index [title] }"]],
    ["db_relations", ["relations", "relations { entity_item foreign_key owner_id references entity_user.id }"]],
    ["db_lifecycle", ["lifecycle", "lifecycle { entity_item timestamps created_at created_at updated_at updated_at }"]]
  ]);

  for (const key of fieldMap.keys()) {
    const field = fieldMap.get(key)?.[0];
    const renamedField = renamedFields.get(key);
    if (renamedField) {
      const [newName, example] = renamedField;
      pushError(errors, `Field '${key}' on ${statement.kind} ${statement.id} ${renameDiagnostic(`'${key}'`, `'${newName}'`, example)}`, field?.loc);
      continue;
    }
    if (!spec.allowed.includes(key)) {
      pushError(errors, `Field '${key}' is not allowed on ${statement.kind} ${statement.id}`, field?.loc);
    }
  }

  for (const key of spec.required) {
    if (!fieldMap.has(key)) {
      pushError(errors, `Missing required field '${key}' on ${statement.kind} ${statement.id}`, statement.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateProjectionTypeRenames(errors, statement, fieldMap) {
  if (statement.kind !== "projection") {
    return;
  }

  const typeField = fieldMap.get("type")?.[0];
  const typeValue = symbolValue(typeField?.value);
  const renamedTypes = new Map([
    ["ui_shared", "ui_contract"],
    ["ui_web", "web_surface"],
    ["ui_ios", "ios_surface"],
    ["ui_android", "android_surface"],
    ["dotnet", "api_contract"],
    ["api", "api_contract"],
    ["backend", "api_contract"],
    ["db_postgres", "db_contract"],
    ["db_sqlite", "db_contract"]
  ]);
  if (!typeField || !typeValue || !renamedTypes.has(typeValue)) {
    return;
  }

  const nextType = renamedTypes.get(typeValue);
  if (!nextType) {
    return;
  }
  pushError(
    errors,
    `Projection ${statement.id} ${renameDiagnostic(`type value '${typeValue}'`, `'${nextType}'`, `type ${nextType}`)}`,
    typeField.value.loc
  );
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {string} key
 * @param {number} minimumWidth
 * @returns {void}
 */
function validateBlockEntryLengths(errors, statement, fieldMap, key, minimumWidth) {
  const field = fieldMap.get(key)?.[0];
  if (!field || field.value.type !== "block") {
    return;
  }

  for (const entry of field.value.entries) {
    if (entry.items.length < minimumWidth) {
      pushError(errors, `Each '${key}' entry on ${statement.kind} ${statement.id} must have at least ${minimumWidth} token(s)`, entry.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateFieldShapes(errors, statement, fieldMap) {
  ensureSingleValueField(errors, statement, fieldMap, "name", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "description", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "status", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "type", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "method", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "severity", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "category", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "priority", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "work_type", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "disposition", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "task", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "version", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "updated", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "notes", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "outcome", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "goal", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "trigger", ["string"]);

  const listFields = [
    "aliases",
    "excludes",
    "uses_terms",
    "related_terms",
    "include",
    "exclude",
    "derived_from",
    "applies_to",
    "actors",
    "roles",
    "reads",
    "creates",
    "updates",
    "deletes",
    "input",
    "output",
    "context",
    "consequences",
    "realizes",
    "outputs",
    "inputs",
    "validates",
    "scenarios",
    "observes",
    "metrics",
    "alerts",
    "source_of_truth",
    "behavior",
    "patterns",
    "regions",
    "lookups",
    "dependencies",
    "approvals",
    "success_signals",
    "failure_signals",
    "tags",
    "related_capabilities",
    "related_entities",
    "related_rules",
    "related_workflows",
    "related_projections",
    "related_widgets",
    "related_verifications",
    "related_decisions",
    "related_docs"
  ];
  if (statement.kind === "orchestration") {
    listFields.push("steps");
  }
  for (const key of listFields) {
    ensureSingleValueField(errors, statement, fieldMap, key, ["list"]);
  }

  const blockFields = ["fields", "props", "events", "slots", "behaviors", "keys", "relations", "invariants", "rename", "overrides", "endpoints", "error_responses", "wire_fields", "responses", "preconditions", "idempotency", "cache", "delete_semantics", "async_jobs", "async_status", "downloads", "authorization", "callbacks", "commands", "command_options", "command_outputs", "command_effects", "command_examples", "screens", "collection_views", "screen_actions", "visibility_rules", "field_lookups", "screen_routes", "web_hints", "ios_hints", "app_shell", "navigation", "screen_regions", "widget_bindings", "design_tokens", "tables", "columns", "keys", "indexes", "relations", "lifecycle", "generator_defaults"];
  if (statement.kind === "plan") {
    blockFields.push("steps");
  }
  if (statement.kind === "journey") {
    for (const key of ["step", "alternate"]) {
      const fields = fieldMap.get(key) || [];
      for (const field of fields) {
        if (field.value.type !== "block") {
          pushError(errors, `Field '${key}' on ${statement.kind} ${statement.id} must be block, found ${field.value.type}`, field.loc);
        }
      }
    }
  }
  for (const key of blockFields) {
    ensureSingleValueField(errors, statement, fieldMap, key, ["block"]);
  }

  validateBlockEntryLengths(errors, statement, fieldMap, "fields", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "props", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "events", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "slots", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "invariants", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "generator_defaults", 2);

  if (statement.kind === "entity") {
    validateBlockEntryLengths(errors, statement, fieldMap, "keys", 2);
    validateBlockEntryLengths(errors, statement, fieldMap, "relations", 3);
  }

  if (statement.kind === "projection") {
    validateBlockEntryLengths(errors, statement, fieldMap, "endpoints", 7);
    validateBlockEntryLengths(errors, statement, fieldMap, "error_responses", 3);
    validateBlockEntryLengths(errors, statement, fieldMap, "wire_fields", 5);
    validateBlockEntryLengths(errors, statement, fieldMap, "responses", 3);
    validateBlockEntryLengths(errors, statement, fieldMap, "preconditions", 9);
    validateBlockEntryLengths(errors, statement, fieldMap, "idempotency", 7);
    validateBlockEntryLengths(errors, statement, fieldMap, "cache", 11);
    validateBlockEntryLengths(errors, statement, fieldMap, "delete_semantics", 7);
    validateBlockEntryLengths(errors, statement, fieldMap, "async_jobs", 11);
    validateBlockEntryLengths(errors, statement, fieldMap, "async_status", 11);
    validateBlockEntryLengths(errors, statement, fieldMap, "downloads", 7);
    validateBlockEntryLengths(errors, statement, fieldMap, "authorization", 3);
    validateBlockEntryLengths(errors, statement, fieldMap, "callbacks", 11);
    validateBlockEntryLengths(errors, statement, fieldMap, "commands", 2);
    validateBlockEntryLengths(errors, statement, fieldMap, "command_options", 6);
    validateBlockEntryLengths(errors, statement, fieldMap, "command_outputs", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "command_effects", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "command_examples", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "screens", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "collection_views", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "screen_actions", 6);
    validateBlockEntryLengths(errors, statement, fieldMap, "visibility_rules", 5);
    validateBlockEntryLengths(errors, statement, fieldMap, "field_lookups", 8);
    validateBlockEntryLengths(errors, statement, fieldMap, "screen_routes", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "web_hints", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "ios_hints", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "app_shell", 2);
    validateBlockEntryLengths(errors, statement, fieldMap, "navigation", 2);
    validateBlockEntryLengths(errors, statement, fieldMap, "screen_regions", 4);
    validateBlockEntryLengths(errors, statement, fieldMap, "tables", 3);
    validateBlockEntryLengths(errors, statement, fieldMap, "columns", 5);
    validateBlockEntryLengths(errors, statement, fieldMap, "keys", 3);
    validateBlockEntryLengths(errors, statement, fieldMap, "indexes", 3);
    validateBlockEntryLengths(errors, statement, fieldMap, "relations", 6);
    validateBlockEntryLengths(errors, statement, fieldMap, "lifecycle", 3);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateStatus(errors, statement, fieldMap) {
  const field = fieldMap.get("status")?.[0];
  if (!field || field.value.type !== "symbol") {
    return;
  }

  if (statement.kind === "rule" && field.value.value === "active") {
    pushError(
      errors,
      `Rule ${statement.id} ${renameDiagnostic("status value 'active'", "'enforced'", "status enforced")}`,
      field.loc
    );
    return;
  }

  // Per-kind status table takes precedence (rule, decision, and SDLC kinds), with
  // GLOBAL_STATUSES as the default.
  const allowed = STATUS_SETS_BY_KIND[statement.kind] || GLOBAL_STATUSES;
  if (!allowed.has(field.value.value)) {
    pushError(errors, `Invalid status '${field.value.value}' on ${statement.kind} ${statement.id}`, field.loc);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateRuleSeverity(errors, statement, fieldMap) {
  if (statement.kind !== "rule") {
    return;
  }

  const field = fieldMap.get("severity")?.[0];
  if (!field) {
    return;
  }

  if (field.value.type === "symbol" && !RULE_SEVERITIES.has(field.value.value)) {
    pushError(errors, `Invalid severity '${field.value.value}' on rule ${statement.id}`, field.loc);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateVerification(errors, statement, fieldMap) {
  if (statement.kind !== "verification") {
    return;
  }

  const methodField = fieldMap.get("method")?.[0];
  if (methodField?.value.type === "symbol" && !VERIFICATION_METHODS.has(methodField.value.value)) {
    pushError(
      errors,
      `Invalid verification method '${methodField.value.value}' on verification ${statement.id}`,
      methodField.loc
    );
  }

  const scenariosField = fieldMap.get("scenarios")?.[0];
  if (!scenariosField || scenariosField.value.type !== "list") {
    return;
  }

  if (scenariosField.value.items.length === 0) {
    pushError(errors, `Verification ${statement.id} must include at least one scenario`, scenariosField.loc);
    return;
  }

  for (const item of scenariosField.value.items) {
    if (item.type !== "symbol" && item.type !== "string") {
      pushError(errors, `Verification ${statement.id} scenarios must use symbols or strings`, item.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateReferenceKinds(errors, statement, fieldMap, registry) {
  // Phase 2: SDLC kinds add several reference fields. The `affects` field is
  // polymorphic — pitches/requirements/tasks/bugs all use it, so we keep the
  // target set wide. `pitch` is single-id but lives in the same map for
  // uniform validation.
  const expectedByField = {
    uses_terms: ["term"],
    related_terms: ["term"],
    derived_from: ["entity"],
    applies_to: ["capability"],
    source_of_truth: ["decision"],
    actors: ["actor"],
    roles: ["role"],
    reads: ["entity"],
    creates: ["entity"],
    updates: ["entity"],
    deletes: ["entity"],
    input: ["shape"],
    output: ["shape"],
    dependencies: [...STATEMENT_KINDS],
    realizes: ["capability", "projection", "entity"],
    validates: [...STATEMENT_KINDS],
    observes: [...STATEMENT_KINDS],
    inputs: [...STATEMENT_KINDS],
    outputs: null,
    steps: null,
    scenarios: null,
    metrics: null,
    alerts: null,
    aliases: null,
    excludes: null,
    include: null,
    exclude: null,
    context: null,
    consequences: null,
    pitch: ["pitch"],
    requirement: null,
    from_requirement: ["requirement"],
    affects: ["capability", "entity", "rule", "projection", "widget", "orchestration", "operation"],
    related_capabilities: ["capability"],
    related_entities: ["entity"],
    related_rules: ["rule"],
    related_workflows: null,
    related_projections: ["projection"],
    related_widgets: ["widget"],
    related_verifications: ["verification"],
    related_decisions: ["decision"],
    related_docs: null,
    introduces_rules: ["rule"],
    respects_rules: ["rule"],
    decisions: ["decision"],
    introduces_decisions: ["decision"],
    satisfies: ["requirement", "acceptance_criterion"],
    acceptance_refs: ["acceptance_criterion"],
    verification_refs: ["verification"],
    requirement_refs: ["requirement"],
    fixes_bugs: ["bug"],
    blocks: ["task"],
    blocked_by: ["task"],
    claimed_by: ["actor", "role"],
    task: ["task"],
    violates: ["rule"],
    surfaces_rule: ["rule"],
    introduced_in: ["task", "bug"],
    fixed_in: ["task"],
    fixed_in_verification: ["verification"],
    supersedes: null,
    modifies: [...STATEMENT_KINDS],
    introduces: [...STATEMENT_KINDS],
    removes: [...STATEMENT_KINDS]
  };

  for (const [key, allowedKinds] of Object.entries(expectedByField)) {
    const field = fieldMap.get(key)?.[0];
    if (!field || !allowedKinds) {
      continue;
    }

    for (const item of valueAsArray(field.value)) {
      if (item.type !== "symbol") {
        pushError(errors, `Field '${key}' on ${statement.kind} ${statement.id} must only contain symbols`, item.loc);
        continue;
      }

      const target = registry.get(item.value);
      if (!target) {
        pushError(errors, `Missing reference '${item.value}' in field '${key}' on ${statement.kind} ${statement.id}`, item.loc);
        continue;
      }

      if (!allowedKinds.includes(target.kind)) {
        pushError(
          errors,
          `Field '${key}' on ${statement.kind} ${statement.id} must reference ${allowedKinds.join(" or ")}, found ${target.kind} '${target.id}'`,
          item.loc
        );
      }
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
export function validateCoreStatement(errors, statement, fieldMap) {
  validateFieldPresence(errors, statement, fieldMap);
  validateProjectionTypeRenames(errors, statement, fieldMap);
  validateFieldShapes(errors, statement, fieldMap);
  validateStatus(errors, statement, fieldMap);
  validateRuleSeverity(errors, statement, fieldMap);
  validateVerification(errors, statement, fieldMap);
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateReferenceRules(errors, statement, fieldMap, registry) {
  validateReferenceKinds(errors, statement, fieldMap, registry);
}
