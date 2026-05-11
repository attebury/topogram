// @ts-check

import path from "node:path";
import { createRequire } from "node:module";

import { generateApiContractGraph } from "./api.js";
import {
  getGeneratorManifest,
  packageGeneratorInstallHint,
  resolveGeneratorManifestForBinding,
  validateGeneratorManifest
} from "./registry.js";
import {
  generatorPolicyDiagnosticsForBindings,
  loadGeneratorPolicy
} from "../generator-policy.js";
import { generateDbContractGraph } from "./surfaces/databases/contract.js";
import { generateDbLifecyclePlan } from "./surfaces/databases/lifecycle-shared.js";
import {
  generatePostgresDbLifecycleBundle
} from "./surfaces/databases/postgres/index.js";
import {
  generateSqliteDbLifecycleBundle
} from "./surfaces/databases/sqlite/index.js";
import { generateSwiftUiApp } from "./surfaces/native/swiftui-app.js";
import { generateExpressServer } from "./surfaces/services/express.js";
import { generateHonoServer } from "./surfaces/services/hono.js";
import { generateServerContract } from "./surfaces/services/server-contract.js";
import { generateStatelessServer } from "./surfaces/services/stateless.js";
import { generateReactApp } from "./surfaces/web/react.js";
import { generateSvelteKitApp } from "./surfaces/web/sveltekit.js";
import { generateUiSurfaceContract } from "./surfaces/web/ui-surface-contract.js";
import { generateVanillaWebApp } from "./surfaces/web/vanilla.js";

/**
 * @typedef {import("./registry.js").GeneratorManifest} GeneratorManifest
 */

/**
 * @typedef {Object} GeneratorContext
 * @property {Record<string, any>} graph
 * @property {Record<string, any>} projection
 * @property {Record<string, any>} runtime
 * @property {Record<string, any>} [component] Legacy runtime alias for existing generator packages.
 * @property {Record<string, any>|null} [topology]
 * @property {Record<string, any>} [contracts]
 * @property {Record<string, any>|null} [implementation]
 * @property {Record<string, any>} [options]
 * @property {GeneratorManifest} [manifest]
 */

/**
 * @typedef {Object} GeneratorResult
 * @property {Record<string, string>} files
 * @property {Record<string, any>} [artifacts]
 * @property {Array<Record<string, any>>} [diagnostics]
 */

/**
 * @typedef {Object} GeneratorAdapter
 * @property {GeneratorManifest} manifest
 * @property {(context: GeneratorContext) => GeneratorResult} generate
 */

/**
 * @param {Record<string, string>} files
 * @param {Record<string, any>} [artifacts]
 * @returns {GeneratorResult}
 */
function fileResult(files, artifacts = {}) {
  return { files, artifacts, diagnostics: [] };
}

/**
 * @param {string} generatorId
 * @returns {GeneratorManifest}
 */
function requiredManifest(generatorId) {
  const manifest = getGeneratorManifest(generatorId);
  if (!manifest) {
    throw new Error(`Bundled generator '${generatorId}' is missing its manifest.`);
  }
  return manifest;
}

/**
 * @param {GeneratorContext} context
 * @returns {string}
 */
function runtimeFor(context) {
  return normalizeRuntimeForGenerator(context.runtime || context.component || {});
}

/**
 * Keep package-backed generator context canonical while preserving aliases for already-published adapters.
 *
 * @param {Record<string, any>} runtime
 * @returns {Record<string, any>}
 */
function normalizeRuntimeForGenerator(runtime) {
  const apiRuntime = runtime.apiRuntime || runtime.apiComponent || null;
  const databaseRuntime = runtime.databaseRuntime || runtime.databaseComponent || null;
  return {
    ...runtime,
    ...(apiRuntime ? { apiRuntime, apiComponent: apiRuntime } : {}),
    ...(databaseRuntime ? { databaseRuntime, databaseComponent: databaseRuntime } : {})
  };
}

/**
 * @param {GeneratorContext} context
 * @returns {string}
 */
function projectionIdFor(context) {
  const runtime = runtimeFor(context);
  return context.projection?.id || runtime.projection?.id || context.options?.projectionId;
}

/**
 * @param {GeneratorContext} context
 * @param {string} profile
 * @returns {Record<string, any>}
 */
function serverOptions(context, profile) {
  const projectionId = projectionIdFor(context);
  const runtime = runtimeFor(context);
  const dbProjectionId = runtime.databaseRuntime?.projection?.id || runtime.databaseComponent?.projection?.id || context.options?.dbProjectionId;
  return {
    ...(context.options || {}),
    projectionId,
    dbProjectionId,
    component: runtime,
    runtime,
    topology: context.topology,
    contracts: context.contracts,
    implementation: context.implementation,
    profile
  };
}

/**
 * @param {GeneratorContext} context
 * @returns {Record<string, any>}
 */
function commonOptions(context) {
  const runtime = runtimeFor(context);
  return {
    ...(context.options || {}),
    projectionId: projectionIdFor(context),
    component: runtime,
    runtime,
    topology: context.topology,
    contracts: context.contracts,
    implementation: context.implementation
  };
}

/**
 * @param {GeneratorContext} context
 * @returns {Record<string, any>}
 */
function buildContractsForContext(context) {
  const projectionId = projectionIdFor(context);
  const runtime = runtimeFor(context);
  const surface = runtime.type || runtime.kind;
  if (surface === "web" || surface === "web_surface") {
    return {
      uiSurface: generateUiSurfaceContract(context.graph, { ...(context.options || {}), projectionId })
    };
  }
  if (surface === "api" || surface === "api_service") {
    return {
      server: generateServerContract(context.graph, { ...(context.options || {}), projectionId }),
      api: generateApiContractGraph(context.graph, {})
    };
  }
  if (surface === "database") {
    return {
      db: generateDbContractGraph(context.graph, { ...(context.options || {}), projectionId }),
      lifecyclePlan: generateDbLifecyclePlan(context.graph, { ...(context.options || {}), projectionId, runtime, component: runtime, topology: context.topology })
    };
  }
  if (surface === "native" || surface === "ios_surface" || surface === "android_surface") {
    return {
      uiSurface: generateUiSurfaceContract(context.graph, { ...(context.options || {}), projectionId }),
      api: generateApiContractGraph(context.graph, {})
    };
  }
  return {};
}

/** @type {GeneratorAdapter[]} */
export const BUNDLED_GENERATOR_ADAPTERS = [
  {
    manifest: requiredManifest("topogram/hono"),
    generate(context) {
      const runtime = runtimeFor(context);
      if (runtime && !runtime.databaseRuntime) {
        return fileResult(generateStatelessServer(context.graph, serverOptions(context, "hono")));
      }
      return fileResult(generateHonoServer(context.graph, serverOptions(context, "hono")));
    }
  },
  {
    manifest: requiredManifest("topogram/express"),
    generate(context) {
      const runtime = runtimeFor(context);
      if (runtime && !runtime.databaseRuntime) {
        return fileResult(generateStatelessServer(context.graph, serverOptions(context, "express")));
      }
      return fileResult(generateExpressServer(context.graph, serverOptions(context, "express")));
    }
  },
  {
    manifest: requiredManifest("topogram/vanilla-web"),
    generate(context) {
      return fileResult(generateVanillaWebApp(context.graph, commonOptions(context)));
    }
  },
  {
    manifest: requiredManifest("topogram/sveltekit"),
    generate(context) {
      return fileResult(generateSvelteKitApp(context.graph, commonOptions(context)));
    }
  },
  {
    manifest: requiredManifest("topogram/react"),
    generate(context) {
      return fileResult(generateReactApp(context.graph, commonOptions(context)));
    }
  },
  {
    manifest: requiredManifest("topogram/swiftui"),
    generate(context) {
      return fileResult(generateSwiftUiApp(context.graph, commonOptions(context)));
    }
  },
  {
    manifest: requiredManifest("topogram/postgres"),
    generate(context) {
      return fileResult(generatePostgresDbLifecycleBundle(context.graph, commonOptions(context)));
    }
  },
  {
    manifest: requiredManifest("topogram/sqlite"),
    generate(context) {
      return fileResult(generateSqliteDbLifecycleBundle(context.graph, commonOptions(context)));
    }
  }
];

const ADAPTER_BY_ID = new Map(BUNDLED_GENERATOR_ADAPTERS.map((adapter) => [adapter.manifest.id, adapter]));

/**
 * @param {string} generatorId
 * @returns {GeneratorAdapter|null}
 */
export function getBundledGeneratorAdapter(generatorId) {
  return ADAPTER_BY_ID.get(generatorId) || null;
}

/**
 * @param {string|null|undefined} rootDir
 * @returns {any}
 */
function requireFromProject(rootDir) {
  return createRequire(path.join(rootDir || process.cwd(), "package.json"));
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
 * @param {GeneratorManifest} manifest
 * @param {Record<string, any>} runtime
 * @param {{ rootDir?: string|null, configDir?: string|null }} [options]
 * @returns {GeneratorAdapter}
 */
function loadPackageGeneratorAdapter(manifest, runtime, options = {}) {
  const packageName = manifest.package || runtime?.generator?.package;
  if (!packageName) {
    throw new Error(`Runtime '${runtime?.id || "unknown"}' generator '${manifest.id}@${manifest.version}' is package-backed but does not declare a package.`);
  }
  const rootDir = options.configDir || options.rootDir || process.cwd();
  const diagnostics = generatorPolicyDiagnosticsForBindings(
    loadGeneratorPolicy(rootDir),
    [{
      runtimeId: String(runtime?.id || "unknown"),
      runtimeKind: String(runtime?.kind || runtime?.type || manifest.surface || "unknown"),
      projection: String(runtime?.projection?.id || runtime?.projection || "unknown"),
      generatorId: String(runtime?.generator?.id || manifest.id),
      version: String(runtime?.generator?.version || manifest.version),
      packageName
    }],
    "generator-adapter"
  );
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((diagnostic) =>
      diagnostic.suggestedFix
        ? `${diagnostic.message} Suggested fix: ${diagnostic.suggestedFix}`
        : diagnostic.message
    ).join("\n"));
  }
  let moduleValue;
  try {
    moduleValue = requireFromProject(rootDir)(packageName);
  } catch (error) {
    const installHint = packageGeneratorInstallHint(packageName);
    throw new Error(`Runtime '${runtime?.id || "unknown"}' generator package '${packageName}' could not be loaded from '${rootDir}': ${error instanceof Error ? error.message : String(error)}${installHint ? `. ${installHint}` : ""}`);
  }
  const adapter = selectPackageExport(moduleValue, manifest.export);
  if (!adapter || typeof adapter.generate !== "function") {
    throw new Error(`Runtime '${runtime?.id || "unknown"}' generator package '${packageName}' must export an adapter with a generate(context) function.`);
  }
  const adapterManifest = adapter.manifest || manifest;
  if (adapterManifest.id !== manifest.id || adapterManifest.version !== manifest.version) {
    throw new Error(`Runtime '${runtime?.id || "unknown"}' generator package '${packageName}' adapter manifest '${adapterManifest.id}@${adapterManifest.version}' does not match '${manifest.id}@${manifest.version}'.`);
  }
  return {
    manifest,
    generate(context) {
      return adapter.generate(context);
    }
  };
}

/**
 * @param {Record<string, any>} runtime
 * @param {{ rootDir?: string|null, configDir?: string|null }} [options]
 * @returns {{ manifest: GeneratorManifest, adapter: GeneratorAdapter }}
 */
export function resolveGeneratorForComponent(runtime, options = {}) {
  const generatorId = runtime?.generator?.id;
  const resolved = resolveGeneratorManifestForBinding(runtime?.generator, options);
  const manifest = resolved.manifest || getGeneratorManifest(generatorId);
  if (!manifest) {
    const detail = resolved.errors.length > 0 ? ` ${resolved.errors.join(" ")}` : "";
    throw new Error(`Runtime '${runtime?.id || "unknown"}' uses unknown generator '${generatorId || "unknown"}'.${detail}`);
  }
  if (manifest.planned) {
    throw new Error(`Runtime '${runtime?.id || "unknown"}' uses planned generator '${manifest.id}', which is not implemented yet.`);
  }
  if (runtime.generator?.version !== manifest.version) {
    throw new Error(`Runtime '${runtime?.id || "unknown"}' generator '${manifest.id}' version '${runtime.generator?.version}' is unsupported; expected '${manifest.version}'.`);
  }
  const manifestValidation = validateGeneratorManifest(manifest);
  if (!manifestValidation.ok) {
    throw new Error(manifestValidation.errors.join("\n"));
  }
  if (manifest.source === "package") {
    return { manifest, adapter: loadPackageGeneratorAdapter(manifest, runtime, options) };
  }
  const adapter = getBundledGeneratorAdapter(manifest.id);
  if (!adapter) {
    const installHint = packageGeneratorInstallHint(runtime?.generator?.package || manifest.package);
    throw new Error(`Runtime '${runtime?.id || "unknown"}' generator '${manifest.id}@${manifest.version}' is not available. Package-backed generators must be installed before generation.${installHint ? ` ${installHint}` : ""}`);
  }
  return { manifest, adapter };
}

/**
 * @param {Omit<GeneratorContext, "contracts"> & { contracts?: Record<string, any> }} context
 * @returns {GeneratorResult}
 */
export function generateWithRuntimeGenerator(context) {
  const runtime = runtimeFor(context);
  const { manifest, adapter } = resolveGeneratorForComponent(runtime, context.options || {});
  const contracts = context.contracts || buildContractsForContext(context);
  return adapter.generate({
    ...context,
    runtime,
    component: runtime,
    projection: context.projection,
    manifest,
    contracts
  });
}

export function generateWithComponentGenerator(context) {
  return generateWithRuntimeGenerator(context);
}
