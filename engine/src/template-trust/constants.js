// @ts-check

export const TEMPLATE_TRUST_FILE = ".topogram-template-trust.json";
export const TEMPLATE_TRUST_POLICY = "topogram-template-executable-implementation-v1";
export const IGNORED_IMPLEMENTATION_ENTRIES = new Set([".DS_Store", "node_modules", ".tmp"]);
export const MAX_TEXT_DIFF_BYTES = 256 * 1024;
export const TRUST_REVIEW_COMMANDS = "`topogram trust status`, `topogram trust diff`, and `topogram trust template`";

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeRoot(value) {
  return String(value || "").replace(/\\/g, "/");
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeRelativePath(value) {
  return value.replace(/\\/g, "/");
}

/**
 * @param {string} relativePath
 * @returns {string}
 */
export function unsupportedImplementationSymlinkMessage(relativePath) {
  return `Template implementation contains unsupported symlink '${relativePath}'. Implementation trust hashes real files under implementation/; symlinks can point outside the trusted root. Replace symlinks with real files under implementation/, then run ${TRUST_REVIEW_COMMANDS} after review.`;
}

/**
 * @param {string} modulePath
 * @returns {string}
 */
export function implementationOutsideRootMessage(modulePath) {
  return `Template implementation module '${modulePath}' must be under implementation/. Keep executable template code inside implementation/ so the trust record covers what topogram generate may load. Move the module back under implementation/, then run ${TRUST_REVIEW_COMMANDS} after review.`;
}

/**
 * @param {string|string[]} issueOrIssues
 * @returns {string}
 */
export function templateTrustRecoveryGuidance(issueOrIssues) {
  const issues = Array.isArray(issueOrIssues) ? issueOrIssues : [issueOrIssues];
  const text = issues.join("\n");
  if (issues.length > 0 && issues.every((issue) =>
    issue.includes("topogram trust status") &&
    issue.includes("topogram trust diff") &&
    issue.includes("topogram trust template")
  )) {
    return "";
  }
  if (text.includes("unsupported symlink")) {
    return `Replace symlinks with real files under implementation/, then run ${TRUST_REVIEW_COMMANDS} after review.`;
  }
  if (text.includes("must be under implementation/")) {
    return `Keep executable template code under implementation/ so it can be hashed and trusted; move the module back under implementation/, then run ${TRUST_REVIEW_COMMANDS} after review.`;
  }
  return `Run \`topogram trust status\` and \`topogram trust diff\` to review implementation changes; after review, run \`topogram trust template\` to trust the current files.`;
}
