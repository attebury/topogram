import {
  TASK_IDENTIFIER_PATTERN,
  PRIORITY_VALUES,
  WORK_TYPES
} from "../kinds.js";
import {
  pushError,
  symbolValue,
  symbolValues
} from "../utils.js";

function validateTaskIdentifier(errors, statement) {
  if (!TASK_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Task identifier '${statement.id}' must match ${TASK_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

function validatePriority(errors, statement, fieldMap) {
  const field = fieldMap.get("priority")?.[0];
  if (!field) return;
  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'priority' on task ${statement.id} must be a symbol`, field.loc);
    return;
  }
  if (!PRIORITY_VALUES.has(field.value.value)) {
    pushError(
      errors,
      `Invalid priority '${field.value.value}' on task ${statement.id}`,
      field.loc
    );
  }
}

function validateWorkType(errors, statement, fieldMap) {
  const field = fieldMap.get("work_type")?.[0];
  if (!field) return;
  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'work_type' on task ${statement.id} must be a symbol`, field.loc);
    return;
  }
  if (!WORK_TYPES.has(field.value.value)) {
    pushError(
      errors,
      `Invalid work_type '${field.value.value}' on task ${statement.id}`,
      field.loc
    );
  }
}

function validateBlockingPair(errors, statement, fieldMap, registry) {
  // Self-block guard. Reciprocal `blocks` <-> `blocked_by` resolution is the
  // resolver's job; here we just guard against trivial cycles.
  for (const key of ["blocks", "blocked_by"]) {
    const field = fieldMap.get(key)?.[0];
    if (!field) continue;
    for (const id of symbolValues(field.value)) {
      if (id === statement.id) {
        pushError(
          errors,
          `Task ${statement.id} cannot ${key.replace("_", " ")} itself`,
          field.loc
        );
      }
    }
  }
}

function validateClaimedByPresence(errors, statement, fieldMap) {
  // claimed/in-progress/done all require a claimed_by; unclaimed/blocked do not.
  const statusField = fieldMap.get("status")?.[0];
  if (!statusField || statusField.value.type !== "symbol") return;
  const status = statusField.value.value;
  if (!["claimed", "in-progress", "done"].includes(status)) return;
  if (!fieldMap.has("claimed_by")) {
    pushError(
      errors,
      `Task ${statement.id} status '${status}' requires field 'claimed_by'`,
      statusField.loc
    );
  }
}

export function validateTask(errors, statement, fieldMap, registry) {
  if (statement.kind !== "task") {
    return;
  }
  validateTaskIdentifier(errors, statement);
  validatePriority(errors, statement, fieldMap);
  validateWorkType(errors, statement, fieldMap);
  validateBlockingPair(errors, statement, fieldMap, registry);
  validateClaimedByPresence(errors, statement, fieldMap);
}
