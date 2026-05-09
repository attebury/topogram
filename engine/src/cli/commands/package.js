// @ts-check

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import { assertSafeNpmSpec, localNpmrcEnv } from "../../npm-safety.js";
import {
  catalogDoctorPackageDiagnostic,
  runNpmViewPackageSpec
} from "./catalog.js";

export const CLI_PACKAGE_NAME = "@topogram/cli";
export const NPMJS_REGISTRY = "https://registry.npmjs.org";

const PACKAGE_UPDATE_CLI_CHECK_SCRIPTS = [
  "cli:surface",
  "doctor",
  "catalog:show",
  "catalog:template-show",
  "check",
  "pack:check",
  "verify"
];
const PACKAGE_UPDATE_CLI_INFO_SCRIPTS = ["cli:surface", "doctor", "catalog:show", "catalog:template-show"];
const PACKAGE_UPDATE_CLI_VERIFICATION_SCRIPTS = ["verify", "pack:check", "check"];
const ENGINE_ROOT = decodeURIComponent(new URL("../../../", import.meta.url).pathname);

/**
 * @returns {void}
 */
export function printPackageHelp() {
  console.log("Usage: topogram package update-cli <version|--latest> [--json]");
  console.log("");
  console.log("Updates a consumer project to a Topogram CLI version and runs verification when dependencies are current.");
  console.log("");
  console.log("Behavior:");
  console.log("  - npmjs package inspection confirms the requested public CLI version.");
  console.log("  - npm install updates package.json and package-lock.json.");
  console.log("  - Available consumer verification scripts run after install.");
  console.log(`  - Recognized scripts: ${PACKAGE_UPDATE_CLI_CHECK_SCRIPTS.join(", ")}.`);
  console.log("  - Verification scripts are selected by strength: verify, then pack:check, then check.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram package update-cli 0.3.5");
  console.log("  topogram package update-cli --latest");
  console.log("  topogram package update-cli --latest --json");
  console.log("");
  console.log("Auth help:");
  console.log("  topogram setup package-auth");
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} requested
 * @param {{ cwd?: string }} [options]
 * @returns {{ ok: boolean, packageName: string, requestedVersion: string, requestedLatest: boolean, dependencySpec: string, checkedVersion: string, packageCheckSource: "npm", dependencyUpdatedBy: "npm-install"|"manifest-lockfile"|"version-convention", lockfileSanitized: boolean, versionConventionUpdated: boolean, versionConventionPath: string|null, scriptsRun: string[], skippedScripts: string[], diagnostics: Array<Record<string, any>>, errors: string[] }}
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
 * @param {ReturnType<typeof buildPackageUpdateCliPayload>} payload
 * @returns {void}
 */
export function printPackageUpdateCli(payload) {
  for (const diagnostic of payload.diagnostics) {
    if (diagnostic.severity === "warning") {
      console.warn(`Warning: ${diagnostic.message}`);
    }
  }
  console.log(`Updated ${payload.packageName} to ^${payload.requestedVersion}.`);
  if (payload.requestedLatest) {
    console.log(`Resolved latest version: ${payload.requestedVersion}`);
  }
  console.log(`Checked package: ${payload.packageName}@${payload.checkedVersion} via ${payload.packageCheckSource}`);
  console.log(`Updated dependency: ${payload.dependencySpec} via ${payload.dependencyUpdatedBy}`);
  if (payload.lockfileSanitized) {
    console.log("Lockfile: refreshed existing @topogram/cli entry from registry metadata");
  }
  if (payload.versionConventionUpdated) {
    console.log(`Version convention: updated ${payload.versionConventionPath}`);
  }
  console.log(`Checks run: ${payload.scriptsRun.join(", ") || "none"}`);
  if (payload.skippedScripts.length > 0) {
    console.log(`Checks skipped: ${payload.skippedScripts.join(", ")}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log("  git diff package.json package-lock.json");
  console.log(`  git commit -am "Update Topogram CLI to ${payload.requestedVersion}"`);
  console.log("  git push");
  console.log("  confirm the repo verification workflow passes");
}

/**
 * @param {{
 *   commandArgs: Record<string, any>,
 *   inputPath: string|null|undefined,
 *   json: boolean
 * }} context
 * @returns {number}
 */
export function runPackageCommand(context) {
  const { commandArgs, inputPath, json } = context;
  if (commandArgs.packageCommand !== "update-cli") {
    throw new Error(`Unknown package command '${commandArgs.packageCommand}'`);
  }
  if (!inputPath) {
    console.error("Missing required <version>.");
    printPackageHelp();
    return 1;
  }
  const payload = buildPackageUpdateCliPayload(inputPath);
  if (json) {
    console.log(stableStringify(payload));
  } else {
    printPackageUpdateCli(payload);
  }
  return 0;
}

/**
 * @param {string} cwd
 * @returns {string|null}
 */
export function readProjectCliDependencySpec(cwd) {
  const packagePath = path.join(cwd, "package.json");
  if (!fs.existsSync(packagePath)) {
    return null;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const dependencies = {
      ...(pkg.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {}),
      ...(pkg.devDependencies && typeof pkg.devDependencies === "object" ? pkg.devDependencies : {})
    };
    const spec = dependencies[CLI_PACKAGE_NAME];
    return typeof spec === "string" && spec ? spec : null;
  } catch {
    return null;
  }
}

/**
 * @param {string|null} spec
 * @returns {boolean}
 */
export function isLocalCliDependencySpec(spec) {
  if (!spec) {
    return false;
  }
  return spec.startsWith("file:") ||
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec.endsWith(".tgz");
}

/**
 * @returns {{ version: string, minimum: string, ok: boolean, diagnostics: any[] }}
 */
export function checkDoctorNode() {
  const version = process.version;
  const minimum = "20.0.0";
  const ok = compareSemver(version.replace(/^v/, ""), minimum) >= 0;
  return {
    version,
    minimum: `>=${minimum}`,
    ok,
    diagnostics: ok ? [] : [{
      code: "node_version_unsupported",
      severity: "error",
      message: `Topogram requires Node.js >=${minimum}; current version is ${version}.`,
      path: null,
      suggestedFix: "Install Node.js 20 or newer."
    }]
  };
}

/**
 * @returns {{ available: boolean, version: string|null, diagnostics: any[] }}
 */
export function checkDoctorNpm() {
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = childProcess.spawnSync(npmBin, ["--version"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
  if (result.status === 0) {
    return {
      available: true,
      version: String(result.stdout || "").trim() || null,
      diagnostics: []
    };
  }
  return {
    available: false,
    version: null,
    diagnostics: [{
      code: "npm_not_found",
      severity: "error",
      message: "npm was not found on PATH.",
      path: null,
      suggestedFix: "Install Node.js/npm, then rerun `topogram doctor`."
    }]
  };
}

/**
 * @returns {string}
 */
export function readInstalledCliPackageVersion() {
  const packagePath = path.join(ENGINE_ROOT, "package.json");
  if (!fs.existsSync(packagePath)) {
    return "0.0.0";
  }
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

/**
 * @param {string} key
 * @returns {string|null}
 */
export function npmConfigGet(key) {
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = childProcess.spawnSync(npmBin, ["config", "get", key], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
  if (result.status !== 0) {
    return null;
  }
  const value = String(result.stdout || "").trim();
  return value && value !== "undefined" && value !== "null" ? value : null;
}

/**
 * @param {string|null} value
 * @returns {string|null}
 */
export function normalizeRegistryUrl(value) {
  if (!value) {
    return null;
  }
  return value.trim().replace(/\/+$/, "");
}

/**
 * @param {string} packageSpec
 * @returns {{ ok: boolean, checkedVersion: string|null, diagnostics: any[] }}
 */
export function checkDoctorPackageAccess(packageSpec) {
  const result = runNpmViewPackageSpec(packageSpec);
  if (result.status === 0) {
    return {
      ok: true,
      checkedVersion: String(result.stdout || "").trim().replace(/^"|"$/g, "") || null,
      diagnostics: []
    };
  }
  return {
    ok: false,
    checkedVersion: null,
    diagnostics: [doctorPackageDiagnostic(packageSpec, result)]
  };
}

/**
 * @param {string} spec
 * @returns {string|null}
 */
export function registryPackageNameFromSpec(spec) {
  if (!spec || spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("file:") || spec.endsWith(".tgz")) {
    return null;
  }
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    if (parts.length < 2) {
      return null;
    }
    return `${parts[0]}/${parts[1].replace(/@[^@]+$/, "")}`;
  }
  return spec.replace(/@[^@]+$/, "");
}

/**
 * @param {string} packageSpec
 * @returns {{ ok: boolean, package: string|null, packageSpec: string, currentVersion: string|null, latestVersion: string|null, current: boolean|null, diagnostics: any[] }}
 */
export function checkTemplatePackageStatus(packageSpec) {
  const packageName = registryPackageNameFromSpec(packageSpec);
  if (!packageName) {
    return {
      ok: true,
      package: null,
      packageSpec,
      currentVersion: null,
      latestVersion: null,
      current: null,
      diagnostics: []
    };
  }
  const access = checkDoctorPackageAccess(packageSpec);
  const latest = checkDoctorPackageAccess(`${packageName}@latest`);
  const currentVersion = access.checkedVersion;
  const latestVersion = latest.checkedVersion;
  return {
    ok: access.ok && latest.ok,
    package: packageName,
    packageSpec,
    currentVersion,
    latestVersion,
    current: currentVersion && latestVersion ? currentVersion === latestVersion : null,
    diagnostics: [...access.diagnostics, ...latest.diagnostics]
  };
}

/**
 * @param {string} packageSpec
 * @returns {{ checked: false, ok: null, package: string|null, packageSpec: string, currentVersion: null, latestVersion: null, current: null, reason: string, diagnostics: any[] }}
 */
export function localTemplatePackageStatus(packageSpec) {
  return {
    checked: false,
    ok: null,
    package: registryPackageNameFromSpec(packageSpec),
    packageSpec,
    currentVersion: null,
    latestVersion: null,
    current: null,
    reason: "Package registry checks were skipped because --local was used.",
    diagnostics: []
  };
}

/**
 * @param {string} packageSpec
 * @param {{ stdout?: string, stderr?: string, error?: Error }} result
 * @returns {any}
 */
function doctorPackageDiagnostic(packageSpec, result) {
  const diagnostic = catalogDoctorPackageDiagnostic({
    id: CLI_PACKAGE_NAME,
    kind: "package",
    package: CLI_PACKAGE_NAME,
    defaultVersion: packageSpec.slice(`${CLI_PACKAGE_NAME}@`.length)
  }, packageSpec, result);
  return {
    ...diagnostic,
    code: diagnostic.code.replace(/^catalog_package_/, "package_registry_"),
    path: CLI_PACKAGE_NAME
  };
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareSemver(left, right) {
  const leftParts = left.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
}

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
 * Remove stale tarball metadata for the CLI package before npm installs the
 * requested version. npm package registry can repack publish metadata, so copying a
 * local npm-pack resolved URL or integrity into a consumer lockfile can make
 * npm ci fail with a checksum mismatch.
 *
 * @param {string} cwd
 * @param {string} version
 * @returns {boolean}
 */
function sanitizeTopogramLockForPackageUpdate(cwd, version) {
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
function readTopogramCliVersionConvention(cwd) {
  const versionPath = path.join(cwd, "topogram-cli.version");
  if (!fs.existsSync(versionPath)) {
    return null;
  }
  const value = fs.readFileSync(versionPath, "utf8").trim();
  return value || null;
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

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isPackageVersion(value) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
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
function formatPackageUpdateNpmError(spec, step, result) {
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
