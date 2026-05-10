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
function validateProjectionHttp(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpField = fieldMap.get("endpoints")?.[0];
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

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validateProjectionHttpErrors(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpErrorsField = fieldMap.get("error_responses")?.[0];
  if (!httpErrorsField || httpErrorsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpErrorsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId, errorCode, status] = tokens;

    const target = registry.get(capabilityId);
    if (!target) {
      pushError(errors, `Projection ${statement.id} error_responses references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (target.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} error_responses must target a capability, found ${target.kind} '${target.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} error_responses for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (!/^\d{3}$/.test(status || "")) {
      pushError(errors, `Projection ${statement.id} error_responses for '${capabilityId}' must use a 3-digit status`, entry.loc);
    }
    if (!errorCode) {
      pushError(errors, `Projection ${statement.id} error_responses for '${capabilityId}' must include an error code`, entry.loc);
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
function validateProjectionHttpFields(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpFieldsField = fieldMap.get("wire_fields")?.[0];
  if (!httpFieldsField || httpFieldsField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpFieldsField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId, direction, fieldName, keywordIn, location, maybeAs, maybeWireName] = tokens;

    const capability = registry.get(capabilityId);
    if (!capability) {
      pushError(errors, `Projection ${statement.id} wire_fields references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} wire_fields must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} wire_fields for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }
    if (!["input", "output"].includes(direction)) {
      pushError(errors, `Projection ${statement.id} wire_fields for '${capabilityId}' has invalid direction '${direction}'`, entry.loc);
    }
    if (keywordIn !== "in") {
      pushError(errors, `Projection ${statement.id} wire_fields for '${capabilityId}' must use 'in' before the location`, entry.loc);
    }
    if (!["path", "query", "header", "body"].includes(location)) {
      pushError(errors, `Projection ${statement.id} wire_fields for '${capabilityId}' has invalid location '${location}'`, entry.loc);
    }
    if (maybeAs && maybeAs !== "as") {
      pushError(errors, `Projection ${statement.id} wire_fields for '${capabilityId}' has unexpected token '${maybeAs}'`, entry.loc);
    }
    if (maybeAs === "as" && !maybeWireName) {
      pushError(errors, `Projection ${statement.id} wire_fields for '${capabilityId}' must provide a wire name after 'as'`, entry.loc);
    }

    const availableFields = resolveCapabilityContractFields(registry, capabilityId, direction);
    if (fieldName && availableFields.size > 0 && !availableFields.has(fieldName)) {
      pushError(errors, `Projection ${statement.id} wire_fields references unknown ${direction} field '${fieldName}' on ${capabilityId}`, entry.loc);
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
function validateProjectionHttpResponses(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpResponsesField = fieldMap.get("responses")?.[0];
  if (!httpResponsesField || httpResponsesField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpResponsesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const capabilityId = tokens[0];
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} responses references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} responses must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = parseProjectionHttpResponsesDirectives(tokens.slice(1));
    for (const message of directives.errors) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' ${message}`, entry.loc);
    }

    if (!directives.mode) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'mode'`, entry.loc);
    }

    const mode = directives.mode;
    if (mode && !["item", "collection", "paged", "cursor"].includes(mode)) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' has invalid mode '${mode}'`, entry.loc);
    }

    const itemShapeId = directives.item;
    if (mode && mode !== "item" && !itemShapeId) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'item' for mode '${mode}'`, entry.loc);
    }
    if (itemShapeId) {
      const itemShape = registry.get(itemShapeId);
      if (!itemShape) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' references missing shape '${itemShapeId}'`, entry.loc);
      } else if (itemShape.kind !== "shape") {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must reference a shape for 'item', found ${itemShape.kind} '${itemShape.id}'`, entry.loc);
      }
    }

    if (mode === "cursor") {
      if (!directives.cursor?.requestAfter) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'cursor request_after <field>'`, entry.loc);
      }
      if (!directives.cursor?.responseNext) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'cursor response_next <wire_name>'`, entry.loc);
      }
      if (!directives.limit) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'limit field <field> default <n> max <n>'`, entry.loc);
      }
      if (!directives.sort) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'sort by <field> direction <asc|desc>'`, entry.loc);
      }
    }

    if (directives.sort && !["asc", "desc"].includes(directives.sort.direction || "")) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' has invalid sort direction '${directives.sort.direction}'`, entry.loc);
    }

    if (directives.total && !["true", "false"].includes(directives.total.included || "")) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' has invalid total included value '${directives.total.included}'`, entry.loc);
    }

    if (directives.limit) {
      const defaultValue = Number.parseInt(directives.limit.defaultValue || "", 10);
      const maxValue = Number.parseInt(directives.limit.maxValue || "", 10);
      if (!Number.isInteger(defaultValue) || !Number.isInteger(maxValue)) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must use integer default/max values for 'limit'`, entry.loc);
      } else if (defaultValue > maxValue) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must use default <= max for 'limit'`, entry.loc);
      }
    }

    const inputFields = resolveCapabilityContractFields(registry, capabilityId, "input");
    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    if (directives.cursor?.requestAfter && inputFields.size > 0 && !inputFields.has(directives.cursor.requestAfter)) {
      pushError(errors, `Projection ${statement.id} responses references unknown input field '${directives.cursor.requestAfter}' for cursor request_after on ${capabilityId}`, entry.loc);
    }
    if (directives.limit?.field && inputFields.size > 0 && !inputFields.has(directives.limit.field)) {
      pushError(errors, `Projection ${statement.id} responses references unknown input field '${directives.limit.field}' for limit on ${capabilityId}`, entry.loc);
    }
    if (directives.sort?.field && outputFields.size > 0 && !outputFields.has(directives.sort.field)) {
      pushError(errors, `Projection ${statement.id} responses references unknown output field '${directives.sort.field}' for sort on ${capabilityId}`, entry.loc);
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
function validateProjectionHttpPreconditions(errors, statement, fieldMap, registry) {
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
function validateProjectionHttpIdempotency(errors, statement, fieldMap, registry) {
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
function validateProjectionHttpCache(errors, statement, fieldMap, registry) {
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
function validateProjectionHttpDelete(errors, statement, fieldMap, registry) {
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
function validateProjectionHttpAsync(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpAsyncField = fieldMap.get("async_jobs")?.[0];
  if (!httpAsyncField || httpAsyncField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const httpEntries = blockEntries(getFieldValue(statement, "endpoints"));
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
      pushError(errors, `Projection ${statement.id} async_jobs references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} async_jobs must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["mode", "accepted", "location_header", "retry_after_header", "status_path", "status_capability", "job"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["mode", "accepted", "location_header", "retry_after_header", "status_path", "status_capability", "job"].includes(key)) {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const mode = directives.get("mode");
    if (mode && mode !== "job") {
      pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' has invalid mode '${mode}'`, entry.loc);
    }

    const accepted = directives.get("accepted");
    if (accepted && accepted !== "202") {
      pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' must use 202 for 'accepted'`, entry.loc);
    }

    const jobShapeId = directives.get("job");
    if (jobShapeId) {
      const jobShape = registry.get(jobShapeId);
      if (!jobShape) {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' references missing shape '${jobShapeId}'`, entry.loc);
      } else if (jobShape.kind !== "shape") {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' must reference a shape for 'job', found ${jobShape.kind} '${jobShape.id}'`, entry.loc);
      }
    }

    const statusCapabilityId = directives.get("status_capability");
    if (statusCapabilityId) {
      const statusCapability = registry.get(statusCapabilityId);
      if (!statusCapability) {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' references missing status capability '${statusCapabilityId}'`, entry.loc);
      } else if (statusCapability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' must reference a capability for 'status_capability', found ${statusCapability.kind} '${statusCapability.id}'`, entry.loc);
      } else if (!realized.has(statusCapabilityId)) {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' status capability '${statusCapabilityId}' must also appear in 'realizes'`, entry.loc);
      }

      const statusHttp = httpDirectivesByCapability.get(statusCapabilityId);
      if (statusHttp?.get("method") && statusHttp.get("method") !== "GET") {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' status capability '${statusCapabilityId}' must use HTTP GET`, entry.loc);
      }
      if (statusHttp?.get("path") && directives.get("status_path") && statusHttp.get("path") !== directives.get("status_path")) {
        pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' status_path must match the path for '${statusCapabilityId}'`, entry.loc);
      }
    }

    const statusPath = directives.get("status_path");
    if (statusPath && !statusPath.startsWith("/")) {
      pushError(errors, `Projection ${statement.id} async_jobs for '${capabilityId}' must use an absolute path for 'status_path'`, entry.loc);
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
function validateProjectionHttpStatus(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpStatusField = fieldMap.get("async_status")?.[0];
  if (!httpStatusField || httpStatusField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  const httpEntries = blockEntries(getFieldValue(statement, "endpoints"));
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
      pushError(errors, `Projection ${statement.id} async_status references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} async_status must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["async_for", "state_field", "completed", "failed"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["async_for", "state_field", "completed", "failed", "expired", "download_capability", "download_field", "error_field"].includes(key)) {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const asyncCapabilityId = directives.get("async_for");
    if (asyncCapabilityId) {
      const asyncCapability = registry.get(asyncCapabilityId);
      if (!asyncCapability) {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' references missing async capability '${asyncCapabilityId}'`, entry.loc);
      } else if (asyncCapability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' must reference a capability for 'async_for', found ${asyncCapability.kind} '${asyncCapability.id}'`, entry.loc);
      } else if (!realized.has(asyncCapabilityId)) {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' async capability '${asyncCapabilityId}' must also appear in 'realizes'`, entry.loc);
      }
    }

    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    for (const [directive, fieldName] of [
      ["state_field", directives.get("state_field")],
      ["download_field", directives.get("download_field")],
      ["error_field", directives.get("error_field")]
    ]) {
      if (fieldName && outputFields.size > 0 && !outputFields.has(fieldName)) {
        pushError(errors, `Projection ${statement.id} async_status references unknown output field '${fieldName}' for '${directive}' on ${capabilityId}`, entry.loc);
      }
    }

    const downloadCapabilityId = directives.get("download_capability");
    if (downloadCapabilityId) {
      const downloadCapability = registry.get(downloadCapabilityId);
      if (!downloadCapability) {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' references missing download capability '${downloadCapabilityId}'`, entry.loc);
      } else if (downloadCapability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' must reference a capability for 'download_capability', found ${downloadCapability.kind} '${downloadCapability.id}'`, entry.loc);
      } else if (!realized.has(downloadCapabilityId)) {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' download capability '${downloadCapabilityId}' must also appear in 'realizes'`, entry.loc);
      }

      const method = httpMethodsByCapability.get(downloadCapabilityId);
      if (method && method !== "GET") {
        pushError(errors, `Projection ${statement.id} async_status for '${capabilityId}' download capability '${downloadCapabilityId}' must use HTTP GET`, entry.loc);
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
function validateProjectionHttpDownload(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpDownloadField = fieldMap.get("downloads")?.[0];
  if (!httpDownloadField || httpDownloadField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpDownloadField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} downloads references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} downloads must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["async_for", "media", "disposition"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["async_for", "media", "filename", "disposition"].includes(key)) {
        pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const asyncCapabilityId = directives.get("async_for");
    if (asyncCapabilityId) {
      const asyncCapability = registry.get(asyncCapabilityId);
      if (!asyncCapability) {
        pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' references missing async capability '${asyncCapabilityId}'`, entry.loc);
      } else if (asyncCapability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' must reference a capability for 'async_for', found ${asyncCapability.kind} '${asyncCapability.id}'`, entry.loc);
      } else if (!realized.has(asyncCapabilityId)) {
        pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' async capability '${asyncCapabilityId}' must also appear in 'realizes'`, entry.loc);
      }
    }

    const media = directives.get("media");
    if (media && !media.includes("/")) {
      pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' must use a valid media type`, entry.loc);
    }

    const disposition = directives.get("disposition");
    if (disposition && !["attachment", "inline"].includes(disposition)) {
      pushError(errors, `Projection ${statement.id} downloads for '${capabilityId}' has invalid disposition '${disposition}'`, entry.loc);
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
function validateProjectionHttpAuthz(errors, statement, fieldMap, registry) {
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
function validateProjectionHttpCallbacks(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpCallbacksField = fieldMap.get("callbacks")?.[0];
  if (!httpCallbacksField || httpCallbacksField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpCallbacksField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const [capabilityId] = tokens;
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} callbacks references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} callbacks must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} callbacks for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = new Map();
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      if (!value) {
        pushError(errors, `Projection ${statement.id} callbacks for '${capabilityId}' is missing a value for '${key}'`, entry.loc);
        continue;
      }
      directives.set(key, value);
    }

    for (const requiredKey of ["event", "target_field", "method", "payload", "success"]) {
      if (!directives.has(requiredKey)) {
        pushError(errors, `Projection ${statement.id} callbacks for '${capabilityId}' must include '${requiredKey}'`, entry.loc);
      }
    }

    for (const key of directives.keys()) {
      if (!["event", "target_field", "method", "payload", "success"].includes(key)) {
        pushError(errors, `Projection ${statement.id} callbacks for '${capabilityId}' has unknown directive '${key}'`, entry.loc);
      }
    }

    const method = directives.get("method");
    if (method && !["POST", "PUT", "PATCH"].includes(method)) {
      pushError(errors, `Projection ${statement.id} callbacks for '${capabilityId}' has invalid method '${method}'`, entry.loc);
    }

    const success = directives.get("success");
    if (success && !/^\d{3}$/.test(success)) {
      pushError(errors, `Projection ${statement.id} callbacks for '${capabilityId}' must use a 3-digit success status`, entry.loc);
    }

    const payloadShapeId = directives.get("payload");
    if (payloadShapeId) {
      const payloadShape = registry.get(payloadShapeId);
      if (!payloadShape) {
        pushError(errors, `Projection ${statement.id} callbacks for '${capabilityId}' references missing shape '${payloadShapeId}'`, entry.loc);
      } else if (payloadShape.kind !== "shape") {
        pushError(errors, `Projection ${statement.id} callbacks for '${capabilityId}' must reference a shape for 'payload', found ${payloadShape.kind} '${payloadShape.id}'`, entry.loc);
      }
    }

    const targetField = directives.get("target_field");
    const inputFields = resolveCapabilityContractFields(registry, capabilityId, "input");
    if (targetField && inputFields.size > 0 && !inputFields.has(targetField)) {
      pushError(errors, `Projection ${statement.id} callbacks references unknown input field '${targetField}' on ${capabilityId}`, entry.loc);
    }
  }
}

/**
 * @param {string[]} tokens
 * @returns {any}
 */
function parseProjectionHttpResponsesDirectives(tokens) {
  /** @type {{
   *   mode: string | null,
   *   item: string | null,
   *   cursor: { requestAfter: string | null, responseNext: string | null, responsePrev: string | null } | null,
   *   limit: { field: string | null, defaultValue: string | null, maxValue: string | null } | null,
   *   sort: { field: string | null, direction: string | null } | null,
   *   total: { included: string | null } | null,
   *   errors: string[]
   * }}
   */
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

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateApiHttpProjection(errors, statement, fieldMap, registry) {
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
}
