// @ts-check

import fs from "node:fs";
import path from "node:path";

import { buildTopogramImportStatus } from "../../../import/provenance.js";
import { runWorkflow } from "../../../workflows.js";
import { CLI_PACKAGE_NAME, readInstalledCliPackageVersion } from "../package.js";
import {
  appendImportAdoptionReceipt,
  importAdoptCommand,
  importProjectCommandPath,
  projectFileHash
} from "./paths.js";
import { readImportAdoptionArtifacts } from "./plan.js";
import { writeRelativeFiles } from "./workspace.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} outputRoot
 * @param {string[]} writtenFiles
 * @returns {AnyRecord[]}
 */
export function writtenFileHashesForReceipt(outputRoot, writtenFiles) {
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

/**
 * @param {{ artifacts: AnyRecord, selector: string, options: AnyRecord, importStatus: AnyRecord, summary: AnyRecord, writtenFiles: string[], outputRoot: string }} input
 * @returns {AnyRecord}
 */
export function buildImportAdoptionReceipt({ artifacts, selector, options, importStatus, summary, writtenFiles, outputRoot }) {
  return {
    type: "topogram_adoption_receipt",
    version: "0.1",
    timestamp: new Date().toISOString(),
    cli: {
      packageName: CLI_PACKAGE_NAME,
      version: readInstalledCliPackageVersion()
    },
    projectRoot: artifacts.projectRoot,
    workspaceRoot: artifacts.topogramRoot,
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
    promotedCanonicalItems: (summary.promoted_canonical_items || []).map((/** @type {AnyRecord} */ item) => ({
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

/**
 * @param {string} selector
 * @param {string} inputPath
 * @param {{ write?: boolean, dryRun?: boolean, force?: boolean, reason?: string|null, refreshAdopted?: boolean }} [options]
 * @returns {AnyRecord}
 */
export function buildBrownfieldImportAdoptPayload(selector, inputPath, options = {}) {
  if (!selector) {
    throw new Error("Missing required <selector>. Example: topogram adopt bundle:task --dry-run");
  }
  if (options.write && options.dryRun) {
    throw new Error("Use either --dry-run or --write, not both.");
  }
  if (options.write && options.force && !options.reason) {
    throw new Error("Forced adoption writes require --reason <text>.");
  }
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const importStatus = buildTopogramImportStatus(artifacts.projectRoot);
  if (options.write && !options.force && !importStatus.ok) {
    throw new Error(`Refusing to write adoption because brownfield source provenance is ${importStatus.status}. Run 'topogram extract check ${importProjectCommandPath(artifacts.projectRoot)}', review the changed source evidence, rerun extract, or pass --force --reason <text> after review.`);
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
    workspaceRoot: artifacts.topogramRoot,
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
    extract: importStatus,
    warnings: options.write && options.force && !importStatus.ok
      ? [`Brownfield source provenance is ${importStatus.status}; adoption write was forced with reason: ${options.reason}.`]
      : [],
    nextCommands: options.write
      ? [
          `topogram extract history ${importProjectCommandPath(artifacts.projectRoot)}`,
          `topogram extract status ${importProjectCommandPath(artifacts.projectRoot)}`,
          `topogram check ${importProjectCommandPath(artifacts.projectRoot)}`
        ]
      : [
          importAdoptCommand(artifacts.projectRoot, selector, true),
          `topogram extract status ${importProjectCommandPath(artifacts.projectRoot)}`
        ]
  };
}

/**
 * @param {AnyRecord} payload
 * @returns {void}
 */
export function printBrownfieldImportAdopt(payload) {
  console.log(`${payload.dryRun ? "Previewed" : "Applied"} adoption for ${payload.selector}.`);
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
