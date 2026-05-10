// @ts-check
import {
  REQUIREMENT_IDENTIFIER_PATTERN,
  PRIORITY_VALUES
} from "../kinds.js";
import {
  pushError,
  symbolValue,
  symbolValues
} from "../utils.js";

/** @param {ValidationErrors} errors @param {TopogramStatement} statement */
function validateRequirementIdentifier(errors, statement) {
  if (!REQUIREMENT_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Requirement identifier '${statement.id}' must match ${REQUIREMENT_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap */
function validatePriority(errors, statement, fieldMap) {
  const field = fieldMap.get("priority")?.[0];
  if (!field) return;
  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'priority' on requirement ${statement.id} must be a symbol`, field.loc);
    return;
  }
  if (!PRIORITY_VALUES.has(field.value.value)) {
    pushError(
      errors,
      `Invalid priority '${field.value.value}' on requirement ${statement.id}`,
      field.loc
    );
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
function validateSupersedes(errors, statement, fieldMap, registry) {
  const field = fieldMap.get("supersedes")?.[0];
  if (!field) return;
  for (const id of symbolValues(field.value)) {
    if (id === statement.id) {
      pushError(
        errors,
        `Requirement ${statement.id} cannot supersede itself`,
        field.loc
      );
      continue;
    }
    const target = registry.get(id);
    if (!target) {
      pushError(
        errors,
        `Requirement ${statement.id} supersedes references missing requirement '${id}'`,
        field.loc
      );
      continue;
    }
    if (target.kind !== "requirement") {
      pushError(
        errors,
        `Requirement ${statement.id} supersedes must reference requirement, found ${target.kind} '${target.id}'`,
        field.loc
      );
    }
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
export function validateRequirement(errors, statement, fieldMap, registry) {
  if (statement.kind !== "requirement") {
    return;
  }
  validateRequirementIdentifier(errors, statement);
  validatePriority(errors, statement, fieldMap);
  validateSupersedes(errors, statement, fieldMap, registry);
}
