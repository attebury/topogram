// @ts-check

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  catalogDoctorPackageDiagnostic,
  runNpmViewPackageSpec
} from "../catalog.js";
import { CLI_PACKAGE_NAME, ENGINE_ROOT } from "./constants.js";
import { compareSemver } from "./versions.js";

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
