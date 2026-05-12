// @ts-check

import { parsePath } from "../../../parser.js";
import {
  loadProjectConfig,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "../../../project-config.js";
import { resolveWorkspace } from "../../../resolver.js";
import { validateProjectImplementationTrust } from "../../../template-trust.js";
import { buildTopogramImportStatus } from "../../../import/provenance.js";
import {
  checkSummaryPayload,
  combineProjectValidationResults,
  normalizeProjectRoot,
  normalizeTopogramPath
} from "./paths.js";

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} inputPath
 * @returns {ReturnType<typeof checkSummaryPayload>}
 */
export function buildTopogramCheckPayloadForPath(inputPath) {
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
 * @returns {{ ok: boolean, projectRoot: string, workspaceRoot: string, extract: ReturnType<typeof buildTopogramImportStatus>, topogram: ReturnType<typeof buildTopogramCheckPayloadForPath>, errors: any[] }}
 */
export function buildBrownfieldImportCheckPayload(projectRoot) {
  const resolvedRoot = normalizeProjectRoot(projectRoot);
  const importStatus = buildTopogramImportStatus(resolvedRoot);
  const topogramCheck = buildTopogramCheckPayloadForPath(resolvedRoot);
  return {
    ok: importStatus.ok && topogramCheck.ok,
    projectRoot: resolvedRoot,
    workspaceRoot: normalizeTopogramPath(resolvedRoot),
    extract: importStatus,
    topogram: topogramCheck,
    errors: [
      ...(importStatus.errors || []).map((/** @type {string} */ message) => ({ source: "extract", message })),
      ...(topogramCheck.errors || [])
    ]
  };
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportCheckPayload>} payload
 * @returns {void}
 */
export function printBrownfieldImportCheck(payload) {
  console.log(`Topogram extract check: ${payload.extract.status}`);
  console.log(`Project: ${payload.projectRoot}`);
  if (payload.extract.source?.source?.path) {
    console.log(`Extracted source: ${payload.extract.source.source.path}`);
  }
  console.log(`Provenance: ${payload.extract.path}`);
  if (payload.extract.source?.files) {
    console.log(`Trusted source files: ${payload.extract.source.files.length}`);
  }
  if (payload.extract.status === "changed") {
    console.log(`Changed source files: ${payload.extract.content.changed.length}`);
    console.log(`Added source files: ${payload.extract.content.added.length}`);
    console.log(`Removed source files: ${payload.extract.content.removed.length}`);
  }
  console.log(`Topogram check: ${payload.topogram.ok ? "passed" : "failed"}`);
  console.log("Extracted Topogram artifacts are project-owned; extract check compares only the brownfield source hashes trusted at extraction time plus normal Topogram validity.");
  for (const diagnostic of payload.extract.diagnostics || []) {
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
