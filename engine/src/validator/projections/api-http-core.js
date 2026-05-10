// @ts-check

import {
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
export function validateProjectionHttp(errors, statement, fieldMap, registry) {
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

export function validateProjectionHttpErrors(errors, statement, fieldMap, registry) {
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

export function validateProjectionHttpFields(errors, statement, fieldMap, registry) {
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
