// @ts-check

import fs from "node:fs";
import path from "node:path";

import { githubRepoSlug } from "../topogram-config.js";
import { DEFAULT_TOPO_FOLDER_NAME, DEFAULT_WORKSPACE_PATH, resolvePackageWorkspace } from "../workspace-paths.js";
import { cliDependencyForProject, generatorDependenciesForTemplate, isSameOrInside, packageNameFromPath, writeProjectNpmConfig } from "./package-spec.js";

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
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @returns {void}
 */
export function assertProjectOutsideEngine(projectRoot, engineRoot) {
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
export function ensureCreatableProjectRoot(projectRoot) {
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
 * @returns {{ legacyWorkspace: boolean }}
 */
export function copyTopogramWorkspace(templateRoot, projectRoot) {
  const templateWorkspace = resolvePackageWorkspace(templateRoot);
  const topoRoot = path.join(projectRoot, DEFAULT_TOPO_FOLDER_NAME);
  fs.cpSync(templateWorkspace.root, topoRoot, { recursive: true });

  const projectConfigPath = path.join(templateRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  projectConfig.workspace = DEFAULT_WORKSPACE_PATH;
  fs.writeFileSync(path.join(projectRoot, "topogram.project.json"), `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");
  const implementationRoot = path.join(templateRoot, "implementation");
  if (fs.existsSync(implementationRoot)) {
    fs.cpSync(
      implementationRoot,
      path.join(projectRoot, "implementation"),
      { recursive: true }
    );
  }
  return { legacyWorkspace: templateWorkspace.legacy };
}

/**
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @param {ResolvedTemplate} template
 * @returns {void}
 */
export function writeProjectPackage(projectRoot, engineRoot, template) {
  const cliDependency = cliDependencyForProject(projectRoot, engineRoot);
  const generatorDependencies = generatorDependenciesForTemplate(template.root);
  const starterScripts = template.manifest.starterScripts || {};
  const pkg = {
    name: packageNameFromPath(projectRoot),
    private: true,
    type: "module",
    scripts: {
      explain: "node ./scripts/explain.mjs",
      doctor: "topogram doctor",
      "agent:brief": "topogram agent brief --json",
      "source:status": "topogram source status --local",
      "source:status:remote": "topogram source status --remote",
      check: "topogram check",
      "check:json": "topogram check --json",
      "query:list": "topogram query list --json",
      "query:show": "topogram query show",
      generate: "topogram generate",
      "template:explain": "topogram template explain",
      "template:status": "topogram template status",
      "template:detach": "topogram template detach",
      "template:detach:dry-run": "topogram template detach --dry-run",
      "template:policy:check": "topogram template policy check",
      "template:policy:explain": "topogram template policy explain",
      "generator:policy:status": "topogram generator policy status",
      "generator:policy:check": "topogram generator policy check",
      "generator:policy:explain": "topogram generator policy explain",
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
      "app:runtime": "npm --prefix ./app run runtime",
      ...starterScripts
    },
    devDependencies: {
      [cliDependency.name]: cliDependency.spec,
      ...generatorDependencies
    }
  };
  fs.writeFileSync(path.join(projectRoot, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  writeProjectNpmConfig(projectRoot, cliDependency);
}

/**
 * @param {string} projectRoot
 * @returns {void}
 */
export function writeExplainScript(projectRoot) {
  const scriptDir = path.join(projectRoot, "scripts");
  fs.mkdirSync(scriptDir, { recursive: true });
  const script = `const message = \`
Topogram app workflow

1. Edit:
   topo/
   topogram.project.json

2. Start with project guidance:
   npm run agent:brief

3. Validate:
   npm run doctor
   npm run source:status
   npm run template:explain
   npm run check

4. Regenerate:
   npm run generate

5. Verify generated app:
   npm run verify

6. Run locally:
   npm run bootstrap
   npm run dev

7. Probe the running app from another terminal:
   npm run app:probe

Or run self-contained local runtime verification:
   npm run app:runtime

Useful inspection:
   npm run agent:brief
   npm run check:json
   topogram emit ui-widget-contract ./topo --json
   topogram emit widget-conformance-report ./topo --json
   npm run doctor
   npm run source:status
   npm run source:status:remote
   npm run template:explain
   npm run template:status
   npm run template:detach:dry-run
   npm run template:policy:check
   npm run template:policy:explain
   npm run generator:policy:status
   npm run generator:policy:check
   npm run generator:policy:explain
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
export function writeProjectReadme(projectRoot, projectConfig) {
  const template = projectConfig.template || {};
  const templateName = template.id || "unknown";
  const workflowCommands = [
    "npm install",
    "npm run explain",
    "npm run agent:brief",
    "npm run doctor",
    "npm run source:status",
    "npm run template:explain",
    "npm run check",
    "npm run template:policy:check",
    "npm run generator:policy:status",
    "npm run generator:policy:check",
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

Edit the workspace folder \`${DEFAULT_TOPO_FOLDER_NAME}/\` and \`topogram.project.json\`, then regenerate with \`npm run generate\`.
Generated app code is written to \`app/\`.
Use \`topogram emit <target>\` to inspect contracts, reports, snapshots, and other artifacts without regenerating the app.
Agents should start with \`AGENTS.md\` and \`npm run agent:brief\`. The direct \`topogram agent brief --json\` command is the canonical machine-readable first-run guidance.
${template.includesExecutableImplementation ? "\nThis template copied `implementation/` code. `topogram new` did not execute it; review `implementation/`, `topogram.template-policy.json`, and `.topogram-template-trust.json` before regenerating after edits.\n" : ""}
`;
  fs.writeFileSync(path.join(projectRoot, "README.md"), readme, "utf8");
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} projectConfig
 * @returns {void}
 */
export function writeAgentsGuide(projectRoot, projectConfig) {
  const template = projectConfig.template || {};
  const hasImplementation = Boolean(projectConfig.implementation || template.includesExecutableImplementation);
  const guide = `# Agent Guide

Start here before editing this Topogram project.

## First Read

1. \`AGENTS.md\`
2. \`README.md\`
3. \`topogram.project.json\`
4. \`topogram.template-policy.json\`
5. \`topogram.generator-policy.json\`
${hasImplementation ? "6. `.topogram-template-trust.json`\n7. `implementation/`\n8. Focused `topogram query ...` output\n" : "6. Focused `topogram query ...` output\n"}
Machine-readable source:

\`\`\`bash
topogram agent brief --json
\`\`\`

Local shortcut:

\`\`\`bash
npm run agent:brief
\`\`\`

Reference: https://github.com/${githubRepoSlug(null)}/blob/main/docs/agent-first-run.md

## First Commands

\`\`\`bash
npm run agent:brief
npm run doctor
npm run source:status
npm run template:explain
npm run generator:policy:check
${hasImplementation ? "npm run trust:status\n" : ""}npm run check
npm run query:list
npm run query:show -- widget-behavior
\`\`\`

## Edit Rules

- Edit \`topo/**\` and \`topogram.project.json\` first.
- Review policy files before editing \`topogram.template-policy.json\` or \`topogram.generator-policy.json\`.
- Do not make lasting edits under generated-owned \`app/**\`; use \`npm run generate\` to replace generated output.
- If an output is changed to maintained ownership, agents may edit that app code directly after reading focused query packets.

## UI And Widgets

- \`ui_contract\` owns screens, regions, widget bindings, behavior, visibility, and semantic design tokens.
- Web/iOS/Android surfaces realize the shared UI contract; they do not own widget placement.
- Use \`topogram widget check --json\`, \`topogram widget behavior --json\`, and focused \`topogram query ...\` packets after UI edits.

## Template And Trust

- Local edits to template-derived Topogram files are project-owned.
- Use \`npm run source:status\` and \`npm run template:update:recommend\` before applying template updates.
${hasImplementation ? "- This project has executable `implementation/` code. `topogram new` did not execute it. Do not refresh trust until the implementation has been reviewed.\n" : "- This template does not declare executable implementation code.\n"}
## Import And Adoption

- If \`.topogram-import.json\` exists, run \`topogram import check .\`, \`topogram import plan .\`, \`topogram import adopt --list .\`, and \`topogram import history . --verify\`.
- Imported Topogram files are project-owned after adoption; source hashes record trusted import evidence at the time of import.

## Verification Gates

\`\`\`bash
npm run check
npm run generate
npm run verify
\`\`\`
`;
  fs.writeFileSync(path.join(projectRoot, "AGENTS.md"), guide, "utf8");
}
