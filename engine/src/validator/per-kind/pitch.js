import {
  PITCH_IDENTIFIER_PATTERN,
  PRIORITY_VALUES
} from "../kinds.js";
import {
  pushError,
  symbolValue,
  symbolValues
} from "../utils.js";

function validatePitchIdentifier(errors, statement) {
  if (!PITCH_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Pitch identifier '${statement.id}' must match ${PITCH_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

function validatePriority(errors, statement, fieldMap) {
  const field = fieldMap.get("priority")?.[0];
  if (!field) return;
  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'priority' on pitch ${statement.id} must be a symbol`, field.loc);
    return;
  }
  if (!PRIORITY_VALUES.has(field.value.value)) {
    pushError(
      errors,
      `Invalid priority '${field.value.value}' on pitch ${statement.id}`,
      field.loc
    );
  }
}

function validateAppetite(errors, statement, fieldMap) {
  const field = fieldMap.get("appetite")?.[0];
  if (!field) return;
  if (field.value.type !== "string" && field.value.type !== "symbol") {
    pushError(
      errors,
      `Field 'appetite' on pitch ${statement.id} must be a string or symbol`,
      field.loc
    );
  }
}

function validateShapingFields(errors, statement, fieldMap) {
  // When a pitch enters status `shaped`, the appetite, rabbit_holes, and
  // no_go_areas sections must be filled. This mirrors the Forge pitch
  // shaping discipline.
  const statusField = fieldMap.get("status")?.[0];
  if (!statusField || statusField.value.type !== "symbol") return;
  const status = statusField.value.value;
  if (status !== "shaped" && status !== "submitted" && status !== "approved") return;

  for (const required of ["appetite", "rabbit_holes", "no_go_areas"]) {
    if (!fieldMap.has(required)) {
      pushError(
        errors,
        `Pitch ${statement.id} status '${status}' requires field '${required}' to be filled`,
        statusField.loc
      );
    }
  }
}

function validateDecisionRefs(errors, statement, fieldMap, registry) {
  const field = fieldMap.get("decisions")?.[0];
  if (!field) return;
  for (const id of symbolValues(field.value)) {
    const target = registry.get(id);
    if (!target) {
      pushError(
        errors,
        `Pitch ${statement.id} decisions references missing decision '${id}'`,
        field.loc
      );
      continue;
    }
    if (target.kind !== "decision") {
      pushError(
        errors,
        `Pitch ${statement.id} decisions must reference decision, found ${target.kind} '${target.id}'`,
        field.loc
      );
    }
  }
}

export function validatePitch(errors, statement, fieldMap, registry) {
  if (statement.kind !== "pitch") {
    return;
  }
  validatePitchIdentifier(errors, statement);
  validatePriority(errors, statement, fieldMap);
  validateAppetite(errors, statement, fieldMap);
  validateShapingFields(errors, statement, fieldMap);
  validateDecisionRefs(errors, statement, fieldMap, registry);
}
