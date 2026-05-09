// @ts-check
import fs from "node:fs";
import path from "node:path";

import { ensureTrailingNewline, titleCase } from "../text-helpers.js";

/** @param {string} startDir @returns {any} */
export function findNearestGitRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

/** @param {string} inputPath @returns {any} */
export function normalizeWorkspacePaths(inputPath) {
  const absolute = path.resolve(inputPath);
  const inputExists = fs.existsSync(absolute);
  const hasTopogramChild = fs.existsSync(path.join(absolute, "topogram")) && fs.statSync(path.join(absolute, "topogram")).isDirectory();
  const isTopogramDir = path.basename(absolute) === "topogram" && inputExists;
  const bootstrapWorkspaceRoot = !isTopogramDir && !hasTopogramChild;
  const topogramRoot = isTopogramDir
    ? absolute
    : hasTopogramChild
      ? path.join(absolute, "topogram")
      : path.join(absolute, "topogram");
  const workspaceRoot = isTopogramDir ? path.dirname(topogramRoot) : absolute;
  const repoRoot = findNearestGitRoot(workspaceRoot);
  return {
    inputRoot: absolute,
    topogramRoot,
    workspaceRoot,
    exampleRoot: workspaceRoot,
    repoRoot,
    bootstrappedTopogramRoot: !fs.existsSync(topogramRoot)
  };
}

/** @param {string} markdown @returns {any} */
export function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/** @param {string} filePath @param {string} markdown @returns {any} */
export function markdownTitle(filePath, markdown) {
  return firstHeading(markdown) || titleCase(path.basename(filePath, path.extname(filePath)));
}

/** @param {string} filePath @returns {any} */
export function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

/** @param {string} filePath @returns {any} */
export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".yarn",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "tmp"
]);

/** @param {string} rootDir @param {any} predicate @param {WorkflowOptions} options @returns {any} */
export function listFilesRecursive(rootDir, predicate = () => true, options = {}) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const ignoredDirs = options.ignoredDirs || DEFAULT_IGNORED_DIRS;
  /** @type {any[]} */
  const files = [];
  const walk = (/** @type {any} */ currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const childPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }
        walk(childPath);
        continue;
      }
      if (entry.isFile() && predicate(childPath)) {
        files.push(childPath);
      }
    }
  };
  walk(rootDir);
  return files.sort();
}

/** @param {WorkflowRecord} metadata @returns {any} */
export function buildFrontmatter(metadata) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(metadata)) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
      continue;
    }
    if (typeof value === "boolean") {
      lines.push(`${key}: ${value ? "true" : "false"}`);
      continue;
    }
    lines.push(`${key}: ${String(value).includes(":") ? JSON.stringify(value) : value}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/** @param {WorkflowRecord} metadata @param {string} body @returns {any} */
export function renderMarkdownDoc(metadata, body) {
  return ensureTrailingNewline(`${buildFrontmatter(metadata)}\n\n${body.trim()}\n`);
}

/** @param {string} source @returns {any} */
export function parseMarkdownFrontmatter(source) {
  const normalized = String(source || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") {
    return null;
  }
  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      closingIndex = index;
      break;
    }
  }
  if (closingIndex === -1) {
    return null;
  }
  /** @type {WorkflowRecord} */
  const metadata = {};
  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (rawValue.trim() === "") {
      /** @type {any[]} */
      const items = [];
      let cursor = index + 1;
      while (cursor < closingIndex) {
        const itemMatch = lines[cursor].match(/^\s*-\s*(.*)$/);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1]);
        cursor += 1;
      }
      metadata[key] = items;
      index = cursor - 1;
      continue;
    }
    metadata[key] = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;
  }
  return {
    metadata,
    body: lines.slice(closingIndex + 1).join("\n").replace(/^\n+/, "")
  };
}
