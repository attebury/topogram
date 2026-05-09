import { adoptionStatusWorkflow } from "./workflows/adoption/index.js";
import { generateDocsWorkflow, generateJourneyDraftsWorkflow, refreshDocsWorkflow, scanDocsWorkflow } from "./workflows/docs.js";
import { importAppWorkflow } from "./workflows/import-app/index.js";
import { reconcileWorkflow, reportGapsWorkflow } from "./workflows/reconcile/index.js";

/**
 * @param {string} name
 * @param {string} inputPath
 * @param {Record<string, unknown>} [options]
 */
export function runWorkflow(name, inputPath, options = {}) {
  switch (name) {
    case "scan-docs":
      return scanDocsWorkflow(inputPath);
    case "generate-docs":
      return generateDocsWorkflow(inputPath);
    case "generate-journeys":
      return generateJourneyDraftsWorkflow(inputPath);
    case "refresh-docs":
      return refreshDocsWorkflow(inputPath);
    case "import-app":
      return importAppWorkflow(inputPath, options);
    case "report-gaps":
      return reportGapsWorkflow(inputPath);
    case "reconcile":
      return reconcileWorkflow(inputPath, options);
    case "adoption-status":
      return adoptionStatusWorkflow(inputPath);
    default:
      throw new Error(`Unsupported workflow '${name}'`);
  }
}
