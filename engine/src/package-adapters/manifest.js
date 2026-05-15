// @ts-check

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { packageInstallHint, packageResolutionBase } from "./spec.js";

/**
 * @typedef {Object} PackageManifestResolution
 * @property {string|null} manifestPath
 * @property {string|null} packageRoot
 * @property {string|null} error
 */

/**
 * @typedef {{ ok: boolean, errors: string[] }} ManifestValidation
 */

/**
 * @param {string} packageName
 * @param {string} manifestFile
 * @param {string|null|undefined} rootDir
 * @param {string} packageLabel
 * @returns {PackageManifestResolution}
 */
export function resolvePackageManifestPath(packageName, manifestFile, rootDir = process.cwd(), packageLabel = "Package") {
  const requireFromRoot = createRequire(packageResolutionBase(rootDir));
  try {
    const manifestPath = requireFromRoot.resolve(`${packageName}/${manifestFile}`);
    return {
      manifestPath,
      packageRoot: path.dirname(manifestPath),
      error: null
    };
  } catch (manifestError) {
    try {
      const packageJsonPath = requireFromRoot.resolve(`${packageName}/package.json`);
      const packageRoot = path.dirname(packageJsonPath);
      const manifestPath = path.join(packageRoot, manifestFile);
      if (!fs.existsSync(manifestPath)) {
        return {
          manifestPath: null,
          packageRoot,
          error: `${packageLabel} '${packageName}' is missing ${manifestFile}`
        };
      }
      return {
        manifestPath,
        packageRoot,
        error: null
      };
    } catch {
      const detail = manifestError instanceof Error ? manifestError.message : String(manifestError);
      const installHint = packageInstallHint(packageName);
      return {
        manifestPath: null,
        packageRoot: null,
        error: `${packageLabel} '${packageName}' could not be resolved from '${rootDir || process.cwd()}': ${detail}${installHint ? `. ${installHint}` : ""}`
      };
    }
  }
}

/**
 * @template T
 * @param {{
 *   packageName: string,
 *   rootDir?: string|null,
 *   manifestFile: string,
 *   packageLabel: string,
 *   validateManifest: (manifest: any) => ManifestValidation
 * }} options
 * @returns {{ manifest: T|null, errors: string[], manifestPath: string|null, packageRoot: string|null }}
 */
export function loadPackageManifest(options) {
  const resolved = resolvePackageManifestPath(
    options.packageName,
    options.manifestFile,
    options.rootDir || process.cwd(),
    options.packageLabel
  );
  if (!resolved.manifestPath) {
    return {
      manifest: null,
      errors: [resolved.error || `${options.packageLabel} '${options.packageName}' could not be resolved`],
      manifestPath: null,
      packageRoot: resolved.packageRoot
    };
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(resolved.manifestPath, "utf8"));
    const validation = options.validateManifest(manifest);
    return {
      manifest: validation.ok ? /** @type {T} */ (manifest) : null,
      errors: validation.errors,
      manifestPath: resolved.manifestPath,
      packageRoot: resolved.packageRoot
    };
  } catch (error) {
    return {
      manifest: null,
      errors: [`${options.packageLabel} '${options.packageName}' manifest could not be read: ${error instanceof Error ? error.message : String(error)}`],
      manifestPath: resolved.manifestPath,
      packageRoot: resolved.packageRoot
    };
  }
}

/**
 * @typedef {Object} PackageJsonMetadata
 * @property {string|null} name
 * @property {string|null} version
 * @property {Record<string, any>|null} packageJson
 * @property {string|null} packageJsonPath
 * @property {string|null} dependencyName
 * @property {string|null} dependencyRange
 */

/**
 * @param {Record<string, any>|null|undefined} packageJson
 * @param {string|null|undefined} dependencyName
 * @returns {string|null}
 */
function dependencyRangeForPackage(packageJson, dependencyName) {
  if (!packageJson || !dependencyName) {
    return null;
  }
  const dependencyBuckets = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies
  ];
  for (const dependencies of dependencyBuckets) {
    if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      continue;
    }
    const range = dependencies[dependencyName];
    if (typeof range === "string" && range.length > 0) {
      return range;
    }
  }
  return null;
}

/**
 * @param {string|null|undefined} packageRoot
 * @param {string|null|undefined} [dependencyName]
 * @returns {PackageJsonMetadata}
 */
export function packageMetadataForRoot(packageRoot, dependencyName = null) {
  const empty = {
    name: null,
    version: null,
    packageJson: null,
    packageJsonPath: null,
    dependencyName: dependencyName || null,
    dependencyRange: null
  };
  if (!packageRoot) {
    return empty;
  }
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return { ...empty, packageJsonPath };
  }
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return {
      name: typeof packageJson.name === "string" && packageJson.name.length > 0 ? packageJson.name : null,
      version: typeof packageJson.version === "string" && packageJson.version.length > 0 ? packageJson.version : null,
      packageJson,
      packageJsonPath,
      dependencyName: dependencyName || null,
      dependencyRange: dependencyRangeForPackage(packageJson, dependencyName)
    };
  } catch {
    return { ...empty, packageJsonPath };
  }
}
