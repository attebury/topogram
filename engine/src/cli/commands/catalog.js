// @ts-check

import childProcess from "node:child_process";
import path from "node:path";

import { stableStringify } from "../../format.js";
import {
  catalogEntryPackageSpec,
  catalogSourceOrDefault,
  checkCatalogSource,
  copyCatalogTopogramEntry,
  findCatalogEntry,
  loadCatalog,
  TOPOGRAM_SOURCE_FILE
} from "../../catalog.js";
import { githubAuthStatus } from "../../github-client.js";
import { assertSafeNpmSpec, localNpmrcEnv } from "../../npm-safety.js";

/**
 * @returns {void}
 */
export function printCatalogHelp() {
  console.log("Usage: topogram catalog list [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog show <id> [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog doctor [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog check <path-or-url> [--json]");
  console.log("   or: topogram catalog copy <id> <target> [--version <version>] [--json] [--catalog <path-or-source>]");
  console.log("");
  console.log("Catalog commands inspect the shared Topogram index. The catalog is an index; templates and topograms resolve to versioned packages.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram catalog list");
  console.log("  topogram catalog show hello-web");
  console.log("  topogram catalog doctor");
  console.log("  topogram catalog check topograms.catalog.json");
  console.log("  topogram catalog copy hello ./hello-topogram");
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} value
 * @returns {string}
 */
export function shellCommandArg(value) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value);
}

/**
 * @param {string|null} source
 * @returns {{ ok: boolean, source: string, catalog: any, entries: any[], diagnostics: any[], errors: string[] }}
 */
export function buildCatalogListPayload(source) {
  const loaded = loadCatalog(source || null);
  return {
    ok: true,
    source: loaded.source,
    catalog: {
      version: loaded.catalog.version,
      entries: loaded.catalog.entries.length
    },
    entries: loaded.catalog.entries,
    diagnostics: loaded.diagnostics,
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildCatalogListPayload>} payload
 * @returns {void}
 */
export function printCatalogList(payload) {
  console.log("Catalog entries:");
  console.log("Template entries create starters with `topogram new`; topogram entries copy editable Topogram source.");
  console.log(`Catalog: ${payload.source}`);
  console.log(`Version: ${payload.catalog.version}`);
  const catalogOption = payload.source === catalogSourceOrDefault(null)
    ? ""
    : ` --catalog ${shellCommandArg(payload.source)}`;
  for (const entry of payload.entries) {
    console.log(`- ${entry.id} (${entry.kind})`);
    console.log(`  Package: ${entry.package}@${entry.defaultVersion}`);
    console.log(`  Description: ${entry.description}`);
    console.log(`  Trust scope: ${entry.trust.scope}`);
    console.log(`  Executable implementation: ${entry.trust.includesExecutableImplementation ? "yes" : "no"}`);
    if (entry.kind === "template") {
      console.log(`  New: topogram new ./my-app --template ${shellCommandArg(entry.id)}${catalogOption}`);
    } else {
      console.log(`  Copy: topogram catalog copy ${shellCommandArg(entry.id)} ./${entry.id}-topogram${catalogOption}`);
    }
  }
}

/**
 * @param {string} id
 * @param {string|null} source
 * @returns {{ ok: boolean, source: string, catalog: { version: string }, entry: any|null, packageSpec: string|null, commands: { primary: string|null, followUp: string[] }, diagnostics: any[], errors: string[] }}
 */
export function buildCatalogShowPayload(id, source) {
  if (!id || id.startsWith("-")) {
    throw new Error("topogram catalog show requires <id>.");
  }
  const loaded = loadCatalog(source || null);
  const entry = findCatalogEntry(loaded.catalog, id, null);
  if (!entry) {
    const diagnostic = {
      code: "catalog_entry_not_found",
      severity: "error",
      message: `Catalog entry '${id}' was not found in ${loaded.source}.`,
      path: loaded.source,
      suggestedFix: "Run `topogram catalog list` to see available entries."
    };
    return {
      ok: false,
      source: loaded.source,
      catalog: { version: loaded.catalog.version },
      entry: null,
      packageSpec: null,
      commands: { primary: null, followUp: [] },
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  return {
    ok: true,
    source: loaded.source,
    catalog: { version: loaded.catalog.version },
    entry,
    packageSpec: catalogEntryPackageSpec(entry),
    commands: catalogShowCommands(entry, loaded.source),
    diagnostics: loaded.diagnostics,
    errors: []
  };
}

/**
 * @param {any} entry
 * @param {string} source
 * @returns {{ primary: string, followUp: string[] }}
 */
export function catalogShowCommands(entry, source) {
  const catalogOption = source === catalogSourceOrDefault(null)
    ? ""
    : ` --catalog ${shellCommandArg(source)}`;
  if (entry.kind === "template") {
    const target = "./my-app";
    return {
      primary: `topogram new ${target} --template ${shellCommandArg(entry.id)}${catalogOption}`,
      followUp: [
        `cd ${target}`,
        "npm install",
        "npm run check",
        "npm run generate"
      ]
    };
  }
  const target = `./${entry.id}-topogram`;
  return {
    primary: `topogram catalog copy ${shellCommandArg(entry.id)} ${target}${catalogOption}`,
    followUp: [
      `cd ${target}`,
      "topogram source status --local",
      "topogram check",
      "topogram generate"
    ]
  };
}

/**
 * @param {ReturnType<typeof buildCatalogShowPayload>} payload
 * @returns {void}
 */
export function printCatalogShow(payload) {
  if (!payload.ok || !payload.entry) {
    console.log("Catalog entry not found.");
    console.log(`Catalog: ${payload.source}`);
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`${label}: ${diagnostic.message}`);
    }
    return;
  }
  const { entry } = payload;
  console.log(`Catalog entry: ${entry.id}`);
  console.log(`Kind: ${entry.kind}`);
  if (entry.kind === "template") {
    console.log("Action: creates a starter app workspace with `topogram new`.");
  } else {
    console.log("Action: copies editable Topogram source with `topogram catalog copy`.");
    console.log("Executable implementation: no (topogram entries cannot include implementation/ in v1).");
  }
  console.log(`Catalog: ${payload.source}`);
  console.log(`Package: ${payload.packageSpec}`);
  console.log(`Description: ${entry.description}`);
  console.log(`Tags: ${entry.tags.join(", ") || "none"}`);
  console.log(`Trust scope: ${entry.trust.scope}`);
  if (entry.kind === "template") {
    console.log(`Executable implementation: ${entry.trust.includesExecutableImplementation ? "yes" : "no"}`);
  }
  if (entry.trust.notes) {
    console.log(`Trust notes: ${entry.trust.notes}`);
  }
  console.log("");
  console.log("Recommended command:");
  console.log(`  ${payload.commands.primary}`);
  if (payload.commands.followUp.length > 0) {
    console.log("Follow-up:");
    for (const command of payload.commands.followUp) {
      console.log(`  ${command}`);
    }
  }
  if (entry.kind === "topogram") {
    console.log("");
    console.log(`${TOPOGRAM_SOURCE_FILE} will record copy provenance only. Local edits are allowed.`);
  }
}

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

/**
 * @param {string} source
 * @returns {ReturnType<typeof checkCatalogSource>}
 */
export function buildCatalogCheckPayload(source) {
  if (!source) {
    throw new Error("topogram catalog check requires <path-or-url>.");
  }
  return checkCatalogSource(source);
}

/**
 * @param {ReturnType<typeof checkCatalogSource>} payload
 * @returns {void}
 */
export function printCatalogCheck(payload) {
  console.log(payload.ok ? "Catalog check passed." : "Catalog check failed.");
  console.log(`Source: ${payload.source}`);
  if (payload.catalog) {
    console.log(`Version: ${payload.catalog.version}`);
    console.log(`Entries: ${payload.catalog.entries.length}`);
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
  }
}

/**
 * @param {string} id
 * @param {string} targetPath
 * @param {{ source?: string|null, version?: string|null }} options
 * @returns {{ ok: boolean, source: string, id: string, kind: "topogram", packageSpec: string, targetPath: string, provenancePath: string, files: string[], diagnostics: any[], errors: string[] }}
 */
export function buildCatalogCopyPayload(id, targetPath, options) {
  if (!id || id.startsWith("-")) {
    throw new Error("topogram catalog copy requires <id>.");
  }
  if (!targetPath || targetPath.startsWith("-")) {
    throw new Error("topogram catalog copy requires <target>.");
  }
  const loaded = loadCatalog(options.source || null);
  const entry = findCatalogEntry(loaded.catalog, id, "topogram");
  if (!entry) {
    throw new Error(`Catalog topogram entry '${id}' was not found in ${loaded.source}.`);
  }
  const copied = copyCatalogTopogramEntry(entry, targetPath, {
    catalogSource: loaded.source,
    version: options.version || null
  });
  return {
    source: loaded.source,
    ...copied,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildCatalogCopyPayload>} payload
 * @returns {void}
 */
export function printCatalogCopy(payload) {
  console.log(`Copied catalog topogram '${payload.id}' to ${payload.targetPath}.`);
  console.log(`Package: ${payload.packageSpec}`);
  console.log(`Source provenance: ${payload.provenancePath}`);
  console.log(`Files: ${payload.files.length}`);
  console.log(`${TOPOGRAM_SOURCE_FILE} records catalog-copy provenance only. Local edits are allowed.`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${shellCommandArg(path.relative(process.cwd(), payload.targetPath) || ".")}`);
  console.log("  topogram source status --local");
  console.log("  topogram check");
  console.log("  topogram generate");
}

/**
 * @param {{
 *   commandArgs: Record<string, any>,
 *   inputPath: string|null|undefined,
 *   catalogSource: string|null,
 *   requestedVersion: string|null,
 *   json: boolean
 * }} context
 * @returns {number}
 */
export function runCatalogCommand(context) {
  const { commandArgs, inputPath, catalogSource, requestedVersion, json } = context;
  if (commandArgs.catalogCommand === "list") {
    const payload = buildCatalogListPayload(catalogSource || inputPath || null);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogList(payload);
    }
    return 0;
  }

  if (commandArgs.catalogCommand === "show") {
    if (!inputPath) {
      console.error("Missing required <id>.");
      printCatalogHelp();
      return 1;
    }
    const payload = buildCatalogShowPayload(inputPath, catalogSource);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogShow(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.catalogCommand === "doctor") {
    const payload = buildCatalogDoctorPayload(catalogSource || inputPath || null);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogDoctor(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.catalogCommand === "check") {
    if (!inputPath) {
      console.error("Missing required <path-or-url>.");
      printCatalogHelp();
      return 1;
    }
    const payload = buildCatalogCheckPayload(inputPath);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogCheck(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.catalogCommand === "copy") {
    if (!commandArgs.catalogId || !inputPath) {
      console.error("Missing required <id> or <target>.");
      printCatalogHelp();
      return 1;
    }
    const payload = buildCatalogCopyPayload(commandArgs.catalogId, inputPath, {
      source: catalogSource,
      version: requestedVersion
    });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printCatalogCopy(payload);
    }
    return 0;
  }

  throw new Error(`Unknown catalog command '${commandArgs.catalogCommand}'`);
}
