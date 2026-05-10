// @ts-check

import { createImportContext } from "../context.js";
import { enrichUiWidgetDataSources } from "./candidates.js";
import { parseImportTracks } from "./options.js";
import { appReportMarkdown, reportMarkdown } from "./reports.js";
import { runTrack } from "./tracks.js";
import { draftUiProjectionFiles } from "./ui-drafts.js";

/**
 * @param {string} inputPath
 * @param {Record<string, any>} [options]
 * @returns {{ summary: any, files: Record<string, string>, defaultOutDir: string }}
 */
export function runImportApp(inputPath, options = {}) {
  const tracks = parseImportTracks(options.from);
  const context = createImportContext(inputPath, options);
  /** @type {Record<string, ReturnType<typeof runTrack>>} */
  const resultsByTrack = {};
  context.priorResults = resultsByTrack;
  context.scanDocsSummary = options.scanDocsSummary || null;
  /** @type {Record<string, any[]>} */
  const findings = {};
  /** @type {Record<string, any>} */
  const candidates = {};
  /** @type {Record<string, string>} */
  const files = {};

  for (const track of tracks) {
    if (track === "workflows") {
      if (!resultsByTrack.db) {
        resultsByTrack.db = runTrack(context, "db");
      }
      if (!resultsByTrack.api) {
        resultsByTrack.api = runTrack(context, "api");
      }
    }
    if (track === "verification") {
      if (!resultsByTrack.api) {
        resultsByTrack.api = runTrack(context, "api");
      }
    }
    const result = runTrack(context, track);
    resultsByTrack[track] = result;
    findings[track] = result.findings;
    candidates[track] = result.candidates;
    files[`candidates/app/${track}/findings.json`] = `${JSON.stringify(result.findings, null, 2)}\n`;
    files[`candidates/app/${track}/candidates.json`] = `${JSON.stringify(result.candidates, null, 2)}\n`;
    files[`candidates/app/${track}/report.md`] = reportMarkdown(track, result.candidates);
  }

  if (candidates.ui) {
    candidates.ui = enrichUiWidgetDataSources(candidates.ui, candidates);
    files["candidates/app/ui/candidates.json"] = `${JSON.stringify(candidates.ui, null, 2)}\n`;
    files["candidates/app/ui/report.md"] = reportMarkdown("ui", candidates.ui);
    Object.assign(files, draftUiProjectionFiles(context, candidates.ui, candidates));
  }

  const summary = {
    type: "import_app_report",
    workspace: context.paths.workspaceRoot,
    topogram_root: context.paths.topogramRoot,
    bootstrapped_topogram_root: context.paths.bootstrappedTopogramRoot,
    tracks,
    findings_count: Object.values(findings).reduce((total, entries) => total + entries.length, 0),
    extractor_detections: Object.fromEntries(Object.entries(resultsByTrack).map(([track, result]) => [track, result.extractor_detections])),
    candidates
  };

  files["candidates/app/findings.json"] = `${JSON.stringify(findings, null, 2)}\n`;
  files["candidates/app/candidates.json"] = `${JSON.stringify(candidates, null, 2)}\n`;
  files["candidates/app/report.md"] = appReportMarkdown(candidates, tracks);

  return {
    summary,
    files,
    defaultOutDir: context.paths.topogramRoot
  };
}
