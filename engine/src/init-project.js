// @ts-check

import fs from "node:fs";
import path from "node:path";

import { sdlcAdopt } from "./sdlc/adopt.js";
import { defaultSdlcPolicy, SDLC_POLICY_FILE } from "./sdlc/policy.js";
import { DEFAULT_TOPO_FOLDER_NAME, DEFAULT_WORKSPACE_PATH, PROJECT_CONFIG_FILE } from "./workspace-paths.js";

/**
 * @typedef {Object} InitProjectOptions
 * @property {string} [targetPath]
 * @property {boolean} [withSdlc]
 */

/**
 * @typedef {Object} InitProjectResult
 * @property {boolean} ok
 * @property {string} projectRoot
 * @property {string} workspaceRoot
 * @property {string} projectConfigPath
 * @property {string[]} created
 * @property {string[]} skipped
 * @property {Record<string, any>} projectConfig
 * @property {{ enabled: boolean, path: string|null, folders: string[] }} sdlc
 */

/**
 * @param {string} projectRoot
 * @param {string} targetPath
 * @returns {string}
 */
function relativeProjectPath(projectRoot, targetPath) {
  const relative = path.relative(projectRoot, targetPath);
  return relative ? relative.split(path.sep).join("/") : ".";
}

/**
 * @param {string} projectRoot
 * @param {string} filePath
 * @param {string} content
 * @param {string[]} created
 * @param {string[]} skipped
 * @returns {void}
 */
function writeIfMissing(projectRoot, filePath, content, created, skipped) {
  if (fs.existsSync(filePath)) {
    skipped.push(relativeProjectPath(projectRoot, filePath));
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  created.push(relativeProjectPath(projectRoot, filePath));
}

/**
 * @returns {Record<string, any>}
 */
function defaultMaintainedProjectConfig() {
  return {
    version: "0.1",
    workspace: DEFAULT_WORKSPACE_PATH,
    outputs: {
      app: {
        path: ".",
        ownership: "maintained"
      }
    },
    topology: {
      runtimes: []
    }
  };
}

/**
 * @returns {string}
 */
function initializedReadme() {
  return `# Topogram Project

Initialized with \`topogram init\`.

This repository is treated as a maintained app or workspace: Topogram will not
overwrite source code under \`./\`. Use \`topogram emit\` for contracts, reports,
snapshots, and proposals, and edit maintained app code directly after reading
focused query packets.

## First Commands

\`\`\`bash
topogram agent brief --json
topogram check --json
topogram query list --json
\`\`\`

To adopt enforced SDLC during initialization, use \`topogram init . --adopt-sdlc\`.
If this project was initialized without SDLC and you want to adopt it later, run:

\`\`\`bash
topogram sdlc policy init .
topogram sdlc adopt .
\`\`\`

## Source

- \`topo/\` is the project-owned Topogram workspace.
- \`topogram.project.json\` declares workspace, output ownership, and runtime topology.
- Output \`app\` points at \`.\` with \`maintained\` ownership.
`;
}

/**
 * @returns {string}
 */
function initializedAgentsGuide() {
  return `# Agent Guide

This repository was initialized with \`topogram init\`.

Start with:

\`\`\`bash
topogram agent brief --json
topogram check --json
topogram query list --json
\`\`\`

Edit \`topo/**\` and \`topogram.project.json\` for Topogram source. The project
output is maintained, so app/source files under \`./\` are human-owned and may be
edited directly after reading focused packets.

## Engineering Laws

- Maintain code like this project will live for 10 years and be touched only from time to time.
- Keep code organized, maintainable, security-focused, tested, and testable.
- Make tests prove consumer-visible value; do not rely on string-only or file-existence checks when behavior can compile, run, or validate.
- Start agent work with \`topogram agent brief --json\` and focused \`topogram query ...\` packets before broad edits.
- Use Topogram commands for stateful workflow mutations such as SDLC transitions, trust, provenance, generated sentinels, archives, release state, and rollout state.

Use \`topogram emit <target>\` for contracts, reports, snapshots, migration
plans, and agent context. Do not expect \`topogram generate\` to overwrite this
maintained app unless output ownership is deliberately changed.

If \`topogram.sdlc-policy.json\` exists, use SDLC commands for task and status
work before protected edits:

\`\`\`bash
topogram sdlc policy explain --json
topogram sdlc prep commit . --json
\`\`\`
`;
}

/**
 * @returns {Record<string, string>}
 */
function sdlcLawSeedFiles() {
  return {
    "topo/capabilities/engineering-workflow.tg": `capability cap_maintain_project {
  name "Maintain Project"
  description "Maintain this project over time with organized, testable, security-focused changes."
  status active
}

capability cap_validate_workspace {
  name "Validate Workspace"
  description "Run the project validation gates before committing or releasing changes."
  status active
}

capability cap_query_context {
  name "Query Focused Context"
  description "Use focused Topogram query packets before broad source edits."
  status active
}

capability cap_manage_sdlc_records {
  name "Manage SDLC Records"
  description "Use Topogram commands to manage SDLC status, history, and proof links."
  status active
}
`,
    "topo/sdlc/decisions/repo-local-laws-are-enforceable.tg": `decision decision_repo_local_laws_are_enforceable {
  name "Repo Local Laws Are Enforceable"
  description "Repo-local engineering laws are part of the maintained Topogram source and should guide humans and agents."
  context ["AGENTS.md carries first-run laws", "graph-native rules make those laws queryable after SDLC adoption"]
  consequences ["agents can load laws through focused slices", "new laws should be added as rule records when they become durable"]
  status accepted
}
`,
    "topo/rules/engineering-laws.tg": `rule rule_maintainable_security_focused_code {
  name "Maintainable Security Focused Code"
  description "Code must be organized, maintainable, security-focused, tested, and testable for long-lived intermittent maintenance."
  applies_to [cap_maintain_project]
  severity error
  source_of_truth [decision_repo_local_laws_are_enforceable]
  status enforced
}

rule rule_tests_prove_consumer_value {
  name "Tests Prove Consumer Value"
  description "Tests should prove behavior that consumers, maintainers, or agents rely on; compile, run, validate, or inspect real outputs where practical."
  applies_to [cap_validate_workspace]
  severity error
  source_of_truth [decision_repo_local_laws_are_enforceable]
  status enforced
}

rule rule_agents_start_with_focused_context {
  name "Agents Start With Focused Context"
  description "Agents should start with agent brief and focused query packets before editing broad source surfaces."
  applies_to [cap_query_context]
  severity warning
  source_of_truth [decision_repo_local_laws_are_enforceable]
  status enforced
}

rule rule_stateful_workflow_mutations_use_cli {
  name "Stateful Workflow Mutations Use CLI"
  description "Status, history, trust, provenance, generated sentinels, archives, release state, and rollout state should be changed through canonical commands."
  applies_to [cap_manage_sdlc_records]
  severity error
  source_of_truth [decision_repo_local_laws_are_enforceable]
  status enforced
}
`
  };
}

/**
 * @param {string} projectRoot
 * @returns {void}
 */
function assertInitTarget(projectRoot) {
  if (fs.existsSync(projectRoot) && !fs.statSync(projectRoot).isDirectory()) {
    throw new Error(`Cannot initialize Topogram at '${projectRoot}' because it is not a directory.`);
  }
  const configPath = path.join(projectRoot, PROJECT_CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    throw new Error(`Refusing to initialize Topogram because ${PROJECT_CONFIG_FILE} already exists.`);
  }
  const workspaceRoot = path.join(projectRoot, DEFAULT_TOPO_FOLDER_NAME);
  if (fs.existsSync(workspaceRoot)) {
    if (!fs.statSync(workspaceRoot).isDirectory()) {
      throw new Error(`Refusing to initialize Topogram because ${DEFAULT_TOPO_FOLDER_NAME}/ exists and is not a directory.`);
    }
    const entries = fs.readdirSync(workspaceRoot).filter(/** @param {string} entry */ (entry) => entry !== ".DS_Store");
    if (entries.length > 0) {
      throw new Error(`Refusing to initialize Topogram because ${DEFAULT_TOPO_FOLDER_NAME}/ already exists and is not empty.`);
    }
  }
}

/**
 * @param {InitProjectOptions} [options]
 * @returns {InitProjectResult}
 */
export function initTopogramProject(options = {}) {
  const projectRoot = path.resolve(options.targetPath || ".");
  assertInitTarget(projectRoot);
  fs.mkdirSync(projectRoot, { recursive: true });

  /** @type {string[]} */
  const created = [];
  /** @type {string[]} */
  const skipped = [];
  const workspaceRoot = path.join(projectRoot, DEFAULT_TOPO_FOLDER_NAME);
  fs.mkdirSync(workspaceRoot, { recursive: true });
  created.push(DEFAULT_TOPO_FOLDER_NAME);

  writeIfMissing(projectRoot, path.join(workspaceRoot, ".gitkeep"), "", created, skipped);
  const projectConfig = defaultMaintainedProjectConfig();
  const projectConfigPath = path.join(projectRoot, PROJECT_CONFIG_FILE);
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");
  created.push(PROJECT_CONFIG_FILE);
  writeIfMissing(projectRoot, path.join(projectRoot, "README.md"), initializedReadme(), created, skipped);
  writeIfMissing(projectRoot, path.join(projectRoot, "AGENTS.md"), initializedAgentsGuide(), created, skipped);
  const sdlcPolicyPath = path.join(projectRoot, SDLC_POLICY_FILE);
  /** @type {string[]} */
  let sdlcFolders = [];
  if (options.withSdlc) {
    writeIfMissing(
      projectRoot,
      sdlcPolicyPath,
      `${JSON.stringify(defaultSdlcPolicy(), null, 2)}\n`,
      created,
      skipped
    );
    const sdlcRoot = path.join(workspaceRoot, "sdlc");
    const hadSdlcRoot = fs.existsSync(sdlcRoot);
    const adoption = sdlcAdopt(projectRoot);
    if (!adoption.ok) {
      throw new Error(adoption.error || "Failed to adopt SDLC during initialization.");
    }
    sdlcFolders = [...adoption.folders_created, ...adoption.folders_existing];
    if (!hadSdlcRoot && fs.existsSync(sdlcRoot)) {
      created.push("topo/sdlc");
    }
    for (const folder of adoption.folders_created) {
      created.push(`topo/sdlc/${folder}`);
    }
    for (const [relativePath, contents] of Object.entries(sdlcLawSeedFiles())) {
      writeIfMissing(projectRoot, path.join(projectRoot, relativePath), contents, created, skipped);
    }
  }

  return {
    ok: true,
    projectRoot,
    workspaceRoot,
    projectConfigPath,
    created,
    skipped,
    projectConfig,
    sdlc: {
      enabled: options.withSdlc ? fs.existsSync(sdlcPolicyPath) : false,
      path: options.withSdlc ? sdlcPolicyPath : null,
      folders: sdlcFolders
    }
  };
}
