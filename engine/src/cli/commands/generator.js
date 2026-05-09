// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import { checkGeneratorPack } from "../../generator/check.js";
import {
  GENERATOR_MANIFESTS,
  getGeneratorManifest,
  loadPackageGeneratorManifest,
  packageGeneratorInstallCommand
} from "../../generator/registry.js";
import { GENERATOR_POLICY_FILE } from "../../generator-policy.js";

/**
 * @returns {void}
 */
export function printGeneratorHelp() {
  console.log("Usage: topogram generator list [--json]");
  console.log("   or: topogram generator show <id-or-package> [--json]");
  console.log("   or: topogram generator check <path-or-package> [--json]");
  console.log("   or: topogram generator policy init [path] [--json]");
  console.log("   or: topogram generator policy status [path] [--json]");
  console.log("   or: topogram generator policy check [path] [--json]");
  console.log("   or: topogram generator policy explain [path] [--json]");
  console.log("   or: topogram generator policy pin [package@version] [path] [--json]");
  console.log("");
  console.log("Inspects generator manifests and checks generator pack conformance.");
  console.log("");
  console.log("Notes:");
  console.log("  - list shows bundled generators plus installed package-backed generators declared in package.json; it reads manifests only.");
  console.log("  - show accepts an installed package name or a bundled fallback generator id; it does not load adapter code.");
  console.log("  - check validates a local generator package path or an already installed package by loading the adapter and running smoke generation.");
  console.log("  - Topogram does not install generator packages during show or check.");
  console.log(`  - package-backed project generators are governed by ${GENERATOR_POLICY_FILE}; bundled topogram/* generators are allowed.`);
  console.log("");
  console.log("Examples:");
  console.log("  topogram generator list");
  console.log("  topogram generator list --json");
  console.log("  topogram generator show @topogram/generator-react-web");
  console.log("  topogram generator show @scope/topogram-generator-web --json");
  console.log("  topogram generator check ./generator-package");
  console.log("  topogram generator check @scope/topogram-generator-web --json");
  console.log("  topogram generator policy init");
  console.log("  topogram generator policy status --json");
  console.log("  topogram generator policy check --json");
  console.log("  topogram generator policy pin @topogram/generator-react-web@1");
}

/**
 * @param {ReturnType<typeof checkGeneratorPack>} payload
 * @returns {void}
 */
export function printGeneratorCheck(payload) {
  console.log(payload.ok ? "Generator check passed." : "Generator check found issues.");
  console.log(`Source: ${payload.sourceSpec}`);
  console.log(`Type: ${payload.source}`);
  if (payload.packageName) {
    console.log(`Package: ${payload.packageName}`);
  }
  if (payload.manifestPath) {
    console.log(`Manifest: ${payload.manifestPath}`);
  }
  if (payload.manifest) {
    console.log(`Generator: ${payload.manifest.id}@${payload.manifest.version}`);
    console.log(`Surface: ${payload.manifest.surface}`);
    console.log(`Projection types: ${payload.manifest.projectionTypes.join(", ")}`);
    console.log(`Source mode: ${payload.manifest.source}`);
  }
  console.log("Executes package code: yes (loads adapter and runs smoke generate)");
  console.log("");
  console.log("Checks:");
  for (const check of payload.checks || []) {
    console.log(`- ${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.message}`);
  }
  if (payload.smoke) {
    console.log("");
    console.log(`Smoke output: ${payload.smoke.files} file(s), ${payload.smoke.artifacts} artifact(s), ${payload.smoke.diagnostics} diagnostic(s)`);
  }
  if ((payload.errors || []).length > 0) {
    console.log("");
    console.log("Errors:");
    for (const error of payload.errors) {
      console.log(`- ${error}`);
    }
  }
}

/**
 * @param {import("../../generator/registry.js").GeneratorManifest} manifest
 * @param {{ source?: string|null, manifestPath?: string|null, packageRoot?: string|null, installed?: boolean, errors?: string[] }} [metadata]
 * @returns {Record<string, any>}
 */
function generatorManifestSummary(manifest, metadata = {}) {
  const installCommand = manifest.package ? packageGeneratorInstallCommand(manifest.package) : null;
  return {
    id: manifest.id,
    version: manifest.version,
    surface: manifest.surface,
    projectionTypes: manifest.projectionTypes || [],
    inputs: manifest.inputs || [],
    outputs: manifest.outputs || [],
    stack: manifest.stack || {},
    capabilities: manifest.capabilities || {},
    source: manifest.source,
    loadsAdapter: false,
    executesPackageCode: false,
    ...(manifest.profile ? { profile: manifest.profile } : {}),
    ...(manifest.package ? { package: manifest.package } : {}),
    ...(installCommand ? { installCommand } : {}),
    ...(manifest.planned ? { planned: true } : {}),
    installed: metadata.installed !== false,
    manifestPath: metadata.manifestPath || null,
    packageRoot: metadata.packageRoot || null,
    errors: metadata.errors || []
  };
}

/**
 * @param {string} surface
 * @param {string[]} [projectionTypes]
 * @returns {string}
 */
function exampleProjectionId(surface, projectionTypes = []) {
  const projectionType = projectionTypes[0] || "";
  if (surface === "api") return "proj_api";
  if (surface === "database") return projectionType === "db_contract" ? "proj_db" : "proj_db";
  if (surface === "native") return projectionType === "android_surface" ? "proj_android_surface" : "proj_ios_surface";
  return "proj_web_surface";
}

/**
 * @param {import("../../generator/registry.js").GeneratorManifest} manifest
 * @returns {Record<string, any>}
 */
function exampleTopologyBinding(manifest) {
  const runtimeId = manifest.surface === "api"
    ? "app_api"
    : manifest.surface === "database"
      ? "app_db"
      : manifest.surface === "native"
        ? "app_ios"
        : "app_web";
  return {
    id: runtimeId,
    kind: manifest.runtimeKinds?.[0] || manifest.surface,
    projection: exampleProjectionId(manifest.surface, manifest.projectionTypes),
    generator: {
      id: manifest.id,
      version: manifest.version,
      ...(manifest.package ? { package: manifest.package } : {})
    }
  };
}

/**
 * @param {string} cwd
 * @returns {string[]}
 */
function declaredGeneratorPackages(cwd) {
  const packagePath = path.join(cwd, "package.json");
  if (!fs.existsSync(packagePath)) {
    return [];
  }
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const dependencyBuckets = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.optionalDependencies,
    packageJson.peerDependencies
  ];
  const packages = new Set();
  for (const dependencies of dependencyBuckets) {
    if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      continue;
    }
    for (const name of Object.keys(dependencies)) {
      if (name.includes("topogram-generator") || name.startsWith("@topogram/generator-")) {
        packages.add(name);
      }
    }
  }
  return [...packages].sort();
}

/**
 * @param {string} cwd
 * @returns {{ ok: boolean, cwd: string, generators: Record<string, any>[], summary: Record<string, number> }}
 */
export function buildGeneratorListPayload(cwd) {
  const generators = GENERATOR_MANIFESTS
    .map((manifest) => generatorManifestSummary(manifest))
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const packageName of declaredGeneratorPackages(cwd)) {
    const loaded = loadPackageGeneratorManifest(packageName, cwd);
    if (loaded.manifest) {
      generators.push(generatorManifestSummary(loaded.manifest, {
        installed: true,
        manifestPath: loaded.manifestPath,
        packageRoot: loaded.packageRoot,
        errors: loaded.errors
      }));
    } else {
      const installCommand = packageGeneratorInstallCommand(packageName);
      generators.push({
        id: null,
        version: null,
        surface: null,
        projectionTypes: [],
        inputs: [],
        outputs: [],
        stack: {},
        capabilities: {},
        source: "package",
        package: packageName,
        ...(installCommand ? { installCommand } : {}),
        installed: false,
        manifestPath: loaded.manifestPath,
        packageRoot: loaded.packageRoot,
        errors: loaded.errors
      });
    }
  }
  generators.sort((left, right) => String(left.id || left.package || "").localeCompare(String(right.id || right.package || "")));
  return {
    ok: generators.every((generator) => generator.errors.length === 0),
    cwd,
    generators,
    summary: {
      total: generators.length,
      bundled: generators.filter((generator) => generator.source === "bundled").length,
      package: generators.filter((generator) => generator.source === "package").length,
      installed: generators.filter((generator) => generator.installed).length,
      planned: generators.filter((generator) => generator.planned).length
    }
  };
}

/**
 * @param {string} spec
 * @returns {string}
 */
function packageNameFromPackageSpec(spec) {
  if (spec.startsWith("@")) {
    const segments = spec.split("/");
    if (segments.length < 2) {
      throw new Error(`Invalid scoped package spec '${spec}'.`);
    }
    const scope = segments[0];
    const nameAndVersion = segments.slice(1).join("/");
    const versionIndex = nameAndVersion.indexOf("@");
    return `${scope}/${versionIndex >= 0 ? nameAndVersion.slice(0, versionIndex) : nameAndVersion}`;
  }
  const versionIndex = spec.indexOf("@");
  return versionIndex >= 0 ? spec.slice(0, versionIndex) : spec;
}

/**
 * @param {string} spec
 * @param {string} cwd
 * @returns {{ ok: boolean, sourceSpec: string, generator: Record<string, any>|null, exampleTopologyBinding: Record<string, any>|null, errors: string[] }}
 */
export function buildGeneratorShowPayload(spec, cwd) {
  const errors = [];
  if (!spec || spec.startsWith("-")) {
    return {
      ok: false,
      sourceSpec: spec || "",
      generator: null,
      exampleTopologyBinding: null,
      errors: ["Usage: topogram generator show <id-or-package>"]
    };
  }
  const bundled = getGeneratorManifest(spec);
  if (bundled) {
    return {
      ok: true,
      sourceSpec: spec,
      generator: generatorManifestSummary(bundled),
      exampleTopologyBinding: exampleTopologyBinding(bundled),
      errors: []
    };
  }
  let packageName = spec;
  try {
    packageName = packageNameFromPackageSpec(spec);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (errors.length === 0) {
    const loaded = loadPackageGeneratorManifest(packageName, cwd);
    if (loaded.manifest) {
      return {
        ok: true,
        sourceSpec: spec,
        generator: generatorManifestSummary(loaded.manifest, {
          installed: true,
          manifestPath: loaded.manifestPath,
          packageRoot: loaded.packageRoot,
          errors: loaded.errors
        }),
        exampleTopologyBinding: exampleTopologyBinding(loaded.manifest),
        errors: []
      };
    }
    errors.push(...loaded.errors);
  }
  return {
    ok: false,
    sourceSpec: spec,
    generator: null,
    exampleTopologyBinding: null,
    errors
  };
}

/**
 * @param {ReturnType<typeof buildGeneratorListPayload>} payload
 * @returns {void}
 */
export function printGeneratorList(payload) {
  console.log("Topogram generators");
  console.log(`Bundled: ${payload.summary.bundled}; package-backed: ${payload.summary.package}; installed: ${payload.summary.installed}; planned: ${payload.summary.planned}`);
  console.log("");
  for (const generator of payload.generators) {
    const id = generator.id || generator.package || "unknown";
    const status = generator.errors.length > 0
      ? "invalid"
      : generator.planned
        ? "planned"
        : generator.source === "package"
          ? (generator.installed ? "package installed" : "package missing")
          : "bundled";
    const platforms = generator.projectionTypes.join(", ") || "none";
    const stack = Object.values(generator.stack || {}).join(" + ") || "not declared";
    console.log(`- ${id}${generator.version ? `@${generator.version}` : ""} (${generator.surface || "unknown"}, ${status})`);
    console.log(`  Source: ${generator.source}`);
    console.log("  Adapter loaded: no");
    console.log("  Executes package code: no");
    if (generator.source === "package") {
      console.log(`  Installed: ${generator.installed ? "yes" : "no"}`);
    }
    console.log(`  Platforms: ${platforms}`);
    console.log(`  Stack: ${stack}`);
    if (generator.package) {
      console.log(`  Package: ${generator.package}`);
    }
    if (generator.installCommand) {
      console.log(`  Install: ${generator.installCommand}`);
    }
    for (const error of generator.errors || []) {
      console.log(`  Error: ${error}`);
    }
  }
}

/**
 * @param {ReturnType<typeof buildGeneratorShowPayload>} payload
 * @returns {void}
 */
export function printGeneratorShow(payload) {
  if (!payload.ok || !payload.generator) {
    console.log("Generator not found.");
    for (const error of payload.errors || []) {
      console.log(`- ${error}`);
    }
    return;
  }
  const generator = payload.generator;
  console.log(`Generator: ${generator.id}@${generator.version}`);
  console.log(`Surface: ${generator.surface}`);
  console.log(`Source: ${generator.source}${generator.planned ? " (planned)" : ""}`);
  console.log("Adapter loaded: no");
  console.log("Executes package code: no");
  if (generator.source === "package") {
    console.log(`Installed: ${generator.installed ? "yes" : "no"}`);
  }
  if (generator.package) {
    console.log(`Package: ${generator.package}`);
  }
  if (generator.installCommand) {
    console.log(`Install: ${generator.installCommand}`);
  }
  if (generator.manifestPath) {
    console.log(`Manifest: ${generator.manifestPath}`);
  }
  console.log(`Projection types: ${generator.projectionTypes.join(", ") || "none"}`);
  console.log(`Inputs: ${generator.inputs.join(", ") || "none"}`);
  console.log(`Outputs: ${generator.outputs.join(", ") || "none"}`);
  console.log(`Stack: ${Object.entries(generator.stack || {}).map(([key, value]) => `${key}=${value}`).join(", ") || "not declared"}`);
  console.log(`Capabilities: ${Object.entries(generator.capabilities || {}).map(([key, value]) => `${key}=${value}`).join(", ") || "not declared"}`);
  console.log("");
  console.log("Example topology binding:");
  console.log(stableStringify(payload.exampleTopologyBinding));
}


/**
 * @param {{
 *   commandArgs: Record<string, any>,
 *   inputPath: string|null|undefined,
 *   json: boolean,
 *   cwd: string
 * }} context
 * @returns {number}
 */
export function runGeneratorCommand(context) {
  const { commandArgs, inputPath, json, cwd } = context;
  if (commandArgs.generatorCommand === "check") {
    const payload = checkGeneratorPack(inputPath || "", { cwd });
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorCheck(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.generatorCommand === "list") {
    const payload = buildGeneratorListPayload(cwd);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorList(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (commandArgs.generatorCommand === "show") {
    const payload = buildGeneratorShowPayload(inputPath || "", cwd);
    if (json) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorShow(payload);
    }
    return payload.ok ? 0 : 1;
  }

  throw new Error(`Unknown generator command '${commandArgs.generatorCommand}'`);
}

export { checkGeneratorPack };
