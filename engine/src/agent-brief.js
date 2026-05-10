// @ts-check

import fs from "node:fs";
import path from "node:path";

import {
  GENERATOR_POLICY_FILE,
  generatorPolicyDiagnosticsForBindings,
  loadGeneratorPolicy,
  packageBackedGeneratorBindings
} from "./generator-policy.js";
import { TOPOGRAM_IMPORT_FILE } from "./import/provenance.js";
import {
  loadProjectConfig,
  projectConfigOrDefault,
  validateProjectConfig
} from "./project-config.js";
import { resolveWorkspace } from "./resolver.js";
import {
  getTemplateTrustStatus,
  TEMPLATE_TRUST_FILE
} from "./template-trust.js";
import { DEFAULT_TOPO_FOLDER_NAME, resolveTopoRoot, resolveWorkspaceContext } from "./workspace-paths.js";

/**
 * @typedef {{ path: string, reason: string, required: boolean, exists: boolean }} AgentBriefReadItem
 * @typedef {{ command: string, reason: string, phase: string }} AgentBriefCommand
 * @typedef {{ path: string, ownership: string, rule: string }} AgentBriefOutputBoundary
 * @typedef {{ id: string, title: string, commands: string[], rule: string }} AgentBriefWorkflow
 * @typedef {{ id: string, kind: string, projection: string|null, generator: string|null, uses_api: string|null, uses_database: string|null }} AgentBriefRuntime
 * @typedef {{ path: string, source: string|null, tracks: string[], candidateCounts: Record<string, any>, ownership: string|null }} AgentBriefImport
 * @typedef {{ ok: true, payload: Record<string, any> } | { ok: false, kind: "topogram", validation: any } | { ok: false, kind: "project", validation: any, configPath: string }} AgentBriefResult
 */

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function normalizeAgentTopogramPath(inputPath) {
  return resolveTopoRoot(inputPath || ".");
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
function normalizeProjectRoot(inputPath) {
  return resolveWorkspaceContext(inputPath || ".").projectRoot;
}

/**
 * @param {string} projectRoot
 * @param {string} targetPath
 * @returns {string}
 */
function relativeProjectPath(projectRoot, targetPath) {
  const relative = path.relative(projectRoot, targetPath);
  if (!relative || relative === "") {
    return ".";
  }
  return relative.split(path.sep).join("/");
}

/**
 * @param {string} projectRoot
 * @param {string} relativePath
 * @param {string} reason
 * @param {boolean} required
 * @returns {AgentBriefReadItem}
 */
function readItem(projectRoot, relativePath, reason, required) {
  return {
    path: relativePath,
    reason,
    required,
    exists: fs.existsSync(path.join(projectRoot, relativePath))
  };
}

/**
 * @param {string} command
 * @param {string} reason
 * @param {string} [phase]
 * @returns {AgentBriefCommand}
 */
function commandItem(command, reason, phase = "first-run") {
  return { command, reason, phase };
}

/**
 * @param {Record<string, any>} config
 * @returns {AgentBriefRuntime[]}
 */
function summarizeRuntimes(config) {
  const runtimes = Array.isArray(config?.topology?.runtimes) ? config.topology.runtimes : [];
  return runtimes.map((runtime) => ({
    id: String(runtime.id || "unknown"),
    kind: String(runtime.kind || "unknown"),
    projection: typeof runtime.projection === "string" ? runtime.projection : null,
    generator: typeof runtime.generator?.id === "string" ? runtime.generator.id : null,
    uses_api: typeof runtime.uses_api === "string" ? runtime.uses_api : null,
    uses_database: typeof runtime.uses_database === "string" ? runtime.uses_database : null
  }));
}

/**
 * @param {Record<string, any>} config
 * @returns {AgentBriefOutputBoundary[]}
 */
function summarizeOutputBoundaries(config) {
  const outputs = config?.outputs && typeof config.outputs === "object" && !Array.isArray(config.outputs)
    ? config.outputs
    : {};
  return Object.entries(outputs).map(([name, output]) => {
    const ownership = String(output?.ownership || "unknown");
    const outputPath = String(output?.path || name);
    return {
      path: outputPath,
      ownership,
      rule: ownership === "generated"
        ? `Do not edit ${outputPath}/ directly unless changing output ownership to maintained. Regenerate it from the Topogram.`
        : `Maintained output ${outputPath}/ is project-owned; agents may edit it directly after reading the relevant Topogram packets.`
    };
  });
}

/**
 * @param {string} projectRoot
 * @returns {AgentBriefImport|null}
 */
function readImportSummary(projectRoot) {
  const importPath = path.join(projectRoot, TOPOGRAM_IMPORT_FILE);
  if (!fs.existsSync(importPath)) {
    return null;
  }
  try {
    const record = JSON.parse(fs.readFileSync(importPath, "utf8"));
    return {
      path: TOPOGRAM_IMPORT_FILE,
      source: typeof record?.source?.path === "string" ? record.source.path : null,
      tracks: Array.isArray(record?.import?.tracks) ? record.import.tracks.map(String) : [],
      candidateCounts: record?.import?.candidateCounts && typeof record.import.candidateCounts === "object"
        ? record.import.candidateCounts
        : {},
      ownership: typeof record?.ownership?.importedArtifacts === "string" ? record.ownership.importedArtifacts : null
    };
  } catch (error) {
    return {
      path: TOPOGRAM_IMPORT_FILE,
      source: null,
      tracks: [],
      candidateCounts: {},
      ownership: `invalid: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * @param {Record<string, any>} config
 * @param {boolean} hasImportRecord
 * @returns {AgentBriefWorkflow[]}
 */
function buildWorkflows(config, hasImportRecord) {
  const workflows = [
    {
      id: "greenfield-generated",
      title: "Generated project loop",
      commands: [
        "npm run agent:brief",
        "npm run check",
        "npm run generate",
        "npm run verify"
      ],
      rule: "Edit the Topogram first, then regenerate generated-owned outputs."
    },
    {
      id: "widget-first-ui",
      title: "Widget-first UI loop",
      commands: [
        "topogram query list --json",
        "topogram query show widget-behavior",
        "topogram widget check --json",
        "topogram widget behavior --json",
        "topogram emit ui-widget-contract --json"
      ],
      rule: "Use focused widget and surface packets before editing UI code."
    },
    {
      id: "template-update",
      title: "Template update loop",
      commands: [
        "npm run source:status",
        "npm run template:explain",
        "npm run template:update:recommend",
        "npm run template:update:check"
      ],
      rule: "Local Topogram files are project-owned after edits; review update plans before applying template changes."
    }
  ];
  if (config?.implementation) {
    workflows.push({
      id: "executable-template",
      title: "Executable template review loop",
      commands: [
        "npm run trust:status",
        "npm run trust:diff",
        "npm run template:policy:explain",
        "topogram trust template"
      ],
      rule: "Review implementation code before refreshing trust. The brief does not execute implementation providers."
    });
  }
  if (hasImportRecord) {
    workflows.push({
      id: "brownfield-import",
      title: "Brownfield import adoption loop",
      commands: [
        "topogram import check .",
        "topogram import plan .",
        "topogram import adopt --list .",
        "topogram import status .",
        "topogram import history . --verify"
      ],
      rule: "Imported Topogram files are editable after adoption; source hashes record trusted import evidence."
    });
  }
  return workflows;
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} config
 * @param {Record<string, any>} trust
 * @param {Record<string, any>|null} importSummary
 * @param {Record<string, any>} generatorPolicy
 * @returns {string[]}
 */
function buildWarnings(projectRoot, config, trust, importSummary, generatorPolicy) {
  /** @type {string[]} */
  const warnings = [];
  if (config?.implementation) {
    warnings.push("implementation/ exists. Review executable implementation code before generation and before refreshing trust.");
  }
  if (trust?.requiresTrust && !trust?.ok) {
    warnings.push(`${TEMPLATE_TRUST_FILE} does not currently match implementation/. Run trust status/diff and review code before trusting.`);
  }
  if (generatorPolicy?.diagnostics?.errors > 0) {
    warnings.push(`${GENERATOR_POLICY_FILE} has generator policy errors. Fix policy before generating.`);
  }
  if (summarizeOutputBoundaries(config).some((output) => output.ownership === "generated")) {
    warnings.push("Generated-owned outputs are replaceable by Topogram; do not make lasting edits under generated output paths.");
  }
  if (importSummary) {
    warnings.push(`${TOPOGRAM_IMPORT_FILE} is present. Treat imported Topogram artifacts as project-owned after adoption; hashes are import evidence.`);
  }
  if (!fs.existsSync(path.join(projectRoot, "AGENTS.md"))) {
    warnings.push("AGENTS.md is missing. Use this command as the current agent guidance source.");
  }
  return warnings;
}

/**
 * @param {string} inputPath
 * @param {Record<string, any>} workspaceAst
 * @returns {AgentBriefResult}
 */
export function buildAgentBrief(inputPath, workspaceAst) {
  const topogramRoot = normalizeAgentTopogramPath(inputPath);
  const projectRoot = normalizeProjectRoot(inputPath);
  const resolved = resolveWorkspace(workspaceAst);
  if (!resolved.ok) {
    return { ok: false, kind: "topogram", validation: resolved.validation };
  }

  const explicitProjectConfig = loadProjectConfig(projectRoot) || loadProjectConfig(topogramRoot) || loadProjectConfig(inputPath);
  const projectConfigInfo = explicitProjectConfig || projectConfigOrDefault(projectRoot, resolved.graph, null);
  const projectConfigValidation = projectConfigInfo
    ? validateProjectConfig(projectConfigInfo.config, resolved.graph, { configDir: projectConfigInfo.configDir })
    : { ok: true, errors: [] };
  if (!projectConfigValidation.ok) {
    return {
      ok: false,
      kind: "project",
      validation: projectConfigValidation,
      configPath: projectConfigInfo?.configPath || "topogram.project.json"
    };
  }

  const config = projectConfigInfo?.config || {};
  const configDir = projectConfigInfo?.configDir || projectRoot;
  const template = config.template || {};
  const trust = config.implementation
    ? getTemplateTrustStatus({
      config: config.implementation,
      configPath: projectConfigInfo?.configPath || path.join(configDir, "topogram.project.json"),
      configDir
    }, config)
    : {
      ok: true,
      requiresTrust: false,
      trustPath: path.join(configDir, TEMPLATE_TRUST_FILE),
      trustRecord: null,
      template: null,
      implementation: null,
      content: null,
      issues: []
    };

  const generatorPolicyInfo = loadGeneratorPolicy(configDir);
  const generatorBindings = packageBackedGeneratorBindings(config);
  const generatorDiagnostics = generatorPolicyDiagnosticsForBindings(generatorPolicyInfo, generatorBindings, "agent-brief");
  const importSummary = readImportSummary(configDir);

  const topogramReadPath = path.resolve(topogramRoot) === path.resolve(projectRoot) ? "." : `${DEFAULT_TOPO_FOLDER_NAME}/`;
  const readOrder = [
    readItem(projectRoot, "AGENTS.md", "Human-readable first-run guidance generated with this project.", false),
    readItem(projectRoot, "README.md", "Project workflow and template provenance summary.", true),
    readItem(projectRoot, "topogram.project.json", "Topology, outputs, template metadata, generator bindings, and implementation provider settings.", true),
    readItem(projectRoot, "topogram.template-policy.json", "Template trust/update policy for attached templates.", false),
    readItem(projectRoot, GENERATOR_POLICY_FILE, "Package-backed generator policy and allowed scopes.", false),
    readItem(projectRoot, TEMPLATE_TRUST_FILE, "Executable implementation trust record, if the template copied implementation code.", Boolean(config.implementation)),
    readItem(projectRoot, TOPOGRAM_IMPORT_FILE, "Brownfield import provenance and source evidence, if this came from import.", Boolean(importSummary)),
    readItem(projectRoot, topogramReadPath, "Canonical Topogram graph source. Use focused query packets for implementation work.", true)
  ];

  const firstCommands = [
    commandItem("npm run agent:brief", "Machine-readable current onboarding guidance."),
    commandItem("npm run doctor", "Check local CLI, package, and catalog setup."),
    commandItem("npm run source:status", "See whether template-derived files diverged locally."),
    commandItem("npm run template:explain", "Understand whether the project is template-attached or detached."),
    commandItem("npm run generator:policy:check", "Validate package-backed generator policy before generation."),
    ...(config.implementation ? [
      commandItem("npm run trust:status", "Check executable implementation trust before generation.", "trust")
    ] : []),
    commandItem("npm run check", "Validate Topogram, project config, topology, ownership, trust, and generator policy."),
    commandItem("npm run query:list", "Discover focused agent packets."),
    commandItem("npm run query:show -- widget-behavior", "Read a focused UI/widget packet before UI work.", "focused-context"),
    commandItem("npm run generate", "Write generated-owned runtime/app outputs after validation.", "write"),
    commandItem("npm run verify", "Run generated output verification.", "verify"),
    ...(importSummary ? [
      commandItem("topogram import check .", "Validate imported workspace provenance.", "import"),
      commandItem("topogram import plan .", "Review import adoption plan.", "import"),
      commandItem("topogram import adopt --list .", "List reviewable adoption selectors.", "import"),
      commandItem("topogram import history . --verify", "Verify import history evidence.", "import")
    ] : [])
  ];

  const generatorPolicy = {
    exists: generatorPolicyInfo.exists,
    path: relativeProjectPath(projectRoot, generatorPolicyInfo.path),
    packageBackedGenerators: generatorBindings.length,
    diagnostics: {
      errors: generatorDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
      warnings: generatorDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
      items: generatorDiagnostics
    }
  };

  const templateSummary = {
    id: template.id || null,
    version: template.version || null,
    source: template.source || null,
    sourceSpec: template.sourceSpec || null,
    requested: template.requested || null,
    includesExecutableImplementation: typeof template.includesExecutableImplementation === "boolean"
      ? template.includesExecutableImplementation
      : Boolean(config.implementation)
  };

  const payload = {
    type: "agent_brief",
    version: "1",
    project: {
      root: projectRoot,
      topogram: topogramRoot,
      projectConfigPath: projectConfigInfo?.configPath || null,
      packageJson: fs.existsSync(path.join(projectRoot, "package.json")) ? path.join(projectRoot, "package.json") : null
    },
    read_order: readOrder,
    first_commands: firstCommands,
    edit_boundaries: {
      safe_paths: [
        `${DEFAULT_TOPO_FOLDER_NAME}/**`,
        "topogram.project.json",
        "topogram.template-policy.json",
        GENERATOR_POLICY_FILE,
        ...(config.implementation ? ["implementation/** after review and trust status"] : [])
      ],
      output_boundaries: summarizeOutputBoundaries(config),
      rule: "Edit Topogram and policy files first. Avoid generated-owned output paths unless converting them to maintained ownership."
    },
    workflows: buildWorkflows(config, Boolean(importSummary)),
    file_organization: {
      small: [`${DEFAULT_TOPO_FOLDER_NAME}/actors`, `${DEFAULT_TOPO_FOLDER_NAME}/entities`, `${DEFAULT_TOPO_FOLDER_NAME}/shapes`, `${DEFAULT_TOPO_FOLDER_NAME}/capabilities`, `${DEFAULT_TOPO_FOLDER_NAME}/widgets`, `${DEFAULT_TOPO_FOLDER_NAME}/projections`, `${DEFAULT_TOPO_FOLDER_NAME}/verifications`],
      large: [`${DEFAULT_TOPO_FOLDER_NAME}/domains/<domain>`, `${DEFAULT_TOPO_FOLDER_NAME}/shared`, `${DEFAULT_TOPO_FOLDER_NAME}/domains/<domain>/widgets`, `${DEFAULT_TOPO_FOLDER_NAME}/domains/<domain>/projections`],
      parserRule: "Folder layout is for humans and agents; Topogram flattens statements into one graph."
    },
    topology: {
      runtimes: summarizeRuntimes(config),
      outputs: summarizeOutputBoundaries(config)
    },
    template: templateSummary,
    trust: {
      ok: Boolean(trust.ok),
      requiresTrust: Boolean(trust.requiresTrust),
      path: trust.trustPath ? relativeProjectPath(projectRoot, trust.trustPath) : TEMPLATE_TRUST_FILE,
      implementation: trust.implementation || null,
      content: trust.content || null,
      issues: trust.issues || []
    },
    generator_policy: generatorPolicy,
    import: importSummary,
    warnings: []
  };
  payload.warnings = buildWarnings(projectRoot, config, payload.trust, importSummary, generatorPolicy);
  return { ok: true, payload };
}

/**
 * @param {Record<string, any>} brief
 * @returns {string}
 */
export function formatAgentBrief(brief) {
  const lines = [];
  lines.push("Topogram agent brief");
  lines.push(`Project: ${brief.project?.root || "unknown"}`);
  lines.push(`Topogram: ${brief.project?.topogram || "unknown"}`);
  lines.push(`Template: ${brief.template?.id || "none"}${brief.template?.version ? `@${brief.template.version}` : ""}`);
  lines.push(`Implementation trust: ${brief.trust?.requiresTrust ? (brief.trust.ok ? "trusted" : "review required") : "not required"}`);
  lines.push(`Package-backed generators: ${brief.generator_policy?.packageBackedGenerators || 0}`);
  lines.push("");
  lines.push("Read order:");
  for (const item of brief.read_order || []) {
    lines.push(`  ${item.exists ? "-" : "- (missing)"} ${item.path} - ${item.reason}`);
  }
  lines.push("");
  lines.push("First commands:");
  for (const item of brief.first_commands || []) {
    lines.push(`  - ${item.command} - ${item.reason}`);
  }
  lines.push("");
  lines.push("Edit boundaries:");
  lines.push(`  - ${brief.edit_boundaries?.rule || "Edit Topogram first."}`);
  for (const output of brief.edit_boundaries?.output_boundaries || []) {
    lines.push(`  - ${output.path}/ (${output.ownership}) - ${output.rule}`);
  }
  lines.push("");
  lines.push("Topology:");
  for (const runtime of brief.topology?.runtimes || []) {
    const edges = [
      runtime.uses_api ? `uses_api=${runtime.uses_api}` : null,
      runtime.uses_database ? `uses_database=${runtime.uses_database}` : null
    ].filter(Boolean).join(", ");
    lines.push(`  - ${runtime.id}: ${runtime.kind}${runtime.projection ? ` -> ${runtime.projection}` : ""}${runtime.generator ? ` via ${runtime.generator}` : ""}${edges ? ` (${edges})` : ""}`);
  }
  if ((brief.topology?.runtimes || []).length === 0) {
    lines.push("  - No topology runtimes configured.");
  }
  lines.push("");
  lines.push("Workflows:");
  for (const workflow of brief.workflows || []) {
    lines.push(`  - ${workflow.title}: ${workflow.rule}`);
  }
  lines.push("");
  lines.push("Verification gates:");
  lines.push("  - npm run check");
  lines.push("  - topogram widget check --json when UI/widget contracts change");
  lines.push("  - topogram widget behavior --json when widget behavior changes");
  lines.push("  - npm run generate");
  lines.push("  - npm run verify");
  if ((brief.warnings || []).length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of brief.warnings) {
      lines.push(`  - ${warning}`);
    }
  }
  lines.push("");
  lines.push("Machine-readable source: topogram agent brief --json");
  return `${lines.join("\n")}\n`;
}
