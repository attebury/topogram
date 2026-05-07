// @ts-check

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import {
  loadPackageGeneratorManifest,
  validateGeneratorManifest
} from "./registry.js";

/**
 * @typedef {import("./registry.js").GeneratorManifest} GeneratorManifest
 */

/**
 * @typedef {Object} GeneratorCheckResult
 * @property {boolean} ok
 * @property {string} sourceSpec
 * @property {"path"|"package"} source
 * @property {string|null} packageName
 * @property {string|null} packageRoot
 * @property {string|null} manifestPath
 * @property {GeneratorManifest|null} manifest
 * @property {Array<{ name: string, ok: boolean, message: string }>} checks
 * @property {string[]} errors
 * @property {{ files: number, artifacts: number, diagnostics: number }|null} smoke
 * @property {boolean} executesPackageCode
 */

/**
 * @param {string} spec
 * @param {string} cwd
 * @returns {boolean}
 */
function isPathSpec(spec, cwd) {
  return spec.startsWith(".") || spec.startsWith("/") || fs.existsSync(path.resolve(cwd, spec));
}

/**
 * @param {string} spec
 * @returns {string}
 */
function packageNameFromSpec(spec) {
  if (spec.startsWith("@")) {
    const versionIndex = spec.indexOf("@", 1);
    return versionIndex > 0 ? spec.slice(0, versionIndex) : spec;
  }
  const versionIndex = spec.indexOf("@");
  return versionIndex > 0 ? spec.slice(0, versionIndex) : spec;
}

/**
 * @param {any} moduleValue
 * @param {string|null|undefined} exportName
 * @returns {any}
 */
function selectPackageExport(moduleValue, exportName) {
  if (exportName) {
    return moduleValue?.[exportName] || moduleValue?.default?.[exportName] || null;
  }
  return moduleValue?.default || moduleValue;
}

/**
 * @param {string} root
 * @param {GeneratorManifest} manifest
 * @returns {{ adapter: any|null, error: string|null }}
 */
function loadLocalAdapter(root, manifest) {
  try {
    const packageJsonPath = path.join(root, "package.json");
    const requireFromPackage = createRequire(packageJsonPath);
    return {
      adapter: selectPackageExport(requireFromPackage(root), manifest.export),
      error: null
    };
  } catch (error) {
    return {
      adapter: null,
      error: `Generator package export could not be loaded from '${root}': ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * @param {string} packageName
 * @param {string} rootDir
 * @param {GeneratorManifest} manifest
 * @returns {{ adapter: any|null, error: string|null }}
 */
function loadInstalledAdapter(packageName, rootDir, manifest) {
  try {
    const requireFromRoot = createRequire(path.join(rootDir, "package.json"));
    return {
      adapter: selectPackageExport(requireFromRoot(packageName), manifest.export),
      error: null
    };
  } catch (error) {
    return {
      adapter: null,
      error: `Generator package '${packageName}' export could not be loaded from '${rootDir}': ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * @param {GeneratorManifest} manifest
 * @returns {Record<string, any>}
 */
function smokeProjection(manifest) {
  const type = manifest.projectionTypes[0] || "";
  if (manifest.surface === "api") {
    return {
      id: "proj_generator_check_api",
      type: "api_contract",
      endpoints: [{ method: "GET", path: "/generator-check", capabilityId: "cap_generator_check", success: 200 }]
    };
  }
  return {
    id: `proj_generator_check_${manifest.surface}`,
    type
  };
}

/**
 * @param {GeneratorManifest} manifest
 * @param {Record<string, any>} projection
 * @returns {Record<string, any>}
 */
function smokeContracts(manifest, projection) {
  if (manifest.surface === "web" || manifest.surface === "native") {
    return {
      uiSurface: {
        projection: { id: projection.id, type: projection.type },
        appShell: { brand: "Generator Check" },
        screens: [
          { id: "screen_generator_check_home", title: "Generator Check", route: "/" },
          { id: "screen_generator_check_detail", title: "Generator Detail", route: "/detail" }
        ],
        navigation: {
          items: [{ screenId: "screen_generator_check_home", label: "Home" }]
        }
      },
      api: { projections: [] }
    };
  }
  if (manifest.surface === "api") {
    return {
      server: {
        projection: { id: projection.id, type: "api_contract" },
        routes: projection.endpoints,
        preconditions: [],
        responses: []
      },
      api: { projections: [{ id: projection.id, endpoints: projection.endpoints }] }
    };
  }
  if (manifest.surface === "database") {
    return {
      db: {
        projection: { id: projection.id, type: projection.type },
        tables: []
      },
      lifecyclePlan: {
        projection: { id: projection.id, type: projection.type },
        migrations: [],
        seeds: []
      }
    };
  }
  return {};
}

/**
 * @param {GeneratorManifest} manifest
 * @returns {Record<string, any>}
 */
function smokeComponent(manifest) {
  const runtimeKindBySurface = {
    api: "api_service",
    web: "web_surface",
    native: "ios_surface",
    database: "database"
  };
  return {
    id: `runtime_generator_check_${manifest.surface}`,
    kind: runtimeKindBySurface[manifest.surface] || manifest.surface,
    type: manifest.surface,
    projection: `proj_generator_check_${manifest.surface}`,
    generator: {
      id: manifest.id,
      version: manifest.version,
      ...(manifest.package ? { package: manifest.package } : {})
    },
    port: manifest.surface === "database" ? 5432 : manifest.surface === "api" ? 3000 : 5173
  };
}

/**
 * @param {any} result
 * @returns {{ ok: boolean, message: string, smoke: GeneratorCheckResult["smoke"] }}
 */
function validateSmokeResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { ok: false, message: "generate(context) must return an object", smoke: null };
  }
  if (!result.files || typeof result.files !== "object" || Array.isArray(result.files)) {
    return { ok: false, message: "generate(context) result must include a files object", smoke: null };
  }
  for (const [filePath, content] of Object.entries(result.files)) {
    const normalizedPath = typeof filePath === "string" ? path.normalize(filePath) : "";
    if (typeof filePath !== "string" || filePath.length === 0 || path.isAbsolute(filePath) || normalizedPath === ".." || normalizedPath.startsWith(`..${path.sep}`)) {
      return { ok: false, message: "generated file paths must be non-empty relative paths", smoke: null };
    }
    if (typeof content !== "string") {
      return { ok: false, message: `generated file '${filePath}' content must be a string`, smoke: null };
    }
  }
  return {
    ok: true,
    message: `generate(context) returned ${Object.keys(result.files).length} file(s)`,
    smoke: {
      files: Object.keys(result.files).length,
      artifacts: result.artifacts && typeof result.artifacts === "object" && !Array.isArray(result.artifacts) ? Object.keys(result.artifacts).length : 0,
      diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics.length : 0
    }
  };
}

/**
 * @param {string} sourceSpec
 * @param {{ cwd?: string }} [options]
 * @returns {GeneratorCheckResult}
 */
export function checkGeneratorPack(sourceSpec, options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  /** @type {GeneratorCheckResult} */
  const payload = {
    ok: false,
    sourceSpec,
    source: isPathSpec(sourceSpec, cwd) ? "path" : "package",
    packageName: null,
    packageRoot: null,
    manifestPath: null,
    manifest: null,
    checks: [],
    errors: [],
    smoke: null,
    executesPackageCode: true
  };

  /** @type {any|null} */
  let adapter = null;

  if (payload.source === "path") {
    const packageRoot = path.resolve(cwd, sourceSpec);
    payload.packageRoot = packageRoot;
    payload.manifestPath = path.join(packageRoot, "topogram-generator.json");
    if (!fs.existsSync(packageRoot) || !fs.statSync(packageRoot).isDirectory()) {
      payload.errors.push(`Generator path '${packageRoot}' must be a directory.`);
      payload.checks.push({ name: "package-root", ok: false, message: payload.errors[payload.errors.length - 1] });
      return payload;
    }
    if (!fs.existsSync(payload.manifestPath)) {
      payload.errors.push(`Generator path '${packageRoot}' is missing topogram-generator.json.`);
      payload.checks.push({ name: "manifest-present", ok: false, message: payload.errors[payload.errors.length - 1] });
      return payload;
    }
    payload.checks.push({ name: "manifest-present", ok: true, message: payload.manifestPath });
    try {
      payload.manifest = JSON.parse(fs.readFileSync(payload.manifestPath, "utf8"));
      payload.packageName = payload.manifest?.package || null;
    } catch (error) {
      payload.errors.push(`Generator manifest could not be read: ${error instanceof Error ? error.message : String(error)}`);
      payload.checks.push({ name: "manifest-json", ok: false, message: payload.errors[payload.errors.length - 1] });
      return payload;
    }
    payload.checks.push({ name: "manifest-json", ok: true, message: "Manifest JSON parsed." });
  } else {
    const packageName = packageNameFromSpec(sourceSpec);
    payload.packageName = packageName;
    const loaded = loadPackageGeneratorManifest(packageName, cwd);
    payload.manifest = loaded.manifest;
    payload.manifestPath = loaded.manifestPath;
    payload.packageRoot = loaded.packageRoot;
    if (!loaded.manifest) {
      payload.errors.push(...loaded.errors);
      payload.checks.push({ name: "manifest-load", ok: false, message: loaded.errors.join(" ") || `Could not load ${packageName}.` });
      return payload;
    }
    payload.checks.push({ name: "manifest-load", ok: true, message: loaded.manifestPath || packageName });
  }

  const manifestValidation = validateGeneratorManifest(payload.manifest);
  payload.checks.push({
    name: "manifest-schema",
    ok: manifestValidation.ok,
    message: manifestValidation.ok ? "Manifest schema is valid." : manifestValidation.errors.join(" ")
  });
  if (!manifestValidation.ok || !payload.manifest) {
    payload.errors.push(...manifestValidation.errors);
    return payload;
  }

  if (payload.source === "path") {
    const loaded = loadLocalAdapter(payload.packageRoot || cwd, payload.manifest);
    adapter = loaded.adapter;
    if (loaded.error) {
      payload.errors.push(loaded.error);
      payload.checks.push({ name: "adapter-load", ok: false, message: loaded.error });
      return payload;
    }
  } else if (payload.packageName) {
    const loaded = loadInstalledAdapter(payload.packageName, cwd, payload.manifest);
    adapter = loaded.adapter;
    if (loaded.error) {
      payload.errors.push(loaded.error);
      payload.checks.push({ name: "adapter-load", ok: false, message: loaded.error });
      return payload;
    }
  }

  if (!adapter || typeof adapter.generate !== "function") {
    const message = "Generator package must export an adapter with generate(context).";
    payload.errors.push(message);
    payload.checks.push({ name: "adapter-shape", ok: false, message });
    return payload;
  }
  if (!adapter.manifest || adapter.manifest.id !== payload.manifest.id || adapter.manifest.version !== payload.manifest.version) {
    const message = "Generator adapter must export manifest matching topogram-generator.json.";
    payload.errors.push(message);
    payload.checks.push({ name: "adapter-manifest", ok: false, message });
    return payload;
  }
  payload.checks.push({ name: "adapter-shape", ok: true, message: "Adapter exports manifest and generate(context)." });

  try {
    const projection = smokeProjection(payload.manifest);
    const result = adapter.generate({
      graph: {},
      projection,
      component: smokeComponent(payload.manifest),
      topology: { components: [] },
      contracts: smokeContracts(payload.manifest, projection),
      implementation: null,
      options: { check: true },
      manifest: payload.manifest
    });
    const smoke = validateSmokeResult(result);
    payload.checks.push({ name: "smoke-generate", ok: smoke.ok, message: smoke.message });
    payload.smoke = smoke.smoke;
    if (!smoke.ok) {
      payload.errors.push(smoke.message);
    }
  } catch (error) {
    const message = `generate(context) smoke failed: ${error instanceof Error ? error.message : String(error)}`;
    payload.errors.push(message);
    payload.checks.push({ name: "smoke-generate", ok: false, message });
  }

  payload.ok = payload.errors.length === 0 && payload.checks.every((check) => check.ok);
  return payload;
}
