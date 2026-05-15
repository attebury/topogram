// @ts-check

import path from "node:path";

import { stableStringify } from "./format.js";

/**
 * @typedef {{
 *   projectRoot?: string|null,
 *   workspaceRoot?: string|null,
 *   topogramRoot?: string|null,
 *   cwd?: string|null
 * }} PublicPathContext
 */

const SOURCE_PATH_KEYS = new Set([
  "file",
  "source_path",
  "sourcePath"
]);

const PATH_KEYS = new Set([
  "configPath",
  "cwd",
  "file",
  "inputPath",
  "manifestPath",
  "migrationsPath",
  "packageJson",
  "packageRoot",
  "path",
  "policyPath",
  "projectRoot",
  "provenancePath",
  "root",
  "schemaPath",
  "snapshotPath",
  "sourcePath",
  "source_path",
  "statePath",
  "target",
  "topogram",
  "topogramRoot",
  "workspaceRoot"
]);

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function absolutePathOrNull(value) {
  if (!value || typeof value !== "string") return null;
  if (/^[A-Za-z]:[\\/]/.test(value)) return value;
  if (path.isAbsolute(value)) return path.resolve(value);
  return null;
}

/**
 * @param {string} value
 * @returns {string}
 */
function toPosix(value) {
  return value.split(path.sep).join("/");
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} value
 * @returns {string}
 */
function trimTrailingSeparators(value) {
  return value.replace(/[\\/]+$/g, "");
}

/**
 * @param {string} root
 * @param {string} target
 * @returns {string|null}
 */
function relativeInside(root, target) {
  const relative = path.relative(root, target);
  if (!relative) return "";
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return toPosix(relative);
}

/**
 * @param {PublicPathContext} context
 * @returns {{ label: string, root: string }[]}
 */
function publicRoots(context = {}) {
  const candidates = [
    { label: "<repo>", root: absolutePathOrNull(context.projectRoot || context.cwd) },
    { label: "<workspace>", root: absolutePathOrNull(context.workspaceRoot || context.topogramRoot) }
  ].filter(/** @returns {entry is { label: string, root: string }} */ (entry) => Boolean(entry.root));
  const seen = new Set();
  return candidates
    .filter((entry) => {
      if (seen.has(entry.root)) return false;
      seen.add(entry.root);
      return true;
    })
    .sort((left, right) => right.root.length - left.root.length);
}

/**
 * @param {string} value
 * @returns {string}
 */
function externalPathPlaceholder(value) {
  const normalized = value.replace(/\\/g, "/");
  const basename = normalized.split("/").filter(Boolean).at(-1);
  return basename ? `<external>/${basename}` : "<external>";
}

/**
 * @param {string} value
 * @param {PublicPathContext} context
 * @param {{ source?: boolean }} [options]
 * @returns {string}
 */
export function toPortablePath(value, context = {}, options = {}) {
  if (typeof value !== "string" || value.length === 0) return value;
  const absolute = absolutePathOrNull(value);
  if (!absolute) {
    return replaceKnownPathSubstrings(value, context);
  }

  const roots = publicRoots(context);
  for (const entry of roots) {
    const relative = relativeInside(entry.root, absolute);
    if (relative == null) continue;
    if (options.source && entry.label === "<repo>") {
      return relative || ".";
    }
    return relative ? `${entry.label}/${relative}` : entry.label;
  }

  return externalPathPlaceholder(absolute);
}

/**
 * @param {string} value
 * @param {PublicPathContext} context
 * @returns {string}
 */
export function toPortableSourcePath(value, context = {}) {
  return toPortablePath(value, context, { source: true });
}

/**
 * @param {string} value
 * @param {PublicPathContext} context
 * @returns {string}
 */
export function replaceKnownPathSubstrings(value, context = {}) {
  if (typeof value !== "string" || value.length === 0) return value;
  let next = value;
  for (const entry of publicRoots(context)) {
    const rootVariants = new Set([
      trimTrailingSeparators(entry.root),
      trimTrailingSeparators(toPosix(entry.root))
    ]);
    for (const root of rootVariants) {
      if (!root) continue;
      const pattern = new RegExp(`${escapeRegExp(root)}(?=$|[\\\\/])`, "g");
      next = next.replace(pattern, entry.label);
    }
  }
  next = next.replace(/[A-Za-z]:\\Users\\[^"'`\s)]+/g, (match) => externalPathPlaceholder(match));
  next = next.replace(/\/Users\/[^"'`\s)]+/g, (match) => externalPathPlaceholder(match));
  next = next.replace(/\/home\/[^"'`\s)]+/g, (match) => externalPathPlaceholder(match));
  next = next.replace(/\/private\/tmp\/[^"'`\s)]+/g, (match) => externalPathPlaceholder(match));
  next = next.replace(/\/var\/folders\/[^"'`\s)]+/g, (match) => externalPathPlaceholder(match));
  next = next.replace(/\/tmp\/[^"'`\s)]+/g, (match) => externalPathPlaceholder(match));
  return next;
}

/**
 * @param {any} value
 * @param {PublicPathContext} [context]
 * @param {string|null} [key]
 * @returns {any}
 */
export function sanitizePublicPayload(value, context = {}, key = null) {
  if (typeof value === "string") {
    if (key && SOURCE_PATH_KEYS.has(key)) {
      return toPortableSourcePath(value, context);
    }
    if (key && PATH_KEYS.has(key)) {
      return toPortablePath(value, context);
    }
    return replaceKnownPathSubstrings(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePublicPayload(item, context, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizePublicPayload(entryValue, context, entryKey)
      ])
    );
  }
  return value;
}

/**
 * @param {any} value
 * @param {PublicPathContext} [context]
 * @returns {string}
 */
export function stablePublicStringify(value, context = {}) {
  return stableStringify(sanitizePublicPayload(value, context));
}
