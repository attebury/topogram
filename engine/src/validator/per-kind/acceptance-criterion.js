import {
  ACCEPTANCE_CRITERION_IDENTIFIER_PATTERN
} from "../kinds.js";
import {
  pushError,
  symbolValue,
  symbolValues
} from "../utils.js";

function validateAcIdentifier(errors, statement) {
  if (!ACCEPTANCE_CRITERION_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Acceptance criterion identifier '${statement.id}' must match ${ACCEPTANCE_CRITERION_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

function validateRequirementRef(errors, statement, fieldMap, registry) {
  // Generic reference validator skips `requirement` (it's overloaded with
  // rule.requirement which is a string condition); validate the kind=requirement
  // reference here.
  const field = fieldMap.get("requirement")?.[0];
  if (!field) return;
  const id = symbolValue(field.value);
  if (!id) {
    pushError(
      errors,
      `Field 'requirement' on acceptance_criterion ${statement.id} must be a single symbol`,
      field.loc
    );
    return;
  }
  const target = registry.get(id);
  if (!target) {
    pushError(
      errors,
      `Acceptance criterion ${statement.id} requirement references missing requirement '${id}'`,
      field.loc
    );
    return;
  }
  if (target.kind !== "requirement") {
    pushError(
      errors,
      `Acceptance criterion ${statement.id} requirement must reference requirement, found ${target.kind} '${target.id}'`,
      field.loc
    );
  }
}

function validateSupersedes(errors, statement, fieldMap, registry) {
  const field = fieldMap.get("supersedes")?.[0];
  if (!field) return;
  for (const id of symbolValues(field.value)) {
    if (id === statement.id) {
      pushError(
        errors,
        `Acceptance criterion ${statement.id} cannot supersede itself`,
        field.loc
      );
      continue;
    }
    const target = registry.get(id);
    if (!target) {
      pushError(
        errors,
        `Acceptance criterion ${statement.id} supersedes references missing acceptance_criterion '${id}'`,
        field.loc
      );
      continue;
    }
    if (target.kind !== "acceptance_criterion") {
      pushError(
        errors,
        `Acceptance criterion ${statement.id} supersedes must reference acceptance_criterion, found ${target.kind} '${target.id}'`,
        field.loc
      );
    }
  }
}

export function validateAcceptanceCriterion(errors, statement, fieldMap, registry) {
  if (statement.kind !== "acceptance_criterion") {
    return;
  }
  validateAcIdentifier(errors, statement);
  validateRequirementRef(errors, statement, fieldMap, registry);
  validateSupersedes(errors, statement, fieldMap, registry);
}
