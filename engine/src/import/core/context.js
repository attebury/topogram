import fs from "node:fs";
import path from "node:path";

import { readJsonIfExists, readTextIfExists } from "./shared.js";
import { resolveWorkspaceContext } from "../../workspace-paths.js";

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
  const context = resolveWorkspaceContext(inputPath);
  const absolute = path.resolve(inputPath);
  const topogramRoot = context.topoRoot;
  const workspaceRoot = context.projectRoot;
  const repoRoot = findNearestGitRoot(workspaceRoot);
  return {
    inputRoot: absolute,
    topogramRoot,
    workspaceRoot,
    exampleRoot: workspaceRoot,
    repoRoot,
    bootstrappedTopogramRoot: context.bootstrappedTopoRoot
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
