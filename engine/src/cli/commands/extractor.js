// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import { checkExtractorPack } from "../../extractor/check.js";
import {
  EXTRACTOR_MANIFESTS,
  getExtractorManifest,
  loadPackageExtractorManifest,
  packageExtractorInstallCommand
} from "../../extractor/registry.js";
import {
  defaultExtractorPolicy,
  effectiveExtractorPolicy,
  EXTRACTOR_POLICY_FILE,
  extractorPackageAllowed,
  extractorPolicyDiagnosticsForPackages,
  loadExtractorPolicy,
  packageScopeFromName,
  parseExtractorPolicyPin,
  writeExtractorPolicy
} from "../../extractor-policy.js";

export function printExtractorHelp() {
  console.log("Usage: topogram extractor list [--json]");
  console.log("   or: topogram extractor show <id-or-package> [--json]");
  console.log("   or: topogram extractor check <path-or-package> [--json]");
  console.log("   or: topogram extractor policy init [path] [--json]");
  console.log("   or: topogram extractor policy status [path] [--json]");
  console.log("   or: topogram extractor policy check [path] [--json]");
  console.log("   or: topogram extractor policy explain [path] [--json]");
  console.log("   or: topogram extractor policy pin [package@version] [path] [--json]");
  console.log("");
  console.log("Inspects extractor manifests and checks extractor pack conformance.");
  console.log("");
  console.log("Notes:");
  console.log("  - extractor packages execute only during `topogram extract` or `topogram extractor check`.");
  console.log("  - extractor packages emit review-only candidates; core owns persistence, reconcile, and adoption.");
  console.log(`  - package-backed extractors are governed by ${EXTRACTOR_POLICY_FILE}; bundled topogram/* extractors are allowed.`);
  console.log("");
  console.log("Examples:");
  console.log("  topogram extractor list");
  console.log("  topogram extractor show topogram/api-extractors");
  console.log("  topogram extractor check ./extractor-package");
  console.log("  topogram extractor policy init");
  console.log("  topogram extractor policy pin @topogram/extractor-react-router@1");
}

/**
 * @param {string} cwd
 * @returns {string[]}
 */
function declaredExtractorPackages(cwd) {
  const packagePath = path.join(cwd, "package.json");
  if (!fs.existsSync(packagePath)) {
    return [];
  }
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const dependencyBuckets = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.optionalDependencies,
    packageJson.peerDependencies
  ];
  const packages = new Set();
  for (const dependencies of dependencyBuckets) {
    if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      continue;
    }
    for (const name of Object.keys(dependencies)) {
      if (name.includes("topogram-extractor") || name.startsWith("@topogram/extractor-")) {
        packages.add(name);
      }
    }
  }
  return [...packages].sort();
}

/**
 * @param {any} manifest
 * @param {{ installed?: boolean, manifestPath?: string|null, packageRoot?: string|null, errors?: string[] }} [metadata]
 * @returns {Record<string, any>}
 */
function extractorManifestSummary(manifest, metadata = {}) {
  const installCommand = manifest.package ? packageExtractorInstallCommand(manifest.package) : null;
  return {
    id: manifest.id,
    version: manifest.version,
    tracks: manifest.tracks || [],
    extractors: manifest.extractors || [],
    stack: manifest.stack || {},
    capabilities: manifest.capabilities || {},
    candidateKinds: manifest.candidateKinds || [],
    evidenceTypes: manifest.evidenceTypes || [],
    source: manifest.source,
    loadsAdapter: false,
    executesPackageCode: false,
    ...(manifest.package ? { package: manifest.package } : {}),
    ...(installCommand ? { installCommand } : {}),
    installed: metadata.installed !== false,
    manifestPath: metadata.manifestPath || null,
    packageRoot: metadata.packageRoot || null,
    errors: metadata.errors || []
  };
}

/**
 * @param {string} cwd
 * @returns {{ ok: boolean, cwd: string, extractors: Record<string, any>[], summary: Record<string, number> }}
 */
export function buildExtractorListPayload(cwd) {
  const extractors = EXTRACTOR_MANIFESTS
    .map((manifest) => extractorManifestSummary(manifest))
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const packageName of declaredExtractorPackages(cwd)) {
    const loaded = loadPackageExtractorManifest(packageName, cwd);
    if (loaded.manifest) {
      extractors.push(extractorManifestSummary(loaded.manifest, {
        installed: true,
        manifestPath: loaded.manifestPath,
        packageRoot: loaded.packageRoot,
        errors: loaded.errors
      }));
    } else {
      extractors.push({
        id: null,
        version: null,
        tracks: [],
        extractors: [],
        stack: {},
        capabilities: {},
        candidateKinds: [],
        evidenceTypes: [],
        source: "package",
        package: packageName,
        installCommand: packageExtractorInstallCommand(packageName),
        installed: false,
        manifestPath: loaded.manifestPath,
        packageRoot: loaded.packageRoot,
        errors: loaded.errors
      });
    }
  }
  extractors.sort((left, right) => String(left.id || left.package || "").localeCompare(String(right.id || right.package || "")));
  return {
    ok: extractors.every((extractor) => extractor.errors.length === 0),
    cwd,
    extractors,
    summary: {
      total: extractors.length,
      bundled: extractors.filter((extractor) => extractor.source === "bundled").length,
      package: extractors.filter((extractor) => extractor.source === "package").length,
      installed: extractors.filter((extractor) => extractor.installed).length
    }
  };
}

/**
 * @param {string} spec
 * @param {string} cwd
 * @returns {{ ok: boolean, sourceSpec: string, extractor: Record<string, any>|null, errors: string[] }}
 */
export function buildExtractorShowPayload(spec, cwd) {
  if (!spec || spec.startsWith("-")) {
    return { ok: false, sourceSpec: spec || "", extractor: null, errors: ["Usage: topogram extractor show <id-or-package>"] };
  }
  const bundled = getExtractorManifest(spec);
  if (bundled) {
    return { ok: true, sourceSpec: spec, extractor: extractorManifestSummary(bundled), errors: [] };
  }
  const loaded = loadPackageExtractorManifest(spec, cwd);
  if (loaded.manifest) {
    return {
      ok: true,
      sourceSpec: spec,
      extractor: extractorManifestSummary(loaded.manifest, {
        installed: true,
        manifestPath: loaded.manifestPath,
        packageRoot: loaded.packageRoot,
        errors: loaded.errors
      }),
      errors: []
    };
  }
  return { ok: false, sourceSpec: spec, extractor: null, errors: loaded.errors };
}

/**
 * @param {ReturnType<typeof buildExtractorListPayload>} payload
 * @returns {void}
 */
export function printExtractorList(payload) {
  console.log("Topogram extractors");
  console.log(`Bundled: ${payload.summary.bundled}; package-backed: ${payload.summary.package}; installed: ${payload.summary.installed}`);
  console.log("");
  for (const extractor of payload.extractors) {
    const id = extractor.id || extractor.package || "unknown";
    const status = extractor.errors.length > 0
      ? "invalid"
      : extractor.source === "package"
        ? (extractor.installed ? "package installed" : "package missing")
        : "bundled";
    console.log(`- ${id}${extractor.version ? `@${extractor.version}` : ""} (${extractor.tracks.join(", ") || "unknown"}, ${status})`);
    console.log(`  Source: ${extractor.source}`);
    console.log("  Adapter loaded: no");
    console.log("  Executes package code: no");
    console.log(`  Extractors: ${extractor.extractors.join(", ") || "none"}`);
    if (extractor.package) console.log(`  Package: ${extractor.package}`);
    if (extractor.installCommand) console.log(`  Install: ${extractor.installCommand}`);
    for (const error of extractor.errors || []) console.log(`  Error: ${error}`);
  }
}

/**
 * @param {ReturnType<typeof buildExtractorShowPayload>} payload
 * @returns {void}
 */
export function printExtractorShow(payload) {
  if (!payload.ok || !payload.extractor) {
    console.log("Extractor pack not found.");
    for (const error of payload.errors || []) console.log(`- ${error}`);
    return;
  }
  const extractor = payload.extractor;
  console.log(`Extractor pack: ${extractor.id}@${extractor.version}`);
  console.log(`Tracks: ${extractor.tracks.join(", ") || "none"}`);
  console.log(`Source: ${extractor.source}`);
  console.log("Adapter loaded: no");
  console.log("Executes package code: no");
  if (extractor.package) console.log(`Package: ${extractor.package}`);
  if (extractor.installCommand) console.log(`Install: ${extractor.installCommand}`);
  if (extractor.manifestPath) console.log(`Manifest: ${extractor.manifestPath}`);
  console.log(`Extractors: ${extractor.extractors.join(", ") || "none"}`);
  console.log(`Candidate kinds: ${extractor.candidateKinds.join(", ") || "none"}`);
  console.log(`Evidence types: ${extractor.evidenceTypes.join(", ") || "none"}`);
}

/**
 * @param {ReturnType<typeof checkExtractorPack>} payload
 * @returns {void}
 */
export function printExtractorCheck(payload) {
  console.log(payload.ok ? "Extractor check passed." : "Extractor check found issues.");
  console.log(`Source: ${payload.sourceSpec}`);
  console.log(`Type: ${payload.source}`);
  if (payload.packageName) console.log(`Package: ${payload.packageName}`);
  if (payload.manifestPath) console.log(`Manifest: ${payload.manifestPath}`);
  if (payload.manifest) {
    console.log(`Extractor pack: ${payload.manifest.id}@${payload.manifest.version}`);
    console.log(`Tracks: ${payload.manifest.tracks.join(", ")}`);
    console.log(`Source mode: ${payload.manifest.source}`);
  }
  console.log("Executes package code: yes (loads adapter and runs smoke extract)");
  console.log("");
  console.log("Checks:");
  for (const check of payload.checks || []) {
    console.log(`- ${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.message}`);
  }
  if (payload.smoke) {
    console.log("");
    console.log(`Smoke output: ${payload.smoke.extractors} extractor(s), ${payload.smoke.findings} finding(s), ${payload.smoke.candidateKeys} candidate bucket(s), ${payload.smoke.diagnostics} diagnostic(s)`);
  }
  for (const error of payload.errors || []) console.log(`Error: ${error}`);
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, defaulted: boolean, packages: any[], diagnostics: any[], errors: string[], summary: Record<string, number> }}
 */
export function buildExtractorPolicyStatusPayload(projectPath) {
  const root = path.resolve(projectPath || ".");
  const policyInfo = loadExtractorPolicy(root);
  const policy = effectiveExtractorPolicy(policyInfo);
  const packages = policy.enabledPackages.map((packageName) => {
    const loaded = loadPackageExtractorManifest(packageName, root);
    const version = loaded.manifest?.version || "unknown";
    const diagnostics = extractorPolicyDiagnosticsForPackages(policyInfo, [{ packageName, version }], "extractor-policy");
    return {
      packageName,
      version,
      allowed: extractorPackageAllowed(policy, packageName),
      installed: Boolean(loaded.manifest),
      manifestPath: loaded.manifestPath,
      packageRoot: loaded.packageRoot,
      errors: [...loaded.errors, ...diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message)]
    };
  });
  const diagnostics = [
    ...policyInfo.diagnostics,
    ...packages.flatMap((item) => item.errors.map((message) => ({
      code: "extractor_package_failed",
      severity: "error",
      message,
      path: item.manifestPath,
      suggestedFix: `Review or remove '${item.packageName}' from ${EXTRACTOR_POLICY_FILE}.`,
      step: "extractor-policy",
      packageName: item.packageName,
      version: item.version
    })))
  ];
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    path: policyInfo.path,
    exists: policyInfo.exists,
    policy,
    defaulted: !policyInfo.exists,
    packages,
    diagnostics,
    errors,
    summary: {
      enabledPackages: policy.enabledPackages.length,
      installed: packages.filter((item) => item.installed).length,
      allowed: packages.filter((item) => item.allowed).length,
      denied: packages.filter((item) => !item.allowed).length
    }
  };
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, policy: any, diagnostics: any[], errors: string[] }}
 */
export function buildExtractorPolicyInitPayload(projectPath) {
  const root = path.resolve(projectPath || ".");
  const policy = writeExtractorPolicy(root, defaultExtractorPolicy());
  return { ok: true, path: path.join(root, EXTRACTOR_POLICY_FILE), policy, diagnostics: [], errors: [] };
}

/**
 * @param {string} projectPath
 * @param {string|null|undefined} spec
 * @returns {{ ok: boolean, path: string, policy: any, pinned: Array<{ packageName: string, version: string }>, diagnostics: any[], errors: string[] }}
 */
export function buildExtractorPolicyPinPayload(projectPath, spec) {
  const root = path.resolve(projectPath || ".");
  const policyInfo = loadExtractorPolicy(root);
  const policy = policyInfo.policy || defaultExtractorPolicy();
  let pin;
  try {
    pin = parseExtractorPolicyPin(spec || "");
  } catch (error) {
    return {
      ok: false,
      path: policyInfo.path,
      policy,
      pinned: [],
      diagnostics: [{ severity: "error", code: "extractor_policy_pin_invalid", message: error instanceof Error ? error.message : String(error), path: policyInfo.path }],
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
  const nextPolicy = {
    ...policy,
    allowedPackages: policy.allowedPackages.includes(pin.packageName) ? policy.allowedPackages : [...policy.allowedPackages, pin.packageName],
    enabledPackages: policy.enabledPackages.includes(pin.packageName) ? policy.enabledPackages : [...policy.enabledPackages, pin.packageName],
    pinnedVersions: { ...policy.pinnedVersions, [pin.packageName]: pin.version }
  };
  writeExtractorPolicy(root, nextPolicy);
  return { ok: true, path: path.join(root, EXTRACTOR_POLICY_FILE), policy: nextPolicy, pinned: [pin], diagnostics: [], errors: [] };
}

/**
 * @param {ReturnType<typeof buildExtractorPolicyStatusPayload>} payload
 * @returns {void}
 */
export function printExtractorPolicyStatus(payload) {
  console.log(payload.ok ? "Extractor policy status: allowed" : "Extractor policy status: denied");
  console.log(`Policy file: ${payload.path}`);
  console.log(`Policy file exists: ${payload.exists ? "yes" : "no"}`);
  console.log(`Default policy active: ${payload.defaulted ? "yes" : "no"}`);
  console.log(`Enabled packages: ${payload.summary.enabledPackages}`);
  for (const item of payload.packages) {
    console.log(`- ${item.packageName}@${item.version}: ${item.installed ? "installed" : "missing"}, ${item.allowed ? "allowed" : "denied"}`);
  }
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
  }
}

/**
 * @param {ReturnType<typeof buildExtractorPolicyInitPayload>} payload
 * @returns {void}
 */
export function printExtractorPolicyInit(payload) {
  console.log(`Wrote extractor policy: ${payload.path}`);
  console.log(`Allowed package scopes: ${payload.policy.allowedPackageScopes.join(", ") || "(none)"}`);
  console.log(`Allowed packages: ${payload.policy.allowedPackages.join(", ") || "(none)"}`);
  console.log(`Enabled packages: ${payload.policy.enabledPackages.join(", ") || "(none)"}`);
}

/**
 * @param {ReturnType<typeof buildExtractorPolicyPinPayload>} payload
 * @returns {void}
 */
export function printExtractorPolicyPin(payload) {
  console.log(payload.ok ? "Extractor policy pin updated" : "Extractor policy pin failed");
  console.log(`Policy: ${payload.path}`);
  for (const pin of payload.pinned || []) {
    console.log(`Pinned: ${pin.packageName}@${pin.version}`);
  }
  for (const diagnostic of payload.diagnostics || []) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
  }
}

/**
 * @param {{ commandArgs: Record<string, any>, inputPath: string|null|undefined, json: boolean, cwd: string }} context
 * @returns {number}
 */
export function runExtractorCommand(context) {
  const { commandArgs, inputPath, json, cwd } = context;
  if (commandArgs.extractorCommand === "check") {
    const payload = checkExtractorPack(inputPath || "", { cwd });
    if (json) console.log(stableStringify(payload));
    else printExtractorCheck(payload);
    return payload.ok ? 0 : 1;
  }
  if (commandArgs.extractorCommand === "list") {
    const payload = buildExtractorListPayload(cwd);
    if (json) console.log(stableStringify(payload));
    else printExtractorList(payload);
    return payload.ok ? 0 : 1;
  }
  if (commandArgs.extractorCommand === "show") {
    const payload = buildExtractorShowPayload(inputPath || "", cwd);
    if (json) console.log(stableStringify(payload));
    else printExtractorShow(payload);
    return payload.ok ? 0 : 1;
  }
  if (commandArgs.extractorPolicyCommand === "init") {
    const payload = buildExtractorPolicyInitPayload(inputPath || ".");
    if (json) console.log(stableStringify(payload));
    else printExtractorPolicyInit(payload);
    return 0;
  }
  if (commandArgs.extractorPolicyCommand === "status" || commandArgs.extractorPolicyCommand === "check" || commandArgs.extractorPolicyCommand === "explain") {
    const payload = buildExtractorPolicyStatusPayload(inputPath || ".");
    if (json) console.log(stableStringify(payload));
    else printExtractorPolicyStatus(payload);
    return payload.ok ? 0 : 1;
  }
  if (commandArgs.extractorPolicyCommand === "pin") {
    const payload = buildExtractorPolicyPinPayload(inputPath || ".", commandArgs.extractorPolicyPinSpec);
    if (json) console.log(stableStringify(payload));
    else printExtractorPolicyPin(payload);
    return payload.ok ? 0 : 1;
  }
  throw new Error(`Unknown extractor command '${commandArgs.extractorCommand || commandArgs.extractorPolicyCommand}'`);
}
