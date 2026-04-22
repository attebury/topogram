import fs from "node:fs";
import path from "node:path";

import { readJsonIfExists, readTextIfExists } from "./shared.js";

export function findNearestGitRoot(startDir) {
  let currentDir = path.resolve(startDir);
  while (true) {
    const gitPath = path.join(currentDir, ".git");
    if (fs.existsSync(gitPath)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.resolve(startDir);
    }
    currentDir = parentDir;
  }
}

export function normalizeWorkspacePaths(inputPath) {
  const absolute = path.resolve(inputPath);
  const inputExists = fs.existsSync(absolute);
  const topogramChild = path.join(absolute, "topogram");
  const hasTopogramChild = fs.existsSync(topogramChild) && fs.statSync(topogramChild).isDirectory();
  const isTopogramDir = path.basename(absolute) === "topogram" && inputExists;
  const topogramRoot = isTopogramDir ? absolute : hasTopogramChild ? topogramChild : path.join(absolute, "topogram");
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

export function createImportContext(inputPath, options = {}) {
  const paths = normalizeWorkspacePaths(inputPath);
  return {
    paths,
    options,
    helpers: {
      fs,
      path,
      readTextIfExists,
      readJsonIfExists
    }
  };
}
