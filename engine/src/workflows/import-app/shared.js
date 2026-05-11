// @ts-check
import fs from "node:fs";
import path from "node:path";

import { relativeTo } from "../../path-helpers.js";
import { canonicalCandidateTerm, idHintify } from "../../text-helpers.js";
import { listFilesRecursive } from "../shared.js";

export const IMPORT_TRACKS = new Set(["db", "api", "ui", "cli", "workflows", "verification"]);
export const SCALAR_FIELD_TYPES = new Set([
  "bigint",
  "boolean",
  "bytes",
  "datetime",
  "decimal",
  "float",
  "int",
  "json",
  "string",
  "text",
  "uuid"
]);

/** @param {any} fromValue @returns {any} */
export function parseImportTracks(fromValue) {
  if (!fromValue) {
    return ["db", "api"];
  }
  const tracks = String(fromValue)
    .split(",")
    .map((/** @type {any} */ track) => track.trim().toLowerCase())
    .filter(Boolean);
  if (tracks.length === 0) {
    throw new Error("Expected --from to include at least one import track");
  }
  const invalid = tracks.filter((/** @type {any} */ track) => !IMPORT_TRACKS.has(track));
  if (invalid.length > 0) {
    throw new Error(`Unsupported import track(s): ${invalid.join(", ")}`);
  }
  return [...new Set(tracks)];
}

/** @param {WorkspacePaths} paths @returns {any} */
export function importSearchRoots(paths) {
  return [...new Set([paths.workspaceRoot, paths.topogramRoot].filter(Boolean))];
}

/** @param {WorkspacePaths} paths @param {string} filePath @returns {any} */
export function normalizeImportRelativePath(paths, filePath) {
  return relativeTo(paths.repoRoot, filePath);
}

/** @param {WorkspacePaths} paths @param {string} filePath @param {string} kind @returns {any} */
export function canonicalSourceRank(paths, filePath, kind) {
  const relativePath = normalizeImportRelativePath(paths, filePath);
  const normalizedPath = relativePath.replaceAll(path.sep, "/");
  const penalties = [
    { pattern: /\/apps\/local-stack\//, weight: 80 },
    { pattern: /\/artifacts\/environment\//, weight: 60 },
    { pattern: /\/artifacts\/deploy\//, weight: 60 },
    { pattern: /\/artifacts\/compile-check\//, weight: 50 },
    { pattern: /\/artifacts\/db-lifecycle\//, weight: 50 },
    { pattern: /\/artifacts\/migrations\//, weight: 40 }
  ];

  let rank = 100;
  if (kind === "prisma") {
    if (/\/prisma\/schema\.prisma$/i.test(normalizedPath) && !normalizedPath.includes("/artifacts/")) {
      rank = 0;
    } else if (/\/apps\/backend\/prisma\/schema\.prisma$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/artifacts\/prisma\/schema\.prisma$/i.test(normalizedPath)) {
      rank = 10;
    }
  } else if (kind === "sql") {
    if (/\/db\/schema\.sql$/i.test(normalizedPath) || /\/schema\.sql$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/artifacts\/db\/.+\.sql$/i.test(normalizedPath)) {
      rank = 10;
    } else if (/migration/i.test(path.basename(normalizedPath))) {
      rank = 30;
    }
  } else if (kind === "openapi") {
    if (/\/artifacts\/openapi\/openapi\.(json|ya?ml)$/i.test(normalizedPath)) {
      rank = 0;
    } else if (/\/openapi\.(json|ya?ml)$/i.test(normalizedPath) || /\/swagger\.(json|ya?ml)$/i.test(normalizedPath)) {
      rank = 10;
    }
  }

  for (const penalty of penalties) {
    if (penalty.pattern.test(normalizedPath)) {
      rank += penalty.weight;
    }
  }
  return rank;
}

/** @param {WorkspacePaths} paths @param {any[]} files @param {string} kind @returns {any} */
export function selectPreferredImportFiles(paths, files, kind) {
  if (files.length === 0) {
    return [];
  }
  const rankedFiles = files.map((/** @type {any} */ filePath) => ({
    filePath,
    rank: canonicalSourceRank(paths, filePath, kind)
  }));
  const bestRank = Math.min(...rankedFiles.map((/** @type {any} */ entry) => entry.rank));
  return rankedFiles
    .filter((/** @type {any} */ entry) => entry.rank === bestRank)
    .map((/** @type {any} */ entry) => entry.filePath)
    .sort();
}

/** @param {WorkspacePaths} paths @param {any} predicate @returns {any} */
export function findImportFiles(paths, predicate) {
  const files = new Set();
  for (const rootDir of importSearchRoots(paths)) {
    for (const filePath of listFilesRecursive(rootDir, predicate)) {
      if (
        filePath.includes(`${path.sep}candidates${path.sep}`) ||
        filePath.includes(`${path.sep}docs-generated${path.sep}`) ||
        filePath.includes(`${path.sep}topogram${path.sep}tests${path.sep}fixtures${path.sep}expected${path.sep}`)
      ) {
        continue;
      }
      files.add(filePath);
    }
  }
  return [...files].sort();
}

/** @param {WorkflowRecord} input @returns {CandidateRecord} */
export function makeCandidateRecord({
  kind,
  idHint,
  label,
  confidence = "medium",
  sourceKind,
  sourceOfTruth = "imported",
  provenance,
  track = null,
  ...payload
}) {
  const inferredTrack =
    track ||
    (["entity", "enum", "relation", "index"].includes(kind)
      ? "db"
      : kind === "capability"
        ? "api"
        : null);
  return {
    kind,
    id_hint: idHint,
    label,
    confidence,
    source_kind: sourceKind,
    source_of_truth: sourceOfTruth,
    provenance: Array.isArray(provenance) ? provenance : [provenance].filter(Boolean),
    track: inferredTrack,
    ...payload
  };
}

/** @param {any[]} records @param {any} keyFn @returns {any} */
export function dedupeCandidateRecords(records, keyFn) {
  const seen = new Map();
  for (const record of records) {
    const key = keyFn(record);
    const recordProvenance = Array.isArray(record.provenance) ? record.provenance : [record.provenance].filter(Boolean);
    if (!seen.has(key)) {
      seen.set(key, { ...record, provenance: recordProvenance });
      continue;
    }
    const current = seen.get(key);
    const currentProvenance = Array.isArray(current.provenance) ? current.provenance : [current.provenance].filter(Boolean);
    current.provenance = [...new Set([...currentProvenance, ...recordProvenance])];
  }
  return [...seen.values()];
}

/** @param {string} pathValue @returns {any} */
export function normalizeOpenApiPath(pathValue) {
  return String(pathValue || "")
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}")
    .replace(/\/+$/, "") || "/";
}

/** @param {string} pathValue @returns {any} */
export function normalizeEndpointPathForMatch(pathValue) {
  const normalizedPath = normalizeOpenApiPath(pathValue);
  const segments = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((/** @type {any} */ segment) => {
      if (/^\{[^}]+\}$/.test(segment)) {
        return "{}";
      }
      return segment
        .split("-")
        .map((/** @type {any} */ part) => canonicalCandidateTerm(part))
        .join("-");
    });
  return `/${segments.join("/")}`.replace(/\/+$/, "") || "/";
}

/** @param {WorkflowRecord} record @returns {any} */
export function inferCapabilityEntityId(record) {
  if (record.entity_id) {
    return record.entity_id;
  }
  const pathSegments = normalizeEndpointPathForMatch(record.endpoint?.path || "")
    .split("/")
    .filter(Boolean)
    .filter((/** @type {any} */ segment) => segment !== "{}");
  const resourceSegment = pathSegments[0] || record.id_hint.replace(/^cap_(create|update|delete|get|list)_/, "");
  return `entity_${idHintify(canonicalCandidateTerm(resourceSegment))}`;
}
