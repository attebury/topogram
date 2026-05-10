import fs from "node:fs";
import path from "node:path";

import { relativeTo } from "../../../path-helpers.js";

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

/**
 * @param {string} filePath
 * @returns {any}
 */
export function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

/**
 * @param {string} filePath
 * @returns {any}
 */
export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * @param {string} rootDir
 * @param {(filePath: any) => boolean} predicate
 * @param {any} options
 * @returns {any[]}
 */
export function listFilesRecursive(rootDir, predicate = () => true, options = {}) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const ignoredDirs = options.ignoredDirs || DEFAULT_IGNORED_DIRS;
  const files = /** @type {any[]} */ ([]);
  const walk = /** @param {any} currentDir */ (currentDir) => {
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

/**
 * @param {import("./types.d.ts").ImportPaths} paths
 * @returns {any}
 */
export function importSearchRoots(paths) {
  return [...new Set([paths.workspaceRoot, paths.topogramRoot].filter(Boolean))];
}

/**
 * @param {import("./types.d.ts").ImportPaths} paths
 * @param {string} filePath
 * @returns {any}
 */
export function normalizeImportRelativePath(paths, filePath) {
  return relativeTo(paths.repoRoot, filePath);
}

/**
 * @param {import("./types.d.ts").ImportPaths} paths
 * @param {string} filePath
 * @param {any} kind
 * @returns {any}
 */
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

/**
 * @param {import("./types.d.ts").ImportPaths} paths
 * @param {any} files
 * @param {any} kind
 * @returns {any}
 */
export function selectPreferredImportFiles(paths, files, kind) {
  if (files.length === 0) {
    return [];
  }
  const rankedFiles = files.map(/** @param {string} filePath */ (filePath) => ({
    filePath,
    rank: canonicalSourceRank(paths, filePath, kind)
  }));
  const bestRank = Math.min(...rankedFiles.map(/** @param {any} entry */ (entry) => entry.rank));
  return rankedFiles
    .filter(/** @param {any} entry */ (entry) => entry.rank === bestRank)
    .map(/** @param {any} entry */ (entry) => entry.filePath)
    .sort();
}

/**
 * @param {import("./types.d.ts").ImportPaths} paths
 * @param {any} predicate
 * @returns {any}
 */
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
