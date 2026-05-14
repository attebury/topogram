// @ts-check

import { topogramRuntimeConfig } from "./topogram-config.js";

export const DEFAULT_REMOTE_FETCH_MAX_BYTES = 5 * 1024 * 1024;

/**
 * @param {string|null|undefined} value
 * @returns {number|null}
 */
function parsePositiveInteger(value) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * @param {string[]} envNames
 * @param {number} [fallback]
 * @param {Array<"remoteFetchMaxBytes"|"catalogFetchMaxBytes"|"githubFetchMaxBytes">} [configKeys]
 * @returns {number}
 */
export function remotePayloadMaxBytes(envNames, fallback = DEFAULT_REMOTE_FETCH_MAX_BYTES, configKeys = []) {
  for (const envName of envNames) {
    const parsed = parsePositiveInteger(process.env[envName]);
    if (parsed) {
      return parsed;
    }
  }
  const limits = topogramRuntimeConfig(process.cwd()).limits;
  for (const configKey of configKeys) {
    const parsed = parsePositiveInteger(String(limits[configKey] || ""));
    if (parsed) {
      return parsed;
    }
  }
  return fallback;
}
