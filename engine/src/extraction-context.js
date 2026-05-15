// @ts-check

import fs from "node:fs";
import path from "node:path";

import { TOPOGRAM_IMPORT_FILE } from "./import/provenance.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} record
 * @param {string} provenancePath
 * @returns {AnyRecord}
 */
export function buildExtractionContext(record, provenancePath) {
  const extractorPackages = /** @type {AnyRecord[]} */ (Array.isArray(record.extract?.extractorPackages)
    ? record.extract.extractorPackages
    : []);
  const packageBackedExtractors = extractorPackages
    .filter((entry) => entry?.source === "package")
    .map((entry) => ({
      id: entry.id || null,
      version: entry.version || null,
      manifestVersion: entry.version || null,
      packageName: entry.packageName || null,
      packageVersion: entry.packageVersion || null,
      packageVersionStatus: entry.packageVersionStatus || null,
      compatibleCliRange: entry.compatibleCliRange || null,
      policyPin: entry.policyPin || null,
      extractors: Array.isArray(entry.extractors) ? entry.extractors : [],
      tracks: Array.isArray(entry.tracks) ? entry.tracks : [],
      manifestPath: entry.manifestPath || null
    }));
  const bundledExtractors = extractorPackages
    .filter((entry) => entry?.source === "bundled")
    .map((entry) => ({
      id: entry.id || null,
      version: entry.version || null,
      extractors: Array.isArray(entry.extractors) ? entry.extractors : [],
      tracks: Array.isArray(entry.tracks) ? entry.tracks : []
    }));
  return {
    type: "extraction_context",
    provenance_path: provenancePath,
    kind: record.kind || null,
    extracted_at: record.extractedAt || null,
    refreshed_at: record.refreshedAt || null,
    source_path: record.source?.path || null,
    tracks: Array.isArray(record.extract?.tracks) ? record.extract.tracks : [],
    findings_count: record.extract?.findingsCount || 0,
    candidate_counts: record.extract?.candidateCounts || {},
    package_backed_extractors: packageBackedExtractors,
    bundled_extractors: bundledExtractors,
    summary: {
      package_backed_extractor_count: packageBackedExtractors.length,
      bundled_extractor_count: bundledExtractors.length,
      source_file_count: Array.isArray(record.files) ? record.files.length : 0
    },
    next_commands: [
      "topogram extract check",
      "topogram extract plan",
      "topogram adopt --list",
      "topogram adopt <selector> --dry-run"
    ],
    safety_notes: [
      "Extractor packages are evidence producers only; review candidates before canonical adoption.",
      "Use dry-run adoption before --write, especially when package-backed extractors contributed candidates."
    ]
  };
}

/**
 * @param {string} topogramRoot
 * @returns {AnyRecord|null}
 */
export function readExtractionContext(topogramRoot) {
  const provenancePath = path.join(path.dirname(topogramRoot), TOPOGRAM_IMPORT_FILE);
  if (!fs.existsSync(provenancePath)) {
    return null;
  }
  return buildExtractionContext(JSON.parse(fs.readFileSync(provenancePath, "utf8")), provenancePath);
}
