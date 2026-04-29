#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsePath } from "./parser.js";
import { stableStringify } from "./format.js";
import { generateWorkspace } from "./generator.js";
import { buildOutputFiles } from "./generator.js";
import { loadImplementationProvider } from "./example-implementation.js";
import { buildTemplateUpdatePlan, createNewProject } from "./new-project.js";
import {
  getTemplateTrustDiff,
  getTemplateTrustStatus,
  implementationRequiresTrust,
  TEMPLATE_TRUST_FILE,
  validateProjectImplementationTrust,
  writeTemplateTrustRecord
} from "./template-trust.js";
import { recommendedVerificationTargets } from "./generator/context/shared.js";
import {
  buildAuthHintsQueryPayload,
  buildAuthReviewPacketPayload,
  buildCanonicalWritesPayloadForChangePlan,
  buildCanonicalWritesPayloadForImportPlan,
  buildChangePlanPayload,
  buildImportPlanPayload,
  buildWorkflowPresetActivationPayload,
  buildWorkflowPresetCustomizationPayload,
  buildWorkflowPresetDiffPayload,
  buildWorkflowPresetState,
  buildResolvedWorkflowContextPayload,
  buildHandoffStatusPayload,
  buildLaneStatusPayload,
  buildMaintainedConformancePayload,
  buildMaintainedDriftPayload,
  buildMaintainedRiskSummary,
  buildMultiAgentPlanPayload,
  buildSeamCheckPayload,
  buildReviewPacketPayloadForChangePlan,
  buildReviewPacketPayloadForImportPlan,
  buildRiskSummaryPayload,
  buildSingleAgentPlanPayload,
  buildWorkPacketPayload,
  classifyRisk,
  proceedDecisionFromRisk,
  summarizeDiffArtifact
} from "./agent-ops/query-builders.js";
import { resolveWorkspace } from "./resolver.js";
import { formatValidationErrors, validateWorkspace } from "./validator.js";
import { runWorkflow } from "./workflows.js";
import {
  formatProjectConfigErrors,
  loadProjectConfig,
  outputOwnershipForPath,
  projectConfigOrDefault,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "./project-config.js";

const GENERATED_OUTPUT_SENTINEL = ".topogram-generated.json";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENGINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES_ROOT = path.join(ENGINE_ROOT, "templates");
const IMPLEMENTATION_PROVIDER_TARGETS = new Set([
  "persistence-scaffold",
  "hono-server",
  "express-server",
  "sveltekit-app",
  "environment-plan",
  "environment-bundle",
  "deployment-plan",
  "deployment-bundle",
  "runtime-smoke-plan",
  "runtime-smoke-bundle",
  "runtime-check-plan",
  "runtime-check-bundle",
  "compile-check-plan",
  "compile-check-bundle",
  "app-bundle-plan",
  "app-bundle",
  "native-parity-plan",
  "native-parity-bundle"
]);

function printUsage(options = {}) {
  const { all = false } = options;
  console.log("Usage: topogram check [path] [--json]");
  console.log("   or: topogram generate [path] [--out <path>]");
  console.log("   or: topogram trust template [path]");
  console.log("   or: topogram trust status [path] [--json]");
  console.log("   or: topogram trust diff [path] [--json]");
  console.log("   or: topogram template status [path] [--json]");
  console.log("   or: topogram template check <template-spec-or-path> [--json]");
  console.log("   or: topogram template update [path] --plan [--template <spec>] [--json]");
  console.log("   or: topogram new <path> [--template web-api-db|./local-template|@scope/template]");
  console.log("   or: topogram create <path> [--template web-api-db|./local-template|@scope/template]");
  console.log("");
  console.log("Common commands:");
  console.log("  topogram create ./my-app");
  console.log("  topogram check");
  console.log("  topogram check --json");
  console.log("  topogram generate");
  console.log("  topogram trust template");
  console.log("  topogram trust status");
  console.log("  topogram trust diff");
  console.log("  topogram template status");
  console.log("  topogram template check web-api-db");
  console.log("  topogram template update --plan");
  console.log("  topogram import app ./existing-app --write");
  console.log("");
  console.log("Defaults: check/generate use ./topogram, and generate writes ./app.");
  console.log("Generated app commands are emitted into the output package.json.");
  console.log("Run `topogram help all` for legacy and agent-facing commands.");
  if (!all) {
    return;
  }
  console.log("");
  console.log("Legacy and internal commands:");
  console.log("Usage: topogram validate <path>");
  console.log("   or: node ./src/cli.js <path> [--json] [--validate] [--resolve] [--generate <target>] [--workflow <name>] [--mode <id>] [--from <track[,track]>] [--adopt <selector>] [--refresh-adopted] [--shape <id>] [--capability <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--task <id>] [--profile <id>] [--from-snapshot <path>] [--from-topogram <path>] [--write] [--out-dir <path>]");
  console.log("   or: node ./src/cli.js import app <path> [--from <track[,track]>] [--write]");
  console.log("   or: node ./src/cli.js import docs <path> [--write]");
  console.log("   or: node ./src/cli.js generate journeys <path> [--write]");
  console.log("   or: node ./src/cli.js report gaps <path> [--write]");
  console.log("   or: node ./src/cli.js query task-mode <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query adoption-plan <path>");
  console.log("   or: node ./src/cli.js query maintained-boundary <path>");
  console.log("   or: node ./src/cli.js query maintained-conformance <path> [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query maintained-drift <path> --from-topogram <path>");
  console.log("   or: node ./src/cli.js query seam-check <path> [--seam <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query diff <path> --from-topogram <path>");
  console.log("   or: node ./src/cli.js query slice <path> [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>]");
  console.log("   or: node ./src/cli.js query review-boundary <path> [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>]");
  console.log("   or: node ./src/cli.js query write-scope <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query verification-targets <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query change-plan <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query import-plan <path>");
  console.log("   or: node ./src/cli.js query risk-summary <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query canonical-writes <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query proceed-decision <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query review-packet <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query next-action <path> [--mode <id>] [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query single-agent-plan <path> --mode <id> [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query multi-agent-plan <path> --mode import-adopt");
  console.log("   or: node ./src/cli.js query resolved-workflow-context <path> --mode <id> [--capability <id>] [--workflow <id>] [--projection <id>] [--entity <id>] [--journey <id>] [--surface <id>] [--provider <id>] [--preset <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query workflow-preset-activation <path> --mode <id> [--provider <id>] [--preset <id>] [--from-topogram <path>]");
  console.log("   or: node ./src/cli.js query workflow-preset-diff <path> --provider <id> [--preset <id>]");
  console.log("   or: node ./src/cli.js query workflow-preset-customization <path> --provider <id> --preset <id>");
  console.log("   or: node ./src/cli.js workflow-preset customize <path> --provider <id> --preset <id> [--out <path>] [--write]");
  console.log("   or: node ./src/cli.js query work-packet <path> --mode import-adopt --lane <id>");
  console.log("   or: node ./src/cli.js query lane-status <path> --mode import-adopt");
  console.log("   or: node ./src/cli.js query handoff-status <path> --mode import-adopt");
  console.log("   or: node ./src/cli.js query auth-hints <path>");
  console.log("   or: node ./src/cli.js query auth-review-packet <path> --bundle <slug>");
  console.log("   or: node ./src/cli.js reconcile <path> [--write]");
  console.log("   or: node ./src/cli.js reconcile adopt <selector> <path> [--refresh-adopted] [--write]");
  console.log("   or: node ./src/cli.js adoption status <path> [--write]");
  console.log("Targets: json-schema, docs, docs-index, verification-plan, verification-checklist, shape-transform-graph, shape-transform-debug, api-contract-graph, api-contract-debug, ui-contract-graph, ui-contract-debug, ui-web-contract, ui-web-debug, sveltekit-app, swiftui-app, db-contract-graph, db-contract-debug, db-schema-snapshot, db-migration-plan, db-lifecycle-plan, db-lifecycle-bundle, environment-plan, environment-bundle, deployment-plan, deployment-bundle, runtime-smoke-plan, runtime-smoke-bundle, runtime-check-plan, runtime-check-bundle, compile-check-plan, compile-check-bundle, app-bundle-plan, app-bundle, native-parity-plan, native-parity-bundle, sql-migration, sql-schema, prisma-schema, drizzle-schema, persistence-scaffold, server-contract, hono-server, openapi, context-digest, context-diff, context-slice, context-bundle, context-report, context-task-mode");
  console.log("Workflows: import-app, scan-docs, reconcile, adoption-status, generate-docs, generate-journeys, refresh-docs, report-gaps");
  console.log("Import tracks: db, api, ui, workflows, verification");
  console.log("Reconcile adopt selectors: from-plan, actors, roles, enums, shapes, entities, capabilities, docs, journeys, workflows, ui, bundle:<slug>, projection-review:<id>, ui-review:<id>, workflow-review:<id>, bundle-review:<slug>");
}

function summarize(workspaceAst) {
  const statements = workspaceAst.files.flatMap((file) => file.statements);
  const byKind = new Map();

  for (const statement of statements) {
    byKind.set(statement.kind, (byKind.get(statement.kind) || 0) + 1);
  }

  console.log(`Parsed ${workspaceAst.files.length} file(s) and ${statements.length} statement(s).`);
  for (const [kind, count] of [...byKind.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`- ${kind}: ${count}`);
  }
}

function normalizeTopogramPath(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return absolute;
  }
  const candidate = path.join(absolute, "topogram");
  return fs.existsSync(candidate) ? candidate : absolute;
}

function isSameOrInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function rejectOutputDir(message) {
  throw new Error(`${message} Choose a generated output directory such as ./app.`);
}

function assertSafeGeneratedOutputDir(outDir, topogramRoot) {
  const resolvedOutDir = path.resolve(outDir);
  const resolvedTopogramRoot = path.resolve(topogramRoot);
  const homeDir = path.resolve(os.homedir());
  const cwd = path.resolve(process.cwd());

  if (resolvedOutDir === cwd) {
    rejectOutputDir("Refusing to replace the current working directory.");
  }
  if (resolvedOutDir === REPO_ROOT) {
    rejectOutputDir("Refusing to replace the repository root.");
  }
  if (resolvedOutDir === homeDir) {
    rejectOutputDir("Refusing to replace the home directory.");
  }
  if (isSameOrInside(resolvedOutDir, resolvedTopogramRoot) || isSameOrInside(resolvedTopogramRoot, resolvedOutDir)) {
    rejectOutputDir("Refusing to replace the Topogram source directory or one of its parents/children.");
  }

  if (!fs.existsSync(resolvedOutDir)) {
    return;
  }
  const stat = fs.statSync(resolvedOutDir);
  if (!stat.isDirectory()) {
    throw new Error(`Refusing to write generated output over non-directory path: ${resolvedOutDir}`);
  }
  const hasSentinel = fs.existsSync(path.join(resolvedOutDir, GENERATED_OUTPUT_SENTINEL));
  const isEmpty = fs.readdirSync(resolvedOutDir).length === 0;
  if (!isEmpty && !hasSentinel) {
    rejectOutputDir(
      `Refusing to replace non-empty directory without ${GENERATED_OUTPUT_SENTINEL}: ${resolvedOutDir}.`
    );
  }
}

function assertProjectOutputAllowsWrite(configInfo, outDir) {
  const ownership = outputOwnershipForPath(configInfo, outDir);
  if (ownership?.ownership === "maintained") {
    throw new Error(
      `Refusing to write generated output to maintained output '${ownership.name}': ${ownership.path}`
    );
  }
}

function generatedOutputSentinel(target) {
  return `${JSON.stringify({
    generated_by: "topogram",
    target,
    safe_to_replace: true
  }, null, 2)}\n`;
}

function topogramInputPathForGeneration(inputPath) {
  const absolute = path.resolve(inputPath);
  if (isSameOrInside(REPO_ROOT, absolute)) {
    return `./${path.relative(REPO_ROOT, absolute).replace(/\\/g, "/")}`;
  }
  return path.basename(absolute) === "topogram" ? "./topogram" : ".";
}

function targetRequiresImplementationProvider(target) {
  return IMPLEMENTATION_PROVIDER_TARGETS.has(target);
}

function topologyComponentReferences(component) {
  return {
    api: component.api || null,
    database: component.database || null
  };
}

function topologyComponentPort(component) {
  return Object.prototype.hasOwnProperty.call(component, "port") ? component.port : null;
}

function summarizeProjectTopology(config) {
  const outputs = Object.entries(config?.outputs || {})
    .map(([name, output]) => ({
      name,
      path: output?.path || null,
      ownership: output?.ownership || null
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const components = (config?.topology?.components || [])
    .map((component) => ({
      id: component.id,
      type: component.type,
      projection: component.projection,
      generator: {
        id: component.generator?.id || null,
        version: component.generator?.version || null
      },
      port: topologyComponentPort(component),
      references: topologyComponentReferences(component)
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const edges = components.flatMap((component) => {
    const references = [];
    if (component.references.api) {
      references.push({
        from: component.id,
        to: component.references.api,
        type: "calls_api"
      });
    }
    if (component.references.database) {
      references.push({
        from: component.id,
        to: component.references.database,
        type: "uses_database"
      });
    }
    return references;
  }).sort((left, right) => `${left.from}:${left.type}:${left.to}`.localeCompare(`${right.from}:${right.type}:${right.to}`));
  return {
    outputs,
    components,
    edges
  };
}

function formatTopologyComponent(component) {
  const generator = component.generator.id
    ? `${component.generator.id}${component.generator.version ? `@${component.generator.version}` : ""}`
    : "unbound generator";
  const port = component.port == null ? "no port" : `port ${component.port}`;
  const refs = Object.entries(component.references)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key} ${value}`);
  const suffix = refs.length ? ` -> ${refs.join(", ")}` : "";
  return `  - ${component.id}: ${component.type} ${component.projection} via ${generator} (${port})${suffix}`;
}

function printTopologySummary(topology) {
  console.log("Project topology:");
  if (topology.outputs.length > 0) {
    console.log("  Outputs:");
    for (const output of topology.outputs) {
      console.log(`  - ${output.name}: ${output.path || "unset"} (${output.ownership || "unknown"})`);
    }
  }
  if (topology.components.length > 0) {
    console.log("  Components:");
    for (const component of topology.components) {
      console.log(formatTopologyComponent(component));
    }
  }
  if (topology.edges.length > 0) {
    console.log("  Edges:");
    for (const edge of topology.edges) {
      console.log(`  - ${edge.from} ${edge.type} ${edge.to}`);
    }
  }
}

function checkSummaryPayload({ inputPath, ast, resolved, projectConfigInfo, projectValidation }) {
  const statementCount = ast.files.flatMap((file) => file.statements).length;
  const projectInfo = projectConfigInfo || {
    configPath: null,
    compatibility: false,
    config: { topology: null }
  };
  const resolvedTopology = summarizeProjectTopology(projectInfo.config);
  return {
    ok: resolved.ok && projectValidation.ok,
    inputPath,
    topogram: {
      files: ast.files.length,
      statements: statementCount,
      valid: resolved.ok
    },
    project: {
      configPath: projectInfo.configPath,
      compatibility: Boolean(projectInfo.compatibility),
      valid: projectValidation.ok,
      topology: projectInfo.config.topology,
      resolvedTopology
    },
    errors: [
      ...(resolved.ok ? [] : resolved.validation.errors.map((error) => ({
        source: "topogram",
        message: error.message,
        loc: error.loc
      }))),
      ...projectValidation.errors.map((error) => ({
        source: "project",
        message: error.message,
        loc: error.loc
      }))
    ]
  };
}

function combineProjectValidationResults(...results) {
  const errors = [];
  for (const result of results) {
    errors.push(...(result?.errors || []));
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * @param {Record<string, any>|null|undefined} projectConfig
 * @returns {{ id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null, sourceRoot: string|null, includesExecutableImplementation: boolean|null }}
 */
function templateMetadataFromProjectConfig(projectConfig) {
  const template = projectConfig?.template || {};
  return {
    id: typeof template.id === "string" ? template.id : null,
    version: typeof template.version === "string" ? template.version : null,
    source: typeof template.source === "string" ? template.source : null,
    sourceSpec: typeof template.sourceSpec === "string" ? template.sourceSpec : null,
    requested: typeof template.requested === "string" ? template.requested : null,
    sourceRoot: typeof template.sourceRoot === "string" ? template.sourceRoot : null,
    includesExecutableImplementation: typeof template.includesExecutableImplementation === "boolean"
      ? template.includesExecutableImplementation
      : null
  };
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} projectConfigInfo
 * @returns {{ ok: boolean, template: ReturnType<typeof templateMetadataFromProjectConfig>, trust: ReturnType<typeof getTemplateTrustStatus>|null, latest: { checked: false, reason: string }, recommendations: string[] }}
 */
function buildTemplateStatusPayload(projectConfigInfo) {
  const template = templateMetadataFromProjectConfig(projectConfigInfo.config);
  const recommendations = [];
  /** @type {ReturnType<typeof getTemplateTrustStatus>|null} */
  let trust = null;
  if (projectConfigInfo.config.implementation) {
    trust = getTemplateTrustStatus({
      config: projectConfigInfo.config.implementation,
      configPath: projectConfigInfo.configPath,
      configDir: projectConfigInfo.configDir
    }, projectConfigInfo.config);
    if (!trust.ok) {
      recommendations.push("Run `topogram trust diff` to review implementation changes, then `topogram trust template` to trust the current files.");
    }
  }
  if (!template.id) {
    recommendations.push("No template metadata found in topogram.project.json.");
  }
  return {
    ok: trust ? trust.ok : true,
    template,
    trust,
    latest: {
      checked: false,
      reason: "Registry lookups are not performed by default."
    },
    recommendations
  };
}

/**
 * @param {ReturnType<typeof buildTemplateStatusPayload>} payload
 * @returns {void}
 */
function printTemplateStatus(payload) {
  if (!payload.template.id) {
    console.log("Template status: no template metadata");
  } else if (payload.trust?.requiresTrust) {
    console.log(payload.ok ? "Template status: trusted" : "Template status: review required");
  } else {
    console.log("Template status: no executable implementation trust needed");
  }
  if (payload.template.id) {
    console.log(`Template: ${payload.template.id}@${payload.template.version || "unknown"}`);
  }
  if (payload.template.source) {
    console.log(`Source: ${payload.template.source}`);
  }
  if (payload.template.sourceSpec) {
    console.log(`Source spec: ${payload.template.sourceSpec}`);
  }
  if (payload.template.requested) {
    console.log(`Requested: ${payload.template.requested}`);
  }
  if (payload.template.sourceRoot) {
    console.log(`Source root: ${payload.template.sourceRoot}`);
  }
  console.log("Latest version: not checked");
  if (payload.trust) {
    if (payload.trust.trustRecord?.trustedAt) {
      console.log(`Trusted at: ${payload.trust.trustRecord.trustedAt}`);
    }
    if (payload.trust.implementation.module) {
      console.log(`Implementation: ${payload.trust.implementation.module}`);
    }
    if (payload.trust.content.trustedDigest) {
      console.log(`Trusted digest: ${payload.trust.content.trustedDigest}`);
    }
    if (payload.trust.content.currentDigest) {
      console.log(`Current digest: ${payload.trust.content.currentDigest}`);
    }
    for (const issue of payload.trust.issues) {
      console.log(`Issue: ${issue}`);
    }
    for (const filePath of payload.trust.content.changed) {
      console.log(`Changed: ${filePath}`);
    }
    for (const filePath of payload.trust.content.added) {
      console.log(`Added: ${filePath}`);
    }
    for (const filePath of payload.trust.content.removed) {
      console.log(`Removed: ${filePath}`);
    }
  }
  for (const recommendation of payload.recommendations) {
    console.log(recommendation);
  }
}

/**
 * @param {ReturnType<typeof buildTemplateUpdatePlan>} plan
 * @returns {void}
 */
function printTemplateUpdatePlan(plan) {
  console.log(plan.ok ? "Template update plan: ready for review" : "Template update plan: incompatible");
  console.log(`Current: ${plan.current.id || "unknown"}@${plan.current.version || "unknown"}`);
  console.log(`Candidate: ${plan.candidate.id}@${plan.candidate.version}`);
  console.log("Writes: none");
  for (const issue of plan.issues) {
    console.log(`Issue: ${issue}`);
  }
  console.log(`Added: ${plan.summary.added}`);
  console.log(`Changed: ${plan.summary.changed}`);
  console.log(`Current-only: ${plan.summary.currentOnly}`);
  console.log(`Unchanged: ${plan.summary.unchanged}`);
  for (const file of plan.files) {
    console.log("");
    console.log(`${file.kind.toUpperCase()}: ${file.path}`);
    if (file.current) {
      console.log(`  current sha256: ${file.current.sha256}`);
      console.log(`  current size: ${file.current.size}`);
    }
    if (file.candidate) {
      console.log(`  candidate sha256: ${file.candidate.sha256}`);
      console.log(`  candidate size: ${file.candidate.size}`);
    }
    if (file.binary) {
      console.log("  diff: binary file");
    } else if (file.diffOmitted && !file.unifiedDiff) {
      console.log("  diff: hash-only");
    }
    if (file.unifiedDiff) {
      console.log(file.unifiedDiff.trimEnd());
    }
  }
  if (plan.files.length === 0) {
    console.log("No template-owned file changes found.");
  }
  console.log("");
  console.log("This command did not write files. Review the plan before applying template updates manually.");
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {Record<string, any>} [details]
 * @returns {{ name: string, ok: boolean, details: Record<string, any> }}
 */
function templateCheckStep(name, ok, details = {}) {
  return { name, ok, details };
}

/**
 * @param {string} templateSpec
 * @returns {{ ok: boolean, templateSpec: string, projectRoot: string|null, steps: Array<{ name: string, ok: boolean, details: Record<string, any> }>, errors: string[] }}
 */
function buildTemplateCheckPayload(templateSpec) {
  if (!templateSpec) {
    throw new Error("topogram template check requires <template-spec-or-path>.");
  }
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-"));
  const projectRoot = path.join(runRoot, "starter");
  /** @type {Array<{ name: string, ok: boolean, details: Record<string, any> }>} */
  const steps = [];
  /** @type {string[]} */
  const errors = [];
  let created = null;
  try {
    created = createNewProject({
      targetPath: projectRoot,
      templateName: templateSpec,
      engineRoot: ENGINE_ROOT,
      templatesRoot: TEMPLATES_ROOT
    });
    steps.push(templateCheckStep("create-starter", true, {
      template: created.templateName,
      warnings: created.warnings.length
    }));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    steps.push(templateCheckStep("create-starter", false));
    return { ok: false, templateSpec, projectRoot: null, steps, errors };
  }

  const projectConfigInfo = loadProjectConfig(projectRoot);
  if (!projectConfigInfo) {
    errors.push("Generated starter is missing topogram.project.json.");
    steps.push(templateCheckStep("project-config", false));
    return { ok: false, templateSpec, projectRoot, steps, errors };
  }
  steps.push(templateCheckStep("project-config", true, {
    path: projectConfigInfo.configPath,
    template: projectConfigInfo.config.template?.id || null
  }));

  const ast = parsePath(path.join(projectRoot, "topogram"));
  const resolved = resolveWorkspace(ast);
  const projectValidation = combineProjectValidationResults(
    validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null),
    validateProjectOutputOwnership(projectConfigInfo),
    validateProjectImplementationTrust(projectConfigInfo)
  );
  const starterCheckOk = resolved.ok && projectValidation.ok;
  steps.push(templateCheckStep("starter-check", starterCheckOk, {
    files: ast.files.length,
    statements: ast.files.flatMap((file) => file.statements).length
  }));
  if (!starterCheckOk) {
    for (const error of [
      ...(resolved.ok ? [] : resolved.validation.errors),
      ...projectValidation.errors
    ]) {
      errors.push(error.message);
    }
  }

  const implementationInfo = projectConfigInfo.config.implementation
    ? {
        config: projectConfigInfo.config.implementation,
        configPath: projectConfigInfo.configPath,
        configDir: projectConfigInfo.configDir
      }
    : null;
  if (implementationInfo && implementationRequiresTrust(implementationInfo)) {
    const trustStatus = getTemplateTrustStatus(implementationInfo, projectConfigInfo.config);
    steps.push(templateCheckStep("executable-implementation-trust", trustStatus.ok, {
      requiresTrust: true,
      trustPath: trustStatus.trustPath,
      trustedFiles: trustStatus.trustRecord?.content?.files?.length || 0
    }));
    if (!trustStatus.ok) {
      errors.push(...trustStatus.issues);
    }
  } else {
    steps.push(templateCheckStep("executable-implementation-trust", true, {
      requiresTrust: false
    }));
  }

  try {
    const updatePlan = buildTemplateUpdatePlan({
      projectRoot,
      projectConfig: projectConfigInfo.config,
      templateName: null,
      templatesRoot: TEMPLATES_ROOT
    });
    steps.push(templateCheckStep("template-update-plan", updatePlan.ok, {
      writes: updatePlan.writes,
      added: updatePlan.summary.added,
      changed: updatePlan.summary.changed,
      currentOnly: updatePlan.summary.currentOnly
    }));
    if (!updatePlan.ok) {
      errors.push(...updatePlan.issues);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    steps.push(templateCheckStep("template-update-plan", false));
  }

  return {
    ok: steps.every((step) => step.ok),
    templateSpec,
    projectRoot,
    steps,
    errors
  };
}

/**
 * @param {ReturnType<typeof buildTemplateCheckPayload>} payload
 * @returns {void}
 */
function printTemplateCheckPayload(payload) {
  console.log(payload.ok ? "Template check passed" : "Template check failed");
  console.log(`Template spec: ${payload.templateSpec}`);
  if (payload.projectRoot) {
    console.log(`Temp starter: ${payload.projectRoot}`);
  }
  for (const step of payload.steps) {
    console.log(`${step.ok ? "PASS" : "FAIL"} ${step.name}`);
  }
  for (const error of payload.errors) {
    console.log(`Issue: ${error}`);
  }
}

function workflowPresetSelectors({
  taskModeArtifact,
  providerId = null,
  presetId = null,
  queryFamily = null
} = {}) {
  const categories = [];
  if (taskModeArtifact?.mode === "import-adopt") categories.push("provider_adoption");
  if (taskModeArtifact?.mode === "maintained-app-edit") categories.push("maintained_app");
  if ((taskModeArtifact?.verification_targets?.maintained_app_checks || []).length > 0) categories.push("maintained_boundary");
  return {
    mode: taskModeArtifact?.mode || null,
    task_class: taskModeArtifact?.mode || null,
    provider_id: providerId,
    preset_id: presetId,
    query_family: queryFamily,
    integration_categories: categories
  };
}

function importAdoptOnlyRequested({
  modeId,
  capabilityId,
  workflowId,
  projectionId,
  entityId,
  journeyId,
  surfaceId,
  fromTopogramPath
} = {}) {
  return modeId === "import-adopt" && !(
    capabilityId ||
    workflowId ||
    projectionId ||
    entityId ||
    journeyId ||
    surfaceId ||
    fromTopogramPath
  );
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h") || args[0] === "help") {
  printUsage({ all: args[1] === "all" || args.includes("--all") });
  process.exit(args.length === 0 ? 1 : 0);
}

if (args[0] === "help-all") {
  printUsage({ all: true });
  process.exit(0);
}

function commandPath(index, fallback = "./topogram") {
  const value = args[index];
  return value && !value.startsWith("-") ? value : fallback;
}

let commandArgs = null;
let inputPath = args[0];
if (args[0] === "new" || args[0] === "create") {
  commandArgs = { newProject: true, inputPath: args[1] };
} else if (args[0] === "check") {
  commandArgs = { check: true, inputPath: commandPath(1) };
} else if (args[0] === "validate") {
  commandArgs = { validate: true, inputPath: args[1] };
} else if (args[0] === "generate" && args[1] === "app") {
  commandArgs = { generateTarget: "app-bundle", write: true, inputPath: commandPath(2), defaultOutDir: "./app" };
} else if (args[0] === "generate" && args[1] !== "journeys") {
  commandArgs = { generateTarget: "app-bundle", write: true, inputPath: commandPath(1), defaultOutDir: "./app" };
} else if (args[0] === "trust" && args[1] === "template") {
  commandArgs = { trustTemplate: true, inputPath: commandPath(2) };
} else if (args[0] === "trust" && args[1] === "status") {
  commandArgs = { trustStatus: true, inputPath: commandPath(2) };
} else if (args[0] === "trust" && args[1] === "diff") {
  commandArgs = { trustDiff: true, inputPath: commandPath(2) };
} else if (args[0] === "template" && args[1] === "status") {
  commandArgs = { templateStatus: true, inputPath: commandPath(2) };
} else if (args[0] === "template" && args[1] === "check") {
  commandArgs = { templateCheck: true, inputPath: args[2] };
} else if (args[0] === "template" && args[1] === "update") {
  commandArgs = { templateUpdate: true, inputPath: commandPath(2) };
} else if (args[0] === "import" && args[1] === "app") {
  commandArgs = { workflowName: "import-app", inputPath: args[2] };
} else if (args[0] === "import" && args[1] === "docs") {
  commandArgs = { workflowName: "scan-docs", inputPath: args[2] };
} else if (args[0] === "generate" && args[1] === "journeys") {
  commandArgs = { workflowName: "generate-journeys", inputPath: args[2] };
} else if (args[0] === "report" && args[1] === "gaps") {
  commandArgs = { workflowName: "report-gaps", inputPath: args[2] };
} else if (args[0] === "reconcile" && args[1] === "adopt") {
  commandArgs = { workflowName: "reconcile", inputPath: args[3], adoptValue: args[2] };
} else if (args[0] === "reconcile") {
  commandArgs = { workflowName: "reconcile", inputPath: args[1] };
} else if (args[0] === "adoption" && args[1] === "status") {
  commandArgs = { workflowName: "adoption-status", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "task-mode") {
  commandArgs = { generateTarget: "context-task-mode", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "adoption-plan") {
  commandArgs = { queryName: "adoption-plan", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "maintained-boundary") {
  commandArgs = { queryName: "maintained-boundary", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "maintained-conformance") {
  commandArgs = { queryName: "maintained-conformance", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "maintained-drift") {
  commandArgs = { queryName: "maintained-drift", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "seam-check") {
  commandArgs = { queryName: "seam-check", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "diff") {
  commandArgs = { generateTarget: "context-diff", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "slice") {
  commandArgs = { generateTarget: "context-slice", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "review-boundary") {
  commandArgs = { queryName: "review-boundary", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "write-scope") {
  commandArgs = { queryName: "write-scope", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "verification-targets") {
  commandArgs = { queryName: "verification-targets", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "change-plan") {
  commandArgs = { queryName: "change-plan", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "import-plan") {
  commandArgs = { queryName: "import-plan", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "risk-summary") {
  commandArgs = { queryName: "risk-summary", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "canonical-writes") {
  commandArgs = { queryName: "canonical-writes", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "proceed-decision") {
  commandArgs = { queryName: "proceed-decision", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "review-packet") {
  commandArgs = { queryName: "review-packet", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "next-action") {
  commandArgs = { queryName: "next-action", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "single-agent-plan") {
  commandArgs = { queryName: "single-agent-plan", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "multi-agent-plan") {
  commandArgs = { queryName: "multi-agent-plan", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "resolved-workflow-context") {
  commandArgs = { queryName: "resolved-workflow-context", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "workflow-preset-activation") {
  commandArgs = { queryName: "workflow-preset-activation", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "workflow-preset-diff") {
  commandArgs = { queryName: "workflow-preset-diff", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "workflow-preset-customization") {
  commandArgs = { queryName: "workflow-preset-customization", inputPath: args[2] };
} else if (args[0] === "workflow-preset" && args[1] === "customize") {
  commandArgs = { workflowPresetCommand: "customize", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "work-packet") {
  commandArgs = { queryName: "work-packet", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "lane-status") {
  commandArgs = { queryName: "lane-status", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "handoff-status") {
  commandArgs = { queryName: "handoff-status", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "auth-hints") {
  commandArgs = { queryName: "auth-hints", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "auth-review-packet") {
  commandArgs = { queryName: "auth-review-packet", inputPath: args[2] };
}
if (commandArgs && Object.prototype.hasOwnProperty.call(commandArgs, "inputPath")) {
  inputPath = commandArgs.inputPath;
}
const emitJson = args.includes("--json");
const shouldCheck = Boolean(commandArgs?.check);
const shouldTrustTemplate = Boolean(commandArgs?.trustTemplate);
const shouldTrustStatus = Boolean(commandArgs?.trustStatus);
const shouldTrustDiff = Boolean(commandArgs?.trustDiff);
const shouldTemplateStatus = Boolean(commandArgs?.templateStatus);
const shouldTemplateCheck = Boolean(commandArgs?.templateCheck);
const shouldTemplateUpdate = Boolean(commandArgs?.templateUpdate);
const shouldValidate = Boolean(commandArgs?.validate) || args.includes("--validate");
const shouldResolve = args.includes("--resolve");
const generateIndex = args.indexOf("--generate");
const generateTarget = commandArgs?.generateTarget || (generateIndex >= 0 ? args[generateIndex + 1] : null);
const workflowIndex = args.indexOf("--workflow");
const workflowFlagValue = workflowIndex >= 0 ? args[workflowIndex + 1] : null;
const modeIndex = args.indexOf("--mode");
const modeId = modeIndex >= 0 ? args[modeIndex + 1] : null;
const workflowName = commandArgs?.workflowName || (!generateTarget && workflowFlagValue ? workflowFlagValue : null);
const workflowId = generateTarget ? workflowFlagValue : null;
const fromIndex = args.indexOf("--from");
const fromValue = fromIndex >= 0 ? args[fromIndex + 1] : null;
const adoptIndex = args.indexOf("--adopt");
const adoptValue = commandArgs?.adoptValue || (adoptIndex >= 0 ? args[adoptIndex + 1] : null);
const shapeIndex = args.indexOf("--shape");
const shapeId = shapeIndex >= 0 ? args[shapeIndex + 1] : null;
const capabilityIndex = args.indexOf("--capability");
const capabilityId = capabilityIndex >= 0 ? args[capabilityIndex + 1] : null;
const projectionIndex = args.indexOf("--projection");
const projectionId = projectionIndex >= 0 ? args[projectionIndex + 1] : null;
const entityIndex = args.indexOf("--entity");
const entityId = entityIndex >= 0 ? args[entityIndex + 1] : null;
const journeyIndex = args.indexOf("--journey");
const journeyId = journeyIndex >= 0 ? args[journeyIndex + 1] : null;
const surfaceIndex = args.indexOf("--surface");
const surfaceId = surfaceIndex >= 0 ? args[surfaceIndex + 1] : null;
const seamIndex = args.indexOf("--seam");
const seamId = seamIndex >= 0 ? args[seamIndex + 1] : null;
const taskIndex = args.indexOf("--task");
const taskId = taskIndex >= 0 ? args[taskIndex + 1] : null;
const profileIndex = args.indexOf("--profile");
const profileId = profileIndex >= 0 ? args[profileIndex + 1] : null;
const providerIndex = args.indexOf("--provider");
const providerId = providerIndex >= 0 ? args[providerIndex + 1] : null;
const presetIndex = args.indexOf("--preset");
const presetId = presetIndex >= 0 ? args[presetIndex + 1] : null;
const templateIndex = args.indexOf("--template");
const templateName = templateIndex >= 0 ? args[templateIndex + 1] : "web-api-db";
const bundleIndex = args.indexOf("--bundle");
const bundleSlug = bundleIndex >= 0 ? args[bundleIndex + 1] : null;
const laneIndex = args.indexOf("--lane");
const laneId = laneIndex >= 0 ? args[laneIndex + 1] : null;
const fromSnapshotIndex = args.indexOf("--from-snapshot");
const fromSnapshotPath = fromSnapshotIndex >= 0 ? path.resolve(args[fromSnapshotIndex + 1]) : null;
const fromTopogramIndex = args.indexOf("--from-topogram");
const fromTopogramPath = fromTopogramIndex >= 0 ? path.resolve(args[fromTopogramIndex + 1]) : null;
const shouldWrite = Boolean(commandArgs?.write) || args.includes("--write");
const refreshAdopted = args.includes("--refresh-adopted");
const outDirIndex = args.indexOf("--out-dir");
const outDir = outDirIndex >= 0 ? args[outDirIndex + 1] : null;
const outIndex = args.indexOf("--out");
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
const effectiveOutDir = outDir || outPath || commandArgs?.defaultOutDir || null;

if ((shouldCheck || shouldValidate || shouldTrustTemplate || shouldTrustStatus || shouldTrustDiff || shouldTemplateStatus || shouldTemplateCheck || shouldTemplateUpdate || generateTarget === "app-bundle") && !inputPath) {
  console.error("Missing required <path>.");
  printUsage();
  process.exit(1);
}

if ((shouldCheck || shouldValidate || shouldTrustTemplate || shouldTrustStatus || shouldTrustDiff || shouldTemplateStatus || shouldTemplateUpdate || generateTarget === "app-bundle") && inputPath) {
  inputPath = normalizeTopogramPath(inputPath);
}

try {
  if (commandArgs?.newProject) {
    const result = createNewProject({
      targetPath: inputPath,
      templateName,
      engineRoot: ENGINE_ROOT,
      templatesRoot: TEMPLATES_ROOT
    });
    console.log(`Created Topogram project at ${result.projectRoot}.`);
    console.log(`Template: ${result.templateName}`);
    for (const warning of result.warnings) {
      console.warn(`Warning: ${warning}`);
    }
    console.log("");
    console.log("Next steps:");
    const relativeProjectRoot = path.relative(process.cwd(), result.projectRoot);
    const displayProjectRoot = !relativeProjectRoot || relativeProjectRoot.startsWith("..")
      ? result.projectRoot
      : relativeProjectRoot;
    console.log(`  cd ${displayProjectRoot}`);
    console.log("  npm install");
    console.log("  npm run check");
    console.log("  npm run generate");
    console.log("  npm run verify");
    process.exit(0);
  }

  if (shouldTemplateStatus) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot inspect template status without topogram.project.json.");
    }
    const status = buildTemplateStatusPayload(projectConfigInfo);
    if (emitJson) {
      console.log(stableStringify(status));
    } else {
      printTemplateStatus(status);
    }
    process.exit(status.ok ? 0 : 1);
  }

  if (shouldTemplateCheck) {
    const payload = buildTemplateCheckPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTemplateCheckPayload(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldTemplateUpdate) {
    if (!args.includes("--plan")) {
      throw new Error("Template update is plan-only for now. Run `topogram template update --plan`.");
    }
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot plan template update without topogram.project.json.");
    }
    const plan = buildTemplateUpdatePlan({
      projectRoot: projectConfigInfo.configDir,
      projectConfig: projectConfigInfo.config,
      templateName: templateIndex >= 0 ? templateName : null,
      templatesRoot: TEMPLATES_ROOT
    });
    if (emitJson) {
      console.log(stableStringify(plan));
    } else {
      printTemplateUpdatePlan(plan);
    }
    process.exit(plan.ok ? 0 : 1);
  }

  if (shouldTrustTemplate) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot trust template implementation without topogram.project.json.");
    }
    if (!projectConfigInfo.config.implementation) {
      throw new Error("Cannot trust template implementation because topogram.project.json has no implementation config.");
    }
    const implementationInfo = {
      config: projectConfigInfo.config.implementation,
      configPath: projectConfigInfo.configPath,
      configDir: projectConfigInfo.configDir
    };
    if (!implementationRequiresTrust(implementationInfo)) {
      console.log("No local implementation trust record needed for this project.");
      process.exit(0);
    }
    const trustRecord = writeTemplateTrustRecord(projectConfigInfo.configDir, projectConfigInfo.config);
    console.log(`Wrote ${TEMPLATE_TRUST_FILE} for ${trustRecord.implementation.module}.`);
    if (trustRecord.template.id) {
      console.log(`Trusted template: ${trustRecord.template.id}@${trustRecord.template.version || "unknown"}`);
    }
    console.log(`Trusted implementation digest: ${trustRecord.content.digest}`);
    process.exit(0);
  }

  if (shouldTrustStatus) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot inspect template trust without topogram.project.json.");
    }
    if (!projectConfigInfo.config.implementation) {
      throw new Error("Cannot inspect template trust because topogram.project.json has no implementation config.");
    }
    const implementationInfo = {
      config: projectConfigInfo.config.implementation,
      configPath: projectConfigInfo.configPath,
      configDir: projectConfigInfo.configDir
    };
    const status = getTemplateTrustStatus(implementationInfo, projectConfigInfo.config);
    if (emitJson) {
      console.log(stableStringify(status));
    } else if (!status.requiresTrust) {
      console.log("No local implementation trust record needed for this project.");
    } else {
      console.log(status.ok ? "Template trust status: trusted" : "Template trust status: review required");
      if (status.template.id) {
        console.log(`Template: ${status.template.id}@${status.template.version || "unknown"}`);
      }
      console.log(`Implementation: ${status.implementation.module}`);
      if (status.content.trustedDigest) {
        console.log(`Trusted digest: ${status.content.trustedDigest}`);
      }
      if (status.content.currentDigest) {
        console.log(`Current digest: ${status.content.currentDigest}`);
      }
      for (const issue of status.issues) {
        console.log(`Issue: ${issue}`);
      }
      for (const filePath of status.content.changed) {
        console.log(`Changed: ${filePath}`);
      }
      for (const filePath of status.content.added) {
        console.log(`Added: ${filePath}`);
      }
      for (const filePath of status.content.removed) {
        console.log(`Removed: ${filePath}`);
      }
      if (!status.ok) {
        console.log("Run `topogram trust diff` to review implementation changes, then `topogram trust template` to trust the current files.");
      }
    }
    process.exit(status.ok ? 0 : 1);
  }

  if (shouldTrustDiff) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot inspect template trust diff without topogram.project.json.");
    }
    if (!projectConfigInfo.config.implementation) {
      throw new Error("Cannot inspect template trust diff because topogram.project.json has no implementation config.");
    }
    const implementationInfo = {
      config: projectConfigInfo.config.implementation,
      configPath: projectConfigInfo.configPath,
      configDir: projectConfigInfo.configDir
    };
    const diff = getTemplateTrustDiff(implementationInfo, projectConfigInfo.config);
    if (emitJson) {
      console.log(stableStringify(diff));
    } else if (!diff.requiresTrust) {
      console.log("No local implementation trust record needed for this project.");
    } else if (diff.files.length === 0) {
      console.log(diff.ok ? "Template trust diff: no implementation changes." : "Template trust diff: no file-level diff available.");
      for (const issue of diff.status.issues) {
        console.log(`Issue: ${issue}`);
      }
    } else {
      console.log(diff.ok ? "Template trust diff: no implementation changes." : "Template trust diff: review required");
      for (const file of diff.files) {
        console.log("");
        console.log(`${file.kind.toUpperCase()}: implementation/${file.path}`);
        if (file.trusted) {
          console.log(`  trusted sha256: ${file.trusted.sha256}`);
          console.log(`  trusted size: ${file.trusted.size}`);
        }
        if (file.current) {
          console.log(`  current sha256: ${file.current.sha256}`);
          console.log(`  current size: ${file.current.size}`);
        }
        if (file.binary) {
          console.log("  diff: binary file");
        } else if (file.diffOmitted && !file.unifiedDiff) {
          console.log("  diff: hash-only");
        }
        if (file.unifiedDiff) {
          console.log(file.unifiedDiff.trimEnd());
        }
      }
      if (!diff.ok) {
        console.log("");
        console.log("After review, run `topogram trust template` to trust the current files.");
      }
    }
    process.exit(diff.ok ? 0 : 1);
  }

  if (shouldCheck) {
    const ast = parsePath(inputPath);
    const resolved = resolveWorkspace(ast);
    const implementation = await loadImplementationProvider(inputPath).catch(() => null);
    const explicitProjectConfig = loadProjectConfig(inputPath);
    const projectConfigInfo = explicitProjectConfig ||
      (implementation ? projectConfigOrDefault(inputPath, resolved.ok ? resolved.graph : null, implementation) : null);
    const projectValidation = projectConfigInfo
      ? combineProjectValidationResults(
          validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null),
          validateProjectOutputOwnership(projectConfigInfo),
          validateProjectImplementationTrust(projectConfigInfo)
        )
      : { ok: false, errors: [{ message: "Missing topogram.project.json or compatible topogram.implementation.json", loc: null }] };
    const payload = checkSummaryPayload({ inputPath, ast, resolved, projectConfigInfo, projectValidation });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else if (payload.ok) {
      console.log(`Topogram check passed for ${inputPath}.`);
      console.log(`Validated ${payload.topogram.files} file(s) and ${payload.topogram.statements} statement(s).`);
      console.log(`Project config: ${payload.project.configPath || "compatibility defaults"}`);
      printTopologySummary(payload.project.resolvedTopology);
    } else {
      if (!resolved.ok) {
        console.error(formatValidationErrors(resolved.validation));
      }
      if (!projectValidation.ok) {
        console.error(formatProjectConfigErrors(projectValidation, projectConfigInfo?.configPath || "topogram.project.json"));
      }
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (commandArgs?.queryName === "adoption-plan") {
    const topogramRoot = normalizeTopogramPath(inputPath);
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    if (!fs.existsSync(adoptionPlanPath)) {
      throw new Error(`No agent adoption plan found at '${adoptionPlanPath}'`);
    }
    const artifact = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
    console.log(stableStringify(artifact));
    process.exit(0);
  }

  if (commandArgs?.queryName === "maintained-boundary") {
    const ast = parsePath(inputPath);
    const result = generateWorkspace(ast, {
      target: "context-bundle",
      taskId: "maintained-app"
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    console.log(stableStringify(result.artifact.maintained_boundary));
    process.exit(0);
  }

  if (commandArgs?.queryName === "maintained-drift") {
    if (!fromTopogramPath) {
      throw new Error("query maintained-drift requires --from-topogram <path>.");
    }
    const ast = parsePath(inputPath);
    const diffResult = generateWorkspace(ast, {
      target: "context-diff",
      fromTopogramPath
    });
    if (!diffResult.ok) {
      console.error(formatValidationErrors(diffResult.validation));
      process.exit(1);
    }
    const maintainedBundleResult = generateWorkspace(ast, {
      target: "context-bundle",
      taskId: "maintained-app"
    });
    if (!maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: "diff-review",
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }

    console.log(stableStringify(buildMaintainedDriftPayload({
      diffArtifact: diffResult.artifact,
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "maintained-conformance") {
    const ast = parsePath(inputPath);
    const resolved = resolveWorkspace(ast);
    if (!resolved.ok) {
      console.error(formatValidationErrors(resolved.validation));
      process.exit(1);
    }
    const diffResult = fromTopogramPath
      ? generateWorkspace(ast, {
          target: "context-diff",
          fromTopogramPath
        })
      : null;
    if (diffResult && !diffResult.ok) {
      console.error(formatValidationErrors(diffResult.validation));
      process.exit(1);
    }
    const maintainedBundleResult = generateWorkspace(ast, {
      target: "context-bundle",
      taskId: "maintained-app"
    });
    if (!maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: fromTopogramPath ? "diff-review" : "verification",
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }

    console.log(stableStringify(buildMaintainedConformancePayload({
      graph: resolved.graph,
      diffArtifact: diffResult?.artifact || null,
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "seam-check") {
    const ast = parsePath(inputPath);
    const resolved = resolveWorkspace(ast);
    if (!resolved.ok) {
      console.error(formatValidationErrors(resolved.validation));
      process.exit(1);
    }
    const diffResult = fromTopogramPath
      ? generateWorkspace(ast, {
          target: "context-diff",
          fromTopogramPath
        })
      : null;
    if (diffResult && !diffResult.ok) {
      console.error(formatValidationErrors(diffResult.validation));
      process.exit(1);
    }
    const maintainedBundleResult = generateWorkspace(ast, {
      target: "context-bundle",
      taskId: "maintained-app"
    });
    if (!maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: fromTopogramPath ? "diff-review" : "verification",
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }

    console.log(stableStringify(buildSeamCheckPayload({
      graph: resolved.graph,
      maintainedBoundaryArtifact: maintainedBundleResult.artifact.maintained_boundary || null,
      diffArtifact: diffResult?.artifact || null,
      verificationTargets: maintainedBundleResult.artifact.verification_targets || taskModeResult.artifact.verification_targets || null,
      nextAction: taskModeResult.artifact.next_action || null,
      seamId
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "review-boundary") {
    const ast = parsePath(inputPath);
    const result = generateWorkspace(ast, {
      target: "context-slice",
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    console.log(stableStringify({
      type: "review_boundary_query",
      focus: result.artifact.focus,
      review_boundary: result.artifact.review_boundary,
      ownership_boundary: result.artifact.ownership_boundary,
      write_scope: result.artifact.write_scope || null,
      verification_targets: result.artifact.verification_targets || null
    }));
    process.exit(0);
  }

  if (commandArgs?.queryName === "write-scope") {
    const ast = parsePath(inputPath);
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId);

    if (modeId || (!hasSelector && !fromTopogramPath)) {
      const effectiveModeId = modeId || "verification";
      const result = generateWorkspace(ast, {
        target: "context-task-mode",
        modeId: effectiveModeId,
        capabilityId,
        workflowId,
        projectionId,
        entityId,
        journeyId,
        surfaceId,
        fromTopogramPath
      });
      if (!result.ok) {
        console.error(formatValidationErrors(result.validation));
        process.exit(1);
      }
      console.log(stableStringify({
        type: "write_scope_query",
        source: "context-task-mode",
        mode: result.artifact.mode,
        summary: result.artifact.summary || null,
        rationale: "Task mode write scope is the safest file-boundary contract for the selected operating mode.",
        write_scope: result.artifact.write_scope || null
      }));
      process.exit(0);
    }

    if (surfaceId === "maintained-boundary") {
      const result = generateWorkspace(ast, {
        target: "context-bundle",
        taskId: "maintained-app"
      });
      if (!result.ok) {
        console.error(formatValidationErrors(result.validation));
        process.exit(1);
      }
      console.log(stableStringify({
        type: "write_scope_query",
        source: "maintained-boundary",
        summary: {
          maintained_file_count: (result.artifact.maintained_boundary?.maintained_files_in_scope || []).length
        },
        rationale: "Maintained-boundary write scope isolates the human-owned application files currently in scope.",
        write_scope: result.artifact.write_scope || null
      }));
      process.exit(0);
    }

    const result = generateWorkspace(ast, {
      target: "context-slice",
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    console.log(stableStringify({
      type: "write_scope_query",
      source: "context-slice",
      focus: result.artifact.focus,
      summary: result.artifact.summary || null,
      rationale: "Slice write scope is the narrowest file-boundary contract attached to the selected semantic surface.",
      write_scope: result.artifact.write_scope || null
    }));
    process.exit(0);
  }

  if (commandArgs?.queryName === "verification-targets") {
    const ast = parsePath(inputPath);
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId);

    if (modeId || (!hasSelector && !fromTopogramPath)) {
      const effectiveModeId = modeId || "verification";
      const result = generateWorkspace(ast, {
        target: "context-task-mode",
        modeId: effectiveModeId,
        capabilityId,
        workflowId,
        projectionId,
        entityId,
        journeyId,
        surfaceId,
        fromTopogramPath
      });
      if (!result.ok) {
        console.error(formatValidationErrors(result.validation));
        process.exit(1);
      }
      console.log(stableStringify({
        type: "verification_targets_query",
        source: "context-task-mode",
        mode: result.artifact.mode,
        summary: result.artifact.summary || null,
        verification_targets: result.artifact.verification_targets || null
      }));
      process.exit(0);
    }

    if (fromTopogramPath) {
      const resolved = resolveWorkspace(ast);
      if (!resolved.ok) {
        console.error(formatValidationErrors(resolved.validation));
        process.exit(1);
      }
      const result = generateWorkspace(ast, {
        target: "context-diff",
        fromTopogramPath
      });
      if (!result.ok) {
        console.error(formatValidationErrors(result.validation));
        process.exit(1);
      }
      const affectedVerificationIds = (result.artifact.affected_verifications || []).map((item) => item.id);
      const verificationTargets = recommendedVerificationTargets(resolved.graph, affectedVerificationIds, {
        includeMaintainedApp: Boolean(result.artifact.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact),
        rationale: "Diff verification targets should cover the affected semantic proof set and any maintained-app proof gates."
      });
      console.log(stableStringify({
        type: "verification_targets_query",
        source: "context-diff",
        summary: {
          baseline_root: result.artifact.baseline_root,
          affected_verification_count: affectedVerificationIds.length,
          maintained_code_impact: Boolean(result.artifact.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact)
        },
        verification_targets: verificationTargets,
        affected_verifications: result.artifact.affected_verifications || []
      }));
      process.exit(0);
    }

    const result = generateWorkspace(ast, {
      target: "context-slice",
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    console.log(stableStringify({
      type: "verification_targets_query",
      source: "context-slice",
      focus: result.artifact.focus,
      summary: result.artifact.summary || null,
      verification_targets: result.artifact.verification_targets || null
    }));
    process.exit(0);
  }

  if (commandArgs?.queryName === "change-plan") {
    const ast = parsePath(inputPath);
    const resolved = resolveWorkspace(ast);
    if (!resolved.ok) {
      console.error(formatValidationErrors(resolved.validation));
      process.exit(1);
    }
    const effectiveModeId = modeId || "modeling";
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: effectiveModeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }

    const hasSelector = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          entityId,
          journeyId,
          surfaceId
        })
      : null;
    if (sliceResult && !sliceResult.ok) {
      console.error(formatValidationErrors(sliceResult.validation));
      process.exit(1);
    }

    const diffResult = fromTopogramPath
      ? generateWorkspace(ast, {
          target: "context-diff",
          fromTopogramPath
        })
      : null;
    if (diffResult && !diffResult.ok) {
      console.error(formatValidationErrors(diffResult.validation));
      process.exit(1);
    }

    const includeMaintainedBoundary =
      effectiveModeId === "maintained-app-edit" ||
      surfaceId === "maintained-boundary" ||
      Boolean(diffResult?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact);
    const maintainedBundleResult = includeMaintainedBoundary
      ? generateWorkspace(ast, {
          target: "context-bundle",
          taskId: "maintained-app"
        })
      : null;
    if (maintainedBundleResult && !maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }

    console.log(stableStringify(buildChangePlanPayload({
      graph: resolved.graph,
      taskModeArtifact: taskModeResult.artifact,
      sliceArtifact: sliceResult?.artifact || null,
      diffArtifact: diffResult?.artifact || null,
      maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "import-plan") {
    const topogramRoot = normalizeTopogramPath(inputPath);
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    if (!fs.existsSync(adoptionPlanPath)) {
      throw new Error(`No agent adoption plan found at '${adoptionPlanPath}'`);
    }
    const adoptionPlan = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
    const ast = parsePath(inputPath);
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: "import-adopt"
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const maintainedBundleResult = generateWorkspace(ast, {
      target: "context-bundle",
      taskId: "maintained-app"
    });
    if (!maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }
    const workflowPresets = buildWorkflowPresetState({
      workspace: topogramRoot,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: "import-plan"
      })
    });
    console.log(stableStringify(buildImportPlanPayload(
      adoptionPlan,
      taskModeResult.artifact,
      maintainedBundleResult.artifact.maintained_boundary || null,
      workflowPresets
    )));
    process.exit(0);
  }

  if (commandArgs?.queryName === "risk-summary") {
    const topogramRoot = normalizeTopogramPath(inputPath);
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    const hasSelectors = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId || fromTopogramPath);
    const useImportAdoptPath =
      importAdoptOnlyRequested({ modeId, capabilityId, workflowId, projectionId, entityId, journeyId, surfaceId, fromTopogramPath }) ||
      (!hasSelectors && !modeId);

    if (useImportAdoptPath && fs.existsSync(adoptionPlanPath)) {
      const adoptionPlan = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
      const ast = parsePath(inputPath);
      const taskModeResult = generateWorkspace(ast, {
        target: "context-task-mode",
        modeId: "import-adopt"
      });
      if (!taskModeResult.ok) {
        console.error(formatValidationErrors(taskModeResult.validation));
        process.exit(1);
      }
      const maintainedBundleResult = generateWorkspace(ast, {
        target: "context-bundle",
        taskId: "maintained-app"
      });
      if (!maintainedBundleResult.ok) {
        console.error(formatValidationErrors(maintainedBundleResult.validation));
        process.exit(1);
      }
      const workflowPresets = buildWorkflowPresetState({
        workspace: topogramRoot,
        selectors: workflowPresetSelectors({
          taskModeArtifact: taskModeResult.artifact,
          providerId,
          presetId,
          queryFamily: "risk-summary"
        })
      });
      const importPlan = buildImportPlanPayload(adoptionPlan, taskModeResult.artifact, maintainedBundleResult.artifact.maintained_boundary || null, workflowPresets);
      const risk = classifyRisk({
        importPlan,
        verificationTargets: importPlan.verification_targets,
        maintainedRisk: importPlan.maintained_risk || null
      });
      console.log(stableStringify(buildRiskSummaryPayload({
        source: "import-plan",
        risk,
        nextAction: importPlan.next_action || null,
        maintainedRisk: importPlan.maintained_risk || null
      })));
      process.exit(0);
    }

    const ast = parsePath(inputPath);
    const effectiveModeId = modeId || "modeling";
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: effectiveModeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          entityId,
          journeyId,
          surfaceId
        })
      : null;
    if (sliceResult && !sliceResult.ok) {
      console.error(formatValidationErrors(sliceResult.validation));
      process.exit(1);
    }
    const diffResult = fromTopogramPath
      ? generateWorkspace(ast, {
          target: "context-diff",
          fromTopogramPath
        })
      : null;
    if (diffResult && !diffResult.ok) {
      console.error(formatValidationErrors(diffResult.validation));
      process.exit(1);
    }
    const maintainedBundleResult =
      effectiveModeId === "maintained-app-edit" ||
      surfaceId === "maintained-boundary" ||
      Boolean(diffResult?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact)
        ? generateWorkspace(ast, {
            target: "context-bundle",
            taskId: "maintained-app"
          })
        : null;
    if (maintainedBundleResult && !maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }
    const resolved = resolveWorkspace(ast);
    if (!resolved.ok) {
      console.error(formatValidationErrors(resolved.validation));
      process.exit(1);
    }

    const changePlan = buildChangePlanPayload({
      graph: resolved.graph,
      taskModeArtifact: taskModeResult.artifact,
      sliceArtifact: sliceResult?.artifact || null,
      diffArtifact: diffResult?.artifact || null,
      maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
    });
    const diffSummary = changePlan.diff_summary || summarizeDiffArtifact(diffResult?.artifact || null);
    const maintainedRisk = buildMaintainedRiskSummary({
      maintainedImpacts: changePlan.maintained_impacts,
      maintainedBoundary: changePlan.maintained_boundary,
      diffSummary
    });
    const risk = classifyRisk({
      reviewBoundary: changePlan.review_boundary,
      maintainedBoundary: changePlan.maintained_boundary,
      diffSummary,
      verificationTargets: changePlan.verification_targets,
      maintainedRisk
    });
    console.log(stableStringify(buildRiskSummaryPayload({
      source: "change-plan",
      risk,
      nextAction: changePlan.next_action || null,
      maintainedRisk
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "canonical-writes") {
    const topogramRoot = normalizeTopogramPath(inputPath);
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    const hasSelectors = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId || fromTopogramPath);
    const useImportAdoptPath =
      importAdoptOnlyRequested({ modeId, capabilityId, workflowId, projectionId, entityId, journeyId, surfaceId, fromTopogramPath }) ||
      (!hasSelectors && !modeId);

    if (useImportAdoptPath && fs.existsSync(adoptionPlanPath)) {
      const adoptionPlan = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
      const proposalSurfaces = adoptionPlan.imported_proposal_surfaces || [];
      console.log(stableStringify(buildCanonicalWritesPayloadForImportPlan(proposalSurfaces)));
      process.exit(0);
    }

    const ast = parsePath(inputPath);
    const effectiveModeId = modeId || "modeling";
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: effectiveModeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    console.log(stableStringify(buildCanonicalWritesPayloadForChangePlan(taskModeResult.artifact.write_scope)));
    process.exit(0);
  }

  if (commandArgs?.queryName === "proceed-decision") {
    const topogramRoot = normalizeTopogramPath(inputPath);
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    const hasSelectors = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId || fromTopogramPath);
    const useImportAdoptPath =
      importAdoptOnlyRequested({ modeId, capabilityId, workflowId, projectionId, entityId, journeyId, surfaceId, fromTopogramPath }) ||
      (!hasSelectors && !modeId);

    if (useImportAdoptPath && fs.existsSync(adoptionPlanPath)) {
      const adoptionPlan = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
      const ast = parsePath(inputPath);
      const taskModeResult = generateWorkspace(ast, {
        target: "context-task-mode",
        modeId: "import-adopt"
      });
      if (!taskModeResult.ok) {
        console.error(formatValidationErrors(taskModeResult.validation));
        process.exit(1);
      }
      const maintainedBundleResult = generateWorkspace(ast, {
        target: "context-bundle",
        taskId: "maintained-app"
      });
      if (!maintainedBundleResult.ok) {
        console.error(formatValidationErrors(maintainedBundleResult.validation));
        process.exit(1);
      }
      const workflowPresets = buildWorkflowPresetState({
        workspace: topogramRoot,
        selectors: workflowPresetSelectors({
          taskModeArtifact: taskModeResult.artifact,
          providerId,
          presetId,
          queryFamily: "proceed-decision"
        })
      });
      const importPlan = buildImportPlanPayload(adoptionPlan, taskModeResult.artifact, maintainedBundleResult.artifact.maintained_boundary || null, workflowPresets);
      const risk = classifyRisk({
        importPlan,
        verificationTargets: importPlan.verification_targets,
        maintainedRisk: importPlan.maintained_risk || null
      });
      const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
        workspace: topogramRoot,
        taskModeArtifact: taskModeResult.artifact,
        importPlan,
        selectors: workflowPresetSelectors({
          taskModeArtifact: taskModeResult.artifact,
          providerId,
          presetId,
          queryFamily: "proceed-decision"
        })
      });
      console.log(stableStringify(proceedDecisionFromRisk(
        risk,
        importPlan.next_action,
        importPlan.write_scope,
        importPlan.verification_targets,
        importPlan.maintained_risk || null,
        importPlan.workflow_presets || null,
        resolvedWorkflowContext
      )));
      process.exit(0);
    }

    const ast = parsePath(inputPath);
    const effectiveModeId = modeId || "modeling";
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: effectiveModeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          entityId,
          journeyId,
          surfaceId
        })
      : null;
    if (sliceResult && !sliceResult.ok) {
      console.error(formatValidationErrors(sliceResult.validation));
      process.exit(1);
    }
    const diffResult = fromTopogramPath
      ? generateWorkspace(ast, {
          target: "context-diff",
          fromTopogramPath
        })
      : null;
    if (diffResult && !diffResult.ok) {
      console.error(formatValidationErrors(diffResult.validation));
      process.exit(1);
    }
    const maintainedBundleResult =
      effectiveModeId === "maintained-app-edit" ||
      surfaceId === "maintained-boundary" ||
      Boolean(diffResult?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact)
        ? generateWorkspace(ast, {
            target: "context-bundle",
            taskId: "maintained-app"
          })
        : null;
    if (maintainedBundleResult && !maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }
    const resolved = resolveWorkspace(ast);
    if (!resolved.ok) {
      console.error(formatValidationErrors(resolved.validation));
      process.exit(1);
    }
    const changePlan = buildChangePlanPayload({
      graph: resolved.graph,
      taskModeArtifact: taskModeResult.artifact,
      sliceArtifact: sliceResult?.artifact || null,
      diffArtifact: diffResult?.artifact || null,
      maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
    });
    const diffSummary = changePlan.diff_summary || summarizeDiffArtifact(diffResult?.artifact || null);
    const maintainedRisk = buildMaintainedRiskSummary({
      maintainedImpacts: changePlan.maintained_impacts,
      maintainedBoundary: changePlan.maintained_boundary,
      diffSummary
    });
    const risk = classifyRisk({
      reviewBoundary: changePlan.review_boundary,
      maintainedBoundary: changePlan.maintained_boundary,
      diffSummary,
      verificationTargets: changePlan.verification_targets,
      maintainedRisk
    });
    console.log(stableStringify(proceedDecisionFromRisk(
      risk,
      changePlan.next_action || null,
      changePlan.write_scope || null,
      changePlan.verification_targets || null,
      maintainedRisk,
      null,
      null
    )));
    process.exit(0);
  }

  if (commandArgs?.queryName === "review-packet") {
    const topogramRoot = normalizeTopogramPath(inputPath);
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    const hasSelectors = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId || fromTopogramPath);
    const useImportAdoptPath =
      importAdoptOnlyRequested({ modeId, capabilityId, workflowId, projectionId, entityId, journeyId, surfaceId, fromTopogramPath }) ||
      (!hasSelectors && !modeId);

    if (useImportAdoptPath && fs.existsSync(adoptionPlanPath)) {
      const adoptionPlan = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
      const ast = parsePath(inputPath);
      const taskModeResult = generateWorkspace(ast, {
        target: "context-task-mode",
        modeId: "import-adopt"
      });
      if (!taskModeResult.ok) {
        console.error(formatValidationErrors(taskModeResult.validation));
        process.exit(1);
      }
      const maintainedBundleResult = generateWorkspace(ast, {
        target: "context-bundle",
        taskId: "maintained-app"
      });
      if (!maintainedBundleResult.ok) {
        console.error(formatValidationErrors(maintainedBundleResult.validation));
        process.exit(1);
      }
      const workflowPresets = buildWorkflowPresetState({
        workspace: topogramRoot,
        selectors: workflowPresetSelectors({
          taskModeArtifact: taskModeResult.artifact,
          providerId,
          presetId,
          queryFamily: "review-packet"
        })
      });
      const importPlan = buildImportPlanPayload(adoptionPlan, taskModeResult.artifact, maintainedBundleResult.artifact.maintained_boundary || null, workflowPresets);
      const risk = classifyRisk({
        importPlan,
        verificationTargets: importPlan.verification_targets,
        maintainedRisk: importPlan.maintained_risk || null
      });
      console.log(stableStringify(buildReviewPacketPayloadForImportPlan({ importPlan, risk })));
      process.exit(0);
    }

    const ast = parsePath(inputPath);
    const effectiveModeId = modeId || "modeling";
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: effectiveModeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          entityId,
          journeyId,
          surfaceId
        })
      : null;
    if (sliceResult && !sliceResult.ok) {
      console.error(formatValidationErrors(sliceResult.validation));
      process.exit(1);
    }
    const diffResult = fromTopogramPath
      ? generateWorkspace(ast, {
          target: "context-diff",
          fromTopogramPath
        })
      : null;
    if (diffResult && !diffResult.ok) {
      console.error(formatValidationErrors(diffResult.validation));
      process.exit(1);
    }
    const maintainedBundleResult =
      effectiveModeId === "maintained-app-edit" ||
      surfaceId === "maintained-boundary" ||
      Boolean(diffResult?.artifact?.affected_maintained_surfaces?.ownership_interpretation?.maintained_code_impact)
        ? generateWorkspace(ast, {
            target: "context-bundle",
            taskId: "maintained-app"
          })
        : null;
    if (maintainedBundleResult && !maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }
    const resolved = resolveWorkspace(ast);
    if (!resolved.ok) {
      console.error(formatValidationErrors(resolved.validation));
      process.exit(1);
    }
    const changePlan = buildChangePlanPayload({
      graph: resolved.graph,
      taskModeArtifact: taskModeResult.artifact,
      sliceArtifact: sliceResult?.artifact || null,
      diffArtifact: diffResult?.artifact || null,
      maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
    });
    const diffSummary = changePlan.diff_summary || summarizeDiffArtifact(diffResult?.artifact || null);
    const maintainedRisk = buildMaintainedRiskSummary({
      maintainedImpacts: changePlan.maintained_impacts,
      maintainedBoundary: changePlan.maintained_boundary,
      diffSummary
    });
    const risk = classifyRisk({
      reviewBoundary: changePlan.review_boundary,
      maintainedBoundary: changePlan.maintained_boundary,
      diffSummary,
      verificationTargets: changePlan.verification_targets,
      maintainedRisk
    });
    console.log(stableStringify(buildReviewPacketPayloadForChangePlan({
      changePlan,
      risk
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "next-action") {
    const ast = parsePath(inputPath);
    const effectiveModeId = modeId || "import-adopt";
    const result = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: effectiveModeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    console.log(stableStringify({
      type: "next_action_query",
      mode: result.artifact.mode,
      summary: result.artifact.summary || null,
      next_action: result.artifact.next_action || null,
      recommended_query_family: (function resolveRecommendedQueryFamily(nextAction, mode) {
        switch (nextAction?.kind) {
          case "review_staged":
          case "review_bundle":
          case "inspect_review_group":
          case "inspect_proposal_surface":
          case "customize_workflow_preset":
          case "refresh_workflow_preset_customization":
          case "import_declared_workflow_preset":
            return "import-plan";
          case "review_diff_impact":
          case "inspect_projection":
          case "inspect_diff":
          case "review_diff_boundaries":
            return "change-plan";
          case "inspect_maintained_impact":
          case "inspect_boundary_before_edit":
          case "run_maintained_checks":
            return "maintained-boundary";
          case "inspect_verification_targets":
            return "verification-targets";
          case "inspect_workspace_digest":
            return "single-agent-plan";
          default:
            break;
        }
        if (mode === "import-adopt") return "import-plan";
        if (mode === "maintained-app-edit") return "maintained-boundary";
        if (mode === "verification") return "verification-targets";
        return "change-plan";
      }(result.artifact.next_action || null, result.artifact.mode)),
      immediate_artifacts: (result.artifact.preferred_context_artifacts || []).slice(0, 2),
      preferred_context_artifacts: result.artifact.preferred_context_artifacts || [],
      review_emphasis: result.artifact.review_emphasis || [],
      write_scope: result.artifact.write_scope || null,
      verification_targets: result.artifact.verification_targets || null
    }));
    process.exit(0);
  }

  if (commandArgs?.queryName === "single-agent-plan") {
    if (!modeId) {
      throw new Error("query single-agent-plan requires --mode <modeling|maintained-app-edit|import-adopt|diff-review|verification>.");
    }
    const ast = parsePath(inputPath);
    const result = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }

    let importPlan = null;
    const resolvedWorkflowContextBase = {
      workspace: normalizeTopogramPath(inputPath),
      taskModeArtifact: result.artifact,
      selectors: workflowPresetSelectors({
        taskModeArtifact: result.artifact,
        providerId,
        presetId,
        queryFamily: "single-agent-plan"
      })
    };
    if (modeId === "import-adopt") {
      const topogramRoot = normalizeTopogramPath(inputPath);
      const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
      if (fs.existsSync(adoptionPlanPath)) {
        const adoptionPlanArtifact = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
        const workflowPresets = buildWorkflowPresetState({
          workspace: topogramRoot,
          selectors: workflowPresetSelectors({
            taskModeArtifact: result.artifact,
            providerId,
            presetId,
            queryFamily: "single-agent-plan"
          })
        });
        importPlan = buildImportPlanPayload(adoptionPlanArtifact, result.artifact, null, workflowPresets);
      }
    }
    const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
      ...resolvedWorkflowContextBase,
      importPlan
    });

    console.log(stableStringify(buildSingleAgentPlanPayload({
      workspace: normalizeTopogramPath(inputPath),
      taskModeArtifact: result.artifact,
      importPlan,
      resolvedWorkflowContext
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "resolved-workflow-context") {
    if (!modeId) {
      throw new Error("query resolved-workflow-context requires --mode <modeling|maintained-app-edit|import-adopt|diff-review|verification>.");
    }
    const topogramRoot = normalizeTopogramPath(inputPath);
    const ast = parsePath(inputPath);
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }

    const hasSelector = Boolean(capabilityId || workflowId || projectionId || entityId || journeyId || surfaceId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          entityId,
          journeyId,
          surfaceId
        })
      : null;
    if (sliceResult && !sliceResult.ok) {
      console.error(formatValidationErrors(sliceResult.validation));
      process.exit(1);
    }

    const includeMaintainedBoundary =
      modeId === "maintained-app-edit" ||
      surfaceId === "maintained-boundary" ||
      fromTopogramPath;
    const maintainedBundleResult = includeMaintainedBoundary
      ? generateWorkspace(ast, {
          target: "context-bundle",
          taskId: "maintained-app"
        })
      : null;
    if (maintainedBundleResult && !maintainedBundleResult.ok) {
      console.error(formatValidationErrors(maintainedBundleResult.validation));
      process.exit(1);
    }

    let importPlan = null;
    if (modeId === "import-adopt") {
      const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
      if (fs.existsSync(adoptionPlanPath)) {
        const adoptionPlanArtifact = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
        const workflowPresets = buildWorkflowPresetState({
          workspace: topogramRoot,
          selectors: workflowPresetSelectors({
            taskModeArtifact: taskModeResult.artifact,
            providerId,
            presetId,
            queryFamily: "resolved-workflow-context"
          })
        });
        importPlan = buildImportPlanPayload(
          adoptionPlanArtifact,
          taskModeResult.artifact,
          maintainedBundleResult?.artifact?.maintained_boundary || null,
          workflowPresets
        );
      }
    }

    console.log(stableStringify(buildResolvedWorkflowContextPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      reviewBoundary: sliceResult?.artifact?.review_boundary || null,
      maintainedBoundary: maintainedBundleResult?.artifact?.maintained_boundary || null,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: "resolved-workflow-context"
      })
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "workflow-preset-activation") {
    if (!modeId) {
      throw new Error("query workflow-preset-activation requires --mode <modeling|maintained-app-edit|import-adopt|diff-review|verification>.");
    }
    const topogramRoot = normalizeTopogramPath(inputPath);
    const ast = parsePath(inputPath);
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    let importPlan = null;
    if (modeId === "import-adopt") {
      const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
      if (fs.existsSync(adoptionPlanPath)) {
        const adoptionPlanArtifact = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
        const workflowPresets = buildWorkflowPresetState({
          workspace: topogramRoot,
          selectors: workflowPresetSelectors({
            taskModeArtifact: taskModeResult.artifact,
            providerId,
            presetId,
            queryFamily: "workflow-preset-activation"
          })
        });
        importPlan = buildImportPlanPayload(adoptionPlanArtifact, taskModeResult.artifact, null, workflowPresets);
      }
    }
    console.log(stableStringify(buildWorkflowPresetActivationPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: "workflow-preset-activation"
      })
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "workflow-preset-diff") {
    if (!providerId) {
      throw new Error("query workflow-preset-diff requires --provider <id>.");
    }
    console.log(stableStringify(buildWorkflowPresetDiffPayload({
      workspace: normalizeTopogramPath(inputPath),
      providerId,
      presetId
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "workflow-preset-customization") {
    if (!providerId || !presetId) {
      throw new Error("query workflow-preset-customization requires --provider <id> and --preset <id>.");
    }
    console.log(stableStringify(buildWorkflowPresetCustomizationPayload({
      workspace: normalizeTopogramPath(inputPath),
      providerId,
      presetId
    })));
    process.exit(0);
  }

  if (commandArgs?.workflowPresetCommand === "customize") {
    if (!providerId || !presetId) {
      throw new Error("workflow-preset customize requires --provider <id> and --preset <id>.");
    }
    const topogramRoot = normalizeTopogramPath(inputPath);
    const payload = buildWorkflowPresetCustomizationPayload({
      workspace: topogramRoot,
      providerId,
      presetId
    });
    if (!shouldWrite) {
      console.log(stableStringify(payload));
      process.exit(0);
    }
    const targetPath = path.resolve(topogramRoot, outPath || payload.recommended_local_path);
    if (fs.existsSync(targetPath)) {
      throw new Error(`Refusing to overwrite existing workflow preset customization at '${targetPath}'.`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${stableStringify(payload.customization_template)}\n`);
    console.log(stableStringify({
      ...payload,
      written: true,
      written_path: targetPath
    }));
    process.exit(0);
  }

  if (commandArgs?.queryName === "multi-agent-plan") {
    if (modeId !== "import-adopt") {
      throw new Error("query multi-agent-plan currently supports only --mode import-adopt.");
    }
    const topogramRoot = normalizeTopogramPath(inputPath);
    const reconcileReportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    if (!fs.existsSync(reconcileReportPath) || !fs.existsSync(adoptionStatusPath) || !fs.existsSync(adoptionPlanPath)) {
      throw new Error(`No reconcile multi-agent artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }

    const ast = parsePath(inputPath);
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: "import-adopt"
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const adoptionPlanArtifact = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
    const reconcileReport = JSON.parse(fs.readFileSync(reconcileReportPath, "utf8"));
    const adoptionStatus = JSON.parse(fs.readFileSync(adoptionStatusPath, "utf8"));
    const workflowPresets = buildWorkflowPresetState({
      workspace: topogramRoot,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: "multi-agent-plan"
      })
    });
    const importPlan = buildImportPlanPayload(adoptionPlanArtifact, taskModeResult.artifact, null, workflowPresets);
    const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: "multi-agent-plan"
      })
    });
    const singleAgentPlan = buildSingleAgentPlanPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      resolvedWorkflowContext
    });

    console.log(stableStringify(buildMultiAgentPlanPayload({
      workspace: topogramRoot,
      singleAgentPlan,
      importPlan,
      report: reconcileReport,
      adoptionStatus,
      resolvedWorkflowContext
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "work-packet") {
    if (modeId !== "import-adopt") {
      throw new Error("query work-packet currently supports only --mode import-adopt.");
    }
    if (!laneId) {
      throw new Error("query work-packet requires --lane <id>.");
    }
    const topogramRoot = normalizeTopogramPath(inputPath);
    const reconcileReportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    if (!fs.existsSync(reconcileReportPath) || !fs.existsSync(adoptionStatusPath) || !fs.existsSync(adoptionPlanPath)) {
      throw new Error(`No reconcile work-packet artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }

    const ast = parsePath(inputPath);
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: "import-adopt"
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const adoptionPlanArtifact = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
    const reconcileReport = JSON.parse(fs.readFileSync(reconcileReportPath, "utf8"));
    const adoptionStatus = JSON.parse(fs.readFileSync(adoptionStatusPath, "utf8"));
    const workflowPresets = buildWorkflowPresetState({
      workspace: topogramRoot,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: "work-packet"
      })
    });
    const importPlan = buildImportPlanPayload(adoptionPlanArtifact, taskModeResult.artifact, null, workflowPresets);
    const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: "work-packet"
      })
    });
    const singleAgentPlan = buildSingleAgentPlanPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      resolvedWorkflowContext
    });
    const multiAgentPlan = buildMultiAgentPlanPayload({
      workspace: topogramRoot,
      singleAgentPlan,
      importPlan,
      report: reconcileReport,
      adoptionStatus,
      resolvedWorkflowContext
    });

    console.log(stableStringify(buildWorkPacketPayload({
      workspace: topogramRoot,
      multiAgentPlan,
      laneId
    })));
    process.exit(0);
  }

  if (commandArgs?.queryName === "lane-status" || commandArgs?.queryName === "handoff-status") {
    if (modeId !== "import-adopt") {
      throw new Error(`query ${commandArgs.queryName} currently supports only --mode import-adopt.`);
    }
    const topogramRoot = normalizeTopogramPath(inputPath);
    const reconcileReportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    const adoptionPlanPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
    if (!fs.existsSync(reconcileReportPath) || !fs.existsSync(adoptionStatusPath) || !fs.existsSync(adoptionPlanPath)) {
      throw new Error(`No reconcile ${commandArgs.queryName} artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }

    const ast = parsePath(inputPath);
    const taskModeResult = generateWorkspace(ast, {
      target: "context-task-mode",
      modeId: "import-adopt"
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const adoptionPlanArtifact = JSON.parse(fs.readFileSync(adoptionPlanPath, "utf8"));
    const reconcileReport = JSON.parse(fs.readFileSync(reconcileReportPath, "utf8"));
    const adoptionStatus = JSON.parse(fs.readFileSync(adoptionStatusPath, "utf8"));
    const workflowPresets = buildWorkflowPresetState({
      workspace: topogramRoot,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: commandArgs.queryName
      })
    });
    const importPlan = buildImportPlanPayload(adoptionPlanArtifact, taskModeResult.artifact, null, workflowPresets);
    const resolvedWorkflowContext = buildResolvedWorkflowContextPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      selectors: workflowPresetSelectors({
        taskModeArtifact: taskModeResult.artifact,
        providerId,
        presetId,
        queryFamily: commandArgs.queryName
      })
    });
    const singleAgentPlan = buildSingleAgentPlanPayload({
      workspace: topogramRoot,
      taskModeArtifact: taskModeResult.artifact,
      importPlan,
      resolvedWorkflowContext
    });
    const multiAgentPlan = buildMultiAgentPlanPayload({
      workspace: topogramRoot,
      singleAgentPlan,
      importPlan,
      report: reconcileReport,
      adoptionStatus,
      resolvedWorkflowContext
    });

    const payload = commandArgs.queryName === "lane-status"
      ? buildLaneStatusPayload({
          workspace: topogramRoot,
          multiAgentPlan,
          report: reconcileReport,
          adoptionStatus
        })
      : buildHandoffStatusPayload({
          workspace: topogramRoot,
          multiAgentPlan,
          report: reconcileReport,
          adoptionStatus
        });
    console.log(stableStringify(payload));
    process.exit(0);
  }

  if (commandArgs?.queryName === "auth-hints") {
    const topogramRoot = normalizeTopogramPath(inputPath);
    const reconcileReportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    if (!fs.existsSync(reconcileReportPath) || !fs.existsSync(adoptionStatusPath)) {
      throw new Error(`No reconcile auth-hint artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }
    const reconcileReport = JSON.parse(fs.readFileSync(reconcileReportPath, "utf8"));
    const adoptionStatus = JSON.parse(fs.readFileSync(adoptionStatusPath, "utf8"));
    console.log(stableStringify(buildAuthHintsQueryPayload(reconcileReport, adoptionStatus)));
    process.exit(0);
  }

  if (commandArgs?.queryName === "auth-review-packet") {
    if (!bundleSlug) {
      throw new Error("query auth-review-packet requires --bundle <slug>.");
    }
    const topogramRoot = normalizeTopogramPath(inputPath);
    const reconcileReportPath = path.join(topogramRoot, "candidates", "reconcile", "report.json");
    const adoptionStatusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
    if (!fs.existsSync(reconcileReportPath) || !fs.existsSync(adoptionStatusPath)) {
      throw new Error(`No reconcile auth-review artifacts found under '${path.join(topogramRoot, "candidates", "reconcile")}'. Run 'node ./src/cli.js reconcile ${topogramRoot}' first.`);
    }
    const reconcileReport = JSON.parse(fs.readFileSync(reconcileReportPath, "utf8"));
    const adoptionStatus = JSON.parse(fs.readFileSync(adoptionStatusPath, "utf8"));
    const packet = buildAuthReviewPacketPayload(reconcileReport, adoptionStatus, bundleSlug);
    if (!packet) {
      const knownBundles = (reconcileReport.candidate_model_bundles || []).map((bundle) => bundle.slug).sort();
      throw new Error(`No auth review bundle '${bundleSlug}' found in '${path.join(topogramRoot, "candidates", "reconcile")}'. Known bundles: ${knownBundles.length ? knownBundles.join(", ") : "none"}.`);
    }
    console.log(stableStringify(packet));
    process.exit(0);
  }

  if (workflowName) {
    const result = runWorkflow(workflowName, inputPath, { from: fromValue, adopt: adoptValue, write: shouldWrite, refreshAdopted });
    if (shouldWrite) {
      const resolvedOutDir = path.resolve(effectiveOutDir || result.defaultOutDir || "artifacts");
      fs.mkdirSync(resolvedOutDir, { recursive: true });
      for (const [relativePath, contents] of Object.entries(result.files || {})) {
        const destination = path.join(resolvedOutDir, relativePath);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, typeof contents === "string" ? contents : `${stableStringify(contents)}\n`, "utf8");
      }
      console.log(`Wrote ${Object.keys(result.files || {}).length} file(s) to ${resolvedOutDir}`);
      process.exit(0);
    }

    console.log(stableStringify(result.summary));
    process.exit(0);
  }

  const ast = parsePath(inputPath);

  if (generateTarget) {
    const implementation = targetRequiresImplementationProvider(generateTarget)
      ? await loadImplementationProvider(inputPath)
      : null;
    const resolvedForConfig = targetRequiresImplementationProvider(generateTarget)
      ? resolveWorkspace(ast)
      : null;
    if (resolvedForConfig && !resolvedForConfig.ok) {
      console.error(formatValidationErrors(resolvedForConfig.validation));
      process.exit(1);
    }
    const projectConfigInfo = targetRequiresImplementationProvider(generateTarget)
      ? projectConfigOrDefault(inputPath, resolvedForConfig.graph, implementation)
      : null;
    const projectConfigValidation = projectConfigInfo
      ? validateProjectConfig(projectConfigInfo.config, resolvedForConfig.graph)
      : { ok: true, errors: [] };
    if (!projectConfigValidation.ok) {
      console.error(formatProjectConfigErrors(projectConfigValidation, projectConfigInfo?.configPath || "topogram.project.json"));
      process.exit(1);
    }
    const result = generateWorkspace(ast, {
      target: generateTarget,
      shapeId,
      capabilityId,
      workflowId,
      projectionId,
      entityId,
      journeyId,
      surfaceId,
      taskId,
      modeId,
      profileId,
      fromSnapshot: fromSnapshotPath ? JSON.parse(fs.readFileSync(fromSnapshotPath, "utf8")) : null,
      fromSnapshotPath,
      fromTopogramPath,
      topogramInputPath: topogramInputPathForGeneration(inputPath),
      implementation,
      projectConfig: projectConfigInfo?.config || null
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }

    if (shouldWrite) {
      const resolvedOutDir = path.resolve(effectiveOutDir || "artifacts");
      assertProjectOutputAllowsWrite(projectConfigInfo, resolvedOutDir);
      assertSafeGeneratedOutputDir(resolvedOutDir, inputPath);
      const outputFiles = buildOutputFiles(result, {
        shapeId,
        capabilityId,
        workflowId,
        projectionId,
        entityId,
        journeyId,
        taskId,
        modeId
      });
      outputFiles.unshift({
        path: GENERATED_OUTPUT_SENTINEL,
        contents: generatedOutputSentinel(generateTarget)
      });
      fs.rmSync(resolvedOutDir, { recursive: true, force: true });
      fs.mkdirSync(resolvedOutDir, { recursive: true });

      for (const file of outputFiles) {
        const destination = path.join(resolvedOutDir, file.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const contents =
          typeof file.contents === "string" ? file.contents : `${stableStringify(file.contents)}\n`;
        fs.writeFileSync(destination, contents, "utf8");
      }

      console.log(`Wrote ${outputFiles.length} file(s) to ${resolvedOutDir}`);
      process.exit(0);
    }

    console.log(typeof result.artifact === "string" ? result.artifact : stableStringify(result.artifact));
    process.exit(0);
  }

  if (shouldResolve) {
    const result = resolveWorkspace(ast);
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }

    console.log(JSON.stringify(result.graph, null, 2));
    process.exit(0);
  }

  if (shouldValidate) {
    const result = validateWorkspace(ast);
    if (!result.ok) {
      console.error(formatValidationErrors(result));
      process.exit(1);
    }

    const statementCount = ast.files.flatMap((file) => file.statements).length;
    console.log(`Validated ${ast.files.length} file(s) and ${statementCount} statement(s) with 0 errors.`);
    process.exit(0);
  }

  if (emitJson) {
    console.log(stableStringify(ast));
  } else {
    summarize(ast);
  }
} catch (error) {
  if (error.validation) {
    console.error(formatValidationErrors(error.validation));
  } else {
    console.error(error.message);
  }
  process.exit(1);
}
