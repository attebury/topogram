// @ts-check

import {
  blockSymbolItems,
  getFieldValue,
  pushError,
  symbolValues
} from "../utils.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateProjectionHttpAuthz(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpAuthzField = fieldMap.get("authorization")?.[0];
  if (!httpAuthzField || httpAuthzField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpAuthzField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} authorization references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} authorization must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} authorization for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} authorization for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const key of directives.keys()) {
      if (!["role", "permission", "claim", "claim_value", "ownership", "ownership_field"].includes(key)) {
        pushError(errors, `Projection ${statement.id} authorization for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    if (directives.size === 0) {
      pushError(errors, `Projection ${statement.id} authorization for '${capabilityId}' must include at least one directive`, entry.loc);
    }

    const ownership = directives.get("ownership");
    if (ownership && !["owner", "owner_or_admin", "project_member", "none"].includes(ownership)) {
      pushError(errors, `Projection ${statement.id} authorization for '${capabilityId}' has invalid ownership '${ownership}'`, entry.loc);
    }

    const ownershipField = directives.get("ownership_field");
    if (ownershipField && (!ownership || ownership === "none")) {
      pushError(errors, `Projection ${statement.id} authorization for '${capabilityId}' cannot declare ownership_field without ownership`, entry.loc);
    }

    const claimValue = directives.get("claim_value");
    if (claimValue && !directives.get("claim")) {
      pushError(errors, `Projection ${statement.id} authorization for '${capabilityId}' cannot declare claim_value without claim`, entry.loc);
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
