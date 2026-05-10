// @ts-check

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { stableStringify } from "../../../format.js";
import {
  buildTopogramImportStatus,
  collectImportSourceFileRecords,
  TOPOGRAM_IMPORT_FILE,
  writeTopogramImportRecord
} from "../../../import/provenance.js";
import { runWorkflow } from "../../../workflows.js";
import { DEFAULT_TOPO_FOLDER_NAME } from "../../../workspace-paths.js";
import {
  countByField,
  importProjectCommandPath,
  normalizeProjectRoot,
  normalizeTopogramPath,
  readImportAdoptionReceipts
} from "./paths.js";
import { countFilesRecursive, importCandidateCounts, writeRelativeFiles } from "./workspace.js";
import { verifyImportAdoptionReceipts } from "./status-history.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} projectRoot
 * @returns {{ path: string, record: Record<string, any> }}
 */
export function readTopogramImportRecord(projectRoot) {
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
export function importTrackValueFromRecord(importRecord) {
  const tracks = Array.isArray(importRecord.import?.tracks)
    ? importRecord.import.tracks.map((/** @type {any} */ track) => String(track).trim()).filter(Boolean)
    : [];
  return tracks.length ? [...new Set(tracks)].join(",") : null;
}

/**
 * @param {string} topogramRoot
 * @returns {{ rawCandidateFiles: number, reconcileFiles: number }}
 */
export function clearImportRefreshCandidateArtifacts(topogramRoot) {
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

/**
 * @param {{ changed?: any[], added?: any[], removed?: any[] }} [content]
 * @returns {{ changed: number, added: number, removed: number }}
 */
export function sourceDiffCounts(content = {}) {
  return {
    changed: content.changed?.length || 0,
    added: content.added?.length || 0,
    removed: content.removed?.length || 0
  };
}

/**
 * @param {string} projectRoot
 * @param {AnyRecord} importRecord
 * @param {string} sourceRoot
 * @returns {AnyRecord}
 */
export function compareImportRecordToSource(projectRoot, importRecord, sourceRoot) {
  const trustedFiles = Array.isArray(importRecord.files) ? importRecord.files : [];
  const trustedByPath = new Map(trustedFiles.map((/** @type {AnyRecord} */ file) => [String(file.path), file]));
  const currentFiles = collectImportSourceFileRecords(sourceRoot, { excludeRoots: [projectRoot] });
  const currentByPath = new Map(currentFiles.map((/** @type {AnyRecord} */ file) => [file.path, file]));
  /** @type {string[]} */
  const changed = [];
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
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

/**
 * @param {Record<string, number>} [previous]
 * @param {Record<string, number>} [next]
 * @returns {AnyRecord}
 */
export function buildCountDeltas(previous = {}, next = {}) {
  const keys = [...new Set([...Object.keys(previous || {}), ...Object.keys(next || {})])].sort((a, b) => a.localeCompare(b));
  /** @type {Record<string, { previous: number, next: number, delta: number }>} */
  const deltas = {};
  /** @type {Array<{ key: string, previous: number, next: number, delta: number }>} */
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

/**
 * @param {AnyRecord} item
 * @returns {string}
 */
export function adoptionSurfaceKey(item) {
  return `${item?.bundle || "unbundled"}:${item?.kind || "unknown"}:${item?.item || item?.id || "unknown"}`;
}

/**
 * @param {AnyRecord} item
 * @returns {AnyRecord}
 */
export function summarizeAdoptionSurface(item) {
  return {
    key: adoptionSurfaceKey(item),
    bundle: item?.bundle || "unbundled",
    kind: item?.kind || "unknown",
    item: item?.item || item?.id || "unknown",
    currentState: item?.current_state || null
  };
}

/**
 * @param {AnyRecord[]} [currentSurfaces]
 * @param {AnyRecord[]} [nextSurfaces]
 * @returns {AnyRecord}
 */
export function summarizeAdoptionPlanDeltas(currentSurfaces = [], nextSurfaces = []) {
  const currentByKey = new Map((currentSurfaces || []).map((item) => [adoptionSurfaceKey(item), item]));
  const nextByKey = new Map((nextSurfaces || []).map((item) => [adoptionSurfaceKey(item), item]));
  /** @type {AnyRecord[]} */
  const added = [];
  /** @type {AnyRecord[]} */
  const removed = [];
  /** @type {AnyRecord[]} */
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

/**
 * @param {string|null|undefined} fileContents
 * @returns {AnyRecord[]}
 */
export function adoptionSurfacesFromPlanFile(fileContents) {
  if (!fileContents) {
    return [];
  }
  const parsed = JSON.parse(fileContents);
  return parsed.imported_proposal_surfaces || [];
}

/**
 * @param {string} projectRoot
 * @param {string} topogramRoot
 * @param {Record<string, any>} importFiles
 * @returns {AnyRecord}
 */
export function buildRefreshPreviewReconcile(projectRoot, topogramRoot, importFiles) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-refresh-preview."));
  try {
    const tempProjectRoot = path.join(tempRoot, "workspace");
    const tempTopogramRoot = path.join(tempProjectRoot, DEFAULT_TOPO_FOLDER_NAME);
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

/**
 * @param {string} topogramRoot
 * @returns {AnyRecord[]}
 */
export function readCurrentAdoptionSurfaces(topogramRoot) {
  const planPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
  if (!fs.existsSync(planPath)) {
    return [];
  }
  return adoptionSurfacesFromPlanFile(fs.readFileSync(planPath, "utf8"));
}

/**
 * @param {string} inputPath
 * @param {{ sourcePath?: string|null }} [options]
 * @returns {AnyRecord}
 */
export function buildBrownfieldImportRefreshAnalysis(inputPath, options = {}) {
  const projectRoot = normalizeProjectRoot(inputPath);
  const topogramRoot = normalizeTopogramPath(projectRoot);
  if (!fs.existsSync(topogramRoot) || !fs.statSync(topogramRoot).isDirectory()) {
    throw new Error(`No workspace folder found for imported workspace '${inputPath}'.`);
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
    ...Object.keys(importResult.files || {}).map((filePath) => `${DEFAULT_TOPO_FOLDER_NAME}/${filePath}`),
    ...previewReconcile.reconcileFilePaths.map((/** @type {string} */ filePath) => `${DEFAULT_TOPO_FOLDER_NAME}/${filePath}`)
  ].sort((a, b) => a.localeCompare(b));
  const analysis = /** @type {AnyRecord} */ ({
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
  });
  Object.defineProperty(analysis, "importResult", {
    value: importResult,
    enumerable: false
  });
  return analysis;
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
  /** @type {string[]} */
  let writtenFiles = [];
  /** @type {AnyRecord|null} */
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
      ...rawCandidateFiles.map((filePath) => `${DEFAULT_TOPO_FOLDER_NAME}/${filePath}`),
      ...reconcileFiles.map((filePath) => `${DEFAULT_TOPO_FOLDER_NAME}/${filePath}`)
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
