// @ts-check

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import { MAX_TEXT_DIFF_BYTES, TEMPLATE_FILES_MANIFEST } from "./constants.js";
import { stableJsonStringify } from "./json.js";
import { candidateProjectTemplateMetadata } from "./metadata.js";
import { DEFAULT_TOPO_FOLDER_NAME, resolvePackageWorkspace } from "../workspace-paths.js";

/** @typedef {import("./types.js").CreateNewProjectOptions} CreateNewProjectOptions */
/** @typedef {import("./types.js").TemplateUpdatePlanOptions} TemplateUpdatePlanOptions */
/** @typedef {import("./types.js").TemplateUpdateFileActionOptions} TemplateUpdateFileActionOptions */
/** @typedef {import("./types.js").TemplateOwnedFileRecord} TemplateOwnedFileRecord */
/** @typedef {import("./types.js").TemplateManifest} TemplateManifest */
/** @typedef {import("./types.js").TemplateTopologySummary} TemplateTopologySummary */
/** @typedef {import("./types.js").TemplatePolicy} TemplatePolicy */
/** @typedef {import("./types.js").TemplatePolicyInfo} TemplatePolicyInfo */
/** @typedef {import("./types.js").TemplateUpdateDiagnostic} TemplateUpdateDiagnostic */
/** @typedef {import("./types.js").ResolvedTemplate} ResolvedTemplate */
/** @typedef {import("./types.js").CatalogTemplateProvenance} CatalogTemplateProvenance */

/**
 * @param {string} filePath
 * @returns {string}
 */
export function normalizeTemplateUpdateActionPath(filePath) {
  const normalized = path.posix.normalize(filePath.replace(/\\/g, "/"));
  if (
    !filePath ||
    path.isAbsolute(filePath) ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".."
  ) {
    throw new Error(`Template update action requires a relative template-owned file path: ${filePath || "(missing)"}`);
  }
  return normalized;
}

/**
 * @param {any} bytes
 * @returns {boolean}
 */
function isLikelyText(bytes) {
  if (bytes.includes(0)) {
    return false;
  }
  const length = Math.min(bytes.length, 4096);
  let suspicious = 0;
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index];
    if (byte === 9 || byte === 10 || byte === 13) {
      continue;
    }
    if (byte < 32 || byte === 127) {
      suspicious += 1;
    }
  }
  return length === 0 || suspicious / length < 0.02;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function linesForDiff(text) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

/**
 * @param {string[]} before
 * @param {string[]} after
 * @returns {Array<{ type: "same"|"added"|"removed", text: string }>}
 */
function diffLines(before, after) {
  const rows = before.length;
  const columns = after.length;
  /** @type {number[][]} */
  const table = Array.from({ length: rows + 1 }, () => Array(columns + 1).fill(0));
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] = before[row] === after[column]
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  /** @type {Array<{ type: "same"|"added"|"removed", text: string }>} */
  const changes = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (before[row] === after[column]) {
      changes.push({ type: "same", text: before[row] });
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      changes.push({ type: "removed", text: before[row] });
      row += 1;
    } else {
      changes.push({ type: "added", text: after[column] });
      column += 1;
    }
  }
  while (row < rows) {
    changes.push({ type: "removed", text: before[row] });
    row += 1;
  }
  while (column < columns) {
    changes.push({ type: "added", text: after[column] });
    column += 1;
  }
  return changes;
}

/**
 * @param {string} relativePath
 * @param {string|null} beforeText
 * @param {string|null} afterText
 * @returns {string|null}
 */
export function unifiedTextDiff(relativePath, beforeText, afterText) {
  if (beforeText === null && afterText === null) {
    return null;
  }
  const beforeLines = beforeText === null ? [] : linesForDiff(beforeText);
  const afterLines = afterText === null ? [] : linesForDiff(afterText);
  const changes = diffLines(beforeLines, afterLines);
  const lines = [
    `--- current/${relativePath}`,
    `+++ candidate/${relativePath}`,
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`
  ];
  for (const change of changes) {
    const prefix = change.type === "added" ? "+" : change.type === "removed" ? "-" : " ";
    lines.push(`${prefix}${change.text}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} value
 * @returns {number}
 */
function utf8ByteLength(value) {
  let length = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) || 0;
    if (codePoint <= 0x7f) {
      length += 1;
    } else if (codePoint <= 0x7ff) {
      length += 2;
    } else if (codePoint <= 0xffff) {
      length += 3;
    } else {
      length += 4;
    }
  }
  return length;
}

/**
 * @param {string} root
 * @param {string} currentDir
 * @param {string[]} files
 * @returns {void}
 */
function collectFiles(root, currentDir, files) {
  if (!fs.existsSync(currentDir)) {
    return;
  }
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.name === "node_modules" || entry.name === ".tmp") {
      continue;
    }
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Template-owned files cannot include symlink '${path.relative(root, entryPath).replace(/\\/g, "/")}'. Template-owned files must be real files so Topogram can hash the exact content being trusted. Replace the symlink with a real file, then run topogram trust status, topogram trust diff, and topogram trust template after review.`);
    }
    if (entry.isDirectory()) {
      collectFiles(root, entryPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(path.relative(root, entryPath).replace(/\\/g, "/"));
    }
  }
}

/**
 * @param {string|null} absolutePath
 * @param {string|null} content
 * @returns {{ sha256: string, size: number, text: string|null, binary: boolean, diffOmitted: boolean }|null}
 */
export function fileSnapshot(absolutePath, content = null) {
  if (!absolutePath && content === null) {
    return null;
  }
  if (content !== null) {
    return {
      sha256: crypto.createHash("sha256").update(content, "utf8").digest("hex"),
      size: utf8ByteLength(content),
      text: content,
      binary: false,
      diffOmitted: false
    };
  }
  const bytes = fs.readFileSync(absolutePath || "");
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (bytes.length > MAX_TEXT_DIFF_BYTES) {
    return { sha256, size: bytes.length, text: null, binary: false, diffOmitted: true };
  }
  if (!isLikelyText(bytes)) {
    return { sha256, size: bytes.length, text: null, binary: true, diffOmitted: false };
  }
  return { sha256, size: bytes.length, text: bytes.toString("utf8"), binary: false, diffOmitted: false };
}

/**
 * @param {{ absolutePath: string|null, content: string|null }} file
 * @returns {{ sha256: string, size: number }}
 */
export function fileHash(file) {
  const snapshot = fileSnapshot(file.absolutePath, file.content);
  if (!snapshot) {
    throw new Error("Cannot hash missing template-owned file.");
  }
  return {
    sha256: snapshot.sha256,
    size: snapshot.size
  };
}

/**
 * @param {string} relativePath
 * @param {{ absolutePath: string|null, content: string|null }} file
 * @returns {{ sha256: string, size: number }}
 */
function templateOwnedFileHash(relativePath, file) {
  if (relativePath !== "topogram.project.json" || file.content !== null) {
    return fileHash(file);
  }
  if (!file.absolutePath) {
    return fileHash(file);
  }
  return fileHash({
    absolutePath: null,
    content: `${stableJsonStringify(JSON.parse(fs.readFileSync(file.absolutePath, "utf8")))}\n`
  });
}

/**
 * @param {ResolvedTemplate} template
 * @param {Record<string, any>|null} [currentProjectConfig]
 * @returns {Map<string, { path: string, content: string|null, absolutePath: string|null }>}
 */
export function candidateTemplateFiles(template, currentProjectConfig = null) {
  const files = new Map();
  const templateWorkspace = resolvePackageWorkspace(template.root);
  /** @type {string[]} */
  const workspaceFiles = [];
  collectFiles(template.root, templateWorkspace.root, workspaceFiles);
  for (const sourceRelativePath of workspaceFiles) {
    const workspaceRelative = path.relative(templateWorkspace.root, path.join(template.root, sourceRelativePath)).replace(/\\/g, "/");
    const targetRelativePath = path.posix.join(DEFAULT_TOPO_FOLDER_NAME, workspaceRelative);
    files.set(targetRelativePath, {
      path: targetRelativePath,
      content: null,
      absolutePath: path.join(template.root, sourceRelativePath)
    });
  }
  const implementationRoot = path.join(template.root, "implementation");
  if (fs.existsSync(implementationRoot)) {
    /** @type {string[]} */
    const relativeFiles = [];
    collectFiles(template.root, implementationRoot, relativeFiles);
    for (const relativePath of relativeFiles) {
      files.set(relativePath, {
        path: relativePath,
        content: null,
        absolutePath: path.join(template.root, relativePath)
      });
    }
  }
  const candidateProjectConfig = JSON.parse(fs.readFileSync(path.join(template.root, "topogram.project.json"), "utf8"));
  candidateProjectConfig.workspace = `./${DEFAULT_TOPO_FOLDER_NAME}`;
  candidateProjectConfig.template = candidateProjectTemplateMetadata(template, currentProjectConfig);
  files.set("topogram.project.json", {
    path: "topogram.project.json",
    content: `${stableJsonStringify(candidateProjectConfig)}\n`,
    absolutePath: null
  });
  return files;
}

/**
 * @param {string} projectRoot
 * @param {boolean} includeImplementation
 * @param {Record<string, any>} projectConfig
 * @returns {Map<string, { path: string, absolutePath: string|null, content: string|null }>}
 */
export function currentTemplateOwnedFiles(projectRoot, includeImplementation, projectConfig) {
  const files = new Map();
  for (const rootName of includeImplementation ? [DEFAULT_TOPO_FOLDER_NAME, "implementation"] : [DEFAULT_TOPO_FOLDER_NAME]) {
    const root = path.join(projectRoot, rootName);
    if (!fs.existsSync(root)) {
      continue;
    }
    /** @type {string[]} */
    const relativeFiles = [];
    collectFiles(projectRoot, root, relativeFiles);
    for (const relativePath of relativeFiles) {
      files.set(relativePath, {
        path: relativePath,
        absolutePath: path.join(projectRoot, relativePath),
        content: null
      });
    }
  }
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  if (fs.existsSync(projectConfigPath)) {
    files.set("topogram.project.json", {
      path: "topogram.project.json",
      absolutePath: projectConfigPath,
      content: null
    });
  }
  return files;
}

/**
 * @param {Record<string, any>} projectConfig
 * @returns {boolean}
 */
export function includesTemplateImplementation(projectConfig) {
  const template = projectConfig.template || {};
  return Boolean(
    projectConfig.implementation ||
    template.includesExecutableImplementation
  );
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} projectConfig
 * @returns {Map<string, TemplateOwnedFileRecord>}
 */
export function currentTemplateOwnedFileHashes(projectRoot, projectConfig) {
  const files = currentTemplateOwnedFiles(projectRoot, includesTemplateImplementation(projectConfig), projectConfig);
  return new Map([...files.entries()].map(([relativePath, file]) => {
    const hash = templateOwnedFileHash(relativePath, file);
    return [relativePath, { path: relativePath, ...hash }];
  }));
}

/**
 * @param {string} projectRoot
 * @returns {{ version: string, template: Record<string, any>, files: TemplateOwnedFileRecord[] }|null}
 */
export function readTemplateFilesManifest(projectRoot) {
  const manifestPath = path.join(projectRoot, TEMPLATE_FILES_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} projectConfig
 * @returns {{ version: string, template: Record<string, any>, files: TemplateOwnedFileRecord[] }}
 */
export function writeTemplateFilesManifest(projectRoot, projectConfig) {
  const fileRecords = [...currentTemplateOwnedFileHashes(projectRoot, projectConfig).values()]
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    version: "0.1",
    template: {
      id: projectConfig.template?.id || null,
      version: projectConfig.template?.version || null,
      source: projectConfig.template?.source || null,
      sourceSpec: projectConfig.template?.sourceSpec || null,
      requested: projectConfig.template?.requested || null,
      catalog: projectConfig.template?.catalog || null
    },
    files: fileRecords
  };
  fs.writeFileSync(path.join(projectRoot, TEMPLATE_FILES_MANIFEST), `${stableJsonStringify(manifest)}\n`, "utf8");
  return manifest;
}

/**
 * @param {string} projectRoot
 * @param {{ version: string, template: Record<string, any>, files: TemplateOwnedFileRecord[] }} manifest
 * @returns {void}
 */
export function writeTemplateFilesManifestData(projectRoot, manifest) {
  const sortedManifest = {
    ...manifest,
    files: [...manifest.files].sort((left, right) => left.path.localeCompare(right.path))
  };
  fs.writeFileSync(path.join(projectRoot, TEMPLATE_FILES_MANIFEST), `${stableJsonStringify(sortedManifest)}\n`, "utf8");
}

/**
 * @param {string} projectRoot
 * @param {{ version: string, template: Record<string, any>, files: TemplateOwnedFileRecord[] }} manifest
 * @param {string} relativePath
 * @param {TemplateOwnedFileRecord|null} record
 * @returns {void}
 */
export function updateTemplateFilesManifestRecord(projectRoot, manifest, relativePath, record) {
  const byPath = new Map(manifest.files.map((file) => [file.path, file]));
  if (record) {
    byPath.set(relativePath, record);
  } else {
    byPath.delete(relativePath);
  }
  writeTemplateFilesManifestData(projectRoot, {
    ...manifest,
    files: [...byPath.values()]
  });
}

/**
 * @param {{ absolutePath: string|null, content: string|null }} candidateFile
 * @param {string} destinationPath
 * @returns {void}
 */
export function writeCandidateFile(candidateFile, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  if (candidateFile.content !== null) {
    fs.writeFileSync(destinationPath, candidateFile.content, "utf8");
    return;
  }
  if (!candidateFile.absolutePath) {
    throw new Error(`Cannot apply template file without content or source path: ${destinationPath}`);
  }
  fs.cpSync(candidateFile.absolutePath, destinationPath);
}

/**
 * @param {TemplateOwnedFileRecord|null} baseline
 * @param {{ sha256: string, size: number }|null} currentHash
 * @returns {boolean}
 */
export function fileMatchesBaseline(baseline, currentHash) {
  if (!baseline && !currentHash) {
    return true;
  }
  if (!baseline || !currentHash) {
    return false;
  }
  return baseline.sha256 === currentHash.sha256 && baseline.size === currentHash.size;
}
