// @ts-check

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
import { packageMetadataForRoot } from "../../package-adapters/index.js";
import {
  defaultExtractorPolicy,
  effectiveExtractorPolicy,
  EXTRACTOR_POLICY_FILE,
  extractorPackageAllowed,
  extractorPolicyDiagnosticsForPackages,
  loadExtractorPolicy,
  parseExtractorPolicyPin,
  writeExtractorPolicy
} from "../../extractor-policy.js";
import {
  buildExtractorReviewWorkflow,
  currentTopogramCliVersion,
  declaredExtractorPackages,
  EXTRACTOR_TRACK_ORDER,
  extractorManifestSummary,
  extractorPackageUpgradeCommand,
  extractorPolicyPinCommand,
  extractorPolicyPinState,
  firstPartyExtractorPlaceholder,
  groupExtractorsByTrack
} from "./extractor/summary.js";

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
  console.log("  - safe loop: list/show -> install -> policy pin -> check -> extract -> plan/list -> adopt --dry-run -> adopt --write.");
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
 * @returns {{ ok: boolean, cwd: string, extractors: Record<string, any>[], groups: Record<string, any[]>, reviewWorkflow: Record<string, any>, summary: Record<string, number> }}
 */
export function buildExtractorListPayload(cwd) {
  const extractors = EXTRACTOR_MANIFESTS
    .map((manifest) => extractorManifestSummary(manifest, { cwd }))
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
        errors: loaded.errors,
        cwd
      });
      extractors.push(summary);
      if (summary.package) seenPackages.add(summary.package);
      if (summary.id) seenIds.add(summary.id);
    } else {
      const firstParty = firstPartyExtractorInfo(packageName);
      const fallback = firstParty ? firstPartyExtractorPlaceholder(firstParty, cwd) : {
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
      extractors.push(firstPartyExtractorPlaceholder(firstParty, cwd));
    }
  }
  extractors.sort((left, right) => String(left.id || left.package || "").localeCompare(String(right.id || right.package || "")));
  const groups = groupExtractorsByTrack(extractors);
  return {
    ok: extractors.every((extractor) => extractor.errors.length === 0),
    cwd,
    extractors,
    groups,
    reviewWorkflow: buildExtractorReviewWorkflow(),
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
    return { ok: true, sourceSpec: spec, extractor: extractorManifestSummary(bundled, { cwd }), errors: [] };
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
        errors: loaded.errors,
        cwd
      }),
      errors: []
    };
  }
  const firstParty = firstPartyExtractorInfo(spec);
  if (firstParty) {
    return { ok: true, sourceSpec: spec, extractor: firstPartyExtractorPlaceholder(firstParty, cwd), errors: [] };
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
  console.log("Selection loop: list/show (no package code) -> install -> policy pin -> extractor check (loads adapter) -> extract -> extract plan/adopt --list -> adopt --dry-run -> adopt --write.");
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
      console.log(`  Manifest version: ${extractor.manifestVersion || extractor.version || "unknown"}`);
      if (extractor.package) {
        console.log(`  Package version: ${extractor.packageVersion || extractor.packageVersionStatus || "unknown"}`);
        console.log(`  Compatible CLI: ${extractor.compatibleCliRange || "not declared"}`);
        console.log(`  Policy pin: ${extractor.policyPin?.state || "unknown"}`);
      }
      console.log("  Adapter loaded: no");
      console.log("  Executes package code: no");
      console.log(`  Extractors: ${extractor.extractors.join(", ") || "none"}`);
      if (extractor.package) console.log(`  Package: ${extractor.package}`);
      if (extractor.installCommand) console.log(`  Install: ${extractor.installCommand}`);
      if (extractor.upgradeCommand && extractor.installed) console.log(`  Upgrade: ${extractor.upgradeCommand}`);
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
  console.log(`Manifest version: ${extractor.manifestVersion || extractor.version || "unknown"}`);
  if (extractor.package) {
    console.log(`Package version: ${extractor.packageVersion || extractor.packageVersionStatus || "unknown"}`);
    console.log(`Compatible CLI: ${extractor.compatibleCliRange || "not declared"}`);
    console.log(`Policy pin: ${extractor.policyPin?.state || "unknown"}`);
    if (extractor.policyPin?.pinCommand) console.log(`Policy pin command: ${extractor.policyPin.pinCommand}`);
  }
  console.log("Adapter loaded: no");
  console.log("Executes package code: no");
  if (extractor.label) console.log(`Label: ${extractor.label}`);
  if (extractor.useWhen) console.log(`Use: ${extractor.useWhen}`);
  if (extractor.extracts?.length) console.log(`Extracts: ${extractor.extracts.join(", ")}`);
  console.log(`Installed: ${extractor.installed ? "yes" : "no"}`);
  if (extractor.package) console.log(`Package: ${extractor.package}`);
  if (extractor.installCommand) console.log(`Install: ${extractor.installCommand}`);
  if (extractor.upgradeCommand && extractor.installed) console.log(`Upgrade: ${extractor.upgradeCommand}`);
  if (extractor.policyPinCommand) console.log(`Policy: ${extractor.policyPinCommand}`);
  if (extractor.extractCommand) console.log(`Extract: ${extractor.extractCommand}`);
  if (extractor.manifestPath) console.log(`Manifest: ${extractor.manifestPath}`);
  console.log(`Extractors: ${extractor.extractors.join(", ") || "none"}`);
  console.log(`Candidate kinds: ${extractor.candidateKinds.join(", ") || "none"}`);
  console.log(`Evidence types: ${extractor.evidenceTypes.join(", ") || "none"}`);
  if (extractor.reviewWorkflow?.steps?.length) {
    console.log("");
    console.log("Review loop:");
    for (const step of extractor.reviewWorkflow.steps) {
      console.log(`- ${step.id}: ${step.command}`);
      console.log(`  ${step.purpose}`);
    }
  }
}

/**
 * @param {ReturnType<typeof checkExtractorPack> & { reviewWorkflow?: Record<string, any> }} payload
 * @returns {void}
 */
export function printExtractorCheck(payload) {
  console.log(payload.ok ? "Extractor check passed." : "Extractor check found issues.");
  console.log(`Source: ${payload.sourceSpec}`);
  console.log(`Type: ${payload.source}`);
  if (payload.packageName) console.log(`Package: ${payload.packageName}`);
  if (payload.packageVersion) console.log(`Package version: ${payload.packageVersion}`);
  if (payload.compatibleCliRange) console.log(`Compatible CLI: ${payload.compatibleCliRange}`);
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
  if (payload.reviewWorkflow?.steps?.length) {
    console.log("");
    console.log("Next review loop:");
    for (const step of payload.reviewWorkflow.steps.filter((/** @type {Record<string, any>} */ step) => ["extract", "review_plan", "list_selectors", "dry_run_adoption", "write_reviewed_adoption"].includes(step.id))) {
      console.log(`- ${step.command}`);
    }
  }
  for (const error of payload.errors || []) console.log(`Error: ${error}`);
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, defaulted: boolean, packages: any[], diagnostics: any[], errors: string[], reviewWorkflow: Record<string, any>, summary: Record<string, number> }}
 */
export function buildExtractorPolicyStatusPayload(projectPath) {
  const root = path.resolve(projectPath || ".");
  const policyInfo = loadExtractorPolicy(root);
  const policy = /** @type {import("../../extractor-policy.js").ExtractorPolicy} */ (effectiveExtractorPolicy(policyInfo));
  const packages = policy.enabledPackages.map((packageName) => {
    const loaded = loadPackageExtractorManifest(packageName, root);
    const version = loaded.manifest?.version || "unknown";
    const packageMetadata = packageMetadataForRoot(loaded.packageRoot, "@topogram/cli");
    const firstParty = firstPartyExtractorInfo(packageName);
    const compatibleCliRange = loaded.manifest?.compatibleCliRange || packageMetadata.dependencyRange || (firstParty && currentTopogramCliVersion() ? `^${currentTopogramCliVersion()}` : null);
    const policyPin = extractorPolicyPinState(packageName, version, root);
    const diagnostics = extractorPolicyDiagnosticsForPackages(policyInfo, [{ packageName, version }], "extractor-policy");
    return {
      packageName,
      version,
      manifestVersion: version,
      packageVersion: packageMetadata.version,
      packageVersionStatus: loaded.packageRoot ? (packageMetadata.version ? "installed" : "unknown") : "not_installed",
      compatibleCliRange,
      policyPin,
      allowed: extractorPackageAllowed(policy, packageName),
      installed: Boolean(loaded.manifest),
      knownFirstParty: Boolean(firstPartyExtractorInfo(packageName)),
      installCommand: packageExtractorInstallCommand(packageName),
      upgradeCommand: extractorPackageUpgradeCommand(packageName),
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
    reviewWorkflow: buildExtractorReviewWorkflow(packages[0] || null),
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
  console.log("Review loop: install package -> pin policy -> extractor check -> extract -> extract plan/adopt --list -> adopt --dry-run -> adopt --write.");
  for (const item of payload.packages) {
    console.log(`- ${item.packageName}@${item.version}: ${item.installed ? "installed" : "missing"}, ${item.allowed ? "allowed" : "denied"}`);
    console.log(`  Manifest version: ${item.manifestVersion || item.version || "unknown"}`);
    console.log(`  Package version: ${item.packageVersion || item.packageVersionStatus || "unknown"}`);
    console.log(`  Compatible CLI: ${item.compatibleCliRange || "not declared"}`);
    console.log(`  Policy pin: ${item.policyPin?.state || "unknown"}`);
    if (!item.installed && item.installCommand) console.log(`  Install: ${item.installCommand}`);
    if (item.installed && item.upgradeCommand) console.log(`  Upgrade: ${item.upgradeCommand}`);
    if (item.policyPin?.pinCommand) console.log(`  Pin: ${item.policyPin.pinCommand}`);
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
    const summary = payload.manifest
      ? extractorManifestSummary(payload.manifest, {
          installed: Boolean(payload.manifest),
          manifestPath: payload.manifestPath,
          packageRoot: payload.packageRoot,
          errors: payload.errors
        })
      : null;
    const augmentedPayload = /** @type {ReturnType<typeof checkExtractorPack> & { reviewWorkflow?: Record<string, any> }} */ (payload);
    augmentedPayload.reviewWorkflow = buildExtractorReviewWorkflow(summary || {
      id: inputPath || "<extractor>",
      package: payload.packageName || null,
      packageName: payload.packageName || null,
      tracks: payload.manifest?.tracks || [],
      version: payload.manifest?.version || "1"
    });
    if (json) console.log(stableStringify(augmentedPayload));
    else printExtractorCheck(augmentedPayload);
    return augmentedPayload.ok ? 0 : 1;
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
