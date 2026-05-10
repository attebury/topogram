// @ts-check

import fs from "node:fs";
import childProcess from "node:child_process";
import os from "node:os";
import path from "node:path";

import { assertSafeNpmSpec, localNpmrcEnv } from "../npm-safety.js";
import { GENERATOR_LABELS, SURFACE_ORDER, TEMPLATE_MANIFEST, unsupportedTemplateSymlinkMessage } from "./constants.js";
import { isLocalTemplateSpec, packageNameFromSpec } from "./package-spec.js";

/** @typedef {import("./types.js").CreateNewProjectOptions} CreateNewProjectOptions */
/** @typedef {import("./types.js").TemplateUpdatePlanOptions} TemplateUpdatePlanOptions */
/** @typedef {import("./types.js").TemplateUpdateFileActionOptions} TemplateUpdateFileActionOptions */
/** @typedef {import("./types.js").TemplateOwnedFileRecord} TemplateOwnedFileRecord */
/** @typedef {import("./types.js").TemplateManifest} TemplateManifest */
/** @typedef {import("./types.js").TemplateTopologySummary} TemplateTopologySummary */
/** @typedef {import("./types.js").TemplatePolicy} TemplatePolicy */
/** @typedef {import("./types.js").TemplatePolicyInfo} TemplatePolicyInfo */
/** @typedef {import("./types.js").TemplateUpdateDiagnostic} TemplateUpdateDiagnostic */
/** @typedef {import("./types.js").ResolvedTemplate} ResolvedTemplate */
/** @typedef {import("./types.js").CatalogTemplateProvenance} CatalogTemplateProvenance */

/**
 * @param {unknown} value
 * @returns {TemplateManifest}
 */
export function validateTemplateManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${TEMPLATE_MANIFEST} must contain a JSON object.`);
  }
  const manifest = /** @type {Record<string, unknown>} */ (value);
  for (const field of ["id", "version", "kind", "topogramVersion"]) {
    if (typeof manifest[field] !== "string" || !manifest[field]) {
      throw new Error(`${TEMPLATE_MANIFEST} is missing required string field '${field}'.`);
    }
  }
  if (manifest.kind !== "starter") {
    throw new Error(`${TEMPLATE_MANIFEST} kind must be 'starter'.`);
  }
  if (
    Object.prototype.hasOwnProperty.call(manifest, "includesExecutableImplementation") &&
    typeof manifest.includesExecutableImplementation !== "boolean"
  ) {
    throw new Error(`${TEMPLATE_MANIFEST} field 'includesExecutableImplementation' must be a boolean.`);
  }
  if (Object.prototype.hasOwnProperty.call(manifest, "starterScripts")) {
    if (!manifest.starterScripts || typeof manifest.starterScripts !== "object" || Array.isArray(manifest.starterScripts)) {
      throw new Error(`${TEMPLATE_MANIFEST} field 'starterScripts' must be an object of package.json script names to commands.`);
    }
    for (const [scriptName, command] of Object.entries(manifest.starterScripts)) {
      if (typeof scriptName !== "string" || !scriptName.trim() || scriptName.startsWith("-") || scriptName.includes("\n")) {
        throw new Error(`${TEMPLATE_MANIFEST} starterScripts contains an invalid script name.`);
      }
      if (typeof command !== "string" || !command.trim()) {
        throw new Error(`${TEMPLATE_MANIFEST} starterScripts.${scriptName} must be a non-empty string.`);
      }
    }
  }
  return /** @type {TemplateManifest} */ (/** @type {unknown} */ (manifest));
}

/**
 * @param {string} templateRoot
 * @returns {TemplateManifest}
 */
export function readTemplateManifest(templateRoot) {
  const manifestPath = path.join(templateRoot, TEMPLATE_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Template at '${templateRoot}' is missing ${TEMPLATE_MANIFEST}.`);
  }
  return validateTemplateManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
}

/**
 * @param {string} root
 * @param {string} currentDir
 * @param {string} label
 * @param {string} templateId
 * @returns {void}
 */
function assertTemplateTreeHasNoSymlinks(root, currentDir, label, templateId) {
  const rootStat = fs.lstatSync(currentDir);
  const relativeRoot = path.relative(root, currentDir).replace(/\\/g, "/") || label;
  if (rootStat.isSymbolicLink()) {
    throw new Error(unsupportedTemplateSymlinkMessage(templateId, relativeRoot));
  }
  if (!rootStat.isDirectory()) {
    return;
  }
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(root, entryPath).replace(/\\/g, "/");
    if (entry.isSymbolicLink()) {
      throw new Error(unsupportedTemplateSymlinkMessage(templateId, relativePath));
    }
    if (entry.isDirectory()) {
      assertTemplateTreeHasNoSymlinks(root, entryPath, label, templateId);
    }
  }
}

/**
 * @param {string} templateRoot
 * @returns {TemplateManifest}
 */
export function validateTemplateRoot(templateRoot) {
  const manifest = readTemplateManifest(templateRoot);
  const topogramRoot = path.join(templateRoot, "topogram");
  const projectConfigPath = path.join(templateRoot, "topogram.project.json");
  if (fs.existsSync(topogramRoot) && fs.lstatSync(topogramRoot).isSymbolicLink()) {
    throw new Error(unsupportedTemplateSymlinkMessage(manifest.id, "topogram"));
  }
  if (fs.existsSync(projectConfigPath) && fs.lstatSync(projectConfigPath).isSymbolicLink()) {
    throw new Error(unsupportedTemplateSymlinkMessage(manifest.id, "topogram.project.json"));
  }
  if (!fs.existsSync(topogramRoot) || !fs.statSync(topogramRoot).isDirectory()) {
    throw new Error(`Template '${manifest.id}' is missing topogram/.`);
  }
  if (!fs.existsSync(projectConfigPath) || !fs.statSync(projectConfigPath).isFile()) {
    throw new Error(`Template '${manifest.id}' is missing topogram.project.json.`);
  }
  assertTemplateTreeHasNoSymlinks(templateRoot, topogramRoot, "topogram", manifest.id);
  if (manifest.includesExecutableImplementation) {
    const implementationRoot = path.join(templateRoot, "implementation");
    if (fs.existsSync(implementationRoot) && fs.lstatSync(implementationRoot).isSymbolicLink()) {
      throw new Error(unsupportedTemplateSymlinkMessage(manifest.id, "implementation"));
    }
    if (!fs.existsSync(implementationRoot) || !fs.statSync(implementationRoot).isDirectory()) {
      throw new Error(
        `Template '${manifest.id}' declares executable implementation code but is missing implementation/.`
      );
    }
    assertTemplateTreeHasNoSymlinks(templateRoot, implementationRoot, "implementation", manifest.id);
  } else {
    const implementationRoot = path.join(templateRoot, "implementation");
    if (fs.existsSync(implementationRoot) && fs.statSync(implementationRoot).isDirectory()) {
      throw new Error(
        `Template '${manifest.id}' contains implementation/ but ${TEMPLATE_MANIFEST} does not declare includesExecutableImplementation: true.`
      );
    }
  }
  return manifest;
}

/**
 * @param {string} generatorId
 * @returns {string}
 */
function generatorLabel(generatorId) {
  return GENERATOR_LABELS.get(generatorId) || generatorId.replace(/^topogram\//, "");
}

/**
 * @param {string} templateRoot
 * @returns {TemplateTopologySummary}
 */
export function summarizeTemplateTopology(templateRoot) {
  const projectConfigPath = path.join(templateRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  const rawRuntimes = /** @type {any[]} */ (
    Array.isArray(projectConfig.topology?.runtimes) ? projectConfig.topology.runtimes : []
  );
  /** @type {Array<Record<string, any>>} */
  const runtimes = [];
  for (const runtime of rawRuntimes) {
    if (runtime && typeof runtime === "object" && typeof runtime.kind === "string") {
      runtimes.push(/** @type {Record<string, any>} */ (runtime));
    }
  }
  const sortedRuntimes = [...runtimes].sort((a, b) => {
    const aOrder = SURFACE_ORDER.get(a.kind) ?? 100;
    const bOrder = SURFACE_ORDER.get(b.kind) ?? 100;
    return aOrder - bOrder;
  });
  const surfaces = [...new Set(sortedRuntimes.map((runtime) => String(runtime.kind)))];
  const generators = [
    ...new Set(
      sortedRuntimes
        .map((runtime) => runtime.generator?.id)
        .filter((generatorId) => typeof generatorId === "string")
        .map((generatorId) => String(generatorId))
    )
  ];
  return {
    surfaces,
    generators,
    stack: generators.map(generatorLabel).join(" + ")
  };
}

/**
 * @param {string} templateSpec
 * @returns {string}
 */
export function installPackageSpec(templateSpec) {
  assertSafeNpmSpec(templateSpec);
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-"));
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = childProcess.spawnSync(
    npmBin,
    [
      "install",
      "--prefix",
      installRoot,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--",
      templateSpec
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ...localNpmrcEnv(process.cwd()),
        PATH: process.env.PATH || ""
      }
    }
  );
  if (result.status !== 0) {
    throw new Error(formatPackageInstallError(templateSpec, result));
  }
  const packageRoot = path.join(installRoot, "node_modules", packageNameFromSpec(templateSpec));
  if (fs.existsSync(packageRoot)) {
    return packageRoot;
  }
  return findInstalledTemplatePackageRoot(installRoot, templateSpec);
}

/**
 * @param {string} templateSpec
 * @param {any} result
 * @returns {string}
 */
function formatPackageInstallError(templateSpec, result) {
  const output = [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  const normalized = output.toLowerCase();
  const npmrcHint = "Ensure npm can access the registry required by this template package. Topogram ignores project .npmrc files unless TOPOGRAM_ALLOW_LOCAL_NPMRC=1 or --allow-local-npmrc is used.";
  const packageAccessHint = "For private package registries, configure a token with package read access.";
  const authHint = "For private template packages, configure npm auth for the package registry before installing.";
  const doctorHint = "Run `topogram doctor` to check Node.js, npm, package, and catalog access.";
  if (result.error?.code === "ENOENT") {
    return [
      `Failed to install template package '${templateSpec}': npm was not found.`,
      "Install Node.js/npm and retry."
    ].join("\n");
  }
  if (/\b(e401|eneedauth)\b/.test(normalized) || normalized.includes("unauthenticated") || normalized.includes("authentication required")) {
    return [
      `Authentication is required to install template package '${templateSpec}'.`,
      authHint,
      npmrcHint,
      packageAccessHint,
      doctorHint,
      output
    ].filter(Boolean).join("\n");
  }
  if (/\be403\b/.test(normalized) || normalized.includes("forbidden") || normalized.includes("permission")) {
    return [
      `Package access was denied while installing template package '${templateSpec}'.`,
      authHint,
      packageAccessHint,
      doctorHint,
      output
    ].filter(Boolean).join("\n");
  }
  if (/\b(e404|404)\b/.test(normalized) || normalized.includes("not found")) {
    return [
      `Template package '${templateSpec}' was not found, or the current token does not have access to it.`,
      "Check the package name/version and registry access.",
      packageAccessHint,
      doctorHint,
      output
    ].filter(Boolean).join("\n");
  }
  if (/\beintegrity\b/.test(normalized) || normalized.includes("integrity checksum failed")) {
    return [
      `Package integrity failed while installing template package '${templateSpec}'.`,
      "Refresh package-lock.json from the published registry tarball instead of a local npm pack tarball.",
      output
    ].filter(Boolean).join("\n");
  }
  return `Failed to install template package '${templateSpec}'.\n${output || "unknown error"}`.trim();
}

/**
 * @param {string} installRoot
 * @param {string} templateSpec
 * @returns {string}
 */
function findInstalledTemplatePackageRoot(installRoot, templateSpec) {
  const nodeModules = path.join(installRoot, "node_modules");
  if (!fs.existsSync(nodeModules)) {
    throw new Error(`Template package '${templateSpec}' did not create node_modules.`);
  }
  /** @type {string[]} */
  const candidates = [];
  for (const entry of fs.readdirSync(nodeModules)) {
    if (entry === ".bin") {
      continue;
    }
    const entryPath = path.join(nodeModules, entry);
    if (entry.startsWith("@")) {
      for (const scopedEntry of fs.readdirSync(entryPath)) {
        candidates.push(path.join(entryPath, scopedEntry));
      }
      continue;
    }
    candidates.push(entryPath);
  }
  const templateRoots = candidates.filter((candidate) =>
    fs.existsSync(path.join(candidate, TEMPLATE_MANIFEST))
  );
  if (templateRoots.length === 1) {
    return templateRoots[0];
  }
  if (templateRoots.length > 1) {
    throw new Error(`Template package '${templateSpec}' installed multiple template manifests.`);
  }
  throw new Error(`Template package '${templateSpec}' did not install a package with ${TEMPLATE_MANIFEST}.`);
}

/**
 * @param {string} templateName
 * @param {string} templatesRoot
 * @returns {ResolvedTemplate}
 */
export function resolveTemplate(templateName, templatesRoot) {
  void templatesRoot;

  if (isLocalTemplateSpec(templateName)) {
    const templateRoot = path.resolve(templateName);
    if (!fs.existsSync(templateRoot)) {
      throw new Error(`Local template path '${templateName}' does not exist.`);
    }
    if (!fs.statSync(templateRoot).isDirectory()) {
      const packageTemplateRoot = installPackageSpec(templateName);
      return {
        requested: templateName,
        root: packageTemplateRoot,
        manifest: validateTemplateRoot(packageTemplateRoot),
        source: "package",
        packageSpec: templateName
      };
    }
    return {
      requested: templateName,
      root: templateRoot,
      manifest: validateTemplateRoot(templateRoot),
      source: "local",
      packageSpec: null
    };
  }

  const templateRoot = installPackageSpec(templateName);
  if (!fs.existsSync(templateRoot)) {
    throw new Error(`Template package '${templateName}' did not install to '${templateRoot}'.`);
  }
  return {
    requested: templateName,
    root: templateRoot,
    manifest: validateTemplateRoot(templateRoot),
    source: "package",
    packageSpec: templateName
  };
}
