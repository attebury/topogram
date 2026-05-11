// Bridge between archived JSONL entries and the live resolver graph.
//
// At workspace load time the resolver bridge:
//   1. Walks the workspace `_archive/*.jsonl`
//   2. Builds a flat list of frozen entries (each with `archived: true`)
//   3. Returns `{ entries, byId }` so the caller can merge them into the
//      registry / graph
//
// Frozen entries participate in cross-references and the traceability
// matrix but are filtered out of slices and boards by default.

import path from "node:path";
import { listArchiveFiles, parseArchiveFile } from "./jsonl.js";

function kindFromFilename(filePath) {
  // tasks-2026.jsonl → task
  const base = path.basename(filePath, ".jsonl");
  const dashIndex = base.lastIndexOf("-");
  if (dashIndex < 0) return null;
  const plural = base.slice(0, dashIndex);
  if (plural.endsWith("s")) return plural.slice(0, -1);
  return plural;
}

export function loadArchive(workspaceRoot) {
  const entries = [];
  const errors = [];
  for (const file of listArchiveFiles(workspaceRoot)) {
    const expectedKind = kindFromFilename(file);
    for (const raw of parseArchiveFile(file)) {
      if (raw.__error) {
        errors.push(raw.__error);
        continue;
      }
      if (expectedKind && raw.kind && raw.kind !== expectedKind) {
        errors.push(`${file}: entry id='${raw.id}' has kind '${raw.kind}', expected '${expectedKind}'`);
        continue;
      }
      const schemaErrors = validateArchivedEntry(file, raw, expectedKind);
      if (schemaErrors.length > 0) {
        errors.push(...schemaErrors);
        continue;
      }
      entries.push(normalizeArchivedEntry(raw));
    }
  }
  const byId = new Map(entries.map((e) => [e.id, e]));
  return { entries, byId, errors };
}

function validateArchivedEntry(file, raw, expectedKind) {
  const errors = [];
  const label = `${file}: archive entry`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [`${label} must be an object`];
  }
  for (const key of ["id", "kind", "status"]) {
    if (typeof raw[key] !== "string" || raw[key].trim() === "") {
      errors.push(`${label} must include string '${key}'`);
    }
  }
  if (expectedKind && typeof raw.kind === "string" && raw.kind !== expectedKind) {
    errors.push(`${label} id='${raw.id}' has kind '${raw.kind}', expected '${expectedKind}'`);
  }
  if (raw.fields !== undefined && (!raw.fields || typeof raw.fields !== "object" || Array.isArray(raw.fields))) {
    errors.push(`${label} id='${raw.id}' field 'fields' must be an object when present`);
  }
  if (!Array.isArray(raw.transitions)) {
    errors.push(`${label} id='${raw.id}' must include transitions array`);
  }
  if (!raw.archived || typeof raw.archived !== "object" || Array.isArray(raw.archived)) {
    errors.push(`${label} id='${raw.id}' must include archived metadata object`);
  } else if (typeof raw.archived.at !== "string" || raw.archived.at.trim() === "") {
    errors.push(`${label} id='${raw.id}' archived metadata must include string 'at'`);
  }
  return errors;
}

function normalizeArchivedEntry(raw) {
  const fields = raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields) ? raw.fields : {};
  return {
    ...fields,
    ...raw,
    fields,
    archived: true,
    archivedMeta: raw.archived || {},
    updated: raw.updated || fields.updated || raw.archived?.at || null
  };
}

export function mergeArchivedIntoGraph(graph, archive) {
  // Only insert entries whose id isn't already present in the live graph
  // (active workspace wins; an unarchived entry shadows the frozen one).
  const liveIds = new Set(graph.statements.map((s) => s.id));
  const merged = [...graph.statements];
  for (const entry of archive.entries) {
    if (!liveIds.has(entry.id)) {
      merged.push(entry);
    }
  }
  return {
    ...graph,
    statements: merged,
    byKind: groupByKind(merged)
  };
}

function groupByKind(statements) {
  const map = new Map();
  for (const s of statements) {
    if (!map.has(s.kind)) map.set(s.kind, []);
    map.get(s.kind).push(s);
  }
  return Object.fromEntries(map);
}
