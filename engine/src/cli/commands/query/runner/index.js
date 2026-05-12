// @ts-check

import { runArtifactQuery } from "./artifacts.js";
import { runBoundaryQuery } from "./boundaries.js";
import { runChangeQuery } from "./change.js";
import { runImportAdoptQuery } from "./extract-adopt.js";
import { runWorkflowQuery } from "./workflow.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {AnyRecord} context
 * @returns {Promise<number|null>}
 */
export async function runQueryCommand(context) {
  for (const handler of [
    runArtifactQuery,
    runBoundaryQuery,
    runChangeQuery,
    runWorkflowQuery,
    runImportAdoptQuery
  ]) {
    const result = handler(context);
    if (result !== null) {
      return result;
    }
  }
  return null;
}
