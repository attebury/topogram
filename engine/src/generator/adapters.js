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
import { generateUiWebContract } from "./surfaces/web/ui-web-contract.js";
import { generateVanillaWebApp } from "./surfaces/web/vanilla.js";

/**
 * @typedef {import("./registry.js").GeneratorManifest} GeneratorManifest
 */

/**
 * @typedef {Object} GeneratorContext
 * @property {Record<string, any>} graph
 * @property {Record<string, any>} projection
 * @property {Record<string, any>} component
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
function projectionIdFor(context) {
  return context.projection?.id || context.component?.projection?.id || context.options?.projectionId;
}

/**
 * @param {GeneratorContext} context
 * @param {string} profile
 * @returns {Record<string, any>}
 */
function serverOptions(context, profile) {
  const projectionId = projectionIdFor(context);
  const dbProjectionId = context.component?.databaseComponent?.projection?.id || context.options?.dbProjectionId;
  return {
    ...(context.options || {}),
    projectionId,
    dbProjectionId,
    component: context.component,
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
  return {
    ...(context.options || {}),
    projectionId: projectionIdFor(context),
    component: context.component,
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
  if (context.component.type === "web") {
    return {
      uiWeb: generateUiWebContract(context.graph, { ...(context.options || {}), projectionId })
    };
  }
  if (context.component.type === "api") {
    return {
      server: generateServerContract(context.graph, { ...(context.options || {}), projectionId }),
      api: generateApiContractGraph(context.graph, {})
    };
  }
  if (context.component.type === "database") {
    return {
      db: generateDbContractGraph(context.graph, { ...(context.options || {}), projectionId }),
      lifecyclePlan: generateDbLifecyclePlan(context.graph, { ...(context.options || {}), projectionId })
    };
  }
  if (context.component.type === "native") {
    return {
      uiWeb: generateUiWebContract(context.graph, { ...(context.options || {}), projectionId })
    };
  }
  return {};
}

/** @type {GeneratorAdapter[]} */
export const BUNDLED_GENERATOR_ADAPTERS = [
  {
    manifest: requiredManifest("topogram/hono"),
    generate(context) {
      if (context.component && !context.component.databaseComponent) {
        return fileResult(generateStatelessServer(context.graph, serverOptions(context, "hono")));
      }
      return fileResult(generateHonoServer(context.graph, serverOptions(context, "hono")));
    }
  },
  {
    manifest: requiredManifest("topogram/express"),
    generate(context) {
      if (context.component && !context.component.databaseComponent) {
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
 * @param {Record<string, any>} component
 * @param {{ rootDir?: string|null, configDir?: string|null }} [options]
 * @returns {GeneratorAdapter}
 */
function loadPackageGeneratorAdapter(manifest, component, options = {}) {
  const packageName = manifest.package || component?.generator?.package;
  if (!packageName) {
    throw new Error(`Component '${component?.id || "unknown"}' generator '${manifest.id}@${manifest.version}' is package-backed but does not declare a package.`);
  }
  const rootDir = options.configDir || options.rootDir || process.cwd();
  const diagnostics = generatorPolicyDiagnosticsForBindings(
    loadGeneratorPolicy(rootDir),
    [{
      componentId: String(component?.id || "unknown"),
      componentType: String(component?.type || manifest.surface || "unknown"),
      projection: String(component?.projection?.id || component?.projection || "unknown"),
      generatorId: String(component?.generator?.id || manifest.id),
      version: String(component?.generator?.version || manifest.version),
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
    throw new Error(`Component '${component?.id || "unknown"}' generator package '${packageName}' could not be loaded from '${rootDir}': ${error instanceof Error ? error.message : String(error)}${installHint ? `. ${installHint}` : ""}`);
  }
  const adapter = selectPackageExport(moduleValue, manifest.export);
  if (!adapter || typeof adapter.generate !== "function") {
    throw new Error(`Component '${component?.id || "unknown"}' generator package '${packageName}' must export an adapter with a generate(context) function.`);
  }
  const adapterManifest = adapter.manifest || manifest;
  if (adapterManifest.id !== manifest.id || adapterManifest.version !== manifest.version) {
    throw new Error(`Component '${component?.id || "unknown"}' generator package '${packageName}' adapter manifest '${adapterManifest.id}@${adapterManifest.version}' does not match '${manifest.id}@${manifest.version}'.`);
  }
  return {
    manifest,
    generate(context) {
      return adapter.generate(context);
    }
  };
}

/**
 * @param {Record<string, any>} component
 * @param {{ rootDir?: string|null, configDir?: string|null }} [options]
 * @returns {{ manifest: GeneratorManifest, adapter: GeneratorAdapter }}
 */
export function resolveGeneratorForComponent(component, options = {}) {
  const generatorId = component?.generator?.id;
  const resolved = resolveGeneratorManifestForBinding(component?.generator, options);
  const manifest = resolved.manifest || getGeneratorManifest(generatorId);
  if (!manifest) {
    const detail = resolved.errors.length > 0 ? ` ${resolved.errors.join(" ")}` : "";
    throw new Error(`Component '${component?.id || "unknown"}' uses unknown generator '${generatorId || "unknown"}'.${detail}`);
  }
  if (manifest.planned) {
    throw new Error(`Component '${component?.id || "unknown"}' uses planned generator '${manifest.id}', which is not implemented yet.`);
  }
  if (component.generator?.version !== manifest.version) {
    throw new Error(`Component '${component?.id || "unknown"}' generator '${manifest.id}' version '${component.generator?.version}' is unsupported; expected '${manifest.version}'.`);
  }
  const manifestValidation = validateGeneratorManifest(manifest);
  if (!manifestValidation.ok) {
    throw new Error(manifestValidation.errors.join("\n"));
  }
  if (manifest.source === "package") {
    return { manifest, adapter: loadPackageGeneratorAdapter(manifest, component, options) };
  }
  const adapter = getBundledGeneratorAdapter(manifest.id);
  if (!adapter) {
    const installHint = packageGeneratorInstallHint(component?.generator?.package || manifest.package);
    throw new Error(`Component '${component?.id || "unknown"}' generator '${manifest.id}@${manifest.version}' is not available. Package-backed generators must be installed before generation.${installHint ? ` ${installHint}` : ""}`);
  }
  return { manifest, adapter };
}

/**
 * @param {Omit<GeneratorContext, "contracts"> & { contracts?: Record<string, any> }} context
 * @returns {GeneratorResult}
 */
export function generateWithComponentGenerator(context) {
  const { manifest, adapter } = resolveGeneratorForComponent(context.component, context.options || {});
  const contracts = context.contracts || buildContractsForContext(context);
  return adapter.generate({
    ...context,
    projection: context.projection,
    manifest,
    contracts
  });
}
