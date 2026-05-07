// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "./format.js";

export const GENERATOR_POLICY_FILE = "topogram.generator-policy.json";

/**
 * @typedef {Object} GeneratorPolicy
 * @property {string} version
 * @property {string[]} allowedPackageScopes
 * @property {string[]} allowedPackages
 * @property {Record<string, string>} pinnedVersions
 */

/**
 * @typedef {Object} GeneratorPolicyInfo
 * @property {string} path
 * @property {GeneratorPolicy|null} policy
 * @property {boolean} exists
 * @property {GeneratorPolicyDiagnostic[]} diagnostics
 */

/**
 * @typedef {Object} GeneratorPolicyDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 * @property {string|null} step
 * @property {string|null} [runtimeId]
 * @property {string|null} [generatorId]
 * @property {string|null} [packageName]
 * @property {string|null} [version]
 */

/**
 * @typedef {Object} PackageGeneratorBinding
 * @property {string} runtimeId
 * @property {string} runtimeKind
 * @property {string} projection
 * @property {string} generatorId
 * @property {string} version
 * @property {string} packageName
 */

/**
 * @param {Record<string, any>} input
 * @returns {GeneratorPolicyDiagnostic}
 */
function generatorPolicyDiagnostic(input) {
  return {
    code: String(input.code || "generator_policy_failed"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Generator policy check failed."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null,
    step: typeof input.step === "string" ? input.step : null,
    runtimeId: typeof input.runtimeId === "string" ? input.runtimeId : null,
    generatorId: typeof input.generatorId === "string" ? input.generatorId : null,
    packageName: typeof input.packageName === "string" ? input.packageName : null,
    version: typeof input.version === "string" ? input.version : null
  };
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @param {string} policyPath
 * @returns {string[]}
 */
function optionalStringArray(value, fieldName, policyPath) {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${policyPath} ${fieldName} must be an array of strings.`);
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.length === 0) {
      throw new Error(`${policyPath} ${fieldName} must contain only non-empty strings.`);
    }
    return item;
  });
}

/**
 * @param {unknown} value
 * @param {string} policyPath
 * @returns {Record<string, string>}
 */
function optionalStringRecord(value, policyPath) {
  if (value == null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${policyPath} pinnedVersions must be an object of package-or-generator ids to versions.`);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item !== "string" || item.length === 0) {
      throw new Error(`${policyPath} pinnedVersions['${key}'] must be a non-empty string.`);
    }
    return [key, item];
  }));
}

/**
 * @returns {GeneratorPolicy}
 */
export function defaultGeneratorPolicy() {
  return {
    version: "0.1",
    allowedPackageScopes: ["@topogram"],
    allowedPackages: [],
    pinnedVersions: {}
  };
}

/**
 * @param {unknown} value
 * @param {string} policyPath
 * @returns {GeneratorPolicy}
 */
export function validateGeneratorPolicy(value, policyPath) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${GENERATOR_POLICY_FILE} must contain a JSON object.`);
  }
  const raw = /** @type {Record<string, unknown>} */ (value);
  const defaults = defaultGeneratorPolicy();
  return {
    version: typeof raw.version === "string" && raw.version ? raw.version : defaults.version,
    allowedPackageScopes: raw.allowedPackageScopes == null
      ? defaults.allowedPackageScopes
      : optionalStringArray(raw.allowedPackageScopes, "allowedPackageScopes", policyPath),
    allowedPackages: optionalStringArray(raw.allowedPackages, "allowedPackages", policyPath),
    pinnedVersions: optionalStringRecord(raw.pinnedVersions, policyPath)
  };
}

/**
 * @param {string} packageName
 * @returns {string|null}
 */
export function packageScopeFromName(packageName) {
  return packageName.startsWith("@") ? packageName.split("/")[0] || null : null;
}

/**
 * @param {string} allowed
 * @param {string|null} scope
 * @returns {boolean}
 */
function packageScopeMatches(allowed, scope) {
  return Boolean(scope && (allowed === scope || allowed === `${scope}/*`));
}

/**
 * @param {GeneratorPolicy} policy
 * @param {string} packageName
 * @returns {boolean}
 */
export function generatorPackageAllowed(policy, packageName) {
  if (policy.allowedPackages.includes(packageName)) {
    return true;
  }
  const scope = packageScopeFromName(packageName);
  return policy.allowedPackageScopes.some((allowed) => packageScopeMatches(allowed, scope));
}

/**
 * @param {Record<string, any>} projectConfig
 * @returns {PackageGeneratorBinding[]}
 */
export function packageBackedGeneratorBindings(projectConfig) {
  const runtimes = Array.isArray(projectConfig?.topology?.runtimes) ? projectConfig.topology.runtimes : [];
  return runtimes
    .filter((runtime) => typeof runtime?.generator?.package === "string" && runtime.generator.package.length > 0)
    .map((runtime) => ({
      runtimeId: String(runtime.id || "unknown"),
      runtimeKind: String(runtime.kind || "unknown"),
      projection: String(runtime.projection || "unknown"),
      generatorId: String(runtime.generator.id || "unknown"),
      version: String(runtime.generator.version || "unknown"),
      packageName: String(runtime.generator.package)
    }));
}

/**
 * @param {string} projectRoot
 * @returns {GeneratorPolicyInfo}
 */
export function loadGeneratorPolicy(projectRoot) {
  const policyPath = path.join(projectRoot, GENERATOR_POLICY_FILE);
  if (!fs.existsSync(policyPath)) {
    return {
      path: policyPath,
      policy: null,
      exists: false,
      diagnostics: []
    };
  }
  try {
    return {
      path: policyPath,
      policy: validateGeneratorPolicy(JSON.parse(fs.readFileSync(policyPath, "utf8")), policyPath),
      exists: true,
      diagnostics: []
    };
  } catch (error) {
    return {
      path: policyPath,
      policy: null,
      exists: true,
      diagnostics: [generatorPolicyDiagnostic({
        code: "generator_policy_invalid",
        message: error instanceof Error ? error.message : String(error),
        path: policyPath,
        suggestedFix: `Fix ${GENERATOR_POLICY_FILE} or regenerate it with \`topogram generator policy init\`.`,
        step: "generator-policy"
      })]
    };
  }
}

/**
 * @param {string} projectRoot
 * @param {GeneratorPolicy} policy
 * @returns {GeneratorPolicy}
 */
export function writeGeneratorPolicy(projectRoot, policy) {
  fs.writeFileSync(path.join(projectRoot, GENERATOR_POLICY_FILE), `${stableStringify(policy)}\n`, "utf8");
  return policy;
}

/**
 * @param {GeneratorPolicyInfo} policyInfo
 * @returns {GeneratorPolicy}
 */
function effectivePolicy(policyInfo) {
  return policyInfo.policy || defaultGeneratorPolicy();
}

/**
 * @param {GeneratorPolicyInfo} policyInfo
 * @param {PackageGeneratorBinding[]} bindings
 * @param {string} step
 * @returns {GeneratorPolicyDiagnostic[]}
 */
export function generatorPolicyDiagnosticsForBindings(policyInfo, bindings, step = "generator-policy") {
  if (policyInfo.diagnostics.length > 0) {
    return policyInfo.diagnostics;
  }
  const policy = effectivePolicy(policyInfo);
  /** @type {GeneratorPolicyDiagnostic[]} */
  const diagnostics = [];
  for (const binding of bindings) {
    if (!generatorPackageAllowed(policy, binding.packageName)) {
      const scope = packageScopeFromName(binding.packageName);
      const allowedScopes = policy.allowedPackageScopes.join(", ") || "(none)";
      const allowedPackages = policy.allowedPackages.join(", ") || "(none)";
      diagnostics.push(generatorPolicyDiagnostic({
        code: "generator_package_denied",
        message: `Runtime '${binding.runtimeId}' generator package '${binding.packageName}' is not allowed by ${GENERATOR_POLICY_FILE}.`,
        path: policyInfo.path,
        suggestedFix: `Review '${binding.packageName}', then run \`topogram generator policy pin ${binding.packageName}@${binding.version}\` or add '${scope || binding.packageName}' to ${GENERATOR_POLICY_FILE}.`,
        step,
        runtimeId: binding.runtimeId,
        generatorId: binding.generatorId,
        packageName: binding.packageName,
        version: binding.version
      }));
      diagnostics[diagnostics.length - 1].message += ` Allowed scopes: ${allowedScopes}; allowed packages: ${allowedPackages}.`;
    }
    const pinnedVersion = policy.pinnedVersions[binding.packageName] || policy.pinnedVersions[binding.generatorId] || null;
    if (pinnedVersion && pinnedVersion !== binding.version) {
      diagnostics.push(generatorPolicyDiagnostic({
        code: "generator_version_mismatch",
        message: `Runtime '${binding.runtimeId}' generator '${binding.generatorId}' uses version '${binding.version}', but ${GENERATOR_POLICY_FILE} pins '${binding.packageName}' to '${pinnedVersion}'.`,
        path: policyInfo.path,
        suggestedFix: `Use generator version '${pinnedVersion}', or run \`topogram generator policy pin ${binding.packageName}@${binding.version}\` after review.`,
        step,
        runtimeId: binding.runtimeId,
        generatorId: binding.generatorId,
        packageName: binding.packageName,
        version: binding.version
      }));
    }
  }
  return diagnostics;
}

/**
 * @param {Record<string, any>} projectConfig
 * @param {string} projectRoot
 * @param {string} [step]
 * @returns {GeneratorPolicyDiagnostic[]}
 */
export function generatorPolicyDiagnosticsForProject(projectConfig, projectRoot, step = "generator-policy") {
  const bindings = packageBackedGeneratorBindings(projectConfig);
  const policyInfo = loadGeneratorPolicy(projectRoot);
  return generatorPolicyDiagnosticsForBindings(policyInfo, bindings, step);
}

/**
 * @param {Record<string, any>} projectConfig
 * @param {{ configDir?: string|null, rootDir?: string|null }} [options]
 * @returns {{ ok: boolean, errors: Array<{ message: string, loc: null }> }}
 */
export function validateProjectGeneratorPolicy(projectConfig, options = {}) {
  const projectRoot = options.configDir || options.rootDir || process.cwd();
  const diagnostics = generatorPolicyDiagnosticsForProject(projectConfig, projectRoot, "project-config");
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      message: diagnostic.suggestedFix
        ? `${diagnostic.message} Suggested fix: ${diagnostic.suggestedFix}`
        : diagnostic.message,
      loc: null
    }));
  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * @param {string} spec
 * @returns {{ packageName: string, version: string }}
 */
export function parseGeneratorPolicyPin(spec) {
  const separator = spec.lastIndexOf("@");
  if (separator <= 0 || separator === spec.length - 1) {
    throw new Error("Generator policy pin requires a package name and generator version, for example @topogram/generator-react-web@1.");
  }
  return {
    packageName: spec.slice(0, separator),
    version: spec.slice(separator + 1)
  };
}
