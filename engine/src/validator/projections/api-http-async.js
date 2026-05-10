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
export function validateProjectionHttpAsync(errors, statement, fieldMap, registry) {
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

export function validateProjectionHttpStatus(errors, statement, fieldMap, registry) {
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

export function validateProjectionHttpDownload(errors, statement, fieldMap, registry) {
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

export function validateProjectionHttpCallbacks(errors, statement, fieldMap, registry) {
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
