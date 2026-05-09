// @ts-check
import { runImportAppWorkflow } from "../../import/index.js";
import { scanDocsWorkflow } from "../docs.js";

export { collectApiImport, discoverApiSources } from "./api.js";
export { collectDbImport, discoverDbSources } from "./db.js";
export {
  IMPORT_TRACKS,
  SCALAR_FIELD_TYPES,
  dedupeCandidateRecords,
  findImportFiles,
  importSearchRoots,
  inferCapabilityEntityId,
  makeCandidateRecord,
  normalizeEndpointPathForMatch,
  normalizeImportRelativePath,
  normalizeOpenApiPath,
  parseImportTracks,
  selectPreferredImportFiles
} from "./shared.js";
export { collectUiImport } from "./ui.js";
export { collectWorkflowImport } from "./workflow.js";

/** @param {string} inputPath @param {WorkflowOptions} options @returns {any} */
export function importAppWorkflow(inputPath, options = {}) {
  return runImportAppWorkflow(inputPath, {
    ...options,
    scanDocsSummary: () => scanDocsWorkflow(inputPath).summary
  });
}
