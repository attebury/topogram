// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import { checkExtractorPack } from "../../extractor/check.js";
import { FIRST_PARTY_EXTRACTOR_PACKAGES, firstPartyExtractorInfo } from "../../extractor/first-party.js";
import { scaffoldExtractorPack } from "../../extractor/scaffold.js";
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

const EXTRACTOR_TRACK_ORDER = ["db", "api", "ui", "cli", "workflows", "verification", "unknown"];

export function printExtractorHelp() {
  console.log("Usage: topogram extractor list [--json]");
  console.log("   or: topogram extractor show <id-or-package> [--json]");
  console.log("   or: topogram extractor check <path-or-package> [--json]");
  console.log("   or: topogram extractor scaffold <target> [--track <track>] [--package <name>] [--id <manifest-id>] [--json]");
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
  console.log("  topogram extractor show @topogram/extractor-prisma-db");
  console.log("  topogram extractor check ./extractor-package");
  console.log("  topogram extractor scaffold ./topogram-extractor-node-cli --track cli --package @scope/topogram-extractor-node-cli");
  console.log("  topogram extractor policy init");
  console.log("  topogram extractor policy pin @topogram/extractor-node-cli@1");
  console.log("  topogram extract ./express-api --out ./imported-topogram --from api --extractor @topogram/extractor-express-api");
}

/**
 * @param {ReturnType<typeof scaffoldExtractorPack>} payload
 * @returns {void}
 */
export function printExtractorScaffold(payload) {
  console.log(payload.ok ? "Extractor scaffold created." : "Extractor scaffold failed.");
  console.log(`Target: ${payload.target}`);
  if (payload.packageName) console.log(`Package: ${payload.packageName}`);
  if (payload.manifestId) console.log(`Manifest id: ${payload.manifestId}`);
  if (payload.track) console.log(`Track: ${payload.track}`);
  if (payload.files.length > 0) {
    console.log("Files:");
    for (const file of payload.files) {
      console.log(`- ${file}`);
    }
  }
  if (payload.nextCommands.length > 0) {
    console.log("Next commands:");
    for (const command of payload.nextCommands) {
      console.log(`- ${command}`);
    }
  }
  for (const error of payload.errors || []) console.log(`Error: ${error}`);
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
 * @param {string|null|undefined} packageName
 * @param {string|null|undefined} version
 * @returns {string|null}
 */
function extractorPolicyPinCommand(packageName, version) {
  return packageName ? `topogram extractor policy pin ${packageName}@${version || "1"}` : null;
}

/**
 * @param {string|null|undefined} packageName
 * @param {string[]} tracks
 * @param {string|null|undefined} exampleSource
 * @returns {string|null}
 */
function extractorRunCommand(packageName, tracks, exampleSource) {
  if (!packageName) {
    return null;
  }
  const trackList = tracks.length > 0 ? tracks.join(",") : "db,api,ui,cli";
  return `topogram extract ${exampleSource || "./existing-app"} --out ./imported-topogram --from ${trackList} --extractor ${packageName}`;
}

/**
 * @param {Record<string, any>} extractor
 * @returns {{ id: string|null, package: string|null, label: string|null, source: string, installed: boolean, knownFirstParty: boolean, useWhen: string|null, extractCommand: string|null }}
 */
function groupExtractorEntry(extractor) {
  return {
    id: extractor.id || null,
    package: extractor.package || null,
    label: extractor.label || null,
    source: extractor.source,
    installed: Boolean(extractor.installed),
    knownFirstParty: Boolean(extractor.knownFirstParty),
    useWhen: extractor.useWhen || null,
    extractCommand: extractor.extractCommand || null
  };
}

/**
 * @param {Record<string, any>[]} extractors
 * @returns {Record<string, ReturnType<typeof groupExtractorEntry>[]>}
 */
function groupExtractorsByTrack(extractors) {
  /** @type {Record<string, ReturnType<typeof groupExtractorEntry>[]>} */
  const groups = {};
  for (const track of EXTRACTOR_TRACK_ORDER) {
    groups[track] = [];
  }
  for (const extractor of extractors) {
    const tracks = Array.isArray(extractor.tracks) && extractor.tracks.length > 0 ? extractor.tracks : ["unknown"];
    for (const track of tracks) {
      if (!groups[track]) {
        groups[track] = [];
      }
      groups[track].push(groupExtractorEntry(extractor));
    }
  }
  for (const entries of Object.values(groups)) {
    entries.sort((left, right) => String(left.label || left.id || left.package || "").localeCompare(String(right.label || right.id || right.package || "")));
  }
  return Object.fromEntries(Object.entries(groups).filter(([, entries]) => entries.length > 0));
}

/**
 * @param {any} manifest
 * @param {{ installed?: boolean, manifestPath?: string|null, packageRoot?: string|null, errors?: string[] }} [metadata]
 * @returns {Record<string, any>}
 */
function extractorManifestSummary(manifest, metadata = {}) {
  const firstParty = firstPartyExtractorInfo(manifest.package || manifest.id);
  const packageName = manifest.package || null;
  const tracks = manifest.tracks || [];
  const version = manifest.version || firstParty?.version || "1";
  const installCommand = packageName ? packageExtractorInstallCommand(packageName) : null;
  const policyPinCommand = extractorPolicyPinCommand(packageName, version);
  const extractCommand = extractorRunCommand(packageName, tracks, firstParty?.exampleSource);
  return {
    id: manifest.id,
    version,
    label: firstParty?.label || null,
    tracks,
    extractors: manifest.extractors || [],
    stack: manifest.stack || {},
    capabilities: manifest.capabilities || {},
    candidateKinds: manifest.candidateKinds || [],
    evidenceTypes: manifest.evidenceTypes || [],
    useWhen: firstParty?.useWhen || null,
    extracts: firstParty?.extracts || [],
    knownFirstParty: Boolean(firstParty),
    source: manifest.source,
    loadsAdapter: false,
    executesPackageCode: false,
    ...(packageName ? { package: packageName } : {}),
    ...(installCommand ? { installCommand } : {}),
    ...(policyPinCommand ? { policyPinCommand } : {}),
    ...(extractCommand ? { extractCommand } : {}),
    ...(packageName ? { showCommand: `topogram extractor show ${packageName}` } : {}),
    installed: metadata.installed !== false,
    manifestPath: metadata.manifestPath || null,
    packageRoot: metadata.packageRoot || null,
    errors: metadata.errors || []
  };
}

/**
 * @param {typeof FIRST_PARTY_EXTRACTOR_PACKAGES[number]} info
 * @returns {Record<string, any>}
 */
function firstPartyExtractorPlaceholder(info) {
  return {
    id: info.id,
    version: info.version,
    label: info.label,
    tracks: info.tracks,
    extractors: info.extractors,
    stack: info.stack,
    capabilities: info.capabilities,
    candidateKinds: info.candidateKinds,
    evidenceTypes: info.evidenceTypes,
    useWhen: info.useWhen,
    extracts: info.extracts,
    knownFirstParty: true,
    source: "package",
    loadsAdapter: false,
    executesPackageCode: false,
    package: info.package,
    installCommand: packageExtractorInstallCommand(info.package),
    policyPinCommand: extractorPolicyPinCommand(info.package, info.version),
    extractCommand: extractorRunCommand(info.package, info.tracks, info.exampleSource),
    showCommand: `topogram extractor show ${info.package}`,
    installed: false,
    manifestPath: null,
    packageRoot: null,
    errors: []
  };
}

/**
 * @param {string} cwd
 * @returns {{ ok: boolean, cwd: string, extractors: Record<string, any>[], groups: Record<string, ReturnType<typeof groupExtractorEntry>[]>, summary: Record<string, number> }}
 */
export function buildExtractorListPayload(cwd) {
  const extractors = EXTRACTOR_MANIFESTS
    .map((manifest) => extractorManifestSummary(manifest))
    .sort((left, right) => left.id.localeCompare(right.id));
  const seenPackages = new Set(extractors.map((extractor) => extractor.package).filter(Boolean));
  const seenIds = new Set(extractors.map((extractor) => extractor.id).filter(Boolean));
  for (const packageName of declaredExtractorPackages(cwd)) {
    const loaded = loadPackageExtractorManifest(packageName, cwd);
    if (loaded.manifest) {
      const summary = extractorManifestSummary(loaded.manifest, {
        installed: true,
        manifestPath: loaded.manifestPath,
        packageRoot: loaded.packageRoot,
        errors: loaded.errors
      });
      extractors.push(summary);
      if (summary.package) seenPackages.add(summary.package);
      if (summary.id) seenIds.add(summary.id);
    } else {
      const firstParty = firstPartyExtractorInfo(packageName);
      const fallback = firstParty ? firstPartyExtractorPlaceholder(firstParty) : {
        id: null,
        version: null,
        tracks: [],
        extractors: [],
        stack: {},
        capabilities: {},
        candidateKinds: [],
        evidenceTypes: [],
        useWhen: null,
        extracts: [],
        knownFirstParty: false,
        source: "package",
        package: packageName,
        installCommand: packageExtractorInstallCommand(packageName),
        policyPinCommand: null,
        extractCommand: null,
        showCommand: `topogram extractor show ${packageName}`,
        installed: false,
        manifestPath: loaded.manifestPath,
        packageRoot: loaded.packageRoot,
        errors: loaded.errors
      };
      extractors.push({ ...fallback, errors: loaded.errors });
      seenPackages.add(packageName);
      if (fallback.id) seenIds.add(fallback.id);
    }
  }
  for (const firstParty of FIRST_PARTY_EXTRACTOR_PACKAGES) {
    if (!seenPackages.has(firstParty.package) && !seenIds.has(firstParty.id)) {
      extractors.push(firstPartyExtractorPlaceholder(firstParty));
    }
  }
  extractors.sort((left, right) => String(left.id || left.package || "").localeCompare(String(right.id || right.package || "")));
  const groups = groupExtractorsByTrack(extractors);
  return {
    ok: extractors.every((extractor) => extractor.errors.length === 0),
    cwd,
    extractors,
    groups,
    summary: {
      total: extractors.length,
      bundled: extractors.filter((extractor) => extractor.source === "bundled").length,
      package: extractors.filter((extractor) => extractor.source === "package").length,
      installed: extractors.filter((extractor) => extractor.installed).length,
      knownFirstParty: extractors.filter((extractor) => extractor.knownFirstParty).length,
      missingFirstParty: extractors.filter((extractor) => extractor.knownFirstParty && !extractor.installed).length
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
  const firstParty = firstPartyExtractorInfo(spec);
  if (firstParty) {
    return { ok: true, sourceSpec: spec, extractor: firstPartyExtractorPlaceholder(firstParty), errors: [] };
  }
  return { ok: false, sourceSpec: spec, extractor: null, errors: loaded.errors };
}

/**
 * @param {ReturnType<typeof buildExtractorListPayload>} payload
 * @returns {void}
 */
export function printExtractorList(payload) {
  console.log("Topogram extractors");
  console.log(`Bundled: ${payload.summary.bundled}; package-backed: ${payload.summary.package}; installed: ${payload.summary.installed}; first-party missing: ${payload.summary.missingFirstParty || 0}`);
  console.log("Package-backed extractors are listed for discovery even before they are installed.");
  console.log("");
  for (const track of EXTRACTOR_TRACK_ORDER) {
    const entries = (payload.groups || {})[track] || [];
    if (entries.length === 0) {
      continue;
    }
    console.log(`${track}:`);
    for (const entry of entries) {
      const extractor = /** @type {Record<string, any>} */ (payload.extractors.find((item) => (entry.package && item.package === entry.package) || (entry.id && item.id === entry.id)) || entry);
      const id = extractor.id || extractor.package || "unknown";
      const status = extractor.errors.length > 0
        ? "invalid"
        : extractor.source === "package"
          ? (extractor.installed ? "package installed" : "package missing")
          : "bundled";
      console.log(`- ${extractor.label ? `${extractor.label} ` : ""}${id}${extractor.version ? `@${extractor.version}` : ""} (${status})`);
      if (extractor.useWhen) console.log(`  Use: ${extractor.useWhen}`);
      console.log(`  Source: ${extractor.source}`);
      console.log("  Adapter loaded: no");
      console.log("  Executes package code: no");
      console.log(`  Extractors: ${extractor.extractors.join(", ") || "none"}`);
      if (extractor.package) console.log(`  Package: ${extractor.package}`);
      if (extractor.installCommand) console.log(`  Install: ${extractor.installCommand}`);
      if (extractor.policyPinCommand) console.log(`  Policy: ${extractor.policyPinCommand}`);
      if (extractor.extractCommand) console.log(`  Extract: ${extractor.extractCommand}`);
      for (const error of extractor.errors || []) console.log(`  Error: ${error}`);
    }
    console.log("");
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
  if (extractor.label) console.log(`Label: ${extractor.label}`);
  if (extractor.useWhen) console.log(`Use: ${extractor.useWhen}`);
  if (extractor.extracts?.length) console.log(`Extracts: ${extractor.extracts.join(", ")}`);
  console.log(`Installed: ${extractor.installed ? "yes" : "no"}`);
  if (extractor.package) console.log(`Package: ${extractor.package}`);
  if (extractor.installCommand) console.log(`Install: ${extractor.installCommand}`);
  if (extractor.policyPinCommand) console.log(`Policy: ${extractor.policyPinCommand}`);
  if (extractor.extractCommand) console.log(`Extract: ${extractor.extractCommand}`);
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
      knownFirstParty: Boolean(firstPartyExtractorInfo(packageName)),
      installCommand: packageExtractorInstallCommand(packageName),
      showCommand: `topogram extractor show ${packageName}`,
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
  console.log("Default allowlist: bundled topogram/* extractors and first-party @topogram/extractor-* packages.");
  console.log("Install behavior: Topogram does not install extractor packages automatically.");
  for (const item of payload.packages) {
    console.log(`- ${item.packageName}@${item.version}: ${item.installed ? "installed" : "missing"}, ${item.allowed ? "allowed" : "denied"}`);
    if (!item.installed && item.installCommand) console.log(`  Install: ${item.installCommand}`);
    if (item.showCommand) console.log(`  Show: ${item.showCommand}`);
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
  if (commandArgs.extractorCommand === "scaffold") {
    const payload = scaffoldExtractorPack(inputPath || "", {
      track: commandArgs.extractorScaffoldTrack,
      packageName: commandArgs.extractorScaffoldPackage,
      manifestId: commandArgs.extractorScaffoldId
    });
    if (json) console.log(stableStringify(payload));
    else printExtractorScaffold(payload);
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
