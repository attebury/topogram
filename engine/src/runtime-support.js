// @ts-check

export const MINIMUM_NODE_MAJOR = 20;

/**
 * @param {string} version
 * @returns {{ ok: boolean, major: number, minimum: number, message: string|null }}
 */
export function nodeVersionSupport(version = process.versions.node) {
  const major = Number.parseInt(String(version).split(".")[0] || "0", 10);
  const ok = Number.isFinite(major) && major >= MINIMUM_NODE_MAJOR;
  return {
    ok,
    major,
    minimum: MINIMUM_NODE_MAJOR,
    message: ok ? null : `Topogram requires Node.js ${MINIMUM_NODE_MAJOR}+; current runtime is ${version}.`
  };
}

/**
 * @param {string} [version]
 * @returns {void}
 */
export function assertSupportedNode(version = process.versions.node) {
  const support = nodeVersionSupport(version);
  if (!support.ok) {
    throw new Error(support.message || `Topogram requires Node.js ${MINIMUM_NODE_MAJOR}+.`);
  }
}
