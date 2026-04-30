// @ts-check

import fs from "node:fs";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

import { writeTemplateTrustRecord } from "./template-trust.js";

const CLI_PACKAGE_NAME = "@attebury/topogram";
const DEFAULT_TEMPLATE_NAME = "hello-web";
const TEMPLATE_NAMES = new Set(["hello-api", "hello-db", "hello-web", "web-api", "web-api-db"]);
const TEMPLATE_MANIFEST = "topogram-template.json";
const TEMPLATE_FILES_MANIFEST = ".topogram-template-files.json";
const TEMPLATE_POLICY_FILE = "topogram.template-policy.json";
const MAX_TEXT_DIFF_BYTES = 256 * 1024;

const GENERATOR_LABELS = new Map([
  ["topogram/express", "Express"],
  ["topogram/hono", "Hono"],
  ["topogram/postgres", "Postgres"],
  ["topogram/react", "React"],
  ["topogram/sqlite", "SQLite"],
  ["topogram/sveltekit", "SvelteKit"],
  ["topogram/vanilla-web", "Vanilla HTML/CSS/JS"]
]);

const SURFACE_ORDER = new Map([
  ["web", 10],
  ["api", 20],
  ["database", 30],
  ["native", 40]
]);

/**
 * @typedef {Object} CreateNewProjectOptions
 * @property {string} targetPath
 * @property {string} [templateName]
 * @property {string} engineRoot
 * @property {string} templatesRoot
 * @property {CatalogTemplateProvenance|null} [templateProvenance]
 */

/**
 * @typedef {Object} TemplateUpdatePlanOptions
 * @property {string} projectRoot
 * @property {Record<string, any>} projectConfig
 * @property {string|null} [templateName]
 * @property {string} templatesRoot
 */

/**
 * @typedef {TemplateUpdatePlanOptions & { filePath: string, action: "accept-current"|"accept-candidate"|"delete-current" }} TemplateUpdateFileActionOptions
 */

/**
 * @typedef {Object} TemplateOwnedFileRecord
 * @property {string} path
 * @property {string} sha256
 * @property {number} size
 */

/**
 * @typedef {Object} TemplateManifest
 * @property {string} id
 * @property {string} version
 * @property {string} kind
 * @property {string} topogramVersion
 * @property {boolean} [includesExecutableImplementation]
 * @property {string} [description]
 */

/**
 * @typedef {Object} TemplateTopologySummary
 * @property {string[]} surfaces
 * @property {string[]} generators
 * @property {string} stack
 */

/**
 * @typedef {Object} TemplatePolicy
 * @property {string} version
 * @property {Array<"builtin"|"local"|"package">} allowedSources
 * @property {string[]} allowedTemplateIds
 * @property {string[]} [allowedPackageScopes]
 * @property {"allow"|"warn"|"deny"} executableImplementation
 * @property {Record<string, string>} [pinnedVersions]
 */

/**
 * @typedef {Object} TemplatePolicyInfo
 * @property {string} path
 * @property {TemplatePolicy|null} policy
 * @property {boolean} exists
 * @property {TemplateUpdateDiagnostic[]} diagnostics
 */

/**
 * @typedef {Object} TemplateUpdateDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 * @property {string|null} step
 */

/**
 * @typedef {Object} ResolvedTemplate
 * @property {string} requested
 * @property {string} root
 * @property {TemplateManifest} manifest
 * @property {"builtin"|"local"|"package"} source
 * @property {string|null} packageSpec
 */

/**
 * @typedef {Object} CatalogTemplateProvenance
 * @property {string} id
 * @property {string} source
 * @property {string} package
 * @property {string} version
 * @property {string} packageSpec
 */

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function packageNameFromPath(projectRoot) {
  const baseName = path.basename(path.resolve(projectRoot)).toLowerCase();
  const normalized = baseName
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "");
  return normalized || "topogram-app";
}

/**
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @returns {string}
 */
function fileDependencyForEngine(projectRoot, engineRoot) {
  const relative = path.relative(projectRoot, engineRoot).replace(/\\/g, "/");
  if (!relative || relative.startsWith("..")) {
    return `file:${engineRoot}`;
  }
  return `file:./${relative}`;
}

/**
 * @param {string} engineRoot
 * @returns {{ name: string, version: string }}
 */
function readCliPackageMetadata(engineRoot) {
  const packagePath = path.join(engineRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return {
    name: typeof pkg.name === "string" ? pkg.name : CLI_PACKAGE_NAME,
    version: typeof pkg.version === "string" ? pkg.version : "0.0.0"
  };
}

/**
 * @param {string} engineRoot
 * @returns {boolean}
 */
function isSourceCheckoutEngine(engineRoot) {
  return fs.existsSync(path.join(engineRoot, "tests", "active"));
}

/**
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @returns {{ name: string, spec: string }}
 */
function cliDependencyForProject(projectRoot, engineRoot) {
  const metadata = readCliPackageMetadata(engineRoot);
  const overrideSpec = process.env.TOPOGRAM_CLI_PACKAGE_SPEC || "";
  if (overrideSpec) {
    return { name: metadata.name, spec: overrideSpec };
  }
  if (isSourceCheckoutEngine(engineRoot)) {
    return { name: metadata.name, spec: fileDependencyForEngine(projectRoot, engineRoot) };
  }
  return { name: metadata.name, spec: metadata.version };
}

/**
 * @param {{ name: string, spec: string }} cliDependency
 * @returns {boolean}
 */
function needsGitHubPackagesNpmConfig(cliDependency) {
  return cliDependency.name.startsWith("@attebury/") &&
    !cliDependency.spec.startsWith("file:") &&
    !cliDependency.spec.startsWith(".");
}

/**
 * @param {string} projectRoot
 * @param {{ name: string, spec: string }} cliDependency
 * @returns {void}
 */
function writeProjectNpmConfig(projectRoot, cliDependency) {
  if (!needsGitHubPackagesNpmConfig(cliDependency)) {
    return;
  }
  const contents = [
    "@attebury:registry=https://npm.pkg.github.com",
    "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}",
    ""
  ].join("\n");
  fs.writeFileSync(path.join(projectRoot, ".npmrc"), contents, "utf8");
}

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
function isSameOrInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isLocalTemplateSpec(value) {
  return value === "." ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    path.isAbsolute(value);
}

/**
 * @param {string} spec
 * @returns {string}
 */
export function packageNameFromSpec(spec) {
  if (spec.startsWith("@")) {
    const segments = spec.split("/");
    if (segments.length < 2) {
      throw new Error(`Invalid scoped template package spec '${spec}'.`);
    }
    const scope = segments[0];
    const nameAndVersion = segments[1];
    const versionIndex = nameAndVersion.indexOf("@");
    const name = versionIndex >= 0 ? nameAndVersion.slice(0, versionIndex) : nameAndVersion;
    return `${scope}/${name}`;
  }
  const versionIndex = spec.indexOf("@");
  return versionIndex >= 0 ? spec.slice(0, versionIndex) : spec;
}

/**
 * @param {string|null|undefined} spec
 * @returns {string|null}
 */
export function packageScopeFromSpec(spec) {
  if (!spec) {
    return null;
  }
  const packageName = packageNameFromSpec(spec);
  return packageName.startsWith("@") ? packageName.split("/")[0] : null;
}

/**
 * @param {unknown} value
 * @returns {TemplateManifest}
 */
function validateTemplateManifest(value) {
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
  return /** @type {TemplateManifest} */ (manifest);
}

/**
 * @param {string} templateRoot
 * @returns {TemplateManifest}
 */
function readTemplateManifest(templateRoot) {
  const manifestPath = path.join(templateRoot, TEMPLATE_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Template at '${templateRoot}' is missing ${TEMPLATE_MANIFEST}.`);
  }
  return validateTemplateManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
}

/**
 * @param {string} templateRoot
 * @returns {TemplateManifest}
 */
function validateTemplateRoot(templateRoot) {
  const manifest = readTemplateManifest(templateRoot);
  const topogramRoot = path.join(templateRoot, "topogram");
  const projectConfigPath = path.join(templateRoot, "topogram.project.json");
  if (!fs.existsSync(topogramRoot) || !fs.statSync(topogramRoot).isDirectory()) {
    throw new Error(`Template '${manifest.id}' is missing topogram/.`);
  }
  if (!fs.existsSync(projectConfigPath) || !fs.statSync(projectConfigPath).isFile()) {
    throw new Error(`Template '${manifest.id}' is missing topogram.project.json.`);
  }
  if (manifest.includesExecutableImplementation) {
    const implementationRoot = path.join(templateRoot, "implementation");
    if (!fs.existsSync(implementationRoot) || !fs.statSync(implementationRoot).isDirectory()) {
      throw new Error(
        `Template '${manifest.id}' declares executable implementation code but is missing implementation/.`
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
function summarizeTemplateTopology(templateRoot) {
  const projectConfigPath = path.join(templateRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  const rawComponents = /** @type {any[]} */ (
    Array.isArray(projectConfig.topology?.components) ? projectConfig.topology.components : []
  );
  /** @type {Array<Record<string, any>>} */
  const components = [];
  for (const component of rawComponents) {
    if (component && typeof component === "object" && typeof component.type === "string") {
      components.push(/** @type {Record<string, any>} */ (component));
    }
  }
  const sortedComponents = [...components].sort((a, b) => {
    const aOrder = SURFACE_ORDER.get(a.type) ?? 100;
    const bOrder = SURFACE_ORDER.get(b.type) ?? 100;
    return aOrder - bOrder;
  });
  const surfaces = [...new Set(sortedComponents.map((component) => String(component.type)))];
  const generators = [
    ...new Set(
      sortedComponents
        .map((component) => component.generator?.id)
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
 * @param {string} templatesRoot
 * @returns {Array<{ id: string, version: string, source: "builtin", name: string, description: string|null, includesExecutableImplementation: boolean, isDefault: boolean, surfaces: string[], generators: string[], stack: string, path: string }>}
 */
export function listBuiltInTemplates(templatesRoot) {
  return [...TEMPLATE_NAMES].sort((a, b) => a.localeCompare(b)).map((name) => {
    const templateRoot = path.join(templatesRoot, name);
    const manifest = validateTemplateRoot(templateRoot);
    const topology = summarizeTemplateTopology(templateRoot);
    return {
      id: manifest.id,
      version: manifest.version,
      source: "builtin",
      name,
      description: manifest.description || null,
      includesExecutableImplementation: Boolean(manifest.includesExecutableImplementation),
      isDefault: name === DEFAULT_TEMPLATE_NAME,
      surfaces: topology.surfaces,
      generators: topology.generators,
      stack: topology.stack,
      path: templateRoot
    };
  });
}

/**
 * @param {string} templateSpec
 * @returns {string}
 */
export function installPackageSpec(templateSpec) {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-"));
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const localNpmConfig = path.join(process.cwd(), ".npmrc");
  const npmConfigEnv = !process.env.NPM_CONFIG_USERCONFIG && fs.existsSync(localNpmConfig)
    ? { NPM_CONFIG_USERCONFIG: localNpmConfig }
    : {};
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
      templateSpec
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ...npmConfigEnv,
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
  const npmrcHint = "Ensure this project has an .npmrc with @attebury:registry=https://npm.pkg.github.com and //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}.";
  const packageAccessHint = "For GitHub Actions, grant the consumer repo package read access under the package settings Manage Actions access section.";
  const authHint = "Set NODE_AUTH_TOKEN to a GitHub token with package read access, or configure npm auth for GitHub Packages.";
  if (result.error?.code === "ENOENT") {
    return [
      `Failed to install template package '${templateSpec}': npm was not found.`,
      "Install Node.js/npm and retry."
    ].join("\n");
  }
  if (/\b(e401|eneedauth)\b/.test(normalized) || normalized.includes("unauthenticated") || normalized.includes("authentication required")) {
    return [
      `Authentication is required to install template package '${templateSpec}' from GitHub Packages.`,
      authHint,
      npmrcHint,
      packageAccessHint,
      output
    ].filter(Boolean).join("\n");
  }
  if (/\be403\b/.test(normalized) || normalized.includes("forbidden") || normalized.includes("permission")) {
    return [
      `Package access was denied while installing template package '${templateSpec}'.`,
      authHint,
      packageAccessHint,
      output
    ].filter(Boolean).join("\n");
  }
  if (/\b(e404|404)\b/.test(normalized) || normalized.includes("not found")) {
    return [
      `Template package '${templateSpec}' was not found, or the current token does not have access to it.`,
      "Check the package name/version and GitHub Packages access.",
      packageAccessHint,
      output
    ].filter(Boolean).join("\n");
  }
  if (/\beintegrity\b/.test(normalized) || normalized.includes("integrity checksum failed")) {
    return [
      `Package integrity failed while installing template package '${templateSpec}'.`,
      "Refresh package-lock.json from the published GitHub Packages tarball instead of a local npm pack tarball.",
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
  if (TEMPLATE_NAMES.has(templateName)) {
    const templateRoot = path.join(templatesRoot, templateName);
    if (!fs.existsSync(templateRoot)) {
      throw new Error(`Template '${templateName}' is not installed at '${templateRoot}'.`);
    }
    return {
      requested: templateName,
      root: templateRoot,
      manifest: validateTemplateRoot(templateRoot),
      source: "builtin",
      packageSpec: null
    };
  }

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

/**
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @returns {void}
 */
function assertProjectOutsideEngine(projectRoot, engineRoot) {
  if (isSameOrInside(path.resolve(engineRoot), path.resolve(projectRoot))) {
    throw new Error(
      `Refusing to create a generated project inside the engine directory. Use a path outside engine, for example '../${path.basename(projectRoot)}'.`
    );
  }
}

/**
 * @param {string} projectRoot
 * @returns {void}
 */
function ensureCreatableProjectRoot(projectRoot) {
  if (!fs.existsSync(projectRoot)) {
    fs.mkdirSync(projectRoot, { recursive: true });
    return;
  }
  if (!fs.statSync(projectRoot).isDirectory()) {
    throw new Error(`Cannot create project at '${projectRoot}' because it is not a directory.`);
  }
  /** @type {string[]} */
  const dirEntries = fs.readdirSync(projectRoot);
  const entries = dirEntries.filter((entry) => entry !== ".DS_Store");
  if (entries.length > 0) {
    throw new Error(`Refusing to create a Topogram project in non-empty directory '${projectRoot}'.`);
  }
}

/**
 * @param {string} templateRoot
 * @param {string} projectRoot
 * @returns {void}
 */
function copyTopogramWorkspace(templateRoot, projectRoot) {
  const topogramRoot = path.join(projectRoot, "topogram");
  fs.cpSync(path.join(templateRoot, "topogram"), topogramRoot, { recursive: true });

  fs.cpSync(
    path.join(templateRoot, "topogram.project.json"),
    path.join(projectRoot, "topogram.project.json")
  );
  const implementationRoot = path.join(templateRoot, "implementation");
  if (fs.existsSync(implementationRoot)) {
    fs.cpSync(
      implementationRoot,
      path.join(projectRoot, "implementation"),
      { recursive: true }
    );
  }
}

/**
 * @param {string} projectRoot
 * @param {ResolvedTemplate} template
 * @param {CatalogTemplateProvenance|null} [templateProvenance]
 * @returns {Record<string, any>}
 */
function writeProjectTemplateMetadata(projectRoot, template, templateProvenance = null) {
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  projectConfig.template = projectTemplateMetadata(template, templateProvenance);
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");
  return projectConfig;
}

/**
 * @param {ResolvedTemplate} template
 * @param {CatalogTemplateProvenance|null} [templateProvenance]
 * @returns {{ id: string, version: string, source: string, requested: string, sourceSpec: string, sourceRoot: string|null, includesExecutableImplementation: boolean, catalog?: CatalogTemplateProvenance }}
 */
function projectTemplateMetadata(template, templateProvenance = null) {
  /** @type {{ id: string, version: string, source: string, requested: string, sourceSpec: string, sourceRoot: string|null, includesExecutableImplementation: boolean, catalog?: CatalogTemplateProvenance }} */
  const metadata = {
    id: template.manifest.id,
    version: template.manifest.version,
    source: template.source,
    requested: templateProvenance?.id || template.requested,
    sourceSpec: template.packageSpec || template.requested,
    sourceRoot: template.source === "local" ? template.root : null,
    includesExecutableImplementation: Boolean(template.manifest.includesExecutableImplementation)
  };
  if (templateProvenance) {
    metadata.catalog = templateProvenance;
  }
  return metadata;
}

/**
 * @param {Record<string, any>} input
 * @returns {TemplateUpdateDiagnostic}
 */
function templateUpdateDiagnostic(input) {
  return {
    code: String(input.code || "template_update_failed"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Template update failed."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null,
    step: typeof input.step === "string" ? input.step : null
  };
}

/**
 * @param {unknown} value
 * @param {string} policyPath
 * @returns {TemplatePolicy}
 */
function validateTemplatePolicy(value, policyPath) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${TEMPLATE_POLICY_FILE} must contain a JSON object.`);
  }
  const policy = /** @type {Record<string, unknown>} */ (value);
  const version = typeof policy.version === "string" && policy.version ? policy.version : "0.1";
  const allowedSources = Array.isArray(policy.allowedSources) ? policy.allowedSources : ["builtin", "local", "package"];
  const invalidSource = allowedSources.find((source) => !["builtin", "local", "package"].includes(String(source)));
  if (invalidSource) {
    throw new Error(`${policyPath} has invalid allowedSources value '${String(invalidSource)}'.`);
  }
  const allowedTemplateIds = Array.isArray(policy.allowedTemplateIds)
    ? policy.allowedTemplateIds.map(String).filter(Boolean)
    : [];
  const allowedPackageScopes = Array.isArray(policy.allowedPackageScopes)
    ? policy.allowedPackageScopes.map(String).filter(Boolean)
    : [];
  const executableImplementation = policy.executableImplementation === "deny" || policy.executableImplementation === "warn"
    ? policy.executableImplementation
    : "allow";
  const pinnedVersions = policy.pinnedVersions && typeof policy.pinnedVersions === "object" && !Array.isArray(policy.pinnedVersions)
    ? Object.fromEntries(Object.entries(policy.pinnedVersions).filter(([, pin]) => typeof pin === "string"))
    : {};
  return {
    version,
    allowedSources: /** @type {Array<"builtin"|"local"|"package">} */ (allowedSources),
    allowedTemplateIds,
    allowedPackageScopes,
    executableImplementation,
    pinnedVersions
  };
}

/**
 * @param {string} projectRoot
 * @returns {TemplatePolicyInfo}
 */
export function loadTemplatePolicy(projectRoot) {
  const policyPath = path.join(projectRoot, TEMPLATE_POLICY_FILE);
  if (!fs.existsSync(policyPath)) {
    return {
      path: policyPath,
      policy: null,
      exists: false,
      diagnostics: []
    };
  }
  try {
    return {
      path: policyPath,
      policy: validateTemplatePolicy(JSON.parse(fs.readFileSync(policyPath, "utf8")), policyPath),
      exists: true,
      diagnostics: []
    };
  } catch (error) {
    return {
      path: policyPath,
      policy: null,
      exists: true,
      diagnostics: [templateUpdateDiagnostic({
        code: "template_policy_invalid",
        message: error instanceof Error ? error.message : String(error),
        path: policyPath,
        suggestedFix: "Fix topogram.template-policy.json or regenerate it with `topogram template policy init`.",
        step: "policy"
      })]
    };
  }
}

/**
 * @param {ResolvedTemplate} template
 * @returns {TemplatePolicy}
 */
function defaultTemplatePolicyForTemplate(template) {
  const allowedPackageScopes = [];
  const idScope = template.source === "package"
    ? packageScopeFromSpec(template.packageSpec || template.requested)
    : null;
  if (template.source === "package" && idScope) {
    allowedPackageScopes.push(idScope);
  }
  return {
    version: "0.1",
    allowedSources: ["builtin", "local", "package"],
    allowedTemplateIds: [template.manifest.id],
    allowedPackageScopes,
    executableImplementation: "allow",
    pinnedVersions: {}
  };
}

/**
 * @param {string} projectRoot
 * @param {TemplatePolicy} policy
 * @returns {TemplatePolicy}
 */
export function writeTemplatePolicy(projectRoot, policy) {
  fs.writeFileSync(path.join(projectRoot, TEMPLATE_POLICY_FILE), `${stableJsonStringify(policy)}\n`, "utf8");
  return policy;
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} projectConfig
 * @returns {TemplatePolicy}
 */
export function writeTemplatePolicyForProject(projectRoot, projectConfig) {
  const current = currentTemplateMetadata(projectConfig);
  /** @type {string[]} */
  const allowedPackageScopes = [];
  if (current.source === "package") {
    const currentScope = packageScopeFromSpec(current.sourceSpec) ||
      (current.id?.startsWith("@") ? current.id.split("/")[0] : null);
    if (currentScope) {
      allowedPackageScopes.push(currentScope);
    }
  }
  return writeTemplatePolicy(projectRoot, {
    version: "0.1",
    allowedSources: ["builtin", "local", "package"],
    allowedTemplateIds: current.id ? [current.id] : [],
    allowedPackageScopes,
    executableImplementation: "allow",
    pinnedVersions: {}
  });
}

/**
 * @param {TemplatePolicyInfo} policyInfo
 * @param {ResolvedTemplate} template
 * @param {string} step
 * @returns {TemplateUpdateDiagnostic[]}
 */
export function templatePolicyDiagnosticsForTemplate(policyInfo, template, step) {
  if (policyInfo.diagnostics.length > 0) {
    return policyInfo.diagnostics;
  }
  if (!policyInfo.policy) {
    return [];
  }
  const policy = policyInfo.policy;
  /** @type {TemplateUpdateDiagnostic[]} */
  const diagnostics = [];
  if (policy.allowedSources.length > 0 && !policy.allowedSources.includes(template.source)) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_source_denied",
      message: `Template source '${template.source}' is not allowed by ${TEMPLATE_POLICY_FILE}.`,
      path: policyInfo.path,
      suggestedFix: `Run \`topogram template policy init\` to reset from the current project, or add '${template.source}' to allowedSources after review.`,
      step
    }));
  }
  if (policy.allowedTemplateIds.length > 0 && !policy.allowedTemplateIds.includes(template.manifest.id)) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_id_denied",
      message: `Template '${template.manifest.id}' is not allowed by ${TEMPLATE_POLICY_FILE}.`,
      path: policyInfo.path,
      suggestedFix: `Run \`topogram template policy pin ${template.manifest.id}@${template.manifest.version}\` after review, or choose an allowed template.`,
      step
    }));
  }
  if (template.source === "package" && policy.allowedPackageScopes && policy.allowedPackageScopes.length > 0) {
    const scope = packageScopeFromSpec(template.packageSpec || template.requested) ||
      (template.manifest.id.startsWith("@") ? template.manifest.id.split("/")[0] : null);
    if (!scope || !policy.allowedPackageScopes.includes(scope)) {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_package_scope_denied",
        message: `Template package scope '${scope || "(unscoped)"}' is not allowed by ${TEMPLATE_POLICY_FILE}.`,
        path: policyInfo.path,
        suggestedFix: `Add '${scope || "(unscoped)"}' to allowedPackageScopes after review, or choose a package from an allowed scope.`,
        step
      }));
    }
  }
  const pinnedVersion = policy.pinnedVersions?.[template.manifest.id];
  if (pinnedVersion && pinnedVersion !== template.manifest.version) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_version_mismatch",
      message: `Template '${template.manifest.id}' is pinned to version '${pinnedVersion}', but candidate version is '${template.manifest.version}'.`,
      path: policyInfo.path,
      suggestedFix: `Run \`topogram template policy pin ${template.manifest.id}@${template.manifest.version}\` after review, or use version '${pinnedVersion}'.`,
      step
    }));
  }
  if (template.manifest.includesExecutableImplementation) {
    if (policy.executableImplementation === "deny") {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_executable_denied",
        message: `Template '${template.manifest.id}' includes executable implementation code, which is denied by ${TEMPLATE_POLICY_FILE}.`,
        path: policyInfo.path,
        suggestedFix: "Use a non-executable template, or set executableImplementation to 'allow' after reviewing implementation/.",
        step
      }));
    } else if (policy.executableImplementation === "warn") {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_executable_warning",
        severity: "warning",
        message: `Template '${template.manifest.id}' includes executable implementation code.`,
        path: policyInfo.path,
        suggestedFix: "Review implementation/ before running topogram generate.",
        step
      }));
    }
  }
  return diagnostics;
}

/**
 * @param {string} projectRoot
 * @param {ResolvedTemplate} template
 * @param {string} step
 * @returns {TemplateUpdateDiagnostic[]}
 */
function templatePolicyDiagnosticsForProject(projectRoot, template, step) {
  return templatePolicyDiagnosticsForTemplate(loadTemplatePolicy(projectRoot), template, step);
}

/**
 * @param {TemplateUpdateDiagnostic[]} diagnostics
 * @returns {string[]}
 */
function issueMessagesFromDiagnostics(diagnostics) {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
}

/**
 * @param {Record<string, any>} projectConfig
 * @returns {{ id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null }}
 */
function currentTemplateMetadata(projectConfig) {
  const currentTemplate = projectConfig.template || {};
  return {
    id: typeof currentTemplate.id === "string" ? currentTemplate.id : null,
    version: typeof currentTemplate.version === "string" ? currentTemplate.version : null,
    source: typeof currentTemplate.source === "string" ? currentTemplate.source : null,
    sourceSpec: typeof currentTemplate.sourceSpec === "string" ? currentTemplate.sourceSpec : null,
    requested: typeof currentTemplate.requested === "string" ? currentTemplate.requested : null
  };
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function normalizeTemplateUpdateActionPath(filePath) {
  const normalized = path.posix.normalize(filePath.replace(/\\/g, "/"));
  if (
    !filePath ||
    path.isAbsolute(filePath) ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".."
  ) {
    throw new Error(`Template update action requires a relative template-owned file path: ${filePath || "(missing)"}`);
  }
  return normalized;
}

/**
 * @param {any} bytes
 * @returns {boolean}
 */
function isLikelyText(bytes) {
  if (bytes.includes(0)) {
    return false;
  }
  const length = Math.min(bytes.length, 4096);
  let suspicious = 0;
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index];
    if (byte === 9 || byte === 10 || byte === 13) {
      continue;
    }
    if (byte < 32 || byte === 127) {
      suspicious += 1;
    }
  }
  return length === 0 || suspicious / length < 0.02;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function linesForDiff(text) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

/**
 * @param {string[]} before
 * @param {string[]} after
 * @returns {Array<{ type: "same"|"added"|"removed", text: string }>}
 */
function diffLines(before, after) {
  const rows = before.length;
  const columns = after.length;
  /** @type {number[][]} */
  const table = Array.from({ length: rows + 1 }, () => Array(columns + 1).fill(0));
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] = before[row] === after[column]
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  /** @type {Array<{ type: "same"|"added"|"removed", text: string }>} */
  const changes = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (before[row] === after[column]) {
      changes.push({ type: "same", text: before[row] });
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      changes.push({ type: "removed", text: before[row] });
      row += 1;
    } else {
      changes.push({ type: "added", text: after[column] });
      column += 1;
    }
  }
  while (row < rows) {
    changes.push({ type: "removed", text: before[row] });
    row += 1;
  }
  while (column < columns) {
    changes.push({ type: "added", text: after[column] });
    column += 1;
  }
  return changes;
}

/**
 * @param {string} relativePath
 * @param {string|null} beforeText
 * @param {string|null} afterText
 * @returns {string|null}
 */
function unifiedTextDiff(relativePath, beforeText, afterText) {
  if (beforeText === null && afterText === null) {
    return null;
  }
  const beforeLines = beforeText === null ? [] : linesForDiff(beforeText);
  const afterLines = afterText === null ? [] : linesForDiff(afterText);
  const changes = diffLines(beforeLines, afterLines);
  const lines = [
    `--- current/${relativePath}`,
    `+++ candidate/${relativePath}`,
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`
  ];
  for (const change of changes) {
    const prefix = change.type === "added" ? "+" : change.type === "removed" ? "-" : " ";
    lines.push(`${prefix}${change.text}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} value
 * @returns {number}
 */
function utf8ByteLength(value) {
  let length = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) || 0;
    if (codePoint <= 0x7f) {
      length += 1;
    } else if (codePoint <= 0x7ff) {
      length += 2;
    } else if (codePoint <= 0xffff) {
      length += 3;
    } else {
      length += 4;
    }
  }
  return length;
}

/**
 * @param {any} value
 * @returns {any}
 */
function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    /** @type {Record<string, any>} */
    const sorted = {};
    for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
      sorted[key] = sortJsonValue(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * @param {any} value
 * @returns {string}
 */
function stableJsonStringify(value) {
  return JSON.stringify(sortJsonValue(value), null, 2);
}

/**
 * @param {string} root
 * @param {string} currentDir
 * @param {string[]} files
 * @returns {void}
 */
function collectFiles(root, currentDir, files) {
  if (!fs.existsSync(currentDir)) {
    return;
  }
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.name === "node_modules" || entry.name === ".tmp") {
      continue;
    }
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(root, entryPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(path.relative(root, entryPath).replace(/\\/g, "/"));
    }
  }
}

/**
 * @param {string|null} absolutePath
 * @param {string|null} content
 * @returns {{ sha256: string, size: number, text: string|null, binary: boolean, diffOmitted: boolean }|null}
 */
function fileSnapshot(absolutePath, content = null) {
  if (!absolutePath && content === null) {
    return null;
  }
  if (content !== null) {
    return {
      sha256: crypto.createHash("sha256").update(content, "utf8").digest("hex"),
      size: utf8ByteLength(content),
      text: content,
      binary: false,
      diffOmitted: false
    };
  }
  const bytes = fs.readFileSync(absolutePath || "");
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (bytes.length > MAX_TEXT_DIFF_BYTES) {
    return { sha256, size: bytes.length, text: null, binary: false, diffOmitted: true };
  }
  if (!isLikelyText(bytes)) {
    return { sha256, size: bytes.length, text: null, binary: true, diffOmitted: false };
  }
  return { sha256, size: bytes.length, text: bytes.toString("utf8"), binary: false, diffOmitted: false };
}

/**
 * @param {{ absolutePath: string|null, content: string|null }} file
 * @returns {{ sha256: string, size: number }}
 */
function fileHash(file) {
  const snapshot = fileSnapshot(file.absolutePath, file.content);
  if (!snapshot) {
    throw new Error("Cannot hash missing template-owned file.");
  }
  return {
    sha256: snapshot.sha256,
    size: snapshot.size
  };
}

/**
 * @param {ResolvedTemplate} template
 * @returns {Map<string, { path: string, content: string|null, absolutePath: string|null }>}
 */
function candidateTemplateFiles(template) {
  const files = new Map();
  for (const rootName of ["topogram", "implementation"]) {
    const root = path.join(template.root, rootName);
    if (!fs.existsSync(root)) {
      continue;
    }
    /** @type {string[]} */
    const relativeFiles = [];
    collectFiles(template.root, root, relativeFiles);
    for (const relativePath of relativeFiles) {
      files.set(relativePath, {
        path: relativePath,
        content: null,
        absolutePath: path.join(template.root, relativePath)
      });
    }
  }
  const candidateProjectConfig = JSON.parse(fs.readFileSync(path.join(template.root, "topogram.project.json"), "utf8"));
  candidateProjectConfig.template = projectTemplateMetadata(template);
  files.set("topogram.project.json", {
    path: "topogram.project.json",
    content: `${stableJsonStringify(candidateProjectConfig)}\n`,
    absolutePath: null
  });
  return files;
}

/**
 * @param {string} projectRoot
 * @param {boolean} includeImplementation
 * @param {Record<string, any>} projectConfig
 * @returns {Map<string, { path: string, absolutePath: string|null, content: string|null }>}
 */
function currentTemplateOwnedFiles(projectRoot, includeImplementation, projectConfig) {
  const files = new Map();
  for (const rootName of includeImplementation ? ["topogram", "implementation"] : ["topogram"]) {
    const root = path.join(projectRoot, rootName);
    if (!fs.existsSync(root)) {
      continue;
    }
    /** @type {string[]} */
    const relativeFiles = [];
    collectFiles(projectRoot, root, relativeFiles);
    for (const relativePath of relativeFiles) {
      files.set(relativePath, {
        path: relativePath,
        absolutePath: path.join(projectRoot, relativePath),
        content: null
      });
    }
  }
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  if (fs.existsSync(projectConfigPath)) {
    files.set("topogram.project.json", {
      path: "topogram.project.json",
      absolutePath: null,
      content: `${stableJsonStringify(projectConfig)}\n`
    });
  }
  return files;
}

/**
 * @param {Record<string, any>} projectConfig
 * @returns {boolean}
 */
function includesTemplateImplementation(projectConfig) {
  const template = projectConfig.template || {};
  return Boolean(
    projectConfig.implementation ||
    template.includesExecutableImplementation
  );
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} projectConfig
 * @returns {Map<string, TemplateOwnedFileRecord>}
 */
function currentTemplateOwnedFileHashes(projectRoot, projectConfig) {
  const files = currentTemplateOwnedFiles(projectRoot, includesTemplateImplementation(projectConfig), projectConfig);
  return new Map([...files.entries()].map(([relativePath, file]) => {
    const hash = fileHash(file);
    return [relativePath, { path: relativePath, ...hash }];
  }));
}

/**
 * @param {string} projectRoot
 * @returns {{ version: string, template: Record<string, any>, files: TemplateOwnedFileRecord[] }|null}
 */
function readTemplateFilesManifest(projectRoot) {
  const manifestPath = path.join(projectRoot, TEMPLATE_FILES_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} projectConfig
 * @returns {{ version: string, template: Record<string, any>, files: TemplateOwnedFileRecord[] }}
 */
export function writeTemplateFilesManifest(projectRoot, projectConfig) {
  const fileRecords = [...currentTemplateOwnedFileHashes(projectRoot, projectConfig).values()]
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    version: "0.1",
    template: {
      id: projectConfig.template?.id || null,
      version: projectConfig.template?.version || null,
      source: projectConfig.template?.source || null,
      sourceSpec: projectConfig.template?.sourceSpec || null,
      requested: projectConfig.template?.requested || null,
      catalog: projectConfig.template?.catalog || null
    },
    files: fileRecords
  };
  fs.writeFileSync(path.join(projectRoot, TEMPLATE_FILES_MANIFEST), `${stableJsonStringify(manifest)}\n`, "utf8");
  return manifest;
}

/**
 * @param {string} projectRoot
 * @param {{ version: string, template: Record<string, any>, files: TemplateOwnedFileRecord[] }} manifest
 * @returns {void}
 */
function writeTemplateFilesManifestData(projectRoot, manifest) {
  const sortedManifest = {
    ...manifest,
    files: [...manifest.files].sort((left, right) => left.path.localeCompare(right.path))
  };
  fs.writeFileSync(path.join(projectRoot, TEMPLATE_FILES_MANIFEST), `${stableJsonStringify(sortedManifest)}\n`, "utf8");
}

/**
 * @param {string} projectRoot
 * @param {{ version: string, template: Record<string, any>, files: TemplateOwnedFileRecord[] }} manifest
 * @param {string} relativePath
 * @param {TemplateOwnedFileRecord|null} record
 * @returns {void}
 */
function updateTemplateFilesManifestRecord(projectRoot, manifest, relativePath, record) {
  const byPath = new Map(manifest.files.map((file) => [file.path, file]));
  if (record) {
    byPath.set(relativePath, record);
  } else {
    byPath.delete(relativePath);
  }
  writeTemplateFilesManifestData(projectRoot, {
    ...manifest,
    files: [...byPath.values()]
  });
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @returns {{ ok: boolean, mode: "plan", writes: false, current: { id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null }, candidate: { id: string, version: string, source: string, sourceSpec: string, requested: string }, compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: { added: number, changed: number, currentOnly: number, unchanged: number }, files: Array<{ path: string, kind: "added"|"changed"|"current-only"|"unchanged", current: { sha256: string, size: number }|null, candidate: { sha256: string, size: number }|null, binary: boolean, diffOmitted: boolean, unifiedDiff: string|null }> }}
 */
export function buildTemplateUpdatePlan({
  projectRoot,
  projectConfig,
  templateName = null,
  templatesRoot
}) {
  const currentTemplate = projectConfig.template || {};
  const templateSpec = templateName || currentTemplate.sourceSpec || currentTemplate.requested || currentTemplate.id;
  if (!templateSpec || typeof templateSpec !== "string") {
    throw new Error("Cannot plan template update because topogram.project.json has no template source spec.");
  }
  const candidateTemplate = resolveTemplate(templateSpec, templatesRoot);
  const candidateMetadata = projectTemplateMetadata(candidateTemplate);
  /** @type {TemplateUpdateDiagnostic[]} */
  const diagnostics = templatePolicyDiagnosticsForProject(projectRoot, candidateTemplate, "policy");
  if (currentTemplate.id && currentTemplate.id !== candidateMetadata.id) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_id_mismatch",
      message: `Candidate template id '${candidateMetadata.id}' does not match current template id '${currentTemplate.id}'.`,
      path: path.join(projectRoot, "topogram.project.json"),
      suggestedFix: "Use a template with the same id, or create a new project from the other template.",
      step: "resolve-candidate"
    }));
  }
  const candidateFiles = candidateTemplateFiles(candidateTemplate);
  const currentFiles = currentTemplateOwnedFiles(
    projectRoot,
    Boolean(includesTemplateImplementation(projectConfig) || candidateMetadata.includesExecutableImplementation),
    projectConfig
  );
  const allPaths = new Set([...candidateFiles.keys(), ...currentFiles.keys()]);
  /** @type {Array<{ path: string, kind: "added"|"changed"|"current-only"|"unchanged", current: { sha256: string, size: number }|null, candidate: { sha256: string, size: number }|null, binary: boolean, diffOmitted: boolean, unifiedDiff: string|null }>} */
  const files = [];

  for (const relativePath of [...allPaths].sort((a, b) => a.localeCompare(b))) {
    const candidateFile = candidateFiles.get(relativePath) || null;
    const currentFile = currentFiles.get(relativePath) || null;
    const candidateSnapshot = candidateFile
      ? fileSnapshot(candidateFile.absolutePath, candidateFile.content)
      : null;
    const currentSnapshot = currentFile
      ? fileSnapshot(currentFile.absolutePath, currentFile.content)
      : null;
    let kind = /** @type {"added"|"changed"|"current-only"|"unchanged"} */ ("unchanged");
    if (!currentSnapshot && candidateSnapshot) {
      kind = "added";
    } else if (currentSnapshot && !candidateSnapshot) {
      kind = "current-only";
    } else if (currentSnapshot && candidateSnapshot && (
      currentSnapshot.sha256 !== candidateSnapshot.sha256 ||
      currentSnapshot.size !== candidateSnapshot.size
    )) {
      kind = "changed";
    }
    const binary = Boolean(currentSnapshot?.binary || candidateSnapshot?.binary);
    const diffOmitted = binary || Boolean(currentSnapshot?.diffOmitted || candidateSnapshot?.diffOmitted);
    files.push({
      path: relativePath,
      kind,
      current: currentSnapshot ? { sha256: currentSnapshot.sha256, size: currentSnapshot.size } : null,
      candidate: candidateSnapshot ? { sha256: candidateSnapshot.sha256, size: candidateSnapshot.size } : null,
      binary,
      diffOmitted,
      unifiedDiff: diffOmitted
        ? null
        : unifiedTextDiff(relativePath, currentSnapshot?.text || null, candidateSnapshot?.text || null)
    });
  }
  const visibleFiles = files.filter((file) => file.kind !== "unchanged");
  const summary = {
    added: visibleFiles.filter((file) => file.kind === "added").length,
    changed: visibleFiles.filter((file) => file.kind === "changed").length,
    currentOnly: visibleFiles.filter((file) => file.kind === "current-only").length,
    unchanged: files.filter((file) => file.kind === "unchanged").length
  };
  const issues = issueMessagesFromDiagnostics(diagnostics);
  return {
    ok: issues.length === 0,
    mode: "plan",
    writes: false,
    current: currentTemplateMetadata(projectConfig),
    candidate: {
      id: candidateMetadata.id,
      version: candidateMetadata.version,
      source: candidateMetadata.source,
      sourceSpec: candidateMetadata.sourceSpec,
      requested: candidateMetadata.requested
    },
    compatible: issues.length === 0,
    issues,
    diagnostics,
    summary,
    files: visibleFiles
  };
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @returns {{ ok: boolean, mode: "check", writes: false, current: ReturnType<typeof buildTemplateUpdatePlan>["current"], candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"], compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], files: ReturnType<typeof buildTemplateUpdatePlan>["files"] }}
 */
export function buildTemplateUpdateCheck(options) {
  const plan = buildTemplateUpdatePlan(options);
  const diagnostics = [...plan.diagnostics];
  if (plan.ok && plan.files.length > 0) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_update_available",
      message: `Template update has ${plan.files.length} template-owned file change(s).`,
      path: options.projectRoot,
      suggestedFix: "Run `topogram template update --plan` to review, then `topogram template update --apply` after approval.",
      step: "check"
    }));
  }
  const issues = issueMessagesFromDiagnostics(diagnostics);
  return {
    ...plan,
    ok: issues.length === 0,
    mode: "check",
    writes: false,
    issues,
    diagnostics
  };
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @param {ReturnType<typeof buildTemplateUpdatePlan>} plan
 * @param {"apply"|"status"} mode
 * @returns {{ diagnostics: TemplateUpdateDiagnostic[], issues: string[], skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }> }}
 */
function analyzeTemplateUpdateApplication(options, plan, mode) {
  /** @type {Array<{ path: string, kind: "current-only", reason: string }>} */
  const skipped = [];
  /** @type {Array<{ path: string, reason: string }>} */
  const conflicts = [];
  /** @type {TemplateUpdateDiagnostic[]} */
  const diagnostics = [...plan.diagnostics];
  if (!plan.ok) {
    return {
      diagnostics,
      issues: issueMessagesFromDiagnostics(diagnostics),
      skipped,
      conflicts
    };
  }

  const baselineManifest = readTemplateFilesManifest(options.projectRoot);
  if (!baselineManifest) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_baseline_missing",
      message: `Cannot apply template update because ${TEMPLATE_FILES_MANIFEST} is missing. Review current template-owned files, then run 'topogram trust template' to record the baseline before applying template updates.`,
      path: path.join(options.projectRoot, TEMPLATE_FILES_MANIFEST),
      suggestedFix: "Review current template-owned files, then run `topogram trust template` to record the baseline before applying template updates.",
      step: "baseline"
    }));
  }
  const baselineByPath = new Map((baselineManifest?.files || []).map((file) => [file.path, file]));
  const currentHashes = currentTemplateOwnedFileHashes(options.projectRoot, options.projectConfig);
  for (const file of plan.files) {
    if (file.kind === "current-only") {
      skipped.push({
        path: file.path,
        kind: "current-only",
        reason: "Deletes are not applied by template update --apply in this milestone."
      });
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_current_only_skipped",
        severity: "warning",
        message: `Current-only file '${file.path}' needs manual delete review. Deletes are not applied by template update --apply in this milestone.`,
        path: path.join(options.projectRoot, file.path),
        suggestedFix: "Delete the file manually after review if it should be removed from this project.",
        step: mode
      }));
      continue;
    }
    if (file.kind !== "added" && file.kind !== "changed") {
      continue;
    }
    const baseline = baselineByPath.get(file.path) || null;
    const currentHash = currentHashes.get(file.path) || null;
    if (!fileMatchesBaseline(baseline, currentHash)) {
      const reason = baseline
        ? "Current file differs from the last trusted template-owned baseline."
        : "Current file is not part of the trusted template-owned baseline.";
      conflicts.push({
        path: file.path,
        reason
      });
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_update_conflict",
        message: `Template update conflict in '${file.path}': ${reason}`,
        path: path.join(options.projectRoot, file.path),
        suggestedFix: "Review local edits; keep them manually or refresh the baseline with `topogram trust template` after review.",
        step: "conflict-check"
      }));
    }
  }
  return {
    diagnostics,
    issues: issueMessagesFromDiagnostics(diagnostics),
    skipped,
    conflicts
  };
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @returns {{ ok: boolean, mode: "status", writes: false, current: ReturnType<typeof buildTemplateUpdatePlan>["current"], candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"], compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], applied: Array<{ path: string, kind: "added"|"changed" }>, skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }>, files: ReturnType<typeof buildTemplateUpdatePlan>["files"] }}
 */
export function buildTemplateUpdateStatus(options) {
  const plan = buildTemplateUpdatePlan(options);
  const analysis = analyzeTemplateUpdateApplication(options, plan, "status");
  const diagnostics = [...analysis.diagnostics];
  if (plan.ok && plan.files.length > 0) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_update_available",
      message: `Template update has ${plan.files.length} template-owned file change(s).`,
      path: options.projectRoot,
      suggestedFix: "Run `topogram template update --plan` to review, then `topogram template update --apply` after approval.",
      step: "status"
    }));
  }
  const issues = issueMessagesFromDiagnostics(diagnostics);
  return {
    ...plan,
    ok: issues.length === 0,
    mode: "status",
    writes: false,
    issues,
    diagnostics,
    applied: [],
    skipped: analysis.skipped,
    conflicts: analysis.conflicts
  };
}

/**
 * @param {{ absolutePath: string|null, content: string|null }} candidateFile
 * @param {string} destinationPath
 * @returns {void}
 */
function writeCandidateFile(candidateFile, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  if (candidateFile.content !== null) {
    fs.writeFileSync(destinationPath, candidateFile.content, "utf8");
    return;
  }
  if (!candidateFile.absolutePath) {
    throw new Error(`Cannot apply template file without content or source path: ${destinationPath}`);
  }
  fs.cpSync(candidateFile.absolutePath, destinationPath);
}

/**
 * @param {TemplateOwnedFileRecord|null} baseline
 * @param {{ sha256: string, size: number }|null} currentHash
 * @returns {boolean}
 */
function fileMatchesBaseline(baseline, currentHash) {
  if (!baseline && !currentHash) {
    return true;
  }
  if (!baseline || !currentHash) {
    return false;
  }
  return baseline.sha256 === currentHash.sha256 && baseline.size === currentHash.size;
}

/**
 * @param {string} projectRoot
 * @param {string} action
 * @returns {TemplateUpdateDiagnostic}
 */
function templateBaselineMissingDiagnostic(projectRoot, action) {
  return templateUpdateDiagnostic({
    code: "template_baseline_missing",
    message: `Cannot ${action} because ${TEMPLATE_FILES_MANIFEST} is missing. Review current template-owned files, then run 'topogram trust template' to record the baseline before applying template updates.`,
    path: path.join(projectRoot, TEMPLATE_FILES_MANIFEST),
    suggestedFix: "Review current template-owned files, then run `topogram trust template` to record the baseline before applying template updates.",
    step: "baseline"
  });
}

/**
 * @param {TemplateUpdateDiagnostic[]} diagnostics
 * @param {ReturnType<typeof buildTemplateUpdatePlan>|null} plan
 * @param {TemplateUpdateFileActionOptions["action"]} action
 * @param {string} relativePath
 * @param {Array<{ path: string, kind: "added"|"changed" }>} applied
 * @param {Array<{ path: string, kind: "accepted-current" }>} accepted
 * @param {Array<{ path: string, kind: "current-only" }>} deleted
 * @param {Array<{ path: string, reason: string }>} conflicts
 * @param {ReturnType<typeof currentTemplateMetadata>} [current]
 * @returns {{ ok: boolean, mode: TemplateUpdateFileActionOptions["action"], writes: boolean, current: ReturnType<typeof currentTemplateMetadata>, candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"]|null, compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], applied: Array<{ path: string, kind: "added"|"changed" }>, accepted: Array<{ path: string, kind: "accepted-current" }>, deleted: Array<{ path: string, kind: "current-only" }>, skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }>, files: ReturnType<typeof buildTemplateUpdatePlan>["files"], action: TemplateUpdateFileActionOptions["action"], path: string }}
 */
function templateUpdateFileActionResult(diagnostics, plan, action, relativePath, applied, accepted, deleted, conflicts, current = { id: null, version: null, source: null, sourceSpec: null, requested: null }) {
  const issues = issueMessagesFromDiagnostics(diagnostics);
  return {
    ...(plan || {}),
    ok: issues.length === 0,
    mode: action,
    writes: applied.length > 0 || accepted.length > 0 || deleted.length > 0,
    current: plan?.current || current,
    candidate: plan?.candidate || null,
    compatible: plan?.compatible || issues.length === 0,
    issues,
    diagnostics,
    summary: plan?.summary || { added: 0, changed: 0, currentOnly: 0, unchanged: 0 },
    applied,
    accepted,
    deleted,
    skipped: [],
    conflicts,
    files: plan?.files || [],
    action,
    path: relativePath
  };
}

/**
 * @param {TemplateUpdateFileActionOptions} options
 * @returns {{ ok: boolean, mode: "accept-current"|"accept-candidate"|"delete-current", writes: boolean, current: ReturnType<typeof currentTemplateMetadata>, candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"]|null, compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], applied: Array<{ path: string, kind: "added"|"changed" }>, accepted: Array<{ path: string, kind: "accepted-current" }>, deleted: Array<{ path: string, kind: "current-only" }>, skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }>, files: ReturnType<typeof buildTemplateUpdatePlan>["files"], action: "accept-current"|"accept-candidate"|"delete-current", path: string }}
 */
export function applyTemplateUpdateFileAction(options) {
  const relativePath = normalizeTemplateUpdateActionPath(options.filePath);
  /** @type {TemplateUpdateDiagnostic[]} */
  const diagnostics = [];
  /** @type {Array<{ path: string, kind: "added"|"changed" }>} */
  const applied = [];
  /** @type {Array<{ path: string, kind: "accepted-current" }>} */
  const accepted = [];
  /** @type {Array<{ path: string, kind: "current-only" }>} */
  const deleted = [];
  /** @type {Array<{ path: string, reason: string }>} */
  const conflicts = [];
  const baselineManifest = readTemplateFilesManifest(options.projectRoot);
  const current = currentTemplateMetadata(options.projectConfig);
  if (!baselineManifest) {
    diagnostics.push(templateBaselineMissingDiagnostic(options.projectRoot, options.action));
    return templateUpdateFileActionResult(diagnostics, null, options.action, relativePath, applied, accepted, deleted, conflicts, current);
  }

  if (options.action === "accept-current") {
    const currentHashes = currentTemplateOwnedFileHashes(options.projectRoot, options.projectConfig);
    const currentHash = currentHashes.get(relativePath) || null;
    if (!currentHash) {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_file_not_current",
        message: `Cannot accept current file '${relativePath}' because it is not a current template-owned file.`,
        path: path.join(options.projectRoot, relativePath),
        suggestedFix: "Pass a file under topogram/, topogram.project.json, or trusted implementation/.",
        step: "accept-current"
      }));
      return templateUpdateFileActionResult(diagnostics, null, options.action, relativePath, applied, accepted, deleted, conflicts, current);
    }
    updateTemplateFilesManifestRecord(options.projectRoot, baselineManifest, relativePath, currentHash);
    accepted.push({ path: relativePath, kind: "accepted-current" });
    return templateUpdateFileActionResult(diagnostics, null, options.action, relativePath, applied, accepted, deleted, conflicts, current);
  }

  const plan = buildTemplateUpdatePlan(options);
  diagnostics.push(...plan.diagnostics);
  if (!plan.ok) {
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }
  const file = plan.files.find((item) => item.path === relativePath) || null;
  if (!file) {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_file_unchanged",
      message: `Template-owned file '${relativePath}' has no candidate update action.`,
      path: path.join(options.projectRoot, relativePath),
      suggestedFix: "Run `topogram template update --status` to see files that need adoption.",
      step: options.action
    }));
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }

  const baselineByPath = new Map(baselineManifest.files.map((record) => [record.path, record]));
  const currentHashes = currentTemplateOwnedFileHashes(options.projectRoot, options.projectConfig);
  const baseline = baselineByPath.get(relativePath) || null;
  const currentHash = currentHashes.get(relativePath) || null;

  if (options.action === "delete-current") {
    if (file.kind !== "current-only") {
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_delete_not_current_only",
        message: `Cannot delete '${relativePath}' because it is not a current-only template-owned file.`,
        path: path.join(options.projectRoot, relativePath),
        suggestedFix: "Use delete-current only for files the candidate template removed.",
        step: "delete-current"
      }));
      return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
    }
    if (!fileMatchesBaseline(baseline, currentHash)) {
      const reason = baseline
        ? "Current file differs from the last trusted template-owned baseline."
        : "Current file is not part of the trusted template-owned baseline.";
      conflicts.push({ path: relativePath, reason });
      diagnostics.push(templateUpdateDiagnostic({
        code: "template_update_conflict",
        message: `Template delete conflict in '${relativePath}': ${reason}`,
        path: path.join(options.projectRoot, relativePath),
        suggestedFix: "Review local edits before deleting, or accept current as the new baseline.",
        step: "delete-current"
      }));
      return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
    }
    fs.rmSync(path.join(options.projectRoot, relativePath));
    updateTemplateFilesManifestRecord(options.projectRoot, baselineManifest, relativePath, null);
    deleted.push({ path: relativePath, kind: "current-only" });
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }

  if (file.kind !== "added" && file.kind !== "changed") {
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_candidate_not_applicable",
      message: `Cannot accept candidate for '${relativePath}' because the candidate has no added or changed file.`,
      path: path.join(options.projectRoot, relativePath),
      suggestedFix: "Use accept-candidate only for added or changed candidate files.",
      step: "accept-candidate"
    }));
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }
  if (file.kind === "changed" && !fileMatchesBaseline(baseline, currentHash)) {
    const reason = baseline
      ? "Current file differs from the last trusted template-owned baseline."
      : "Current file is not part of the trusted template-owned baseline.";
    conflicts.push({ path: relativePath, reason });
    diagnostics.push(templateUpdateDiagnostic({
      code: "template_update_conflict",
      message: `Template candidate conflict in '${relativePath}': ${reason}`,
      path: path.join(options.projectRoot, relativePath),
      suggestedFix: "Review local edits before accepting the candidate file.",
      step: "accept-candidate"
    }));
    return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
  }
  const currentTemplate = options.projectConfig.template || {};
  const templateSpec = options.templateName || currentTemplate.sourceSpec || currentTemplate.requested || currentTemplate.id;
  const candidateTemplate = resolveTemplate(templateSpec, options.templatesRoot);
  const candidateFile = candidateTemplateFiles(candidateTemplate).get(relativePath);
  if (!candidateFile) {
    throw new Error(`Cannot accept missing candidate template file: ${relativePath}`);
  }
  writeCandidateFile(candidateFile, path.join(options.projectRoot, relativePath));
  const nextHash = fileHash({
    absolutePath: path.join(options.projectRoot, relativePath),
    content: null
  });
  updateTemplateFilesManifestRecord(options.projectRoot, baselineManifest, relativePath, {
    path: relativePath,
    sha256: nextHash.sha256,
    size: nextHash.size
  });
  applied.push({ path: relativePath, kind: file.kind });
  return templateUpdateFileActionResult(diagnostics, plan, options.action, relativePath, applied, accepted, deleted, conflicts);
}

/**
 * @param {TemplateUpdatePlanOptions} options
 * @returns {{ ok: boolean, mode: "apply", writes: boolean, current: ReturnType<typeof buildTemplateUpdatePlan>["current"], candidate: ReturnType<typeof buildTemplateUpdatePlan>["candidate"], compatible: boolean, issues: string[], diagnostics: TemplateUpdateDiagnostic[], summary: ReturnType<typeof buildTemplateUpdatePlan>["summary"], applied: Array<{ path: string, kind: "added"|"changed" }>, skipped: Array<{ path: string, kind: "current-only", reason: string }>, conflicts: Array<{ path: string, reason: string }>, files: ReturnType<typeof buildTemplateUpdatePlan>["files"] }}
 */
export function applyTemplateUpdate(options) {
  const plan = buildTemplateUpdatePlan(options);
  /** @type {Array<{ path: string, kind: "added"|"changed" }>} */
  const applied = [];
  const analysis = analyzeTemplateUpdateApplication(options, plan, "apply");
  const { diagnostics, issues, skipped, conflicts } = analysis;
  if (!plan.ok || issues.length > 0) {
    return {
      ...plan,
      ok: false,
      mode: "apply",
      writes: false,
      applied,
      skipped,
      conflicts,
      issues,
      diagnostics
    };
  }

  const currentTemplate = options.projectConfig.template || {};
  const templateSpec = options.templateName || currentTemplate.sourceSpec || currentTemplate.requested || currentTemplate.id;
  const candidateTemplate = resolveTemplate(templateSpec, options.templatesRoot);
  const candidateFiles = candidateTemplateFiles(candidateTemplate);
  for (const file of plan.files) {
    if (file.kind !== "added" && file.kind !== "changed") {
      continue;
    }
    const candidateFile = candidateFiles.get(file.path);
    if (!candidateFile) {
      throw new Error(`Cannot apply missing candidate template file: ${file.path}`);
    }
    writeCandidateFile(candidateFile, path.join(options.projectRoot, file.path));
    applied.push({ path: file.path, kind: file.kind });
  }

  if (applied.length > 0) {
    const nextProjectConfig = JSON.parse(fs.readFileSync(path.join(options.projectRoot, "topogram.project.json"), "utf8"));
    writeTemplateFilesManifest(options.projectRoot, nextProjectConfig);
    if (nextProjectConfig.implementation) {
      writeTemplateTrustRecord(options.projectRoot, nextProjectConfig);
    }
  }
  return {
    ...plan,
    ok: true,
    mode: "apply",
    writes: applied.length > 0,
    issues,
    diagnostics,
    applied,
    skipped,
    conflicts
  };
}

/**
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @returns {void}
 */
function writeProjectPackage(projectRoot, engineRoot) {
  const cliDependency = cliDependencyForProject(projectRoot, engineRoot);
  const pkg = {
    name: packageNameFromPath(projectRoot),
    private: true,
    type: "module",
    scripts: {
      explain: "node ./scripts/explain.mjs",
      check: "topogram check",
      "check:json": "topogram check --json",
      generate: "topogram generate",
      "template:status": "topogram template status",
      "template:policy:check": "topogram template policy check",
      "template:policy:explain": "topogram template policy explain",
      "template:update:status": "topogram template update --status",
      "template:update:recommend": "topogram template update --recommend",
      "template:update:plan": "topogram template update --plan",
      "template:update:check": "topogram template update --check",
      "template:update:apply": "topogram template update --apply",
      "trust:status": "topogram trust status",
      "trust:diff": "topogram trust diff",
      verify: "npm run app:compile",
      bootstrap: "npm run app:bootstrap",
      dev: "npm run app:dev",
      "app:bootstrap": "npm --prefix ./app run bootstrap",
      "app:dev": "npm --prefix ./app run dev",
      "app:compile": "npm --prefix ./app run compile",
      "app:smoke": "npm --prefix ./app run smoke",
      "app:runtime-check": "npm --prefix ./app run runtime-check",
      "app:check": "npm run app:compile",
      "app:probe": "npm run app:smoke && npm run app:runtime-check",
      "app:runtime": "npm --prefix ./app run runtime"
    },
    devDependencies: {
      [cliDependency.name]: cliDependency.spec
    }
  };
  fs.writeFileSync(path.join(projectRoot, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  writeProjectNpmConfig(projectRoot, cliDependency);
}

/**
 * @param {string} projectRoot
 * @returns {void}
 */
function writeExplainScript(projectRoot) {
  const scriptDir = path.join(projectRoot, "scripts");
  fs.mkdirSync(scriptDir, { recursive: true });
  const script = `const message = \`
Topogram app workflow

1. Edit:
   topogram/
   topogram.project.json

2. Validate:
   npm run check

3. Regenerate:
   npm run generate

4. Verify generated app:
   npm run verify

5. Run locally:
   npm run bootstrap
   npm run dev

6. Probe the running app from another terminal:
   npm run app:probe

Or run self-contained local runtime verification:
   npm run app:runtime

Useful inspection:
   npm run check:json
   npm run template:status
   npm run template:policy:check
   npm run template:policy:explain
   npm run template:update:status
   npm run template:update:recommend
   npm run template:update:plan
   npm run template:update:check
   npm run template:update:apply
   npm run trust:status
   npm run trust:diff
\`;

console.log(message.trimEnd());
`;
  fs.writeFileSync(path.join(scriptDir, "explain.mjs"), script, "utf8");
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} projectConfig
 * @returns {void}
 */
function writeProjectReadme(projectRoot, projectConfig) {
  const template = projectConfig.template || {};
  const templateName = template.id || "unknown";
  const workflowCommands = [
    "npm install",
    "npm run explain",
    "npm run check",
    "npm run template:policy:check",
    ...(template.includesExecutableImplementation ? [
      "npm run template:policy:explain",
      "npm run trust:status"
    ] : []),
    "npm run generate",
    "npm run verify"
  ];
  const provenanceLines = [];
  provenanceLines.push(`- Template: \`${templateName}@${template.version || "unknown"}\``);
  provenanceLines.push(`- Source: \`${template.source || "unknown"}\``);
  if (template.sourceSpec) {
    provenanceLines.push(`- Source spec: \`${template.sourceSpec}\``);
  }
  if (template.catalog) {
    provenanceLines.push(`- Catalog: \`${template.catalog.id}\` from \`${template.catalog.source}\``);
    provenanceLines.push(`- Package: \`${template.catalog.packageSpec}\``);
  }
  provenanceLines.push(`- Executable implementation: \`${template.includesExecutableImplementation ? "yes" : "no"}\``);
  const readme = `# ${packageNameFromPath(projectRoot)}

Generated by \`topogram new\`.

## Template

${provenanceLines.join("\n")}

## Workflow

\`\`\`bash
${workflowCommands.join("\n")}
\`\`\`

Edit \`topogram/\` and \`topogram.project.json\`, then regenerate with \`npm run generate\`.
Generated app code is written to \`app/\`.
${template.includesExecutableImplementation ? "\nThis template copied `implementation/` code. `topogram new` did not execute it; review `implementation/`, `topogram.template-policy.json`, and `.topogram-template-trust.json` before regenerating after edits.\n" : ""}
`;
  fs.writeFileSync(path.join(projectRoot, "README.md"), readme, "utf8");
}

/**
 * @param {CreateNewProjectOptions} options
 * @returns {{ projectRoot: string, templateName: string, template: Record<string, any>, topogramPath: string, appPath: string, warnings: string[] }}
 */
export function createNewProject({
  targetPath,
  templateName = DEFAULT_TEMPLATE_NAME,
  engineRoot,
  templatesRoot,
  templateProvenance = null
}) {
  if (!targetPath) {
    throw new Error("topogram new requires <path>.");
  }
  const projectRoot = path.resolve(targetPath);
  assertProjectOutsideEngine(projectRoot, engineRoot);
  const template = resolveTemplate(templateName, templatesRoot);

  ensureCreatableProjectRoot(projectRoot);
  copyTopogramWorkspace(template.root, projectRoot);
  const projectConfig = writeProjectTemplateMetadata(projectRoot, template, templateProvenance);
  writeProjectPackage(projectRoot, engineRoot);
  writeExplainScript(projectRoot);
  writeProjectReadme(projectRoot, projectConfig);
  writeTemplateFilesManifest(projectRoot, projectConfig);
  writeTemplatePolicy(projectRoot, defaultTemplatePolicyForTemplate(template));

  const warnings = [];
  if (template.manifest.includesExecutableImplementation) {
    writeTemplateTrustRecord(projectRoot, projectConfig);
    warnings.push(
      `Template '${template.manifest.id}' copied implementation/ code into this project. ` +
        "topogram new did not execute it, but topogram generate may load it later. " +
        "Recorded local trust in .topogram-template-trust.json."
    );
  }

  return {
    projectRoot,
    templateName: template.manifest.id,
    template: projectConfig.template,
    topogramPath: path.join(projectRoot, "topogram"),
    appPath: path.join(projectRoot, "app"),
    warnings
  };
}
