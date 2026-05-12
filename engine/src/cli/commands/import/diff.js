// @ts-check

import { importProjectCommandPath } from "./paths.js";
import { buildBrownfieldImportRefreshAnalysis } from "./refresh.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} inputPath
 * @param {{ sourcePath?: string|null }} [options]
 * @returns {AnyRecord}
 */
export function buildBrownfieldImportDiffPayload(inputPath, options = {}) {
  const analysis = buildBrownfieldImportRefreshAnalysis(inputPath, options);
  return {
    ok: true,
    projectRoot: analysis.projectRoot,
    workspaceRoot: analysis.topogramRoot,
    topogramRoot: analysis.topogramRoot,
    sourcePath: analysis.sourcePath,
    provenancePath: analysis.provenancePath,
    extractStatus: analysis.previousImportStatus,
    sourceDiff: analysis.sourceDiff,
    tracks: analysis.tracks,
    sourceFiles: analysis.sourceFiles,
    candidateCounts: analysis.candidateCounts,
    candidateCountDeltas: analysis.candidateCountDeltas,
    adoptionPlanDeltas: analysis.adoptionPlanDeltas,
    receiptVerification: analysis.receiptVerification,
    plannedFiles: analysis.plannedFiles,
    nextCommands: [
      `topogram extract refresh ${importProjectCommandPath(analysis.projectRoot)} --dry-run`,
      `topogram extract refresh ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram extract plan ${importProjectCommandPath(analysis.projectRoot)}`
    ]
  };
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportDiffPayload>} payload
 * @returns {void}
 */
export function printBrownfieldImportDiff(payload) {
  console.log(`Extraction diff for ${payload.projectRoot}`);
  console.log(`Source: ${payload.sourcePath}`);
  console.log(`Source status: ${payload.extractStatus}`);
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
