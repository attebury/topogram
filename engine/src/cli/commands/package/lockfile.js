// @ts-check

import fs from "node:fs";
import path from "node:path";

import { CLI_PACKAGE_NAME, NPMJS_REGISTRY } from "./constants.js";
import { readProjectCliDependencySpec } from "./doctor.js";
import { messageFromError } from "./shared.js";
import { normalizeRegistryUrl } from "./versions.js";

/**
 * Remove stale tarball metadata for the CLI package before npm installs the
 * requested version. npm package registry can repack publish metadata, so copying a
 * local npm-pack resolved URL or integrity into a consumer lockfile can make
 * npm ci fail with a checksum mismatch.
 *
 * @param {string} cwd
 * @param {string} version
 * @returns {boolean}
 */
export function sanitizeTopogramLockForPackageUpdate(cwd, version) {
  const lockPath = path.join(cwd, "package-lock.json");
  if (!fs.existsSync(lockPath)) {
    return false;
  }
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  const packages = lock && typeof lock === "object" && lock.packages && typeof lock.packages === "object"
    ? lock.packages
    : null;
  const packageEntry = packages?.[`node_modules/${CLI_PACKAGE_NAME}`];
  if (!packageEntry || typeof packageEntry !== "object" || packageEntry.version !== version) {
    return false;
  }
  let changed = false;
  for (const key of ["resolved", "integrity"]) {
    if (Object.prototype.hasOwnProperty.call(packageEntry, key)) {
      delete packageEntry[key];
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  }
  return changed;
}

/**
 * @param {string} cwd
 * @returns {{ checked: boolean, path: string, packageVersion: string|null, dependencySpec: string|null, hasTarballMetadata: boolean, resolvedVersion: string|null, refreshRecommended: boolean, diagnostics: Array<Record<string, any>> }}
 */
export function inspectTopogramCliLockfile(cwd) {
  const lockPath = path.join(cwd, "package-lock.json");
  /** @type {{ checked: boolean, path: string, packageVersion: string|null, dependencySpec: string|null, hasTarballMetadata: boolean, resolvedVersion: string|null, refreshRecommended: boolean, diagnostics: Array<Record<string, any>> }} */
  const result = {
    checked: false,
    path: lockPath,
    packageVersion: null,
    dependencySpec: readProjectCliDependencySpec(cwd),
    hasTarballMetadata: false,
    resolvedVersion: null,
    refreshRecommended: false,
    diagnostics: []
  };
  if (!fs.existsSync(lockPath)) {
    return result;
  }
  result.checked = true;
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    const entry = lock?.packages?.[`node_modules/${CLI_PACKAGE_NAME}`];
    if (!entry || typeof entry !== "object") {
      return result;
    }
    result.packageVersion = typeof entry.version === "string" ? entry.version : null;
    const resolved = typeof entry.resolved === "string" ? entry.resolved : null;
    result.resolvedVersion = resolved ? resolvedTopogramCliVersion(resolved) : null;
    result.hasTarballMetadata = Object.prototype.hasOwnProperty.call(entry, "resolved") ||
      Object.prototype.hasOwnProperty.call(entry, "integrity");
    const conventionVersion = readTopogramCliVersionConvention(cwd);
    const resolvedVersionMismatch = Boolean(result.packageVersion && result.resolvedVersion && result.resolvedVersion !== result.packageVersion);
    const normalizedResolved = normalizeRegistryUrl(resolved);
    const normalizedRegistry = normalizeRegistryUrl(NPMJS_REGISTRY) || NPMJS_REGISTRY;
    const npmjsTarball = Boolean(normalizedResolved && normalizedResolved.startsWith(`${normalizedRegistry}/`));
    const localTarballMetadata = Boolean(resolved && (
      /^file:/.test(resolved) ||
      (!npmjsTarball && /\.tgz(?:$|[?#])/.test(resolved))
    ));
    result.refreshRecommended = Boolean(
      result.packageVersion &&
      conventionVersion &&
      conventionVersion === result.packageVersion &&
      (resolvedVersionMismatch || localTarballMetadata)
    );
    if (result.refreshRecommended) {
      result.diagnostics.push({
        code: "topogram_cli_lockfile_refresh_available",
        severity: "warning",
        message: "package-lock.json contains stale Topogram CLI tarball metadata for the pinned version.",
        path: lockPath,
        suggestedFix: `Run \`topogram package update-cli ${result.packageVersion}\` to refresh from npm registry metadata.`
      });
    }
  } catch (error) {
    result.diagnostics.push({
      code: "topogram_cli_lockfile_unreadable",
      severity: "warning",
      message: `Could not inspect package-lock.json: ${messageFromError(error)}`,
      path: lockPath,
      suggestedFix: "Regenerate package-lock.json with npm install."
    });
  }
  return result;
}

/**
 * @param {string} resolved
 * @returns {string|null}
 */
function resolvedTopogramCliVersion(resolved) {
  const match = resolved.match(/\/@topogram\/cli\/-\/cli-([^/.?#]+(?:\.[^/.?#]+){2}(?:[-+][^/?#]+)?)\.tgz/);
  return match ? match[1] : null;
}

/**
 * @param {string} cwd
 * @returns {string|null}
 */
export function readTopogramCliVersionConvention(cwd) {
  const versionPath = path.join(cwd, "topogram-cli.version");
  if (!fs.existsSync(versionPath)) {
    return null;
  }
  const value = fs.readFileSync(versionPath, "utf8").trim();
  return value || null;
}
