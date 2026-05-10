// @ts-check

import {
  validateProjectionHttp,
  validateProjectionHttpErrors,
  validateProjectionHttpFields
} from "./api-http-core.js";
import { validateProjectionHttpResponses } from "./api-http-responses.js";
import {
  validateProjectionHttpPreconditions,
  validateProjectionHttpIdempotency,
  validateProjectionHttpCache,
  validateProjectionHttpDelete
} from "./api-http-policies.js";
import {
  validateProjectionHttpAsync,
  validateProjectionHttpStatus,
  validateProjectionHttpDownload,
  validateProjectionHttpCallbacks
} from "./api-http-async.js";
import { validateProjectionHttpAuthz } from "./api-http-authz.js";

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
