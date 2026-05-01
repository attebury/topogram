import {
  BUG_IDENTIFIER_PATTERN,
  PRIORITY_VALUES,
  BUG_SEVERITIES
} from "../kinds.js";
import {
  pushError,
  symbolValue,
  symbolValues
} from "../utils.js";

function validateBugIdentifier(errors, statement) {
  if (!BUG_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Bug identifier '${statement.id}' must match ${BUG_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

function validatePriority(errors, statement, fieldMap) {
  const field = fieldMap.get("priority")?.[0];
  if (!field) return;
  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'priority' on bug ${statement.id} must be a symbol`, field.loc);
    return;
  }
  if (!PRIORITY_VALUES.has(field.value.value)) {
    pushError(
      errors,
      `Invalid priority '${field.value.value}' on bug ${statement.id}`,
      field.loc
    );
  }
}

function validateSeverity(errors, statement, fieldMap) {
  const field = fieldMap.get("severity")?.[0];
  if (!field) return;
  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'severity' on bug ${statement.id} must be a symbol`, field.loc);
    return;
  }
  if (!BUG_SEVERITIES.has(field.value.value)) {
    pushError(
      errors,
      `Invalid severity '${field.value.value}' on bug ${statement.id}`,
      field.loc
    );
  }
}

function validateFixedInVerificationOnVerified(errors, statement, fieldMap) {
  // A bug in `verified` status must point at the verification that proved
  // the fix; this lets release-notes assemble a closed-loop record.
  const statusField = fieldMap.get("status")?.[0];
  if (!statusField || statusField.value.type !== "symbol") return;
  if (statusField.value.value !== "verified") return;
  if (!fieldMap.has("fixed_in_verification")) {
    pushError(
      errors,
      `Bug ${statement.id} status 'verified' requires field 'fixed_in_verification'`,
      statusField.loc
    );
  }
}

export function validateBug(errors, statement, fieldMap, registry) {
  if (statement.kind !== "bug") {
    return;
  }
  validateBugIdentifier(errors, statement);
  validatePriority(errors, statement, fieldMap);
  validateSeverity(errors, statement, fieldMap);
  validateFixedInVerificationOnVerified(errors, statement, fieldMap);
}
