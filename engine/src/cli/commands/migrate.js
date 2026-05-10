// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import {
  DEFAULT_TOPO_FOLDER_NAME,
  DEFAULT_WORKSPACE_PATH,
  LEGACY_TOPOGRAM_FOLDER_NAME,
  PROJECT_CONFIG_FILE
} from "../../workspace-paths.js";

/**
 * @param {string|null|undefined} inputPath
 * @returns {string}
 */
function projectRootForMigration(inputPath) {
  const absolute = path.resolve(inputPath || ".");
  const base = path.basename(absolute);
  if (base === DEFAULT_TOPO_FOLDER_NAME || base === LEGACY_TOPOGRAM_FOLDER_NAME) {
    return path.dirname(absolute);
  }
  return absolute;
}

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
function caseCollisionEntries(projectRoot) {
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    return [];
  }
  return fs.readdirSync(projectRoot)
    .filter((/** @type {string} */ entry) => entry.toLowerCase() === DEFAULT_TOPO_FOLDER_NAME && entry !== DEFAULT_TOPO_FOLDER_NAME);
}

/**
 * @param {string} projectRoot
 * @returns {{ write: boolean, path: string|null, before: any|null, after: any|null }}
 */
function plannedProjectConfigUpdate(projectRoot) {
  const configPath = path.join(projectRoot, PROJECT_CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return { write: false, path: null, before: null, after: null };
  }
  const before = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const after = { ...before };
  const currentWorkspace = before.workspace;
  if (currentWorkspace == null || currentWorkspace === "./topogram" || currentWorkspace === "topogram") {
    after.workspace = DEFAULT_WORKSPACE_PATH;
  }
  return {
    write: JSON.stringify(before) !== JSON.stringify(after),
    path: configPath,
    before,
    after
  };
}

/**
 * @param {string|null|undefined} inputPath
 * @param {{ write?: boolean, json?: boolean }} [options]
 * @returns {number}
 */
export function runMigrateCommand(inputPath, options = {}) {
  const projectRoot = projectRootForMigration(inputPath);
  const legacyPath = path.join(projectRoot, LEGACY_TOPOGRAM_FOLDER_NAME);
  const topoPath = path.join(projectRoot, DEFAULT_TOPO_FOLDER_NAME);
  const write = Boolean(options.write);
  /** @type {Array<Record<string, any>>} */
  const diagnostics = [];
  /** @type {Array<Record<string, any>>} */
  const actions = [];

  if (fs.existsSync(legacyPath) && fs.lstatSync(legacyPath).isSymbolicLink()) {
    diagnostics.push({ severity: "error", message: `Refusing to migrate symlinked ${LEGACY_TOPOGRAM_FOLDER_NAME}/ at ${legacyPath}.` });
  }
  const collisions = caseCollisionEntries(projectRoot);
  if (collisions.length > 0) {
    diagnostics.push({ severity: "error", message: `Refusing to migrate because case-conflicting topo path(s) exist: ${collisions.join(", ")}.` });
  }
  if (fs.existsSync(legacyPath) && fs.existsSync(topoPath)) {
    diagnostics.push({ severity: "error", message: `Refusing to migrate because both ${LEGACY_TOPOGRAM_FOLDER_NAME}/ and ${DEFAULT_TOPO_FOLDER_NAME}/ exist.` });
  }
  if (!fs.existsSync(legacyPath) && !fs.existsSync(topoPath)) {
    diagnostics.push({ severity: "error", message: `No ${LEGACY_TOPOGRAM_FOLDER_NAME}/ or ${DEFAULT_TOPO_FOLDER_NAME}/ workspace folder found at ${projectRoot}.` });
  }
  if (fs.existsSync(topoPath) && fs.statSync(topoPath).isDirectory() && fs.readdirSync(topoPath).length > 0 && fs.existsSync(legacyPath)) {
    diagnostics.push({ severity: "error", message: `Refusing to overwrite non-empty ${DEFAULT_TOPO_FOLDER_NAME}/ at ${topoPath}.` });
  }

  if (fs.existsSync(legacyPath) && diagnostics.length === 0) {
    actions.push({
      kind: "rename",
      from: legacyPath,
      to: topoPath
    });
  }
  const configUpdate = plannedProjectConfigUpdate(projectRoot);
  if (configUpdate.write) {
    actions.push({
      kind: "update_config",
      path: configUpdate.path,
      workspace: DEFAULT_WORKSPACE_PATH
    });
  }

  const ok = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length === 0;
  if (ok && write) {
    for (const action of actions) {
      if (action.kind === "rename") {
        fs.renameSync(action.from, action.to);
      }
      if (action.kind === "update_config" && configUpdate.path && configUpdate.after) {
        fs.writeFileSync(configUpdate.path, `${JSON.stringify(configUpdate.after, null, 2)}\n`, "utf8");
      }
    }
  }

  const payload = {
    ok,
    dryRun: !write,
    projectRoot,
    legacyPath,
    topoPath,
    actions,
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message)
  };
  if (options.json) {
    console.log(stableStringify(payload));
  } else if (payload.ok) {
    console.log(write ? "Workspace folder migration complete." : "Workspace folder migration dry run.");
    if (actions.length === 0) {
      console.log("No changes needed.");
    }
    for (const action of actions) {
      if (action.kind === "rename") {
        console.log(`Rename: ${action.from} -> ${action.to}`);
      }
      if (action.kind === "update_config") {
        console.log(`Update ${action.path}: workspace ${DEFAULT_WORKSPACE_PATH}`);
      }
    }
  } else {
    for (const error of payload.errors) {
      console.error(error);
    }
  }
  return payload.ok ? 0 : 1;
}
