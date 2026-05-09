// @ts-check
import {
  buildAdoptionStatusFiles as buildAdoptionStatusFilesReport,
  buildAdoptionStatusSummary as buildAdoptionStatusSummaryReport
} from "../../adoption/reporting.js";
import { selectNextBundle } from "../../adoption/review-groups.js";
import {
  formatDocDriftSummaryInline,
  formatDocLinkSuggestionInline,
  formatDocMetadataPatchInline,
  reconcileWorkflow
} from "../reconcile/index.js";
import { normalizeWorkspacePaths } from "../shared.js";

/** @param {string} inputPath @returns {any} */
export function adoptionStatusWorkflow(inputPath) {
  const reconcile = reconcileWorkflow(inputPath);
  const report = reconcile.summary;
  const summary = buildAdoptionStatusSummaryReport(report, selectNextBundle);
  const files = buildAdoptionStatusFilesReport(summary, formatDocLinkSuggestionInline, formatDocDriftSummaryInline, formatDocMetadataPatchInline);
  return {
    summary,
    files,
    defaultOutDir: normalizeWorkspacePaths(inputPath).topogramRoot
  };
}
