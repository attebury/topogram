// @ts-check

import childProcess from "node:child_process";
import path from "node:path";

import { parsePath } from "../parser.js";
import { resolveWorkspace } from "../resolver.js";
import { readHistory } from "./history.js";
import { loadSdlcPolicy } from "./policy.js";
import { buildSdlcStaleWorkPayload } from "./views.js";
import { resolveTopoRoot, resolveWorkspaceContext } from "../workspace-paths.js";

/**
 * @typedef {Object} SdlcCommitPrepOptions
 * @property {string|null} [base]
 * @property {string|null} [head]
 * @property {string[]} [changedFiles]
 */

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 * @returns {string[]}
 */
function gitFileList(projectRoot, args) {
  const result = childProcess.spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split(/\r?\n/).map(/** @param {string} line */ (line) => line.trim()).filter(Boolean);
}

/**
 * @param {string} projectRoot
 * @param {string|null|undefined} base
 * @param {string|null|undefined} head
 * @returns {string[]}
 */
function changedFiles(projectRoot, base, head) {
  const localChanges = [
    ...gitFileList(projectRoot, ["diff", "--name-only", "--cached"]),
    ...gitFileList(projectRoot, ["diff", "--name-only"]),
    ...gitFileList(projectRoot, ["ls-files", "--others", "--exclude-standard"])
  ];
  if (base && head) {
    return [...new Set([
      ...gitFileList(projectRoot, ["diff", "--name-only", `${base}...${head}`]),
      ...localChanges
    ])];
  }
  return [...new Set(localChanges)];
}

/**
 * @param {Record<string, any>} ast
 * @param {string} projectRoot
 * @returns {Map<string, { file: string, ids: string[] }>}
 */
function taskFilesFromAst(ast, projectRoot) {
  const map = new Map();
  for (const file of ast.files || []) {
    const ids = (file.statements || [])
      .filter(/** @param {Record<string, any>} statement */ (statement) => statement.kind === "task")
      .map(/** @param {Record<string, any>} statement */ (statement) => statement.id);
    if (ids.length === 0) continue;
    const rel = normalizePath(path.relative(projectRoot, file.file));
    map.set(rel, { file: rel, ids });
  }
  return map;
}

/**
 * @param {Record<string, any>} task
 * @returns {boolean}
 */
function isOpenTask(task) {
  return task.status !== "done";
}

/**
 * @param {Record<string, any>} task
 * @returns {boolean}
 */
function needsExplicitDisposition(task) {
  if (!isOpenTask(task)) return false;
  if (task.disposition) return false;
  return !["claimed", "in-progress"].includes(String(task.status));
}

/**
 * @param {string} inputPath
 * @param {SdlcCommitPrepOptions} [options]
 * @returns {Record<string, any>}
 */
export function runSdlcCommitPrep(inputPath = ".", options = {}) {
  const context = resolveWorkspaceContext(inputPath || ".");
  const projectRoot = context.projectRoot;
  const topogramRoot = resolveTopoRoot(inputPath || ".");
  const files = (options.changedFiles || changedFiles(projectRoot, options.base, options.head)).map(normalizePath);
  const changedFileSet = new Set(files);
  const ast = parsePath(topogramRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return {
      type: "sdlc_commit_prep",
      version: "1",
      ok: false,
      projectRoot,
      topogramRoot,
      changedFiles: files,
      taskFiles: [],
      changedTasks: [],
      openTasks: [],
      warnings: [],
      errors: ["workspace resolution failed"]
    };
  }

  const taskFiles = taskFilesFromAst(ast, projectRoot);
  const changedTaskFiles = [...taskFiles.values()]
    .filter((entry) => changedFileSet.has(entry.file))
    .map((entry) => entry.file)
    .sort();
  const taskIds = new Set(changedTaskFiles.flatMap((file) => taskFiles.get(file)?.ids || []));
  const tasksById = new Map((resolved.graph.byKind.task || []).map(/** @param {Record<string, any>} task */ (task) => [task.id, task]));
  const resolvedTasks = /** @type {Record<string, any>[]} */ ([...taskIds]
    .map((id) => tasksById.get(id))
    .filter(Boolean));
  const changedTasks = resolvedTasks
    .map((task) => {
      const source = [...taskFiles.values()].find((entry) => entry.ids.includes(task.id))?.file || null;
      const disposition = task.disposition || (["claimed", "in-progress"].includes(String(task.status)) ? "active" : null);
      return {
        id: task.id,
        status: task.status,
        priority: task.priority || null,
        disposition,
        explicitDisposition: Boolean(task.disposition),
        file: source,
        requiresDisposition: needsExplicitDisposition(task)
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const openTasks = changedTasks.filter((task) => task.status !== "done");
  const errors = [];
  const warnings = [];
  const policy = loadSdlcPolicy(projectRoot).policy;
  const staleWork = buildSdlcStaleWorkPayload(resolved.graph, readHistory(topogramRoot), policy);

  for (const task of openTasks) {
    if (task.requiresDisposition) {
      errors.push(`Open task ${task.id} in ${task.file} needs explicit disposition active|follow_up|deferred|backlog|blocker before commit.`);
    }
    if (task.disposition === "blocker") {
      errors.push(`Open task ${task.id} is marked disposition blocker.`);
    }
    if (task.priority === "high" && ["follow_up", "deferred", "backlog"].includes(String(task.disposition))) {
      warnings.push(`High priority task ${task.id} remains open as ${task.disposition}.`);
    }
  }
  for (const breach of staleWork.breaches || []) {
    warnings.push(`SDLC ${breach.kind} breach: ${breach.task || breach.actor || "workspace"} exceeds configured stale/WIP policy.`);
  }

  return {
    type: "sdlc_commit_prep",
    version: "1",
    ok: errors.length === 0,
    projectRoot,
    topogramRoot,
    changedFiles: files,
    taskFiles: changedTaskFiles,
    changedTasks,
    openTasks,
    staleWork,
    warnings,
    errors,
    nextCommands: [
      "topogram sdlc explain <task-id> --json",
      "topogram query slice ./topo --task <task-id> --json",
      "topogram sdlc gate . --base <ref> --head <ref> --require-adopted"
    ]
  };
}
