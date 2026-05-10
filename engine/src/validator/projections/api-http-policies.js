// @ts-check

import {
  blockEntries,
  blockSymbolItems,
  getFieldValue,
  pushError,
  symbolValues
} from "../utils.js";
import { resolveCapabilityContractFields } from "./helpers.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateProjectionHttpPreconditions(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpPreconditionsField = fieldMap.get("preconditions")?.[0];
  if (!httpPreconditionsField || httpPreconditionsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpPreconditionsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} preconditions references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} preconditions must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} preconditions for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} preconditions for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["header", "required", "error", "source", "code"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} preconditions for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["header", "required", "error", "source", "code"].includes(key)) {
        pushError(errors, `Projection ${statement.id} preconditions for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const required = directives.get("required");
    if (required && !["true", "false"].includes(required)) {
      pushError(errors, `Projection ${statement.id} preconditions for '${capabilityId}' has invalid required value '${required}'`, entry.loc);
    }

    const errorStatus = directives.get("error");
    if (errorStatus && !/^\d{3}$/.test(errorStatus)) {
      pushError(errors, `Projection ${statement.id} preconditions for '${capabilityId}' must use a 3-digit error status`, entry.loc);
    }

    const sourceField = directives.get("source");
    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    if (sourceField && outputFields.size > 0 && !outputFields.has(sourceField)) {
      pushError(errors, `Projection ${statement.id} preconditions references unknown output field '${sourceField}' on ${capabilityId}`, entry.loc);
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

export function validateProjectionHttpIdempotency(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpIdempotencyField = fieldMap.get("idempotency")?.[0];
  if (!httpIdempotencyField || httpIdempotencyField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpIdempotencyField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} idempotency references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} idempotency must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} idempotency for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} idempotency for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["header", "required", "error", "code"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} idempotency for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["header", "required", "error", "code"].includes(key)) {
        pushError(errors, `Projection ${statement.id} idempotency for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const required = directives.get("required");
    if (required && !["true", "false"].includes(required)) {
      pushError(errors, `Projection ${statement.id} idempotency for '${capabilityId}' has invalid required value '${required}'`, entry.loc);
    }

    const errorStatus = directives.get("error");
    if (errorStatus && !/^\d{3}$/.test(errorStatus)) {
      pushError(errors, `Projection ${statement.id} idempotency for '${capabilityId}' must use a 3-digit error status`, entry.loc);
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

export function validateProjectionHttpCache(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpCacheField = fieldMap.get("cache")?.[0];
  if (!httpCacheField || httpCacheField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const httpEntries = blockEntries(getFieldValue(statement, "endpoints"));
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
      pushError(errors, `Projection ${statement.id} cache references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} cache must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} cache for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} cache for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["response_header", "request_header", "required", "not_modified", "source", "code"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} cache for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["response_header", "request_header", "required", "not_modified", "source", "code"].includes(key)) {
        pushError(errors, `Projection ${statement.id} cache for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const required = directives.get("required");
    if (required && !["true", "false"].includes(required)) {
      pushError(errors, `Projection ${statement.id} cache for '${capabilityId}' has invalid required value '${required}'`, entry.loc);
    }

    const notModifiedStatus = directives.get("not_modified");
    if (notModifiedStatus && notModifiedStatus !== "304") {
      pushError(errors, `Projection ${statement.id} cache for '${capabilityId}' must use 304 for 'not_modified'`, entry.loc);
    }

    const sourceField = directives.get("source");
    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    if (sourceField && outputFields.size > 0 && !outputFields.has(sourceField)) {
      pushError(errors, `Projection ${statement.id} cache references unknown output field '${sourceField}' on ${capabilityId}`, entry.loc);
    }

    const method = httpMethodsByCapability.get(capabilityId);
    if (method && method !== "GET") {
      pushError(errors, `Projection ${statement.id} cache for '${capabilityId}' requires an HTTP GET realization, found '${method}'`, entry.loc);
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

export function validateProjectionHttpDelete(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpDeleteField = fieldMap.get("delete_semantics")?.[0];
  if (!httpDeleteField || httpDeleteField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpDeleteField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} delete_semantics references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} delete_semantics must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} delete_semantics for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} delete_semantics for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["mode", "response"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} delete_semantics for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["mode", "field", "value", "response"].includes(key)) {
        pushError(errors, `Projection ${statement.id} delete_semantics for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const mode = directives.get("mode");
    if (mode && !["soft", "hard"].includes(mode)) {
      pushError(errors, `Projection ${statement.id} delete_semantics for '${capabilityId}' has invalid mode '${mode}'`, entry.loc);
    }

    const response = directives.get("response");
    if (response && !["none", "body"].includes(response)) {
      pushError(errors, `Projection ${statement.id} delete_semantics for '${capabilityId}' has invalid response '${response}'`, entry.loc);
    }

    if (mode === "soft") {
      if (!directives.has("field") || !directives.has("value")) {
        pushError(errors, `Projection ${statement.id} delete_semantics for '${capabilityId}' must include 'field' and 'value' for soft deletes`, entry.loc);
      }
      const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
      const fieldName = directives.get("field");
      if (fieldName && outputFields.size > 0 && !outputFields.has(fieldName)) {
        pushError(errors, `Projection ${statement.id} delete_semantics references unknown output field '${fieldName}' on ${capabilityId}`, entry.loc);
      }
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
