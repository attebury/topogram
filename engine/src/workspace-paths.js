// @ts-check

import fs from "node:fs";
import path from "node:path";

export const DEFAULT_TOPO_FOLDER_NAME = "topo";
export const LEGACY_TOPOGRAM_FOLDER_NAME = "topogram";
export const DEFAULT_WORKSPACE_PATH = `./${DEFAULT_TOPO_FOLDER_NAME}`;
export const PROJECT_CONFIG_FILE = "topogram.project.json";

const SIGNAL_SCAN_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".tmp",
  ".turbo",
  ".yarn",
  "app",
  "build",
  "coverage",
  "dist",
  "expected",
  "node_modules",
  "tmp"
]);
const WORKSPACE_SIGNAL_DIRS = new Set([
  "_archive",
  "acceptance_criteria",
  "actors",
  "bugs",
  "capabilities",
  "decisions",
  "domains",
  "entities",
  "enums",
  "operations",
  "pitches",
  "projections",
  "requirements",
  "rules",
  "shapes",
  "tasks",
  "terms",
  "verifications",
  "widgets",
  "workflows"
]);

/**
 * @typedef {Object} WorkspaceResolution
 * @property {string} inputRoot
 * @property {string} topoRoot
 * @property {string} projectRoot
 * @property {string|null} configPath
 * @property {boolean} fromConfig
 * @property {boolean} fromSignal
 * @property {boolean} bootstrappedTopoRoot
 */

/**
 * @param {string} candidatePath
 * @returns {boolean}
 */
function isDirectory(candidatePath) {
  try {
    return fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {string} filePath
 * @returns {any}
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * @param {string} startPath
 * @returns {string}
 */
function searchStartDirectory(startPath) {
  const absolute = path.resolve(startPath || ".");
  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
    return path.dirname(absolute);
  }
  if (!fs.existsSync(absolute) && path.basename(absolute) === DEFAULT_TOPO_FOLDER_NAME) {
    return path.dirname(absolute);
  }
  return absolute;
}

/**
 * @param {string} startPath
 * @returns {{ config: any, configPath: string, configDir: string }|null}
 */
export function findProjectRoot(startPath) {
  let current = searchStartDirectory(startPath);
  while (current && current !== path.dirname(current)) {
    const candidate = path.join(current, PROJECT_CONFIG_FILE);
    if (fs.existsSync(candidate)) {
      return {
        config: readJson(candidate),
        configPath: candidate,
        configDir: current
      };
    }
    current = path.dirname(current);
  }
  return null;
}

/**
 * @param {string} workspacePath
 * @returns {string}
 */
export function normalizeWorkspaceConfigPath(workspacePath) {
  const value = String(workspacePath || "").trim();
  if (!value) {
    throw new Error("topogram.project.json workspace must be a non-empty relative path.");
  }
  if (path.isAbsolute(value)) {
    throw new Error("topogram.project.json workspace must be relative to the project root.");
  }
  const normalized = value.replace(/\\/g, "/");
  const resolved = path.posix.normalize(normalized);
  if (resolved === ".." || resolved.startsWith("../")) {
    throw new Error("topogram.project.json workspace must not escape the project root.");
  }
  return normalized;
}

/**
 * @param {any} config
 * @param {string} configDir
 * @returns {string}
 */
export function resolveProjectWorkspace(config, configDir) {
  if (config && Object.prototype.hasOwnProperty.call(config, "workspaces")) {
    throw new Error("topogram.project.json workspaces[] is not supported yet; use single workspace instead.");
  }
  const configured = config?.workspace == null ? DEFAULT_WORKSPACE_PATH : config.workspace;
  const normalized = normalizeWorkspaceConfigPath(configured);
  return path.resolve(configDir, normalized);
}

/**
 * @param {string} root
 * @param {number} [maxDepth]
 * @returns {boolean}
 */
export function workspaceHasTgFiles(root, maxDepth = 3) {
  if (!isDirectory(root)) {
    return false;
  }
  const walk = (/** @type {string} */ current, /** @type {number} */ depth) => {
    if (depth > maxDepth) {
      return false;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (SIGNAL_SCAN_IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const child = path.join(current, entry.name);
      if (entry.isFile() && entry.name.endsWith(".tg")) {
        return true;
      }
      if (entry.isDirectory() && walk(child, depth + 1)) {
        return true;
      }
    }
    return false;
  };
  return walk(root, 0);
}

/**
 * @param {string} root
 * @returns {boolean}
 */
function isWorkspaceSignalRoot(root) {
  if (!isDirectory(root)) {
    return false;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".tg")) {
      return true;
    }
    if (entry.isDirectory() && WORKSPACE_SIGNAL_DIRS.has(entry.name) && workspaceHasTgFiles(path.join(root, entry.name), 2)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function signalWorkspaceCandidates(root) {
  if (!isDirectory(root)) {
    return [];
  }
  /** @type {string[]} */
  const candidates = [];
  if (isWorkspaceSignalRoot(root)) {
    candidates.push(root);
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || SIGNAL_SCAN_IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const child = path.join(root, entry.name);
    if (isWorkspaceSignalRoot(child)) {
      candidates.push(child);
    }
  }
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))].sort();
}

/**
 * @param {string} inputPath
 * @returns {WorkspaceResolution}
 */
export function resolveWorkspaceContext(inputPath = ".") {
  const absolute = path.resolve(inputPath || ".");
  if (
    isDirectory(absolute) &&
    (
      path.basename(absolute) === DEFAULT_TOPO_FOLDER_NAME ||
      (isWorkspaceSignalRoot(absolute) && !isDirectory(path.join(absolute, DEFAULT_TOPO_FOLDER_NAME)))
    )
  ) {
    return {
      inputRoot: absolute,
      topoRoot: absolute,
      projectRoot: path.basename(absolute) === DEFAULT_TOPO_FOLDER_NAME ? path.dirname(absolute) : absolute,
      configPath: null,
      fromConfig: false,
      fromSignal: false,
      bootstrappedTopoRoot: false
    };
  }

  const configInfo = findProjectRoot(absolute);
  if (configInfo) {
    const topoRoot = resolveProjectWorkspace(configInfo.config, configInfo.configDir);
    return {
      inputRoot: absolute,
      topoRoot,
      projectRoot: configInfo.configDir,
      configPath: configInfo.configPath,
      fromConfig: true,
      fromSignal: false,
      bootstrappedTopoRoot: !fs.existsSync(topoRoot)
    };
  }

  const searchBase = !fs.existsSync(absolute) && path.basename(absolute) === DEFAULT_TOPO_FOLDER_NAME
    ? path.dirname(absolute)
    : absolute;
  const defaultCandidate = path.join(searchBase, DEFAULT_TOPO_FOLDER_NAME);
  if (isDirectory(defaultCandidate)) {
    return {
      inputRoot: absolute,
      topoRoot: defaultCandidate,
      projectRoot: searchBase,
      configPath: null,
      fromConfig: false,
      fromSignal: false,
      bootstrappedTopoRoot: false
    };
  }

  const signalCandidates = signalWorkspaceCandidates(searchBase);
  if (signalCandidates.length === 1) {
    const topoRoot = signalCandidates[0];
    return {
      inputRoot: absolute,
      topoRoot,
      projectRoot: topoRoot,
      configPath: null,
      fromConfig: false,
      fromSignal: true,
      bootstrappedTopoRoot: false
    };
  }
  if (signalCandidates.length > 1) {
    throw new Error(
      `Multiple Topogram workspace candidates found. Pass one explicitly: ${signalCandidates.join(", ")}`
    );
  }

  return {
    inputRoot: absolute,
    topoRoot: defaultCandidate,
    projectRoot: searchBase,
    configPath: null,
    fromConfig: false,
    fromSignal: false,
    bootstrappedTopoRoot: true
  };
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function resolveTopoRoot(inputPath = ".") {
  return resolveWorkspaceContext(inputPath).topoRoot;
}

/**
 * @param {string} packageRoot
 * @returns {{ root: string, legacy: boolean }}
 */
export function resolvePackageWorkspace(packageRoot) {
  const topoRoot = path.join(packageRoot, DEFAULT_TOPO_FOLDER_NAME);
  if (isDirectory(topoRoot)) {
    return { root: topoRoot, legacy: false };
  }
  const legacyRoot = path.join(packageRoot, LEGACY_TOPOGRAM_FOLDER_NAME);
  if (isDirectory(legacyRoot)) {
    return { root: legacyRoot, legacy: true };
  }
  throw new Error(`Package is missing ${DEFAULT_TOPO_FOLDER_NAME}/.`);
}
