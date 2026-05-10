// @ts-check

import childProcess from "node:child_process";

import { localNpmrcEnv } from "../../../npm-safety.js";
import { CLI_PACKAGE_NAME, NPMJS_REGISTRY } from "./constants.js";
import { isPackageVersion } from "./versions.js";

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {any}
 */
export function runNpmForPackageUpdate(args, cwd) {
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  return childProcess.spawnSync(npmBin, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...localNpmrcEnv(cwd),
      PATH: process.env.PATH || ""
    }
  });
}

/**
 * @param {string} cwd
 * @returns {string}
 */
export function latestTopogramCliVersion(cwd) {
  const result = runNpmForPackageUpdate(["view", "--json", `--registry=${NPMJS_REGISTRY}`, "--", CLI_PACKAGE_NAME, "version"], cwd);
  if (result.status !== 0) {
    throw new Error(formatPackageUpdateNpmError(`${CLI_PACKAGE_NAME}@latest`, "inspect", result));
  }
  const raw = String(result.stdout || "").trim();
  const version = raw.startsWith("\"") ? JSON.parse(raw) : raw;
  if (!isPackageVersion(version)) {
    throw new Error(`npm returned invalid latest version '${version || "(empty)"}' for ${CLI_PACKAGE_NAME}.`);
  }
  return version;
}

/**
 * @param {any} result
 * @returns {boolean}
 */
function isPackageUpdateNpmAuthFailure(result) {
  const output = [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  const normalized = output.toLowerCase();
  return /\b(e401|eneedauth)\b/.test(normalized) ||
    normalized.includes("unauthenticated") ||
    normalized.includes("authentication required");
}

/**
 * @param {string} spec
 * @param {"inspect"|"install"|"check"} step
 * @param {any} result
 * @returns {string}
 */
export function formatPackageUpdateNpmError(spec, step, result) {
  const output = [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  const normalized = output.toLowerCase();
  if (result.error?.code === "ENOENT") {
    return "npm was not found. Install Node.js/npm and retry.";
  }
  if (isPackageUpdateNpmAuthFailure(result)) {
    return [
      `Authentication is required to ${step} ${spec}.`,
      "Configure registry-specific npm auth when using private packages.",
      output
    ].filter(Boolean).join("\n");
  }
  if (/\be403\b/.test(normalized) || normalized.includes("forbidden") || normalized.includes("permission")) {
    return [
      `Package access was denied while trying to ${step} ${spec}.`,
      "Check npm package registry read access for the consumer environment.",
      output
    ].filter(Boolean).join("\n");
  }
  if (/\b(e404|404)\b/.test(normalized) || normalized.includes("not found")) {
    return [
      `${spec} was not found, or the current token does not have access to it.`,
      "Check the package version and npm package registry access.",
      output
    ].filter(Boolean).join("\n");
  }
  if (/\beintegrity\b/.test(normalized) || normalized.includes("integrity checksum failed")) {
    return [
      `Package integrity failed while trying to ${step} ${spec}.`,
      "Regenerate package-lock.json from the published npm package registry tarball.",
      output
    ].filter(Boolean).join("\n");
  }
  return `Failed to ${step} ${spec}.\n${output || "unknown error"}`.trim();
}
