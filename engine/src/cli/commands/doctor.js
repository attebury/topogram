// @ts-check

import {
  catalogSourceOrDefault,
  isCatalogSourceDisabled
} from "../../catalog.js";
import { LOCAL_NPMRC_ENV, localNpmrcStatus } from "../../npm-safety.js";
import { loadProjectConfig } from "../../project-config.js";
import {
  buildCatalogDoctorAuth,
  buildCatalogDoctorPayload
} from "./catalog.js";
import {
  checkDoctorNode,
  checkDoctorNpm,
  checkDoctorPackageAccess,
  CLI_PACKAGE_NAME,
  inspectTopogramCliLockfile,
  isLocalCliDependencySpec,
  normalizeRegistryUrl,
  NPMJS_REGISTRY,
  npmConfigGet,
  readInstalledCliPackageVersion,
  readProjectCliDependencySpec
} from "./package.js";
import { resolveTopoRoot } from "../../workspace-paths.js";

/**
 * @returns {void}
 */
export function printDoctorHelp() {
  console.log("Usage: topogram doctor [--json] [--catalog <path-or-source>]");
  console.log("");
  console.log("Checks local runtime, npm, public package access, CLI lockfile metadata, and catalog access.");
  console.log("");
  console.log("Fresh install check:");
  console.log("  npm install --save-dev @topogram/cli");
  console.log("  npx topogram doctor");
  console.log("  npx topogram template list");
  console.log("  npx topogram new ./my-app --template hello-web");
  console.log("");
  console.log("Related setup commands:");
  console.log("  topogram setup package-auth");
  console.log("  topogram setup catalog-auth");
  console.log("");
  console.log("Examples:");
  console.log("  topogram doctor");
  console.log("  topogram doctor --json");
  console.log("  topogram doctor --catalog ./topograms.catalog.json");
  console.log("  topogram catalog doctor");
  console.log("");
  console.log("Use `catalog doctor` when you only want catalog/package-access diagnostics. Use `doctor --catalog` for the full environment check plus catalog diagnostics.");
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
function normalizeTopogramPath(inputPath) {
  return resolveTopoRoot(inputPath);
}

/**
 * @param {string|null} source
 * @returns {{ ok: boolean, node: ReturnType<typeof checkDoctorNode>, npm: ReturnType<typeof checkDoctorNpm>, localNpmrc: ReturnType<typeof localNpmrcStatus>, packageRegistry: { required: boolean, reason: string|null, registry: string, configuredRegistry: string|null, registryConfigured: boolean, nodeAuthTokenEnv: boolean, packageName: string, packageSpec: string|null, packageAccess: { ok: boolean, checkedVersion: string|null, diagnostics: any[] } }, lockfile: ReturnType<typeof inspectTopogramCliLockfile>, catalog: ReturnType<typeof buildCatalogDoctorPayload>, diagnostics: any[], errors: string[] }}
 */
export function buildDoctorPayload(source) {
  const projectCliDependency = readProjectCliDependencySpec(process.cwd());
  const packageRegistryRequired = !isLocalCliDependencySpec(projectCliDependency);
  const node = checkDoctorNode();
  const npm = checkDoctorNpm();
  const configuredRegistry = npm.available ? npmConfigGet("@topogram:registry") : null;
  const registryConfigured = !configuredRegistry ||
    normalizeRegistryUrl(configuredRegistry) === normalizeRegistryUrl(NPMJS_REGISTRY);
  const registryDiagnostics = [];
  if (packageRegistryRequired && npm.available && !registryConfigured) {
    registryDiagnostics.push({
      code: "package_registry_registry_not_configured",
      severity: "error",
      message: `npm is configured to resolve @topogram packages from '${configuredRegistry}', not ${NPMJS_REGISTRY}.`,
      path: ".npmrc",
      suggestedFix: "Remove the custom @topogram registry config or set it to https://registry.npmjs.org, then rerun `topogram doctor`."
    });
  }
  const packageSpec = packageRegistryRequired ? `${CLI_PACKAGE_NAME}@${readInstalledCliPackageVersion()}` : null;
  const packageAccess = packageRegistryRequired && npm.available
    ? checkDoctorPackageAccess(packageSpec || CLI_PACKAGE_NAME)
    : packageRegistryRequired ? {
        ok: false,
        checkedVersion: null,
        diagnostics: [{
          code: "npm_not_found",
          severity: "error",
          message: "npm is required to inspect the Topogram CLI package.",
          path: null,
          suggestedFix: "Install Node.js/npm, then rerun `topogram doctor`."
        }]
      } : {
        ok: true,
        checkedVersion: null,
        diagnostics: []
      };
  const catalog = buildDoctorCatalogPayload(source);
  const lockfile = inspectTopogramCliLockfile(process.cwd());
  const diagnostics = [
    ...node.diagnostics,
    ...npm.diagnostics,
    ...registryDiagnostics,
    ...packageAccess.diagnostics,
    ...lockfile.diagnostics,
    ...catalog.diagnostics
  ];
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    node,
    npm,
    localNpmrc: localNpmrcStatus(process.cwd()),
    packageRegistry: {
      required: packageRegistryRequired,
      reason: packageRegistryRequired ? null : `Project uses local CLI dependency '${projectCliDependency}'.`,
      registry: NPMJS_REGISTRY,
      configuredRegistry,
      registryConfigured,
      nodeAuthTokenEnv: Boolean(process.env.NODE_AUTH_TOKEN),
      packageName: CLI_PACKAGE_NAME,
      packageSpec,
      packageAccess
    },
    lockfile,
    catalog,
    diagnostics,
    errors
  };
}

/**
 * @param {string|null} source
 * @returns {ReturnType<typeof buildCatalogDoctorPayload>}
 */
function buildDoctorCatalogPayload(source) {
  const resolvedSource = resolveDoctorCatalogSource(source);
  if (isCatalogSourceDisabled(resolvedSource)) {
    return {
      ok: true,
      source: resolvedSource,
      auth: buildCatalogDoctorAuth(resolvedSource),
      catalog: {
        reachable: false,
        version: null,
        entries: 0
      },
      packages: [],
      diagnostics: [{
        code: "catalog_check_skipped",
        severity: "warning",
        message: "Catalog access check was skipped for this project.",
        path: null,
        suggestedFix: "Pass --catalog <source> to check a catalog explicitly."
      }],
      errors: []
    };
  }
  return buildCatalogDoctorPayload(resolvedSource);
}

/**
 * @param {string|null} source
 * @returns {string}
 */
function resolveDoctorCatalogSource(source) {
  if (source) {
    return source;
  }
  const projectConfigInfo = loadProjectConfig(normalizeTopogramPath(process.cwd()));
  if (projectConfigInfo) {
    const catalog = projectConfigInfo.config?.template?.catalog;
    if (catalog && typeof catalog.source === "string" && catalog.source) {
      return catalog.source;
    }
    return "none";
  }
  return catalogSourceOrDefault(null);
}

/**
 * @param {ReturnType<typeof buildDoctorPayload>} payload
 * @returns {void}
 */
function printDoctorSetupGuidance(payload) {
  console.log("Setup guidance:");
  if (payload.packageRegistry.required) {
    console.log(`- CLI package access: public @topogram packages should install from ${payload.packageRegistry.registry} without auth.`);
  } else {
    console.log("- CLI package auth: skipped because this project uses a local Topogram CLI dependency.");
  }
  if (isCatalogSourceDisabled(payload.catalog.source)) {
    console.log("- Catalog auth: skipped because catalog discovery is disabled for this project.");
  } else {
    console.log("- Catalog auth: the default catalog is public; private catalogs should use GITHUB_TOKEN or GH_TOKEN. Local `gh auth login` is only a no-token fallback.");
  }
  console.log("- Template package auth: private template packages may need registry-specific npm auth during npm install.");
  console.log(`- Local .npmrc: ignored by default. Use --allow-local-npmrc or ${LOCAL_NPMRC_ENV}=1 only after reviewing the file.`);
  console.log("- Catalog disabled mode: TOPOGRAM_CATALOG_SOURCE=none skips catalog aliases, including the default hello-web starter.");
}

/**
 * @param {ReturnType<typeof buildDoctorPayload>} payload
 * @returns {void}
 */
export function printDoctor(payload) {
  console.log(payload.ok ? "Topogram doctor passed." : "Topogram doctor found issues.");
  console.log(`Node: ${payload.node.version} (${payload.node.ok ? "ok" : `requires ${payload.node.minimum}`})`);
  console.log(`npm: ${payload.npm.available ? `${payload.npm.version || "available"} (ok)` : "not found"}`);
  console.log(`local .npmrc: ${payload.localNpmrc.exists ? (payload.localNpmrc.enabled ? "enabled" : "ignored") : "not found"}`);
  if (payload.localNpmrc.exists) {
    console.log(`local .npmrc reason: ${payload.localNpmrc.reason}`);
  }
  console.log(`npm registry: ${payload.packageRegistry.required ? (payload.packageRegistry.registryConfigured ? "ok" : "misconfigured") : "not required"}`);
  if (payload.packageRegistry.reason) {
    console.log(`npm registry reason: ${payload.packageRegistry.reason}`);
  }
  if (payload.packageRegistry.configuredRegistry) {
    console.log(`Configured @topogram registry: ${payload.packageRegistry.configuredRegistry}`);
  }
  console.log(`CLI package access: ${payload.packageRegistry.required ? (payload.packageRegistry.packageAccess.ok ? `${payload.packageRegistry.packageSpec} ok` : `${payload.packageRegistry.packageSpec} failed`) : "not checked"}`);
  if (payload.lockfile.checked && payload.lockfile.packageVersion) {
    console.log(`CLI lockfile: ${payload.lockfile.packageVersion}${payload.lockfile.refreshRecommended ? " (refresh recommended)" : " (ok)"}`);
  }
  console.log(`Catalog source: ${payload.catalog.source}`);
  console.log(`Catalog reachable: ${payload.catalog.catalog.reachable ? "yes" : "no"}`);
  if (payload.catalog.catalog.reachable) {
    console.log(`Catalog entries: ${payload.catalog.catalog.entries}`);
    const failedPackages = payload.catalog.packages.filter((item) => !item.ok).length;
    console.log(`Catalog package access: ${failedPackages === 0 ? "ok" : `${failedPackages} failed`}`);
  }
  if (payload.catalog.source !== "none" || payload.catalog.catalog.reachable || payload.packageRegistry.required) {
    console.log("Project provenance: run `topogram source status --local` for catalog, template, trust, and baseline details.");
  }
  printDoctorSetupGuidance(payload);
  if (payload.diagnostics.length > 0) {
    console.log("Diagnostics:");
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`- ${label}: ${diagnostic.message}`);
      if (diagnostic.suggestedFix) {
        console.log(`  Fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
}
