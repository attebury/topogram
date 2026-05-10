// @ts-check

import fs from "node:fs";
import path from "node:path";

import { TOPOGRAM_SOURCE_FILE } from "./constants.js";
import { collectFiles, fileHash } from "./files.js";
import { DEFAULT_TOPO_FOLDER_NAME } from "../workspace-paths.js";

/**
 * @param {string} projectRoot
 * @param {{ catalogSource: string|null, entry: any, packageSpec: string, version: string }} input
 * @returns {{ path: string, record: Record<string, any> }}
 */
export function writeTopogramSourceRecord(projectRoot, input) {
  const record = {
    version: "0.1",
    kind: "topogram",
    copiedAt: new Date().toISOString(),
    catalog: {
      id: input.entry.id,
      source: input.catalogSource
    },
    package: {
      name: input.entry.package,
      version: input.version,
      spec: input.packageSpec
    },
    trust: {
      includesExecutableImplementation: false
    },
    files: collectSourceFileRecords(projectRoot)
  };
  const sourcePath = path.join(projectRoot, TOPOGRAM_SOURCE_FILE);
  fs.writeFileSync(sourcePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { path: sourcePath, record };
}

/**
 * @param {string} projectRoot
 * @returns {{ ok: true, exists: boolean, path: string, status: "missing"|"clean"|"changed", source: Record<string, any>|null, content: { changed: string[], added: string[], removed: string[] }, diagnostics: any[], errors: [] }}
 */
export function buildTopogramSourceStatus(projectRoot) {
  const resolvedRoot = path.resolve(projectRoot);
  const sourcePath = path.join(resolvedRoot, TOPOGRAM_SOURCE_FILE);
  if (!fs.existsSync(sourcePath)) {
    return {
      ok: true,
      exists: false,
      path: sourcePath,
      status: "missing",
      source: null,
      content: { changed: [], added: [], removed: [] },
      diagnostics: [{
        code: "topogram_source_missing",
        severity: "warning",
        message: `${TOPOGRAM_SOURCE_FILE} was not found. This project may not have been copied from a catalog topogram entry.`,
        path: sourcePath,
        suggestedFix: "Run `topogram catalog copy <id> <target>` to create a project with source provenance."
      }],
      errors: []
    };
  }
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const trustedFiles = Array.isArray(source.files) ? source.files : [];
  const trustedByPath = new Map(trustedFiles.map((/** @type {any} */ file) => [String(file.path), file]));
  const currentByPath = new Map(collectSourceFileRecords(resolvedRoot).map((file) => [file.path, file]));
  /** @type {string[]} */
  const changed = [];
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
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
  return {
    ok: true,
    exists: true,
    path: sourcePath,
    status: content.changed.length || content.added.length || content.removed.length ? "changed" : "clean",
    source,
    content,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {string} projectRoot
 * @returns {Array<{ path: string, sha256: string, size: number }>}
 */
function collectSourceFileRecords(projectRoot) {
  /** @type {string[]} */
  const files = [];
  for (const sourceRoot of [DEFAULT_TOPO_FOLDER_NAME, "topogram.project.json", "README.md"]) {
    const sourcePath = path.join(projectRoot, sourceRoot);
    if (fs.existsSync(sourcePath)) {
      collectFiles(sourcePath, sourceRoot, files);
    }
  }
  return files
    .sort((a, b) => a.localeCompare(b))
    .map((relativePath) => ({
      path: relativePath,
      ...fileHash(path.join(projectRoot, relativePath))
    }));
}
