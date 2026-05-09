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
import {
  defaultGeneratorPolicy,
  GENERATOR_POLICY_FILE,
  generatorPackageAllowed,
  generatorPolicyDiagnosticsForBindings,
  loadGeneratorPolicy,
  packageBackedGeneratorBindings,
  packageScopeFromName,
  parseGeneratorPolicyPin,
  writeGeneratorPolicy
} from "../../generator-policy.js";
import { loadProjectConfig } from "../../project-config.js";

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
 * @param {string} name
 * @param {boolean} ok
 * @param {string} actual
 * @param {string} expected
 * @param {string} message
 * @param {string|null} fix
 * @returns {{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }}
 */
function generatorPolicyRule(name, ok, actual, expected, message, fix = null) {
  return { name, ok, actual, expected, message, fix };
}

/**
 * @param {string} name
 * @returns {string}
 */
function generatorPolicyRuleLabel(name) {
  return ({
    "policy-file": "Policy file",
    "allowed-package": "Allowed package",
    "pinned-version": "Pinned version"
  })[name] || name;
}

/**
 * @param {any} policyInfo
 * @returns {any}
 */
function effectiveGeneratorPolicy(policyInfo) {
  return policyInfo.policy || {
    version: "0.1",
    allowedPackageScopes: ["@topogram"],
    allowedPackages: [],
    pinnedVersions: {}
  };
}

/**
 * @param {string} filePath
 * @returns {any|null}
 */
function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, any>|null} projectPackage
 * @param {string} packageName
 * @returns {{ field: string|null, spec: string|null }}
 */
function dependencySpecForPackage(projectPackage, packageName) {
  const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  for (const field of dependencyFields) {
    const dependencies = projectPackage?.[field];
    if (dependencies && typeof dependencies === "object" && typeof dependencies[packageName] === "string") {
      return {
        field,
        spec: dependencies[packageName]
      };
    }
  }
  return {
    field: null,
    spec: null
  };
}

/**
 * @param {Record<string, any>|null} lockfile
 * @param {string} packageName
 * @returns {{ version: string|null, resolved: string|null, integrity: string|null, entryPath: string|null }}
 */
function npmLockfileInfoForPackage(lockfile, packageName) {
  const packageEntryPath = `node_modules/${packageName}`;
  const packageEntry = lockfile?.packages?.[packageEntryPath];
  if (packageEntry && typeof packageEntry === "object") {
    return {
      version: typeof packageEntry.version === "string" ? packageEntry.version : null,
      resolved: typeof packageEntry.resolved === "string" ? packageEntry.resolved : null,
      integrity: typeof packageEntry.integrity === "string" ? packageEntry.integrity : null,
      entryPath: packageEntryPath
    };
  }
  const dependencyEntry = lockfile?.dependencies?.[packageName];
  if (dependencyEntry && typeof dependencyEntry === "object") {
    return {
      version: typeof dependencyEntry.version === "string" ? dependencyEntry.version : null,
      resolved: typeof dependencyEntry.resolved === "string" ? dependencyEntry.resolved : null,
      integrity: typeof dependencyEntry.integrity === "string" ? dependencyEntry.integrity : null,
      entryPath: packageName
    };
  }
  return {
    version: null,
    resolved: null,
    integrity: null,
    entryPath: null
  };
}

/**
 * @param {string} projectRoot
 * @returns {{ kind: "npm"|"pnpm"|"yarn"|"bun"|null, path: string|null, data: Record<string, any>|null, note: string|null }}
 */
function lockfileMetadataForProject(projectRoot) {
  const npmLockfilePath = path.join(projectRoot, "package-lock.json");
  if (fs.existsSync(npmLockfilePath)) {
    return {
      kind: "npm",
      path: npmLockfilePath,
      data: readJsonIfPresent(npmLockfilePath),
      note: null
    };
  }
  const candidates = [
    { kind: "pnpm", file: "pnpm-lock.yaml" },
    { kind: "yarn", file: "yarn.lock" },
    { kind: "bun", file: "bun.lock" },
    { kind: "bun", file: "bun.lockb" }
  ];
  for (const candidate of candidates) {
    const lockfilePath = path.join(projectRoot, candidate.file);
    if (fs.existsSync(lockfilePath)) {
      return {
        kind: /** @type {"pnpm"|"yarn"|"bun"} */ (candidate.kind),
        path: lockfilePath,
        data: null,
        note: `${candidate.file} found; package versions are not inspected by this command.`
      };
    }
  }
  return {
    kind: null,
    path: null,
    data: null,
    note: null
  };
}

/**
 * @param {string} projectRoot
 * @param {string} packageName
 * @returns {{ dependencyField: string|null, dependencySpec: string|null, installedVersion: string|null, installedPackageJsonPath: string|null, lockfileKind: "npm"|"pnpm"|"yarn"|"bun"|null, lockfilePath: string|null, lockfileVersion: string|null, lockfileResolved: string|null, lockfileIntegrity: string|null, lockfileEntryPath: string|null, lockfileNote: string|null }}
 */
function packageInfoForGenerator(projectRoot, packageName) {
  const projectPackage = readJsonIfPresent(path.join(projectRoot, "package.json"));
  const dependency = dependencySpecForPackage(projectPackage, packageName);
  const lockfile = lockfileMetadataForProject(projectRoot);
  const lockfileInfo = lockfile.kind === "npm"
    ? npmLockfileInfoForPackage(lockfile.data, packageName)
    : {
        version: null,
        resolved: null,
        integrity: null,
        entryPath: null
      };
  const installedPackageJsonPath = path.join(projectRoot, "node_modules", ...packageName.split("/"), "package.json");
  const installedPackage = readJsonIfPresent(installedPackageJsonPath);
  return {
    dependencyField: dependency.field,
    dependencySpec: dependency.spec,
    installedVersion: typeof installedPackage?.version === "string" ? installedPackage.version : null,
    installedPackageJsonPath: installedPackage ? installedPackageJsonPath : null,
    lockfileKind: lockfile.kind,
    lockfilePath: lockfile.path,
    lockfileVersion: lockfileInfo.version,
    lockfileResolved: lockfileInfo.resolved,
    lockfileIntegrity: lockfileInfo.integrity,
    lockfileEntryPath: lockfileInfo.entryPath,
    lockfileNote: lockfile.note
  };
}

/**
 * @param {ReturnType<typeof packageInfoForGenerator>} packageInfo
 * @returns {string}
 */
function formatGeneratorPackageLockfile(packageInfo) {
  if (!packageInfo.lockfileKind || !packageInfo.lockfilePath) {
    return "(not found)";
  }
  const label = path.basename(packageInfo.lockfilePath);
  if (packageInfo.lockfileVersion) {
    return `${packageInfo.lockfileKind} ${packageInfo.lockfileVersion}`;
  }
  return `${label} (version not inspected)`;
}

/**
 * @param {string} projectRoot
 * @param {any} policy
 * @param {ReturnType<typeof packageBackedGeneratorBindings>[number]} binding
 * @returns {ReturnType<typeof packageBackedGeneratorBindings>[number] & { allowed: boolean, packageInfo: ReturnType<typeof packageInfoForGenerator>, pin: { key: string|null, version: string|null, matches: boolean|null } }}
 */
function generatorPolicyBindingStatus(projectRoot, policy, binding) {
  const packagePin = policy.pinnedVersions[binding.packageName] || null;
  const generatorPin = policy.pinnedVersions[binding.generatorId] || null;
  const pinnedVersion = packagePin || generatorPin;
  return {
    ...binding,
    allowed: generatorPackageAllowed(policy, binding.packageName),
    packageInfo: packageInfoForGenerator(projectRoot, binding.packageName),
    pin: {
      key: packagePin ? binding.packageName : generatorPin ? binding.generatorId : null,
      version: pinnedVersion,
      matches: pinnedVersion ? pinnedVersion === binding.version : null
    }
  };
}

/**
 * @param {any[]} diagnostics
 * @param {Array<ReturnType<typeof generatorPolicyBindingStatus>>} bindings
 * @returns {any[]}
 */
function annotateGeneratorPolicyDiagnostics(diagnostics, bindings) {
  return diagnostics.map((diagnostic) => {
    const binding = bindings.find((item) => (
      item.packageName === diagnostic.packageName &&
      (!diagnostic.runtimeId || item.runtimeId === diagnostic.runtimeId)
    ));
    if (!binding) {
      return diagnostic;
    }
    return {
      ...diagnostic,
      packageVersion: binding.packageInfo.installedVersion || binding.packageInfo.lockfileVersion || null,
      packageDependencyField: binding.packageInfo.dependencyField,
      packageDependencySpec: binding.packageInfo.dependencySpec,
      packageLockfileKind: binding.packageInfo.lockfileKind,
      packageLockfilePath: binding.packageInfo.lockfilePath,
      packageLockVersion: binding.packageInfo.lockfileVersion
    };
  });
}

/**
 * @param {Array<ReturnType<typeof generatorPolicyBindingStatus>>} bindings
 * @returns {any[]}
 */
function generatorPolicyPackageMetadataDiagnostics(bindings) {
  const diagnostics = [];
  for (const binding of bindings) {
    if (!binding.packageInfo.dependencySpec) {
      diagnostics.push({
        code: "generator_package_dependency_missing",
        severity: "warning",
        message: `Runtime '${binding.runtimeId}' generator package '${binding.packageName}' is not declared in package.json dependencies.`,
        path: binding.packageInfo.installedPackageJsonPath,
        suggestedFix: `Declare '${binding.packageName}' in package.json devDependencies so generator adoption is visible in package review.`,
        step: "generator-policy",
        runtimeId: binding.runtimeId,
        generatorId: binding.generatorId,
        packageName: binding.packageName,
        version: binding.version,
        packageVersion: binding.packageInfo.installedVersion || binding.packageInfo.lockfileVersion || null,
        packageDependencyField: binding.packageInfo.dependencyField,
        packageDependencySpec: binding.packageInfo.dependencySpec,
        packageLockfileKind: binding.packageInfo.lockfileKind,
        packageLockfilePath: binding.packageInfo.lockfilePath,
        packageLockVersion: binding.packageInfo.lockfileVersion
      });
    }
    if (
      binding.packageInfo.installedVersion &&
      binding.packageInfo.lockfileVersion &&
      binding.packageInfo.installedVersion !== binding.packageInfo.lockfileVersion
    ) {
      diagnostics.push({
        code: "generator_package_version_drift",
        severity: "warning",
        message: `Runtime '${binding.runtimeId}' generator package '${binding.packageName}' is installed at '${binding.packageInfo.installedVersion}', but package-lock records '${binding.packageInfo.lockfileVersion}'.`,
        path: binding.packageInfo.lockfilePath,
        suggestedFix: "Run the package manager install command and review the resulting lockfile before pinning generator policy.",
        step: "generator-policy",
        runtimeId: binding.runtimeId,
        generatorId: binding.generatorId,
        packageName: binding.packageName,
        version: binding.version,
        packageVersion: binding.packageInfo.installedVersion,
        packageDependencyField: binding.packageInfo.dependencyField,
        packageDependencySpec: binding.packageInfo.dependencySpec,
        packageLockfileKind: binding.packageInfo.lockfileKind,
        packageLockfilePath: binding.packageInfo.lockfilePath,
        packageLockVersion: binding.packageInfo.lockfileVersion
      });
    }
  }
  return diagnostics;
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, defaulted: boolean, bindings: Array<ReturnType<typeof generatorPolicyBindingStatus>>, diagnostics: any[], errors: string[] }}
 */
export function buildGeneratorPolicyCheckPayload(projectPath) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = {
      code: "generator_policy_project_missing",
      severity: "error",
      message: "Cannot check generator policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "generator-policy"
    };
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), GENERATOR_POLICY_FILE),
      exists: false,
      policy: null,
      defaulted: false,
      bindings: [],
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policyInfo = loadGeneratorPolicy(projectConfigInfo.configDir);
  const rawBindings = packageBackedGeneratorBindings(projectConfigInfo.config);
  const policy = policyInfo.policy || effectiveGeneratorPolicy(policyInfo);
  const bindings = rawBindings.map((binding) => generatorPolicyBindingStatus(projectConfigInfo.configDir, policy, binding));
  const diagnostics = [];
  if (!policyInfo.exists) {
    diagnostics.push({
      code: "generator_policy_missing",
      severity: "warning",
      message: `No ${GENERATOR_POLICY_FILE} found. Default generator policy allows @topogram/* package-backed generators and blocks other package scopes.`,
      path: policyInfo.path,
      suggestedFix: "Run `topogram generator policy init` to write an explicit project generator policy after review.",
      step: "generator-policy"
    });
  }
  diagnostics.push(...generatorPolicyDiagnosticsForBindings(policyInfo, rawBindings, "generator-policy"));
  diagnostics.push(...generatorPolicyPackageMetadataDiagnostics(bindings));
  const annotatedDiagnostics = annotateGeneratorPolicyDiagnostics(diagnostics, bindings);
  const errors = annotatedDiagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    path: policyInfo.path,
    exists: policyInfo.exists,
    policy,
    defaulted: !policyInfo.exists,
    bindings,
    diagnostics: annotatedDiagnostics,
    errors
  };
}

/**
 * @param {string} projectPath
 * @returns {ReturnType<typeof buildGeneratorPolicyCheckPayload> & { rules: Array<{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }> }}
 */
export function buildGeneratorPolicyExplainPayload(projectPath) {
  const check = buildGeneratorPolicyCheckPayload(projectPath);
  const policy = check.policy || effectiveGeneratorPolicy({ path: check.path, exists: false, policy: null, diagnostics: [] });
  const rules = [];
  rules.push(generatorPolicyRule(
    "policy-file",
    check.exists,
    check.exists ? "present" : "missing",
    "present",
    check.exists
      ? "Project has a generator policy file."
      : "Project is using the default generator policy.",
    check.exists ? null : "Run `topogram generator policy init` after review."
  ));
  for (const binding of check.bindings) {
    const scope = packageScopeFromName(binding.packageName);
    rules.push(generatorPolicyRule(
      "allowed-package",
      generatorPackageAllowed(policy, binding.packageName),
      `${binding.packageName}${scope ? ` (${scope})` : ""}`,
      [
        `scopes=${policy.allowedPackageScopes.join(", ") || "(none)"}`,
        `packages=${policy.allowedPackages.join(", ") || "(none)"}`
      ].join("; "),
      `Runtime '${binding.runtimeId}' package-backed generator must be from an allowed package or scope.`,
      `Run \`topogram generator policy pin ${binding.packageName}@${binding.version}\` after reviewing the generator package.`
    ));
    const pinnedVersion = policy.pinnedVersions[binding.packageName] || policy.pinnedVersions[binding.generatorId] || null;
    rules.push(generatorPolicyRule(
      "pinned-version",
      !pinnedVersion || pinnedVersion === binding.version,
      binding.version,
      pinnedVersion || "(unpinned)",
      `Runtime '${binding.runtimeId}' generator version must match its policy pin when one exists.`,
      `Run \`topogram generator policy pin ${binding.packageName}@${binding.version}\` after review.`
    ));
  }
  return {
    ...check,
    rules
  };
}

/**
 * @param {string} projectPath
 * @returns {ReturnType<typeof buildGeneratorPolicyExplainPayload> & { summary: { packageBackedGenerators: number, allowed: number, denied: number, pinned: number, unpinned: number, pinMismatches: number } }}
 */
export function buildGeneratorPolicyStatusPayload(projectPath) {
  const explain = buildGeneratorPolicyExplainPayload(projectPath);
  return {
    ...explain,
    summary: {
      packageBackedGenerators: explain.bindings.length,
      allowed: explain.bindings.filter((binding) => binding.allowed).length,
      denied: explain.bindings.filter((binding) => !binding.allowed).length,
      pinned: explain.bindings.filter((binding) => Boolean(binding.pin.version)).length,
      unpinned: explain.bindings.filter((binding) => !binding.pin.version).length,
      pinMismatches: explain.bindings.filter((binding) => binding.pin.matches === false).length
    }
  };
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, policy: any, diagnostics: any[], errors: string[] }}
 */
export function buildGeneratorPolicyInitPayload(projectPath) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    throw new Error("Cannot initialize generator policy without topogram.project.json.");
  }
  const policy = writeGeneratorPolicy(projectConfigInfo.configDir, defaultGeneratorPolicy());
  return {
    ok: true,
    path: path.join(projectConfigInfo.configDir, GENERATOR_POLICY_FILE),
    policy,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildGeneratorPolicyInitPayload>} payload
 * @returns {void}
 */
export function printGeneratorPolicyInitPayload(payload) {
  console.log(`Wrote generator policy: ${payload.path}`);
  console.log(`Allowed package scopes: ${payload.policy.allowedPackageScopes.join(", ") || "(none)"}`);
  console.log(`Allowed packages: ${payload.policy.allowedPackages.join(", ") || "(none)"}`);
}

/**
 * @param {ReturnType<typeof buildGeneratorPolicyCheckPayload>} payload
 * @returns {void}
 */
export function printGeneratorPolicyCheckPayload(payload) {
  console.log(payload.ok ? "Generator policy check passed" : "Generator policy check failed");
  console.log(`Policy: ${payload.path}`);
  console.log(`Exists: ${payload.exists ? "yes" : "no"}`);
  console.log(`Defaulted: ${payload.defaulted ? "yes" : "no"}`);
  console.log(`Package-backed generators: ${payload.bindings.length}`);
  for (const binding of payload.bindings) {
    console.log(`- ${binding.runtimeId}: ${binding.generatorId}@${binding.version} via ${binding.packageName}`);
    console.log(`  npm package: ${binding.packageInfo.installedVersion || "(not installed)"}`);
    if (binding.packageInfo.dependencySpec) {
      console.log(`  dependency: ${binding.packageInfo.dependencyField} ${binding.packageInfo.dependencySpec}`);
    }
    if (binding.packageInfo.lockfileVersion) {
      console.log(`  lockfile: ${formatGeneratorPackageLockfile(binding.packageInfo)}`);
    } else if (binding.packageInfo.lockfileKind) {
      console.log(`  lockfile: ${formatGeneratorPackageLockfile(binding.packageInfo)}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {ReturnType<typeof buildGeneratorPolicyStatusPayload>} payload
 * @returns {void}
 */
export function printGeneratorPolicyStatusPayload(payload) {
  console.log(payload.ok ? "Generator policy status: allowed" : "Generator policy status: denied");
  console.log(`Policy file: ${payload.path}`);
  console.log(`Policy file exists: ${payload.exists ? "yes" : "no"}`);
  console.log(`Default policy active: ${payload.defaulted ? "yes" : "no"}`);
  console.log(`Package-backed generators: ${payload.summary.packageBackedGenerators}`);
  console.log(`Allowed packages: ${payload.summary.allowed}`);
  console.log(`Denied packages: ${payload.summary.denied}`);
  console.log(`Pinned generators: ${payload.summary.pinned}`);
  console.log(`Unpinned generators: ${payload.summary.unpinned}`);
  console.log(`Pin mismatches: ${payload.summary.pinMismatches}`);
  if (payload.bindings.length > 0) {
    console.log("");
    console.log("Generator packages:");
  }
  for (const binding of payload.bindings) {
    console.log(`- ${binding.runtimeId}: ${binding.generatorId}@${binding.version} via ${binding.packageName}`);
    console.log(`  allowed: ${binding.allowed ? "yes" : "no"}`);
    console.log(`  npm package: ${binding.packageInfo.installedVersion || "(not installed)"}`);
    console.log(`  dependency: ${binding.packageInfo.dependencyField && binding.packageInfo.dependencySpec ? `${binding.packageInfo.dependencyField} ${binding.packageInfo.dependencySpec}` : "(not declared)"}`);
    console.log(`  lockfile: ${formatGeneratorPackageLockfile(binding.packageInfo)}`);
    console.log(`  policy pin: ${binding.pin.version ? `${binding.pin.key}@${binding.pin.version}` : "(none)"}`);
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.packageVersion) {
      console.log(`  package version: ${diagnostic.packageVersion}`);
    }
    if (diagnostic.packageDependencySpec) {
      console.log(`  dependency: ${diagnostic.packageDependencyField} ${diagnostic.packageDependencySpec}`);
    }
    if (diagnostic.packageLockfilePath) {
      console.log(`  lockfile: ${path.basename(diagnostic.packageLockfilePath)}${diagnostic.packageLockVersion ? ` ${diagnostic.packageLockVersion}` : ""}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {ReturnType<typeof buildGeneratorPolicyExplainPayload>} payload
 * @returns {void}
 */
export function printGeneratorPolicyExplainPayload(payload) {
  console.log(payload.ok ? "Generator policy: allowed" : "Generator policy: denied");
  console.log(payload.ok
    ? "Decision: package-backed generators are allowed by this project's generator policy."
    : "Decision: one or more package-backed generators are blocked by this project's generator policy.");
  console.log(`Policy file: ${payload.path}`);
  console.log(`Policy file exists: ${payload.exists ? "yes" : "no"}`);
  console.log(`Default policy active: ${payload.defaulted ? "yes" : "no"}`);
  if (payload.bindings.length > 0) {
    console.log("");
    console.log("Package-backed generators:");
    for (const binding of payload.bindings) {
      console.log(`- ${binding.runtimeId}: ${binding.generatorId}@${binding.version} via ${binding.packageName}`);
      console.log(`  npm package: ${binding.packageInfo.installedVersion || "(not installed)"}`);
      if (binding.packageInfo.dependencySpec) {
        console.log(`  dependency: ${binding.packageInfo.dependencyField} ${binding.packageInfo.dependencySpec}`);
      }
    }
  }
  if (payload.rules.length > 0) {
    console.log("");
    console.log("Policy checks:");
  }
  for (const rule of payload.rules) {
    console.log(`${rule.ok ? "PASS" : "FAIL"} ${generatorPolicyRuleLabel(rule.name)}: ${rule.message}`);
    console.log(`  actual: ${rule.actual}`);
    console.log(`  expected: ${rule.expected}`);
    if (!rule.ok && rule.fix) {
      console.log(`  fix: ${rule.fix}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

/**
 * @param {string} projectPath
 * @param {string|null|undefined} spec
 * @returns {{ ok: boolean, path: string, policy: any, pinned: Array<{ packageName: string, version: string }>, diagnostics: any[], errors: string[] }}
 */
export function buildGeneratorPolicyPinPayload(projectPath, spec) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = {
      code: "generator_policy_project_missing",
      severity: "error",
      message: "Cannot pin generator policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "generator-policy"
    };
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), GENERATOR_POLICY_FILE),
      policy: null,
      pinned: [],
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policyInfo = loadGeneratorPolicy(projectConfigInfo.configDir);
  const policyDiagnostics = /** @type {any[]} */ (policyInfo.diagnostics || []);
  if (policyDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    const errors = policyDiagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message);
    return {
      ok: false,
      path: policyInfo.path,
      policy: policyInfo.policy,
      pinned: [],
      diagnostics: policyDiagnostics,
      errors
    };
  }
  let pins = [];
  try {
    pins = spec
      ? [parseGeneratorPolicyPin(spec)]
      : packageBackedGeneratorBindings(projectConfigInfo.config).map((binding) => ({
          packageName: binding.packageName,
          version: binding.version
        }));
  } catch (error) {
    const diagnostic = {
      code: "generator_policy_pin_invalid",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
      path: policyInfo.path,
      suggestedFix: "Pass a pin such as @topogram/generator-react-web@1.",
      step: "generator-policy"
    };
    return {
      ok: false,
      path: policyInfo.path,
      policy: policyInfo.policy,
      pinned: [],
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  if (pins.length === 0) {
    const diagnostic = {
      code: "generator_policy_pin_no_generators",
      severity: "error",
      message: "No package-backed topology generator bindings are available to pin.",
      path: projectConfigInfo.configPath,
      suggestedFix: "Pass an explicit pin such as @topogram/generator-react-web@1, or use bundled generators.",
      step: "generator-policy"
    };
    return {
      ok: false,
      path: policyInfo.path,
      policy: policyInfo.policy,
      pinned: [],
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policy = policyInfo.policy || defaultGeneratorPolicy();
  const allowedPackages = [...policy.allowedPackages];
  const allowedPackageScopes = [...policy.allowedPackageScopes];
  const pinnedVersions = { ...policy.pinnedVersions };
  for (const pin of pins) {
    if (!allowedPackages.includes(pin.packageName)) {
      allowedPackages.push(pin.packageName);
    }
    pinnedVersions[pin.packageName] = pin.version;
  }
  const nextPolicy = {
    ...policy,
    allowedPackageScopes,
    allowedPackages,
    pinnedVersions
  };
  writeGeneratorPolicy(projectConfigInfo.configDir, nextPolicy);
  return {
    ok: true,
    path: path.join(projectConfigInfo.configDir, GENERATOR_POLICY_FILE),
    policy: nextPolicy,
    pinned: pins,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {{ ok: boolean, path: string, pinned: Array<{ packageName: string, version: string }>, diagnostics: any[] }} payload
 * @returns {void}
 */
export function printGeneratorPolicyPinPayload(payload) {
  console.log(payload.ok ? "Generator policy pin updated" : "Generator policy pin failed");
  console.log(`Policy: ${payload.path}`);
  for (const pin of payload.pinned) {
    console.log(`Pinned: ${pin.packageName}@${pin.version}`);
  }
  for (const diagnostic of payload.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
}

export { checkGeneratorPack };
