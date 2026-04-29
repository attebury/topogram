// @ts-check

import fs from "node:fs";
import childProcess from "node:child_process";
import os from "node:os";
import path from "node:path";

const CLI_PACKAGE_NAME = "@attebury/topogram";
const TEMPLATE_NAMES = new Set(["web-api-db"]);
const TEMPLATE_MANIFEST = "topogram-template.json";

/**
 * @typedef {Object} CreateNewProjectOptions
 * @property {string} targetPath
 * @property {string} [templateName]
 * @property {string} engineRoot
 * @property {string} templatesRoot
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
 * @typedef {Object} ResolvedTemplate
 * @property {string} requested
 * @property {string} root
 * @property {TemplateManifest} manifest
 * @property {"builtin"|"local"|"package"} source
 * @property {string|null} packageSpec
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
function packageNameFromSpec(spec) {
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
 * @param {string} templateSpec
 * @returns {string}
 */
function installTemplatePackage(templateSpec) {
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
    throw new Error(
      `Failed to install template package '${templateSpec}'.\n${result.stderr || result.stdout}`.trim()
    );
  }
  const packageRoot = path.join(installRoot, "node_modules", packageNameFromSpec(templateSpec));
  if (fs.existsSync(packageRoot)) {
    return packageRoot;
  }
  return findInstalledTemplatePackageRoot(installRoot, templateSpec);
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
function resolveTemplate(templateName, templatesRoot) {
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
      const packageTemplateRoot = installTemplatePackage(templateName);
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

  const templateRoot = installTemplatePackage(templateName);
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
      verify: "npm run app:compile",
      bootstrap: "npm run app:bootstrap",
      dev: "npm run app:dev",
      "app:bootstrap": "npm --prefix ./app run bootstrap",
      "app:dev": "npm --prefix ./app run dev",
      "app:compile": "npm --prefix ./app run compile",
      "app:smoke": "npm --prefix ./app run smoke",
      "app:runtime-check": "npm --prefix ./app run runtime-check",
      "app:check": "npm run app:compile && npm run app:smoke && npm run app:runtime-check"
    },
    devDependencies: {
      [cliDependency.name]: cliDependency.spec
    }
  };
  fs.writeFileSync(path.join(projectRoot, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
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

Useful inspection:
   npm run check:json
\`;

console.log(message.trimEnd());
`;
  fs.writeFileSync(path.join(scriptDir, "explain.mjs"), script, "utf8");
}

/**
 * @param {string} projectRoot
 * @param {string} templateName
 * @returns {void}
 */
function writeProjectReadme(projectRoot, templateName) {
  const readme = `# ${packageNameFromPath(projectRoot)}

Generated by \`topogram new\` from the \`${templateName}\` template.

## Workflow

\`\`\`bash
npm install
npm run explain
npm run check
npm run generate
npm run verify
\`\`\`

Edit \`topogram/\` and \`topogram.project.json\`, then regenerate with \`npm run generate\`.
Generated app code is written to \`app/\`.
`;
  fs.writeFileSync(path.join(projectRoot, "README.md"), readme, "utf8");
}

/**
 * @param {CreateNewProjectOptions} options
 * @returns {{ projectRoot: string, templateName: string, topogramPath: string, appPath: string }}
 */
export function createNewProject({
  targetPath,
  templateName = "web-api-db",
  engineRoot,
  templatesRoot
}) {
  if (!targetPath) {
    throw new Error("topogram new requires <path>.");
  }
  const projectRoot = path.resolve(targetPath);
  assertProjectOutsideEngine(projectRoot, engineRoot);
  const template = resolveTemplate(templateName, templatesRoot);

  ensureCreatableProjectRoot(projectRoot);
  copyTopogramWorkspace(template.root, projectRoot);
  writeProjectPackage(projectRoot, engineRoot);
  writeExplainScript(projectRoot);
  writeProjectReadme(projectRoot, template.manifest.id);

  return {
    projectRoot,
    templateName: template.manifest.id,
    topogramPath: path.join(projectRoot, "topogram"),
    appPath: path.join(projectRoot, "app")
  };
}
