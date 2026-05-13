// @ts-check

import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} spec
 * @param {string} cwd
 * @returns {boolean}
 */
export function isPathSpec(spec, cwd) {
  return spec.startsWith(".") || spec.startsWith("/") || fs.existsSync(path.resolve(cwd, spec));
}

/**
 * @param {string} spec
 * @returns {string}
 */
export function packageNameFromSpec(spec) {
  if (spec.startsWith("@")) {
    const versionIndex = spec.indexOf("@", 1);
    return versionIndex > 0 ? spec.slice(0, versionIndex) : spec;
  }
  const versionIndex = spec.indexOf("@");
  return versionIndex > 0 ? spec.slice(0, versionIndex) : spec;
}

/**
 * @param {string|null|undefined} rootDir
 * @returns {string}
 */
export function packageResolutionBase(rootDir) {
  return path.join(rootDir || process.cwd(), "package.json");
}

/**
 * @param {string|null|undefined} packageName
 * @returns {string|null}
 */
export function packageInstallCommand(packageName) {
  return packageName ? `npm install -D ${packageName}` : null;
}

/**
 * @param {string|null|undefined} packageName
 * @returns {string|null}
 */
export function packageInstallHint(packageName) {
  const command = packageInstallCommand(packageName);
  return command ? `Install it from the project root with: ${command}` : null;
}
