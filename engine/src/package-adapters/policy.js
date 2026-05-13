// @ts-check

/**
 * @typedef {Object} PackagePolicy
 * @property {string} version
 * @property {string[]} allowedPackageScopes
 * @property {string[]} allowedPackages
 * @property {Record<string, string>} pinnedVersions
 */

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @param {string} policyPath
 * @returns {string[]}
 */
export function optionalStringArray(value, fieldName, policyPath) {
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
 * @param {string} [pinnedLabel]
 * @returns {Record<string, string>}
 */
export function optionalStringRecord(value, policyPath, pinnedLabel = "package ids") {
  if (value == null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${policyPath} pinnedVersions must be an object of ${pinnedLabel} to versions.`);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item !== "string" || item.length === 0) {
      throw new Error(`${policyPath} pinnedVersions['${key}'] must be a non-empty string.`);
    }
    return [key, item];
  }));
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
 * @param {PackagePolicy} policy
 * @param {string} packageName
 * @returns {boolean}
 */
export function packageAllowedByPolicy(policy, packageName) {
  if (policy.allowedPackages.includes(packageName)) {
    return true;
  }
  const scope = packageScopeFromName(packageName);
  return policy.allowedPackageScopes.some((allowed) => packageScopeMatches(allowed, scope));
}
