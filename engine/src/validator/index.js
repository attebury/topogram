import {
  DOC_ARRAY_FIELDS,
  DOC_CONFIDENCE,
  DOC_KINDS,
  DOC_REFERENCE_FIELDS,
  DOC_STATUSES
} from "../workspace-docs.js";

import {
  STATEMENT_KINDS,
  IDENTIFIER_PATTERN,
  DOMAIN_IDENTIFIER_PATTERN,
  DOMAIN_TAGGABLE_KINDS,
  PITCH_IDENTIFIER_PATTERN,
  REQUIREMENT_IDENTIFIER_PATTERN,
  ACCEPTANCE_CRITERION_IDENTIFIER_PATTERN,
  TASK_IDENTIFIER_PATTERN,
  BUG_IDENTIFIER_PATTERN,
  DOCUMENT_IDENTIFIER_PATTERN,
  GLOBAL_STATUSES,
  DECISION_STATUSES,
  RULE_SEVERITIES,
  VERIFICATION_METHODS,
  STATUS_SETS_BY_KIND,
  PITCH_STATUSES,
  REQUIREMENT_STATUSES,
  ACCEPTANCE_CRITERION_STATUSES,
  TASK_STATUSES,
  BUG_STATUSES,
  PRIORITY_VALUES,
  WORK_TYPES,
  BUG_SEVERITIES,
  DOC_TYPES,
  AUDIENCES,
  UI_SCREEN_KINDS,
  UI_COLLECTION_PRESENTATIONS,
  UI_NAVIGATION_PATTERNS,
  UI_REGION_KINDS,
  UI_PATTERN_KINDS,
  UI_APP_SHELL_KINDS,
  UI_WINDOWING_MODES,
  UI_STATE_KINDS,
  UI_DESIGN_DENSITIES,
  UI_DESIGN_TONES,
  UI_DESIGN_RADIUS_SCALES,
  UI_DESIGN_COLOR_ROLES,
  UI_DESIGN_TYPOGRAPHY_ROLES,
  UI_DESIGN_ACTION_ROLES,
  UI_DESIGN_ACCESSIBILITY_VALUES,
  FIELD_SPECS
} from "./kinds.js";
import { validateComponent } from "./per-kind/component.js";
import { validateDomain, validateDomainTag } from "./per-kind/domain.js";
import { validatePitch } from "./per-kind/pitch.js";
import { validateRequirement } from "./per-kind/requirement.js";
import { validateAcceptanceCriterion } from "./per-kind/acceptance-criterion.js";
import { validateTask } from "./per-kind/task.js";
import { validateBug } from "./per-kind/bug.js";

export {
  STATEMENT_KINDS,
  IDENTIFIER_PATTERN,
  DOMAIN_IDENTIFIER_PATTERN,
  DOMAIN_TAGGABLE_KINDS,
  PITCH_IDENTIFIER_PATTERN,
  REQUIREMENT_IDENTIFIER_PATTERN,
  ACCEPTANCE_CRITERION_IDENTIFIER_PATTERN,
  TASK_IDENTIFIER_PATTERN,
  BUG_IDENTIFIER_PATTERN,
  DOCUMENT_IDENTIFIER_PATTERN,
  GLOBAL_STATUSES,
  DECISION_STATUSES,
  RULE_SEVERITIES,
  VERIFICATION_METHODS,
  STATUS_SETS_BY_KIND,
  PITCH_STATUSES,
  REQUIREMENT_STATUSES,
  ACCEPTANCE_CRITERION_STATUSES,
  TASK_STATUSES,
  BUG_STATUSES,
  PRIORITY_VALUES,
  WORK_TYPES,
  BUG_SEVERITIES,
  DOC_TYPES,
  AUDIENCES,
  UI_SCREEN_KINDS,
  UI_COLLECTION_PRESENTATIONS,
  UI_NAVIGATION_PATTERNS,
  UI_REGION_KINDS,
  UI_PATTERN_KINDS,
  UI_APP_SHELL_KINDS,
  UI_WINDOWING_MODES,
  UI_STATE_KINDS,
  UI_DESIGN_DENSITIES,
  UI_DESIGN_TONES,
  UI_DESIGN_RADIUS_SCALES,
  UI_DESIGN_COLOR_ROLES,
  UI_DESIGN_TYPOGRAPHY_ROLES,
  UI_DESIGN_ACTION_ROLES,
  UI_DESIGN_ACCESSIBILITY_VALUES,
  FIELD_SPECS
} from "./kinds.js";

export function pushError(errors, message, loc) {
  errors.push({
    message,
    loc
  });
}

export function formatLoc(loc) {
  const line = loc?.start?.line ?? 1;
  const column = loc?.start?.column ?? 1;
  const file = loc?.file ?? "<unknown>";
  return `${file}:${line}:${column}`;
}

export function valueAsArray(value) {
  if (!value) {
    return [];
  }
  if (value.type === "list") {
    return value.items;
  }
  if (value.type === "sequence") {
    return value.items;
  }
  return [value];
}

export function symbolValues(value) {
  return valueAsArray(value).filter((item) => item.type === "symbol").map((item) => item.value);
}

export function collectFieldMap(statement) {
  const map = new Map();
  for (const field of statement.fields) {
    if (!map.has(field.key)) {
      map.set(field.key, []);
    }
    map.get(field.key).push(field);
  }
  return map;
}

export function getField(statement, key) {
  return collectFieldMap(statement).get(key)?.[0] || null;
}

export function getFieldValue(statement, key) {
  return getField(statement, key)?.value || null;
}

export function stringValue(value) {
  return value?.type === "string" ? value.value : null;
}

export function symbolValue(value) {
  return value?.type === "symbol" ? value.value : null;
}

export function blockEntries(value) {
  return value?.type === "block" ? value.entries : [];
}

function blockSymbolItems(entry) {
  return entry.items.filter((item) => item.type === "symbol" || item.type === "string");
}

function statementFieldNames(statement) {
  return blockEntries(getFieldValue(statement, "fields"))
    .map((entry) => entry.items[0])
    .filter((item) => item?.type === "symbol")
    .map((item) => item.value);
}

function resolveShapeBaseFieldNames(statement, registry) {
  const explicitFieldNames = statementFieldNames(statement);
  if (explicitFieldNames.length > 0) {
    return explicitFieldNames;
  }

  if (!statement.from) {
    return [];
  }

  const source = registry.get(statement.from.value);
  if (!source || source.kind !== "entity") {
    return [];
  }

  const sourceFieldNames = statementFieldNames(source);
  const includeNames = symbolValues(getFieldValue(statement, "include"));
  const excludeNames = new Set(symbolValues(getFieldValue(statement, "exclude")));
  const selectedNames = includeNames.length > 0 ? includeNames.filter((name) => sourceFieldNames.includes(name)) : sourceFieldNames;

  return selectedNames.filter((fieldName) => !excludeNames.has(fieldName));
}

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

function validateFieldPresence(errors, statement, fieldMap) {
  const spec = FIELD_SPECS[statement.kind];
  if (!spec) {
    return;
  }

  for (const key of fieldMap.keys()) {
    if (!spec.allowed.includes(key)) {
      pushError(errors, `Field '${key}' is not allowed on ${statement.kind} ${statement.id}`, fieldMap.get(key)[0].loc);
    }
  }

  for (const key of spec.required) {
    if (!fieldMap.has(key)) {
      pushError(errors, `Missing required field '${key}' on ${statement.kind} ${statement.id}`, statement.loc);
    }
  }
}

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

function validateFieldShapes(errors, statement, fieldMap) {
  ensureSingleValueField(errors, statement, fieldMap, "name", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "description", ["string"]);
  ensureSingleValueField(errors, statement, fieldMap, "status", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "platform", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "method", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "severity", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "category", ["symbol"]);
  ensureSingleValueField(errors, statement, fieldMap, "version", ["string"]);

  for (const key of [
    "aliases",
    "excludes",
    "uses_terms",
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
    "steps",
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
    "approvals"
  ]) {
    ensureSingleValueField(errors, statement, fieldMap, key, ["list"]);
  }

  for (const key of ["fields", "props", "events", "slots", "behaviors", "keys", "relations", "invariants", "rename", "overrides", "http", "http_errors", "http_fields", "http_responses", "http_preconditions", "http_idempotency", "http_cache", "http_delete", "http_async", "http_status", "http_download", "http_authz", "http_callbacks", "ui_screens", "ui_collections", "ui_actions", "ui_visibility", "ui_lookups", "ui_routes", "ui_web", "ui_ios", "ui_app_shell", "ui_navigation", "ui_screen_regions", "ui_components", "ui_design", "db_tables", "db_columns", "db_keys", "db_indexes", "db_relations", "db_lifecycle", "generator_defaults"]) {
    ensureSingleValueField(errors, statement, fieldMap, key, ["block"]);
  }

  validateBlockEntryLengths(errors, statement, fieldMap, "fields", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "props", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "events", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "slots", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "keys", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "relations", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "invariants", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "http", 7);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_errors", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_fields", 5);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_responses", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_preconditions", 9);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_idempotency", 7);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_cache", 11);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_delete", 7);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_async", 11);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_status", 11);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_download", 7);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_authz", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "http_callbacks", 11);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_screens", 4);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_collections", 4);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_actions", 6);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_visibility", 5);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_lookups", 8);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_routes", 4);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_web", 4);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_ios", 4);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_app_shell", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_navigation", 2);
  validateBlockEntryLengths(errors, statement, fieldMap, "ui_screen_regions", 4);
  validateBlockEntryLengths(errors, statement, fieldMap, "db_tables", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "db_columns", 5);
  validateBlockEntryLengths(errors, statement, fieldMap, "db_keys", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "db_indexes", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "db_relations", 6);
  validateBlockEntryLengths(errors, statement, fieldMap, "db_lifecycle", 3);
  validateBlockEntryLengths(errors, statement, fieldMap, "generator_defaults", 2);
}

function validateStatus(errors, statement, fieldMap) {
  const field = fieldMap.get("status")?.[0];
  if (!field || field.value.type !== "symbol") {
    return;
  }

  // Per-kind status table takes precedence (decision and SDLC kinds), with
  // GLOBAL_STATUSES as the default.
  const allowed = STATUS_SETS_BY_KIND[statement.kind] || GLOBAL_STATUSES;
  if (!allowed.has(field.value.value)) {
    pushError(errors, `Invalid status '${field.value.value}' on ${statement.kind} ${statement.id}`, field.loc);
  }
}

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

function validateShapeFrom(errors, statement, registry) {
  if (statement.kind !== "shape" || !statement.from) {
    return;
  }

  const target = registry.get(statement.from.value);
  if (!target) {
    pushError(errors, `Shape ${statement.id} derives from missing statement '${statement.from.value}'`, statement.from.loc);
    return;
  }

  if (target.kind !== "entity") {
    pushError(errors, `Shape ${statement.id} can only derive from an entity, found ${target.kind} '${target.id}'`, statement.from.loc);
  }
}

function validateReferenceKinds(errors, statement, fieldMap, registry) {
  // Phase 2: SDLC kinds add several reference fields. The `affects` field is
  // polymorphic — pitches/requirements/tasks/bugs all use it, so we keep the
  // target set wide. `pitch` is single-id but lives in the same map for
  // uniform validation.
  const expectedByField = {
    uses_terms: ["term"],
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
    affects: ["capability", "entity", "rule", "projection", "component", "orchestration", "operation"],
    introduces_rules: ["rule"],
    respects_rules: ["rule"],
    decisions: ["decision"],
    introduces_decisions: ["decision"],
    satisfies: ["requirement", "acceptance_criterion"],
    acceptance_refs: ["acceptance_criterion"],
    requirement_refs: ["requirement"],
    fixes_bugs: ["bug"],
    blocks: ["task"],
    blocked_by: ["task"],
    claimed_by: ["actor", "role"],
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

function validateEntityRelations(errors, statement, fieldMap, registry) {
  if (statement.kind !== "entity") {
    return;
  }

  const field = fieldMap.get("relations")?.[0];
  if (!field || field.value.type !== "block") {
    return;
  }

  for (const entry of field.value.entries) {
    const [left, operator, target] = entry.items;
    if (!left || !operator || !target) {
      continue;
    }

    if (left.type !== "symbol" || operator.type !== "symbol" || target.type !== "symbol") {
      pushError(errors, `Relation entries on entity ${statement.id} must use symbols`, entry.loc);
      continue;
    }

    if (operator.value !== "references") {
      pushError(errors, `Relation entries on entity ${statement.id} must use 'references'`, operator.loc);
    }

    const [entityId] = target.value.split(".");
    const related = registry.get(entityId);
    if (!related) {
      pushError(errors, `Relation on entity ${statement.id} references missing entity '${entityId}'`, target.loc);
      continue;
    }

    if (related.kind !== "entity") {
      pushError(errors, `Relation on entity ${statement.id} must target an entity, found ${related.kind} '${related.id}'`, target.loc);
    }
  }
}

function isIdentifierLike(token) {
  return typeof token === "string" && token.length > 0;
}

function isComparator(token) {
  return ["==", "!=", "<", "<=", ">", ">="].includes(token);
}

function validateInvariantEntry(errors, statement, entry) {
  const tokens = blockSymbolItems(entry).map((item) => item.value);
  if (tokens.length < 2) {
    pushError(errors, `Invariant on ${statement.kind} ${statement.id} is too short`, entry.loc);
    return;
  }

  const [left, op, ...rest] = tokens;
  if (!isIdentifierLike(left)) {
    pushError(errors, `Invariant on ${statement.kind} ${statement.id} must start with a field or expression target`, entry.loc);
    return;
  }

  if (op === "requires") {
    if (rest.length < 3) {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} must be '<field> requires <field> <op> <value>'`, entry.loc);
    } else if (!isComparator(rest[1])) {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} uses an invalid comparator '${rest[1]}'`, entry.loc);
    }
    return;
  }

  if (op === "length") {
    if (rest.length !== 2 || !["<", "<=", ">", ">=", "=="].includes(rest[0])) {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} must be '<field> length <op> <number>'`, entry.loc);
    }
    return;
  }

  if (op === "format") {
    if (rest.length !== 2 || rest[0] !== "==") {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} must be '<field> format == <format>'`, entry.loc);
    }
    return;
  }

  if (isComparator(op)) {
    if (rest.length < 1) {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} is missing a right-hand value`, entry.loc);
      return;
    }

    if (rest[1] === "implies") {
      const [, , impliedField, impliedOperator, impliedValue] = rest;
      if (!impliedField || !impliedOperator || !impliedValue) {
        pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} must fully specify the implied clause`, entry.loc);
      } else if (!(impliedOperator === "is" || isComparator(impliedOperator))) {
        pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} has invalid implied operator '${impliedOperator}'`, entry.loc);
      }
      return;
    }

    return;
  }

  pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} uses unsupported form`, entry.loc);
}

function validateRuleExpressionValue(errors, statement, field, label) {
  if (!field) {
    return;
  }

  const items = valueAsArray(field.value);
  if (items.length !== 1) {
    pushError(errors, `Field '${label}' on rule ${statement.id} must contain a single expression`, field.loc);
    return;
  }

  const item = items[0];
  if (item.type !== "string" && item.type !== "symbol") {
    pushError(errors, `Field '${label}' on rule ${statement.id} must be a string or symbol expression`, field.loc);
    return;
  }

  const text = item.value.trim();
  if (text.length === 0) {
    pushError(errors, `Field '${label}' on rule ${statement.id} must not be empty`, field.loc);
    return;
  }

  if (label === "requirement" || label === "condition") {
    if (!/(==|!=|<=|>=|<|>)/.test(text)) {
      pushError(errors, `Field '${label}' on rule ${statement.id} must include a comparison operator`, field.loc);
    }
  }
}

function validateExpressions(errors, statement, fieldMap) {
  if (statement.kind === "entity") {
    const invariantsField = fieldMap.get("invariants")?.[0];
    if (invariantsField?.value.type === "block") {
      for (const entry of invariantsField.value.entries) {
        validateInvariantEntry(errors, statement, entry);
      }
    }
  }

  if (statement.kind === "rule") {
    validateRuleExpressionValue(errors, statement, fieldMap.get("condition")?.[0], "condition");
    validateRuleExpressionValue(errors, statement, fieldMap.get("requirement")?.[0], "requirement");
  }
}

function validateShapeTransforms(errors, statement, fieldMap, registry) {
  if (statement.kind !== "shape") {
    return;
  }

  const baseFieldNames = resolveShapeBaseFieldNames(statement, registry);
  const baseFieldSet = new Set(baseFieldNames);
  const source = statement.from ? registry.get(statement.from.value) : null;
  const sourceFieldSet = new Set(source ? statementFieldNames(source) : []);
  const includeField = fieldMap.get("include")?.[0];
  const excludeField = fieldMap.get("exclude")?.[0];

  for (const [fieldKey, field] of [
    ["include", includeField],
    ["exclude", excludeField]
  ]) {
    if (!field) {
      continue;
    }

    for (const item of valueAsArray(field.value)) {
      if (item.type !== "symbol") {
        continue;
      }

      if (statement.from && !sourceFieldSet.has(item.value) && fieldKey === "include") {
        pushError(errors, `Shape ${statement.id} includes unknown field '${item.value}' from ${statement.from.value}`, item.loc);
      }

      if (statement.from && fieldKey === "exclude") {
        if (!sourceFieldSet.has(item.value)) {
          pushError(errors, `Shape ${statement.id} excludes unknown field '${item.value}' from ${statement.from.value}`, item.loc);
        }
      }
    }
  }

  const renameEntries = blockEntries(getFieldValue(statement, "rename"));
  const renameFrom = new Map();
  const renameTo = new Map();

  for (const entry of renameEntries) {
    const items = blockSymbolItems(entry);
    if (items.length !== 2) {
      pushError(errors, `Each 'rename' entry on shape ${statement.id} must be exactly '<from> <to>'`, entry.loc);
      continue;
    }

    const [fromItem, toItem] = items;
    if (!baseFieldSet.has(fromItem.value)) {
      pushError(errors, `Shape ${statement.id} renames unknown field '${fromItem.value}'`, fromItem.loc);
    }

    if (renameFrom.has(fromItem.value)) {
      pushError(errors, `Shape ${statement.id} renames field '${fromItem.value}' more than once`, fromItem.loc);
    } else {
      renameFrom.set(fromItem.value, toItem.value);
    }

    if (renameTo.has(toItem.value)) {
      pushError(errors, `Shape ${statement.id} renames multiple fields to '${toItem.value}'`, toItem.loc);
    } else {
      renameTo.set(toItem.value, fromItem.value);
    }
  }

  const finalFieldNames = baseFieldNames.map((fieldName) => renameFrom.get(fieldName) || fieldName);
  const finalFieldSet = new Set();
  for (const fieldName of finalFieldNames) {
    if (finalFieldSet.has(fieldName)) {
      pushError(errors, `Shape ${statement.id} produces duplicate projected field '${fieldName}'`, statement.loc);
      continue;
    }
    finalFieldSet.add(fieldName);
  }

  const sourceNameSet = new Set(baseFieldNames);
  const overrideEntries = blockEntries(getFieldValue(statement, "overrides"));
  const seenOverrides = new Set();

  for (const entry of overrideEntries) {
    const items = blockSymbolItems(entry);
    if (items.length < 2) {
      pushError(errors, `Each 'overrides' entry on shape ${statement.id} must include a field and at least one override`, entry.loc);
      continue;
    }

    const [fieldItem, ...rest] = items;
    if (!finalFieldSet.has(fieldItem.value) && !sourceNameSet.has(fieldItem.value)) {
      pushError(errors, `Shape ${statement.id} overrides unknown field '${fieldItem.value}'`, fieldItem.loc);
    }

    if (seenOverrides.has(fieldItem.value)) {
      pushError(errors, `Shape ${statement.id} overrides field '${fieldItem.value}' more than once`, fieldItem.loc);
    } else {
      seenOverrides.add(fieldItem.value);
    }

    let sawChange = false;
    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (token.value === "required" || token.value === "optional") {
        sawChange = true;
        continue;
      }

      if (token.value === "type") {
        sawChange = true;
        if (!rest[i + 1]) {
          pushError(errors, `Shape ${statement.id} override for '${fieldItem.value}' is missing a type value`, token.loc);
        } else {
          i += 1;
        }
        continue;
      }

      if (token.value === "default") {
        sawChange = true;
        if (!rest[i + 1]) {
          pushError(errors, `Shape ${statement.id} override for '${fieldItem.value}' is missing a default value`, token.loc);
        } else {
          i += 1;
        }
        continue;
      }

      pushError(errors, `Shape ${statement.id} override for '${fieldItem.value}' has unknown directive '${token.value}'`, token.loc);
    }

    if (!sawChange) {
      pushError(errors, `Shape ${statement.id} override for '${fieldItem.value}' must specify at least one valid directive`, entry.loc);
    }
  }
}

function validateProjectionHttp(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpField = fieldMap.get("http")?.[0];
  if (!httpField || httpField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));

  for (const entry of httpField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const capabilityId = tokens[0];
    if (!capabilityId) {
      continue;
    }

    const target = registry.get(capabilityId);
    if (!target) {
      pushError(errors, `Projection ${statement.id} http metadata references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (target.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http metadata must target a capability, found ${target.kind} '${target.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["method", "path", "success"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["method", "path", "success", "auth", "request"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const method = directives.get("method");
    if (method && !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' has invalid method '${method}'`, entry.loc);
    }

    const path = directives.get("path");
    if (path && !path.startsWith("/")) {
      pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' must use an absolute path`, entry.loc);
    }

    const success = directives.get("success");
    if (success && !/^\d{3}$/.test(success)) {
      pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' must use a 3-digit success status`, entry.loc);
    }

    const auth = directives.get("auth");
    if (auth && !["none", "user", "manager", "admin"].includes(auth)) {
      pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' has invalid auth mode '${auth}'`, entry.loc);
    }

    const request = directives.get("request");
    if (request && !["body", "query", "path", "none"].includes(request)) {
      pushError(errors, `Projection ${statement.id} http metadata for '${capabilityId}' has invalid request placement '${request}'`, entry.loc);
    }
  }
}

function validateProjectionHttpErrors(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpErrorsField = fieldMap.get("http_errors")?.[0];
  if (!httpErrorsField || httpErrorsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpErrorsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId, errorCode, status] = tokens;

    const target = registry.get(capabilityId);
    if (!target) {
      pushError(errors, `Projection ${statement.id} http_errors references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (target.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_errors must target a capability, found ${target.kind} '${target.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_errors for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (!/^\d{3}$/.test(status || "")) {
      pushError(errors, `Projection ${statement.id} http_errors for '${capabilityId}' must use a 3-digit status`, entry.loc);
    }
    if (!errorCode) {
      pushError(errors, `Projection ${statement.id} http_errors for '${capabilityId}' must include an error code`, entry.loc);
    }
  }
}

function resolveCapabilityContractFields(registry, capabilityId, direction) {
  const capability = registry.get(capabilityId);
  if (!capability || capability.kind !== "capability") {
    return new Set();
  }

  const refsField = direction === "input" ? getFieldValue(capability, "input") : getFieldValue(capability, "output");
  const shapeId = symbolValues(refsField)[0];
  if (!shapeId) {
    return new Set();
  }

  const shape = registry.get(shapeId);
  if (!shape || shape.kind !== "shape") {
    return new Set();
  }

  const explicitFields = statementFieldNames(shape);
  if (explicitFields.length > 0) {
    return new Set(explicitFields);
  }

  return new Set(resolveShapeBaseFieldNames(shape, registry));
}

function validateProjectionHttpFields(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpFieldsField = fieldMap.get("http_fields")?.[0];
  if (!httpFieldsField || httpFieldsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpFieldsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId, direction, fieldName, keywordIn, location, maybeAs, maybeWireName] = tokens;

    const capability = registry.get(capabilityId);
    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_fields references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_fields must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_fields for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (!["input", "output"].includes(direction)) {
      pushError(errors, `Projection ${statement.id} http_fields for '${capabilityId}' has invalid direction '${direction}'`, entry.loc);
    }
    if (keywordIn !== "in") {
      pushError(errors, `Projection ${statement.id} http_fields for '${capabilityId}' must use 'in' before the location`, entry.loc);
    }
    if (!["path", "query", "header", "body"].includes(location)) {
      pushError(errors, `Projection ${statement.id} http_fields for '${capabilityId}' has invalid location '${location}'`, entry.loc);
    }
    if (maybeAs && maybeAs !== "as") {
      pushError(errors, `Projection ${statement.id} http_fields for '${capabilityId}' has unexpected token '${maybeAs}'`, entry.loc);
    }
    if (maybeAs === "as" && !maybeWireName) {
      pushError(errors, `Projection ${statement.id} http_fields for '${capabilityId}' must provide a wire name after 'as'`, entry.loc);
    }

    const availableFields = resolveCapabilityContractFields(registry, capabilityId, direction);
    if (fieldName && availableFields.size > 0 && !availableFields.has(fieldName)) {
      pushError(errors, `Projection ${statement.id} http_fields references unknown ${direction} field '${fieldName}' on ${capabilityId}`, entry.loc);
    }
  }
}

function validateProjectionHttpResponses(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpResponsesField = fieldMap.get("http_responses")?.[0];
  if (!httpResponsesField || httpResponsesField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpResponsesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const capabilityId = tokens[0];
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_responses references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_responses must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = parseProjectionHttpResponsesDirectives(tokens.slice(1));
    for (const message of directives.errors) {
      pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' ${message}`, entry.loc);
    }

    if (!directives.mode) {
      pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must include 'mode'`, entry.loc);
    }

    const mode = directives.mode;
    if (mode && !["item", "collection", "paged", "cursor"].includes(mode)) {
      pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' has invalid mode '${mode}'`, entry.loc);
    }

    const itemShapeId = directives.item;
    if (mode && mode !== "item" && !itemShapeId) {
      pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must include 'item' for mode '${mode}'`, entry.loc);
    }
    if (itemShapeId) {
      const itemShape = registry.get(itemShapeId);
      if (!itemShape) {
        pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' references missing shape '${itemShapeId}'`, entry.loc);
      } else if (itemShape.kind !== "shape") {
        pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must reference a shape for 'item', found ${itemShape.kind} '${itemShape.id}'`, entry.loc);
      }
    }

    if (mode === "cursor") {
      if (!directives.cursor?.requestAfter) {
        pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must include 'cursor request_after <field>'`, entry.loc);
      }
      if (!directives.cursor?.responseNext) {
        pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must include 'cursor response_next <wire_name>'`, entry.loc);
      }
      if (!directives.limit) {
        pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must include 'limit field <field> default <n> max <n>'`, entry.loc);
      }
      if (!directives.sort) {
        pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must include 'sort by <field> direction <asc|desc>'`, entry.loc);
      }
    }

    if (directives.sort && !["asc", "desc"].includes(directives.sort.direction || "")) {
      pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' has invalid sort direction '${directives.sort.direction}'`, entry.loc);
    }

    if (directives.total && !["true", "false"].includes(directives.total.included || "")) {
      pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' has invalid total included value '${directives.total.included}'`, entry.loc);
    }

    if (directives.limit) {
      const defaultValue = Number.parseInt(directives.limit.defaultValue || "", 10);
      const maxValue = Number.parseInt(directives.limit.maxValue || "", 10);
      if (!Number.isInteger(defaultValue) || !Number.isInteger(maxValue)) {
        pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must use integer default/max values for 'limit'`, entry.loc);
      } else if (defaultValue > maxValue) {
        pushError(errors, `Projection ${statement.id} http_responses for '${capabilityId}' must use default <= max for 'limit'`, entry.loc);
      }
    }

    const inputFields = resolveCapabilityContractFields(registry, capabilityId, "input");
    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    if (directives.cursor?.requestAfter && inputFields.size > 0 && !inputFields.has(directives.cursor.requestAfter)) {
      pushError(errors, `Projection ${statement.id} http_responses references unknown input field '${directives.cursor.requestAfter}' for cursor request_after on ${capabilityId}`, entry.loc);
    }
    if (directives.limit?.field && inputFields.size > 0 && !inputFields.has(directives.limit.field)) {
      pushError(errors, `Projection ${statement.id} http_responses references unknown input field '${directives.limit.field}' for limit on ${capabilityId}`, entry.loc);
    }
    if (directives.sort?.field && outputFields.size > 0 && !outputFields.has(directives.sort.field)) {
      pushError(errors, `Projection ${statement.id} http_responses references unknown output field '${directives.sort.field}' for sort on ${capabilityId}`, entry.loc);
    }
  }
}

function validateProjectionHttpPreconditions(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpPreconditionsField = fieldMap.get("http_preconditions")?.[0];
  if (!httpPreconditionsField || httpPreconditionsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpPreconditionsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_preconditions references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_preconditions must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_preconditions for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_preconditions for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["header", "required", "error", "source", "code"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http_preconditions for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["header", "required", "error", "source", "code"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_preconditions for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const required = directives.get("required");
    if (required && !["true", "false"].includes(required)) {
      pushError(errors, `Projection ${statement.id} http_preconditions for '${capabilityId}' has invalid required value '${required}'`, entry.loc);
    }

    const errorStatus = directives.get("error");
    if (errorStatus && !/^\d{3}$/.test(errorStatus)) {
      pushError(errors, `Projection ${statement.id} http_preconditions for '${capabilityId}' must use a 3-digit error status`, entry.loc);
    }

    const sourceField = directives.get("source");
    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    if (sourceField && outputFields.size > 0 && !outputFields.has(sourceField)) {
      pushError(errors, `Projection ${statement.id} http_preconditions references unknown output field '${sourceField}' on ${capabilityId}`, entry.loc);
    }
  }
}

function validateProjectionHttpIdempotency(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpIdempotencyField = fieldMap.get("http_idempotency")?.[0];
  if (!httpIdempotencyField || httpIdempotencyField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpIdempotencyField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_idempotency references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_idempotency must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_idempotency for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_idempotency for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["header", "required", "error", "code"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http_idempotency for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["header", "required", "error", "code"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_idempotency for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const required = directives.get("required");
    if (required && !["true", "false"].includes(required)) {
      pushError(errors, `Projection ${statement.id} http_idempotency for '${capabilityId}' has invalid required value '${required}'`, entry.loc);
    }

    const errorStatus = directives.get("error");
    if (errorStatus && !/^\d{3}$/.test(errorStatus)) {
      pushError(errors, `Projection ${statement.id} http_idempotency for '${capabilityId}' must use a 3-digit error status`, entry.loc);
    }
  }
}

function validateProjectionHttpCache(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpCacheField = fieldMap.get("http_cache")?.[0];
  if (!httpCacheField || httpCacheField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const httpEntries = blockEntries(getFieldValue(statement, "http"));
  const httpMethodsByCapability = new Map();

  for (const entry of httpEntries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const capabilityId = tokens[0];
    for (let i = 1; i < tokens.length - 1; i += 1) {
      if (tokens[i] === "method") {
        httpMethodsByCapability.set(capabilityId, tokens[i + 1]);
        break;
      }
    }
  }

  for (const entry of httpCacheField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_cache references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_cache must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_cache for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_cache for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["response_header", "request_header", "required", "not_modified", "source", "code"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http_cache for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["response_header", "request_header", "required", "not_modified", "source", "code"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_cache for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const required = directives.get("required");
    if (required && !["true", "false"].includes(required)) {
      pushError(errors, `Projection ${statement.id} http_cache for '${capabilityId}' has invalid required value '${required}'`, entry.loc);
    }

    const notModifiedStatus = directives.get("not_modified");
    if (notModifiedStatus && notModifiedStatus !== "304") {
      pushError(errors, `Projection ${statement.id} http_cache for '${capabilityId}' must use 304 for 'not_modified'`, entry.loc);
    }

    const sourceField = directives.get("source");
    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    if (sourceField && outputFields.size > 0 && !outputFields.has(sourceField)) {
      pushError(errors, `Projection ${statement.id} http_cache references unknown output field '${sourceField}' on ${capabilityId}`, entry.loc);
    }

    const method = httpMethodsByCapability.get(capabilityId);
    if (method && method !== "GET") {
      pushError(errors, `Projection ${statement.id} http_cache for '${capabilityId}' requires an HTTP GET realization, found '${method}'`, entry.loc);
    }
  }
}

function validateProjectionHttpDelete(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpDeleteField = fieldMap.get("http_delete")?.[0];
  if (!httpDeleteField || httpDeleteField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpDeleteField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_delete references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_delete must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_delete for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_delete for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["mode", "response"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http_delete for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["mode", "field", "value", "response"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_delete for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const mode = directives.get("mode");
    if (mode && !["soft", "hard"].includes(mode)) {
      pushError(errors, `Projection ${statement.id} http_delete for '${capabilityId}' has invalid mode '${mode}'`, entry.loc);
    }

    const response = directives.get("response");
    if (response && !["none", "body"].includes(response)) {
      pushError(errors, `Projection ${statement.id} http_delete for '${capabilityId}' has invalid response '${response}'`, entry.loc);
    }

    if (mode === "soft") {
      if (!directives.has("field") || !directives.has("value")) {
        pushError(errors, `Projection ${statement.id} http_delete for '${capabilityId}' must include 'field' and 'value' for soft deletes`, entry.loc);
      }
      const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
      const fieldName = directives.get("field");
      if (fieldName && outputFields.size > 0 && !outputFields.has(fieldName)) {
        pushError(errors, `Projection ${statement.id} http_delete references unknown output field '${fieldName}' on ${capabilityId}`, entry.loc);
      }
    }
  }
}

function validateProjectionHttpAsync(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpAsyncField = fieldMap.get("http_async")?.[0];
  if (!httpAsyncField || httpAsyncField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const httpEntries = blockEntries(getFieldValue(statement, "http"));
  const httpDirectivesByCapability = new Map();
  for (const entry of httpEntries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const capabilityId = tokens[0];
    const directives = new Map();
    for (let i = 1; i < tokens.length - 1; i += 2) {
      directives.set(tokens[i], tokens[i + 1]);
    }
    httpDirectivesByCapability.set(capabilityId, directives);
  }
  for (const entry of httpAsyncField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_async references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_async must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["mode", "accepted", "location_header", "retry_after_header", "status_path", "status_capability", "job"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["mode", "accepted", "location_header", "retry_after_header", "status_path", "status_capability", "job"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const mode = directives.get("mode");
    if (mode && mode !== "job") {
      pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' has invalid mode '${mode}'`, entry.loc);
    }

    const accepted = directives.get("accepted");
    if (accepted && accepted !== "202") {
      pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' must use 202 for 'accepted'`, entry.loc);
    }

    const jobShapeId = directives.get("job");
    if (jobShapeId) {
      const jobShape = registry.get(jobShapeId);
      if (!jobShape) {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' references missing shape '${jobShapeId}'`, entry.loc);
      } else if (jobShape.kind !== "shape") {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' must reference a shape for 'job', found ${jobShape.kind} '${jobShape.id}'`, entry.loc);
      }
    }

    const statusCapabilityId = directives.get("status_capability");
    if (statusCapabilityId) {
      const statusCapability = registry.get(statusCapabilityId);
      if (!statusCapability) {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' references missing status capability '${statusCapabilityId}'`, entry.loc);
      } else if (statusCapability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' must reference a capability for 'status_capability', found ${statusCapability.kind} '${statusCapability.id}'`, entry.loc);
      } else if (!realized.has(statusCapabilityId)) {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' status capability '${statusCapabilityId}' must also appear in 'realizes'`, entry.loc);
      }

      const statusHttp = httpDirectivesByCapability.get(statusCapabilityId);
      if (statusHttp?.get("method") && statusHttp.get("method") !== "GET") {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' status capability '${statusCapabilityId}' must use HTTP GET`, entry.loc);
      }
      if (statusHttp?.get("path") && directives.get("status_path") && statusHttp.get("path") !== directives.get("status_path")) {
        pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' status_path must match the path for '${statusCapabilityId}'`, entry.loc);
      }
    }

    const statusPath = directives.get("status_path");
    if (statusPath && !statusPath.startsWith("/")) {
      pushError(errors, `Projection ${statement.id} http_async for '${capabilityId}' must use an absolute path for 'status_path'`, entry.loc);
    }
  }
}

function validateProjectionHttpStatus(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpStatusField = fieldMap.get("http_status")?.[0];
  if (!httpStatusField || httpStatusField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const httpEntries = blockEntries(getFieldValue(statement, "http"));
  const httpMethodsByCapability = new Map();
  for (const entry of httpEntries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const capabilityId = tokens[0];
    for (let i = 1; i < tokens.length - 1; i += 2) {
      if (tokens[i] === "method") {
        httpMethodsByCapability.set(capabilityId, tokens[i + 1]);
        break;
      }
    }
  }
  for (const entry of httpStatusField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_status references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_status must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["async_for", "state_field", "completed", "failed"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["async_for", "state_field", "completed", "failed", "expired", "download_capability", "download_field", "error_field"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const asyncCapabilityId = directives.get("async_for");
    if (asyncCapabilityId) {
      const asyncCapability = registry.get(asyncCapabilityId);
      if (!asyncCapability) {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' references missing async capability '${asyncCapabilityId}'`, entry.loc);
      } else if (asyncCapability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' must reference a capability for 'async_for', found ${asyncCapability.kind} '${asyncCapability.id}'`, entry.loc);
      } else if (!realized.has(asyncCapabilityId)) {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' async capability '${asyncCapabilityId}' must also appear in 'realizes'`, entry.loc);
      }
    }

    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    for (const [directive, fieldName] of [
      ["state_field", directives.get("state_field")],
      ["download_field", directives.get("download_field")],
      ["error_field", directives.get("error_field")]
    ]) {
      if (fieldName && outputFields.size > 0 && !outputFields.has(fieldName)) {
        pushError(errors, `Projection ${statement.id} http_status references unknown output field '${fieldName}' for '${directive}' on ${capabilityId}`, entry.loc);
      }
    }

    const downloadCapabilityId = directives.get("download_capability");
    if (downloadCapabilityId) {
      const downloadCapability = registry.get(downloadCapabilityId);
      if (!downloadCapability) {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' references missing download capability '${downloadCapabilityId}'`, entry.loc);
      } else if (downloadCapability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' must reference a capability for 'download_capability', found ${downloadCapability.kind} '${downloadCapability.id}'`, entry.loc);
      } else if (!realized.has(downloadCapabilityId)) {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' download capability '${downloadCapabilityId}' must also appear in 'realizes'`, entry.loc);
      }

      const method = httpMethodsByCapability.get(downloadCapabilityId);
      if (method && method !== "GET") {
        pushError(errors, `Projection ${statement.id} http_status for '${capabilityId}' download capability '${downloadCapabilityId}' must use HTTP GET`, entry.loc);
      }
    }
  }
}

function validateProjectionHttpDownload(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpDownloadField = fieldMap.get("http_download")?.[0];
  if (!httpDownloadField || httpDownloadField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpDownloadField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_download references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_download must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["async_for", "media", "disposition"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["async_for", "media", "filename", "disposition"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const asyncCapabilityId = directives.get("async_for");
    if (asyncCapabilityId) {
      const asyncCapability = registry.get(asyncCapabilityId);
      if (!asyncCapability) {
        pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' references missing async capability '${asyncCapabilityId}'`, entry.loc);
      } else if (asyncCapability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' must reference a capability for 'async_for', found ${asyncCapability.kind} '${asyncCapability.id}'`, entry.loc);
      } else if (!realized.has(asyncCapabilityId)) {
        pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' async capability '${asyncCapabilityId}' must also appear in 'realizes'`, entry.loc);
      }
    }

    const media = directives.get("media");
    if (media && !media.includes("/")) {
      pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' must use a valid media type`, entry.loc);
    }

    const disposition = directives.get("disposition");
    if (disposition && !["attachment", "inline"].includes(disposition)) {
      pushError(errors, `Projection ${statement.id} http_download for '${capabilityId}' has invalid disposition '${disposition}'`, entry.loc);
    }
  }
}

function validateProjectionHttpAuthz(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpAuthzField = fieldMap.get("http_authz")?.[0];
  if (!httpAuthzField || httpAuthzField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpAuthzField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_authz references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_authz must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_authz for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_authz for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const key of directives.keys()) {
      if (!["role", "permission", "claim", "claim_value", "ownership", "ownership_field"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_authz for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    if (directives.size === 0) {
      pushError(errors, `Projection ${statement.id} http_authz for '${capabilityId}' must include at least one directive`, entry.loc);
    }

    const ownership = directives.get("ownership");
    if (ownership && !["owner", "owner_or_admin", "project_member", "none"].includes(ownership)) {
      pushError(errors, `Projection ${statement.id} http_authz for '${capabilityId}' has invalid ownership '${ownership}'`, entry.loc);
    }

    const ownershipField = directives.get("ownership_field");
    if (ownershipField && (!ownership || ownership === "none")) {
      pushError(errors, `Projection ${statement.id} http_authz for '${capabilityId}' cannot declare ownership_field without ownership`, entry.loc);
    }

    const claimValue = directives.get("claim_value");
    if (claimValue && !directives.get("claim")) {
      pushError(errors, `Projection ${statement.id} http_authz for '${capabilityId}' cannot declare claim_value without claim`, entry.loc);
    }
  }
}

function validateProjectionHttpCallbacks(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpCallbacksField = fieldMap.get("http_callbacks")?.[0];
  if (!httpCallbacksField || httpCallbacksField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpCallbacksField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} http_callbacks references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} http_callbacks must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} http_callbacks for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} http_callbacks for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["event", "target_field", "method", "payload", "success"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} http_callbacks for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["event", "target_field", "method", "payload", "success"].includes(key)) {
        pushError(errors, `Projection ${statement.id} http_callbacks for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const method = directives.get("method");
    if (method && !["POST", "PUT", "PATCH"].includes(method)) {
      pushError(errors, `Projection ${statement.id} http_callbacks for '${capabilityId}' has invalid method '${method}'`, entry.loc);
    }

    const success = directives.get("success");
    if (success && !/^\d{3}$/.test(success)) {
      pushError(errors, `Projection ${statement.id} http_callbacks for '${capabilityId}' must use a 3-digit success status`, entry.loc);
    }

    const payloadShapeId = directives.get("payload");
    if (payloadShapeId) {
      const payloadShape = registry.get(payloadShapeId);
      if (!payloadShape) {
        pushError(errors, `Projection ${statement.id} http_callbacks for '${capabilityId}' references missing shape '${payloadShapeId}'`, entry.loc);
      } else if (payloadShape.kind !== "shape") {
        pushError(errors, `Projection ${statement.id} http_callbacks for '${capabilityId}' must reference a shape for 'payload', found ${payloadShape.kind} '${payloadShape.id}'`, entry.loc);
      }
    }

    const targetField = directives.get("target_field");
    const inputFields = resolveCapabilityContractFields(registry, capabilityId, "input");
    if (targetField && inputFields.size > 0 && !inputFields.has(targetField)) {
      pushError(errors, `Projection ${statement.id} http_callbacks references unknown input field '${targetField}' on ${capabilityId}`, entry.loc);
    }
  }
}

function parseProjectionHttpResponsesDirectives(tokens) {
  const result = {
    mode: null,
    item: null,
    cursor: null,
    limit: null,
    sort: null,
    total: null,
    errors: []
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "mode") {
      result.mode = tokens[i + 1] || null;
      if (!tokens[i + 1]) {
        result.errors.push("is missing a value for 'mode'");
      }
      i += 1;
      continue;
    }
    if (token === "item") {
      result.item = tokens[i + 1] || null;
      if (!tokens[i + 1]) {
        result.errors.push("is missing a value for 'item'");
      }
      i += 1;
      continue;
    }
    if (token === "cursor") {
      const requestKeyword = tokens[i + 1];
      const requestField = tokens[i + 2];
      const responseKeyword = tokens[i + 3];
      const responseNext = tokens[i + 4];
      let responsePrev = null;
      let consumed = 4;
      if (tokens[i + 5] === "response_prev") {
        responsePrev = tokens[i + 6] || null;
        consumed = 6;
      }
      result.cursor = {
        requestAfter: requestKeyword === "request_after" ? requestField : null,
        responseNext: responseKeyword === "response_next" ? responseNext : null,
        responsePrev
      };
      if (requestKeyword !== "request_after") {
        result.errors.push("must use 'cursor request_after <field>'");
      }
      if (responseKeyword !== "response_next") {
        result.errors.push("must use 'cursor response_next <wire_name>'");
      }
      i += consumed;
      continue;
    }
    if (token === "limit") {
      result.limit = {
        field: tokens[i + 1] === "field" ? tokens[i + 2] || null : null,
        defaultValue: tokens[i + 3] === "default" ? tokens[i + 4] || null : null,
        maxValue: tokens[i + 5] === "max" ? tokens[i + 6] || null : null
      };
      if (tokens[i + 1] !== "field" || tokens[i + 3] !== "default" || tokens[i + 5] !== "max") {
        result.errors.push("must use 'limit field <field> default <n> max <n>'");
      }
      i += 6;
      continue;
    }
    if (token === "sort") {
      result.sort = {
        field: tokens[i + 1] === "by" ? tokens[i + 2] || null : null,
        direction: tokens[i + 3] === "direction" ? tokens[i + 4] || null : null
      };
      if (tokens[i + 1] !== "by" || tokens[i + 3] !== "direction") {
        result.errors.push("must use 'sort by <field> direction <asc|desc>'");
      }
      i += 4;
      continue;
    }
    if (token === "total") {
      result.total = {
        included: tokens[i + 1] === "included" ? tokens[i + 2] || null : null
      };
      if (tokens[i + 1] !== "included") {
        result.errors.push("must use 'total included <true|false>'");
      }
      i += 2;
      continue;
    }

    result.errors.push(`has unknown directive '${token}'`);
  }

  return result;
}

function resolveCapabilityOutputShape(registry, capabilityId) {
  const capability = registry.get(capabilityId);
  if (!capability || capability.kind !== "capability") {
    return null;
  }

  const shapeId = symbolValues(getFieldValue(capability, "output"))[0];
  const shape = shapeId ? registry.get(shapeId) : null;
  return shape?.kind === "shape" ? shape : null;
}

function collectProjectionUiScreens(statement, fieldMap) {
  const screensField = fieldMap.get("ui_screens")?.[0];
  if (!screensField || screensField.value.type !== "block") {
    return new Map();
  }

  const screens = new Map();
  for (const entry of screensField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] === "screen" && tokens[1]) {
      screens.set(tokens[1], entry);
    }
  }
  return screens;
}

function resolveProjectionUiScreenFieldNames(registry, screenEntry, statement) {
  const tokens = blockSymbolItems(screenEntry).map((item) => item.value);
  const directives = parseUiDirectiveMap(tokens, 2, [], statement, screenEntry, "");
  const kind = directives.get("kind");

  if (kind === "form") {
    const shapeId = directives.get("input_shape");
    const shape = shapeId ? registry.get(shapeId) : null;
    if (!shape || shape.kind !== "shape") {
      return new Set();
    }
    const explicitFields = statementFieldNames(shape);
    return new Set(explicitFields.length > 0 ? explicitFields : resolveShapeBaseFieldNames(shape, registry));
  }

  if (kind === "list") {
    const loadCapabilityId = directives.get("load");
    return loadCapabilityId ? resolveCapabilityContractFields(registry, loadCapabilityId, "input") : new Set();
  }

  if (kind === "detail" || kind === "job_status") {
    const loadCapabilityId = directives.get("load");
    return loadCapabilityId ? resolveCapabilityContractFields(registry, loadCapabilityId, "output") : new Set();
  }

  return new Set();
}

function screenIdsFromProjectionStatement(statement) {
  const screens = new Set();
  for (const entry of blockEntries(getFieldValue(statement, "ui_screens"))) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] === "screen" && tokens[1]) {
      screens.add(tokens[1]);
    }
  }
  return screens;
}

function collectAvailableUiScreenIds(statement, fieldMap, registry) {
  const available = new Set(collectProjectionUiScreens(statement, fieldMap).keys());
  for (const targetId of symbolValues(getFieldValue(statement, "realizes"))) {
    const target = registry.get(targetId);
    if (target?.kind === "projection") {
      for (const screenId of screenIdsFromProjectionStatement(target)) {
        available.add(screenId);
      }
    }
  }
  return available;
}

function collectProjectionUiRegionKeys(statement) {
  const keys = new Set();
  for (const entry of blockEntries(getFieldValue(statement, "ui_screen_regions"))) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] === "screen" && tokens[1] && tokens[2] === "region" && tokens[3]) {
      keys.add(`${tokens[1]}:${tokens[3]}`);
    }
  }
  return keys;
}

function collectAvailableUiRegionKeys(statement, registry) {
  const available = collectProjectionUiRegionKeys(statement);
  for (const targetId of symbolValues(getFieldValue(statement, "realizes"))) {
    const target = registry.get(targetId);
    if (target?.kind === "projection") {
      for (const key of collectProjectionUiRegionKeys(target)) {
        available.add(key);
      }
    }
  }
  return available;
}

function collectProjectionUiRegionPatterns(statement) {
  const patterns = new Map();
  for (const entry of blockEntries(getFieldValue(statement, "ui_screen_regions"))) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] !== "screen" || !tokens[1] || tokens[2] !== "region" || !tokens[3]) {
      continue;
    }
    for (let i = 4; i < tokens.length; i += 2) {
      if (tokens[i] === "pattern" && tokens[i + 1]) {
        patterns.set(`${tokens[1]}:${tokens[3]}`, tokens[i + 1]);
      }
    }
  }
  return patterns;
}

function collectAvailableUiRegionPatterns(statement, registry) {
  const patterns = collectProjectionUiRegionPatterns(statement);
  for (const targetId of symbolValues(getFieldValue(statement, "realizes"))) {
    const target = registry.get(targetId);
    if (target?.kind !== "projection") {
      continue;
    }
    for (const [key, pattern] of collectProjectionUiRegionPatterns(target)) {
      if (!patterns.has(key)) {
        patterns.set(key, pattern);
      }
    }
  }
  return patterns;
}

function parseUiDirectiveMap(tokens, startIndex, errors, statement, entry, context) {
  const directives = new Map();

  for (let i = startIndex; i < tokens.length; i += 2) {
    const key = tokens[i];
    const value = tokens[i + 1];
    if (!key) {
      continue;
    }
    if (!value) {
      pushError(errors, `Projection ${statement.id} ${context} is missing a value for '${key}'`, entry.loc);
      continue;
    }
    directives.set(key, value);
  }

  return directives;
}

function validateProjectionUiScreens(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const screensField = fieldMap.get("ui_screens")?.[0];
  if (!screensField || screensField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const seenScreens = new Set();

  for (const entry of screensField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} ui_screens entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!screenId) {
      pushError(errors, `Projection ${statement.id} ui_screens entries must include a screen id`, entry.loc);
      continue;
    }
    if (!IDENTIFIER_PATTERN.test(screenId)) {
      pushError(errors, `Projection ${statement.id} ui_screens has invalid screen id '${screenId}'`, entry.loc);
    }
    if (seenScreens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} ui_screens has duplicate screen id '${screenId}'`, entry.loc);
    }
    seenScreens.add(screenId);

    const directives = parseUiDirectiveMap(tokens, 2, errors, statement, entry, `ui_screens for '${screenId}'`);
    const kind = directives.get("kind");
    if (!kind) {
      pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' must include 'kind'`, entry.loc);
    }
    if (kind && !UI_SCREEN_KINDS.has(kind)) {
      pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' has invalid kind '${kind}'`, entry.loc);
    }

    for (const key of directives.keys()) {
      if (!["kind", "title", "load", "item_shape", "view_shape", "input_shape", "submit", "detail_capability", "primary_action", "secondary_action", "destructive_action", "success_navigate", "success_refresh", "empty_title", "empty_body", "terminal_action", "loading_state", "error_state", "unauthorized_state", "not_found_state", "success_state"].includes(key)) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    for (const [key, expectedKind] of [
      ["load", "capability"],
      ["submit", "capability"],
      ["detail_capability", "capability"],
      ["primary_action", "capability"],
      ["secondary_action", "capability"],
      ["destructive_action", "capability"],
      ["terminal_action", "capability"],
      ["item_shape", "shape"],
      ["view_shape", "shape"],
      ["input_shape", "shape"]
    ]) {
      const targetId = directives.get(key);
      if (!targetId) {
        continue;
      }
      const target = registry.get(targetId);
      if (!target) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' references missing ${expectedKind} '${targetId}' for '${key}'`, entry.loc);
        continue;
      }
      if (target.kind !== expectedKind) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' must reference a ${expectedKind} for '${key}', found ${target.kind} '${target.id}'`, entry.loc);
      }
      if (expectedKind === "capability" && !realized.has(targetId)) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' capability '${targetId}' for '${key}' must also appear in 'realizes'`, entry.loc);
      }
    }

    const successNavigate = directives.get("success_navigate");
    const successRefresh = directives.get("success_refresh");
    if (successNavigate && !IDENTIFIER_PATTERN.test(successNavigate)) {
      pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' has invalid target '${successNavigate}' for 'success_navigate'`, entry.loc);
    }
    if (successRefresh && !IDENTIFIER_PATTERN.test(successRefresh)) {
      pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' has invalid target '${successRefresh}' for 'success_refresh'`, entry.loc);
    }

    if (kind === "list" && !directives.get("load")) {
      pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' kind 'list' requires 'load'`, entry.loc);
    }
    if (kind === "detail") {
      if (!directives.get("load")) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' kind 'detail' requires 'load'`, entry.loc);
      }
      if (!directives.get("view_shape")) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' kind 'detail' requires 'view_shape'`, entry.loc);
      }
    }
    if (kind === "form") {
      if (!directives.get("input_shape")) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' kind 'form' requires 'input_shape'`, entry.loc);
      }
      if (!directives.get("submit")) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' kind 'form' requires 'submit'`, entry.loc);
      }
    }
  }

  for (const entry of screensField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const screenId = tokens[1];
    if (!screenId) {
      continue;
    }
    const directives = parseUiDirectiveMap(tokens, 2, [], statement, entry, "");
    for (const key of ["success_navigate", "success_refresh"]) {
      const targetScreenId = directives.get(key);
      if (targetScreenId && !seenScreens.has(targetScreenId)) {
        pushError(errors, `Projection ${statement.id} ui_screens for '${screenId}' references unknown screen '${targetScreenId}' for '${key}'`, entry.loc);
      }
    }
  }
}

function validateProjectionUiCollections(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const collectionsField = fieldMap.get("ui_collections")?.[0];
  if (!collectionsField || collectionsField.value.type !== "block") {
    return;
  }

  const screens = collectProjectionUiScreens(statement, fieldMap);
  for (const entry of collectionsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, operation, value, extra] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} ui_collections entries must start with 'screen'`, entry.loc);
      continue;
    }
    const screenEntry = screens.get(screenId);
    if (!screenEntry) {
      pushError(errors, `Projection ${statement.id} ui_collections references unknown screen '${screenId}'`, entry.loc);
      continue;
    }

    const screenTokens = blockSymbolItems(screenEntry).map((item) => item.value);
    const screenDirectives = parseUiDirectiveMap(screenTokens, 2, [], statement, screenEntry, "");
    if (screenDirectives.get("kind") !== "list") {
      pushError(errors, `Projection ${statement.id} ui_collections may only target list screens, found '${screenId}'`, entry.loc);
    }

    if (!["filter", "search", "pagination", "sort", "group", "view", "refresh"].includes(operation)) {
      pushError(errors, `Projection ${statement.id} ui_collections for '${screenId}' has invalid operation '${operation}'`, entry.loc);
      continue;
    }

    const loadCapabilityId = screenDirectives.get("load");
    const inputFields = loadCapabilityId ? resolveCapabilityContractFields(registry, loadCapabilityId, "input") : new Set();
    const outputShape = loadCapabilityId ? resolveCapabilityOutputShape(registry, loadCapabilityId) : null;
    const outputFields = outputShape
      ? new Set((statementFieldNames(outputShape).length > 0 ? statementFieldNames(outputShape) : resolveShapeBaseFieldNames(outputShape, registry)))
      : new Set();

    if (operation === "filter" || operation === "search") {
      if (!value) {
        pushError(errors, `Projection ${statement.id} ui_collections for '${screenId}' must include a field for '${operation}'`, entry.loc);
      } else if (inputFields.size > 0 && !inputFields.has(value)) {
        pushError(errors, `Projection ${statement.id} ui_collections references unknown input field '${value}' for '${operation}' on '${screenId}'`, entry.loc);
      }
    }

    if (operation === "pagination" && !["cursor", "paged", "none"].includes(value || "")) {
      pushError(errors, `Projection ${statement.id} ui_collections for '${screenId}' has invalid pagination '${value}'`, entry.loc);
    }

    if (operation === "sort") {
      if (!value || !extra) {
        pushError(errors, `Projection ${statement.id} ui_collections for '${screenId}' must use 'sort <field> <asc|desc>'`, entry.loc);
      } else {
        if (!["asc", "desc"].includes(extra)) {
          pushError(errors, `Projection ${statement.id} ui_collections for '${screenId}' has invalid sort direction '${extra}'`, entry.loc);
        }
        if (outputFields.size > 0 && !outputFields.has(value)) {
          pushError(errors, `Projection ${statement.id} ui_collections references unknown output field '${value}' for sort on '${screenId}'`, entry.loc);
        }
      }
    }

    if (operation === "group") {
      if (!value) {
        pushError(errors, `Projection ${statement.id} ui_collections for '${screenId}' must include a field for 'group'`, entry.loc);
      } else if (outputFields.size > 0 && !outputFields.has(value)) {
        pushError(errors, `Projection ${statement.id} ui_collections references unknown output field '${value}' for group on '${screenId}'`, entry.loc);
      }
    }

    if (operation === "view" && !UI_COLLECTION_PRESENTATIONS.has(value || "")) {
      pushError(errors, `Projection ${statement.id} ui_collections for '${screenId}' has invalid view '${value}'`, entry.loc);
    }

    if (operation === "refresh" && !["manual", "pull_to_refresh", "auto"].includes(value || "")) {
      pushError(errors, `Projection ${statement.id} ui_collections for '${screenId}' has invalid refresh '${value}'`, entry.loc);
    }
  }
}

function validateProjectionUiActions(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const actionsField = fieldMap.get("ui_actions")?.[0];
  if (!actionsField || actionsField.value.type !== "block") {
    return;
  }

  const screens = collectProjectionUiScreens(statement, fieldMap);
  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));

  for (const entry of actionsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, actionKeyword, capabilityId, prominenceKeyword, prominence, placementKeyword, placement] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} ui_actions entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!screens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} ui_actions references unknown screen '${screenId}'`, entry.loc);
    }
    if (actionKeyword !== "action") {
      pushError(errors, `Projection ${statement.id} ui_actions for '${screenId}' must use 'action'`, entry.loc);
    }
    const capability = registry.get(capabilityId);
    if (!capability) {
      pushError(errors, `Projection ${statement.id} ui_actions references missing capability '${capabilityId}'`, entry.loc);
    } else if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} ui_actions must reference a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    } else if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} ui_actions for '${screenId}' capability '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (prominenceKeyword !== "prominence") {
      pushError(errors, `Projection ${statement.id} ui_actions for '${screenId}' must use 'prominence'`, entry.loc);
    }
    if (!["primary", "secondary", "destructive", "contextual"].includes(prominence || "")) {
      pushError(errors, `Projection ${statement.id} ui_actions for '${screenId}' has invalid prominence '${prominence}'`, entry.loc);
    }
    if (placementKeyword && placementKeyword !== "placement") {
      pushError(errors, `Projection ${statement.id} ui_actions for '${screenId}' has unknown directive '${placementKeyword}'`, entry.loc);
    }
    if (placementKeyword === "placement" && !["toolbar", "menu", "bulk", "inline", "footer"].includes(placement || "")) {
      pushError(errors, `Projection ${statement.id} ui_actions for '${screenId}' has invalid placement '${placement}'`, entry.loc);
    }
  }
}

function validateProjectionUiAppShell(errors, statement, fieldMap) {
  if (statement.kind !== "projection") {
    return;
  }

  const shellField = fieldMap.get("ui_app_shell")?.[0];
  if (!shellField || shellField.value.type !== "block") {
    return;
  }

  const seenKeys = new Set();
  for (const entry of shellField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [key, value, extra] = tokens;
    if (!["brand", "shell", "primary_nav", "secondary_nav", "utility_nav", "footer", "global_search", "notifications", "account_menu", "workspace_switcher", "windowing"].includes(key || "")) {
      pushError(errors, `Projection ${statement.id} ui_app_shell has unknown key '${key}'`, entry.loc);
      continue;
    }
    if (!value) {
      pushError(errors, `Projection ${statement.id} ui_app_shell is missing a value for '${key}'`, entry.loc);
      continue;
    }
    if (extra) {
      pushError(errors, `Projection ${statement.id} ui_app_shell '${key}' accepts exactly one value`, entry.loc);
    }
    if (seenKeys.has(key)) {
      pushError(errors, `Projection ${statement.id} ui_app_shell has duplicate key '${key}'`, entry.loc);
    }
    seenKeys.add(key);

    if (key === "shell" && !UI_APP_SHELL_KINDS.has(value)) {
      pushError(errors, `Projection ${statement.id} ui_app_shell has invalid shell '${value}'`, entry.loc);
    }
    if (["global_search", "notifications", "account_menu", "workspace_switcher"].includes(key) && !["true", "false"].includes(value)) {
      pushError(errors, `Projection ${statement.id} ui_app_shell '${key}' must be true or false`, entry.loc);
    }
    if (key === "windowing" && !UI_WINDOWING_MODES.has(value)) {
      pushError(errors, `Projection ${statement.id} ui_app_shell has invalid windowing '${value}'`, entry.loc);
    }
  }
}

function validateProjectionUiDesign(errors, statement, fieldMap) {
  if (statement.kind !== "projection") {
    return;
  }

  const designField = fieldMap.get("ui_design")?.[0];
  if (!designField || designField.value.type !== "block") {
    return;
  }

  if (symbolValue(getFieldValue(statement, "platform")) !== "ui_shared") {
    pushError(errors, `Projection ${statement.id} ui_design belongs on shared UI projections; concrete UI projections inherit semantic design intent through 'realizes'`, designField.loc);
  }

  for (const entry of designField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [key, value, extra] = tokens;

    if (key === "density") {
      if (!UI_DESIGN_DENSITIES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ui_design density has invalid value '${value}'`, entry.loc);
      }
      if (tokens.length !== 2) {
        pushError(errors, `Projection ${statement.id} ui_design density accepts exactly one value`, entry.loc);
      }
      continue;
    }

    if (key === "tone") {
      if (!UI_DESIGN_TONES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ui_design tone has invalid value '${value}'`, entry.loc);
      }
      if (tokens.length !== 2) {
        pushError(errors, `Projection ${statement.id} ui_design tone accepts exactly one value`, entry.loc);
      }
      continue;
    }

    if (key === "radius_scale") {
      if (!UI_DESIGN_RADIUS_SCALES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ui_design radius_scale has invalid value '${value}'`, entry.loc);
      }
      if (tokens.length !== 2) {
        pushError(errors, `Projection ${statement.id} ui_design radius_scale accepts exactly one value`, entry.loc);
      }
      continue;
    }

    if (key === "color_role") {
      if (!UI_DESIGN_COLOR_ROLES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ui_design color_role has invalid role '${value}'`, entry.loc);
      }
      if (tokens.length !== 3) {
        pushError(errors, `Projection ${statement.id} ui_design color_role must use 'color_role <role> <semantic-token>'`, entry.loc);
      }
      continue;
    }

    if (key === "typography_role") {
      if (!UI_DESIGN_TYPOGRAPHY_ROLES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ui_design typography_role has invalid role '${value}'`, entry.loc);
      }
      if (tokens.length !== 3) {
        pushError(errors, `Projection ${statement.id} ui_design typography_role must use 'typography_role <role> <semantic-token>'`, entry.loc);
      }
      continue;
    }

    if (key === "action_role") {
      if (!UI_DESIGN_ACTION_ROLES.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ui_design action_role has invalid role '${value}'`, entry.loc);
      }
      if (tokens.length !== 3) {
        pushError(errors, `Projection ${statement.id} ui_design action_role must use 'action_role <role> <semantic-token>'`, entry.loc);
      }
      continue;
    }

    if (key === "accessibility") {
      const values = UI_DESIGN_ACCESSIBILITY_VALUES[value];
      if (tokens.length !== 3) {
        pushError(errors, `Projection ${statement.id} ui_design accessibility must use 'accessibility <setting> <value>'`, entry.loc);
      }
      if (!values) {
        pushError(errors, `Projection ${statement.id} ui_design accessibility has invalid setting '${value}'`, entry.loc);
      } else if (!values.has(extra || "")) {
        pushError(errors, `Projection ${statement.id} ui_design accessibility '${value}' has invalid value '${extra}'`, entry.loc);
      }
      continue;
    }

    pushError(errors, `Projection ${statement.id} ui_design has unknown key '${key}'`, entry.loc);
  }
}

function validateProjectionUiNavigation(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const navigationField = fieldMap.get("ui_navigation")?.[0];
  if (!navigationField || navigationField.value.type !== "block") {
    return;
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  const groups = new Set();

  for (const entry of navigationField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [targetKind, targetId] = tokens;

    if (targetKind === "group") {
      if (!targetId || !IDENTIFIER_PATTERN.test(targetId)) {
        pushError(errors, `Projection ${statement.id} ui_navigation group entries must include a valid group id`, entry.loc);
        continue;
      }
      groups.add(targetId);
      const directives = parseUiDirectiveMap(tokens, 2, errors, statement, entry, `ui_navigation group '${targetId}'`);
      for (const key of directives.keys()) {
        if (!["label", "placement", "icon", "order", "pattern"].includes(key)) {
          pushError(errors, `Projection ${statement.id} ui_navigation group '${targetId}' has unknown directive '${key}'`, entry.loc);
        }
      }
      if (directives.has("placement") && !["primary", "secondary", "utility"].includes(directives.get("placement"))) {
        pushError(errors, `Projection ${statement.id} ui_navigation group '${targetId}' has invalid placement '${directives.get("placement")}'`, entry.loc);
      }
      if (directives.has("pattern") && !UI_NAVIGATION_PATTERNS.has(directives.get("pattern"))) {
        pushError(errors, `Projection ${statement.id} ui_navigation group '${targetId}' has invalid pattern '${directives.get("pattern")}'`, entry.loc);
      }
      continue;
    }

    if (targetKind === "screen") {
      if (!availableScreens.has(targetId)) {
        pushError(errors, `Projection ${statement.id} ui_navigation references unknown screen '${targetId}'`, entry.loc);
      }
      const directives = parseUiDirectiveMap(tokens, 2, errors, statement, entry, `ui_navigation screen '${targetId}'`);
      for (const key of directives.keys()) {
        if (!["group", "label", "order", "visible", "default", "breadcrumb", "sitemap", "placement", "pattern"].includes(key)) {
          pushError(errors, `Projection ${statement.id} ui_navigation screen '${targetId}' has unknown directive '${key}'`, entry.loc);
        }
      }
      if (directives.has("visible") && !["true", "false"].includes(directives.get("visible"))) {
        pushError(errors, `Projection ${statement.id} ui_navigation screen '${targetId}' has invalid visible '${directives.get("visible")}'`, entry.loc);
      }
      if (directives.has("default") && !["true", "false"].includes(directives.get("default"))) {
        pushError(errors, `Projection ${statement.id} ui_navigation screen '${targetId}' has invalid default '${directives.get("default")}'`, entry.loc);
      }
      if (directives.has("placement") && !["primary", "secondary", "utility"].includes(directives.get("placement"))) {
        pushError(errors, `Projection ${statement.id} ui_navigation screen '${targetId}' has invalid placement '${directives.get("placement")}'`, entry.loc);
      }
      if (directives.has("sitemap") && !["include", "exclude"].includes(directives.get("sitemap"))) {
        pushError(errors, `Projection ${statement.id} ui_navigation screen '${targetId}' has invalid sitemap '${directives.get("sitemap")}'`, entry.loc);
      }
      if (directives.has("pattern") && !UI_NAVIGATION_PATTERNS.has(directives.get("pattern"))) {
        pushError(errors, `Projection ${statement.id} ui_navigation screen '${targetId}' has invalid pattern '${directives.get("pattern")}'`, entry.loc);
      }
      const breadcrumb = directives.get("breadcrumb");
      if (breadcrumb && breadcrumb !== "none" && !availableScreens.has(breadcrumb)) {
        pushError(errors, `Projection ${statement.id} ui_navigation screen '${targetId}' references unknown breadcrumb screen '${breadcrumb}'`, entry.loc);
      }
      continue;
    }

    pushError(errors, `Projection ${statement.id} ui_navigation entries must start with 'group' or 'screen'`, entry.loc);
  }

  for (const entry of navigationField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    if (tokens[0] !== "screen") {
      continue;
    }
    const directives = parseUiDirectiveMap(tokens, 2, [], statement, entry, "");
    if (directives.has("group") && !groups.has(directives.get("group"))) {
      pushError(errors, `Projection ${statement.id} ui_navigation screen '${tokens[1]}' references unknown group '${directives.get("group")}'`, entry.loc);
    }
  }
}

function validateProjectionUiScreenRegions(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const regionField = fieldMap.get("ui_screen_regions")?.[0];
  if (!regionField || regionField.value.type !== "block") {
    return;
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  for (const entry of regionField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, regionKeyword, regionName] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} ui_screen_regions entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!availableScreens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} ui_screen_regions references unknown screen '${screenId}'`, entry.loc);
    }
    if (regionKeyword !== "region") {
      pushError(errors, `Projection ${statement.id} ui_screen_regions for '${screenId}' must use 'region'`, entry.loc);
    }
    if (!UI_REGION_KINDS.has(regionName || "")) {
      pushError(errors, `Projection ${statement.id} ui_screen_regions for '${screenId}' has invalid region '${regionName}'`, entry.loc);
    }

    const directives = parseUiDirectiveMap(tokens, 4, errors, statement, entry, `ui_screen_regions for '${screenId}'`);
    for (const key of directives.keys()) {
      if (!["pattern", "placement", "title", "state", "variant"].includes(key)) {
        pushError(errors, `Projection ${statement.id} ui_screen_regions for '${screenId}' has unknown directive '${key}'`, entry.loc);
      }
    }
    if (directives.has("pattern") && !UI_PATTERN_KINDS.has(directives.get("pattern"))) {
      pushError(errors, `Projection ${statement.id} ui_screen_regions for '${screenId}' has invalid pattern '${directives.get("pattern")}'`, entry.loc);
    }
    if (directives.has("placement") && !["primary", "secondary", "supporting"].includes(directives.get("placement"))) {
      pushError(errors, `Projection ${statement.id} ui_screen_regions for '${screenId}' has invalid placement '${directives.get("placement")}'`, entry.loc);
    }
    if (directives.has("state") && !UI_STATE_KINDS.has(directives.get("state"))) {
      pushError(errors, `Projection ${statement.id} ui_screen_regions for '${screenId}' has invalid state '${directives.get("state")}'`, entry.loc);
    }
  }
}

function validateProjectionUiComponents(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const componentsField = fieldMap.get("ui_components")?.[0];
  if (!componentsField || componentsField.value.type !== "block") {
    return;
  }

  if (symbolValue(getFieldValue(statement, "platform")) !== "ui_shared") {
    pushError(errors, `Projection ${statement.id} ui_components belongs on shared UI projections; concrete UI projections inherit component placement through 'realizes'`, componentsField.loc);
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  const availableRegions = collectAvailableUiRegionKeys(statement, registry);
  const availableRegionPatterns = collectAvailableUiRegionPatterns(statement, registry);

  for (const entry of componentsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [screenKeyword, screenId, regionKeyword, regionName, componentKeyword, componentId] = tokens;

    if (screenKeyword !== "screen") {
      pushError(errors, `Projection ${statement.id} ui_components entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!availableScreens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} ui_components references unknown screen '${screenId}'`, entry.loc);
    }
    if (regionKeyword !== "region") {
      pushError(errors, `Projection ${statement.id} ui_components for '${screenId}' must use 'region'`, entry.loc);
    }
    if (!UI_REGION_KINDS.has(regionName || "")) {
      pushError(errors, `Projection ${statement.id} ui_components for '${screenId}' has invalid region '${regionName}'`, entry.loc);
    } else if (!availableRegions.has(`${screenId}:${regionName}`)) {
      pushError(errors, `Projection ${statement.id} ui_components for '${screenId}' references undeclared region '${regionName}'`, entry.loc);
    }
    if (componentKeyword !== "component") {
      pushError(errors, `Projection ${statement.id} ui_components for '${screenId}' must use 'component'`, entry.loc);
    }

    const component = registry.get(componentId);
    if (!component) {
      pushError(errors, `Projection ${statement.id} ui_components references missing component '${componentId}'`, entry.loc);
      continue;
    }
    if (component.kind !== "component") {
      pushError(errors, `Projection ${statement.id} ui_components must reference a component, found ${component.kind} '${component.id}'`, entry.loc);
      continue;
    }

    const propNames = new Set(blockEntries(getFieldValue(component, "props"))
      .map((propEntry) => propEntry.items[0])
      .filter((item) => item?.type === "symbol")
      .map((item) => item.value));
    const eventNames = new Set(blockEntries(getFieldValue(component, "events"))
      .map((eventEntry) => eventEntry.items[0])
      .filter((item) => item?.type === "symbol")
      .map((item) => item.value));
    const componentRegions = symbolValues(getFieldValue(component, "regions"));
    const componentPatterns = symbolValues(getFieldValue(component, "patterns"));
    if (componentRegions.length > 0 && !componentRegions.includes(regionName)) {
      pushError(
        errors,
        `Projection ${statement.id} ui_components uses component '${componentId}' in region '${regionName}', but the component supports regions [${componentRegions.join(", ")}]`,
        entry.loc
      );
    }
    const regionPattern = availableRegionPatterns.get(`${screenId}:${regionName}`) || null;
    if (regionPattern && componentPatterns.length > 0 && !componentPatterns.includes(regionPattern)) {
      pushError(
        errors,
        `Projection ${statement.id} ui_components uses component '${componentId}' in '${screenId}:${regionName}' with pattern '${regionPattern}', but the component supports patterns [${componentPatterns.join(", ")}]`,
        entry.loc
      );
    }

    for (let i = 6; i < tokens.length;) {
      const directive = tokens[i];
      if (directive === "data") {
        const propName = tokens[i + 1];
        const fromKeyword = tokens[i + 2];
        const sourceId = tokens[i + 3];
        if (!propName || fromKeyword !== "from" || !sourceId) {
          pushError(errors, `Projection ${statement.id} ui_components data bindings must use 'data <prop> from <source>'`, entry.loc);
          break;
        }
        if (!propNames.has(propName)) {
          pushError(errors, `Projection ${statement.id} ui_components references unknown prop '${propName}' on component '${componentId}'`, entry.loc);
        }
        const source = registry.get(sourceId);
        if (!source || !["capability", "projection", "shape", "entity"].includes(source.kind)) {
          pushError(errors, `Projection ${statement.id} ui_components data binding for '${propName}' references missing source '${sourceId}'`, entry.loc);
        }
        i += 4;
        continue;
      }

      if (directive === "event") {
        const eventName = tokens[i + 1];
        const action = tokens[i + 2];
        const targetId = tokens[i + 3];
        if (!eventName || !action || !targetId) {
          pushError(errors, `Projection ${statement.id} ui_components event bindings must use 'event <event> <navigate|action> <target>'`, entry.loc);
          break;
        }
        if (!eventNames.has(eventName)) {
          pushError(errors, `Projection ${statement.id} ui_components references unknown event '${eventName}' on component '${componentId}'`, entry.loc);
        }
        if (action === "navigate") {
          if (!availableScreens.has(targetId)) {
            pushError(errors, `Projection ${statement.id} ui_components event '${eventName}' references unknown navigation target '${targetId}'`, entry.loc);
          }
        } else if (action === "action") {
          const target = registry.get(targetId);
          if (!target || target.kind !== "capability") {
            pushError(errors, `Projection ${statement.id} ui_components event '${eventName}' references missing capability action '${targetId}'`, entry.loc);
          }
        } else {
          pushError(errors, `Projection ${statement.id} ui_components event '${eventName}' has unsupported action '${action}'`, entry.loc);
        }
        i += 4;
        continue;
      }

      pushError(errors, `Projection ${statement.id} ui_components has unknown directive '${directive}'`, entry.loc);
      break;
    }
  }
}

function validateProjectionUiVisibility(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const visibilityField = fieldMap.get("ui_visibility")?.[0];
  if (!visibilityField || visibilityField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of visibilityField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, capabilityId, predicateKeyword, predicateType, predicateValue] = tokens;

    if (keyword !== "action") {
      pushError(errors, `Projection ${statement.id} ui_visibility entries must start with 'action'`, entry.loc);
      continue;
    }

    const capability = registry.get(capabilityId);
    if (!capability) {
      pushError(errors, `Projection ${statement.id} ui_visibility references missing capability '${capabilityId}'`, entry.loc);
    } else if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} ui_visibility must reference a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    } else if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} ui_visibility action '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    if (predicateKeyword !== "visible_if") {
      pushError(errors, `Projection ${statement.id} ui_visibility for '${capabilityId}' must use 'visible_if'`, entry.loc);
    }
    if (!["permission", "ownership", "claim"].includes(predicateType || "")) {
      pushError(errors, `Projection ${statement.id} ui_visibility for '${capabilityId}' has invalid predicate '${predicateType}'`, entry.loc);
    }
    if (!predicateValue) {
      pushError(errors, `Projection ${statement.id} ui_visibility for '${capabilityId}' must include a predicate value`, entry.loc);
    }
    if (predicateType === "ownership" && !["owner", "owner_or_admin", "project_member", "none"].includes(predicateValue || "")) {
      pushError(errors, `Projection ${statement.id} ui_visibility for '${capabilityId}' has invalid ownership '${predicateValue}'`, entry.loc);
    }
    const directiveTokens = blockSymbolItems(entry).map((item) => item.value);
    const directives = new Map();
    for (let i = 5; i < directiveTokens.length; i += 2) {
      const key = directiveTokens[i];
      const value = directiveTokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} ui_visibility for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }
    for (const key of directives.keys()) {
      if (!["claim_value"].includes(key)) {
        pushError(errors, `Projection ${statement.id} ui_visibility for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }
    if (directives.get("claim_value") && predicateType !== "claim") {
      pushError(errors, `Projection ${statement.id} ui_visibility for '${capabilityId}' cannot declare claim_value without claim`, entry.loc);
    }
  }
}

function validateProjectionUiLookups(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const lookupsField = fieldMap.get("ui_lookups")?.[0];
  if (!lookupsField || lookupsField.value.type !== "block") {
    return;
  }

  const screens = collectProjectionUiScreens(statement, fieldMap);

  for (const entry of lookupsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, fieldKeyword, fieldName, entityKeyword, entityId, labelKeyword, labelField, maybeEmptyKeyword, maybeEmptyLabel] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} ui_lookups entries must start with 'screen'`, entry.loc);
      continue;
    }

    const screenEntry = screens.get(screenId);
    if (!screenEntry) {
      pushError(errors, `Projection ${statement.id} ui_lookups references unknown screen '${screenId}'`, entry.loc);
      continue;
    }

    if (fieldKeyword !== "field") {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' must use 'field'`, entry.loc);
    }
    if (!fieldName) {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' must include a field name`, entry.loc);
    }

    if (entityKeyword !== "entity") {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' must use 'entity'`, entry.loc);
    }
    const entity = entityId ? registry.get(entityId) : null;
    if (!entity) {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' references missing entity '${entityId}'`, entry.loc);
    } else if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' must reference an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }

    if (labelKeyword !== "label_field") {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' must use 'label_field'`, entry.loc);
    }
    if (!labelField) {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' must include a label_field`, entry.loc);
    }

    if (maybeEmptyKeyword && maybeEmptyKeyword !== "empty_label") {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' has unknown directive '${maybeEmptyKeyword}'`, entry.loc);
    }
    if (maybeEmptyKeyword === "empty_label" && !maybeEmptyLabel) {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' must include a value for 'empty_label'`, entry.loc);
    }

    const availableFields = resolveProjectionUiScreenFieldNames(registry, screenEntry, statement);
    if (fieldName && availableFields.size > 0 && !availableFields.has(fieldName)) {
      pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' references unknown screen field '${fieldName}'`, entry.loc);
    }

    if (entity?.kind === "entity") {
      const entityFieldNames = new Set(statementFieldNames(entity));
      if (labelField && !entityFieldNames.has(labelField)) {
        pushError(errors, `Projection ${statement.id} ui_lookups for '${screenId}' references unknown entity field '${labelField}' on '${entity.id}'`, entry.loc);
      }
    }
  }
}

function validateProjectionUiRoutes(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const routesField = fieldMap.get("ui_routes")?.[0];
  if (!routesField || routesField.value.type !== "block") {
    return;
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  const seenPaths = new Set();
  const platform = symbolValue(getFieldValue(statement, "platform"));

  for (const entry of routesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [keyword, screenId, pathKeyword, routePath] = tokens;

    if (keyword !== "screen") {
      pushError(errors, `Projection ${statement.id} ui_routes entries must start with 'screen'`, entry.loc);
      continue;
    }
    if (!availableScreens.has(screenId)) {
      pushError(errors, `Projection ${statement.id} ui_routes references unknown screen '${screenId}'`, entry.loc);
    }
    if (pathKeyword !== "path") {
      pushError(errors, `Projection ${statement.id} ui_routes for '${screenId}' must use 'path'`, entry.loc);
    }
    if (!routePath) {
      pushError(errors, `Projection ${statement.id} ui_routes for '${screenId}' must include a path`, entry.loc);
      continue;
    }
    if ((platform === "ui_web" || platform === "ui_ios") && !routePath.startsWith("/")) {
      pushError(errors, `Projection ${statement.id} ui_routes for '${screenId}' must use an absolute path`, entry.loc);
    }
    if (seenPaths.has(routePath)) {
      pushError(errors, `Projection ${statement.id} ui_routes has duplicate path '${routePath}'`, entry.loc);
    }
    seenPaths.add(routePath);
  }
}

function validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, surfaceBlockKey, expectedPlatform) {
  if (statement.kind !== "projection") {
    return;
  }

  const surfaceField = fieldMap.get(surfaceBlockKey)?.[0];
  if (!surfaceField || surfaceField.value.type !== "block") {
    return;
  }

  const platform = symbolValue(getFieldValue(statement, "platform"));
  if (platform !== expectedPlatform) {
    pushError(errors, `Projection ${statement.id} may only use '${surfaceBlockKey}' when platform is '${expectedPlatform}'`, surfaceField.loc);
    return;
  }

  const availableScreens = collectAvailableUiScreenIds(statement, fieldMap, registry);
  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of surfaceField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [targetKind, targetId, directive, value] = tokens;

    if (targetKind === "screen") {
      if (!availableScreens.has(targetId)) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} references unknown screen '${targetId}'`, entry.loc);
      }
      if (!["layout", "desktop_variant", "mobile_variant", "present", "shell", "collection", "breadcrumbs", "state_style"].includes(directive || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has unknown directive '${directive}'`, entry.loc);
      }
      if (directive === "desktop_variant" && !UI_COLLECTION_PRESENTATIONS.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid desktop_variant '${value}'`, entry.loc);
      }
      if (directive === "mobile_variant" && !UI_COLLECTION_PRESENTATIONS.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid mobile_variant '${value}'`, entry.loc);
      }
      if (directive === "collection" && !UI_COLLECTION_PRESENTATIONS.has(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid collection '${value}'`, entry.loc);
      }
      if (directive === "shell" && !["topbar", "sidebar", "dual_nav", "workspace", "wizard", "bottom_tabs", "split_view", "menu_bar"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid shell '${value}'`, entry.loc);
      }
      if (directive === "present" && !["page", "modal", "drawer", "sheet", "bottom_sheet", "popover"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid present '${value}'`, entry.loc);
      }
      if (directive === "breadcrumbs" && !["visible", "hidden"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid breadcrumbs '${value}'`, entry.loc);
      }
      if (directive === "state_style" && !["inline", "panel", "full_page"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for screen '${targetId}' has invalid state_style '${value}'`, entry.loc);
      }
      continue;
    }

    if (targetKind === "action") {
      const capability = registry.get(targetId);
      if (!capability) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} references missing capability '${targetId}'`, entry.loc);
      } else if (capability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} must reference a capability for action '${targetId}', found ${capability.kind} '${capability.id}'`, entry.loc);
      } else if (!realized.has(targetId)) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} action '${targetId}' must also appear in 'realizes'`, entry.loc);
      }
      if (!["confirm", "present", "placement"].includes(directive || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for action '${targetId}' has unknown directive '${directive}'`, entry.loc);
      }
      if (directive === "confirm" && !["modal", "inline", "sheet", "bottom_sheet", "popover"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for action '${targetId}' has invalid confirm mode '${value}'`, entry.loc);
      }
      if (directive === "present" && !["button", "menu_item", "split_button", "bulk_action", "drawer", "sheet", "bottom_sheet", "fab", "popover"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for action '${targetId}' has invalid present mode '${value}'`, entry.loc);
      }
      if (directive === "placement" && !["toolbar", "menu", "bulk", "inline", "footer"].includes(value || "")) {
        pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} for action '${targetId}' has invalid placement '${value}'`, entry.loc);
      }
      continue;
    }

    pushError(errors, `Projection ${statement.id} ${surfaceBlockKey} entries must start with 'screen' or 'action'`, entry.loc);
  }
}

function validateProjectionUiWeb(errors, statement, fieldMap, registry) {
  validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, "ui_web", "ui_web");
}

function validateProjectionUiIos(errors, statement, fieldMap, registry) {
  validateProjectionUiSurfaceHints(errors, statement, fieldMap, registry, "ui_ios", "ui_ios");
}

function validateProjectionGeneratorDefaults(errors, statement, fieldMap) {
  if (statement.kind !== "projection") {
    return;
  }

  const generatorField = fieldMap.get("generator_defaults")?.[0];
  if (!generatorField || generatorField.value.type !== "block") {
    return;
  }

  for (const entry of generatorField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [key, value] = tokens;
    if (!["profile", "language", "styling"].includes(key || "")) {
      pushError(errors, `Projection ${statement.id} generator_defaults has unknown key '${key}'`, entry.loc);
      continue;
    }
    if (!value) {
      pushError(errors, `Projection ${statement.id} generator_defaults is missing a value for '${key}'`, entry.loc);
      continue;
    }
    if (key === "profile" && !["vanilla", "sveltekit", "react", "swiftui", "postgres_sql", "sqlite_sql", "prisma", "drizzle"].includes(value)) {
      pushError(errors, `Projection ${statement.id} generator_defaults has unsupported profile '${value}'`, entry.loc);
    }
    if (key === "language" && !["typescript", "javascript", "swift", "sql"].includes(value)) {
      pushError(errors, `Projection ${statement.id} generator_defaults has unsupported language '${value}'`, entry.loc);
    }
    if (key === "styling" && !["tailwind", "css"].includes(value)) {
      pushError(errors, `Projection ${statement.id} generator_defaults has unsupported styling '${value}'`, entry.loc);
    }
  }
}

function validateProjectionDbTables(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbTablesField = fieldMap.get("db_tables")?.[0];
  if (!dbTablesField || dbTablesField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const seenTables = new Set();
  for (const entry of dbTablesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, tableKeyword, tableName] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} db_tables references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} db_tables must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} db_tables entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (tableKeyword !== "table") {
      pushError(errors, `Projection ${statement.id} db_tables for '${entityId}' must use 'table'`, entry.loc);
    }
    if (!tableName) {
      pushError(errors, `Projection ${statement.id} db_tables for '${entityId}' must include a table name`, entry.loc);
    } else if (seenTables.has(tableName)) {
      pushError(errors, `Projection ${statement.id} db_tables has duplicate table name '${tableName}'`, entry.loc);
    }
    seenTables.add(tableName);
  }
}

function validateProjectionDbColumns(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbColumnsField = fieldMap.get("db_columns")?.[0];
  if (!dbColumnsField || dbColumnsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbColumnsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, fieldKeyword, fieldName, columnKeyword, columnName] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} db_columns references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} db_columns must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} db_columns entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (fieldKeyword !== "field") {
      pushError(errors, `Projection ${statement.id} db_columns for '${entityId}' must use 'field'`, entry.loc);
    }
    if (columnKeyword !== "column") {
      pushError(errors, `Projection ${statement.id} db_columns for '${entityId}' must use 'column'`, entry.loc);
    }
    const entityFieldNames = new Set(statementFieldNames(entity));
    if (fieldName && entityFieldNames.size > 0 && !entityFieldNames.has(fieldName)) {
      pushError(errors, `Projection ${statement.id} db_columns references unknown field '${fieldName}' on ${entityId}`, entry.loc);
    }
    if (!columnName) {
      pushError(errors, `Projection ${statement.id} db_columns for '${entityId}.${fieldName}' must include a column name`, entry.loc);
    }
  }
}

function validateProjectionDbKeys(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbKeysField = fieldMap.get("db_keys")?.[0];
  if (!dbKeysField || dbKeysField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbKeysField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, keyType] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} db_keys references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} db_keys must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} db_keys entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (!["primary", "unique"].includes(keyType || "")) {
      pushError(errors, `Projection ${statement.id} db_keys for '${entityId}' has invalid key type '${keyType}'`, entry.loc);
    }
    const fieldList = entry.items[2];
    if (!fieldList || fieldList.type !== "list" || fieldList.items.length === 0) {
      pushError(errors, `Projection ${statement.id} db_keys for '${entityId}' must include a non-empty field list`, entry.loc);
      continue;
    }
    const entityFieldNames = new Set(statementFieldNames(entity));
    for (const item of fieldList.items) {
      if (item.type === "symbol" && entityFieldNames.size > 0 && !entityFieldNames.has(item.value)) {
        pushError(errors, `Projection ${statement.id} db_keys references unknown field '${item.value}' on ${entityId}`, item.loc);
      }
    }
  }
}

function validateProjectionDbIndexes(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbIndexesField = fieldMap.get("db_indexes")?.[0];
  if (!dbIndexesField || dbIndexesField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbIndexesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, indexType] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} db_indexes references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} db_indexes must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} db_indexes entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (!["index", "unique"].includes(indexType || "")) {
      pushError(errors, `Projection ${statement.id} db_indexes for '${entityId}' has invalid index type '${indexType}'`, entry.loc);
    }
    const fieldList = entry.items[2];
    if (!fieldList || fieldList.type !== "list" || fieldList.items.length === 0) {
      pushError(errors, `Projection ${statement.id} db_indexes for '${entityId}' must include a non-empty field list`, entry.loc);
      continue;
    }
    const entityFieldNames = new Set(statementFieldNames(entity));
    for (const item of fieldList.items) {
      if (item.type === "symbol" && entityFieldNames.size > 0 && !entityFieldNames.has(item.value)) {
        pushError(errors, `Projection ${statement.id} db_indexes references unknown field '${item.value}' on ${entityId}`, item.loc);
      }
    }
  }
}

function validateProjectionDbRelations(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbRelationsField = fieldMap.get("db_relations")?.[0];
  if (!dbRelationsField || dbRelationsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbRelationsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, relationType, fieldName, referencesKeyword, targetRef, onDeleteKeyword, onDeleteValue] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} db_relations references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} db_relations must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} db_relations entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (relationType !== "foreign_key") {
      pushError(errors, `Projection ${statement.id} db_relations for '${entityId}' must use 'foreign_key'`, entry.loc);
    }
    if (referencesKeyword !== "references") {
      pushError(errors, `Projection ${statement.id} db_relations for '${entityId}' must use 'references'`, entry.loc);
    }
    if (onDeleteKeyword && onDeleteKeyword !== "on_delete") {
      pushError(errors, `Projection ${statement.id} db_relations for '${entityId}' has unexpected token '${onDeleteKeyword}'`, entry.loc);
    }
    if (onDeleteValue && !["cascade", "restrict", "set_null", "no_action"].includes(onDeleteValue)) {
      pushError(errors, `Projection ${statement.id} db_relations for '${entityId}' has invalid on_delete '${onDeleteValue}'`, entry.loc);
    }
    const entityFieldNames = new Set(statementFieldNames(entity));
    if (fieldName && entityFieldNames.size > 0 && !entityFieldNames.has(fieldName)) {
      pushError(errors, `Projection ${statement.id} db_relations references unknown field '${fieldName}' on ${entityId}`, entry.loc);
    }
    const [targetEntityId, targetFieldName] = (targetRef || "").split(".");
    const targetEntity = registry.get(targetEntityId);
    if (!targetEntity) {
      pushError(errors, `Projection ${statement.id} db_relations references missing target entity '${targetEntityId}'`, entry.loc);
      continue;
    }
    if (targetEntity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} db_relations must reference an entity target, found ${targetEntity.kind} '${targetEntity.id}'`, entry.loc);
    }
    const targetFieldNames = new Set(statementFieldNames(targetEntity));
    if (targetFieldName && targetFieldNames.size > 0 && !targetFieldNames.has(targetFieldName)) {
      pushError(errors, `Projection ${statement.id} db_relations references unknown target field '${targetFieldName}' on ${targetEntityId}`, entry.loc);
    }
  }
}

function validateProjectionDbLifecycle(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const dbLifecycleField = fieldMap.get("db_lifecycle")?.[0];
  if (!dbLifecycleField || dbLifecycleField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of dbLifecycleField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [entityId, lifecycleType] = tokens;
    const entity = registry.get(entityId);

    if (!entity) {
      pushError(errors, `Projection ${statement.id} db_lifecycle references missing entity '${entityId}'`, entry.loc);
      continue;
    }
    if (entity.kind !== "entity") {
      pushError(errors, `Projection ${statement.id} db_lifecycle must target an entity, found ${entity.kind} '${entity.id}'`, entry.loc);
    }
    if (!realized.has(entityId)) {
      pushError(errors, `Projection ${statement.id} db_lifecycle entity '${entityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = parseUiDirectiveMap(tokens, 2, errors, statement, entry, `db_lifecycle for '${entityId}'`);
    if (!["soft_delete", "timestamps"].includes(lifecycleType || "")) {
      pushError(errors, `Projection ${statement.id} db_lifecycle for '${entityId}' has invalid lifecycle '${lifecycleType}'`, entry.loc);
      continue;
    }

    const entityFieldNames = new Set(statementFieldNames(entity));
    if (lifecycleType === "soft_delete") {
      for (const requiredKey of ["field", "value"]) {
        if (!directives.has(requiredKey)) {
          pushError(errors, `Projection ${statement.id} db_lifecycle for '${entityId}' must include '${requiredKey}' for soft_delete`, entry.loc);
        }
      }
      const fieldName = directives.get("field");
      if (fieldName && entityFieldNames.size > 0 && !entityFieldNames.has(fieldName)) {
        pushError(errors, `Projection ${statement.id} db_lifecycle references unknown field '${fieldName}' on ${entityId}`, entry.loc);
      }
    }

    if (lifecycleType === "timestamps") {
      for (const requiredKey of ["created_at", "updated_at"]) {
        if (!directives.has(requiredKey)) {
          pushError(errors, `Projection ${statement.id} db_lifecycle for '${entityId}' must include '${requiredKey}' for timestamps`, entry.loc);
        }
        const fieldName = directives.get(requiredKey);
        if (fieldName && entityFieldNames.size > 0 && !entityFieldNames.has(fieldName)) {
          pushError(errors, `Projection ${statement.id} db_lifecycle references unknown field '${fieldName}' on ${entityId}`, entry.loc);
        }
      }
    }
  }
}

export function buildRegistry(workspaceAst, errors) {
  const registry = new Map();

  for (const file of workspaceAst.files) {
    for (const statement of file.statements) {
      if (!STATEMENT_KINDS.has(statement.kind)) {
        pushError(errors, `Unknown statement kind '${statement.kind}'`, statement.loc);
      }

      if (!IDENTIFIER_PATTERN.test(statement.id)) {
        pushError(errors, `Invalid identifier '${statement.id}'`, statement.loc);
      }

      if (registry.has(statement.id)) {
        pushError(errors, `Duplicate statement id '${statement.id}'`, statement.loc);
        continue;
      }

      registry.set(statement.id, statement);
    }
  }

  return registry;
}

function validateDocs(workspaceAst, registry, errors) {
  const docs = workspaceAst.docs || [];
  const docRegistry = new Map();

  for (const doc of docs) {
    if (doc.parseError) {
      pushError(errors, doc.parseError.message, doc.parseError.loc);
      continue;
    }

    const { metadata } = doc;
    for (const required of ["id", "kind", "title", "status"]) {
      if (!metadata[required]) {
        pushError(errors, `Missing required doc metadata '${required}'`, doc.loc);
      }
    }

    if (metadata.id && !IDENTIFIER_PATTERN.test(metadata.id)) {
      pushError(errors, `Invalid doc identifier '${metadata.id}'`, doc.loc);
    }

    if (metadata.kind && !DOC_KINDS.has(metadata.kind)) {
      pushError(errors, `Unsupported doc kind '${metadata.kind}'`, doc.loc);
    }

    if (metadata.status && !DOC_STATUSES.has(metadata.status)) {
      pushError(errors, `Unsupported doc status '${metadata.status}'`, doc.loc);
    }

    if (metadata.confidence && !DOC_CONFIDENCE.has(metadata.confidence)) {
      pushError(errors, `Unsupported doc confidence '${metadata.confidence}'`, doc.loc);
    }

    if (metadata.review_required != null && typeof metadata.review_required !== "boolean") {
      pushError(errors, "Doc metadata 'review_required' must be a boolean", doc.loc);
    }

    for (const key of DOC_ARRAY_FIELDS) {
      if (metadata[key] != null && !Array.isArray(metadata[key])) {
        pushError(errors, `Doc metadata '${key}' must be a list`, doc.loc);
      }
    }

    if (metadata.id) {
      if (docRegistry.has(metadata.id)) {
        pushError(errors, `Duplicate doc id '${metadata.id}'`, doc.loc);
      } else {
        docRegistry.set(metadata.id, doc);
      }
    }
  }

  for (const doc of docs) {
    if (doc.parseError) {
      continue;
    }
    const { metadata } = doc;

    for (const entityId of metadata.related_entities || []) {
      const statement = registry.get(entityId);
      if (!statement || statement.kind !== "entity") {
        pushError(errors, `Doc '${metadata.id}' references missing entity '${entityId}'`, doc.loc);
      }
    }

    for (const capabilityId of metadata.related_capabilities || []) {
      const statement = registry.get(capabilityId);
      if (!statement || statement.kind !== "capability") {
        pushError(errors, `Doc '${metadata.id}' references missing capability '${capabilityId}'`, doc.loc);
      }
    }

    for (const actorId of metadata.related_actors || []) {
      const statement = registry.get(actorId);
      if (!statement || statement.kind !== "actor") {
        pushError(errors, `Doc '${metadata.id}' references missing actor '${actorId}'`, doc.loc);
      }
    }

    for (const roleId of metadata.related_roles || []) {
      const statement = registry.get(roleId);
      if (!statement || statement.kind !== "role") {
        pushError(errors, `Doc '${metadata.id}' references missing role '${roleId}'`, doc.loc);
      }
    }

    for (const ruleId of metadata.related_rules || []) {
      const statement = registry.get(ruleId);
      if (!statement || statement.kind !== "rule") {
        pushError(errors, `Doc '${metadata.id}' references missing rule '${ruleId}'`, doc.loc);
      }
    }

    for (const workflowDocId of metadata.related_workflows || []) {
      const relatedDoc = docRegistry.get(workflowDocId);
      if (!relatedDoc || relatedDoc.metadata.kind !== "workflow") {
        pushError(errors, `Doc '${metadata.id}' references missing workflow doc '${workflowDocId}'`, doc.loc);
      }
    }

    for (const decisionId of metadata.related_decisions || []) {
      const statement = registry.get(decisionId);
      if (!statement || statement.kind !== "decision") {
        pushError(errors, `Doc '${metadata.id}' references missing decision '${decisionId}'`, doc.loc);
      }
    }

    for (const shapeId of metadata.related_shapes || []) {
      const statement = registry.get(shapeId);
      if (!statement || statement.kind !== "shape") {
        pushError(errors, `Doc '${metadata.id}' references missing shape '${shapeId}'`, doc.loc);
      }
    }

    for (const projectionId of metadata.related_projections || []) {
      const statement = registry.get(projectionId);
      if (!statement || statement.kind !== "projection") {
        pushError(errors, `Doc '${metadata.id}' references missing projection '${projectionId}'`, doc.loc);
      }
    }

    for (const relatedDocId of metadata.related_docs || []) {
      if (!docRegistry.has(relatedDocId)) {
        pushError(errors, `Doc '${metadata.id}' references missing doc '${relatedDocId}'`, doc.loc);
      }
    }

    for (const [fieldName, expectedKind] of Object.entries(DOC_REFERENCE_FIELDS)) {
      const value = metadata[fieldName];
      if (value == null) continue;
      if (typeof value !== "string") {
        pushError(errors, `Doc metadata '${fieldName}' must be a single id`, doc.loc);
        continue;
      }
      const target = registry.get(value);
      if (!target) {
        pushError(errors, `Doc '${metadata.id}' references missing ${expectedKind} '${value}'`, doc.loc);
        continue;
      }
      if (target.kind !== expectedKind) {
        pushError(
          errors,
          `Doc '${metadata.id}' ${fieldName} must reference a ${expectedKind}, found ${target.kind} '${target.id}'`,
          doc.loc
        );
      }
    }
  }
}

export function validateWorkspace(workspaceAst) {
  const errors = [];
  const registry = buildRegistry(workspaceAst, errors);
  validateDocs(workspaceAst, registry, errors);

  for (const file of workspaceAst.files) {
    for (const statement of file.statements) {
      const fieldMap = collectFieldMap(statement);
      validateFieldPresence(errors, statement, fieldMap);
      validateFieldShapes(errors, statement, fieldMap);
      validateStatus(errors, statement, fieldMap);
      validateRuleSeverity(errors, statement, fieldMap);
      validateVerification(errors, statement, fieldMap);
      validateShapeFrom(errors, statement, registry);
      validateReferenceKinds(errors, statement, fieldMap, registry);
      validateEntityRelations(errors, statement, fieldMap, registry);
      validateShapeTransforms(errors, statement, fieldMap, registry);
      validateProjectionHttp(errors, statement, fieldMap, registry);
      validateProjectionHttpErrors(errors, statement, fieldMap, registry);
      validateProjectionHttpFields(errors, statement, fieldMap, registry);
      validateProjectionHttpResponses(errors, statement, fieldMap, registry);
      validateProjectionHttpPreconditions(errors, statement, fieldMap, registry);
      validateProjectionHttpIdempotency(errors, statement, fieldMap, registry);
      validateProjectionHttpCache(errors, statement, fieldMap, registry);
      validateProjectionHttpDelete(errors, statement, fieldMap, registry);
      validateProjectionHttpAsync(errors, statement, fieldMap, registry);
      validateProjectionHttpStatus(errors, statement, fieldMap, registry);
      validateProjectionHttpDownload(errors, statement, fieldMap, registry);
      validateProjectionHttpAuthz(errors, statement, fieldMap, registry);
      validateProjectionHttpCallbacks(errors, statement, fieldMap, registry);
      validateProjectionUiScreens(errors, statement, fieldMap, registry);
      validateProjectionUiCollections(errors, statement, fieldMap, registry);
      validateProjectionUiActions(errors, statement, fieldMap, registry);
      validateProjectionUiVisibility(errors, statement, fieldMap, registry);
      validateProjectionUiLookups(errors, statement, fieldMap, registry);
      validateProjectionUiRoutes(errors, statement, fieldMap, registry);
      validateProjectionUiAppShell(errors, statement, fieldMap);
      validateProjectionUiDesign(errors, statement, fieldMap);
      validateProjectionUiNavigation(errors, statement, fieldMap, registry);
      validateProjectionUiScreenRegions(errors, statement, fieldMap, registry);
      validateProjectionUiComponents(errors, statement, fieldMap, registry);
      validateProjectionUiWeb(errors, statement, fieldMap, registry);
      validateProjectionUiIos(errors, statement, fieldMap, registry);
      validateProjectionDbTables(errors, statement, fieldMap, registry);
      validateProjectionDbColumns(errors, statement, fieldMap, registry);
      validateProjectionDbKeys(errors, statement, fieldMap, registry);
      validateProjectionDbIndexes(errors, statement, fieldMap, registry);
      validateProjectionDbRelations(errors, statement, fieldMap, registry);
      validateProjectionDbLifecycle(errors, statement, fieldMap, registry);
      validateProjectionGeneratorDefaults(errors, statement, fieldMap);
      validateComponent(errors, statement, fieldMap, registry);
      validateDomain(errors, statement, fieldMap, registry);
      validateDomainTag(errors, statement, fieldMap, registry);
      validatePitch(errors, statement, fieldMap, registry);
      validateRequirement(errors, statement, fieldMap, registry);
      validateAcceptanceCriterion(errors, statement, fieldMap, registry);
      validateTask(errors, statement, fieldMap, registry);
      validateBug(errors, statement, fieldMap, registry);
      validateExpressions(errors, statement, fieldMap);
    }
  }

  return {
    ok: errors.length === 0,
    errorCount: errors.length,
    errors,
    registry
  };
}

export function formatValidationErrors(result) {
  return result.errors.map((error) => `${formatLoc(error.loc)} ${error.message}`).join("\n");
}
