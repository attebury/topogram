// @ts-check

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { firstPartyExtractorInfo } from "../../../extractor/first-party.js";
import { packageExtractorInstallCommand } from "../../../extractor/registry.js";
import { packageMetadataForRoot } from "../../../package-adapters/index.js";
import {
  effectiveExtractorPolicy,
  extractorPackageAllowed,
  loadExtractorPolicy
} from "../../../extractor-policy.js";

export const EXTRACTOR_TRACK_ORDER = ["db", "api", "ui", "cli", "workflows", "verification", "unknown"];

let cachedCliVersion = /** @type {string|null} */ (null);

/**
 * @param {string} cwd
 * @returns {string[]}
 */
export function declaredExtractorPackages(cwd) {
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
export function extractorPolicyPinCommand(packageName, version) {
  return packageName ? `topogram extractor policy pin ${packageName}@${version || "1"}` : null;
}

/**
 * @returns {string|null}
 */
export function currentTopogramCliVersion() {
  if (cachedCliVersion != null) {
    return cachedCliVersion;
  }
  try {
    const packagePath = fileURLToPath(new URL("../../../../package.json", import.meta.url));
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    cachedCliVersion = typeof packageJson.version === "string" && packageJson.version.length > 0 ? packageJson.version : null;
  } catch {
    cachedCliVersion = null;
  }
  return cachedCliVersion;
}

/**
 * @param {string|null|undefined} packageName
 * @param {string|null|undefined} version
 * @returns {string|null}
 */
export function extractorPackageUpgradeCommand(packageName, version = null) {
  return packageName ? `npm install -D ${packageName}${version ? `@${version}` : "@latest"}` : null;
}

/**
 * @param {string|null|undefined} packageName
 * @param {string|null|undefined} version
 * @param {string} cwd
 * @returns {{ state: string, allowed: boolean|null, pinnedVersion: string|null, expectedVersion: string|null, matches: boolean|null, pinCommand: string|null, policyPath: string, policyExists: boolean }}
 */
export function extractorPolicyPinState(packageName, version, cwd) {
  const policyInfo = loadExtractorPolicy(cwd);
  const policy = effectiveExtractorPolicy(policyInfo);
  if (!packageName) {
    return {
      state: "not_applicable",
      allowed: null,
      pinnedVersion: null,
      expectedVersion: version || null,
      matches: null,
      pinCommand: null,
      policyPath: policyInfo.path,
      policyExists: policyInfo.exists
    };
  }
  const expectedVersion = version && version !== "unknown" ? version : null;
  const pinnedVersion = policy.pinnedVersions[packageName] || null;
  const allowed = extractorPackageAllowed(policy, packageName);
  if (!expectedVersion) {
    return {
      state: "package_missing",
      allowed,
      pinnedVersion,
      expectedVersion: null,
      matches: null,
      pinCommand: null,
      policyPath: policyInfo.path,
      policyExists: policyInfo.exists
    };
  }
  return {
    state: pinnedVersion
      ? (pinnedVersion === expectedVersion ? "pinned" : "mismatch")
      : (allowed ? "allowed_unpinned" : "blocked"),
    allowed,
    pinnedVersion,
    expectedVersion,
    matches: pinnedVersion ? pinnedVersion === expectedVersion : null,
    pinCommand: extractorPolicyPinCommand(packageName, expectedVersion),
    policyPath: policyInfo.path,
    policyExists: policyInfo.exists
  };
}

/**
 * @param {any} manifest
 * @param {{ packageRoot?: string|null }} metadata
 * @param {any} firstParty
 * @returns {{ packageVersion: string|null, packageVersionStatus: string, compatibleCliRange: string|null, compatibleCliSource: string }}
 */
function extractorPackageRuntimeMetadata(manifest, metadata, firstParty) {
  const packageMetadata = packageMetadataForRoot(metadata.packageRoot, "@topogram/cli");
  const currentCli = currentTopogramCliVersion();
  const firstPartyDefaultRange = firstParty && currentCli ? `^${currentCli}` : null;
  const firstPartyRange = firstParty && typeof /** @type {any} */ (firstParty).compatibleCliRange === "string"
    ? /** @type {any} */ (firstParty).compatibleCliRange
    : null;
  const compatibleCliRange = manifest.compatibleCliRange || packageMetadata.dependencyRange || firstPartyRange || firstPartyDefaultRange || null;
  return {
    packageVersion: packageMetadata.version,
    packageVersionStatus: metadata.packageRoot
      ? (packageMetadata.version ? "installed" : "unknown")
      : "not_installed",
    compatibleCliRange,
    compatibleCliSource: manifest.compatibleCliRange
      ? "manifest"
      : packageMetadata.dependencyRange
        ? "package.json"
        : firstPartyRange
          ? "first_party_metadata"
          : firstPartyDefaultRange
            ? "current_cli_default"
            : "missing"
  };
}

/**
 * @param {string|null|undefined} extractorRef
 * @param {string[]} tracks
 * @param {string|null|undefined} exampleSource
 * @returns {string|null}
 */
function extractorRunCommand(extractorRef, tracks, exampleSource) {
  if (!extractorRef) {
    return null;
  }
  const trackList = tracks.length > 0 ? tracks.join(",") : "db,api,ui,cli";
  return `topogram extract ${exampleSource || "./existing-app"} --out ./imported-topogram --from ${trackList} --extractor ${extractorRef}`;
}

/**
 * @param {Record<string, any>|null|undefined} extractor
 * @returns {Record<string, any>}
 */
export function buildExtractorReviewWorkflow(extractor = null) {
  const packageName = extractor?.package || extractor?.packageName || null;
  const extractorRef = packageName || extractor?.id || "<extractor>";
  const tracks = Array.isArray(extractor?.tracks) ? extractor.tracks : [];
  const version = extractor?.version || "1";
  const bundledExtractor = extractor?.source === "bundled" && !packageName;
  const installCommand = extractor?.installCommand || (packageName ? packageExtractorInstallCommand(packageName) : null);
  const policyPinCommand = extractor?.policyPinCommand || (packageName ? extractorPolicyPinCommand(packageName, version) : null);
  const upgradeCommand = extractor?.upgradeCommand || (packageName ? extractorPackageUpgradeCommand(packageName) : null);
  const extractCommand = extractor?.extractCommand || extractorRunCommand(extractorRef, tracks, extractor?.exampleSource);
  return {
    type: "extractor_review_workflow",
    packageCodeExecution: {
      list: false,
      show: false,
      policy: false,
      check: true,
      extract: true
    },
    steps: [
      {
        id: "discover",
        command: "topogram extractor list",
        packageCodeExecution: false,
        purpose: "Find bundled and first-party package-backed extractors by track."
      },
      {
        id: "inspect",
        command: `topogram extractor show ${extractorRef}`,
        packageCodeExecution: false,
        purpose: "Read manifest purpose, tracks, install command, policy pin command, and extract command."
      },
      ...(installCommand ? [{
        id: "install",
        command: installCommand,
        packageCodeExecution: false,
        purpose: "Install the extractor package explicitly; Topogram does not install it during extraction."
      }] : []),
      ...(upgradeCommand && extractor?.installed ? [{
        id: "upgrade",
        command: upgradeCommand,
        packageCodeExecution: false,
        purpose: "Upgrade the package if its installed npm package version or compatible CLI range is stale."
      }] : []),
      ...(policyPinCommand ? [{
        id: "pin_policy",
        command: policyPinCommand,
        packageCodeExecution: false,
        purpose: "Allow and pin the extractor manifest version before execution."
      }] : []),
      ...(!bundledExtractor ? [{
        id: "check",
        command: `topogram extractor check ${extractorRef}`,
        packageCodeExecution: true,
        purpose: "Load the adapter and run a minimal smoke extraction against a synthetic fixture."
      }] : []),
      ...(extractCommand ? [{
        id: "extract",
        command: extractCommand,
        packageCodeExecution: true,
        purpose: "Read brownfield source and write review-only candidates plus extraction provenance."
      }] : []),
      {
        id: "review_plan",
        command: "topogram extract plan ./imported-topogram",
        packageCodeExecution: false,
        purpose: "Review bundles, extractor provenance, candidate counts, and safety notes."
      },
      {
        id: "list_selectors",
        command: "topogram adopt --list ./imported-topogram",
        packageCodeExecution: false,
        purpose: "Choose an explicit adoption selector."
      },
      {
        id: "dry_run_adoption",
        command: "topogram adopt <selector> ./imported-topogram --dry-run",
        packageCodeExecution: false,
        purpose: "Preview canonical topo writes before changing project-owned records."
      },
      {
        id: "write_reviewed_adoption",
        command: "topogram adopt <selector> ./imported-topogram --write",
        packageCodeExecution: false,
        purpose: "Write only reviewed canonical records; extractor packages never own adoption semantics."
      }
    ],
    safetyNotes: [
      "topogram extractor list/show/policy do not load package adapter code.",
      "topogram extractor check and topogram extract load package adapter code.",
      "Extractor packages emit review-only candidates; core owns persistence, reconcile, adoption, and canonical topo writes.",
      "Run dry-run adoption before --write."
    ]
  };
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
export function groupExtractorsByTrack(extractors) {
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
 * @param {{ installed?: boolean, manifestPath?: string|null, packageRoot?: string|null, errors?: string[], cwd?: string }} [metadata]
 * @returns {Record<string, any>}
 */
export function extractorManifestSummary(manifest, metadata = {}) {
  const firstParty = firstPartyExtractorInfo(manifest.package || manifest.id);
  const packageName = manifest.package || null;
  const tracks = manifest.tracks || [];
  const version = manifest.version || firstParty?.version || "1";
  const cwd = metadata.cwd || process.cwd();
  const installCommand = packageName ? packageExtractorInstallCommand(packageName) : null;
  const policyPinCommand = extractorPolicyPinCommand(packageName, version);
  const upgradeCommand = extractorPackageUpgradeCommand(packageName);
  const extractCommand = extractorRunCommand(packageName || manifest.id, tracks, firstParty?.exampleSource);
  const runtimeMetadata = extractorPackageRuntimeMetadata(manifest, metadata, firstParty);
  const policyPin = extractorPolicyPinState(packageName, version, cwd);
  const summary = {
    id: manifest.id,
    version,
    manifestVersion: version,
    packageVersion: runtimeMetadata.packageVersion,
    packageVersionStatus: runtimeMetadata.packageVersionStatus,
    compatibleCliRange: runtimeMetadata.compatibleCliRange,
    compatibleCliSource: runtimeMetadata.compatibleCliSource,
    currentCliVersion: currentTopogramCliVersion(),
    policyPin,
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
    ...(upgradeCommand ? { upgradeCommand } : {}),
    ...(extractCommand ? { extractCommand } : {}),
    ...(packageName ? { showCommand: `topogram extractor show ${packageName}` } : {}),
    installed: metadata.installed !== false,
    manifestPath: metadata.manifestPath || null,
    packageRoot: metadata.packageRoot || null,
    errors: metadata.errors || []
  };
  return {
    ...summary,
    reviewWorkflow: buildExtractorReviewWorkflow(summary)
  };
}

/**
 * @param {Record<string, any>} info
 * @param {string} [cwd]
 * @returns {Record<string, any>}
 */
export function firstPartyExtractorPlaceholder(info, cwd = process.cwd()) {
  const runtimeMetadata = extractorPackageRuntimeMetadata({ ...info, source: "package" }, {}, info);
  const policyPin = extractorPolicyPinState(info.package, info.version, cwd);
  const summary = {
    id: info.id,
    version: info.version,
    manifestVersion: info.version,
    packageVersion: runtimeMetadata.packageVersion,
    packageVersionStatus: runtimeMetadata.packageVersionStatus,
    compatibleCliRange: runtimeMetadata.compatibleCliRange,
    compatibleCliSource: runtimeMetadata.compatibleCliSource,
    currentCliVersion: currentTopogramCliVersion(),
    policyPin,
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
    upgradeCommand: extractorPackageUpgradeCommand(info.package),
    extractCommand: extractorRunCommand(info.package, info.tracks, info.exampleSource),
    showCommand: `topogram extractor show ${info.package}`,
    installed: false,
    manifestPath: null,
    packageRoot: null,
    errors: []
  };
  return {
    ...summary,
    reviewWorkflow: buildExtractorReviewWorkflow(summary)
  };
}
