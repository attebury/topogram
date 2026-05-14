// @ts-check

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  isPathSpec,
  loadInstalledPackageAdapter,
  loadLocalPackageAdapter,
  packageNameFromSpec
} from "../package-adapters/index.js";
import {
  EXTRACTOR_MANIFESTS,
  getExtractorManifest,
  loadPackageExtractorManifest,
  validateExtractorManifest
} from "./registry.js";
import {
  effectiveExtractorPolicy,
  extractorPackageAllowed,
  extractorPolicyDiagnosticsForPackages,
  loadExtractorPolicy
} from "../extractor-policy.js";
import { createImportContext } from "../import/core/context.js";
import { getBundledExtractorById, getBundledExtractorPack } from "../import/core/registry.js";

/**
 * @typedef {import("./registry.js").ExtractorManifest} ExtractorManifest
 */

/**
 * @param {string} packageRoot
 * @returns {string|null}
 */
function packageNameForRoot(packageRoot) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return typeof packageJson.name === "string" && packageJson.name.length > 0 ? packageJson.name : null;
  } catch {
    return null;
  }
}

/**
 * @param {any} adapter
 * @param {ExtractorManifest} manifest
 * @returns {{ extractors: any[], errors: string[] }}
 */
export function validateExtractorAdapter(adapter, manifest) {
  const errors = [];
  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
    return { extractors: [], errors: ["Extractor adapter must export an object."] };
  }
  const adapterManifest = adapter.manifest;
  if (!adapterManifest || adapterManifest.id !== manifest.id || adapterManifest.version !== manifest.version) {
    errors.push("Extractor adapter must export manifest matching topogram-extractor.json.");
  }
  if (!Array.isArray(adapter.extractors) || adapter.extractors.length === 0) {
    errors.push("Extractor adapter must export a non-empty extractors array.");
  }
  const manifestExtractorIds = new Set(manifest.extractors || []);
  const manifestTracks = new Set(manifest.tracks || []);
  const extractors = Array.isArray(adapter.extractors) ? adapter.extractors : [];
  for (const extractor of extractors) {
    if (!extractor || typeof extractor !== "object") {
      errors.push("Extractor entries must be objects.");
      continue;
    }
    if (typeof extractor.id !== "string" || extractor.id.length === 0) {
      errors.push("Extractor entries must have a non-empty id.");
    } else if (!manifestExtractorIds.has(extractor.id)) {
      errors.push(`Extractor '${extractor.id}' is not declared by manifest extractors.`);
    }
    if (typeof extractor.track !== "string" || !manifestTracks.has(extractor.track)) {
      errors.push(`Extractor '${extractor.id || "unknown"}' has track '${extractor.track || "unknown"}' not declared by manifest tracks.`);
    }
    if (typeof extractor.detect !== "function") {
      errors.push(`Extractor '${extractor.id || "unknown"}' must expose detect(context).`);
    }
    if (typeof extractor.extract !== "function") {
      errors.push(`Extractor '${extractor.id || "unknown"}' must expose extract(context).`);
    }
  }
  return { extractors, errors };
}

/**
 * @param {string} sourceSpec
 * @param {{ cwd?: string }} [options]
 * @returns {{ source: "path"|"package", packageName: string|null, packageRoot: string|null, manifestPath: string|null, manifest: ExtractorManifest|null, errors: string[] }}
 */
export function loadExtractorPackageManifestForSpec(sourceSpec, options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  if (isPathSpec(sourceSpec, cwd)) {
    const packageRoot = path.resolve(cwd, sourceSpec);
    const manifestPath = path.join(packageRoot, "topogram-extractor.json");
    if (!fs.existsSync(packageRoot) || !fs.statSync(packageRoot).isDirectory()) {
      return { source: "path", packageName: null, packageRoot, manifestPath, manifest: null, errors: [`Extractor path '${packageRoot}' must be a directory.`] };
    }
    if (!fs.existsSync(manifestPath)) {
      return { source: "path", packageName: packageNameForRoot(packageRoot), packageRoot, manifestPath, manifest: null, errors: [`Extractor path '${packageRoot}' is missing topogram-extractor.json.`] };
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const validation = validateExtractorManifest(manifest);
      return {
        source: "path",
        packageName: typeof manifest.package === "string" ? manifest.package : packageNameForRoot(packageRoot),
        packageRoot,
        manifestPath,
        manifest: validation.ok ? manifest : null,
        errors: validation.errors
      };
    } catch (error) {
      return {
        source: "path",
        packageName: packageNameForRoot(packageRoot),
        packageRoot,
        manifestPath,
        manifest: null,
        errors: [`Extractor manifest could not be read: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  const packageName = packageNameFromSpec(sourceSpec);
  const loaded = loadPackageExtractorManifest(packageName, cwd);
  return {
    source: "package",
    packageName,
    packageRoot: loaded.packageRoot,
    manifestPath: loaded.manifestPath,
    manifest: loaded.manifest,
    errors: loaded.errors
  };
}

/**
 * @param {string} sourceSpec
 * @param {{ cwd?: string }} [options]
 * @returns {{ adapter: any|null, source: "path"|"package", packageName: string|null, packageRoot: string|null, manifestPath: string|null, manifest: ExtractorManifest|null, errors: string[] }}
 */
export function loadExtractorPackageAdapterForSpec(sourceSpec, options = {}) {
  const loadedManifest = loadExtractorPackageManifestForSpec(sourceSpec, options);
  if (!loadedManifest.manifest) {
    return { ...loadedManifest, adapter: null };
  }
  const loadedAdapter = loadedManifest.source === "path"
    ? loadLocalPackageAdapter({
        packageRoot: loadedManifest.packageRoot || path.resolve(options.cwd || process.cwd(), sourceSpec),
        exportName: loadedManifest.manifest.export,
        packageLabel: "Extractor package"
      })
    : loadInstalledPackageAdapter({
        packageName: loadedManifest.packageName || packageNameFromSpec(sourceSpec),
        rootDir: path.resolve(options.cwd || process.cwd()),
        exportName: loadedManifest.manifest.export,
        packageLabel: "Extractor package"
      });
  return {
    ...loadedManifest,
    adapter: loadedAdapter.adapter,
    errors: [...loadedManifest.errors, ...(loadedAdapter.error ? [loadedAdapter.error] : [])]
  };
}

/**
 * @param {string} packageName
 * @param {string} version
 * @returns {import("../extractor-policy.js").PackageExtractorBinding}
 */
function packageBinding(packageName, version) {
  return {
    packageName,
    version
  };
}

/**
 * @param {any} context
 * @returns {any}
 */
function packageExtractorContext(context) {
  return {
    paths: context.paths,
    options: context.options || {},
    priorResults: context.priorResults || {},
    scanDocsSummary: context.scanDocsSummary || null,
    helpers: {
      path: context.helpers?.path,
      readTextIfExists: context.helpers?.readTextIfExists,
      readJsonIfExists: context.helpers?.readJsonIfExists
    }
  };
}

/**
 * @param {any} context
 * @returns {{ extractors: any[], diagnostics: any[], provenance: any[] }}
 */
export function packageExtractorsForContext(context) {
  if (context.packageExtractorState) {
    return context.packageExtractorState;
  }
  const cwd = path.resolve(context.options?.cwd || process.cwd());
  const policyInfo = loadExtractorPolicy(cwd, context.options?.extractorPolicyPath || null);
  const policy = effectiveExtractorPolicy(policyInfo);
  const specs = [
    ...(Array.isArray(policy.enabledPackages) ? policy.enabledPackages : []),
    ...(Array.isArray(context.options?.extractorSpecs) ? context.options.extractorSpecs : [])
  ].filter(Boolean);
  /** @type {any[]} */
  const extractors = [];
  /** @type {any[]} */
  const diagnostics = [...policyInfo.diagnostics];
  /** @type {any[]} */
  const provenance = [];
  const seen = new Set();

  for (const spec of specs) {
    if (seen.has(spec)) continue;
    seen.add(spec);
    const bundledPack = getBundledExtractorPack(spec);
    if (bundledPack) {
      extractors.push(...bundledPack.extractors);
      provenance.push({
        source: "bundled",
        id: bundledPack.manifest.id,
        version: bundledPack.manifest.version,
        tracks: bundledPack.manifest.tracks || [],
        extractors: bundledPack.manifest.extractors
      });
      continue;
    }
    const bundledExtractor = getBundledExtractorById(spec);
    if (bundledExtractor) {
      extractors.push(bundledExtractor);
      provenance.push({ source: "bundled", id: bundledExtractor.id, version: "1", tracks: bundledExtractor.track ? [bundledExtractor.track] : [], extractors: [bundledExtractor.id] });
      continue;
    }
    const packageManifest = loadExtractorPackageManifestForSpec(spec, { cwd });
    if (!packageManifest.manifest) {
      diagnostics.push({ severity: "error", code: "extractor_package_manifest_failed", message: packageManifest.errors.join(" "), packageName: packageManifest.packageName, spec });
      continue;
    }
    const packageName = packageManifest.packageName || packageManifest.manifest.package || spec;
    const policyDiagnostics = extractorPolicyDiagnosticsForPackages(policyInfo, [packageBinding(packageName, packageManifest.manifest.version)], "extractor-policy");
    const errors = policyDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
    diagnostics.push(...policyDiagnostics);
    if (errors.length > 0 || !extractorPackageAllowed(policy, packageName)) {
      continue;
    }
    const adapter = loadExtractorPackageAdapterForSpec(spec, { cwd });
    if (!adapter.adapter || adapter.errors.length > 0) {
      diagnostics.push(...adapter.errors.map((message) => ({ severity: "error", code: "extractor_package_load_failed", message, packageName, spec })));
      continue;
    }
    const adapterValidation = validateExtractorAdapter(adapter.adapter, packageManifest.manifest);
    if (adapterValidation.errors.length > 0) {
      diagnostics.push(...adapterValidation.errors.map((message) => ({ severity: "error", code: "extractor_adapter_invalid", message, packageName, spec })));
      continue;
    }
    for (const extractor of adapterValidation.extractors) {
      extractors.push({
        ...extractor,
        source: "package",
        manifestId: packageManifest.manifest.id,
        packageName,
        packageContext: packageExtractorContext
      });
    }
    provenance.push({
      source: "package",
      id: packageManifest.manifest.id,
      version: packageManifest.manifest.version,
      packageName,
      tracks: packageManifest.manifest.tracks || [],
      manifestPath: packageManifest.manifestPath,
      packageRoot: packageManifest.packageRoot,
      extractors: packageManifest.manifest.extractors
    });
  }

  context.packageExtractorState = { extractors, diagnostics, provenance };
  return context.packageExtractorState;
}

/**
 * @returns {any}
 */
export function createExtractorSmokeContext() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-extractor-check."));
  fs.writeFileSync(path.join(root, "package.json"), "{\"scripts\":{\"check\":\"topogram check\"}}\n", "utf8");
  return packageExtractorContext(createImportContext(root, { from: "cli" }));
}

export { EXTRACTOR_MANIFESTS, getExtractorManifest };
