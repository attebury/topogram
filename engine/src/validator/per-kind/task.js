// @ts-check
import {
  TASK_IDENTIFIER_PATTERN,
  TASK_DISPOSITIONS,
  PRIORITY_VALUES,
  WORK_TYPES
} from "../kinds.js";
import {
  pushError,
  symbolValue,
  symbolValues
} from "../utils.js";

/** @param {ValidationErrors} errors @param {TopogramStatement} statement */
function validateTaskIdentifier(errors, statement) {
  if (!TASK_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Task identifier '${statement.id}' must match ${TASK_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap */
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

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap */
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

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap */
function validateDisposition(errors, statement, fieldMap) {
  const field = fieldMap.get("disposition")?.[0];
  if (!field) return;
  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'disposition' on task ${statement.id} must be a symbol`, field.loc);
    return;
  }
  if (!TASK_DISPOSITIONS.has(field.value.value)) {
    pushError(
      errors,
      `Invalid disposition '${field.value.value}' on task ${statement.id}`,
      field.loc
    );
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
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

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap */
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

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
export function validateTask(errors, statement, fieldMap, registry) {
  if (statement.kind !== "task") {
    return;
  }
  validateTaskIdentifier(errors, statement);
  validatePriority(errors, statement, fieldMap);
  validateWorkType(errors, statement, fieldMap);
  validateDisposition(errors, statement, fieldMap);
  validateBlockingPair(errors, statement, fieldMap, registry);
  validateClaimedByPresence(errors, statement, fieldMap);
}
