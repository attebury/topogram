// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "./format.js";
import {
  optionalStringArray,
  optionalStringRecord,
  packageAllowedByPolicy,
  packageScopeFromName as sharedPackageScopeFromName
} from "./package-adapters/index.js";

export const EXTRACTOR_POLICY_FILE = "topogram.extractor-policy.json";

/**
 * @typedef {Object} ExtractorPolicy
 * @property {string} version
 * @property {string[]} allowedPackageScopes
 * @property {string[]} allowedPackages
 * @property {Record<string, string>} pinnedVersions
 * @property {string[]} enabledPackages
 */

/**
 * @typedef {Object} PackageExtractorBinding
 * @property {string} packageName
 * @property {string} version
 */

/**
 * @typedef {Object} ExtractorPolicyInfo
 * @property {string} path
 * @property {ExtractorPolicy|null} policy
 * @property {boolean} exists
 * @property {ExtractorPolicyDiagnostic[]} diagnostics
 */

/**
 * @typedef {Object} ExtractorPolicyDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 * @property {string|null} step
 * @property {string|null} [packageName]
 * @property {string|null} [version]
 */

/**
 * @param {Record<string, any>} input
 * @returns {ExtractorPolicyDiagnostic}
 */
function extractorPolicyDiagnostic(input) {
  return {
    code: String(input.code || "extractor_policy_failed"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Extractor policy check failed."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null,
    step: typeof input.step === "string" ? input.step : null,
    packageName: typeof input.packageName === "string" ? input.packageName : null,
    version: typeof input.version === "string" ? input.version : null
  };
}

/**
 * @returns {ExtractorPolicy}
 */
export function defaultExtractorPolicy() {
  return {
    version: "0.1",
    allowedPackageScopes: [],
    allowedPackages: [],
    pinnedVersions: {},
    enabledPackages: []
  };
}

/**
 * @param {unknown} value
 * @param {string} policyPath
 * @returns {ExtractorPolicy}
 */
export function validateExtractorPolicy(value, policyPath) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${EXTRACTOR_POLICY_FILE} must contain a JSON object.`);
  }
  const raw = /** @type {Record<string, unknown>} */ (value);
  const defaults = defaultExtractorPolicy();
  return {
    version: typeof raw.version === "string" && raw.version ? raw.version : defaults.version,
    allowedPackageScopes: raw.allowedPackageScopes == null
      ? defaults.allowedPackageScopes
      : optionalStringArray(raw.allowedPackageScopes, "allowedPackageScopes", policyPath),
    allowedPackages: optionalStringArray(raw.allowedPackages, "allowedPackages", policyPath),
    pinnedVersions: optionalStringRecord(raw.pinnedVersions, policyPath, "package-or-extractor ids"),
    enabledPackages: optionalStringArray(raw.enabledPackages, "enabledPackages", policyPath)
  };
}

/**
 * @param {string} packageName
 * @returns {string|null}
 */
export function packageScopeFromName(packageName) {
  return sharedPackageScopeFromName(packageName);
}

/**
 * @param {ExtractorPolicy} policy
 * @param {string} packageName
 * @returns {boolean}
 */
export function extractorPackageAllowed(policy, packageName) {
  return packageName.startsWith("@topogram/extractor-") || packageAllowedByPolicy(policy, packageName);
}

/**
 * @param {string} projectRoot
 * @param {string|null|undefined} policyPath
 * @returns {string}
 */
function resolvePolicyPath(projectRoot, policyPath) {
  if (policyPath) {
    const resolved = path.resolve(projectRoot, policyPath);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return path.join(resolved, EXTRACTOR_POLICY_FILE);
    }
    return resolved;
  }
  return path.join(projectRoot, EXTRACTOR_POLICY_FILE);
}

/**
 * @param {string} projectRoot
 * @param {string|null|undefined} [policyPath]
 * @returns {ExtractorPolicyInfo}
 */
export function loadExtractorPolicy(projectRoot, policyPath = null) {
  const resolvedPolicyPath = resolvePolicyPath(projectRoot, policyPath);
  if (!fs.existsSync(resolvedPolicyPath)) {
    return {
      path: resolvedPolicyPath,
      policy: null,
      exists: false,
      diagnostics: []
    };
  }
  try {
    return {
      path: resolvedPolicyPath,
      policy: validateExtractorPolicy(JSON.parse(fs.readFileSync(resolvedPolicyPath, "utf8")), resolvedPolicyPath),
      exists: true,
      diagnostics: []
    };
  } catch (error) {
    return {
      path: resolvedPolicyPath,
      policy: null,
      exists: true,
      diagnostics: [extractorPolicyDiagnostic({
        code: "extractor_policy_invalid",
        message: error instanceof Error ? error.message : String(error),
        path: resolvedPolicyPath,
        suggestedFix: `Fix ${EXTRACTOR_POLICY_FILE} or regenerate it with \`topogram extractor policy init\`.`,
        step: "extractor-policy"
      })]
    };
  }
}

/**
 * @param {ExtractorPolicyInfo} policyInfo
 * @returns {ExtractorPolicy}
 */
export function effectiveExtractorPolicy(policyInfo) {
  return policyInfo.policy || defaultExtractorPolicy();
}

/**
 * @param {string} projectRoot
 * @param {ExtractorPolicy} policy
 * @param {string|null|undefined} [policyPath]
 * @returns {ExtractorPolicy}
 */
export function writeExtractorPolicy(projectRoot, policy, policyPath = null) {
  const resolvedPolicyPath = resolvePolicyPath(projectRoot, policyPath);
  fs.writeFileSync(resolvedPolicyPath, `${stableStringify(policy)}\n`, "utf8");
  return policy;
}

/**
 * @param {ExtractorPolicyInfo} policyInfo
 * @param {PackageExtractorBinding[]} bindings
 * @param {string} [step]
 * @returns {ExtractorPolicyDiagnostic[]}
 */
export function extractorPolicyDiagnosticsForPackages(policyInfo, bindings, step = "extractor-policy") {
  if (policyInfo.diagnostics.length > 0) {
    return policyInfo.diagnostics;
  }
  const policy = effectiveExtractorPolicy(policyInfo);
  /** @type {ExtractorPolicyDiagnostic[]} */
  const diagnostics = [];
  for (const binding of bindings) {
    if (!extractorPackageAllowed(policy, binding.packageName)) {
      const scope = packageScopeFromName(binding.packageName);
      diagnostics.push(extractorPolicyDiagnostic({
        code: "extractor_package_denied",
        message: `Extractor package '${binding.packageName}' is not allowed by ${EXTRACTOR_POLICY_FILE}.`,
        path: policyInfo.path,
        suggestedFix: `Review '${binding.packageName}', then run \`topogram extractor policy pin ${binding.packageName}@${binding.version}\` or add '${scope || binding.packageName}' to ${EXTRACTOR_POLICY_FILE}.`,
        step,
        packageName: binding.packageName,
        version: binding.version
      }));
    }
    const pinnedVersion = policy.pinnedVersions[binding.packageName] || null;
    if (pinnedVersion && pinnedVersion !== binding.version) {
      diagnostics.push(extractorPolicyDiagnostic({
        code: "extractor_version_mismatch",
        message: `Extractor package '${binding.packageName}' uses version '${binding.version}', but ${EXTRACTOR_POLICY_FILE} pins it to '${pinnedVersion}'.`,
        path: policyInfo.path,
        suggestedFix: `Use extractor version '${pinnedVersion}', or run \`topogram extractor policy pin ${binding.packageName}@${binding.version}\` after review.`,
        step,
        packageName: binding.packageName,
        version: binding.version
      }));
    }
  }
  return diagnostics;
}

/**
 * @param {string} spec
 * @returns {{ packageName: string, version: string }}
 */
export function parseExtractorPolicyPin(spec) {
  const separator = spec.lastIndexOf("@");
  if (separator <= 0 || separator === spec.length - 1) {
    throw new Error("Extractor policy pin requires a package name and extractor version, for example @topogram/extractor-react-router@1.");
  }
  return {
    packageName: spec.slice(0, separator),
    version: spec.slice(separator + 1)
  };
}

