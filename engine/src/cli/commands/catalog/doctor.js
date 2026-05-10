// @ts-check

import childProcess from "node:child_process";

import {
  catalogEntryPackageSpec,
  catalogSourceOrDefault,
  loadCatalog
} from "../../../catalog.js";
import { githubAuthStatus } from "../../../github-client.js";
import { assertSafeNpmSpec, localNpmrcEnv } from "../../../npm-safety.js";
import { messageFromError } from "./shared.js";

/**
 * @param {string|null} source
 * @returns {{ ok: boolean, source: string, auth: { githubTokenEnv: boolean, ghTokenEnv: boolean, ghCli: { checked: boolean, available: boolean, authenticated: boolean, reason: string|null } }, catalog: { reachable: boolean, version: string|null, entries: number }, packages: Array<{ id: string, kind: string, package: string, version: string, packageSpec: string, ok: boolean, checkedVersion: string|null, diagnostics: any[] }>, diagnostics: any[], errors: string[] }}
 */
export function buildCatalogDoctorPayload(source) {
  const resolvedSource = catalogSourceOrDefault(source || null);
  const auth = buildCatalogDoctorAuth(resolvedSource);
  const diagnostics = [];
  /** @type {Array<{ id: string, kind: string, package: string, version: string, packageSpec: string, ok: boolean, checkedVersion: string|null, diagnostics: any[] }>} */
  const packages = [];
  let loaded = null;
  try {
    loaded = loadCatalog(source || null);
  } catch (error) {
    const diagnostic = {
      code: "catalog_unreachable",
      severity: "error",
      message: messageFromError(error),
      path: resolvedSource,
      suggestedFix: catalogDoctorSourceFix(resolvedSource)
    };
    return {
      ok: false,
      source: resolvedSource,
      auth,
      catalog: {
        reachable: false,
        version: null,
        entries: 0
      },
      packages,
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  diagnostics.push(...loaded.diagnostics);
  for (const entry of loaded.catalog.entries) {
    packages.push(checkCatalogDoctorPackage(entry));
  }
  const packageDiagnostics = packages.flatMap((entry) => entry.diagnostics);
  const allDiagnostics = [...diagnostics, ...packageDiagnostics];
  const errors = allDiagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    source: loaded.source,
    auth,
    catalog: {
      reachable: true,
      version: loaded.catalog.version,
      entries: loaded.catalog.entries.length
    },
    packages,
    diagnostics: allDiagnostics,
    errors
  };
}

/**
 * @param {string} source
 * @returns {{ githubTokenEnv: boolean, ghTokenEnv: boolean, ghCli: { checked: boolean, available: boolean, authenticated: boolean, reason: string|null } }}
 */
export function buildCatalogDoctorAuth(source) {
  const shouldCheckGh = source.startsWith("github:");
  return githubAuthStatus({
    checkGh: shouldCheckGh && !process.env.GITHUB_TOKEN && !process.env.GH_TOKEN
  });
}

/**
 * @param {any} entry
 * @returns {{ id: string, kind: string, package: string, version: string, packageSpec: string, ok: boolean, checkedVersion: string|null, diagnostics: any[] }}
 */
function checkCatalogDoctorPackage(entry) {
  const packageSpec = catalogEntryPackageSpec(entry);
  const result = runNpmViewPackageSpec(packageSpec);
  if (result.status === 0) {
    const checkedVersion = String(result.stdout || "").trim().replace(/^"|"$/g, "");
    return {
      id: entry.id,
      kind: entry.kind,
      package: entry.package,
      version: entry.defaultVersion,
      packageSpec,
      ok: checkedVersion === entry.defaultVersion,
      checkedVersion: checkedVersion || null,
      diagnostics: checkedVersion === entry.defaultVersion ? [] : [{
        code: "catalog_package_version_mismatch",
        severity: "error",
        message: `Catalog entry '${entry.id}' expected ${packageSpec}, but npm returned '${checkedVersion || "(empty)"}'.`,
        path: entry.id,
        suggestedFix: "Check defaultVersion in the catalog, or publish the referenced package version."
      }]
    };
  }
  const diagnostic = catalogDoctorPackageDiagnostic(entry, packageSpec, result);
  return {
    id: entry.id,
    kind: entry.kind,
    package: entry.package,
    version: entry.defaultVersion,
    packageSpec,
    ok: false,
    checkedVersion: null,
    diagnostics: [diagnostic]
  };
}

/**
 * @param {string} packageSpec
 * @returns {{ status: number|null, stdout: string, stderr: string, error?: Error }}
 */
export function runNpmViewPackageSpec(packageSpec) {
  assertSafeNpmSpec(packageSpec);
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  return childProcess.spawnSync(npmBin, ["view", "--json", "--", packageSpec, "version"], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...localNpmrcEnv(process.cwd()),
      PATH: process.env.PATH || ""
    }
  });
}

/**
 * @param {any} entry
 * @param {string} packageSpec
 * @param {{ stdout?: string, stderr?: string, error?: Error }} result
 * @returns {any}
 */
export function catalogDoctorPackageDiagnostic(entry, packageSpec, result) {
  const output = [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  const normalized = output.toLowerCase();
  if (result.error?.message && result.error.message.includes("ENOENT")) {
    return {
      code: "npm_not_found",
      severity: "error",
      message: "npm is required to check catalog package access.",
      path: entry.id,
      suggestedFix: "Install npm with Node.js, then rerun `topogram catalog doctor`."
    };
  }
  if (/\b(401|e401|authentication|auth token|login)\b/.test(normalized)) {
    return {
      code: "catalog_package_auth_required",
      severity: "error",
      message: `Authentication is required to inspect package '${packageSpec}'.`,
      path: entry.id,
      suggestedFix: "Configure registry-specific npm auth when using private packages."
    };
  }
  if (/\b(403|e403|forbidden|permission|denied)\b/.test(normalized)) {
    return {
      code: "catalog_package_access_denied",
      severity: "error",
      message: `Package access was denied for '${packageSpec}'.`,
      path: entry.id,
      suggestedFix: "Check package visibility and registry-specific npm auth for the consumer environment."
    };
  }
  if (/\b(404|e404|not found)\b/.test(normalized)) {
    return {
      code: "catalog_package_not_found",
      severity: "error",
      message: `Package '${packageSpec}' was not found, or the current npm token cannot see it.`,
      path: entry.id,
      suggestedFix: "Check the package name/version and npm package registry access."
    };
  }
  return {
    code: "catalog_package_check_failed",
    severity: "error",
    message: `Failed to inspect package '${packageSpec}'.${output ? `\n${output}` : ""}`,
    path: entry.id,
    suggestedFix: "Run `npm view <package>@<version> version --json` with the same npm auth configuration to debug package access."
  };
}

/**
 * @param {string} source
 * @returns {string}
 */
function catalogDoctorSourceFix(source) {
  if (source.startsWith("github:")) {
    return "Set GITHUB_TOKEN or GH_TOKEN with repository read access, use `gh auth login` only as a local no-token fallback, or pass --catalog ./topograms.catalog.json.";
  }
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return "Check the catalog URL and token access, or pass --catalog ./topograms.catalog.json.";
  }
  return "Check the local catalog path and run `topogram catalog check <path>`.";
}

/**
 * @param {ReturnType<typeof buildCatalogDoctorPayload>} payload
 * @returns {void}
 */
export function printCatalogDoctor(payload) {
  console.log(payload.ok ? "Catalog doctor passed." : "Catalog doctor found issues.");
  console.log(`Source: ${payload.source}`);
  if (payload.source.startsWith("github:")) {
    const tokenStatus = payload.auth.githubTokenEnv || payload.auth.ghTokenEnv ? "yes" : "no";
    const ghStatus = payload.auth.ghCli.checked
      ? `${payload.auth.ghCli.authenticated ? "authenticated" : "not authenticated"}${payload.auth.ghCli.reason ? ` (${payload.auth.ghCli.reason})` : ""}`
      : "not checked";
    console.log(`GitHub token env: ${tokenStatus}`);
    console.log(`gh auth: ${ghStatus}`);
  }
  console.log(`Catalog reachable: ${payload.catalog.reachable ? "yes" : "no"}`);
  if (payload.catalog.reachable) {
    console.log(`Version: ${payload.catalog.version}`);
    console.log(`Entries: ${payload.catalog.entries}`);
  }
  if (payload.packages.length > 0) {
    console.log("Packages:");
    for (const item of payload.packages) {
      console.log(`- ${item.id} (${item.kind}): ${item.packageSpec} ${item.ok ? "ok" : "failed"}`);
      for (const diagnostic of item.diagnostics) {
        console.log(`  Error: ${diagnostic.message}`);
        if (diagnostic.suggestedFix) {
          console.log(`  Fix: ${diagnostic.suggestedFix}`);
        }
      }
    }
  }
  const packageIds = new Set(payload.packages.map((item) => item.id));
  for (const diagnostic of payload.diagnostics.filter((item) => !item.path || !packageIds.has(item.path))) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
    if (diagnostic.suggestedFix) {
      console.log(`Fix: ${diagnostic.suggestedFix}`);
    }
  }
}
