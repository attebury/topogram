// @ts-check

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildOutputFiles } from "../../generator.js";
import { stableStringify } from "../../format.js";
import { parsePath } from "../../parser.js";
import { resolveWorkspace } from "../../resolver.js";
import { formatValidationErrors, validateWorkspace } from "../../validator.js";
import { runWorkflow } from "../../workflows.js";
import {
  buildTopogramImportStatus,
  collectImportSourceFileRecords,
  TOPOGRAM_IMPORT_FILE,
  writeTopogramImportRecord
} from "../../import/provenance.js";
import {
  loadProjectConfig,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "../../project-config.js";
import { validateProjectImplementationTrust } from "../../template-trust.js";
import { shellCommandArg } from "./catalog.js";
import { CLI_PACKAGE_NAME, readInstalledCliPackageVersion } from "./package.js";

const TOPOGRAM_IMPORT_ADOPTIONS_FILE = ".topogram-import-adoptions.jsonl";

function normalizeTopogramPath(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return absolute;
  }
  const candidate = path.join(absolute, "topogram");
  return fs.existsSync(candidate) ? candidate : absolute;
}

function normalizeProjectRoot(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return path.dirname(absolute);
  }
  return absolute;
}

function combineProjectValidationResults(...results) {
  const errors = [];
  for (const result of results) {
    errors.push(...(result?.errors || []));
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

function topologyComponentReferences(component) {
  return {
    uses_api: component.uses_api || null,
    uses_database: component.uses_database || null
  };
}

function topologyComponentPort(component) {
  return Object.prototype.hasOwnProperty.call(component, "port") ? component.port : null;
}

function summarizeProjectTopology(config) {
  const outputs = Object.entries(config?.outputs || {})
    .map(([name, output]) => ({
      name,
      path: output?.path || null,
      ownership: output?.ownership || null
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const runtimes = (config?.topology?.runtimes || [])
    .map((component) => ({
      id: component.id,
      kind: component.kind,
      projection: component.projection,
      generator: {
        id: component.generator?.id || null,
        version: component.generator?.version || null
      },
      port: topologyComponentPort(component),
      references: topologyComponentReferences(component)
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const edges = runtimes.flatMap((component) => {
    const references = [];
    if (component.references.uses_api) {
      references.push({
        from: component.id,
        to: component.references.uses_api,
        type: "calls_api"
      });
    }
    if (component.references.uses_database) {
      references.push({
        from: component.id,
        to: component.references.uses_database,
        type: "uses_database"
      });
    }
    return references;
  }).sort((left, right) => `${left.from}:${left.type}:${left.to}`.localeCompare(`${right.from}:${right.type}:${right.to}`));
  return {
    outputs,
    runtimes,
    edges
  };
}

function publicProjectTopology(topology) {
  if (!topology || typeof topology !== "object") {
    return topology || null;
  }
  return {
    ...Object.fromEntries(Object.entries(topology).filter(([key]) => key !== "components")),
    runtimes: topology.runtimes || []
  };
}

function checkSummaryPayload({ inputPath, ast, resolved, projectConfigInfo, projectValidation }) {
  const statementCount = ast.files.flatMap((file) => file.statements).length;
  const projectInfo = projectConfigInfo || {
    configPath: null,
    compatibility: false,
    config: { topology: null }
  };
  const resolvedTopology = summarizeProjectTopology(projectInfo.config);
  return {
    ok: resolved.ok && projectValidation.ok,
    inputPath,
    topogram: {
      files: ast.files.length,
      statements: statementCount,
      valid: resolved.ok
    },
    project: {
      configPath: projectInfo.configPath,
      compatibility: Boolean(projectInfo.compatibility),
      valid: projectValidation.ok,
      topology: publicProjectTopology(projectInfo.config.topology),
      resolvedTopology
    },
    errors: [
      ...(resolved.ok ? [] : resolved.validation.errors.map((error) => ({
        source: "topogram",
        message: error.message,
        loc: error.loc
      }))),
      ...projectValidation.errors.map((error) => ({
        source: "project",
        message: error.message,
        loc: error.loc
      }))
    ]
  };
}

/**
 * @param {string} filePath
 * @returns {{ sha256: string, size: number }}
 */
function projectFileHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length
  };
}

export function printImportHelp() {
  console.log("Usage: topogram import <app-path> --out <target> [--from <track[,track]>] [--json]");
  console.log("   or: topogram import refresh [path] [--from <app-path>] [--dry-run] [--json]");
  console.log("   or: topogram import diff [path] [--json]");
  console.log("   or: topogram import check [path] [--json]");
  console.log("   or: topogram import plan [path] [--json]");
  console.log("   or: topogram import adopt --list [path] [--json]");
  console.log("   or: topogram import adopt <selector> [path] [--dry-run|--write] [--force --reason <text>] [--json]");
  console.log("   or: topogram import status [path] [--json]");
  console.log("   or: topogram import history [path] [--verify] [--json]");
  console.log("");
  console.log("Creates an editable Topogram workspace from a brownfield app without modifying the app.");
  console.log("");
  console.log("Behavior:");
  console.log("  - writes raw import candidates under topogram/candidates/app");
  console.log("  - writes reconcile proposal bundles under topogram/candidates/reconcile");
  console.log("  - writes topogram.project.json with maintained ownership and no generated stack binding");
  console.log(`  - writes ${TOPOGRAM_IMPORT_FILE} with source file hashes from import time`);
  console.log("  - imported Topogram artifacts are project-owned after creation");
  console.log("  - refresh rewrites only candidate/reconcile artifacts and source provenance");
  console.log("  - adoption previews never write canonical Topogram files unless --write is passed");
  console.log("  - adoption writes refuse dirty brownfield source provenance unless --force is passed");
  console.log(`  - adoption writes append audit receipts to ${TOPOGRAM_IMPORT_ADOPTIONS_FILE}`);
  console.log("  - forced adoption writes require --reason <text>");
  console.log("");
  console.log("Examples:");
  console.log("  topogram import ./existing-app --out ./imported-topogram");
  console.log("  topogram import ./existing-app --out ./imported-topogram --from db,api,ui");
  console.log("  topogram import diff ./imported-topogram");
  console.log("  topogram import refresh ./imported-topogram --from ./existing-app --dry-run");
  console.log("  topogram import refresh ./imported-topogram --from ./existing-app");
  console.log("  topogram import check ./imported-topogram");
  console.log("  topogram import plan ./imported-topogram");
  console.log("  topogram import adopt --list ./imported-topogram");
  console.log("  topogram import adopt bundle:task ./imported-topogram --dry-run");
  console.log("  topogram import adopt bundle:task ./imported-topogram --write");
  console.log("  topogram import adopt bundle:task ./imported-topogram --write --force --reason \"Reviewed source drift\"");
  console.log("  topogram import status ./imported-topogram");
  console.log("  topogram import history ./imported-topogram");
  console.log("  topogram import history ./imported-topogram --verify");
  console.log("  topogram import check --json");
}

/**
 * @param {string} targetPath
 * @returns {void}
 */
function ensureEmptyImportTarget(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    return;
  }
  if (!fs.statSync(targetPath).isDirectory()) {
    throw new Error(`Cannot import into non-directory path '${targetPath}'.`);
  }
  const entries = fs.readdirSync(targetPath).filter((entry) => entry !== ".DS_Store");
  if (entries.length > 0) {
    throw new Error(`Refusing to import into non-empty directory '${targetPath}'.`);
  }
}

/**
 * @param {string} outDir
 * @param {Record<string, any>} files
 * @returns {string[]}
 */
function writeRelativeFiles(outDir, files) {
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
    "topogram query import-plan ./topogram",
    "```",
    ""
  ].join("\n");
}

/**
 * @param {Record<string, any>} summary
 * @returns {Record<string, number>}
 */
function importCandidateCounts(summary) {
  const candidates = summary.candidates || {};
  return {
    dbEntities: candidates.db?.entities?.length || 0,
    dbEnums: candidates.db?.enums?.length || 0,
    apiCapabilities: candidates.api?.capabilities?.length || 0,
    apiRoutes: candidates.api?.routes?.length || 0,
    uiScreens: candidates.ui?.screens?.length || 0,
    uiRoutes: candidates.ui?.routes?.length || 0,
    uiWidgets: candidates.ui?.widgets?.length || candidates.ui?.components?.length || 0,
    workflows: candidates.workflows?.workflows?.length || 0,
    verifications: candidates.verification?.verifications?.length || 0
  };
}

/**
 * @param {string} rootPath
 * @returns {number}
 */
function countFilesRecursive(rootPath) {
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
 * @param {string} projectRoot
 * @returns {{ path: string, record: Record<string, any> }}
 */
function readTopogramImportRecord(projectRoot) {
  const importPath = path.join(normalizeProjectRoot(projectRoot), TOPOGRAM_IMPORT_FILE);
  if (!fs.existsSync(importPath)) {
    throw new Error(`No brownfield import provenance found at '${importPath}'. Run 'topogram import <app-path> --out <target>' first.`);
  }
  try {
    return { path: importPath, record: JSON.parse(fs.readFileSync(importPath, "utf8")) };
  } catch (error) {
    throw new Error(`Invalid brownfield import provenance JSON at '${importPath}'.`);
  }
}

/**
 * @param {Record<string, any>} importRecord
 * @returns {string|null}
 */
function importTrackValueFromRecord(importRecord) {
  const tracks = Array.isArray(importRecord.import?.tracks)
    ? importRecord.import.tracks.map((track) => String(track).trim()).filter(Boolean)
    : [];
  return tracks.length ? [...new Set(tracks)].join(",") : null;
}

/**
 * @param {string} topogramRoot
 * @returns {{ rawCandidateFiles: number, reconcileFiles: number }}
 */
function clearImportRefreshCandidateArtifacts(topogramRoot) {
  const appCandidatesRoot = path.join(topogramRoot, "candidates", "app");
  const reconcileRoot = path.join(topogramRoot, "candidates", "reconcile");
  const removed = {
    rawCandidateFiles: countFilesRecursive(appCandidatesRoot),
    reconcileFiles: countFilesRecursive(reconcileRoot)
  };
  fs.rmSync(appCandidatesRoot, { recursive: true, force: true });
  fs.rmSync(reconcileRoot, { recursive: true, force: true });
  return removed;
}

function sourceDiffCounts(content = {}) {
  return {
    changed: content.changed?.length || 0,
    added: content.added?.length || 0,
    removed: content.removed?.length || 0
  };
}

function compareImportRecordToSource(projectRoot, importRecord, sourceRoot) {
  const trustedFiles = Array.isArray(importRecord.files) ? importRecord.files : [];
  const trustedByPath = new Map(trustedFiles.map((file) => [String(file.path), file]));
  const currentFiles = collectImportSourceFileRecords(sourceRoot, { excludeRoots: [projectRoot] });
  const currentByPath = new Map(currentFiles.map((file) => [file.path, file]));
  const changed = [];
  const added = [];
  const removed = [];
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
  const content = {
    changed: changed.sort((a, b) => a.localeCompare(b)),
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b))
  };
  const counts = sourceDiffCounts(content);
  const clean = counts.changed === 0 && counts.added === 0 && counts.removed === 0;
  return {
    ok: clean,
    status: clean ? "clean" : "changed",
    content,
    counts,
    files: currentFiles
  };
}

function buildCountDeltas(previous = {}, next = {}) {
  const keys = [...new Set([...Object.keys(previous || {}), ...Object.keys(next || {})])].sort((a, b) => a.localeCompare(b));
  const deltas = {};
  const changed = [];
  for (const key of keys) {
    const previousCount = Number(previous?.[key] || 0);
    const nextCount = Number(next?.[key] || 0);
    const delta = nextCount - previousCount;
    deltas[key] = { previous: previousCount, next: nextCount, delta };
    if (delta !== 0) {
      changed.push({ key, previous: previousCount, next: nextCount, delta });
    }
  }
  return {
    previous,
    next,
    deltas,
    changed
  };
}

function adoptionSurfaceKey(item) {
  return `${item?.bundle || "unbundled"}:${item?.kind || "unknown"}:${item?.item || item?.id || "unknown"}`;
}

function summarizeAdoptionSurface(item) {
  return {
    key: adoptionSurfaceKey(item),
    bundle: item?.bundle || "unbundled",
    kind: item?.kind || "unknown",
    item: item?.item || item?.id || "unknown",
    currentState: item?.current_state || null
  };
}

function summarizeAdoptionPlanDeltas(currentSurfaces = [], nextSurfaces = []) {
  const currentByKey = new Map((currentSurfaces || []).map((item) => [adoptionSurfaceKey(item), item]));
  const nextByKey = new Map((nextSurfaces || []).map((item) => [adoptionSurfaceKey(item), item]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [key, next] of nextByKey) {
    const current = currentByKey.get(key);
    if (!current) {
      added.push(summarizeAdoptionSurface(next));
    } else if (stableStringify(current) !== stableStringify(next)) {
      changed.push({
        ...summarizeAdoptionSurface(next),
        previousState: current.current_state || null,
        nextState: next.current_state || null
      });
    }
  }
  for (const [key, current] of currentByKey) {
    if (!nextByKey.has(key)) {
      removed.push(summarizeAdoptionSurface(current));
    }
  }
  const currentByBundle = countByField(currentSurfaces, "bundle");
  const nextByBundle = countByField(nextSurfaces, "bundle");
  return {
    added: added.sort((left, right) => left.key.localeCompare(right.key)),
    removed: removed.sort((left, right) => left.key.localeCompare(right.key)),
    changed: changed.sort((left, right) => left.key.localeCompare(right.key)),
    byBundle: buildCountDeltas(currentByBundle, nextByBundle)
  };
}

function adoptionSurfacesFromPlanFile(fileContents) {
  if (!fileContents) {
    return [];
  }
  const parsed = JSON.parse(fileContents);
  return parsed.imported_proposal_surfaces || [];
}

function buildRefreshPreviewReconcile(projectRoot, topogramRoot, importFiles) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-refresh-preview."));
  try {
    const tempProjectRoot = path.join(tempRoot, "workspace");
    const tempTopogramRoot = path.join(tempProjectRoot, "topogram");
    fs.mkdirSync(tempProjectRoot, { recursive: true });
    fs.cpSync(topogramRoot, tempTopogramRoot, { recursive: true });
    const projectConfigPath = path.join(projectRoot, "topogram.project.json");
    if (fs.existsSync(projectConfigPath)) {
      fs.cpSync(projectConfigPath, path.join(tempProjectRoot, "topogram.project.json"));
    }
    clearImportRefreshCandidateArtifacts(tempTopogramRoot);
    writeRelativeFiles(tempTopogramRoot, importFiles || {});
    const reconcileResult = runWorkflow("reconcile", tempProjectRoot, {});
    return {
      reconcileFileCount: Object.keys(reconcileResult.files || {}).length,
      reconcileFilePaths: Object.keys(reconcileResult.files || {}).sort((a, b) => a.localeCompare(b)),
      adoptionSurfaces: adoptionSurfacesFromPlanFile(reconcileResult.files?.["candidates/reconcile/adoption-plan.agent.json"]),
      summary: reconcileResult.summary || {}
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function readCurrentAdoptionSurfaces(topogramRoot) {
  const planPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
  if (!fs.existsSync(planPath)) {
    return [];
  }
  return adoptionSurfacesFromPlanFile(fs.readFileSync(planPath, "utf8"));
}

function buildBrownfieldImportRefreshAnalysis(inputPath, options = {}) {
  const projectRoot = normalizeProjectRoot(inputPath);
  const topogramRoot = normalizeTopogramPath(projectRoot);
  if (!fs.existsSync(topogramRoot) || !fs.statSync(topogramRoot).isDirectory()) {
    throw new Error(`No topogram directory found for imported workspace '${inputPath}'.`);
  }

  const { record: importRecord } = readTopogramImportRecord(projectRoot);
  const sourcePath = options.sourcePath && !String(options.sourcePath).startsWith("-")
    ? options.sourcePath
    : importRecord.source?.path;
  if (!sourcePath) {
    throw new Error("No brownfield source path was provided or recorded. Use 'topogram import refresh <workspace> --from <app-path>'.");
  }
  const sourceRoot = path.resolve(sourcePath);
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new Error(`Cannot refresh from missing app directory '${sourcePath}'.`);
  }
  if (sourceRoot === projectRoot) {
    throw new Error("Refusing to refresh import from the imported Topogram workspace itself.");
  }

  const sourceComparison = compareImportRecordToSource(projectRoot, importRecord, sourceRoot);
  const trackValue = importTrackValueFromRecord(importRecord);
  const importResult = runWorkflow("import-app", sourceRoot, { from: trackValue });
  const candidateCounts = importCandidateCounts(importResult.summary);
  const candidateCountDeltas = buildCountDeltas(importRecord.import?.candidateCounts || {}, candidateCounts);
  const removedCandidateFiles = {
    rawCandidateFiles: countFilesRecursive(path.join(topogramRoot, "candidates", "app")),
    reconcileFiles: countFilesRecursive(path.join(topogramRoot, "candidates", "reconcile"))
  };
  const previewReconcile = buildRefreshPreviewReconcile(projectRoot, topogramRoot, importResult.files || {});
  const currentAdoptionSurfaces = readCurrentAdoptionSurfaces(topogramRoot);
  const adoptionPlanDeltas = summarizeAdoptionPlanDeltas(currentAdoptionSurfaces, previewReconcile.adoptionSurfaces);
  const receiptVerification = verifyImportAdoptionReceipts(projectRoot, readImportAdoptionReceipts(projectRoot));
  const plannedFiles = [
    TOPOGRAM_IMPORT_FILE,
    ...Object.keys(importResult.files || {}).map((filePath) => `topogram/${filePath}`),
    ...previewReconcile.reconcileFilePaths.map((filePath) => `topogram/${filePath}`)
  ].sort((a, b) => a.localeCompare(b));
  const analysis = {
    projectRoot,
    topogramRoot,
    sourcePath: sourceRoot,
    provenancePath: path.join(projectRoot, TOPOGRAM_IMPORT_FILE),
    importedAt: importRecord.importedAt || null,
    previousImportStatus: sourceComparison.status,
    sourceDiff: {
      status: sourceComparison.status,
      counts: sourceComparison.counts,
      changed: sourceComparison.content.changed,
      added: sourceComparison.content.added,
      removed: sourceComparison.content.removed
    },
    tracks: importResult.summary.tracks || [],
    sourceFiles: sourceComparison.files.length,
    removedCandidateFiles,
    rawCandidateFiles: Object.keys(importResult.files || {}).length,
    reconcileFiles: previewReconcile.reconcileFileCount,
    candidateCounts,
    candidateCountDeltas,
    adoptionPlanDeltas,
    receiptVerification,
    plannedFiles
  };
  Object.defineProperty(analysis, "importResult", {
    value: importResult,
    enumerable: false
  });
  return analysis;
}

/**
 * @param {string} sourcePath
 * @param {string} targetPath
 * @param {{ from?: string|null }} [options]
 * @returns {{ ok: boolean, sourcePath: string, targetPath: string, topogramRoot: string, projectConfigPath: string, provenancePath: string, tracks: string[], sourceFiles: number, rawCandidateFiles: number, reconcileFiles: number, writtenFiles: string[], candidateCounts: Record<string, number>, nextCommands: string[] }}
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

  const topogramRoot = path.join(targetRoot, "topogram");
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
    ...rawCandidateFiles.map((filePath) => `topogram/${filePath}`),
    ...reconcileFiles.map((filePath) => `topogram/${filePath}`)
  ].sort((a, b) => a.localeCompare(b));
  return {
    ok: true,
    sourcePath: sourceRoot,
    targetPath: targetRoot,
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
      "topogram query import-plan ./topogram"
    ]
  };
}

/**
 * @param {string} inputPath
 * @param {{ sourcePath?: string|null, dryRun?: boolean }} [options]
 * @returns {{ ok: boolean, dryRun: boolean, projectRoot: string, topogramRoot: string, sourcePath: string, provenancePath: string, previousImportStatus: string, currentImportStatus: string, tracks: string[], sourceFiles: number, sourceDiff: Record<string, any>, removedCandidateFiles: Record<string, number>, rawCandidateFiles: number, reconcileFiles: number, writtenFiles: string[], plannedFiles: string[], candidateCounts: Record<string, number>, candidateCountDeltas: Record<string, any>, adoptionPlanDeltas: Record<string, any>, receiptVerification: Record<string, any>, refreshMetadata: Record<string, any>|null, nextCommands: string[] }}
 */
export function buildBrownfieldImportRefreshPayload(inputPath, options = {}) {
  const analysis = buildBrownfieldImportRefreshAnalysis(inputPath, options);
  const dryRun = Boolean(options.dryRun);
  let provenancePath = analysis.provenancePath;
  let currentImportStatus = dryRun ? analysis.previousImportStatus : "unknown";
  let writtenFiles = [];
  let refreshMetadata = null;
  if (!dryRun) {
    const removedCandidateFiles = clearImportRefreshCandidateArtifacts(analysis.topogramRoot);
    const rawCandidateFiles = writeRelativeFiles(analysis.topogramRoot, analysis.importResult.files || {});
    const reconcileResult = runWorkflow("reconcile", analysis.projectRoot, {});
    const reconcileFiles = writeRelativeFiles(analysis.topogramRoot, reconcileResult.files || {});
    const refreshedAt = new Date().toISOString();
    refreshMetadata = {
      refreshedAt,
      previousSourceStatus: analysis.previousImportStatus,
      sourceDiffCounts: analysis.sourceDiff.counts
    };
    const provenance = writeTopogramImportRecord(analysis.projectRoot, {
      sourceRoot: analysis.sourcePath,
      ignoredRoots: [analysis.projectRoot],
      importedAt: analysis.importedAt || undefined,
      refreshedAt,
      refresh: {
        previousSourceStatus: analysis.previousImportStatus,
        sourceDiffCounts: analysis.sourceDiff.counts
      },
      tracks: analysis.importResult.summary.tracks || [],
      findingsCount: analysis.importResult.summary.findings_count || 0,
      candidateCounts: analysis.candidateCounts,
      files: collectImportSourceFileRecords(analysis.sourcePath, { excludeRoots: [analysis.projectRoot] })
    });
    provenancePath = provenance.path;
    currentImportStatus = buildTopogramImportStatus(analysis.projectRoot).status;
    writtenFiles = [
      TOPOGRAM_IMPORT_FILE,
      ...rawCandidateFiles.map((filePath) => `topogram/${filePath}`),
      ...reconcileFiles.map((filePath) => `topogram/${filePath}`)
    ].sort((a, b) => a.localeCompare(b));
    analysis.removedCandidateFiles = removedCandidateFiles;
    analysis.rawCandidateFiles = rawCandidateFiles.length;
    analysis.reconcileFiles = reconcileFiles.length;
  }
  return {
    ok: dryRun || currentImportStatus === "clean",
    dryRun,
    projectRoot: analysis.projectRoot,
    topogramRoot: analysis.topogramRoot,
    sourcePath: analysis.sourcePath,
    provenancePath,
    previousImportStatus: analysis.previousImportStatus,
    currentImportStatus,
    tracks: analysis.tracks,
    sourceFiles: analysis.sourceFiles,
    sourceDiff: analysis.sourceDiff,
    removedCandidateFiles: analysis.removedCandidateFiles,
    rawCandidateFiles: analysis.rawCandidateFiles,
    reconcileFiles: analysis.reconcileFiles,
    writtenFiles,
    plannedFiles: analysis.plannedFiles,
    candidateCounts: analysis.candidateCounts,
    candidateCountDeltas: analysis.candidateCountDeltas,
    adoptionPlanDeltas: analysis.adoptionPlanDeltas,
    receiptVerification: analysis.receiptVerification,
    refreshMetadata,
    nextCommands: [
      dryRun
        ? `topogram import refresh ${importProjectCommandPath(analysis.projectRoot)}`
        : `topogram import check ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram import plan ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram import status ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram import history ${importProjectCommandPath(analysis.projectRoot)} --verify`
    ]
  };
}

export function buildBrownfieldImportDiffPayload(inputPath, options = {}) {
  const analysis = buildBrownfieldImportRefreshAnalysis(inputPath, options);
  return {
    ok: true,
    projectRoot: analysis.projectRoot,
    topogramRoot: analysis.topogramRoot,
    sourcePath: analysis.sourcePath,
    provenancePath: analysis.provenancePath,
    importStatus: analysis.previousImportStatus,
    sourceDiff: analysis.sourceDiff,
    tracks: analysis.tracks,
    sourceFiles: analysis.sourceFiles,
    candidateCounts: analysis.candidateCounts,
    candidateCountDeltas: analysis.candidateCountDeltas,
    adoptionPlanDeltas: analysis.adoptionPlanDeltas,
    receiptVerification: analysis.receiptVerification,
    plannedFiles: analysis.plannedFiles,
    nextCommands: [
      `topogram import refresh ${importProjectCommandPath(analysis.projectRoot)} --dry-run`,
      `topogram import refresh ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram import plan ${importProjectCommandPath(analysis.projectRoot)}`
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

/**
 * @param {ReturnType<typeof buildBrownfieldImportRefreshPayload>} payload
 * @returns {void}
 */
export function printBrownfieldImportRefresh(payload) {
  console.log(`${payload.dryRun ? "Previewed" : "Refreshed"} brownfield import candidates for ${payload.projectRoot}.`);
  console.log(`Source: ${payload.sourcePath}`);
  console.log(`Topogram: ${payload.topogramRoot}`);
  console.log(`Import provenance: ${payload.provenancePath}`);
  console.log(`Previous source status: ${payload.previousImportStatus}`);
  console.log(`Current source status: ${payload.currentImportStatus}`);
  console.log(`Source diff: changed=${payload.sourceDiff.counts.changed}, added=${payload.sourceDiff.counts.added}, removed=${payload.sourceDiff.counts.removed}`);
  console.log(`Tracked source files: ${payload.sourceFiles}`);
  console.log(`Raw candidate files: ${payload.rawCandidateFiles}`);
  console.log(`Reconcile proposal files: ${payload.reconcileFiles}`);
  console.log(`Replaced candidate files: ${payload.removedCandidateFiles.rawCandidateFiles + payload.removedCandidateFiles.reconcileFiles}`);
  const candidateChanges = payload.candidateCountDeltas.changed || [];
  console.log(`Candidate count changes: ${candidateChanges.length}`);
  for (const item of candidateChanges.slice(0, 8)) {
    const sign = item.delta > 0 ? "+" : "";
    console.log(`- ${item.key}: ${item.previous} -> ${item.next} (${sign}${item.delta})`);
  }
  const adoptionDeltas = payload.adoptionPlanDeltas;
  console.log(`Adoption plan changes: added=${adoptionDeltas.added.length}, removed=${adoptionDeltas.removed.length}, changed=${adoptionDeltas.changed.length}`);
  console.log(`Receipt verification: ${payload.receiptVerification.status}`);
  if (payload.dryRun) {
    console.log("No files were written. Re-run without --dry-run to refresh candidates and source provenance.");
  }
  console.log("Canonical Topogram files were not overwritten. Adopt refreshed candidates explicitly after review.");
  console.log("");
  console.log("Next steps:");
  for (const command of payload.nextCommands) {
    console.log(`  ${command}`);
  }
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportDiffPayload>} payload
 * @returns {void}
 */
export function printBrownfieldImportDiff(payload) {
  console.log(`Import diff for ${payload.projectRoot}`);
  console.log(`Source: ${payload.sourcePath}`);
  console.log(`Source status: ${payload.importStatus}`);
  console.log(`Source diff: changed=${payload.sourceDiff.counts.changed}, added=${payload.sourceDiff.counts.added}, removed=${payload.sourceDiff.counts.removed}`);
  for (const filePath of [...payload.sourceDiff.changed, ...payload.sourceDiff.added, ...payload.sourceDiff.removed].slice(0, 12)) {
    const status = payload.sourceDiff.changed.includes(filePath)
      ? "changed"
      : payload.sourceDiff.added.includes(filePath)
        ? "added"
        : "removed";
    console.log(`- ${filePath}: ${status}`);
  }
  console.log("");
  console.log("Candidate count changes:");
  const candidateChanges = payload.candidateCountDeltas.changed || [];
  if (candidateChanges.length === 0) {
    console.log("- None");
  } else {
    for (const item of candidateChanges) {
      const sign = item.delta > 0 ? "+" : "";
      console.log(`- ${item.key}: ${item.previous} -> ${item.next} (${sign}${item.delta})`);
    }
  }
  console.log("");
  console.log(`Adoption plan changes: added=${payload.adoptionPlanDeltas.added.length}, removed=${payload.adoptionPlanDeltas.removed.length}, changed=${payload.adoptionPlanDeltas.changed.length}`);
  for (const item of payload.adoptionPlanDeltas.added.slice(0, 8)) {
    console.log(`- added ${item.bundle}/${item.kind}/${item.item}`);
  }
  for (const item of payload.adoptionPlanDeltas.removed.slice(0, 8)) {
    console.log(`- removed ${item.bundle}/${item.kind}/${item.item}`);
  }
  console.log(`Receipt verification: ${payload.receiptVerification.status}`);
  const receiptSummary = payload.receiptVerification.summary;
  console.log(`Adopted file audit: changed=${receiptSummary.changedFileCount}, removed=${receiptSummary.removedFileCount}, unverifiable=${receiptSummary.unverifiableFileCount}`);
  console.log("");
  console.log("Next steps:");
  for (const command of payload.nextCommands) {
    console.log(`  ${command}`);
  }
}

/**
 * @param {string} inputPath
 * @returns {ReturnType<typeof checkSummaryPayload>}
 */
function buildTopogramCheckPayloadForPath(inputPath) {
  const ast = parsePath(inputPath);
  const resolved = resolveWorkspace(ast);
  const explicitProjectConfig = loadProjectConfig(inputPath);
  const projectValidation = explicitProjectConfig
    ? combineProjectValidationResults(
        validateProjectConfig(explicitProjectConfig.config, resolved.ok ? resolved.graph : null, { configDir: explicitProjectConfig.configDir }),
        validateProjectOutputOwnership(explicitProjectConfig),
        validateProjectImplementationTrust(explicitProjectConfig)
      )
    : { ok: false, errors: [{ message: "Missing topogram.project.json or compatible topogram.implementation.json", loc: null }] };
  return checkSummaryPayload({ inputPath, ast, resolved, projectConfigInfo: explicitProjectConfig, projectValidation });
}

/**
 * @param {string} projectRoot
 * @returns {{ ok: boolean, projectRoot: string, import: ReturnType<typeof buildTopogramImportStatus>, topogram: ReturnType<typeof buildTopogramCheckPayloadForPath>, errors: any[] }}
 */
export function buildBrownfieldImportCheckPayload(projectRoot) {
  const resolvedRoot = normalizeProjectRoot(projectRoot);
  const importStatus = buildTopogramImportStatus(resolvedRoot);
  const topogramCheck = buildTopogramCheckPayloadForPath(resolvedRoot);
  return {
    ok: importStatus.ok && topogramCheck.ok,
    projectRoot: resolvedRoot,
    import: importStatus,
    topogram: topogramCheck,
    errors: [
      ...(importStatus.errors || []).map((message) => ({ source: "import", message })),
      ...(topogramCheck.errors || [])
    ]
  };
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportCheckPayload>} payload
 * @returns {void}
 */
export function printBrownfieldImportCheck(payload) {
  console.log(`Topogram import check: ${payload.import.status}`);
  console.log(`Project: ${payload.projectRoot}`);
  if (payload.import.source?.source?.path) {
    console.log(`Imported source: ${payload.import.source.source.path}`);
  }
  console.log(`Provenance: ${payload.import.path}`);
  if (payload.import.source?.files) {
    console.log(`Trusted source files: ${payload.import.source.files.length}`);
  }
  if (payload.import.status === "changed") {
    console.log(`Changed source files: ${payload.import.content.changed.length}`);
    console.log(`Added source files: ${payload.import.content.added.length}`);
    console.log(`Removed source files: ${payload.import.content.removed.length}`);
  }
  console.log(`Topogram check: ${payload.topogram.ok ? "passed" : "failed"}`);
  console.log("Imported Topogram artifacts are project-owned; import check compares only the brownfield source hashes trusted at import time plus normal Topogram validity.");
  for (const diagnostic of payload.import.diagnostics || []) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
    if (diagnostic.suggestedFix) {
      console.log(`Fix: ${diagnostic.suggestedFix}`);
    }
  }
  for (const error of payload.topogram.errors || []) {
    console.log(`Error: ${error.message}`);
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function importAdoptionsPath(projectRoot) {
  return path.join(normalizeProjectRoot(projectRoot), TOPOGRAM_IMPORT_ADOPTIONS_FILE);
}

function readImportAdoptionReceipts(projectRoot) {
  const historyPath = importAdoptionsPath(projectRoot);
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  return fs.readFileSync(historyPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid import adoption receipt JSON at ${historyPath}:${index + 1}.`);
      }
    });
}

function appendImportAdoptionReceipt(projectRoot, receipt) {
  const historyPath = importAdoptionsPath(projectRoot);
  fs.appendFileSync(historyPath, `${JSON.stringify(receipt)}\n`, "utf8");
  return historyPath;
}

function countByField(items, fieldName) {
  const counts = {};
  for (const item of items || []) {
    const key = item?.[fieldName] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function importProjectCommandPath(projectRoot) {
  return shellCommandArg(path.relative(process.cwd(), projectRoot) || ".");
}

function importAdoptCommand(projectRoot, selector, write = false) {
  return `topogram import adopt ${selector} ${importProjectCommandPath(projectRoot)} ${write ? "--write" : "--dry-run"}`;
}

const BROWNFIELD_BROAD_ADOPT_SELECTORS = [
  {
    selector: "from-plan",
    kind: "plan",
    label: "approved or pending plan items",
    matches: (item) => item.current_state === "stage" || item.current_state === "accept"
  },
  { selector: "actors", kind: "kind", label: "actors", matches: (item) => item.kind === "actor" },
  { selector: "roles", kind: "kind", label: "roles", matches: (item) => item.kind === "role" },
  { selector: "enums", kind: "kind", label: "enums", matches: (item) => item.kind === "enum" },
  { selector: "shapes", kind: "kind", label: "shapes", matches: (item) => item.kind === "shape" },
  { selector: "entities", kind: "kind", label: "entities", matches: (item) => item.kind === "entity" },
  { selector: "capabilities", kind: "kind", label: "capabilities", matches: (item) => item.kind === "capability" },
  { selector: "widgets", kind: "kind", label: "widgets", matches: (item) => item.kind === "widget" },
  { selector: "docs", kind: "track", label: "docs", matches: (item) => item.track === "docs" },
  {
    selector: "journeys",
    kind: "track",
    label: "journey docs",
    matches: (item) => item.track === "docs" && String(item.canonical_rel_path || "").startsWith("docs/journeys/")
  },
  { selector: "workflows", kind: "track", label: "workflows", matches: (item) => item.track === "workflows" || item.kind === "decision" },
  { selector: "verification", kind: "kind", label: "verification", matches: (item) => item.kind === "verification" },
  { selector: "ui", kind: "track", label: "UI reports and widgets", matches: (item) => item.track === "ui" }
];

function readImportAdoptionArtifacts(inputPath) {
  const projectRoot = normalizeProjectRoot(inputPath);
  const topogramRoot = normalizeTopogramPath(inputPath);
  const reconcileRoot = path.join(topogramRoot, "candidates", "reconcile");
  const paths = {
    reconcileRoot,
    adoptionPlanAgent: path.join(reconcileRoot, "adoption-plan.agent.json"),
    adoptionPlan: path.join(reconcileRoot, "adoption-plan.json"),
    adoptionStatus: path.join(reconcileRoot, "adoption-status.json"),
    reconcileReport: path.join(reconcileRoot, "report.json")
  };
  if (!fs.existsSync(paths.adoptionPlanAgent)) {
    throw new Error(`No import adoption plan found under '${reconcileRoot}'. Run 'topogram import <app-path> --out <target>' first.`);
  }
  return {
    projectRoot,
    topogramRoot,
    paths,
    adoptionPlan: JSON.parse(fs.readFileSync(paths.adoptionPlanAgent, "utf8")),
    adoptionStatus: readJsonIfExists(paths.adoptionStatus),
    reconcileReport: readJsonIfExists(paths.reconcileReport)
  };
}

function buildBrownfieldBroadAdoptSelectors(projectRoot, adoptionPlan) {
  const surfaces = adoptionPlan.imported_proposal_surfaces || [];
  return BROWNFIELD_BROAD_ADOPT_SELECTORS.map((definition) => {
    const items = surfaces.filter(definition.matches);
    const pendingItems = items.filter((item) => !["accept", "accepted", "applied"].includes(item.current_state));
    const appliedItems = items.filter((item) => ["accept", "accepted", "applied"].includes(item.current_state));
    const blockedItems = items.filter((item) => item.human_review_required);
    return {
      selector: definition.selector,
      kind: definition.kind,
      label: definition.label,
      itemCount: items.length,
      pendingItemCount: pendingItems.length,
      appliedItemCount: appliedItems.length,
      blockedItemCount: blockedItems.length,
      previewCommand: importAdoptCommand(projectRoot, definition.selector, false),
      writeCommand: importAdoptCommand(projectRoot, definition.selector, true)
    };
  }).filter((selector) => selector.itemCount > 0);
}

function summarizeImportAdoption(adoptionPlan, adoptionStatus, projectRoot) {
  const surfaces = adoptionPlan.imported_proposal_surfaces || [];
  const slugs = [];
  const surfaceMap = new Map();
  for (const surface of surfaces) {
    const slug = surface.bundle || "unbundled";
    if (!surfaceMap.has(slug)) {
      surfaceMap.set(slug, []);
      slugs.push(slug);
    }
    surfaceMap.get(slug).push(surface);
  }
  for (const item of adoptionStatus?.bundle_priorities || []) {
    if (item?.bundle && !surfaceMap.has(item.bundle)) {
      surfaceMap.set(item.bundle, []);
      slugs.push(item.bundle);
    }
  }
  const blockersByBundle = new Map((adoptionStatus?.bundle_blockers || []).map((item) => [item.bundle, item]));
  const prioritiesByBundle = new Map((adoptionStatus?.bundle_priorities || []).map((item) => [item.bundle, item]));
  const bundles = slugs.sort((left, right) => left.localeCompare(right)).map((slug) => {
    const bundleSurfaces = surfaceMap.get(slug) || [];
    const blocker = blockersByBundle.get(slug) || null;
    const priority = prioritiesByBundle.get(slug) || null;
    const pendingItems = blocker?.pending_items || bundleSurfaces
      .filter((item) => !["accept", "accepted", "applied"].includes(item.current_state))
      .map((item) => item.item);
    const appliedItems = blocker?.applied_items || [];
    const blockedItems = blocker?.blocked_items || [];
    return {
      bundle: slug,
      itemCount: bundleSurfaces.length,
      pendingItemCount: pendingItems.length,
      appliedItemCount: appliedItems.length,
      blockedItemCount: blockedItems.length,
      humanReviewRequiredCount: bundleSurfaces.filter((item) => item.human_review_required).length,
      kindCounts: countByField(bundleSurfaces, "kind"),
      complete: Boolean(priority?.is_complete) || (pendingItems.length === 0 && blockedItems.length === 0 && appliedItems.length > 0),
      evidenceScore: priority?.evidence_score || 0,
      why: priority?.operator_summary?.whyThisBundle || null,
      nextCommand: importAdoptCommand(projectRoot, `bundle:${slug}`, false)
    };
  });
  const nextBundle = bundles.find((bundle) => !bundle.complete && bundle.pendingItemCount > 0) || bundles.find((bundle) => !bundle.complete) || bundles[0] || null;
  const blockedCount = bundles.reduce((total, bundle) => total + bundle.blockedItemCount, 0);
  const pendingCount = bundles.reduce((total, bundle) => total + bundle.pendingItemCount, 0);
  const appliedCount = adoptionStatus?.applied_item_count ?? bundles.reduce((total, bundle) => total + bundle.appliedItemCount, 0);
  return {
    summary: {
      bundleCount: bundles.length,
      proposalItemCount: surfaces.length,
      pendingItemCount: pendingCount,
      appliedItemCount: appliedCount,
      blockedItemCount: blockedCount,
      requiresHumanReviewCount: (adoptionPlan.requires_human_review || []).length || surfaces.filter((item) => item.human_review_required).length
    },
    bundles,
    risks: [
      ...(blockedCount > 0 ? [`${blockedCount} adoption item(s) are blocked.`] : []),
      ...(((adoptionPlan.requires_human_review || []).length || surfaces.some((item) => item.human_review_required))
        ? ["Imported proposal items require human review before adoption."]
        : [])
    ],
    nextCommand: nextBundle ? nextBundle.nextCommand : `topogram import status ${importProjectCommandPath(projectRoot)}`
  };
}

export function buildBrownfieldImportPlanPayload(inputPath) {
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const adoptionStatus = runWorkflow("adoption-status", artifacts.projectRoot).summary || artifacts.adoptionStatus || {};
  const adoption = summarizeImportAdoption(artifacts.adoptionPlan, adoptionStatus, artifacts.projectRoot);
  return {
    ok: true,
    projectRoot: artifacts.projectRoot,
    topogramRoot: artifacts.topogramRoot,
    artifacts: {
      adoptionPlan: artifacts.paths.adoptionPlanAgent,
      adoptionStatus: artifacts.paths.adoptionStatus,
      reconcileReport: artifacts.paths.reconcileReport
    },
    ...adoption,
    commands: {
      check: `topogram import check ${importProjectCommandPath(artifacts.projectRoot)}`,
      status: `topogram import status ${importProjectCommandPath(artifacts.projectRoot)}`,
      next: adoption.nextCommand
    }
  };
}

export function printBrownfieldImportPlan(payload) {
  console.log(`Import adoption plan for ${payload.projectRoot}`);
  console.log(`Proposal items: ${payload.summary.proposalItemCount}`);
  console.log(`Bundles: ${payload.summary.bundleCount}`);
  for (const bundle of payload.bundles) {
    console.log(`- ${bundle.bundle}: ${bundle.itemCount} item(s), ${bundle.pendingItemCount} pending, ${bundle.appliedItemCount} applied`);
    if (bundle.why) {
      console.log(`  ${bundle.why}`);
    }
    console.log(`  Preview: ${bundle.nextCommand}`);
  }
  if (payload.risks.length > 0) {
    console.log("Risks:");
    for (const risk of payload.risks) {
      console.log(`- ${risk}`);
    }
  }
  console.log("");
  console.log(`Next: ${payload.nextCommand}`);
}

export function buildBrownfieldImportAdoptListPayload(inputPath) {
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const plan = buildBrownfieldImportPlanPayload(inputPath);
  const selectors = plan.bundles.map((bundle) => ({
    selector: `bundle:${bundle.bundle}`,
    kind: "bundle",
    bundle: bundle.bundle,
    itemCount: bundle.itemCount,
    pendingItemCount: bundle.pendingItemCount,
    appliedItemCount: bundle.appliedItemCount,
    blockedItemCount: bundle.blockedItemCount,
    complete: bundle.complete,
    previewCommand: importAdoptCommand(plan.projectRoot, `bundle:${bundle.bundle}`, false),
    writeCommand: importAdoptCommand(plan.projectRoot, `bundle:${bundle.bundle}`, true)
  }));
  const broadSelectors = buildBrownfieldBroadAdoptSelectors(plan.projectRoot, artifacts.adoptionPlan);
  return {
    ok: true,
    projectRoot: plan.projectRoot,
    topogramRoot: plan.topogramRoot,
    selectorCount: selectors.length,
    selectors,
    broadSelectorCount: broadSelectors.length,
    broadSelectors,
    nextCommand: selectors.find((selector) => !selector.complete)?.previewCommand || plan.commands.status
  };
}

export function printBrownfieldImportAdoptList(payload) {
  console.log(`Import adoption selectors for ${payload.projectRoot}`);
  if (payload.selectors.length === 0) {
    console.log("No adoption selectors are available. Run `topogram import plan` to inspect reconcile artifacts.");
    return;
  }
  for (const selector of payload.selectors) {
    console.log(`- ${selector.selector}: ${selector.itemCount} item(s), ${selector.pendingItemCount} pending, ${selector.appliedItemCount} applied`);
    console.log(`  Preview: ${selector.previewCommand}`);
    console.log(`  Write: ${selector.writeCommand}`);
  }
  if (payload.broadSelectors.length > 0) {
    console.log("");
    console.log("Broad selectors:");
    for (const selector of payload.broadSelectors) {
      console.log(`- ${selector.selector}: ${selector.itemCount} ${selector.label}`);
      console.log(`  Preview: ${selector.previewCommand}`);
      console.log(`  Write: ${selector.writeCommand}`);
    }
  }
  console.log("");
  console.log(`Next: ${payload.nextCommand}`);
}

function writtenFileHashesForReceipt(outputRoot, writtenFiles) {
  return (writtenFiles || []).map((relativePath) => {
    const filePath = path.join(outputRoot, relativePath);
    const hash = fs.existsSync(filePath) ? projectFileHash(filePath) : null;
    return {
      path: relativePath,
      sha256: hash?.sha256 || null,
      size: hash?.size || null
    };
  });
}

function buildImportAdoptionReceipt({ artifacts, selector, options, importStatus, summary, writtenFiles, outputRoot }) {
  return {
    type: "topogram_import_adoption_receipt",
    version: "0.1",
    timestamp: new Date().toISOString(),
    cli: {
      packageName: CLI_PACKAGE_NAME,
      version: readInstalledCliPackageVersion()
    },
    projectRoot: artifacts.projectRoot,
    topogramRoot: artifacts.topogramRoot,
    selector,
    mode: "write",
    dryRun: false,
    forced: Boolean(options.force),
    reason: options.reason || null,
    sourceProvenance: {
      ok: importStatus.ok,
      status: importStatus.status,
      path: importStatus.path || null,
      changed: importStatus.content?.changed || [],
      added: importStatus.content?.added || [],
      removed: importStatus.content?.removed || []
    },
    promotedCanonicalItems: (summary.promoted_canonical_items || []).map((item) => ({
      bundle: item.bundle || null,
      kind: item.kind || null,
      item: item.item || null,
      canonicalRelPath: item.canonical_rel_path || null,
      sourcePath: item.source_path || null,
      changeType: item.change_type || null
    })),
    writtenFiles,
    writtenFileHashes: writtenFileHashesForReceipt(outputRoot, writtenFiles),
    outputRoot
  };
}

export function buildBrownfieldImportAdoptPayload(selector, inputPath, options = {}) {
  if (!selector) {
    throw new Error("Missing required <selector>. Example: topogram import adopt bundle:task --dry-run");
  }
  if (options.write && options.dryRun) {
    throw new Error("Use either --dry-run or --write, not both.");
  }
  if (options.write && options.force && !options.reason) {
    throw new Error("Forced import adoption writes require --reason <text>.");
  }
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const importStatus = buildTopogramImportStatus(artifacts.projectRoot);
  if (options.write && !options.force && !importStatus.ok) {
    throw new Error(`Refusing to write import adoption because brownfield source provenance is ${importStatus.status}. Run 'topogram import check ${importProjectCommandPath(artifacts.projectRoot)}', review the changed source evidence, rerun import, or pass --force --reason <text> after review.`);
  }
  const result = runWorkflow("reconcile", artifacts.projectRoot, {
    adopt: selector,
    write: Boolean(options.write),
    refreshAdopted: Boolean(options.refreshAdopted)
  });
  const outputRoot = path.resolve(result.defaultOutDir || artifacts.topogramRoot);
  const writtenFiles = options.write ? writeRelativeFiles(outputRoot, result.files || {}) : [];
  const summary = result.summary || {};
  const receipt = options.write
    ? buildImportAdoptionReceipt({ artifacts, selector, options, importStatus, summary, writtenFiles, outputRoot })
    : null;
  const receiptPath = receipt ? appendImportAdoptionReceipt(artifacts.projectRoot, receipt) : null;
  return {
    ok: true,
    projectRoot: artifacts.projectRoot,
    topogramRoot: artifacts.topogramRoot,
    selector,
    dryRun: !options.write,
    write: Boolean(options.write),
    forced: Boolean(options.force),
    reason: options.reason || null,
    outputRoot,
    promotedCanonicalItemCount: (summary.promoted_canonical_items || []).length,
    promotedCanonicalItems: summary.promoted_canonical_items || [],
    writtenFiles,
    receipt,
    receiptPath,
    adoption: summary,
    import: importStatus,
    warnings: options.write && options.force && !importStatus.ok
      ? [`Brownfield source provenance is ${importStatus.status}; adoption write was forced with reason: ${options.reason}.`]
      : [],
    nextCommands: options.write
      ? [
          `topogram import history ${importProjectCommandPath(artifacts.projectRoot)}`,
          `topogram import status ${importProjectCommandPath(artifacts.projectRoot)}`,
          `topogram check ${importProjectCommandPath(artifacts.projectRoot)}`
        ]
      : [
          importAdoptCommand(artifacts.projectRoot, selector, true),
          `topogram import status ${importProjectCommandPath(artifacts.projectRoot)}`
        ]
  };
}

export function printBrownfieldImportAdopt(payload) {
  console.log(`${payload.dryRun ? "Previewed" : "Applied"} import adoption for ${payload.selector}.`);
  console.log(`Project: ${payload.projectRoot}`);
  console.log(`Promoted canonical items: ${payload.promotedCanonicalItemCount}`);
  console.log(`Written files: ${payload.writtenFiles.length}`);
  if (payload.receiptPath) {
    console.log(`Receipt: ${payload.receiptPath}`);
  }
  if (payload.dryRun) {
    console.log("No files were written. Re-run with --write to promote these candidates.");
  }
  for (const warning of payload.warnings || []) {
    console.log(`Warning: ${warning}`);
  }
  console.log("");
  console.log("Next steps:");
  for (const command of payload.nextCommands) {
    console.log(`  ${command}`);
  }
}

export function buildBrownfieldImportStatusPayload(inputPath) {
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const importCheck = buildBrownfieldImportCheckPayload(artifacts.projectRoot);
  const adoptionStatus = runWorkflow("adoption-status", artifacts.projectRoot).summary || artifacts.adoptionStatus || {};
  const adoption = summarizeImportAdoption(artifacts.adoptionPlan, adoptionStatus, artifacts.projectRoot);
  const history = buildBrownfieldImportHistoryPayload(artifacts.projectRoot);
  return {
    ok: importCheck.ok,
    projectRoot: artifacts.projectRoot,
    topogramRoot: artifacts.topogramRoot,
    import: importCheck.import,
    topogram: importCheck.topogram,
    adoption: {
      status: adoptionStatus,
      summary: adoption.summary,
      bundles: adoption.bundles,
      risks: adoption.risks,
      nextCommand: adoption.nextCommand,
      history: history.summary
    },
    errors: importCheck.errors
  };
}

export function printBrownfieldImportStatus(payload) {
  console.log(`Import status: ${payload.import.status}`);
  console.log(`Topogram check: ${payload.topogram.ok ? "passed" : "failed"}`);
  console.log(`Adoption: ${payload.adoption.summary.appliedItemCount} applied, ${payload.adoption.summary.pendingItemCount} pending, ${payload.adoption.summary.blockedItemCount} blocked`);
  const next = payload.adoption.nextCommand;
  if (next) {
    console.log(`Next: ${next}`);
  }
}

function verifyImportAdoptionReceipts(projectRoot, receipts) {
  const topogramRoot = normalizeTopogramPath(projectRoot);
  const files = [];
  for (const receipt of receipts || []) {
    const hashedFiles = Array.isArray(receipt.writtenFileHashes) ? receipt.writtenFileHashes : [];
    const hashedPaths = new Set(hashedFiles.map((item) => item.path));
    for (const item of hashedFiles) {
      const relativePath = item.path;
      const filePath = path.join(topogramRoot, relativePath);
      if (!fs.existsSync(filePath)) {
        files.push({
          receiptTimestamp: receipt.timestamp || null,
          selector: receipt.selector || null,
          path: relativePath,
          status: "removed",
          expectedSha256: item.sha256 || null,
          currentSha256: null,
          expectedSize: item.size ?? null,
          currentSize: null
        });
        continue;
      }
      const currentHash = projectFileHash(filePath);
      const matches = item.sha256 === currentHash.sha256 && item.size === currentHash.size;
      files.push({
        receiptTimestamp: receipt.timestamp || null,
        selector: receipt.selector || null,
        path: relativePath,
        status: matches ? "matched" : "changed",
        expectedSha256: item.sha256 || null,
        currentSha256: currentHash.sha256,
        expectedSize: item.size ?? null,
        currentSize: currentHash.size
      });
    }
    for (const relativePath of receipt.writtenFiles || []) {
      if (hashedPaths.has(relativePath)) {
        continue;
      }
      files.push({
        receiptTimestamp: receipt.timestamp || null,
        selector: receipt.selector || null,
        path: relativePath,
        status: "unverifiable",
        expectedSha256: null,
        currentSha256: null,
        expectedSize: null,
        currentSize: null
      });
    }
  }
  const summary = {
    checkedFileCount: files.length,
    matchedFileCount: files.filter((item) => item.status === "matched").length,
    changedFileCount: files.filter((item) => item.status === "changed").length,
    removedFileCount: files.filter((item) => item.status === "removed").length,
    unverifiableFileCount: files.filter((item) => item.status === "unverifiable").length
  };
  const status = summary.changedFileCount > 0 || summary.removedFileCount > 0
    ? "changed"
    : summary.unverifiableFileCount > 0
      ? "unverifiable"
      : "matched";
  return {
    status,
    summary,
    files,
    auditOnly: true,
    note: "History verification is audit-only. Imported/adopted Topogram files are project-owned, and edits do not make the workspace invalid."
  };
}

export function buildBrownfieldImportHistoryPayload(inputPath, options = {}) {
  const projectRoot = normalizeProjectRoot(inputPath);
  const historyPath = importAdoptionsPath(projectRoot);
  const receipts = readImportAdoptionReceipts(projectRoot);
  const forcedWrites = receipts.filter((receipt) => receipt.forced);
  const verification = options.verify ? verifyImportAdoptionReceipts(projectRoot, receipts) : null;
  return {
    ok: true,
    projectRoot,
    path: historyPath,
    exists: fs.existsSync(historyPath),
    verified: Boolean(options.verify),
    summary: {
      receiptCount: receipts.length,
      writeCount: receipts.filter((receipt) => receipt.mode === "write").length,
      forcedWriteCount: forcedWrites.length,
      lastTimestamp: receipts[receipts.length - 1]?.timestamp || null,
      lastSelector: receipts[receipts.length - 1]?.selector || null
    },
    verification,
    receipts
  };
}

export function printBrownfieldImportHistory(payload) {
  console.log(`Import adoption history for ${payload.projectRoot}`);
  console.log(`Receipts: ${payload.summary.receiptCount}`);
  console.log(`Forced writes: ${payload.summary.forcedWriteCount}`);
  if (!payload.exists) {
    console.log(`No history file found at ${payload.path}.`);
    return;
  }
  for (const receipt of payload.receipts) {
    const forced = receipt.forced ? " forced" : "";
    const reason = receipt.reason ? ` reason="${receipt.reason}"` : "";
    console.log(`- ${receipt.timestamp}: ${receipt.selector}${forced}, ${receipt.writtenFiles?.length || 0} file(s), source=${receipt.sourceProvenance?.status || "unknown"}${reason}`);
  }
  if (payload.verification) {
    const summary = payload.verification.summary;
    console.log("");
    console.log(`Verification: ${payload.verification.status}`);
    console.log(`Matched: ${summary.matchedFileCount}; changed: ${summary.changedFileCount}; removed: ${summary.removedFileCount}; unverifiable: ${summary.unverifiableFileCount}`);
    for (const file of payload.verification.files.filter((item) => item.status !== "matched")) {
      console.log(`- ${file.path}: ${file.status}`);
    }
    console.log(payload.verification.note);
  }
}
