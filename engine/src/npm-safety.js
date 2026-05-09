// @ts-check

import fs from "node:fs";
import path from "node:path";

export const LOCAL_NPMRC_ENV = "TOPOGRAM_ALLOW_LOCAL_NPMRC";

/**
 * @param {string} spec
 * @returns {string}
 */
export function assertSafeNpmSpec(spec) {
  if (typeof spec !== "string" || spec.trim().length === 0) {
    throw new Error("Empty npm package spec.");
  }
  if (spec.startsWith("-")) {
    throw new Error(`Refusing npm package spec starting with '-': '${spec}'.`);
  }
  if (/[\s\r\n\0]/.test(spec)) {
    throw new Error(`Invalid characters in npm package spec: '${spec}'.`);
  }
  return spec;
}

/**
 * @param {string|undefined} value
 * @returns {boolean}
 */
export function localNpmrcAllowedByEnv(value = process.env[LOCAL_NPMRC_ENV]) {
  return value === "1" || value === "true" || value === "yes";
}

/**
 * @param {string} cwd
 * @returns {{ exists: boolean, path: string, enabled: boolean, reason: string }}
 */
export function localNpmrcStatus(cwd = process.cwd()) {
  const npmrcPath = path.join(cwd, ".npmrc");
  const exists = fs.existsSync(npmrcPath);
  if (process.env.NPM_CONFIG_USERCONFIG) {
    return {
      exists,
      path: npmrcPath,
      enabled: false,
      reason: "NPM_CONFIG_USERCONFIG is already set explicitly."
    };
  }
  if (!exists) {
    return {
      exists,
      path: npmrcPath,
      enabled: false,
      reason: "No local .npmrc was found."
    };
  }
  if (!localNpmrcAllowedByEnv()) {
    return {
      exists,
      path: npmrcPath,
      enabled: false,
      reason: `Local .npmrc is ignored unless ${LOCAL_NPMRC_ENV}=1 or --allow-local-npmrc is used.`
    };
  }
  return {
    exists,
    path: npmrcPath,
    enabled: true,
    reason: `Local .npmrc is enabled by ${LOCAL_NPMRC_ENV}.`
  };
}

/**
 * @param {string} cwd
 * @returns {Record<string, string>}
 */
export function localNpmrcEnv(cwd = process.cwd()) {
  const status = localNpmrcStatus(cwd);
  return status.enabled ? { NPM_CONFIG_USERCONFIG: status.path } : {};
}
