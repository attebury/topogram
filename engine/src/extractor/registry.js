// @ts-check

import {
  loadPackageManifest,
  packageInstallCommand,
  packageInstallHint,
  resolvePackageManifestPath
} from "../package-adapters/index.js";
import { BUILTIN_EXTRACTOR_PACKS } from "../import/core/registry.js";

export const EXTRACTOR_TRACKS = ["db", "api", "ui", "cli", "workflows", "verification"];

/**
 * @typedef {Object} ExtractorManifest
 * @property {string} id
 * @property {string} version
 * @property {string[]} tracks
 * @property {"bundled"|"package"} source
 * @property {string[]} extractors
 * @property {Record<string, string>} stack
 * @property {Record<string, boolean>} capabilities
 * @property {string[]} candidateKinds
 * @property {string[]} evidenceTypes
 * @property {string} [package]
 * @property {string} [export]
 */

/**
 * @typedef {Object} ExtractorBinding
 * @property {string} id
 * @property {string} track
 * @property {string} packageName
 * @property {string} version
 */

/**
 * @typedef {Object} ResolvedExtractorManifest
 * @property {ExtractorManifest|null} manifest
 * @property {string[]} errors
 * @property {"bundled"|"package"|null} source
 * @property {string|null} manifestPath
 * @property {string|null} packageRoot
 */

/** @type {ExtractorManifest[]} */
export const EXTRACTOR_MANIFESTS = BUILTIN_EXTRACTOR_PACKS.map((pack) => pack.manifest);

const EXTRACTOR_MANIFEST_BY_ID = new Map(EXTRACTOR_MANIFESTS.map((manifest) => [manifest.id, manifest]));

/**
 * @param {any} value
 * @param {boolean} [nonEmpty]
 * @returns {boolean}
 */
function isStringArray(value, nonEmpty = false) {
  return Array.isArray(value) &&
    (!nonEmpty || value.length > 0) &&
    value.every((entry) => typeof entry === "string" && entry.length > 0);
}

/**
 * @param {any} value
 * @returns {value is Record<string, string>}
 */
function isStringRecord(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string");
}

/**
 * @param {any} value
 * @returns {value is Record<string, boolean>}
 */
function isBooleanRecord(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "boolean");
}

/**
 * @param {any} manifest
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateExtractorManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok: false, errors: ["Extractor manifest must be an object."] };
  }
  if (typeof manifest.id !== "string" || manifest.id.length === 0) {
    errors.push("Extractor manifest id must be a non-empty string.");
  }
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    errors.push("Extractor manifest version must be a non-empty string.");
  }
  if (!isStringArray(manifest.tracks, true)) {
    errors.push("Extractor manifest tracks must be a non-empty array of strings.");
  } else {
    for (const track of manifest.tracks) {
      if (!EXTRACTOR_TRACKS.includes(track)) {
        errors.push(`Extractor manifest track '${track}' is not supported.`);
      }
    }
  }
  if (manifest.source !== "bundled" && manifest.source !== "package") {
    errors.push("Extractor manifest source must be 'bundled' or 'package'.");
  }
  if (!isStringArray(manifest.extractors, true)) {
    errors.push("Extractor manifest extractors must be a non-empty array of strings.");
  }
  if (!isStringRecord(manifest.stack)) {
    errors.push("Extractor manifest stack must be an object of string values.");
  }
  if (!isBooleanRecord(manifest.capabilities)) {
    errors.push("Extractor manifest capabilities must be an object of boolean values.");
  }
  if (!isStringArray(manifest.candidateKinds)) {
    errors.push("Extractor manifest candidateKinds must be an array of strings.");
  }
  if (!isStringArray(manifest.evidenceTypes)) {
    errors.push("Extractor manifest evidenceTypes must be an array of strings.");
  }
  if (manifest.package != null && (typeof manifest.package !== "string" || manifest.package.length === 0)) {
    errors.push("Extractor manifest package must be a non-empty string when present.");
  }
  if (manifest.export != null && (typeof manifest.export !== "string" || manifest.export.length === 0)) {
    errors.push("Extractor manifest export must be a non-empty string when present.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {string} extractorId
 * @returns {ExtractorManifest|null}
 */
export function getExtractorManifest(extractorId) {
  return EXTRACTOR_MANIFEST_BY_ID.get(extractorId) || null;
}

/**
 * @param {string|null|undefined} packageName
 * @returns {string|null}
 */
export function packageExtractorInstallCommand(packageName) {
  return packageInstallCommand(packageName);
}

/**
 * @param {string|null|undefined} packageName
 * @returns {string|null}
 */
export function packageExtractorInstallHint(packageName) {
  return packageInstallHint(packageName);
}

/**
 * @param {string} packageName
 * @param {string|null|undefined} rootDir
 * @returns {{ manifestPath: string|null, packageRoot: string|null, error: string|null }}
 */
export function resolvePackageExtractorManifestPath(packageName, rootDir = process.cwd()) {
  return resolvePackageManifestPath(packageName, "topogram-extractor.json", rootDir, "Extractor package");
}

/**
 * @param {string} packageName
 * @param {string|null|undefined} rootDir
 * @returns {{ manifest: ExtractorManifest|null, errors: string[], manifestPath: string|null, packageRoot: string|null }}
 */
export function loadPackageExtractorManifest(packageName, rootDir = process.cwd()) {
  return loadPackageManifest({
    packageName,
    rootDir,
    manifestFile: "topogram-extractor.json",
    packageLabel: "Extractor package",
    validateManifest: validateExtractorManifest
  });
}

/**
 * @param {Record<string, any>|null|undefined} manifest
 * @returns {ExtractorBinding[]}
 */
export function extractorBindingsForManifest(manifest) {
  if (!manifest || manifest.source !== "package" || typeof manifest.package !== "string") {
    return [];
  }
  return (manifest.extractors || []).map((/** @type {any} */ extractorId) => ({
    id: String(extractorId),
    track: Array.isArray(manifest.tracks) && manifest.tracks.length === 1 ? String(manifest.tracks[0]) : "multiple",
    packageName: String(manifest.package),
    version: String(manifest.version || "unknown")
  }));
}
