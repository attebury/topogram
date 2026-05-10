// @ts-check

import path from "node:path";

import {
  defaultGeneratorPolicy,
  GENERATOR_POLICY_FILE,
  generatorPackageAllowed,
  generatorPolicyDiagnosticsForBindings,
  loadGeneratorPolicy,
  packageBackedGeneratorBindings,
  packageScopeFromName,
  parseGeneratorPolicyPin,
  writeGeneratorPolicy
} from "../../../generator-policy.js";
import { loadProjectConfig } from "../../../project-config.js";
import { packageInfoForGenerator } from "./package-info.js";
import { effectiveGeneratorPolicy, generatorPolicyRule } from "./shared.js";

/**
 * @param {string} projectRoot
 * @param {any} policy
 * @param {ReturnType<typeof packageBackedGeneratorBindings>[number]} binding
 * @returns {ReturnType<typeof packageBackedGeneratorBindings>[number] & { allowed: boolean, packageInfo: ReturnType<typeof packageInfoForGenerator>, pin: { key: string|null, version: string|null, matches: boolean|null } }}
 */
function generatorPolicyBindingStatus(projectRoot, policy, binding) {
  const packagePin = policy.pinnedVersions[binding.packageName] || null;
  const generatorPin = policy.pinnedVersions[binding.generatorId] || null;
  const pinnedVersion = packagePin || generatorPin;
  return {
    ...binding,
    allowed: generatorPackageAllowed(policy, binding.packageName),
    packageInfo: packageInfoForGenerator(projectRoot, binding.packageName),
    pin: {
      key: packagePin ? binding.packageName : generatorPin ? binding.generatorId : null,
      version: pinnedVersion,
      matches: pinnedVersion ? pinnedVersion === binding.version : null
    }
  };
}

/**
 * @param {any[]} diagnostics
 * @param {Array<ReturnType<typeof generatorPolicyBindingStatus>>} bindings
 * @returns {any[]}
 */
function annotateGeneratorPolicyDiagnostics(diagnostics, bindings) {
  return diagnostics.map((diagnostic) => {
    const binding = bindings.find((item) => (
      item.packageName === diagnostic.packageName &&
      (!diagnostic.runtimeId || item.runtimeId === diagnostic.runtimeId)
    ));
    if (!binding) {
      return diagnostic;
    }
    return {
      ...diagnostic,
      packageVersion: binding.packageInfo.installedVersion || binding.packageInfo.lockfileVersion || null,
      packageDependencyField: binding.packageInfo.dependencyField,
      packageDependencySpec: binding.packageInfo.dependencySpec,
      packageLockfileKind: binding.packageInfo.lockfileKind,
      packageLockfilePath: binding.packageInfo.lockfilePath,
      packageLockVersion: binding.packageInfo.lockfileVersion
    };
  });
}

/**
 * @param {Array<ReturnType<typeof generatorPolicyBindingStatus>>} bindings
 * @returns {any[]}
 */
function generatorPolicyPackageMetadataDiagnostics(bindings) {
  const diagnostics = [];
  for (const binding of bindings) {
    if (!binding.packageInfo.dependencySpec) {
      diagnostics.push({
        code: "generator_package_dependency_missing",
        severity: "warning",
        message: `Runtime '${binding.runtimeId}' generator package '${binding.packageName}' is not declared in package.json dependencies.`,
        path: binding.packageInfo.installedPackageJsonPath,
        suggestedFix: `Declare '${binding.packageName}' in package.json devDependencies so generator adoption is visible in package review.`,
        step: "generator-policy",
        runtimeId: binding.runtimeId,
        generatorId: binding.generatorId,
        packageName: binding.packageName,
        version: binding.version,
        packageVersion: binding.packageInfo.installedVersion || binding.packageInfo.lockfileVersion || null,
        packageDependencyField: binding.packageInfo.dependencyField,
        packageDependencySpec: binding.packageInfo.dependencySpec,
        packageLockfileKind: binding.packageInfo.lockfileKind,
        packageLockfilePath: binding.packageInfo.lockfilePath,
        packageLockVersion: binding.packageInfo.lockfileVersion
      });
    }
    if (
      binding.packageInfo.installedVersion &&
      binding.packageInfo.lockfileVersion &&
      binding.packageInfo.installedVersion !== binding.packageInfo.lockfileVersion
    ) {
      diagnostics.push({
        code: "generator_package_version_drift",
        severity: "warning",
        message: `Runtime '${binding.runtimeId}' generator package '${binding.packageName}' is installed at '${binding.packageInfo.installedVersion}', but package-lock records '${binding.packageInfo.lockfileVersion}'.`,
        path: binding.packageInfo.lockfilePath,
        suggestedFix: "Run the package manager install command and review the resulting lockfile before pinning generator policy.",
        step: "generator-policy",
        runtimeId: binding.runtimeId,
        generatorId: binding.generatorId,
        packageName: binding.packageName,
        version: binding.version,
        packageVersion: binding.packageInfo.installedVersion,
        packageDependencyField: binding.packageInfo.dependencyField,
        packageDependencySpec: binding.packageInfo.dependencySpec,
        packageLockfileKind: binding.packageInfo.lockfileKind,
        packageLockfilePath: binding.packageInfo.lockfilePath,
        packageLockVersion: binding.packageInfo.lockfileVersion
      });
    }
  }
  return diagnostics;
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, defaulted: boolean, bindings: Array<ReturnType<typeof generatorPolicyBindingStatus>>, diagnostics: any[], errors: string[] }}
 */
export function buildGeneratorPolicyCheckPayload(projectPath) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = {
      code: "generator_policy_project_missing",
      severity: "error",
      message: "Cannot check generator policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "generator-policy"
    };
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), GENERATOR_POLICY_FILE),
      exists: false,
      policy: null,
      defaulted: false,
      bindings: [],
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policyInfo = loadGeneratorPolicy(projectConfigInfo.configDir);
  const rawBindings = packageBackedGeneratorBindings(projectConfigInfo.config);
  const policy = policyInfo.policy || effectiveGeneratorPolicy(policyInfo);
  const bindings = rawBindings.map((binding) => generatorPolicyBindingStatus(projectConfigInfo.configDir, policy, binding));
  const diagnostics = [];
  if (!policyInfo.exists) {
    diagnostics.push({
      code: "generator_policy_missing",
      severity: "warning",
      message: `No ${GENERATOR_POLICY_FILE} found. Default generator policy allows @topogram/* package-backed generators and blocks other package scopes.`,
      path: policyInfo.path,
      suggestedFix: "Run `topogram generator policy init` to write an explicit project generator policy after review.",
      step: "generator-policy"
    });
  }
  diagnostics.push(...generatorPolicyDiagnosticsForBindings(policyInfo, rawBindings, "generator-policy"));
  diagnostics.push(...generatorPolicyPackageMetadataDiagnostics(bindings));
  const annotatedDiagnostics = annotateGeneratorPolicyDiagnostics(diagnostics, bindings);
  const errors = annotatedDiagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    path: policyInfo.path,
    exists: policyInfo.exists,
    policy,
    defaulted: !policyInfo.exists,
    bindings,
    diagnostics: annotatedDiagnostics,
    errors
  };
}

/**
 * @param {string} projectPath
 * @returns {ReturnType<typeof buildGeneratorPolicyCheckPayload> & { rules: Array<{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }> }}
 */
export function buildGeneratorPolicyExplainPayload(projectPath) {
  const check = buildGeneratorPolicyCheckPayload(projectPath);
  const policy = check.policy || effectiveGeneratorPolicy({ path: check.path, exists: false, policy: null, diagnostics: [] });
  const rules = [];
  rules.push(generatorPolicyRule(
    "policy-file",
    check.exists,
    check.exists ? "present" : "missing",
    "present",
    check.exists
      ? "Project has a generator policy file."
      : "Project is using the default generator policy.",
    check.exists ? null : "Run `topogram generator policy init` after review."
  ));
  for (const binding of check.bindings) {
    const scope = packageScopeFromName(binding.packageName);
    rules.push(generatorPolicyRule(
      "allowed-package",
      generatorPackageAllowed(policy, binding.packageName),
      `${binding.packageName}${scope ? ` (${scope})` : ""}`,
      [
        `scopes=${policy.allowedPackageScopes.join(", ") || "(none)"}`,
        `packages=${policy.allowedPackages.join(", ") || "(none)"}`
      ].join("; "),
      `Runtime '${binding.runtimeId}' package-backed generator must be from an allowed package or scope.`,
      `Run \`topogram generator policy pin ${binding.packageName}@${binding.version}\` after reviewing the generator package.`
    ));
    const pinnedVersion = policy.pinnedVersions[binding.packageName] || policy.pinnedVersions[binding.generatorId] || null;
    rules.push(generatorPolicyRule(
      "pinned-version",
      !pinnedVersion || pinnedVersion === binding.version,
      binding.version,
      pinnedVersion || "(unpinned)",
      `Runtime '${binding.runtimeId}' generator version must match its policy pin when one exists.`,
      `Run \`topogram generator policy pin ${binding.packageName}@${binding.version}\` after review.`
    ));
  }
  return {
    ...check,
    rules
  };
}

/**
 * @param {string} projectPath
 * @returns {ReturnType<typeof buildGeneratorPolicyExplainPayload> & { summary: { packageBackedGenerators: number, allowed: number, denied: number, pinned: number, unpinned: number, pinMismatches: number } }}
 */
export function buildGeneratorPolicyStatusPayload(projectPath) {
  const explain = buildGeneratorPolicyExplainPayload(projectPath);
  return {
    ...explain,
    summary: {
      packageBackedGenerators: explain.bindings.length,
      allowed: explain.bindings.filter((binding) => binding.allowed).length,
      denied: explain.bindings.filter((binding) => !binding.allowed).length,
      pinned: explain.bindings.filter((binding) => Boolean(binding.pin.version)).length,
      unpinned: explain.bindings.filter((binding) => !binding.pin.version).length,
      pinMismatches: explain.bindings.filter((binding) => binding.pin.matches === false).length
    }
  };
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, policy: any, diagnostics: any[], errors: string[] }}
 */
export function buildGeneratorPolicyInitPayload(projectPath) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    throw new Error("Cannot initialize generator policy without topogram.project.json.");
  }
  const policy = writeGeneratorPolicy(projectConfigInfo.configDir, defaultGeneratorPolicy());
  return {
    ok: true,
    path: path.join(projectConfigInfo.configDir, GENERATOR_POLICY_FILE),
    policy,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {string} projectPath
 * @param {string|null|undefined} spec
 * @returns {{ ok: boolean, path: string, policy: any, pinned: Array<{ packageName: string, version: string }>, diagnostics: any[], errors: string[] }}
 */
export function buildGeneratorPolicyPinPayload(projectPath, spec) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = {
      code: "generator_policy_project_missing",
      severity: "error",
      message: "Cannot pin generator policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "generator-policy"
    };
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), GENERATOR_POLICY_FILE),
      policy: null,
      pinned: [],
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policyInfo = loadGeneratorPolicy(projectConfigInfo.configDir);
  const policyDiagnostics = /** @type {any[]} */ (policyInfo.diagnostics || []);
  if (policyDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    const errors = policyDiagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message);
    return {
      ok: false,
      path: policyInfo.path,
      policy: policyInfo.policy,
      pinned: [],
      diagnostics: policyDiagnostics,
      errors
    };
  }
  let pins = [];
  try {
    pins = spec
      ? [parseGeneratorPolicyPin(spec)]
      : packageBackedGeneratorBindings(projectConfigInfo.config).map((binding) => ({
          packageName: binding.packageName,
          version: binding.version
        }));
  } catch (error) {
    const diagnostic = {
      code: "generator_policy_pin_invalid",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
      path: policyInfo.path,
      suggestedFix: "Pass a pin such as @topogram/generator-react-web@1.",
      step: "generator-policy"
    };
    return {
      ok: false,
      path: policyInfo.path,
      policy: policyInfo.policy,
      pinned: [],
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  if (pins.length === 0) {
    const diagnostic = {
      code: "generator_policy_pin_no_generators",
      severity: "error",
      message: "No package-backed topology generator bindings are available to pin.",
      path: projectConfigInfo.configPath,
      suggestedFix: "Pass an explicit pin such as @topogram/generator-react-web@1, or use bundled generators.",
      step: "generator-policy"
    };
    return {
      ok: false,
      path: policyInfo.path,
      policy: policyInfo.policy,
      pinned: [],
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policy = policyInfo.policy || defaultGeneratorPolicy();
  const allowedPackages = [...policy.allowedPackages];
  const allowedPackageScopes = [...policy.allowedPackageScopes];
  const pinnedVersions = { ...policy.pinnedVersions };
  for (const pin of pins) {
    if (!allowedPackages.includes(pin.packageName)) {
      allowedPackages.push(pin.packageName);
    }
    pinnedVersions[pin.packageName] = pin.version;
  }
  const nextPolicy = {
    ...policy,
    allowedPackageScopes,
    allowedPackages,
    pinnedVersions
  };
  writeGeneratorPolicy(projectConfigInfo.configDir, nextPolicy);
  return {
    ok: true,
    path: path.join(projectConfigInfo.configDir, GENERATOR_POLICY_FILE),
    policy: nextPolicy,
    pinned: pins,
    diagnostics: [],
    errors: []
  };
}
