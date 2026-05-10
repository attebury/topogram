// @ts-check

import fs from "node:fs";
import path from "node:path";

import { assertSafeNpmSpec } from "../../../npm-safety.js";
import {
  CLI_PACKAGE_NAME,
  NPMJS_REGISTRY,
  PACKAGE_UPDATE_CLI_INFO_SCRIPTS,
  PACKAGE_UPDATE_CLI_VERIFICATION_SCRIPTS
} from "./constants.js";
import { sanitizeTopogramLockForPackageUpdate } from "./lockfile.js";
import { formatPackageUpdateNpmError, latestTopogramCliVersion, runNpmForPackageUpdate } from "./npm.js";
import { messageFromError } from "./shared.js";
import { isPackageVersion } from "./versions.js";

/**
 * @typedef {{
 *   ok: boolean,
 *   packageName: string,
 *   requestedVersion: string,
 *   requestedLatest: boolean,
 *   dependencySpec: string,
 *   checkedVersion: string,
 *   packageCheckSource: "npm",
 *   dependencyUpdatedBy: "npm-install"|"manifest-lockfile"|"version-convention",
 *   lockfileSanitized: boolean,
 *   versionConventionUpdated: boolean,
 *   versionConventionPath: string|null,
 *   scriptsRun: string[],
 *   skippedScripts: string[],
 *   diagnostics: Array<Record<string, any>>,
 *   errors: string[]
 * }} PackageUpdateCliPayload
 */

/**
 * @param {string} requested
 * @param {{ cwd?: string }} [options]
 * @returns {PackageUpdateCliPayload}
 */
export function buildPackageUpdateCliPayload(requested, options = {}) {
  const cwd = options.cwd || process.cwd();
  const requestedLatest = requested === "latest" || requested === "--latest";
  /** @type {Array<Record<string, any>>} */
  const diagnostics = [];
  const version = requestedLatest
    ? resolveLatestTopogramCliVersionForPackageUpdate(cwd, diagnostics)
    : requested;
  if (!isPackageVersion(version)) {
    throw new Error("topogram package update-cli requires <version> or --latest.");
  }
  const exactSpec = `${CLI_PACKAGE_NAME}@${version}`;
  const dependencySpec = `${CLI_PACKAGE_NAME}@^${version}`;
  assertSafeNpmSpec(exactSpec);
  assertSafeNpmSpec(dependencySpec);
  const view = runNpmForPackageUpdate(["view", `--registry=${NPMJS_REGISTRY}`, "--", exactSpec, "version"], cwd);
  let checkedVersion = null;
  const packageCheckSource = "npm";
  if (view.status !== 0) {
    throw new Error(formatPackageUpdateNpmError(exactSpec, "inspect", view));
  } else {
    checkedVersion = String(view.stdout || "").trim().replace(/^"|"$/g, "");
    if (checkedVersion !== version) {
      throw new Error(`Expected ${exactSpec}, but npm returned version '${checkedVersion || "(empty)"}'.`);
    }
  }
  const lockfileSanitized = sanitizeTopogramLockForPackageUpdate(cwd, version);
  const dependencyUpdatedBy = "npm-install";
  const install = runNpmForPackageUpdate(["install", "--save-dev", `--registry=${NPMJS_REGISTRY}`, "--", dependencySpec], cwd);
  if (install.status !== 0) {
    throw new Error(formatPackageUpdateNpmError(dependencySpec, "install", install));
  }
  const versionConvention = writeTopogramCliVersionConventionIfPresent(cwd, version);
  const packageJson = readPackageJsonForUpdate(cwd);
  const scripts = packageJson.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {};
  const scriptsRun = [];
  const skippedScripts = [];
  const scriptsToRun = packageUpdateCliScriptsToRun(scripts);
  for (const scriptName of PACKAGE_UPDATE_CLI_INFO_SCRIPTS) {
    if (!Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      skippedScripts.push(scriptName);
    }
  }
  for (const scriptName of PACKAGE_UPDATE_CLI_VERIFICATION_SCRIPTS) {
    if (!Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      skippedScripts.push(scriptName);
    } else if (!scriptsToRun.includes(scriptName)) {
      const coveringScript = scriptsToRun.find((candidate) =>
        PACKAGE_UPDATE_CLI_VERIFICATION_SCRIPTS.includes(candidate)
      );
      skippedScripts.push(`${scriptName} (covered by ${coveringScript})`);
    }
  }
  for (const scriptName of scriptsToRun) {
    const result = runNpmForPackageUpdate(["run", scriptName], cwd);
    if (result.status !== 0) {
      throw new Error(formatPackageUpdateNpmError(`npm run ${scriptName}`, "check", result));
    }
    scriptsRun.push(scriptName);
  }
  return {
    ok: true,
    packageName: CLI_PACKAGE_NAME,
    requestedVersion: version,
    requestedLatest,
    dependencySpec,
    checkedVersion,
    packageCheckSource,
    dependencyUpdatedBy,
    lockfileSanitized,
    versionConventionUpdated: versionConvention.updated,
    versionConventionPath: versionConvention.path,
    scriptsRun,
    skippedScripts,
    diagnostics,
    errors: []
  };
}

/**
 * @param {Record<string, any>} scripts
 * @returns {string[]}
 */
function packageUpdateCliScriptsToRun(scripts) {
  const selected = [];
  for (const scriptName of PACKAGE_UPDATE_CLI_INFO_SCRIPTS) {
    if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      selected.push(scriptName);
    }
  }
  const verificationScript = PACKAGE_UPDATE_CLI_VERIFICATION_SCRIPTS.find((scriptName) =>
    Object.prototype.hasOwnProperty.call(scripts, scriptName)
  );
  if (verificationScript) {
    selected.push(verificationScript);
  }
  return selected;
}

/**
 * @param {string} cwd
 * @param {Array<Record<string, any>>} diagnostics
 * @returns {string}
 */
function resolveLatestTopogramCliVersionForPackageUpdate(cwd, diagnostics) {
  try {
    return latestTopogramCliVersion(cwd);
  } catch (error) {
    throw new Error(messageFromError(error));
  }
}

/**
 * @param {string} cwd
 * @param {string} version
 * @returns {{ updated: boolean, path: string|null }}
 */
function writeTopogramCliVersionConventionIfPresent(cwd, version) {
  const versionPath = path.join(cwd, "topogram-cli.version");
  if (!fs.existsSync(versionPath)) {
    return { updated: false, path: null };
  }
  fs.writeFileSync(versionPath, `${version}\n`, "utf8");
  return { updated: true, path: versionPath };
}

/**
 * @param {string} cwd
 * @returns {Record<string, any>}
 */
function readPackageJsonForUpdate(cwd) {
  const packagePath = path.join(cwd, "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error("topogram package update-cli must be run from a package directory with package.json.");
  }
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

/**
 * @param {string} cwd
 * @param {string} version
 * @param {string} dependencySpec
 * @returns {{ packageJsonUpdated: boolean, lockfileUpdated: boolean }}
 */
function updateTopogramCliDependencyFiles(cwd, version, dependencySpec) {
  const packagePath = path.join(cwd, "package.json");
  const packageJson = readPackageJsonForUpdate(cwd);
  const hasDevDependency = packageJson.devDependencies &&
    typeof packageJson.devDependencies === "object" &&
    Object.prototype.hasOwnProperty.call(packageJson.devDependencies, CLI_PACKAGE_NAME);
  const hasDependency = packageJson.dependencies &&
    typeof packageJson.dependencies === "object" &&
    Object.prototype.hasOwnProperty.call(packageJson.dependencies, CLI_PACKAGE_NAME);
  const hasVersionConvention = fs.existsSync(path.join(cwd, "topogram-cli.version"));
  const shouldUpdatePackageJson = hasDevDependency || hasDependency || !hasVersionConvention;
  if (!shouldUpdatePackageJson) {
    return { packageJsonUpdated: false, lockfileUpdated: false };
  }
  if (hasDependency && !hasDevDependency) {
    packageJson.dependencies[CLI_PACKAGE_NAME] = dependencySpec.slice(`${CLI_PACKAGE_NAME}@`.length);
  } else {
    packageJson.devDependencies = packageJson.devDependencies && typeof packageJson.devDependencies === "object"
      ? packageJson.devDependencies
      : {};
    packageJson.devDependencies[CLI_PACKAGE_NAME] = dependencySpec.slice(`${CLI_PACKAGE_NAME}@`.length);
  }
  if (hasDevDependency && packageJson.dependencies && typeof packageJson.dependencies === "object") {
    delete packageJson.dependencies[CLI_PACKAGE_NAME];
  }
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  const lockPath = path.join(cwd, "package-lock.json");
  if (!fs.existsSync(lockPath)) {
    return { packageJsonUpdated: true, lockfileUpdated: false };
  }
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  lock.packages = lock.packages && typeof lock.packages === "object" ? lock.packages : {};
  lock.packages[""] = lock.packages[""] && typeof lock.packages[""] === "object" ? lock.packages[""] : {};
  const rootEntry = lock.packages[""];
  const lockHasDependency = rootEntry.dependencies &&
    typeof rootEntry.dependencies === "object" &&
    Object.prototype.hasOwnProperty.call(rootEntry.dependencies, CLI_PACKAGE_NAME);
  if (lockHasDependency && !hasDevDependency) {
    rootEntry.dependencies[CLI_PACKAGE_NAME] = dependencySpec.slice(`${CLI_PACKAGE_NAME}@`.length);
  } else {
    rootEntry.devDependencies = rootEntry.devDependencies && typeof rootEntry.devDependencies === "object"
      ? rootEntry.devDependencies
      : {};
    rootEntry.devDependencies[CLI_PACKAGE_NAME] = dependencySpec.slice(`${CLI_PACKAGE_NAME}@`.length);
  }
  if ((hasDevDependency || !lockHasDependency) && rootEntry.dependencies && typeof rootEntry.dependencies === "object") {
    delete lock.packages[""].dependencies[CLI_PACKAGE_NAME];
  }
  const entryPath = `node_modules/${CLI_PACKAGE_NAME}`;
  const existingEntry = lock.packages[entryPath] && typeof lock.packages[entryPath] === "object"
    ? lock.packages[entryPath]
    : {};
  lock.packages[entryPath] = {
    ...existingEntry,
    version,
    dev: true,
    license: existingEntry.license || "Apache-2.0",
    bin: existingEntry.bin || { topogram: "src/cli.js" },
    engines: existingEntry.engines || { node: ">=20" }
  };
  delete lock.packages[entryPath].resolved;
  delete lock.packages[entryPath].integrity;
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return { packageJsonUpdated: true, lockfileUpdated: true };
}
