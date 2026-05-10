// @ts-check

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  IGNORED_IMPLEMENTATION_ENTRIES,
  MAX_TEXT_DIFF_BYTES,
  normalizeRelativePath,
  normalizeRoot,
  unsupportedImplementationSymlinkMessage
} from "./constants.js";

/**
 * @param {string} value
 * @returns {string}
 */
function escapeDiffPath(value) {
  return value.replace(/\t/g, "\\t").replace(/\n/g, "\\n");
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
    `--- a/implementation/${escapeDiffPath(relativePath)}`,
    `+++ b/implementation/${escapeDiffPath(relativePath)}`,
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`
  ];
  for (const change of changes) {
    const prefix = change.type === "added" ? "+" : change.type === "removed" ? "-" : " ";
    lines.push(`${prefix}${change.text}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} filePath
 * @returns {{ text: string|null, binary: boolean, omitted: boolean }}
 */
function readReviewText(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > MAX_TEXT_DIFF_BYTES) {
    return { text: null, binary: false, omitted: true };
  }
  if (!isLikelyText(bytes)) {
    return { text: null, binary: true, omitted: false };
  }
  return { text: bytes.toString("utf8"), binary: false, omitted: false };
}

/**
 * @param {string} implementationRoot
 * @param {string} currentDir
 * @param {string[]} files
 * @returns {void}
 */
function collectImplementationFiles(implementationRoot, currentDir, files) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (IGNORED_IMPLEMENTATION_ENTRIES.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = normalizeRelativePath(path.relative(implementationRoot, entryPath));
    if (entry.isSymbolicLink()) {
      throw new Error(unsupportedImplementationSymlinkMessage(relativePath));
    }
    if (entry.isDirectory()) {
      collectImplementationFiles(implementationRoot, entryPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(relativePath);
    }
  }
}

/**
 * @param {string} configDir
 * @returns {{ algorithm: "sha256", root: string, digest: string, files: Array<{ path: string, sha256: string, size: number }> }}
 */
export function hashImplementationContent(configDir) {
  const implementationRoot = path.join(configDir, "implementation");
  if (!fs.existsSync(implementationRoot) || !fs.statSync(implementationRoot).isDirectory()) {
    throw new Error(`Cannot trust template implementation because ${normalizeRoot(implementationRoot)} does not exist.`);
  }
  /** @type {string[]} */
  const relativePaths = [];
  collectImplementationFiles(implementationRoot, implementationRoot, relativePaths);
  relativePaths.sort((a, b) => a.localeCompare(b));
  const files = relativePaths.map((relativePath) => {
    const filePath = path.join(implementationRoot, relativePath);
    const bytes = fs.readFileSync(filePath);
    return {
      path: relativePath,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length
    };
  });
  const aggregate = crypto.createHash("sha256");
  for (const file of files) {
    aggregate.update(file.path);
    aggregate.update("\0");
    aggregate.update(file.sha256);
    aggregate.update("\0");
    aggregate.update(String(file.size));
    aggregate.update("\0");
  }
  return {
    algorithm: "sha256",
    root: "implementation",
    digest: aggregate.digest("hex"),
    files
  };
}

/**
 * @param {Map<string, { path: string, sha256: string, size: number }>} trustedByPath
 * @param {Map<string, { path: string, sha256: string, size: number }>} currentByPath
 * @returns {{ added: string[], removed: string[], changed: string[] }}
 */
export function diffContentFiles(trustedByPath, currentByPath) {
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  /** @type {string[]} */
  const changed = [];
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
  return {
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b)),
    changed: changed.sort((a, b) => a.localeCompare(b))
  };
}

/**
 * @param {string} configDir
 * @param {string} relativePath
 * @param {{ path: string, sha256: string, size: number }|null} file
 * @returns {{ path: string, sha256: string|null, size: number|null, binary: boolean, diffOmitted: boolean, text: string|null }}
 */
export function implementationReviewFile(configDir, relativePath, file) {
  if (!file) {
    return { path: relativePath, sha256: null, size: null, binary: false, diffOmitted: false, text: null };
  }
  const reviewText = readReviewText(path.join(configDir, "implementation", relativePath));
  return {
    path: relativePath,
    sha256: file.sha256,
    size: file.size,
    binary: reviewText.binary,
    diffOmitted: reviewText.omitted,
    text: reviewText.text
  };
}
