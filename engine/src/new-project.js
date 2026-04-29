// @ts-check

import fs from "node:fs";
import path from "node:path";

const TEMPLATE_NAMES = new Set(["web-api-db"]);

/**
 * @typedef {Object} CreateNewProjectOptions
 * @property {string} targetPath
 * @property {string} [templateName]
 * @property {string} engineRoot
 * @property {string} templatesRoot
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
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
function isSameOrInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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
  fs.mkdirSync(topogramRoot, { recursive: true });

  for (const entry of fs.readdirSync(templateRoot)) {
    if (entry === "topogram.project.json" || entry === "implementation") {
      continue;
    }
    fs.cpSync(path.join(templateRoot, entry), path.join(topogramRoot, entry), { recursive: true });
  }

  fs.cpSync(
    path.join(templateRoot, "topogram.project.json"),
    path.join(projectRoot, "topogram.project.json")
  );
  fs.cpSync(
    path.join(templateRoot, "implementation"),
    path.join(projectRoot, "implementation"),
    { recursive: true }
  );
}

/**
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @returns {void}
 */
function writeProjectPackage(projectRoot, engineRoot) {
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
      topogram: fileDependencyForEngine(projectRoot, engineRoot)
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
  if (!TEMPLATE_NAMES.has(templateName)) {
    throw new Error(`Unknown template '${templateName}'. Available templates: ${[...TEMPLATE_NAMES].join(", ")}.`);
  }

  const projectRoot = path.resolve(targetPath);
  assertProjectOutsideEngine(projectRoot, engineRoot);
  const templateRoot = path.join(templatesRoot, templateName);
  if (!fs.existsSync(templateRoot)) {
    throw new Error(`Template '${templateName}' is not installed at '${templateRoot}'.`);
  }

  ensureCreatableProjectRoot(projectRoot);
  copyTopogramWorkspace(templateRoot, projectRoot);
  writeProjectPackage(projectRoot, engineRoot);
  writeExplainScript(projectRoot);
  writeProjectReadme(projectRoot, templateName);

  return {
    projectRoot,
    templateName,
    topogramPath: path.join(projectRoot, "topogram"),
    appPath: path.join(projectRoot, "app")
  };
}
