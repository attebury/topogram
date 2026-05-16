// @ts-check

import {
  createExtractorSmokeContext,
  loadExtractorPackageAdapterForSpec,
  validateExtractorAdapter
} from "./packages.js";
import { packageMetadataForRoot } from "../package-adapters/index.js";
import { normalizeExtractorResult, validateExtractorResult } from "./output.js";

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
 * @property {string|null} packageVersion
 * @property {string|null} compatibleCliRange
 * @property {Array<{ name: string, ok: boolean, message: string }>} checks
 * @property {string[]} errors
 * @property {{ extractors: number, findings: number, candidateKeys: number, diagnostics: number }|null} smoke
 * @property {boolean} executesPackageCode
 */

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
    packageVersion: null,
    compatibleCliRange: null,
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
  const packageMetadata = packageMetadataForRoot(loaded.packageRoot, "@topogram/cli");
  payload.packageVersion = packageMetadata.version;
  payload.compatibleCliRange = loaded.manifest?.compatibleCliRange || packageMetadata.dependencyRange || null;
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
      const result = normalizeExtractorResult(extractor.extract(context) || { findings: [], candidates: {} }, { track: extractor.track });
      const validation = validateExtractorResult(result, { track: extractor.track, strictCandidates: true });
      if (!validation.ok || !validation.smoke) {
        payload.errors.push(...validation.errors.map((message) => `Extractor '${extractor.id}' ${message}.`));
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
