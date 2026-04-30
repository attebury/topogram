#!/usr/bin/env node

import fs from "node:fs";
import childProcess from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsePath } from "./parser.js";
import { stableStringify } from "./format.js";
import { generateWorkspace } from "./generator.js";
import { buildOutputFiles } from "./generator.js";
import { loadImplementationProvider } from "./example-implementation.js";
import {
  applyTemplateUpdate,
  applyTemplateUpdateFileAction,
  buildTemplateUpdateCheck,
  buildTemplateUpdatePlan,
  buildTemplateUpdateStatus,
  createNewProject,
  listBuiltInTemplates,
  loadTemplatePolicy,
  resolveTemplate,
  templatePolicyDiagnosticsForTemplate,
  writeTemplatePolicy,
  writeTemplatePolicyForProject,
  writeTemplateFilesManifest
} from "./new-project.js";
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
  catalogEntryPackageSpec,
  catalogSourceOrDefault,
  catalogTemplateListItem,
  buildTopogramSourceStatus,
  checkCatalogSource,
  copyCatalogTopogramEntry,
  findCatalogEntry,
  isCatalogSourceDisabled,
  loadCatalog,
  TOPOGRAM_SOURCE_FILE
} from "./catalog.js";
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
  console.log("   or: topogram catalog list [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog show <id> [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram catalog check <path-or-url> [--json]");
  console.log("   or: topogram catalog copy <id> <target> [--version <version>] [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram source status [path] [--json]");
  console.log("   or: topogram template list [--json]");
  console.log("   or: topogram template show <id> [--json] [--catalog <path-or-source>]");
  console.log("   or: topogram template status [path] [--json]");
  console.log("   or: topogram template policy init [path] [--json]");
  console.log("   or: topogram template policy check [path] [--json]");
  console.log("   or: topogram template policy pin [template-id@version] [path] [--json]");
  console.log("   or: topogram template check <template-spec-or-path> [--json]");
  console.log("   or: topogram template update [path] --status|--recommend|--plan|--check|--apply [--template <spec>|--latest] [--json] [--out <path>]");
  console.log("   or: topogram template update [path] --accept-current|--accept-candidate|--delete-current <file> [--template <spec>] [--json]");
  console.log("   or: topogram new <path> [--template hello-web|hello-api|hello-db|web-api|web-api-db|./local-template|@scope/template]");
  console.log("   or: topogram create <path> [--template hello-web|hello-api|hello-db|web-api|web-api-db|./local-template|@scope/template]");
  console.log("");
  console.log("Common commands:");
  console.log("  topogram create ./my-app");
  console.log("  topogram check");
  console.log("  topogram check --json");
  console.log("  topogram generate");
  console.log("  topogram trust template");
  console.log("  topogram trust status");
  console.log("  topogram trust diff");
  console.log("  topogram catalog list");
  console.log("  topogram catalog show todo");
  console.log("  topogram catalog check topograms.catalog.json");
  console.log("  topogram catalog copy hello ./hello-topogram");
  console.log("  topogram source status");
  console.log("  topogram template list");
  console.log("  topogram template show todo");
  console.log("  topogram template status");
  console.log("  topogram template status --latest");
  console.log("  topogram template policy init");
  console.log("  topogram template policy check");
  console.log("  topogram template policy pin @scope/template@0.2.0");
  console.log("  topogram template check hello-web");
  console.log("  topogram template update --status");
  console.log("  topogram template update --recommend");
  console.log("  topogram template update --recommend --latest");
  console.log("  topogram template update --plan");
  console.log("  topogram template update --check");
  console.log("  topogram template update --apply");
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

function normalizeProjectRoot(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return path.dirname(absolute);
  }
  return absolute;
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
 * @returns {{ id: string|null, version: string|null, source: string|null, sourceSpec: string|null, requested: string|null, sourceRoot: string|null, catalog: Record<string, any>|null, includesExecutableImplementation: boolean|null }}
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
    catalog: template.catalog && typeof template.catalog === "object" && !Array.isArray(template.catalog)
      ? template.catalog
      : null,
    includesExecutableImplementation: typeof template.includesExecutableImplementation === "boolean"
      ? template.includesExecutableImplementation
      : null
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
 * @param {string} packageName
 * @returns {string}
 */
function latestVersionForPackage(packageName) {
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const localNpmConfig = path.join(process.cwd(), ".npmrc");
  const npmConfigEnv = !process.env.NPM_CONFIG_USERCONFIG && fs.existsSync(localNpmConfig)
    ? { NPM_CONFIG_USERCONFIG: localNpmConfig }
    : {};
  const result = childProcess.spawnSync(npmBin, ["view", packageName, "version", "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...npmConfigEnv,
      PATH: process.env.PATH || ""
    }
  });
  if (result.status !== 0) {
    throw new Error(`Failed to inspect latest version for '${packageName}'.\n${result.stderr || result.stdout}`.trim());
  }
  const raw = (result.stdout || "").trim();
  if (!raw) {
    throw new Error(`npm view returned no version for '${packageName}'.`);
  }
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "string" || !parsed) {
    throw new Error(`npm view returned an invalid version for '${packageName}'.`);
  }
  return parsed;
}

/**
 * @param {ReturnType<typeof templateMetadataFromProjectConfig>} template
 * @returns {{ checked: boolean, supported: boolean, packageName: string|null, version: string|null, isCurrent: boolean|null, candidateSpec: string|null, reason: string|null }}
 */
function latestTemplateInfo(template) {
  if (template.source !== "package") {
    return {
      checked: true,
      supported: false,
      packageName: null,
      version: null,
      isCurrent: null,
      candidateSpec: null,
      reason: "Latest-version lookup is only supported for package-backed templates."
    };
  }
  const packageName = packageNameFromPackageSpec(template.sourceSpec || template.requested || template.id || "");
  const version = latestVersionForPackage(packageName);
  return {
    checked: true,
    supported: true,
    packageName,
    version,
    isCurrent: template.version === version,
    candidateSpec: `${packageName}@${version}`,
    reason: null
  };
}

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} projectConfigInfo
 * @param {{ latest?: boolean }} [options]
 * @returns {{ ok: boolean, template: ReturnType<typeof templateMetadataFromProjectConfig>, trust: ReturnType<typeof getTemplateTrustStatus>|null, latest: { checked: boolean, supported?: boolean, packageName?: string|null, version?: string|null, isCurrent?: boolean|null, candidateSpec?: string|null, reason: string|null }, recommendations: string[] }}
 */
function buildTemplateStatusPayload(projectConfigInfo, options = {}) {
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
  const latest = options.latest
    ? latestTemplateInfo(template)
    : {
        checked: false,
        reason: "Registry lookups are not performed by default."
      };
  if (latest.checked && latest.supported && latest.candidateSpec && latest.isCurrent === false) {
    recommendations.push(`Run \`topogram template update --recommend --template ${latest.candidateSpec}\` to review the latest template.`);
  }
  return {
    ok: trust ? trust.ok : true,
    template,
    trust,
    latest,
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
  if (payload.template.catalog) {
    console.log(`Catalog: ${payload.template.catalog.id || "unknown"} from ${payload.template.catalog.source || "unknown"}`);
  }
  if (payload.template.sourceRoot) {
    console.log(`Source root: ${payload.template.sourceRoot}`);
  }
  if (!payload.latest.checked) {
    console.log("Latest version: not checked");
  } else if (!payload.latest.supported) {
    console.log(`Latest version: not checked (${payload.latest.reason})`);
  } else {
    console.log(`Latest version: ${payload.latest.version}`);
    if (payload.latest.packageName) {
      console.log(`Latest package: ${payload.latest.packageName}`);
    }
    if (payload.latest.candidateSpec) {
      console.log(`Latest candidate: ${payload.latest.candidateSpec}`);
    }
    console.log(`Latest status: ${payload.latest.isCurrent ? "current" : "update available"}`);
  }
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
 * @param {{ catalogSource?: string|null }} [options]
 * @returns {{ ok: boolean, catalog: { source: string|null, loaded: boolean }, templates: Array<Record<string, any>>, diagnostics: Array<Record<string, any>>, errors: string[] }}
 */
function buildTemplateListPayload(options = {}) {
  const catalogSource = catalogSourceOrDefault(options.catalogSource || null);
  /** @type {Array<Record<string, any>>} */
  const templates = listBuiltInTemplates(TEMPLATES_ROOT);
  /** @type {Array<Record<string, any>>} */
  const diagnostics = [];
  let catalogLoaded = false;
  if (!isCatalogSourceDisabled(catalogSource)) {
    try {
      const loaded = loadCatalog(catalogSource);
      catalogLoaded = true;
      templates.push(
        ...loaded.catalog.entries
          .filter((entry) => entry.kind === "template")
          .map((entry) => catalogTemplateListItem(entry))
      );
    } catch (error) {
      diagnostics.push({
        code: "catalog_unavailable",
        severity: "warning",
        message: messageFromError(error),
        path: catalogSource,
        suggestedFix: "Run `topogram catalog list` after authenticating, or set TOPOGRAM_CATALOG_SOURCE=none to list only built-ins."
      });
    }
  }
  return {
    ok: true,
    catalog: {
      source: isCatalogSourceDisabled(catalogSource) ? null : catalogSource,
      loaded: catalogLoaded
    },
    templates,
    diagnostics,
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildTemplateListPayload>} payload
 * @returns {void}
 */
function printTemplateList(payload) {
  console.log("Available templates:");
  for (const template of payload.templates) {
    console.log(`- ${template.id}@${template.version}`);
    console.log(`  source: ${template.source}`);
    console.log(`  name: ${template.name}`);
    if (template.package) {
      console.log(`  package: ${template.package}@${template.defaultVersion || template.version}`);
    }
    if (template.description) {
      console.log(`  description: ${template.description}`);
    }
    console.log(`  executable implementation: ${template.includesExecutableImplementation ? "yes" : "no"}`);
  }
  for (const diagnostic of payload.diagnostics) {
    console.warn(`Warning: ${diagnostic.message}`);
  }
}

/**
 * @param {string} id
 * @param {string|null} source
 * @returns {{ ok: boolean, source: "builtin"|"catalog"|null, catalog: { source: string|null, version: string|null }, template: Record<string, any>|null, packageSpec: string|null, commands: { primary: string|null, followUp: string[] }, diagnostics: any[], errors: string[] }}
 */
function buildTemplateShowPayload(id, source) {
  if (!id || id.startsWith("-")) {
    throw new Error("topogram template show requires <id>.");
  }
  const builtIn = listBuiltInTemplates(TEMPLATES_ROOT).find((template) => template.id === id || template.name === id);
  if (builtIn) {
    return {
      ok: true,
      source: "builtin",
      catalog: { source: null, version: null },
      template: {
        id: builtIn.id,
        name: builtIn.name,
        version: builtIn.version,
        source: builtIn.source,
        includesExecutableImplementation: builtIn.includesExecutableImplementation
      },
      packageSpec: null,
      commands: {
        primary: `topogram new ./my-app --template ${shellCommandArg(builtIn.name)}`,
        followUp: [
          "cd ./my-app",
          "npm install",
          "npm run check",
          "npm run generate"
        ]
      },
      diagnostics: [],
      errors: []
    };
  }

  const catalogPayload = buildCatalogShowPayload(id, source);
  if (!catalogPayload.ok || !catalogPayload.entry) {
    return {
      ok: false,
      source: "catalog",
      catalog: {
        source: catalogPayload.source,
        version: catalogPayload.catalog.version
      },
      template: null,
      packageSpec: null,
      commands: { primary: null, followUp: [] },
      diagnostics: catalogPayload.diagnostics,
      errors: catalogPayload.errors
    };
  }
  if (catalogPayload.entry.kind !== "template") {
    const diagnostic = {
      code: "catalog_entry_not_template",
      severity: "error",
      message: `Catalog entry '${id}' is a ${catalogPayload.entry.kind}, not a template.`,
      path: catalogPayload.source,
      suggestedFix: "Use `topogram catalog show` for non-template catalog entries."
    };
    return {
      ok: false,
      source: "catalog",
      catalog: {
        source: catalogPayload.source,
        version: catalogPayload.catalog.version
      },
      template: catalogPayload.entry,
      packageSpec: catalogPayload.packageSpec,
      commands: catalogPayload.commands,
      diagnostics: [...catalogPayload.diagnostics, diagnostic],
      errors: [diagnostic.message]
    };
  }
  return {
    ok: true,
    source: "catalog",
    catalog: {
      source: catalogPayload.source,
      version: catalogPayload.catalog.version
    },
    template: catalogPayload.entry,
    packageSpec: catalogPayload.packageSpec,
    commands: catalogPayload.commands,
    diagnostics: catalogPayload.diagnostics,
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildTemplateShowPayload>} payload
 * @returns {void}
 */
function printTemplateShow(payload) {
  if (!payload.ok || !payload.template) {
    console.log("Template not found.");
    if (payload.catalog.source) {
      console.log(`Catalog: ${payload.catalog.source}`);
    }
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`${label}: ${diagnostic.message}`);
    }
    return;
  }
  const template = payload.template;
  console.log(`Template: ${template.id}`);
  console.log(`Source: ${payload.source}`);
  if (template.name) {
    console.log(`Name: ${template.name}`);
  }
  if (payload.catalog.source) {
    console.log(`Catalog: ${payload.catalog.source}`);
  }
  if (payload.packageSpec) {
    console.log(`Package: ${payload.packageSpec}`);
  }
  if (template.description) {
    console.log(`Description: ${template.description}`);
  }
  if (Array.isArray(template.tags) && template.tags.length > 0) {
    console.log(`Tags: ${template.tags.join(", ")}`);
  }
  if (template.trust?.scope) {
    console.log(`Trust scope: ${template.trust.scope}`);
  }
  const executable = template.trust
    ? template.trust.includesExecutableImplementation
    : template.includesExecutableImplementation;
  console.log(`Executable implementation: ${executable ? "yes" : "no"}`);
  if (template.trust?.notes) {
    console.log(`Trust notes: ${template.trust.notes}`);
  }
  console.log("");
  console.log("Recommended command:");
  console.log(`  ${payload.commands.primary}`);
  if (payload.commands.followUp.length > 0) {
    console.log("Follow-up:");
    for (const command of payload.commands.followUp) {
      console.log(`  ${command}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    if (diagnostic.severity === "warning") {
      console.warn(`Warning: ${diagnostic.message}`);
    }
  }
}

/**
 * @param {string|null} source
 * @returns {{ ok: boolean, source: string, catalog: any, entries: any[], diagnostics: any[], errors: string[] }}
 */
function buildCatalogListPayload(source) {
  const loaded = loadCatalog(source || null);
  return {
    ok: true,
    source: loaded.source,
    catalog: {
      version: loaded.catalog.version,
      entries: loaded.catalog.entries.length
    },
    entries: loaded.catalog.entries,
    diagnostics: loaded.diagnostics,
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildCatalogListPayload>} payload
 * @returns {void}
 */
function printCatalogList(payload) {
  console.log(`Catalog: ${payload.source}`);
  console.log(`Version: ${payload.catalog.version}`);
  for (const entry of payload.entries) {
    console.log(`- ${entry.id} (${entry.kind})`);
    console.log(`  package: ${entry.package}@${entry.defaultVersion}`);
    console.log(`  description: ${entry.description}`);
    console.log(`  executable implementation: ${entry.trust.includesExecutableImplementation ? "yes" : "no"}`);
  }
}

/**
 * @param {string} id
 * @param {string|null} source
 * @returns {{ ok: boolean, source: string, catalog: { version: string }, entry: any|null, packageSpec: string|null, commands: { primary: string|null, followUp: string[] }, diagnostics: any[], errors: string[] }}
 */
function buildCatalogShowPayload(id, source) {
  if (!id || id.startsWith("-")) {
    throw new Error("topogram catalog show requires <id>.");
  }
  const loaded = loadCatalog(source || null);
  const entry = findCatalogEntry(loaded.catalog, id, null);
  if (!entry) {
    const diagnostic = {
      code: "catalog_entry_not_found",
      severity: "error",
      message: `Catalog entry '${id}' was not found in ${loaded.source}.`,
      path: loaded.source,
      suggestedFix: "Run `topogram catalog list` to see available entries."
    };
    return {
      ok: false,
      source: loaded.source,
      catalog: { version: loaded.catalog.version },
      entry: null,
      packageSpec: null,
      commands: { primary: null, followUp: [] },
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  return {
    ok: true,
    source: loaded.source,
    catalog: { version: loaded.catalog.version },
    entry,
    packageSpec: catalogEntryPackageSpec(entry),
    commands: catalogShowCommands(entry, loaded.source),
    diagnostics: loaded.diagnostics,
    errors: []
  };
}

/**
 * @param {any} entry
 * @param {string} source
 * @returns {{ primary: string, followUp: string[] }}
 */
function catalogShowCommands(entry, source) {
  const catalogOption = source === catalogSourceOrDefault(null)
    ? ""
    : ` --catalog ${shellCommandArg(source)}`;
  if (entry.kind === "template") {
    const target = "./my-app";
    return {
      primary: `topogram new ${target} --template ${shellCommandArg(entry.id)}${catalogOption}`,
      followUp: [
        `cd ${target}`,
        "npm install",
        "npm run check",
        "npm run generate"
      ]
    };
  }
  const target = `./${entry.id}-topogram`;
  return {
    primary: `topogram catalog copy ${shellCommandArg(entry.id)} ${target}${catalogOption}`,
    followUp: [
      `topogram source status ${target}`,
      `topogram check ${target}`
    ]
  };
}

/**
 * @param {string} value
 * @returns {string}
 */
function shellCommandArg(value) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value);
}

/**
 * @param {ReturnType<typeof buildCatalogShowPayload>} payload
 * @returns {void}
 */
function printCatalogShow(payload) {
  if (!payload.ok || !payload.entry) {
    console.log("Catalog entry not found.");
    console.log(`Catalog: ${payload.source}`);
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`${label}: ${diagnostic.message}`);
    }
    return;
  }
  const { entry } = payload;
  console.log(`Catalog entry: ${entry.id}`);
  console.log(`Kind: ${entry.kind}`);
  console.log(`Catalog: ${payload.source}`);
  console.log(`Package: ${payload.packageSpec}`);
  console.log(`Description: ${entry.description}`);
  console.log(`Tags: ${entry.tags.join(", ") || "none"}`);
  console.log(`Trust scope: ${entry.trust.scope}`);
  console.log(`Executable implementation: ${entry.trust.includesExecutableImplementation ? "yes" : "no"}`);
  if (entry.trust.notes) {
    console.log(`Trust notes: ${entry.trust.notes}`);
  }
  console.log("");
  console.log("Recommended command:");
  console.log(`  ${payload.commands.primary}`);
  if (payload.commands.followUp.length > 0) {
    console.log("Follow-up:");
    for (const command of payload.commands.followUp) {
      console.log(`  ${command}`);
    }
  }
  if (entry.kind === "topogram") {
    console.log("");
    console.log(`${TOPOGRAM_SOURCE_FILE} will record copy provenance. Local edits are allowed.`);
  }
}

/**
 * @param {string} source
 * @returns {ReturnType<typeof checkCatalogSource>}
 */
function buildCatalogCheckPayload(source) {
  if (!source) {
    throw new Error("topogram catalog check requires <path-or-url>.");
  }
  return checkCatalogSource(source);
}

/**
 * @param {ReturnType<typeof checkCatalogSource>} payload
 * @returns {void}
 */
function printCatalogCheck(payload) {
  console.log(payload.ok ? "Catalog check passed." : "Catalog check failed.");
  console.log(`Source: ${payload.source}`);
  if (payload.catalog) {
    console.log(`Version: ${payload.catalog.version}`);
    console.log(`Entries: ${payload.catalog.entries.length}`);
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
  }
}

/**
 * @param {string} id
 * @param {string} targetPath
 * @param {{ source?: string|null, version?: string|null }} options
 * @returns {{ ok: boolean, source: string, id: string, kind: "topogram", packageSpec: string, targetPath: string, provenancePath: string, files: string[], diagnostics: any[], errors: string[] }}
 */
function buildCatalogCopyPayload(id, targetPath, options) {
  if (!id || id.startsWith("-")) {
    throw new Error("topogram catalog copy requires <id>.");
  }
  if (!targetPath || targetPath.startsWith("-")) {
    throw new Error("topogram catalog copy requires <target>.");
  }
  const loaded = loadCatalog(options.source || null);
  const entry = findCatalogEntry(loaded.catalog, id, "topogram");
  if (!entry) {
    throw new Error(`Catalog topogram entry '${id}' was not found in ${loaded.source}.`);
  }
  const copied = copyCatalogTopogramEntry(entry, targetPath, {
    catalogSource: loaded.source,
    version: options.version || null
  });
  return {
    source: loaded.source,
    ...copied,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {ReturnType<typeof buildCatalogCopyPayload>} payload
 * @returns {void}
 */
function printCatalogCopy(payload) {
  console.log(`Copied catalog topogram '${payload.id}' to ${payload.targetPath}.`);
  console.log(`Package: ${payload.packageSpec}`);
  console.log(`Source provenance: ${payload.provenancePath}`);
  console.log(`Files: ${payload.files.length}`);
}

/**
 * @param {ReturnType<typeof buildTopogramSourceStatus>} payload
 * @returns {void}
 */
function printTopogramSourceStatus(payload) {
  if (!payload.exists) {
    console.log("Topogram source: missing");
    console.log(`Expected: ${payload.path}`);
  } else {
    console.log(`Topogram source: ${payload.status}`);
    console.log(`File: ${payload.path}`);
    if (payload.source?.catalog?.id) {
      console.log(`Catalog: ${payload.source.catalog.id}${payload.source.catalog.source ? ` from ${payload.source.catalog.source}` : ""}`);
    }
    if (payload.source?.package?.spec) {
      console.log(`Package: ${payload.source.package.spec}`);
    }
  }
  for (const kind of ["changed", "added", "removed"]) {
    const files = payload.content[kind] || [];
    console.log(`${kind[0].toUpperCase()}${kind.slice(1)}: ${files.length}`);
    for (const file of files) {
      console.log(`- ${file}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
  }
  console.log("");
  console.log(`${TOPOGRAM_SOURCE_FILE} records import provenance only. Local edits are allowed.`);
}

/**
 * @param {string} templateName
 * @param {string|null} source
 * @returns {{ templateName: string, provenance: { id: string, source: string, package: string, version: string, packageSpec: string }|null }}
 */
function resolveCatalogTemplateAlias(templateName, source = null) {
  if (!isCatalogAliasCandidate(templateName)) {
    return { templateName, provenance: null };
  }
  const catalogSource = catalogSourceOrDefault(source);
  if (isCatalogSourceDisabled(catalogSource)) {
    return { templateName, provenance: null };
  }
  try {
    const loaded = loadCatalog(catalogSource);
    const entry = findCatalogEntry(loaded.catalog, templateName, "template");
    if (!entry) {
      return { templateName, provenance: null };
    }
    const packageSpec = catalogEntryPackageSpec(entry);
    return {
      templateName: packageSpec,
      provenance: {
        id: entry.id,
        source: loaded.source,
        package: entry.package,
        version: entry.defaultVersion,
        packageSpec
      }
    };
  } catch (error) {
    if (source || process.env.TOPOGRAM_CATALOG_SOURCE) {
      throw error;
    }
    return { templateName, provenance: null };
  }
}

/**
 * @param {string} templateName
 * @returns {boolean}
 */
function isCatalogAliasCandidate(templateName) {
  const builtInTemplates = new Set(["hello-api", "hello-db", "hello-web", "web-api", "web-api-db"]);
  return Boolean(templateName) &&
    !builtInTemplates.has(templateName) &&
    !templateName.startsWith("@") &&
    !templateName.startsWith("./") &&
    !templateName.startsWith("../") &&
    !path.isAbsolute(templateName) &&
    !templateName.includes("/") &&
    !templateName.endsWith(".tgz");
}

/**
 * @param {any} plan
 * @returns {void}
 */
function printTemplateUpdatePlan(plan) {
  const isApply = plan.mode === "apply";
  const isCheck = plan.mode === "check";
  const isStatus = plan.mode === "status";
  const isFileAction = ["accept-current", "accept-candidate", "delete-current"].includes(plan.mode);
  if (isApply) {
    console.log(plan.ok ? "Template update apply: complete" : "Template update apply: refused");
  } else if (isStatus) {
    console.log(plan.ok ? "Template update status: aligned" : "Template update status: action needed");
  } else if (isCheck) {
    console.log(plan.ok ? "Template update check: aligned" : "Template update check: out of date");
  } else if (isFileAction) {
    console.log(plan.ok ? `Template update ${plan.mode}: complete` : `Template update ${plan.mode}: refused`);
  } else {
    console.log(plan.ok ? "Template update plan: ready for review" : "Template update plan: incompatible");
  }
  console.log(`Current: ${plan.current?.id || "unknown"}@${plan.current?.version || "unknown"}`);
  console.log(`Candidate: ${plan.candidate?.id || "unknown"}@${plan.candidate?.version || "unknown"}`);
  console.log(`Writes: ${plan.writes ? "applied" : "none"}`);
  if (plan.reportPath) {
    console.log(`Report: ${plan.reportPath}`);
  }
  console.log(`Added: ${plan.summary.added}`);
  console.log(`Changed: ${plan.summary.changed}`);
  console.log(`Current-only: ${plan.summary.currentOnly}`);
  console.log(`Unchanged: ${plan.summary.unchanged}`);
  if (isApply || isStatus || isFileAction) {
    const appliedCount = (plan.applied || []).length;
    const acceptedCount = (plan.accepted || []).length;
    const deletedCount = (plan.deleted || []).length;
    const skippedCount = (plan.skipped || []).length;
    const conflictCount = (plan.conflicts || []).length;
    if (isApply && appliedCount === 0 && skippedCount === 0 && conflictCount === 0 && plan.files.length === 0) {
      console.log("No changes to apply.");
    }
    if (isStatus && plan.files.length === 0 && conflictCount === 0 && skippedCount === 0 && (plan.diagnostics || []).length === 0) {
      console.log("No template update action needed.");
    }
    if (isApply && appliedCount > 0) {
      console.log(`Applied ${appliedCount} file(s).`);
    }
    if (isFileAction && appliedCount > 0) {
      console.log(`Accepted candidate for ${appliedCount} file(s).`);
    }
    if (acceptedCount > 0) {
      console.log(`Accepted current baseline for ${acceptedCount} file(s).`);
    }
    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} current-only file(s).`);
    }
    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} current-only file(s).`);
    }
    if (conflictCount > 0) {
      console.log(`Refused due to ${conflictCount} conflict(s).`);
    }
  }
  const diagnostics = Array.isArray(plan.diagnostics) ? plan.diagnostics : [];
  for (const diagnostic of diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
    if (diagnostic.step) {
      console.log(`  step: ${diagnostic.step}`);
    }
  }
  for (const conflict of plan.conflicts || []) {
    console.log(`Conflict: ${conflict.path}`);
    console.log(`  reason: ${conflict.reason}`);
  }
  for (const applied of plan.applied || []) {
    console.log(`Applied: ${applied.path}`);
  }
  for (const skipped of plan.skipped || []) {
    console.log(`Skipped: ${skipped.path}`);
    console.log(`  reason: ${skipped.reason}`);
  }
  for (const accepted of plan.accepted || []) {
    console.log(`Accepted current: ${accepted.path}`);
  }
  for (const deleted of plan.deleted || []) {
    console.log(`Deleted: ${deleted.path}`);
  }
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
  if (!isApply && !isCheck && !isStatus && !isFileAction) {
    console.log("");
    console.log("This command did not write files. Review the plan before applying template updates.");
  } else if (isCheck || isStatus) {
    console.log("");
    console.log("This command did not write files.");
  }
}

/**
 * @param {any} status
 * @returns {{ ok: boolean, mode: "recommend", writes: false, current: any, candidate: any, compatible: boolean, issues: string[], diagnostics: any[], summary: any, files: any[], conflicts: any[], skipped: any[], recommendations: Array<{ action: string, command: string|null, reason: string, path: string|null }> }}
 */
function buildTemplateUpdateRecommendationPayload(status) {
  /** @type {Array<{ action: string, command: string|null, reason: string, path: string|null }>} */
  const recommendations = [];
  const diagnostics = Array.isArray(status.diagnostics)
    ? status.diagnostics.map((diagnostic) => diagnostic.code === "template_update_available"
      ? { ...diagnostic, severity: "warning" }
      : diagnostic)
    : [];
  const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const conflicts = Array.isArray(status.conflicts) ? status.conflicts : [];
  const skipped = Array.isArray(status.skipped) ? status.skipped : [];
  const files = Array.isArray(status.files) ? status.files : [];
  const addedChanged = files.filter((file) => file.kind === "added" || file.kind === "changed");

  if (errorDiagnostics.length > 0) {
    recommendations.push({
      action: "resolve-errors",
      command: "topogram template update --status",
      reason: "Template policy, compatibility, baseline, or conflict errors must be resolved before applying candidate files.",
      path: null
    });
  }
  for (const conflict of conflicts) {
    recommendations.push({
      action: "review-conflict",
      command: `topogram template update --accept-current ${conflict.path}`,
      reason: "Local edits differ from the last trusted template-owned baseline. Accept current after review, or apply the candidate manually.",
      path: conflict.path
    });
  }
  if (addedChanged.length > 0 && conflicts.length === 0 && errorDiagnostics.length === 0) {
    recommendations.push({
      action: "apply-candidate",
      command: "topogram template update --apply",
      reason: `${addedChanged.length} added or changed candidate file(s) can be applied without local conflicts.`,
      path: null
    });
  }
  for (const item of skipped) {
    recommendations.push({
      action: "review-delete",
      command: `topogram template update --delete-current ${item.path}`,
      reason: "The candidate no longer owns this current file. Delete it only after review.",
      path: item.path
    });
  }
  if (files.length === 0 && errorDiagnostics.length === 0) {
    recommendations.push({
      action: "none",
      command: null,
      reason: "Current project files already match the candidate template.",
      path: null
    });
  }
  if (status.candidate?.id && status.candidate?.version && errorDiagnostics.length === 0) {
    recommendations.push({
      action: "pin-reviewed-version",
      command: `topogram template policy pin ${status.candidate.id}@${status.candidate.version}`,
      reason: "After reviewing or applying this candidate, pin the template version in project policy.",
      path: null
    });
  }
  return {
    ...status,
    ok: errorDiagnostics.length === 0,
    mode: "recommend",
    writes: false,
    issues: errorDiagnostics.map((diagnostic) => diagnostic.message),
    diagnostics,
    recommendations
  };
}

/**
 * @param {ReturnType<typeof buildTemplateUpdateRecommendationPayload>} payload
 * @returns {void}
 */
function printTemplateUpdateRecommendation(payload) {
  console.log(payload.ok ? "Template update recommendation: ready" : "Template update recommendation: blocked");
  console.log(`Current: ${payload.current?.id || "unknown"}@${payload.current?.version || "unknown"}`);
  console.log(`Candidate: ${payload.candidate?.id || "unknown"}@${payload.candidate?.version || "unknown"}`);
  console.log(`Added: ${payload.summary.added}`);
  console.log(`Changed: ${payload.summary.changed}`);
  console.log(`Current-only: ${payload.summary.currentOnly}`);
  console.log(`Conflicts: ${payload.conflicts.length}`);
  if (payload.reportPath) {
    console.log(`Report: ${payload.reportPath}`);
  }
  for (const diagnostic of payload.diagnostics || []) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
  console.log("");
  console.log("Recommended next steps:");
  for (const recommendation of payload.recommendations) {
    console.log(`- ${recommendation.reason}`);
    if (recommendation.command) {
      console.log(`  ${recommendation.command}`);
    }
  }
}

/**
 * @typedef {Object} TemplateCheckDiagnostic
 * @property {string} code
 * @property {"error"|"warning"} severity
 * @property {string} message
 * @property {string|null} path
 * @property {string|null} suggestedFix
 * @property {string|null} step
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {Record<string, any>} input
 * @returns {TemplateCheckDiagnostic}
 */
function templateCheckDiagnostic(input) {
  return {
    code: String(input.code || "template_check_failed"),
    severity: input.severity === "warning" ? "warning" : "error",
    message: String(input.message || "Template check failed."),
    path: typeof input.path === "string" ? input.path : null,
    suggestedFix: typeof input.suggestedFix === "string" ? input.suggestedFix : null,
    step: typeof input.step === "string" ? input.step : null
  };
}

/**
 * @param {string} templateSpec
 * @param {string} relativePath
 * @returns {string|null}
 */
function localTemplatePath(templateSpec, relativePath) {
  if (
    templateSpec === "." ||
    templateSpec.startsWith("./") ||
    templateSpec.startsWith("../") ||
    path.isAbsolute(templateSpec)
  ) {
    return path.join(path.resolve(templateSpec), relativePath);
  }
  return null;
}

/**
 * @param {string} message
 * @param {string} templateSpec
 * @param {string} step
 * @returns {TemplateCheckDiagnostic}
 */
function diagnosticForTemplateCreateFailure(message, templateSpec, step) {
  if (message.includes("is missing topogram-template.json")) {
    return templateCheckDiagnostic({
      code: "template_manifest_missing",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Add topogram-template.json with id, version, kind, and topogramVersion.",
      step
    });
  }
  if (message.includes("is missing required string field") || message.includes("topogram-template.json")) {
    return templateCheckDiagnostic({
      code: "template_manifest_invalid",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Fix topogram-template.json so it matches the template manifest schema.",
      step
    });
  }
  if (message.includes("is missing topogram/")) {
    return templateCheckDiagnostic({
      code: "template_topogram_missing",
      message,
      path: localTemplatePath(templateSpec, "topogram"),
      suggestedFix: "Add a topogram/ directory with the reusable Topogram source files.",
      step
    });
  }
  if (message.includes("is missing topogram.project.json")) {
    return templateCheckDiagnostic({
      code: "template_project_config_missing",
      message,
      path: localTemplatePath(templateSpec, "topogram.project.json"),
      suggestedFix: "Add topogram.project.json beside topogram/ with outputs and topology.components.",
      step
    });
  }
  if (message.includes("is missing implementation/")) {
    return templateCheckDiagnostic({
      code: "template_implementation_missing",
      message,
      path: localTemplatePath(templateSpec, "implementation"),
      suggestedFix: "Add implementation/ or set includesExecutableImplementation to false.",
      step
    });
  }
  return templateCheckDiagnostic({
    code: "template_create_failed",
    message,
    path: path.isAbsolute(templateSpec) ? templateSpec : null,
    suggestedFix: "Fix the template pack so topogram new can create a starter from it.",
    step
  });
}

/**
 * @param {{ message: string, loc?: any }} error
 * @param {string} step
 * @param {string|null} configPath
 * @returns {TemplateCheckDiagnostic}
 */
function diagnosticForStarterCheckFailure(error, step, configPath) {
  const locFile = typeof error?.loc?.file === "string" ? error.loc.file : null;
  const isTrust = error.message.includes(TEMPLATE_TRUST_FILE);
  return templateCheckDiagnostic({
    code: isTrust ? "template_trust_invalid" : "starter_check_failed",
    message: error.message,
    path: locFile || configPath,
    suggestedFix: isTrust
      ? "Review implementation/ and run topogram trust template in the generated starter."
      : "Fix the generated Topogram source or topogram.project.json so topogram check passes.",
    step
  });
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {Record<string, any>} [details]
 * @param {TemplateCheckDiagnostic[]} [diagnostics]
 * @returns {{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }}
 */
function templateCheckStep(name, ok, details = {}, diagnostics = []) {
  return { name, ok, details, diagnostics };
}

/**
 * @param {string} templateSpec
 * @returns {{ ok: boolean, templateSpec: string, projectRoot: string|null, steps: Array<{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }>, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
function buildTemplateCheckPayload(templateSpec) {
  if (!templateSpec) {
    throw new Error("topogram template check requires <template-spec-or-path>.");
  }
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-"));
  const projectRoot = path.join(runRoot, "starter");
  /** @type {Array<{ name: string, ok: boolean, details: Record<string, any>, diagnostics: TemplateCheckDiagnostic[] }>} */
  const steps = [];
  /** @type {TemplateCheckDiagnostic[]} */
  const diagnostics = [];
  let created = null;
  try {
    const callerPolicyInfo = loadTemplatePolicy(process.cwd());
    if (callerPolicyInfo.exists) {
      const resolvedTemplate = resolveTemplate(templateSpec, TEMPLATES_ROOT);
      const policyDiagnostics = templatePolicyDiagnosticsForTemplate(callerPolicyInfo, resolvedTemplate, "template-check-policy");
      if (policyDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        const stepDiagnostics = policyDiagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
        diagnostics.push(...stepDiagnostics);
        steps.push(templateCheckStep("template-policy", false, {
          path: callerPolicyInfo.path
        }, stepDiagnostics));
        return {
          ok: false,
          templateSpec,
          projectRoot: null,
          steps,
          diagnostics,
          errors: diagnostics.map((diagnostic) => diagnostic.message)
        };
      }
    }
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
    const stepDiagnostics = [
      diagnosticForTemplateCreateFailure(messageFromError(error), templateSpec, "create-starter")
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("create-starter", false, {}, stepDiagnostics));
    return {
      ok: false,
      templateSpec,
      projectRoot: null,
      steps,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }

  const projectConfigInfo = loadProjectConfig(projectRoot);
  if (!projectConfigInfo) {
    const stepDiagnostics = [
      templateCheckDiagnostic({
        code: "starter_project_config_missing",
        message: "Generated starter is missing topogram.project.json.",
        path: path.join(projectRoot, "topogram.project.json"),
        suggestedFix: "Ensure the template includes topogram.project.json at its root.",
        step: "project-config"
      })
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("project-config", false, {}, stepDiagnostics));
    return {
      ok: false,
      templateSpec,
      projectRoot,
      steps,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
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
  const starterDiagnostics = [
    ...(resolved.ok ? [] : resolved.validation.errors),
    ...projectValidation.errors
  ].map((error) => diagnosticForStarterCheckFailure(error, "starter-check", projectConfigInfo.configPath));
  steps.push(templateCheckStep("starter-check", starterCheckOk, {
    files: ast.files.length,
    statements: ast.files.flatMap((file) => file.statements).length
  }, starterDiagnostics));
  if (!starterCheckOk) {
    diagnostics.push(...starterDiagnostics);
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
    const trustDiagnostics = trustStatus.issues.map((issue) => templateCheckDiagnostic({
      code: "template_trust_invalid",
      message: issue,
      path: trustStatus.trustPath,
      suggestedFix: "Review implementation/ and run topogram trust template in the generated starter.",
      step: "executable-implementation-trust"
    }));
    steps.push(templateCheckStep("executable-implementation-trust", trustStatus.ok, {
      requiresTrust: true,
      trustPath: trustStatus.trustPath,
      trustedFiles: trustStatus.trustRecord?.content?.files?.length || 0
    }, trustDiagnostics));
    if (!trustStatus.ok) {
      diagnostics.push(...trustDiagnostics);
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
      const stepDiagnostics = updatePlan.issues.map((issue) => templateCheckDiagnostic({
        code: "template_update_plan_failed",
        message: issue,
        path: projectConfigInfo.configPath,
        suggestedFix: "Fix template metadata so a no-write update plan can be produced.",
        step: "template-update-plan"
      }));
      steps[steps.length - 1].diagnostics.push(...stepDiagnostics);
      diagnostics.push(...stepDiagnostics);
    }
  } catch (error) {
    const stepDiagnostics = [
      templateCheckDiagnostic({
        code: "template_update_plan_failed",
        message: messageFromError(error),
        path: projectConfigInfo.configPath,
        suggestedFix: "Fix template metadata so a no-write update plan can be produced.",
        step: "template-update-plan"
      })
    ];
    diagnostics.push(...stepDiagnostics);
    steps.push(templateCheckStep("template-update-plan", false, {}, stepDiagnostics));
  }

  return {
    ok: steps.every((step) => step.ok),
    templateSpec,
    projectRoot,
    steps,
    diagnostics,
    errors: diagnostics.map((diagnostic) => diagnostic.message)
  };
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
function buildTemplatePolicyCheckPayload(projectPath) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_project_missing",
      message: "Cannot check template policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), "topogram.template-policy.json"),
      exists: false,
      policy: null,
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const policyInfo = loadTemplatePolicy(projectConfigInfo.configDir);
  /** @type {TemplateCheckDiagnostic[]} */
  const diagnostics = policyInfo.diagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
  if (!policyInfo.exists) {
    diagnostics.push(templateCheckDiagnostic({
      code: "template_policy_missing",
      severity: "warning",
      message: "No topogram.template-policy.json found. Template operations are permissive until a policy is defined.",
      path: policyInfo.path,
      suggestedFix: "Run `topogram template policy init` to create a project template policy.",
      step: "policy"
    }));
  } else if (policyInfo.policy) {
    const template = projectConfigInfo.config.template || {};
    const source = template.source === "builtin" || template.source === "local" || template.source === "package"
      ? template.source
      : "builtin";
    const currentTemplate = {
      requested: typeof template.requested === "string" ? template.requested : String(template.id || "unknown"),
      root: projectConfigInfo.configDir,
      manifest: {
        id: typeof template.id === "string" ? template.id : "unknown",
        version: typeof template.version === "string" ? template.version : "unknown",
        kind: "starter",
        topogramVersion: "*",
        includesExecutableImplementation: Boolean(template.includesExecutableImplementation)
      },
      source,
      packageSpec: typeof template.sourceSpec === "string" ? template.sourceSpec : null
    };
    diagnostics.push(...templatePolicyDiagnosticsForTemplate(policyInfo, currentTemplate, "policy")
      .map((diagnostic) => templateCheckDiagnostic(diagnostic)));
  }
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    path: policyInfo.path,
    exists: policyInfo.exists,
    policy: policyInfo.policy,
    diagnostics,
    errors
  };
}

/**
 * @param {{ ok: boolean, path: string, exists: boolean, policy: any, diagnostics: TemplateCheckDiagnostic[] }} payload
 * @returns {void}
 */
function printTemplatePolicyCheckPayload(payload) {
  console.log(payload.ok ? "Template policy check passed" : "Template policy check failed");
  console.log(`Policy: ${payload.path}`);
  console.log(`Exists: ${payload.exists ? "yes" : "no"}`);
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
 * @param {string|null|undefined} spec
 * @returns {{ id: string, version: string }|null}
 */
function parseTemplateVersionPin(spec) {
  if (!spec) {
    return null;
  }
  const separator = spec.lastIndexOf("@");
  if (separator <= 0 || separator === spec.length - 1) {
    throw new Error("Template policy pin requires a template id and version, for example @scope/template@0.2.0.");
  }
  return {
    id: spec.slice(0, separator),
    version: spec.slice(separator + 1)
  };
}

/**
 * @param {string} projectPath
 * @param {string|null|undefined} spec
 * @returns {{ ok: boolean, path: string, policy: any, pinned: { id: string, version: string }, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
function buildTemplatePolicyPinPayload(projectPath, spec) {
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_project_missing",
      message: "Cannot pin template policy without topogram.project.json.",
      path: path.resolve(projectPath),
      suggestedFix: "Run this command in a Topogram project.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(path.resolve(projectPath), "topogram.template-policy.json"),
      policy: null,
      pinned: { id: "", version: "" },
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }
  const parsed = parseTemplateVersionPin(spec);
  const currentTemplate = projectConfigInfo.config.template || {};
  const pin = parsed || {
    id: typeof currentTemplate.id === "string" ? currentTemplate.id : "",
    version: typeof currentTemplate.version === "string" ? currentTemplate.version : ""
  };
  if (!pin.id || !pin.version) {
    const diagnostic = templateCheckDiagnostic({
      code: "template_policy_pin_missing_version",
      message: "Cannot pin a template version without a template id and version.",
      path: projectConfigInfo.configPath,
      suggestedFix: "Pass a pin such as @scope/template@0.2.0, or ensure topogram.project.json records template.id and template.version.",
      step: "policy"
    });
    return {
      ok: false,
      path: path.join(projectConfigInfo.configDir, "topogram.template-policy.json"),
      policy: null,
      pinned: pin,
      diagnostics: [diagnostic],
      errors: [diagnostic.message]
    };
  }

  const existing = loadTemplatePolicy(projectConfigInfo.configDir);
  const diagnostics = existing.diagnostics.map((diagnostic) => templateCheckDiagnostic(diagnostic));
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      ok: false,
      path: existing.path,
      policy: existing.policy,
      pinned: pin,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }
  const policy = existing.policy || writeTemplatePolicyForProject(projectConfigInfo.configDir, projectConfigInfo.config);
  const allowedTemplateIds = policy.allowedTemplateIds.includes(pin.id)
    ? policy.allowedTemplateIds
    : [...policy.allowedTemplateIds, pin.id];
  const allowedPackageScopes = [...(policy.allowedPackageScopes || [])];
  if (pin.id.startsWith("@")) {
    const scope = pin.id.split("/")[0];
    if (scope && !allowedPackageScopes.includes(scope)) {
      allowedPackageScopes.push(scope);
    }
  }
  const nextPolicy = {
    ...policy,
    allowedTemplateIds,
    allowedPackageScopes,
    pinnedVersions: {
      ...(policy.pinnedVersions || {}),
      [pin.id]: pin.version
    }
  };
  writeTemplatePolicy(projectConfigInfo.configDir, nextPolicy);
  return {
    ok: true,
    path: path.join(projectConfigInfo.configDir, "topogram.template-policy.json"),
    policy: nextPolicy,
    pinned: pin,
    diagnostics: [],
    errors: []
  };
}

/**
 * @param {{ ok: boolean, path: string, pinned: { id: string, version: string }, diagnostics: TemplateCheckDiagnostic[] }}
 * @returns {void}
 */
function printTemplatePolicyPinPayload(payload) {
  console.log(payload.ok ? "Template policy pin updated" : "Template policy pin failed");
  console.log(`Policy: ${payload.path}`);
  if (payload.pinned.id) {
    console.log(`Pinned: ${payload.pinned.id}@${payload.pinned.version || "unknown"}`);
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
 * @param {Record<string, any>} details
 * @returns {string[]}
 */
function formatTemplateCheckDetails(details) {
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `  ${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
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
    for (const detail of formatTemplateCheckDetails(step.details)) {
      console.log(detail);
    }
    for (const diagnostic of step.diagnostics) {
      console.log(`  [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
      if (diagnostic.path) {
        console.log(`    path: ${diagnostic.path}`);
      }
      if (diagnostic.suggestedFix) {
        console.log(`    fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
  const stepDiagnostics = new Set(payload.steps.flatMap((step) => step.diagnostics));
  for (const diagnostic of payload.diagnostics.filter((item) => !stepDiagnostics.has(item))) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.path) {
      console.log(`  path: ${diagnostic.path}`);
    }
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
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
} else if (args[0] === "catalog" && args[1] === "list") {
  commandArgs = { catalogList: true, inputPath: args[2] && !args[2].startsWith("-") ? args[2] : null };
} else if (args[0] === "catalog" && args[1] === "show") {
  commandArgs = { catalogShow: true, inputPath: args[2] };
} else if (args[0] === "catalog" && args[1] === "check") {
  commandArgs = { catalogCheck: true, inputPath: args[2] };
} else if (args[0] === "catalog" && args[1] === "copy") {
  commandArgs = { catalogCopy: true, catalogId: args[2], inputPath: args[3] };
} else if (args[0] === "source" && args[1] === "status") {
  commandArgs = { sourceStatus: true, inputPath: commandPath(2, ".") };
} else if (args[0] === "template" && args[1] === "list") {
  commandArgs = { templateList: true, inputPath: null };
} else if (args[0] === "template" && args[1] === "show") {
  commandArgs = { templateShow: true, inputPath: args[2] };
} else if (args[0] === "template" && args[1] === "status") {
  commandArgs = { templateStatus: true, inputPath: commandPath(2) };
} else if (args[0] === "template" && args[1] === "policy" && args[2] === "init") {
  commandArgs = { templatePolicyInit: true, inputPath: commandPath(3) };
} else if (args[0] === "template" && args[1] === "policy" && args[2] === "check") {
  commandArgs = { templatePolicyCheck: true, inputPath: commandPath(3) };
} else if (args[0] === "template" && args[1] === "policy" && args[2] === "pin") {
  commandArgs = { templatePolicyPin: true, templatePolicyPinSpec: args[3] && !args[3].startsWith("-") ? args[3] : null, inputPath: commandPath(4) };
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
const shouldCatalogList = Boolean(commandArgs?.catalogList);
const shouldCatalogShow = Boolean(commandArgs?.catalogShow);
const shouldCatalogCheck = Boolean(commandArgs?.catalogCheck);
const shouldCatalogCopy = Boolean(commandArgs?.catalogCopy);
const shouldSourceStatus = Boolean(commandArgs?.sourceStatus);
const shouldTemplateList = Boolean(commandArgs?.templateList);
const shouldTemplateShow = Boolean(commandArgs?.templateShow);
const shouldTemplateStatus = Boolean(commandArgs?.templateStatus);
const shouldTemplatePolicyInit = Boolean(commandArgs?.templatePolicyInit);
const shouldTemplatePolicyCheck = Boolean(commandArgs?.templatePolicyCheck);
const shouldTemplatePolicyPin = Boolean(commandArgs?.templatePolicyPin);
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
const templateName = templateIndex >= 0 ? args[templateIndex + 1] : "hello-web";
const catalogIndex = args.indexOf("--catalog");
const catalogSource = catalogIndex >= 0 && args[catalogIndex + 1] && !args[catalogIndex + 1].startsWith("-")
  ? args[catalogIndex + 1]
  : null;
const versionIndex = args.indexOf("--version");
const requestedVersion = versionIndex >= 0 && args[versionIndex + 1] && !args[versionIndex + 1].startsWith("-")
  ? args[versionIndex + 1]
  : null;
const useLatestTemplate = args.includes("--latest");
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

if ((shouldCheck || shouldValidate || shouldTrustTemplate || shouldTrustStatus || shouldTrustDiff || shouldSourceStatus || shouldTemplateStatus || shouldTemplatePolicyInit || shouldTemplatePolicyCheck || shouldTemplatePolicyPin || shouldTemplateCheck || shouldTemplateUpdate || generateTarget === "app-bundle") && !inputPath) {
  console.error("Missing required <path>.");
  printUsage();
  process.exit(1);
}

if ((shouldCatalogShow || shouldTemplateShow) && !inputPath) {
  console.error("Missing required <id>.");
  printUsage();
  process.exit(1);
}

if (shouldCatalogCheck && !inputPath) {
  console.error("Missing required <path-or-url>.");
  printUsage();
  process.exit(1);
}

if (shouldCatalogCopy && (!commandArgs?.catalogId || !inputPath)) {
  console.error("Missing required <id> or <target>.");
  printUsage();
  process.exit(1);
}

if ((shouldCheck || shouldValidate || shouldTrustTemplate || shouldTrustStatus || shouldTrustDiff || shouldTemplateStatus || shouldTemplatePolicyInit || shouldTemplatePolicyCheck || shouldTemplatePolicyPin || shouldTemplateUpdate || generateTarget === "app-bundle") && inputPath) {
  inputPath = normalizeTopogramPath(inputPath);
}

try {
  if (shouldCatalogList) {
    const payload = buildCatalogListPayload(catalogSource || inputPath || null);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printCatalogList(payload);
    }
    process.exit(0);
  }

  if (shouldCatalogShow) {
    const payload = buildCatalogShowPayload(inputPath, catalogSource);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printCatalogShow(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldCatalogCheck) {
    const payload = buildCatalogCheckPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printCatalogCheck(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldCatalogCopy) {
    const payload = buildCatalogCopyPayload(commandArgs.catalogId, inputPath, {
      source: catalogSource,
      version: requestedVersion
    });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printCatalogCopy(payload);
    }
    process.exit(0);
  }

  if (shouldSourceStatus) {
    const payload = buildTopogramSourceStatus(normalizeProjectRoot(inputPath));
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTopogramSourceStatus(payload);
    }
    process.exit(0);
  }

  if (commandArgs?.newProject) {
    const resolvedTemplate = resolveCatalogTemplateAlias(templateName, catalogSource);
    const result = createNewProject({
      targetPath: inputPath,
      templateName: resolvedTemplate.templateName,
      templateProvenance: resolvedTemplate.provenance,
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

  if (shouldTemplateList) {
    const payload = buildTemplateListPayload({ catalogSource });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTemplateList(payload);
    }
    process.exit(0);
  }

  if (shouldTemplateShow) {
    const payload = buildTemplateShowPayload(inputPath, catalogSource);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTemplateShow(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldTemplateStatus) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot inspect template status without topogram.project.json.");
    }
    const status = buildTemplateStatusPayload(projectConfigInfo, { latest: useLatestTemplate });
    if (emitJson) {
      console.log(stableStringify(status));
    } else {
      printTemplateStatus(status);
    }
    process.exit(status.ok ? 0 : 1);
  }

  if (shouldTemplatePolicyInit) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot initialize template policy without topogram.project.json.");
    }
    const policy = writeTemplatePolicyForProject(projectConfigInfo.configDir, projectConfigInfo.config);
    const payload = {
      ok: true,
      path: path.join(projectConfigInfo.configDir, "topogram.template-policy.json"),
      policy,
      diagnostics: [],
      errors: []
    };
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      console.log(`Wrote template policy: ${payload.path}`);
      console.log(`Allowed template ids: ${policy.allowedTemplateIds.join(", ") || "(any)"}`);
      console.log(`Allowed sources: ${policy.allowedSources.join(", ") || "(any)"}`);
    }
    process.exit(0);
  }

  if (shouldTemplatePolicyCheck) {
    const payload = buildTemplatePolicyCheckPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTemplatePolicyCheckPayload(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldTemplatePolicyPin) {
    const payload = buildTemplatePolicyPinPayload(inputPath, commandArgs?.templatePolicyPinSpec);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTemplatePolicyPinPayload(payload);
    }
    process.exit(payload.ok ? 0 : 1);
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
    const applyUpdate = args.includes("--apply");
    const checkUpdate = args.includes("--check");
    const planUpdate = args.includes("--plan");
    const statusUpdate = args.includes("--status");
    const recommendUpdate = args.includes("--recommend");
    const acceptCurrentIndex = args.indexOf("--accept-current");
    const acceptCandidateIndex = args.indexOf("--accept-candidate");
    const deleteCurrentIndex = args.indexOf("--delete-current");
    const acceptCurrentUpdate = acceptCurrentIndex >= 0;
    const acceptCandidateUpdate = acceptCandidateIndex >= 0;
    const deleteCurrentUpdate = deleteCurrentIndex >= 0;
    const fileAction = acceptCurrentUpdate ? "accept-current" : acceptCandidateUpdate ? "accept-candidate" : deleteCurrentUpdate ? "delete-current" : null;
    const fileActionIndex = acceptCurrentUpdate ? acceptCurrentIndex : acceptCandidateUpdate ? acceptCandidateIndex : deleteCurrentUpdate ? deleteCurrentIndex : -1;
    const fileActionPath = fileActionIndex >= 0 ? args[fileActionIndex + 1] : null;
    const updateModeCount = [applyUpdate, checkUpdate, planUpdate, statusUpdate, recommendUpdate, acceptCurrentUpdate, acceptCandidateUpdate, deleteCurrentUpdate].filter(Boolean).length;
    if (updateModeCount > 1) {
      throw new Error("Choose one template update mode or file adoption action.");
    }
    if (updateModeCount === 0) {
      throw new Error("Template update requires `--status`, `--recommend`, `--plan`, `--check`, `--apply`, `--accept-current <file>`, `--accept-candidate <file>`, or `--delete-current <file>`.");
    }
    if (fileAction && (!fileActionPath || fileActionPath.startsWith("-"))) {
      throw new Error(`Template update ${fileAction} requires a relative file path.`);
    }
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot update template without topogram.project.json.");
    }
    const requestedTemplateName = templateIndex >= 0
      ? templateName
      : useLatestTemplate
        ? latestTemplateInfo(templateMetadataFromProjectConfig(projectConfigInfo.config)).candidateSpec
        : null;
    if (useLatestTemplate && !requestedTemplateName) {
      throw new Error("Cannot use --latest because the current template is not package-backed.");
    }
    let update;
    try {
      const updateOptions = {
        projectRoot: projectConfigInfo.configDir,
        projectConfig: projectConfigInfo.config,
        templateName: requestedTemplateName,
        templatesRoot: TEMPLATES_ROOT
      };
      update = fileAction
        ? applyTemplateUpdateFileAction({ ...updateOptions, action: fileAction, filePath: fileActionPath || "" })
        : recommendUpdate
          ? buildTemplateUpdateRecommendationPayload(buildTemplateUpdateStatus(updateOptions))
          : (applyUpdate ? applyTemplateUpdate : checkUpdate ? buildTemplateUpdateCheck : statusUpdate ? buildTemplateUpdateStatus : buildTemplateUpdatePlan)(updateOptions);
    } catch (error) {
      const message = messageFromError(error);
      update = {
        ok: false,
        mode: fileAction || (applyUpdate ? "apply" : checkUpdate ? "check" : statusUpdate ? "status" : recommendUpdate ? "recommend" : "plan"),
        writes: false,
        current: {
          id: typeof projectConfigInfo.config.template?.id === "string" ? projectConfigInfo.config.template.id : null,
          version: typeof projectConfigInfo.config.template?.version === "string" ? projectConfigInfo.config.template.version : null
        },
        candidate: null,
        compatible: false,
        issues: [message],
        diagnostics: [templateCheckDiagnostic({
          code: "template_resolve_failed",
          message,
          path: templateIndex >= 0 && typeof templateName === "string" && path.isAbsolute(templateName) ? templateName : null,
          suggestedFix: "Check the template path or package spec, and verify private registry authentication if this is a package template.",
          step: "resolve-candidate"
        })],
        summary: { added: 0, changed: 0, currentOnly: 0, unchanged: 0 },
        files: [],
        applied: [],
        skipped: [],
        conflicts: [],
        recommendations: recommendUpdate ? [{
          action: "resolve-errors",
          command: "topogram template update --status",
          reason: "Resolve the candidate template before choosing an update action.",
          path: null
        }] : undefined
      };
    }
    if (outPath) {
      const reportPath = path.resolve(outPath);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, `${stableStringify(update)}\n`, "utf8");
      update.reportPath = reportPath;
    }
    if (emitJson) {
      console.log(stableStringify(update));
    } else if (recommendUpdate) {
      printTemplateUpdateRecommendation(update);
    } else {
      printTemplateUpdatePlan(update);
    }
    process.exit(update.ok ? 0 : 1);
  }

  if (shouldTrustTemplate) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot trust template files without topogram.project.json.");
    }
    const fileManifest = writeTemplateFilesManifest(projectConfigInfo.configDir, projectConfigInfo.config);
    console.log(`Wrote .topogram-template-files.json with ${fileManifest.files.length} template-owned file hash(es).`);
    if (projectConfigInfo.config.implementation) {
      const implementationInfo = {
        config: projectConfigInfo.config.implementation,
        configPath: projectConfigInfo.configPath,
        configDir: projectConfigInfo.configDir
      };
      if (implementationRequiresTrust(implementationInfo)) {
        const trustRecord = writeTemplateTrustRecord(projectConfigInfo.configDir, projectConfigInfo.config);
        console.log(`Wrote ${TEMPLATE_TRUST_FILE} for ${trustRecord.implementation.module}.`);
        if (trustRecord.template.id) {
          console.log(`Trusted template: ${trustRecord.template.id}@${trustRecord.template.version || "unknown"}`);
        }
        console.log(`Trusted implementation digest: ${trustRecord.content.digest}`);
        process.exit(0);
      }
    }
    console.log("No local implementation trust record needed for this project.");
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
    const projectRoot = normalizeProjectRoot(inputPath);
    const explicitProjectConfig = loadProjectConfig(projectRoot) || loadProjectConfig(inputPath);
    const implementationOptionalTargets = new Set(["app-bundle-plan", "app-bundle", "environment-plan", "environment-bundle", "compile-check-plan", "compile-check-bundle"]);
    const shouldLoadImplementation = targetRequiresImplementationProvider(generateTarget) &&
      (!implementationOptionalTargets.has(generateTarget) || Boolean(explicitProjectConfig?.config?.implementation));
    const implementation = shouldLoadImplementation
      ? await loadImplementationProvider(explicitProjectConfig?.configDir || projectRoot)
      : null;
    const resolvedForConfig = targetRequiresImplementationProvider(generateTarget) || explicitProjectConfig
      ? resolveWorkspace(ast)
      : null;
    if (resolvedForConfig && !resolvedForConfig.ok) {
      console.error(formatValidationErrors(resolvedForConfig.validation));
      process.exit(1);
    }
    const projectConfigInfo = resolvedForConfig
      ? (explicitProjectConfig || projectConfigOrDefault(projectRoot, resolvedForConfig.graph, implementation))
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
