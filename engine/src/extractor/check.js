// @ts-check

import {
  createExtractorSmokeContext,
  loadExtractorPackageAdapterForSpec,
  validateExtractorAdapter
} from "./packages.js";

/**
 * @typedef {import("./registry.js").ExtractorManifest} ExtractorManifest
 */

/**
 * @typedef {Object} ExtractorCheckResult
 * @property {boolean} ok
 * @property {string} sourceSpec
 * @property {"path"|"package"} source
 * @property {string|null} packageName
 * @property {string|null} packageRoot
 * @property {string|null} manifestPath
 * @property {ExtractorManifest|null} manifest
 * @property {Array<{ name: string, ok: boolean, message: string }>} checks
 * @property {string[]} errors
 * @property {{ extractors: number, findings: number, candidateKeys: number, diagnostics: number }|null} smoke
 * @property {boolean} executesPackageCode
 */

/**
 * @param {any} result
 * @returns {{ ok: boolean, message: string, smoke: { findings: number, candidateKeys: number, diagnostics: number }|null }}
 */
function validateExtractResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { ok: false, message: "extract(context) must return an object", smoke: null };
  }
  if (result.findings != null && !Array.isArray(result.findings)) {
    return { ok: false, message: "extract(context) findings must be an array when present", smoke: null };
  }
  if (result.diagnostics != null && !Array.isArray(result.diagnostics)) {
    return { ok: false, message: "extract(context) diagnostics must be an array when present", smoke: null };
  }
  if (!result.candidates || typeof result.candidates !== "object" || Array.isArray(result.candidates)) {
    return { ok: false, message: "extract(context) result must include a candidates object", smoke: null };
  }
  for (const [key, value] of Object.entries(result.candidates)) {
    if (!Array.isArray(value)) {
      return { ok: false, message: `extract(context) candidates.${key} must be an array`, smoke: null };
    }
  }
  return {
    ok: true,
    message: `extract(context) returned ${Object.keys(result.candidates).length} candidate bucket(s)`,
    smoke: {
      findings: Array.isArray(result.findings) ? result.findings.length : 0,
      candidateKeys: Object.keys(result.candidates).length,
      diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics.length : 0
    }
  };
}

/**
 * @param {string} sourceSpec
 * @param {{ cwd?: string }} [options]
 * @returns {ExtractorCheckResult}
 */
export function checkExtractorPack(sourceSpec, options = {}) {
  /** @type {ExtractorCheckResult} */
  const payload = {
    ok: false,
    sourceSpec,
    source: "package",
    packageName: null,
    packageRoot: null,
    manifestPath: null,
    manifest: null,
    checks: [],
    errors: [],
    smoke: null,
    executesPackageCode: true
  };
  if (!sourceSpec || sourceSpec.startsWith("-")) {
    payload.errors.push("Usage: topogram extractor check <path-or-package>");
    payload.checks.push({ name: "source", ok: false, message: payload.errors[0] });
    return payload;
  }

  const loaded = loadExtractorPackageAdapterForSpec(sourceSpec, options);
  payload.source = loaded.source;
  payload.packageName = loaded.packageName;
  payload.packageRoot = loaded.packageRoot;
  payload.manifestPath = loaded.manifestPath;
  payload.manifest = loaded.manifest;
  if (!loaded.manifest) {
    payload.errors.push(...loaded.errors);
    payload.checks.push({ name: "manifest-load", ok: false, message: loaded.errors.join(" ") || "Could not load extractor manifest." });
    return payload;
  }
  payload.checks.push({ name: "manifest-load", ok: true, message: loaded.manifestPath || sourceSpec });
  if (!loaded.adapter || loaded.errors.length > 0) {
    payload.errors.push(...loaded.errors);
    payload.checks.push({ name: "adapter-load", ok: false, message: loaded.errors.join(" ") || "Could not load extractor adapter." });
    return payload;
  }
  payload.checks.push({ name: "adapter-load", ok: true, message: "Adapter export loaded." });

  const adapterValidation = validateExtractorAdapter(loaded.adapter, loaded.manifest);
  payload.checks.push({
    name: "adapter-shape",
    ok: adapterValidation.errors.length === 0,
    message: adapterValidation.errors.length === 0 ? "Adapter shape is valid." : adapterValidation.errors.join(" ")
  });
  if (adapterValidation.errors.length > 0) {
    payload.errors.push(...adapterValidation.errors);
    return payload;
  }

  const context = createExtractorSmokeContext();
  let totalFindings = 0;
  let totalCandidateKeys = 0;
  let totalDiagnostics = 0;
  for (const extractor of adapterValidation.extractors) {
    try {
      const detection = extractor.detect(context) || { score: 0, reasons: [] };
      if (!detection || typeof detection !== "object" || typeof detection.score !== "number") {
        payload.errors.push(`Extractor '${extractor.id}' detect(context) must return { score, reasons }.`);
        continue;
      }
      const result = extractor.extract(context) || { findings: [], candidates: {} };
      const validation = validateExtractResult(result);
      if (!validation.ok || !validation.smoke) {
        payload.errors.push(`Extractor '${extractor.id}' ${validation.message}.`);
        continue;
      }
      totalFindings += validation.smoke.findings;
      totalCandidateKeys += validation.smoke.candidateKeys;
      totalDiagnostics += validation.smoke.diagnostics;
    } catch (error) {
      payload.errors.push(`Extractor '${extractor.id}' smoke failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  payload.checks.push({
    name: "smoke-extract",
    ok: payload.errors.length === 0,
    message: payload.errors.length === 0 ? `Ran ${adapterValidation.extractors.length} extractor smoke check(s).` : payload.errors.join(" ")
  });
  payload.smoke = {
    extractors: adapterValidation.extractors.length,
    findings: totalFindings,
    candidateKeys: totalCandidateKeys,
    diagnostics: totalDiagnostics
  };
  payload.ok = payload.errors.length === 0;
  return payload;
}

