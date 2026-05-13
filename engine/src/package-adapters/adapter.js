// @ts-check

import path from "node:path";
import { createRequire } from "node:module";

/**
 * @param {any} moduleValue
 * @param {string|null|undefined} exportName
 * @returns {any}
 */
export function selectPackageExport(moduleValue, exportName) {
  if (exportName) {
    return moduleValue?.[exportName] || moduleValue?.default?.[exportName] || null;
  }
  return moduleValue?.default || moduleValue;
}

/**
 * @param {{
 *   packageRoot: string,
 *   exportName?: string|null,
 *   packageLabel: string
 * }} options
 * @returns {{ adapter: any|null, error: string|null }}
 */
export function loadLocalPackageAdapter(options) {
  try {
    const packageJsonPath = path.join(options.packageRoot, "package.json");
    const requireFromPackage = createRequire(packageJsonPath);
    return {
      adapter: selectPackageExport(requireFromPackage(options.packageRoot), options.exportName),
      error: null
    };
  } catch (error) {
    return {
      adapter: null,
      error: `${options.packageLabel} export could not be loaded from '${options.packageRoot}': ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * @param {{
 *   packageName: string,
 *   rootDir: string,
 *   exportName?: string|null,
 *   packageLabel: string
 * }} options
 * @returns {{ adapter: any|null, error: string|null }}
 */
export function loadInstalledPackageAdapter(options) {
  try {
    const requireFromRoot = createRequire(path.join(options.rootDir, "package.json"));
    return {
      adapter: selectPackageExport(requireFromRoot(options.packageName), options.exportName),
      error: null
    };
  } catch (error) {
    return {
      adapter: null,
      error: `${options.packageLabel} '${options.packageName}' export could not be loaded from '${options.rootDir}': ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
