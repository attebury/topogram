import { stableSortedStrings } from "./primitives.js";
import { verificationIdsForTarget } from "./relationships.js";

/**
 * @param {unknown} value
 * @returns {any}
 */
export function jsonByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value));
}

/**
 * @param {unknown} value
 * @returns {any}
 */
export function jsonLineCount(value) {
  return JSON.stringify(value, null, 2).split("\n").length;
}

/**
 * @param {number} part
 * @param {number} whole
 * @returns {any}
 */
export function percentOf(part, whole) {
  if (!whole) {
    return 0;
  }
  return Number(((part / whole) * 100).toFixed(2));
}

/**
 * @returns {any}
 */
export function buildDefaultWriteScope() {
  return {
    safe_to_edit: ["topogram/**", "candidates/**"],
    generator_owned: ["artifacts/**", "apps/**"],
    human_owned_review_required: ["examples/maintained/proof-app/**"],
    out_of_bounds: [".git/**", "node_modules/**"]
  };
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {Iterable<string>} maintainedFiles
 * @returns {any}
 */
export function buildMaintainedWriteScope(graph, maintainedFiles = []) {
  return {
    safe_to_edit: stableSortedStrings(maintainedFiles),
    generator_owned: ["artifacts/**", "apps/**"],
    human_owned_review_required: stableSortedStrings([
      ...maintainedFiles,
      "examples/maintained/proof-app/**"
    ]),
    out_of_bounds: ["topogram/**"]
  };
}

/**
 * @param {import("./types.d.ts").ContextGraph} graph
 * @param {Iterable<string>} targetIds
 * @param {import("./types.d.ts").VerificationTargetOptions} options
 * @returns {any}
 */
export function recommendedVerificationTargets(graph, targetIds = [], options = {}) {
  const verificationIds = verificationIdsForTarget(graph, targetIds);
  const base = /** @type {any} */ ({
    verification_ids: verificationIds,
    generated_checks: verificationIds.length > 0 ? ["compile-check", "runtime-check"] : ["compile-check"],
    maintained_app_checks: [],
    rationale: options.rationale || null
  });

  if (options.includeMaintainedApp) {
    base.maintained_app_checks = [
      "examples/maintained/proof-app/scripts/compile-check.mjs",
      "examples/maintained/proof-app/scripts/smoke.mjs",
      "examples/maintained/proof-app/scripts/runtime-check.mjs"
    ];
  }

  return base;
}
