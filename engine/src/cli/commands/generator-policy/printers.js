// @ts-check

import path from "node:path";

import { formatGeneratorPackageLockfile } from "./package-info.js";
import { generatorPolicyRuleLabel } from "./shared.js";

/**
 * @param {{ ok: boolean, path: string, policy: any }} payload
 * @returns {void}
 */
export function printGeneratorPolicyInitPayload(payload) {
  console.log(`Wrote generator policy: ${payload.path}`);
  console.log(`Allowed package scopes: ${payload.policy.allowedPackageScopes.join(", ") || "(none)"}`);
  console.log(`Allowed packages: ${payload.policy.allowedPackages.join(", ") || "(none)"}`);
}

/**
 * @param {any} payload
 * @returns {void}
 */
export function printGeneratorPolicyCheckPayload(payload) {
  console.log(payload.ok ? "Generator policy check passed" : "Generator policy check failed");
  console.log(`Policy: ${payload.path}`);
  console.log(`Exists: ${payload.exists ? "yes" : "no"}`);
  console.log(`Defaulted: ${payload.defaulted ? "yes" : "no"}`);
  console.log(`Package-backed generators: ${payload.bindings.length}`);
  for (const binding of payload.bindings) {
    console.log(`- ${binding.runtimeId}: ${binding.generatorId}@${binding.version} via ${binding.packageName}`);
    console.log(`  npm package: ${binding.packageInfo.installedVersion || "(not installed)"}`);
    if (binding.packageInfo.dependencySpec) {
      console.log(`  dependency: ${binding.packageInfo.dependencyField} ${binding.packageInfo.dependencySpec}`);
    }
    if (binding.packageInfo.lockfileVersion) {
      console.log(`  lockfile: ${formatGeneratorPackageLockfile(binding.packageInfo)}`);
    } else if (binding.packageInfo.lockfileKind) {
      console.log(`  lockfile: ${formatGeneratorPackageLockfile(binding.packageInfo)}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {any} payload
 * @returns {void}
 */
export function printGeneratorPolicyStatusPayload(payload) {
  console.log(payload.ok ? "Generator policy status: allowed" : "Generator policy status: denied");
  console.log(`Policy file: ${payload.path}`);
  console.log(`Policy file exists: ${payload.exists ? "yes" : "no"}`);
  console.log(`Default policy active: ${payload.defaulted ? "yes" : "no"}`);
  console.log(`Package-backed generators: ${payload.summary.packageBackedGenerators}`);
  console.log(`Allowed packages: ${payload.summary.allowed}`);
  console.log(`Denied packages: ${payload.summary.denied}`);
  console.log(`Pinned generators: ${payload.summary.pinned}`);
  console.log(`Unpinned generators: ${payload.summary.unpinned}`);
  console.log(`Pin mismatches: ${payload.summary.pinMismatches}`);
  if (payload.bindings.length > 0) {
    console.log("");
    console.log("Generator packages:");
  }
  for (const binding of payload.bindings) {
    console.log(`- ${binding.runtimeId}: ${binding.generatorId}@${binding.version} via ${binding.packageName}`);
    console.log(`  allowed: ${binding.allowed ? "yes" : "no"}`);
    console.log(`  npm package: ${binding.packageInfo.installedVersion || "(not installed)"}`);
    console.log(`  dependency: ${binding.packageInfo.dependencyField && binding.packageInfo.dependencySpec ? `${binding.packageInfo.dependencyField} ${binding.packageInfo.dependencySpec}` : "(not declared)"}`);
    console.log(`  lockfile: ${formatGeneratorPackageLockfile(binding.packageInfo)}`);
    console.log(`  policy pin: ${binding.pin.version ? `${binding.pin.key}@${binding.pin.version}` : "(none)"}`);
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.packageVersion) {
      console.log(`  package version: ${diagnostic.packageVersion}`);
    }
    if (diagnostic.packageDependencySpec) {
      console.log(`  dependency: ${diagnostic.packageDependencyField} ${diagnostic.packageDependencySpec}`);
    }
    if (diagnostic.packageLockfilePath) {
      console.log(`  lockfile: ${path.basename(diagnostic.packageLockfilePath)}${diagnostic.packageLockVersion ? ` ${diagnostic.packageLockVersion}` : ""}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {any} payload
 * @returns {void}
 */
export function printGeneratorPolicyExplainPayload(payload) {
  console.log(payload.ok ? "Generator policy: allowed" : "Generator policy: denied");
  console.log(payload.ok
    ? "Decision: package-backed generators are allowed by this project's generator policy."
    : "Decision: one or more package-backed generators are blocked by this project's generator policy.");
  console.log(`Policy file: ${payload.path}`);
  console.log(`Policy file exists: ${payload.exists ? "yes" : "no"}`);
  console.log(`Default policy active: ${payload.defaulted ? "yes" : "no"}`);
  if (payload.bindings.length > 0) {
    console.log("");
    console.log("Package-backed generators:");
    for (const binding of payload.bindings) {
      console.log(`- ${binding.runtimeId}: ${binding.generatorId}@${binding.version} via ${binding.packageName}`);
      console.log(`  npm package: ${binding.packageInfo.installedVersion || "(not installed)"}`);
      if (binding.packageInfo.dependencySpec) {
        console.log(`  dependency: ${binding.packageInfo.dependencyField} ${binding.packageInfo.dependencySpec}`);
      }
    }
  }
  if (payload.rules.length > 0) {
    console.log("");
    console.log("Policy checks:");
  }
  for (const rule of payload.rules) {
    console.log(`${rule.ok ? "PASS" : "FAIL"} ${generatorPolicyRuleLabel(rule.name)}: ${rule.message}`);
    console.log(`  actual: ${rule.actual}`);
    console.log(`  expected: ${rule.expected}`);
    if (!rule.ok && rule.fix) {
      console.log(`  fix: ${rule.fix}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {{ ok: boolean, path: string, pinned: Array<{ packageName: string, version: string }>, diagnostics: any[] }} payload
 * @returns {void}
 */
export function printGeneratorPolicyPinPayload(payload) {
  console.log(payload.ok ? "Generator policy pin updated" : "Generator policy pin failed");
  console.log(`Policy: ${payload.path}`);
  for (const pin of payload.pinned) {
    console.log(`Pinned: ${pin.packageName}@${pin.version}`);
  }
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}
