// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../../format.js";
import {
  collectImportSourceFileRecords,
  TOPOGRAM_IMPORT_FILE,
  writeTopogramImportRecord
} from "../../../import/provenance.js";
import { runWorkflow } from "../../../workflows.js";
import { DEFAULT_TOPO_FOLDER_NAME, DEFAULT_WORKSPACE_PATH } from "../../../workspace-paths.js";
import { shellCommandArg } from "../catalog.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} targetPath
 * @returns {void}
 */
export function ensureEmptyImportTarget(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    return;
  }
  if (!fs.statSync(targetPath).isDirectory()) {
    throw new Error(`Cannot import into non-directory path '${targetPath}'.`);
  }
  const entries = fs.readdirSync(targetPath).filter((/** @type {string} */ entry) => entry !== ".DS_Store");
  if (entries.length > 0) {
    throw new Error(`Refusing to import into non-empty directory '${targetPath}'.`);
  }
}

/**
 * @param {string} outDir
 * @param {Record<string, any>} files
 * @returns {string[]}
 */
export function writeRelativeFiles(outDir, files) {
  const written = [];
  for (const [relativePath, contents] of Object.entries(files || {})) {
    const normalizedRelativePath = relativePath.replaceAll(path.sep, "/");
    const destination = path.join(outDir, normalizedRelativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, typeof contents === "string" ? contents : `${stableStringify(contents)}\n`, "utf8");
    written.push(normalizedRelativePath);
  }
  return written.sort((a, b) => a.localeCompare(b));
}

/**
 * @returns {Record<string, any>}
 */
function importedProjectConfig() {
  return {
    version: "0.1",
    workspace: DEFAULT_WORKSPACE_PATH,
    outputs: {
      maintained_app: {
        path: "./app",
        ownership: "maintained"
      }
    },
    topology: {
      runtimes: []
    }
  };
}

/**
 * @param {string} sourceRoot
 * @param {string} targetRoot
 * @param {ReturnType<typeof runWorkflow>["summary"]} importSummary
 * @returns {string}
 */
function importedWorkspaceReadme(sourceRoot, targetRoot, importSummary) {
  return [
    "# Imported Topogram Workspace",
    "",
    "This workspace was created from a brownfield app import.",
    "",
    `- Imported source: \`${sourceRoot}\``,
    `- Target workspace: \`${targetRoot}\``,
    `- Tracks: ${(importSummary.tracks || []).join(", ") || "none"}`,
    `- Provenance: \`${TOPOGRAM_IMPORT_FILE}\``,
    "",
    "Imported Topogram artifacts are project-owned after creation. Edit them directly, promote candidates deliberately, and run `topogram check` before generation or maintained-app work.",
    "",
    "Useful commands:",
    "",
    "```sh",
    "topogram import check",
    "topogram check",
    `topogram query import-plan ./${DEFAULT_TOPO_FOLDER_NAME}`,
    "```",
    ""
  ].join("\n");
}

/**
 * @param {Record<string, any>} summary
 * @returns {Record<string, number>}
 */
export function importCandidateCounts(summary) {
  const candidates = summary.candidates || {};
  return {
    dbEntities: candidates.db?.entities?.length || 0,
    dbEnums: candidates.db?.enums?.length || 0,
    dbMaintainedSeams: candidates.db?.maintained_seams?.length || 0,
    apiCapabilities: candidates.api?.capabilities?.length || 0,
    apiRoutes: candidates.api?.routes?.length || 0,
    uiScreens: candidates.ui?.screens?.length || 0,
    uiRoutes: candidates.ui?.routes?.length || 0,
    uiWidgets: candidates.ui?.widgets?.length || candidates.ui?.components?.length || 0,
    uiShapes: candidates.ui?.shapes?.length || 0,
    cliCommands: candidates.cli?.commands?.length || 0,
    cliCapabilities: candidates.cli?.capabilities?.length || 0,
    cliSurfaces: candidates.cli?.surfaces?.length || 0,
    workflows: candidates.workflows?.workflows?.length || 0,
    verifications: candidates.verification?.verifications?.length || 0
  };
}

/**
 * @param {string} rootPath
 * @returns {number}
 */
export function countFilesRecursive(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return 0;
  }
  let count = 0;
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const childPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      count += countFilesRecursive(childPath);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

/**
 * @param {string} sourcePath
 * @param {string} targetPath
 * @param {{ from?: string|null }} [options]
 * @returns {{ ok: boolean, sourcePath: string, targetPath: string, workspaceRoot: string, topogramRoot: string, projectConfigPath: string, provenancePath: string, tracks: string[], sourceFiles: number, rawCandidateFiles: number, reconcileFiles: number, writtenFiles: string[], candidateCounts: Record<string, number>, nextCommands: string[] }}
 */
export function buildBrownfieldImportWorkspacePayload(sourcePath, targetPath, options = {}) {
  const sourceRoot = path.resolve(sourcePath);
  const targetRoot = path.resolve(targetPath);
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new Error(`Cannot import missing app directory '${sourcePath}'.`);
  }
  if (sourceRoot === targetRoot) {
    throw new Error("Refusing to import into the same directory as the brownfield app.");
  }
  ensureEmptyImportTarget(targetRoot);

  const topogramRoot = path.join(targetRoot, DEFAULT_TOPO_FOLDER_NAME);
  fs.mkdirSync(topogramRoot, { recursive: true });
  const sourceFiles = collectImportSourceFileRecords(sourceRoot, { excludeRoots: [targetRoot] });
  const importResult = runWorkflow("import-app", sourceRoot, { from: options.from || null });
  const rawCandidateFiles = writeRelativeFiles(topogramRoot, importResult.files || {});

  const projectConfigPath = path.join(targetRoot, "topogram.project.json");
  fs.writeFileSync(projectConfigPath, `${stableStringify(importedProjectConfig())}\n`, "utf8");
  fs.writeFileSync(path.join(targetRoot, "README.md"), importedWorkspaceReadme(sourceRoot, targetRoot, importResult.summary), "utf8");

  const reconcileResult = runWorkflow("reconcile", targetRoot, {});
  const reconcileFiles = writeRelativeFiles(topogramRoot, reconcileResult.files || {});
  const candidateCounts = importCandidateCounts(importResult.summary);
  const provenance = writeTopogramImportRecord(targetRoot, {
    sourceRoot,
    ignoredRoots: [targetRoot],
    tracks: importResult.summary.tracks || [],
    findingsCount: importResult.summary.findings_count || 0,
    candidateCounts,
    files: sourceFiles
  });
  const writtenFiles = [
    "README.md",
    "topogram.project.json",
    TOPOGRAM_IMPORT_FILE,
    ...rawCandidateFiles.map((filePath) => `${DEFAULT_TOPO_FOLDER_NAME}/${filePath}`),
    ...reconcileFiles.map((filePath) => `${DEFAULT_TOPO_FOLDER_NAME}/${filePath}`)
  ].sort((a, b) => a.localeCompare(b));
  return {
    ok: true,
    sourcePath: sourceRoot,
    targetPath: targetRoot,
    workspaceRoot: topogramRoot,
    topogramRoot,
    projectConfigPath,
    provenancePath: provenance.path,
    tracks: importResult.summary.tracks || [],
    sourceFiles: sourceFiles.length,
    rawCandidateFiles: rawCandidateFiles.length,
    reconcileFiles: reconcileFiles.length,
    writtenFiles,
    candidateCounts,
    nextCommands: [
      "topogram import check",
      "topogram import plan",
      "topogram import adopt bundle:task --dry-run",
      "topogram import status",
      "topogram check",
      `topogram query import-plan ./${DEFAULT_TOPO_FOLDER_NAME}`
    ]
  };
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportWorkspacePayload>} payload
 * @returns {void}
 */
export function printBrownfieldImportWorkspace(payload) {
  console.log(`Imported brownfield app to ${payload.targetPath}.`);
  console.log(`Source: ${payload.sourcePath}`);
  console.log(`Topogram: ${payload.topogramRoot}`);
  console.log(`Project config: ${payload.projectConfigPath}`);
  console.log(`Import provenance: ${payload.provenancePath}`);
  console.log(`Tracked source files: ${payload.sourceFiles}`);
  console.log(`Raw candidate files: ${payload.rawCandidateFiles}`);
  console.log(`Reconcile proposal files: ${payload.reconcileFiles}`);
  console.log("Imported Topogram artifacts are project-owned after creation; source hashes record the app evidence trusted at import time.");
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${shellCommandArg(path.relative(process.cwd(), payload.targetPath) || ".")}`);
  for (const command of payload.nextCommands) {
    console.log(`  ${command}`);
  }
}
