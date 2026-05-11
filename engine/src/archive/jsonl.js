// Year-bucketed JSONL archive I/O.
//
// File layout: `<project-root>/topo/sdlc/_archive/{kind}s-{year}.jsonl`
// or `<workspace-root>/sdlc/_archive/{kind}s-{year}.jsonl`
// (e.g. `tasks-2026.jsonl`, `bugs-2026.jsonl`).
//
// Each line is a self-contained archived statement. The format is JSONL so
// archives can grow append-only without requiring a full rewrite.

import { existsSync, mkdirSync, readFileSync, appendFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sdlcRootForSdlc, topogramRootForSdlc } from "../sdlc/paths.js";

const ARCHIVE_DIR = "_archive";

export function archiveDir(workspaceRoot) {
  return path.join(sdlcRootForSdlc(workspaceRoot), ARCHIVE_DIR);
}

function legacyArchiveDir(workspaceRoot) {
  return path.join(topogramRootForSdlc(workspaceRoot), ARCHIVE_DIR);
}

export function archiveFileFor(workspaceRoot, kind, year) {
  return path.join(archiveDir(workspaceRoot), `${kind}s-${year}.jsonl`);
}

function ensureArchiveDir(workspaceRoot) {
  const dir = archiveDir(workspaceRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function listArchiveFiles(workspaceRoot) {
  const dirs = [archiveDir(workspaceRoot), legacyArchiveDir(workspaceRoot)];
  const files = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    files.push(
      ...readdirSync(dir)
        .filter((name) => name.endsWith(".jsonl"))
        .map((name) => path.join(dir, name))
    );
  }
  return files;
}

export function parseArchiveFile(filePath) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf8");
  const entries = [];
  let lineNo = 0;
  for (const line of content.split(/\r?\n/)) {
    lineNo += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch (err) {
      entries.push({
        __error: `${path.basename(filePath)}:${lineNo}: ${err.message}`
      });
    }
  }
  return entries;
}

export function appendEntry(workspaceRoot, kind, entry) {
  ensureArchiveDir(workspaceRoot);
  const year = (entry.archived?.at || new Date().toISOString()).slice(0, 4);
  const file = archiveFileFor(workspaceRoot, kind, year);
  appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
  return file;
}

export function rewriteArchiveFile(filePath, entries) {
  const lines = entries.map((entry) => JSON.stringify(entry)).join("\n");
  writeFileSync(filePath, lines + (lines.length > 0 ? "\n" : ""), "utf8");
}
