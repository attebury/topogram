// @ts-check

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} actual
 * @param {string} expected
 * @param {string} message
 * @param {string|null} fix
 * @returns {{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }}
 */
export function generatorPolicyRule(name, ok, actual, expected, message, fix = null) {
  return { name, ok, actual, expected, message, fix };
}

/**
 * @param {string} name
 * @returns {string}
 */
export function generatorPolicyRuleLabel(name) {
  return ({
    "policy-file": "Policy file",
    "allowed-package": "Allowed package",
    "pinned-version": "Pinned version"
  })[name] || name;
}

/**
 * @param {any} policyInfo
 * @returns {any}
 */
export function effectiveGeneratorPolicy(policyInfo) {
  return policyInfo.policy || {
    version: "0.1",
    allowedPackageScopes: ["@topogram"],
    allowedPackages: [],
    pinnedVersions: {}
  };
}
