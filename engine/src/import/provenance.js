import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { listFilesRecursive, relativeTo } from "./core/shared.js";

export const TOPOGRAM_IMPORT_FILE = ".topogram-extract.json";

function fileHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length
  };
}

function isSameOrInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeExcludeRoots(sourceRoot, excludeRoots = []) {
  return excludeRoots
    .filter(Boolean)
    .map((item) => path.resolve(item))
    .filter((item) => isSameOrInside(sourceRoot, item));
}

export function collectImportSourceFileRecords(sourceRoot, options = {}) {
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const excludeRoots = normalizeExcludeRoots(resolvedSourceRoot, options.excludeRoots || []);
  return listFilesRecursive(resolvedSourceRoot, (filePath) => {
    return !excludeRoots.some((excludeRoot) => isSameOrInside(excludeRoot, filePath));
  }).map((filePath) => ({
    path: relativeTo(resolvedSourceRoot, filePath),
    ...fileHash(filePath)
  }));
}

export function writeTopogramImportRecord(projectRoot, input) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const timestamp = input.timestamp || new Date().toISOString();
  const record = {
    version: "0.1",
    kind: "brownfield-extract",
    extractedAt: input.importedAt || timestamp,
    ...(input.refreshedAt ? { refreshedAt: input.refreshedAt } : {}),
    source: {
      path: path.resolve(input.sourceRoot),
      hashAlgorithm: "sha256",
      ignoredRoots: (input.ignoredRoots || []).map((item) => path.resolve(item))
    },
    extract: {
      tracks: input.tracks || [],
      findingsCount: input.findingsCount || 0,
      candidateCounts: input.candidateCounts || {},
      extractorPackages: input.extractorPackages || []
    },
    ownership: {
      extractedArtifacts: "project-owned",
      note: "Topogram artifacts created by extraction are editable after extraction. Source hashes record the brownfield app evidence trusted at extraction time."
    },
    ...(input.refresh ? { refresh: input.refresh } : {}),
    files: input.files || []
  };
  const importPath = path.join(resolvedProjectRoot, TOPOGRAM_IMPORT_FILE);
  fs.writeFileSync(importPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { path: importPath, record };
}

export function buildTopogramImportStatus(projectRoot) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const importPath = path.join(resolvedProjectRoot, TOPOGRAM_IMPORT_FILE);
  if (!fs.existsSync(importPath)) {
    return {
      ok: false,
      exists: false,
      path: importPath,
      status: "missing",
      source: null,
      content: { changed: [], added: [], removed: [] },
      diagnostics: [{
        code: "topogram_extract_missing",
        severity: "error",
        message: `${TOPOGRAM_IMPORT_FILE} was not found. This workspace does not have brownfield extraction provenance.`,
        path: importPath,
        suggestedFix: "Run `topogram extract <app-path> --out <target>` to create an extracted Topogram workspace."
      }],
      errors: [`${TOPOGRAM_IMPORT_FILE} was not found.`]
    };
  }

  const source = JSON.parse(fs.readFileSync(importPath, "utf8"));
  const sourceRoot = path.resolve(source.source?.path || "");
  if (!sourceRoot || !fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    const message = `Extracted source path was not found: ${source.source?.path || "unknown"}`;
    return {
      ok: false,
      exists: true,
      path: importPath,
      status: "missing-source",
      source,
      content: { changed: [], added: [], removed: [] },
      diagnostics: [{
      code: "topogram_extract_source_missing",
        severity: "error",
        message,
        path: source.source?.path || null,
        suggestedFix: "Restore the extracted source path or rerun extract from the current brownfield app location."
      }],
      errors: [message]
    };
  }

  const trustedFiles = Array.isArray(source.files) ? source.files : [];
  const trustedByPath = new Map(trustedFiles.map((file) => [String(file.path), file]));
  const currentFiles = collectImportSourceFileRecords(sourceRoot, {
    excludeRoots: source.source?.ignoredRoots || [resolvedProjectRoot]
  });
  const currentByPath = new Map(currentFiles.map((file) => [file.path, file]));
  const changed = [];
  const added = [];
  const removed = [];
  for (const [filePath, current] of currentByPath) {
    const trusted = trustedByPath.get(filePath);
    if (!trusted) {
      added.push(filePath);
    } else if (trusted.sha256 !== current.sha256 || trusted.size !== current.size) {
      changed.push(filePath);
    }
  }
  for (const filePath of trustedByPath.keys()) {
    if (!currentByPath.has(filePath)) {
      removed.push(filePath);
    }
  }
  const content = {
    changed: changed.sort((a, b) => a.localeCompare(b)),
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b))
  };
  const clean = content.changed.length === 0 && content.added.length === 0 && content.removed.length === 0;
  return {
    ok: clean,
    exists: true,
    path: importPath,
    status: clean ? "clean" : "changed",
    source,
    content,
    diagnostics: clean ? [] : [{
      code: "topogram_extract_source_changed",
      severity: "error",
      message: "Extracted source files changed since they were trusted for this extraction.",
      path: sourceRoot,
      suggestedFix: "Review the source changes. If they should drive Topogram changes, rerun extract or update the Topogram artifacts manually."
    }],
    errors: clean ? [] : ["Extracted source files changed since extraction."]
  };
}
