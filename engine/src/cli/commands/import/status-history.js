// @ts-check

import fs from "node:fs";
import path from "node:path";

import {
  importAdoptionsPath,
  normalizeProjectRoot,
  normalizeTopogramPath,
  projectFileHash,
  readImportAdoptionReceipts
} from "./paths.js";
import { buildBrownfieldImportCheckPayload } from "./check.js";
import { readImportAdoptionArtifacts, summarizeImportAdoption } from "./plan.js";
import { runWorkflow } from "../../../workflows.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} inputPath
 * @returns {AnyRecord}
 */
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

/**
 * @param {AnyRecord} payload
 * @returns {void}
 */
export function printBrownfieldImportStatus(payload) {
  console.log(`Import status: ${payload.import.status}`);
  console.log(`Topogram check: ${payload.topogram.ok ? "passed" : "failed"}`);
  console.log(`Adoption: ${payload.adoption.summary.appliedItemCount} applied, ${payload.adoption.summary.pendingItemCount} pending, ${payload.adoption.summary.blockedItemCount} blocked`);
  const next = payload.adoption.nextCommand;
  if (next) {
    console.log(`Next: ${next}`);
  }
}

/**
 * @param {string} projectRoot
 * @param {AnyRecord[]} receipts
 * @returns {AnyRecord}
 */
export function verifyImportAdoptionReceipts(projectRoot, receipts) {
  const topogramRoot = normalizeTopogramPath(projectRoot);
  const files = [];
  for (const receipt of receipts || []) {
    const hashedFiles = Array.isArray(receipt.writtenFileHashes) ? receipt.writtenFileHashes : [];
    const hashedPaths = new Set(hashedFiles.map((/** @type {AnyRecord} */ item) => item.path));
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

/**
 * @param {string} inputPath
 * @param {{ verify?: boolean }} [options]
 * @returns {AnyRecord}
 */
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

/**
 * @param {AnyRecord} payload
 * @returns {void}
 */
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
    for (const file of payload.verification.files.filter((/** @type {AnyRecord} */ item) => item.status !== "matched")) {
      console.log(`- ${file.path}: ${file.status}`);
    }
    console.log(payload.verification.note);
  }
}
