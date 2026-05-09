#!/usr/bin/env node

import fs from "node:fs";
import childProcess from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertSupportedNode } from "./runtime-support.js";
import { parseSplitCommandArgs } from "./cli/command-parser.js";
import { handleSetupCommand, printSetupHelp } from "./cli/commands/setup.js";
import { buildVersionPayload, printVersion } from "./cli/commands/version.js";
import {
  buildQueryListPayload,
  buildQueryShowPayload,
  printQueryDefinition,
  printQueryHelp,
  printQueryList
} from "./cli/commands/query.js";
import {
  buildGeneratorListPayload,
  buildGeneratorShowPayload,
  buildGeneratorPolicyCheckPayload,
  buildGeneratorPolicyExplainPayload,
  buildGeneratorPolicyInitPayload,
  buildGeneratorPolicyPinPayload,
  buildGeneratorPolicyStatusPayload,
  checkGeneratorPack,
  printGeneratorCheck,
  printGeneratorHelp,
  printGeneratorList,
  printGeneratorPolicyCheckPayload,
  printGeneratorPolicyExplainPayload,
  printGeneratorPolicyInitPayload,
  printGeneratorPolicyPinPayload,
  printGeneratorPolicyStatusPayload,
  printGeneratorShow
} from "./cli/commands/generator.js";
import {
  buildCatalogCheckPayload,
  buildCatalogCopyPayload,
  buildCatalogDoctorPayload,
  buildCatalogListPayload,
  buildCatalogShowPayload,
  printCatalogCheck,
  printCatalogCopy,
  printCatalogDoctor,
  printCatalogHelp,
  printCatalogList,
  printCatalogShow,
  shellCommandArg
} from "./cli/commands/catalog.js";
import {
  buildPackageUpdateCliPayload,
  CLI_PACKAGE_NAME,
  isPackageVersion,
  latestTopogramCliVersion,
  printPackageHelp,
  printPackageUpdateCli,
  readInstalledCliPackageVersion
} from "./cli/commands/package.js";
import {
  buildTemplateListPayload,
  buildTemplateShowPayload,
  buildTemplateStatusPayload,
  buildTemplateExplainPayload,
  buildTemplateDetachPayload,
  buildTemplateCheckPayload,
  buildTemplatePolicyCheckPayload,
  buildTemplatePolicyExplainPayload,
  buildTemplatePolicyPinPayload,
  buildTemplateUpdateCliPayload,
  printTemplateCheckPayload,
  printTemplateHelp,
  printTemplateList,
  printTemplateShow,
  printTemplateStatus,
  printTemplateExplain,
  printTemplateDetachPayload,
  printTemplatePolicyCheckPayload,
  printTemplatePolicyExplainPayload,
  printTemplatePolicyPinPayload,
  printTemplateUpdatePlan,
  printTemplateUpdateRecommendation
} from "./cli/commands/template.js";
import {
  printEmitHelp,
  printGenerateHelp,
  printNewHelp,
  printUsage,
  printWidgetHelp
} from "./cli/help.js";
import {
  buildBrownfieldImportAdoptListPayload,
  buildBrownfieldImportAdoptPayload,
  buildBrownfieldImportCheckPayload,
  buildBrownfieldImportDiffPayload,
  buildBrownfieldImportHistoryPayload,
  buildBrownfieldImportPlanPayload,
  buildBrownfieldImportRefreshPayload,
  buildBrownfieldImportStatusPayload,
  buildBrownfieldImportWorkspacePayload,
  printBrownfieldImportAdopt,
  printBrownfieldImportAdoptList,
  printBrownfieldImportCheck,
  printBrownfieldImportDiff,
  printBrownfieldImportHistory,
  printBrownfieldImportPlan,
  printBrownfieldImportRefresh,
  printBrownfieldImportStatus,
  printBrownfieldImportWorkspace,
  printImportHelp
} from "./cli/commands/import.js";
import { parsePath } from "./parser.js";
import { stableStringify } from "./format.js";
import { generateWorkspace } from "./generator.js";
import { buildOutputFiles } from "./generator.js";
import { loadImplementationProvider } from "./example-implementation.js";
import {
  createNewProject,
  writeTemplatePolicyForProject
} from "./new-project.js";
import {
  TEMPLATE_TRUST_FILE,
  validateProjectImplementationTrust
} from "./template-trust.js";
import { recommendedVerificationTargets } from "./generator/context/shared.js";
import { GENERATOR_POLICY_FILE } from "./generator-policy.js";
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
  isCatalogSourceDisabled,
  loadCatalog
} from "./catalog.js";
import { resolveCatalogTemplateAlias } from "./cli/catalog-alias.js";
import {
  formatProjectConfigErrors,
  loadProjectConfig,
  outputOwnershipForPath,
  projectConfigOrDefault,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "./project-config.js";
import {
  buildAgentBrief,
  formatAgentBrief,
  normalizeAgentTopogramPath
} from "./agent-brief.js";
import { LOCAL_NPMRC_ENV } from "./npm-safety.js";
import {
  buildDoctorPayload,
  printDoctor,
  printDoctorHelp
} from "./cli/commands/doctor.js";
import {
  buildProjectSourceStatus,
  printSourceHelp,
  printTopogramSourceStatus
} from "./cli/commands/source.js";
import {
  printTrustHelp,
  runTrustDiffCommand,
  runTrustStatusCommand,
  runTrustTemplateCommand
} from "./cli/commands/trust.js";
import {
  latestWorkflowRun,
  workflowRunJobs
} from "./github-client.js";
import {
  catalogRepoSlug,
  githubRepoSlug,
  releaseConsumerRepos,
  releaseConsumerWorkflowJobs,
  releaseConsumerWorkflowName
} from "./topogram-config.js";

try {
  assertSupportedNode();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

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

function printReleaseHelp() {
  console.log("Usage: topogram release status [--json] [--strict] [--markdown|--write-report <path>]");
  console.log("   or: topogram release roll-consumers <version|--latest> [--json] [--no-push] [--watch]");
  console.log("");
  console.log("Checks the local CLI version, latest published package version, release tag, first-party consumer pins, and strict consumer CI state.");
  console.log("Rolls first-party consumers to a published CLI version, runs their checks, commits, pushes, and can wait for current workflow runs.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram release status");
  console.log("  topogram release status --json");
  console.log("  topogram release status --strict");
  console.log("  topogram release status --strict --write-report ./docs/release-matrix.md");
  console.log("  topogram release roll-consumers 0.3.46 --watch");
  console.log("  topogram release roll-consumers --latest --watch");
  console.log("");
  console.log("Release preparation and publishing are repo-level tasks in the Topogram source checkout:");
  console.log("  npm run release:prepare -- <version>");
  console.log("  npm run release:check");
  console.log("  GitHub Actions: Publish CLI Package");
}

function printCheckHelp() {
  console.log("Usage: topogram check [path] [--json]");
  console.log("");
  console.log("Validates Topogram files, project configuration, topology, generator compatibility, generator policy, output ownership, and template policy.");
  console.log("");
  console.log("Defaults: path is ./topogram.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram check");
  console.log("  topogram check --json");
  console.log("  topogram check ./topogram");
}

function printAgentHelp() {
  console.log("Usage: topogram agent brief [path] [--json]");
  console.log("");
  console.log("Prints read-only first-run guidance for humans and agents working in a Topogram project.");
  console.log("");
  console.log("Defaults: path is ./topogram. The command validates the Topogram and project config, but does not write files, generate apps, load generator adapters, or execute template implementation.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram agent brief");
  console.log("  topogram agent brief --json");
  console.log("  topogram agent brief ./topogram --json");
}

function printCommandHelp(command) {
  if (command === "new" || command === "create") {
    printNewHelp();
    return true;
  }
  if (command === "generate") {
    printGenerateHelp();
    return true;
  }
  if (command === "emit") {
    printEmitHelp();
    return true;
  }
  if (command === "widget") {
    printWidgetHelp();
    return true;
  }
  if (command === "query") {
    printQueryHelp();
    return true;
  }
  if (command === "agent") {
    printAgentHelp();
    return true;
  }
  if (command === "generator") {
    printGeneratorHelp();
    return true;
  }
  if (command === "template") {
    printTemplateHelp();
    return true;
  }
  if (command === "catalog") {
    printCatalogHelp();
    return true;
  }
  if (command === "doctor") {
    printDoctorHelp();
    return true;
  }
  if (command === "setup") {
    printSetupHelp();
    return true;
  }
  if (command === "package") {
    printPackageHelp();
    return true;
  }
  if (command === "release") {
    printReleaseHelp();
    return true;
  }
  if (command === "source") {
    printSourceHelp();
    return true;
  }
  if (command === "trust") {
    printTrustHelp();
    return true;
  }
  if (command === "import") {
    printImportHelp();
    return true;
  }
  if (command === "check") {
    printCheckHelp();
    return true;
  }
  return false;
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
    uses_api: component.uses_api || null,
    uses_database: component.uses_database || null
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
  const runtimes = (config?.topology?.runtimes || [])
    .map((component) => ({
      id: component.id,
      kind: component.kind,
      projection: component.projection,
      generator: {
        id: component.generator?.id || null,
        version: component.generator?.version || null
      },
      port: topologyComponentPort(component),
      references: topologyComponentReferences(component)
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const edges = runtimes.flatMap((component) => {
    const references = [];
    if (component.references.uses_api) {
      references.push({
        from: component.id,
        to: component.references.uses_api,
        type: "calls_api"
      });
    }
    if (component.references.uses_database) {
      references.push({
        from: component.id,
        to: component.references.uses_database,
        type: "uses_database"
      });
    }
    return references;
  }).sort((left, right) => `${left.from}:${left.type}:${left.to}`.localeCompare(`${right.from}:${right.type}:${right.to}`));
  return {
    outputs,
    runtimes,
    edges
  };
}

function publicProjectTopology(topology) {
  if (!topology || typeof topology !== "object") {
    return topology || null;
  }
  return {
    ...Object.fromEntries(Object.entries(topology).filter(([key]) => key !== "components")),
    runtimes: topology.runtimes || []
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
  return `  - ${component.id}: ${component.kind} ${component.projection} via ${generator} (${port})${suffix}`;
}

function printTopologySummary(topology) {
  console.log("Project topology:");
  if (topology.outputs.length > 0) {
    console.log("  Outputs:");
    for (const output of topology.outputs) {
      console.log(`  - ${output.name}: ${output.path || "unset"} (${output.ownership || "unknown"})`);
    }
  }
  if (topology.runtimes.length > 0) {
    console.log("  Runtimes:");
    for (const component of topology.runtimes) {
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
      topology: publicProjectTopology(projectInfo.config.topology),
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

function printWidgetConformanceReport(report) {
  const summary = report.summary || {};
  const ok = (summary.errors || 0) === 0;
  console.log(ok ? "Widget conformance passed." : "Widget conformance found issues.");
  console.log(`Usages: ${summary.total_usages || 0} total, ${summary.passed_usages || 0} passed, ${summary.warning_usages || 0} warning, ${summary.error_usages || 0} error`);
  console.log(`Checks: ${summary.errors || 0} error(s), ${summary.warnings || 0} warning(s)`);
  if (report.filters?.projection) {
    console.log(`Projection filter: ${report.filters.projection}`);
  }
  if (report.filters?.widget) {
    console.log(`Widget filter: ${report.filters.widget}`);
  }
  if ((summary.affected_projections || []).length > 0) {
    console.log(`Affected projections: ${summary.affected_projections.join(", ")}`);
  }
  if ((summary.affected_widgets || []).length > 0) {
    console.log(`Affected widgets: ${summary.affected_widgets.join(", ")}`);
  }
  if ((report.checks || []).length > 0) {
    console.log("");
    console.log("Issues:");
    for (const check of report.checks) {
      const context = [
        check.projection ? `projection ${check.projection}` : null,
        check.widget ? `widget ${check.widget}` : null,
        check.screen ? `screen ${check.screen}` : null,
        check.region ? `region ${check.region}` : null,
        check.prop ? `prop ${check.prop}` : null,
        check.event ? `event ${check.event}` : null,
        check.behavior ? `behavior ${check.behavior}` : null
      ].filter(Boolean).join(", ");
      console.log(`- ${check.severity.toUpperCase()} ${check.code}${context ? ` (${context})` : ""}: ${check.message}`);
      if (check.suggested_fix) {
        console.log(`  Fix: ${check.suggested_fix}`);
      }
    }
  }
  const writeScopePaths = report.write_scope?.paths || [];
  if (writeScopePaths.length > 0) {
    console.log("");
    console.log("Write scope:");
    for (const filePath of writeScopePaths) {
      console.log(`- ${filePath}`);
    }
  }
}

function printWidgetBehaviorReport(report) {
  const summary = report.summary || {};
  const ok = (summary.errors || 0) === 0;
  console.log(ok ? "Widget behavior report passed." : "Widget behavior report found issues.");
  console.log(`Behaviors: ${summary.total_behaviors || 0} total, ${summary.realized || 0} realized, ${summary.partial || 0} partial, ${summary.declared || 0} declared`);
  console.log(`Checks: ${summary.errors || 0} error(s), ${summary.warnings || 0} warning(s)`);
  if (report.filters?.projection) {
    console.log(`Projection filter: ${report.filters.projection}`);
  }
  if (report.filters?.widget) {
    console.log(`Widget filter: ${report.filters.widget}`);
  }
  if ((summary.affected_projections || []).length > 0) {
    console.log(`Affected projections: ${summary.affected_projections.join(", ")}`);
  }
  if ((summary.affected_widgets || []).length > 0) {
    console.log(`Affected widgets: ${summary.affected_widgets.join(", ")}`);
  }
  if ((summary.affected_capabilities || []).length > 0) {
    console.log(`Affected capabilities: ${summary.affected_capabilities.join(", ")}`);
  }
  const highlights = report.highlights || [];
  if (highlights.length > 0) {
    console.log("");
    console.log("Behavior highlights:");
    for (const highlight of highlights) {
      const context = [
        highlight.projection ? `projection ${highlight.projection}` : null,
        highlight.widget ? `widget ${highlight.widget}` : null,
        highlight.screen ? `screen ${highlight.screen}` : null,
        highlight.region ? `region ${highlight.region}` : null,
        highlight.event ? `event ${highlight.event}` : null,
        highlight.capability ? `capability ${highlight.capability}` : null,
        highlight.behavior ? `behavior ${highlight.behavior}` : null
      ].filter(Boolean).join(", ");
      console.log(`- ${highlight.severity.toUpperCase()} ${highlight.code}${context ? ` (${context})` : ""}: ${highlight.message}`);
      if (highlight.suggested_fix) {
        console.log(`  Fix: ${highlight.suggested_fix}`);
      }
    }
  }
  const groupSummary = report.groups || {};
  console.log("");
  console.log(`Groups: ${(groupSummary.widgets || []).length} widget(s), ${(groupSummary.screens || []).length} screen(s), ${(groupSummary.capabilities || []).length} capability group(s), ${(groupSummary.effects || []).length} effect group(s)`);
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
 * @param {unknown} error
 * @returns {string}
 */
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} requested
 * @param {{ cwd?: string, push?: boolean, watch?: boolean }} [options]
 * @returns {{ ok: boolean, packageName: string, requestedVersion: string, requestedLatest: boolean, pushed: boolean, watched: boolean, consumers: Array<Record<string, any>>, diagnostics: Array<Record<string, any>>, errors: string[] }}
 */
function buildReleaseRollConsumersPayload(requested, options = {}) {
  const cwd = options.cwd || process.cwd();
  const push = options.push !== false;
  const watch = Boolean(options.watch);
  const requestedLatest = requested === "latest" || requested === "--latest";
  const diagnostics = [];
  if (watch && !push) {
    diagnostics.push({
      code: "release_roll_watch_requires_push",
      severity: "error",
      message: "`topogram release roll-consumers --watch` requires pushing consumer commits.",
      path: "release roll-consumers",
      suggestedFix: "Remove --no-push or run without --watch and verify consumer CI separately."
    });
    return {
      ok: false,
      packageName: CLI_PACKAGE_NAME,
      requestedVersion: requestedLatest ? "latest" : requested,
      requestedLatest,
      pushed: push,
      watched: watch,
      consumers: [],
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.message)
    };
  }
  const version = requestedLatest
    ? latestTopogramCliVersion(cwd)
    : requested;
  if (!isPackageVersion(version)) {
    throw new Error("topogram release roll-consumers requires <version> or --latest.");
  }
  const consumers = [];
  for (const consumer of discoverTopogramCliVersionConsumers(cwd)) {
    const workflow = expectedConsumerWorkflowName(consumer.name);
    const item = {
      name: consumer.name,
      root: consumer.root,
      workflow,
      updated: false,
      committed: false,
      pushed: false,
      commit: null,
      update: null,
      ci: null,
      diagnostics: []
    };
    consumers.push(item);
    if (!consumer.root || !fs.existsSync(consumer.root)) {
      item.diagnostics.push({
        code: "release_consumer_repo_missing",
        severity: "error",
        message: `First-party consumer repo ${consumer.name} was not found.`,
        path: consumer.path,
        suggestedFix: `Clone ${consumer.name} beside the topogram repo, then rerun roll-consumers.`
      });
      diagnostics.push(...item.diagnostics);
      continue;
    }
    const packagePath = path.join(consumer.root, "package.json");
    if (!fs.existsSync(packagePath)) {
      item.diagnostics.push({
        code: "release_consumer_package_missing",
        severity: "error",
        message: `First-party consumer repo ${consumer.name} does not contain package.json.`,
        path: packagePath,
        suggestedFix: "Only package-backed first-party consumers can be rolled by this command."
      });
      diagnostics.push(...item.diagnostics);
      continue;
    }
    const clean = inspectGitWorktreeClean(consumer.root);
    if (clean.ok !== true) {
      item.diagnostics.push({
        code: "release_consumer_worktree_dirty",
        severity: "error",
        message: clean.error || `First-party consumer repo ${consumer.name} has uncommitted changes.`,
        path: consumer.root,
        suggestedFix: "Commit, stash, or discard unrelated consumer changes before rolling the CLI version."
      });
      diagnostics.push(...item.diagnostics);
      continue;
    }
    try {
      item.update = buildPackageUpdateCliPayload(version, { cwd: consumer.root });
      item.updated = true;
    } catch (error) {
      item.diagnostics.push({
        code: "release_consumer_update_failed",
        severity: "error",
        message: `Failed to update ${consumer.name}: ${messageFromError(error)}`,
        path: consumer.root,
        suggestedFix: "Fix the consumer update/check failure, then rerun roll-consumers."
      });
      diagnostics.push(...item.diagnostics);
      continue;
    }
    const filesToStage = ["package.json", "package-lock.json", "topogram-cli.version"]
      .filter((file) => fs.existsSync(path.join(consumer.root, file)));
    const addResult = runGit(["add", ...filesToStage], consumer.root);
    if (addResult.status !== 0) {
      item.diagnostics.push(commandDiagnostic({
        code: "release_consumer_git_add_failed",
        severity: "error",
        message: `Failed to stage ${consumer.name} CLI update.`,
        path: consumer.root,
        suggestedFix: "Inspect git output, stage the changed files manually, then commit and push.",
        result: addResult
      }));
      diagnostics.push(...item.diagnostics);
      continue;
    }
    const staged = hasStagedGitChanges(consumer.root);
    if (!staged.ok) {
      item.diagnostics.push(commandDiagnostic({
        code: "release_consumer_git_diff_failed",
        severity: "error",
        message: `Could not inspect staged changes for ${consumer.name}.`,
        path: consumer.root,
        suggestedFix: "Inspect git status manually before committing.",
        result: staged.result
      }));
      diagnostics.push(...item.diagnostics);
      continue;
    }
    if (!staged.changed) {
      item.ci = watch
        ? waitForConsumerCi(consumer)
        : inspectConsumerCi(consumer, { strict: false });
      item.diagnostics.push(...item.ci.diagnostics);
      diagnostics.push(...item.ci.diagnostics);
      continue;
    }
    const commitResult = runGit(["commit", "-m", `Update Topogram CLI to ${version}`], consumer.root);
    if (commitResult.status !== 0) {
      item.diagnostics.push(commandDiagnostic({
        code: "release_consumer_git_commit_failed",
        severity: "error",
        message: `Failed to commit ${consumer.name} CLI update.`,
        path: consumer.root,
        suggestedFix: "Inspect git output, commit the consumer update manually, then push.",
        result: commitResult
      }));
      diagnostics.push(...item.diagnostics);
      continue;
    }
    item.committed = true;
    item.commit = currentGitHead(consumer.root);
    if (push) {
      const pushResult = runGit(["push", "origin", "main"], consumer.root);
      if (pushResult.status !== 0) {
        item.diagnostics.push(commandDiagnostic({
          code: "release_consumer_git_push_failed",
          severity: "error",
          message: `Failed to push ${consumer.name} CLI update.`,
          path: consumer.root,
          suggestedFix: "Push the consumer update manually, then confirm its verification workflow passes.",
          result: pushResult
        }));
        diagnostics.push(...item.diagnostics);
        continue;
      }
      item.pushed = true;
    }
    item.ci = watch
      ? waitForConsumerCi(consumer)
      : inspectConsumerCi(consumer, { strict: false });
    item.diagnostics.push(...item.ci.diagnostics);
    diagnostics.push(...item.ci.diagnostics);
  }
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    packageName: CLI_PACKAGE_NAME,
    requestedVersion: version,
    requestedLatest,
    pushed: push,
    watched: watch,
    consumers,
    diagnostics,
    errors
  };
}

/**
 * @param {ReturnType<typeof buildReleaseRollConsumersPayload>} payload
 * @returns {void}
 */
function printReleaseRollConsumers(payload) {
  console.log(payload.ok ? "Topogram consumer rollout completed." : "Topogram consumer rollout found issues.");
  if (payload.requestedLatest) {
    console.log(`Resolved latest version: ${payload.requestedVersion}`);
  }
  console.log(`Package: ${payload.packageName}@${payload.requestedVersion}`);
  console.log(`Push: ${payload.pushed ? "enabled" : "disabled"}`);
  console.log(`Watch: ${payload.watched ? "enabled" : "disabled"}`);
  for (const consumer of payload.consumers) {
    const state = consumer.committed
      ? consumer.pushed ? "pushed" : "committed"
      : consumer.updated ? "updated" : "skipped";
    console.log(`- ${consumer.name}: ${state}`);
    if (consumer.update) {
      console.log(`  Checks run: ${consumer.update.scriptsRun.join(", ") || "none"}`);
    }
    if (consumer.commit) {
      console.log(`  Commit: ${consumer.commit}`);
    }
    if (consumer.ci?.run?.url) {
      const run = consumer.ci.run;
      console.log(`  CI: ${run.workflowName || consumer.workflow} ${run.status || "unknown"}/${run.conclusion || "unknown"} ${run.url}`);
    } else if (consumer.workflow) {
      console.log(`  CI: ${consumer.workflow} not found`);
    }
    for (const diagnostic of consumer.diagnostics || []) {
      const label = diagnostic.severity === "error" ? "Error" : diagnostic.severity === "warning" ? "Warning" : "Note";
      console.log(`  ${label}: ${diagnostic.message}`);
    }
  }
}

/**
 * @param {{ cwd?: string, strict?: boolean }} [options]
 * @returns {{ ok: boolean, packageName: string, localVersion: string, latestVersion: string|null, currentPublished: boolean|null, git: { tag: string, local: boolean|null, remote: boolean|null, diagnostics: Array<Record<string, any>> }, consumerPins: ReturnType<typeof summarizeConsumerPins>, consumerCi: ReturnType<typeof summarizeConsumerCi>, consumers: Array<{ name: string, root: string|null, path: string, version: string|null, found: boolean, matchesLocal: boolean|null, workflow: string|null, ci: ReturnType<typeof inspectConsumerCi>|null }>, diagnostics: Array<Record<string, any>>, errors: string[] }}
 */
function buildReleaseStatusPayload(options = {}) {
  const cwd = options.cwd || process.cwd();
  const strict = Boolean(options.strict);
  const localVersion = readInstalledCliPackageVersion();
  const diagnostics = [];
  let latestVersion = null;
  try {
    latestVersion = latestTopogramCliVersion(cwd);
  } catch (error) {
    diagnostics.push({
      code: "release_latest_unavailable",
      severity: "warning",
      message: messageFromError(error),
      path: CLI_PACKAGE_NAME,
      suggestedFix: "Check npmjs access and rerun `topogram release status`."
    });
  }
  const git = inspectReleaseGitTag(localVersion, cwd);
  diagnostics.push(...git.diagnostics);
  const consumers = discoverTopogramCliVersionConsumers(cwd).map((consumer) => ({
    ...consumer,
    matchesLocal: consumer.version ? consumer.version === localVersion : null,
    workflow: expectedConsumerWorkflowName(consumer.name),
    ci: null
  }));
  if (strict) {
    for (const consumer of consumers) {
      if (consumer.matchesLocal === true) {
        consumer.ci = inspectConsumerCi(consumer, { strict: true });
        diagnostics.push(...consumer.ci.diagnostics);
      }
    }
  }
  const consumerPins = summarizeConsumerPins(consumers);
  const consumerCi = summarizeConsumerCi(consumers);
  const currentPublished = latestVersion ? latestVersion === localVersion : null;
  if (strict) {
    diagnostics.push(...releaseStatusStrictDiagnostics({
      localVersion,
      latestVersion,
      currentPublished,
      git,
      consumerPins,
      consumerCi
    }));
  }
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    strict,
    packageName: CLI_PACKAGE_NAME,
    localVersion,
    latestVersion,
    currentPublished,
    git,
    consumerPins,
    consumerCi,
    consumers,
    diagnostics,
    errors
  };
}

/**
 * @param {{
 *   localVersion: string,
 *   latestVersion: string|null,
 *   currentPublished: boolean|null,
 *   git: ReturnType<typeof inspectReleaseGitTag>,
 *   consumerPins: ReturnType<typeof summarizeConsumerPins>,
 *   consumerCi: ReturnType<typeof summarizeConsumerCi>
 * }} release
 * @returns {Array<{ code: string, severity: "error", message: string, path: string, suggestedFix: string }>}
 */
function releaseStatusStrictDiagnostics(release) {
  const diagnostics = [];
  if (release.currentPublished !== true) {
    diagnostics.push({
      code: "release_latest_not_current",
      severity: "error",
      message: release.latestVersion
        ? `${CLI_PACKAGE_NAME}@${release.localVersion} is not the latest published version (${release.latestVersion}).`
        : `Latest published ${CLI_PACKAGE_NAME} version could not be verified.`,
      path: CLI_PACKAGE_NAME,
      suggestedFix: "Publish the current CLI package version or fix npm package registry auth, then rerun `topogram release status --strict`."
    });
  }
  if (release.git.local !== true && release.git.remote !== true) {
    diagnostics.push({
      code: "release_local_tag_missing",
      severity: "error",
      message: `Release tag ${release.git.tag} is missing locally.`,
      path: release.git.tag,
      suggestedFix: `Fetch, create, or push ${release.git.tag} before treating this release as complete.`
    });
  }
  if (release.git.remote !== true) {
    diagnostics.push({
      code: "release_remote_tag_missing",
      severity: "error",
      message: `Release tag ${release.git.tag} is missing on origin.`,
      path: release.git.tag,
      suggestedFix: `Push or create the remote ${release.git.tag} tag before treating this release as complete.`
    });
  }
  if (release.consumerPins.allKnownPinned !== true) {
    diagnostics.push({
      code: "release_consumer_pins_not_current",
      severity: "error",
      message: `First-party consumers are not all pinned to ${CLI_PACKAGE_NAME}@${release.localVersion}.`,
      path: "topogram-cli.version",
      suggestedFix: "Roll first-party consumer repositories to the current CLI version before treating this release as complete."
    });
  }
  if (release.consumerCi.allCheckedAndPassing !== true) {
    diagnostics.push({
      code: "release_consumer_ci_not_current",
      severity: "error",
      message: "First-party consumer verification workflows are not all passing on the checked-out consumer commits.",
      path: "GitHub Actions",
      suggestedFix: "Wait for or fix the consumer verification workflows, then rerun `topogram release status --strict`."
    });
  }
  return diagnostics;
}

/**
 * @param {ReturnType<typeof buildReleaseStatusPayload>} payload
 * @returns {void}
 */
function printReleaseStatus(payload) {
  console.log(payload.ok ? "Topogram release status passed." : "Topogram release status found issues.");
  if (payload.strict) {
    console.log("Strict: enabled");
  }
  console.log(`Package: ${payload.packageName}`);
  console.log(`Local version: ${payload.localVersion}`);
  console.log(`Latest published: ${payload.latestVersion || "unknown"}${payload.currentPublished === true ? " (current)" : payload.currentPublished === false ? " (differs)" : ""}`);
  console.log(`Git tag: ${payload.git.tag} local=${labelBoolean(payload.git.local)} remote=${labelBoolean(payload.git.remote)}`);
  console.log(
    `Consumer pins: ${payload.consumerPins.pinned}/${payload.consumerPins.known} pinned, ` +
    `${payload.consumerPins.matching} matching, ${payload.consumerPins.differing} differing, ${payload.consumerPins.missing} missing`
  );
  if (payload.strict) {
    console.log(
      `Consumer CI: ${payload.consumerCi.passing}/${payload.consumerCi.checked} passing, ` +
      `${payload.consumerCi.failing} failing, ${payload.consumerCi.unavailable} unavailable, ${payload.consumerCi.skipped} skipped`
    );
  }
  for (const consumer of payload.consumers) {
    const status = consumer.matchesLocal === true
      ? "matches"
      : consumer.matchesLocal === false
        ? "differs"
        : "missing";
    const ciStatus = consumer.ci?.run
      ? `; ${consumer.ci.run.workflowName || consumer.workflow}: ${consumer.ci.run.status || "unknown"}/${consumer.ci.run.conclusion || "unknown"}`
      : consumer.ci?.checked
        ? `; ${consumer.workflow || "workflow"} unavailable`
        : "";
    console.log(`- ${consumer.name}: ${consumer.version || "missing"} (${status})${ciStatus}`);
    if (consumer.ci?.run?.url) {
      console.log(`  CI: ${consumer.ci.run.url}`);
    }
  }
  if (payload.diagnostics.length > 0) {
    console.log("Diagnostics:");
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning"
        ? "Warning"
        : diagnostic.severity === "info"
          ? "Note"
          : "Error";
      console.log(`- ${label}: ${diagnostic.message}`);
      if (diagnostic.suggestedFix) {
        console.log(`  Fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
}

/**
 * @param {ReturnType<typeof buildReleaseStatusPayload>} payload
 * @returns {string}
 */
function renderReleaseStatusMarkdown(payload) {
  const matrix = buildReleaseMatrixCatalogPayload();
  const catalogConsumer = payload.consumers.find((consumer) => consumer.name === "topograms");
  const demoConsumer = payload.consumers.find((consumer) => consumer.name === "topogram-demo-todo");
  const catalogSlug = catalogRepoSlug();
  const lines = [
    "# Known-Good Release Matrix",
    "",
    "This matrix is generated by `topogram release status --strict --write-report`.",
    `Date checked: ${new Date().toISOString().slice(0, 10)}.`,
    "Treat it as a dated release audit, not a floating compatibility promise.",
    "",
    "## Summary",
    "",
    `- Package: \`${payload.packageName}@${payload.localVersion}\``,
    `- Latest published: \`${payload.latestVersion || "unknown"}\`${payload.currentPublished === true ? " (current)" : payload.currentPublished === false ? " (differs)" : ""}`,
    `- Release tag: \`${payload.git.tag}\` (local=${labelBoolean(payload.git.local)}, remote=${labelBoolean(payload.git.remote)})`,
    `- Consumer pins: ${payload.consumerPins.matching}/${payload.consumerPins.known} matching`,
    `- Consumer CI: ${payload.consumerCi.passing}/${payload.consumerCi.checked} passing`,
    `- Strict status: ${payload.ok ? "passed" : "failed"}`,
    "",
    "## Core",
    "",
    "| Package or Repo | Version or Commit | Verification |",
    "| --- | --- | --- |",
    `| \`${payload.packageName}\` | \`${payload.localVersion}\` | Publish CLI Package, strict release status, fresh npmjs smoke, and installed CLI smoke passed |`,
    `| \`${catalogSlug}\` catalog | \`${releaseMatrixConsumerCommit(catalogConsumer)}\` | ${releaseMatrixConsumerVerification(catalogConsumer, "Catalog Verification", payload.localVersion)} |`,
    `| \`topogram-demo-todo\` | \`${releaseMatrixConsumerCommit(demoConsumer)}\` | ${releaseMatrixConsumerVerification(demoConsumer, "Demo Verification", payload.localVersion)} |`,
    "",
    "## Catalog Entries",
    "",
    "| Catalog ID | Kind | Package | Version | Stack |",
    "| --- | --- | --- | --- | --- |"
  ];
  if (matrix.entries.length > 0) {
    for (const entry of matrix.entries) {
      lines.push(`| \`${entry.id}\` | ${entry.kind} | \`${entry.package}\` | \`${entry.defaultVersion}\` | ${escapeMarkdownTableCell(entry.stack || "not declared")} |`);
    }
  } else {
    lines.push("| unavailable | unavailable | unavailable | unavailable | Catalog could not be loaded for this report |");
  }
  lines.push(
    "",
    "## Generator Packages",
    "",
    "| Generator Package | Surface | Catalog usage |",
    "| --- | --- | --- |"
  );
  if (matrix.generators.length > 0) {
    for (const generator of matrix.generators) {
      lines.push(`| \`${generator.package}\` | ${escapeMarkdownTableCell(generator.surface)} | ${escapeMarkdownTableCell(generator.catalogIds.join(", "))} |`);
    }
  } else {
    lines.push("| unavailable | unavailable | Catalog generator metadata could not be loaded for this report |");
  }
  lines.push(
    "",
    "## Consumers",
    "",
    "| Repo | Pin | Workflow | Status | Run |",
    "| --- | --- | --- | --- | --- |"
  );
  for (const consumer of payload.consumers) {
    const workflow = consumer.workflow || consumer.ci?.expectedWorkflow || "";
    const run = consumer.ci?.run;
    const status = run ? `${run.status || "unknown"}/${run.conclusion || "unknown"}` : consumer.ci?.checked ? "unavailable" : "not checked";
    const url = run?.url ? `[${run.databaseId || "run"}](${run.url})` : "";
    lines.push(`| \`${consumer.name}\` | \`${consumer.version || "missing"}\` | ${escapeMarkdownTableCell(workflow)} | ${escapeMarkdownTableCell(status)} | ${url} |`);
  }
  lines.push(
    "",
    "## Consumer Proofs",
    "",
    "The external Todo demo is the canonical end-to-end consumer proof for the current catalog-backed workflow:",
    "",
    "```bash",
    "topogram new ./todo-demo --template todo",
    "cd ./todo-demo",
    "npm install",
    "npm run check",
    "npm run generate",
    "npm run app:compile",
    "npm run verify",
    "npm run app:runtime",
    "```",
    "",
    "The demo CI also verifies `topogram new` from the default public catalog and from the repo-local catalog fixture. That prevents local fixtures from masking a broken published catalog alias."
  );
  const reportDiagnostics = [...matrix.diagnostics];
  if (reportDiagnostics.length > 0) {
    lines.push("", "## Report Diagnostics", "");
    for (const diagnostic of reportDiagnostics) {
      lines.push(`- **${diagnostic.severity || "warning"}** \`${diagnostic.code || "release_report_catalog_unavailable"}\`: ${diagnostic.message}`);
    }
  }
  if (payload.diagnostics.length > 0) {
    lines.push("", "## Diagnostics", "");
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning"
        ? "Warning"
        : diagnostic.severity === "info"
          ? "Note"
          : "Error";
      lines.push(`- **${label}** \`${diagnostic.code}\`: ${diagnostic.message}`);
      if (diagnostic.suggestedFix) {
        lines.push(`  Fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @returns {{ entries: any[], generators: Array<{ package: string, surface: string, catalogIds: string[] }>, diagnostics: Array<Record<string, any>> }}
 */
function buildReleaseMatrixCatalogPayload() {
  try {
    const loaded = loadCatalog(null);
    const entries = [...loaded.catalog.entries].sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "template" ? -1 : 1;
      }
      return left.id.localeCompare(right.id);
    });
    const generatorMap = new Map();
    for (const entry of entries) {
      for (const packageName of Array.isArray(entry.generators) ? entry.generators : []) {
        if (!generatorMap.has(packageName)) {
          generatorMap.set(packageName, {
            package: packageName,
            surface: releaseMatrixGeneratorSurface(packageName),
            catalogIds: []
          });
        }
        generatorMap.get(packageName).catalogIds.push(entry.id);
      }
    }
    const generators = [...generatorMap.values()].sort((left, right) => left.package.localeCompare(right.package));
    return {
      entries,
      generators,
      diagnostics: loaded.diagnostics || []
    };
  } catch (error) {
    return {
      entries: [],
      generators: [],
      diagnostics: [{
        code: "release_report_catalog_unavailable",
        severity: "warning",
        message: messageFromError(error)
      }]
    };
  }
}

/**
 * @param {string} packageName
 * @returns {string}
 */
function releaseMatrixGeneratorSurface(packageName) {
  if (packageName.includes("-web")) return "web";
  if (packageName.includes("-api")) return "api";
  if (packageName.includes("-db")) return "database";
  if (packageName.includes("-native")) return "native";
  return "not declared";
}

/**
 * @param {any} consumer
 * @returns {string}
 */
function releaseMatrixConsumerCommit(consumer) {
  return shortSha(consumer?.ci?.headSha || consumer?.ci?.run?.headSha || null) || "unknown";
}

/**
 * @param {any} consumer
 * @param {string} workflowName
 * @param {string} version
 * @returns {string}
 */
function releaseMatrixConsumerVerification(consumer, workflowName, version) {
  const status = consumer?.ci?.run
    ? `${consumer.ci.run.status || "unknown"}/${consumer.ci.run.conclusion || "unknown"}`
    : "not checked";
  return `${workflowName}: ${status}; pinned ${CLI_PACKAGE_NAME}@${version}`;
}

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function shortSha(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 7) : null;
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function escapeMarkdownTableCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

/**
 * @param {boolean|null} value
 * @returns {string}
 */
function labelBoolean(value) {
  return value === true ? "yes" : value === false ? "no" : "unknown";
}

/**
 * @param {string} version
 * @param {string} cwd
 * @returns {{ tag: string, local: boolean|null, remote: boolean|null, diagnostics: Array<Record<string, any>> }}
 */
function inspectReleaseGitTag(version, cwd) {
  const tag = `topogram-v${version}`;
  const diagnostics = [];
  let local = null;
  let remote = null;
  const localResult = childProcess.spawnSync("git", ["tag", "--list", tag], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: process.env.PATH || "" }
  });
  if (localResult.status === 0) {
    local = String(localResult.stdout || "").trim() === tag;
  } else {
    diagnostics.push({
      code: "release_local_tag_unavailable",
      severity: "warning",
      message: `Could not inspect local git tag ${tag}.`,
      path: cwd,
      suggestedFix: "Run from a git checkout with git available."
    });
  }
  const remoteResult = childProcess.spawnSync("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: process.env.PATH || "" }
  });
  if (remoteResult.status === 0) {
    remote = true;
  } else if (remoteResult.status === 2) {
    remote = false;
  } else {
    diagnostics.push({
      code: "release_remote_tag_unavailable",
      severity: "warning",
      message: `Could not inspect remote git tag ${tag}.`,
      path: cwd,
      suggestedFix: "Check git remote access, then rerun `topogram release status`."
    });
  }
  return { tag, local, remote, diagnostics };
}

/**
 * @param {string} name
 * @returns {string|null}
 */
function expectedConsumerWorkflowName(name) {
  return releaseConsumerWorkflowName(name);
}

/**
 * @param {string} name
 * @returns {string[]}
 */
function expectedConsumerWorkflowJobs(name) {
  return releaseConsumerWorkflowJobs(name);
}

/**
 * @param {{ name: string }|string} consumer
 * @returns {string}
 */
function consumerGithubRepoSlug(consumer) {
  const name = typeof consumer === "string" ? consumer : consumer.name;
  return githubRepoSlug(name);
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {ReturnType<typeof childProcess.spawnSync>}
 */
function runGit(args, cwd) {
  return childProcess.spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: process.env.PATH || "" }
  });
}

/**
 * @param {string} cwd
 * @returns {{ ok: boolean, dirty: boolean|null, error: string|null }}
 */
function inspectGitWorktreeClean(cwd) {
  const result = runGit(["status", "--porcelain"], cwd);
  if (result.status !== 0) {
    return {
      ok: false,
      dirty: null,
      error: `Could not inspect git status: ${commandOutput(result) || "unknown error"}`
    };
  }
  const dirty = String(result.stdout || "").trim().length > 0;
  return {
    ok: !dirty,
    dirty,
    error: dirty ? "Consumer repo has uncommitted changes." : null
  };
}

/**
 * @param {string} cwd
 * @returns {{ ok: boolean, changed: boolean, result: ReturnType<typeof childProcess.spawnSync> }}
 */
function hasStagedGitChanges(cwd) {
  const result = runGit(["diff", "--cached", "--quiet"], cwd);
  return {
    ok: result.status === 0 || result.status === 1,
    changed: result.status === 1,
    result
  };
}

/**
 * @param {string} cwd
 * @returns {string|null}
 */
function currentGitHead(cwd) {
  const result = runGit(["rev-parse", "HEAD"], cwd);
  return result.status === 0 ? String(result.stdout || "").trim() || null : null;
}

/**
 * @param {{ code: string, severity: "error"|"warning", message: string, path: string|null, suggestedFix: string, result: ReturnType<typeof childProcess.spawnSync> }} input
 * @returns {{ code: string, severity: "error"|"warning", message: string, path: string|null, suggestedFix: string }}
 */
function commandDiagnostic(input) {
  const output = commandOutput(input.result);
  return {
    code: input.code,
    severity: input.severity,
    message: output ? `${input.message}\n${output}` : input.message,
    path: input.path,
    suggestedFix: input.suggestedFix
  };
}

/**
 * @param {ReturnType<typeof childProcess.spawnSync>} result
 * @returns {string}
 */
function commandOutput(result) {
  return [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
}

/**
 * @param {number} ms
 * @returns {void}
 */
function sleepSync(ms) {
  if (ms <= 0) {
    return;
  }
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}

/**
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function positiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * @param {{ name: string, root?: string|null, workflow?: string|null }} consumer
 * @param {{ timeoutMs?: number, intervalMs?: number }} [options]
 * @returns {ReturnType<typeof inspectConsumerCi>}
 */
function waitForConsumerCi(consumer, options = {}) {
  const timeoutMs = options.timeoutMs || positiveIntegerEnv("TOPOGRAM_RELEASE_WATCH_TIMEOUT_MS", 20 * 60 * 1000);
  const intervalMs = options.intervalMs || positiveIntegerEnv("TOPOGRAM_RELEASE_WATCH_INTERVAL_MS", 5000);
  const startedAt = Date.now();
  let latest = inspectConsumerCi(consumer, { strict: false });
  while (true) {
    const currentRun = latest.run &&
      latest.headSha &&
      latest.run.headSha &&
      latest.run.headSha === latest.headSha;
    if (currentRun && latest.run.status === "completed") {
      return inspectConsumerCi(consumer, { strict: true });
    }
    if (Date.now() - startedAt >= timeoutMs) {
      const strictLatest = inspectConsumerCi(consumer, { strict: true });
      strictLatest.diagnostics.push({
        code: "release_consumer_ci_watch_timeout",
        severity: "error",
        message: `${consumer.name} verification workflow did not complete on the current commit before the watch timeout.`,
        path: strictLatest.run?.url || consumerGithubRepoSlug(consumer),
        suggestedFix: "Open the consumer workflow, fix failures if needed, then rerun release status."
      });
      strictLatest.ok = false;
      return strictLatest;
    }
    sleepSync(intervalMs);
    latest = inspectConsumerCi(consumer, { strict: false });
  }
}

/**
 * @param {{ name: string, root?: string|null, workflow?: string|null }} consumer
 * @param {{ strict?: boolean }} [options]
 * @returns {{ checked: boolean, ok: boolean|null, expectedWorkflow: string|null, expectedJobs: string[], headSha: string|null, run: { databaseId?: number, workflowName?: string, status?: string, conclusion?: string, headSha?: string, url?: string, jobs?: Array<Record<string, any>> }|null, diagnostics: Array<Record<string, any>> }}
 */
function inspectConsumerCi(consumer, options = {}) {
  const diagnostics = [];
  const expectedWorkflow = consumer.workflow || expectedConsumerWorkflowName(consumer.name);
  const expectedJobs = expectedConsumerWorkflowJobs(consumer.name);
  const repoSlug = consumerGithubRepoSlug(consumer);
  if (!consumer.root || !fs.existsSync(consumer.root)) {
    return {
      checked: false,
      ok: null,
      expectedWorkflow,
      expectedJobs,
      headSha: null,
      run: null,
      diagnostics: []
    };
  }
  const headSha = currentGitHead(consumer.root);
  if (!headSha) {
    diagnostics.push({
      code: "release_consumer_head_unavailable",
      severity: options.strict ? "error" : "warning",
      message: `Could not inspect local HEAD for ${consumer.name}.`,
      path: consumer.root,
      suggestedFix: "Run from a checked-out consumer git repository."
    });
  }
  if (!expectedWorkflow) {
    diagnostics.push({
      code: "release_consumer_workflow_unknown",
      severity: options.strict ? "error" : "warning",
      message: `No expected verification workflow is configured for ${consumer.name}.`,
      path: consumer.name,
      suggestedFix: "Add the consumer repo to topogram.config.json release.workflows or the built-in release workflow defaults."
    });
    return {
      checked: true,
      ok: false,
      expectedWorkflow,
      expectedJobs,
      headSha,
      run: null,
      diagnostics
    };
  }
  let run = null;
  try {
    run = latestWorkflowRun({
      repoSlug,
      branch: "main",
      workflowName: expectedWorkflow,
      cwd: consumer.root
    });
  } catch (error) {
    diagnostics.push({
      code: "release_consumer_ci_unavailable",
      severity: options.strict ? "error" : "warning",
      message: [`Could not inspect ${expectedWorkflow} for ${consumer.name}.`, messageFromError(error)].filter(Boolean).join("\n"),
      path: repoSlug,
      suggestedFix: "Set GITHUB_TOKEN or GH_TOKEN with Actions read access, or run `gh auth login` for local fallback; then rerun release status."
    });
    return {
      checked: true,
      ok: false,
      expectedWorkflow,
      expectedJobs,
      headSha,
      run: null,
      diagnostics
    };
  }
  if (!run) {
    diagnostics.push({
      code: "release_consumer_ci_missing",
      severity: options.strict ? "error" : "warning",
      message: `${consumer.name} has no ${expectedWorkflow} run on main.`,
      path: repoSlug,
      suggestedFix: "Push the consumer repo and wait for its verification workflow."
    });
    return {
      checked: true,
      ok: false,
      expectedWorkflow,
      expectedJobs,
      headSha,
      run: null,
      diagnostics
    };
  }
  if (headSha && run.headSha && run.headSha !== headSha) {
    diagnostics.push({
      code: "release_consumer_ci_head_mismatch",
      severity: options.strict ? "error" : "warning",
      message: `${consumer.name} latest ${expectedWorkflow} run is for ${run.headSha}, not checked-out HEAD ${headSha}.`,
      path: run.url || repoSlug,
      suggestedFix: "Wait for the verification workflow on the current consumer commit, then rerun release status."
    });
  }
  if (run.status !== "completed" || run.conclusion !== "success") {
    diagnostics.push({
      code: "release_consumer_ci_not_successful",
      severity: options.strict ? "error" : "warning",
      message: `${consumer.name} ${expectedWorkflow} is ${run.status || "unknown"}/${run.conclusion || "unknown"}.`,
      path: run.url || repoSlug,
      suggestedFix: "Wait for or fix the consumer verification workflow, then rerun release status."
    });
  }
  if (expectedJobs.length > 0 && run.databaseId) {
    const jobResult = inspectConsumerWorkflowJobs(consumer, run.databaseId, expectedJobs, options);
    if (jobResult.jobs) {
      run.jobs = jobResult.jobs;
    }
    diagnostics.push(...jobResult.diagnostics);
  } else if (expectedJobs.length > 0) {
    diagnostics.push({
      code: "release_consumer_ci_jobs_unavailable",
      severity: options.strict ? "error" : "warning",
      message: `${consumer.name} ${expectedWorkflow} run did not include a database id, so expected jobs could not be inspected.`,
      path: run.url || repoSlug,
      suggestedFix: "Rerun release status after GitHub exposes the workflow run id."
    });
  }
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  return {
    checked: true,
    ok: errorCount === 0 &&
      (!options.strict || (run.status === "completed" && run.conclusion === "success" && (!headSha || !run.headSha || run.headSha === headSha))),
    expectedWorkflow,
    expectedJobs,
    headSha,
    run,
    diagnostics
  };
}

/**
 * @param {{ name: string, root?: string|null }} consumer
 * @param {number|string} runId
 * @param {string[]} expectedJobs
 * @param {{ strict?: boolean }} [options]
 * @returns {{ jobs: Array<Record<string, any>>|null, diagnostics: Array<Record<string, any>> }}
 */
function inspectConsumerWorkflowJobs(consumer, runId, expectedJobs, options = {}) {
  const diagnostics = [];
  const repoSlug = consumerGithubRepoSlug(consumer);
  let jobs = [];
  try {
    jobs = workflowRunJobs({
      repoSlug,
      runId,
      cwd: consumer.root || process.cwd()
    });
  } catch (error) {
    diagnostics.push({
      code: "release_consumer_ci_jobs_unavailable",
      severity: options.strict ? "error" : "warning",
      message: [`Could not inspect expected jobs for ${consumer.name}.`, messageFromError(error)].filter(Boolean).join("\n"),
      path: repoSlug,
      suggestedFix: "Set GITHUB_TOKEN or GH_TOKEN with Actions read access, or run `gh auth login` for local fallback; then rerun release status."
    });
    return { jobs: null, diagnostics };
  }
  for (const expectedJob of expectedJobs) {
    const job = jobs.find((candidate) => candidate?.name === expectedJob);
    if (!job) {
      diagnostics.push({
        code: "release_consumer_ci_job_missing",
        severity: options.strict ? "error" : "warning",
        message: `${consumer.name} workflow is missing expected job '${expectedJob}'.`,
        path: repoSlug,
        suggestedFix: "Update the consumer workflow or the release-status expected job list, then rerun release status."
      });
      continue;
    }
    if (job.status !== "completed" || job.conclusion !== "success") {
      diagnostics.push({
        code: "release_consumer_ci_job_not_successful",
        severity: options.strict ? "error" : "warning",
        message: `${consumer.name} job '${expectedJob}' is ${job.status || "unknown"}/${job.conclusion || "unknown"}.`,
        path: job.url || repoSlug,
        suggestedFix: "Wait for or fix the expected workflow job, then rerun release status."
      });
    }
  }
  return { jobs, diagnostics };
}

/**
 * @param {string} cwd
 * @returns {Array<{ name: string, root: string|null, path: string, version: string|null, found: boolean }>}
 */
function discoverTopogramCliVersionConsumers(cwd) {
  const roots = [];
  for (const root of [cwd, REPO_ROOT, path.dirname(REPO_ROOT)]) {
    const resolved = path.resolve(root);
    if (!roots.includes(resolved)) {
      roots.push(resolved);
    }
  }
  const consumers = [];
  for (const name of releaseConsumerRepos(cwd)) {
    let found = null;
    for (const root of roots) {
      const consumerRoot = path.join(root, name);
      const versionPath = path.join(consumerRoot, "topogram-cli.version");
      if (fs.existsSync(consumerRoot) && !fs.existsSync(versionPath)) {
        found = {
          name,
          root: consumerRoot,
          path: versionPath,
          version: null,
          found: false
        };
        break;
      }
      if (!fs.existsSync(versionPath)) {
        continue;
      }
      found = {
        name,
        root: consumerRoot,
        path: versionPath,
        version: fs.readFileSync(versionPath, "utf8").trim() || null,
        found: true
      };
      break;
    }
    consumers.push(found || {
      name,
      root: null,
      path: path.join(roots[0], name, "topogram-cli.version"),
      version: null,
      found: false
    });
  }
  return consumers;
}

/**
 * @param {Array<{ name: string, version: string|null, found: boolean, matchesLocal: boolean|null }>} consumers
 * @returns {{ known: number, pinned: number, matching: number, differing: number, missing: number, allKnownPinned: boolean, matchingNames: string[], differingNames: string[], missingNames: string[] }}
 */
function summarizeConsumerPins(consumers) {
  const matchingNames = consumers.filter((consumer) => consumer.matchesLocal === true).map((consumer) => consumer.name);
  const differingNames = consumers.filter((consumer) => consumer.matchesLocal === false).map((consumer) => consumer.name);
  const missingNames = consumers.filter((consumer) => !consumer.found || !consumer.version).map((consumer) => consumer.name);
  return {
    known: consumers.length,
    pinned: consumers.filter((consumer) => consumer.found && consumer.version).length,
    matching: matchingNames.length,
    differing: differingNames.length,
    missing: missingNames.length,
    allKnownPinned: consumers.length > 0 && differingNames.length === 0 && missingNames.length === 0,
    matchingNames,
    differingNames,
    missingNames
  };
}

/**
 * @param {Array<{ name: string, matchesLocal?: boolean|null, ci?: ReturnType<typeof inspectConsumerCi>|null }>} consumers
 * @returns {{ checked: number, passing: number, failing: number, unavailable: number, skipped: number, allCheckedAndPassing: boolean, passingNames: string[], failingNames: string[], unavailableNames: string[], skippedNames: string[] }}
 */
function summarizeConsumerCi(consumers) {
  const checked = consumers.filter((consumer) => consumer.ci?.checked);
  const passingNames = checked.filter((consumer) => consumer.ci?.ok === true).map((consumer) => consumer.name);
  const failingNames = checked.filter((consumer) => consumer.ci?.ok === false && consumer.ci?.run).map((consumer) => consumer.name);
  const unavailableNames = checked.filter((consumer) => consumer.ci?.ok === false && !consumer.ci?.run).map((consumer) => consumer.name);
  const skippedNames = consumers.filter((consumer) => !consumer.ci?.checked).map((consumer) => consumer.name);
  return {
    checked: checked.length,
    passing: passingNames.length,
    failing: failingNames.length,
    unavailable: unavailableNames.length,
    skipped: skippedNames.length,
    allCheckedAndPassing: consumers.length > 0 && checked.length === consumers.length && failingNames.length === 0 && unavailableNames.length === 0,
    passingNames,
    failingNames,
    unavailableNames,
    skippedNames
  };
}

/**
 * @param {ReturnType<typeof createNewProject>} result
 * @param {string} cwd
 * @returns {string}
 */
function displayProjectRootForNewProject(result, cwd) {
  const relativeProjectRoot = path.relative(cwd, result.projectRoot);
  return !relativeProjectRoot || relativeProjectRoot.startsWith("..")
    ? result.projectRoot
    : relativeProjectRoot;
}

/**
 * @param {ReturnType<typeof createNewProject>} result
 * @param {string} cwd
 * @returns {void}
 */
function printNewProjectResult(result, cwd) {
  const template = result.template || {};
  console.log(`Created Topogram project at ${result.projectRoot}.`);
  console.log(`Template: ${result.templateName}`);
  console.log(`Source: ${template.source || "unknown"}`);
  if (template.sourceSpec) {
    console.log(`Source spec: ${template.sourceSpec}`);
  }
  if (template.catalog) {
    console.log(`Catalog: ${template.catalog.id} from ${template.catalog.source}`);
    console.log(`Package: ${template.catalog.packageSpec}`);
  }
  console.log(`Executable implementation: ${template.includesExecutableImplementation ? "yes" : "no"}`);
  console.log("Policy: topogram.template-policy.json");
  console.log(`Generator policy: ${GENERATOR_POLICY_FILE}`);
  console.log("Template files: .topogram-template-files.json");
  if (template.includesExecutableImplementation) {
    console.log("Trust: .topogram-template-trust.json");
  }
  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${displayProjectRootForNewProject(result, cwd)}`);
  console.log("  npm install");
  console.log("  npm run agent:brief");
  console.log("  npm run doctor");
  console.log("  npm run source:status");
  console.log("  npm run template:explain");
  console.log("  npm run check");
  console.log("  npm run generator:policy:status");
  console.log("  npm run generator:policy:check");
  if (template.includesExecutableImplementation) {
    console.log("  npm run template:policy:explain");
    console.log("  npm run trust:status");
  }
  console.log("  npm run generate");
  console.log("  npm run verify");
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

function generatorTargetsForWorkflowContext({
  graph,
  taskModeArtifact,
  sliceArtifact = null,
  diffArtifact = null,
  maintainedBoundaryArtifact = null
} = {}) {
  if (!graph || !taskModeArtifact) {
    return [];
  }
  return buildChangePlanPayload({
    graph,
    taskModeArtifact,
    sliceArtifact,
    diffArtifact,
    maintainedBoundaryArtifact
  }).generator_targets || [];
}

function importAdoptOnlyRequested({
  modeId,
  capabilityId,
  workflowId,
  projectionId,
  componentId,
  entityId,
  journeyId,
  surfaceId,
  domainId,
  fromTopogramPath
} = {}) {
  return modeId === "import-adopt" && !(
    capabilityId ||
    workflowId ||
    projectionId ||
    componentId ||
    entityId ||
    journeyId ||
    surfaceId ||
    domainId ||
    fromTopogramPath
  );
}

const args = process.argv.slice(2);
if (args.includes("--allow-local-npmrc") && !process.env[LOCAL_NPMRC_ENV]) {
  process.env[LOCAL_NPMRC_ENV] = "1";
}
if (args[0] === "help" && args[1] && args[1] !== "all" && printCommandHelp(args[1])) {
  process.exit(0);
}

if (args[0] !== "version" && (args.includes("--help") || args.includes("-h")) && printCommandHelp(args[0])) {
  process.exit(0);
}

if (args.length === 0 || (args[0] !== "version" && args.includes("--help")) || args.includes("-h") || args[0] === "help") {
  printUsage({ all: args[1] === "all" || args.includes("--all") });
  process.exit(args.length === 0 ? 1 : 0);
}

if (args[0] === "help-all") {
  printUsage({ all: true });
  process.exit(0);
}

const setupExitCode = handleSetupCommand(args);
if (setupExitCode !== null) {
  process.exit(setupExitCode);
}

const RENAMED_CLI_ARGS = new Map([
  ["--component", "--widget"]
]);
const RENAMED_GENERATE_TARGETS = new Map([
  ["ui-component-contract", "ui-widget-contract"],
  ["component-conformance-report", "widget-conformance-report"],
  ["component-behavior-report", "widget-behavior-report"],
  ["ui-web-contract", "ui-surface-contract"],
  ["ui-web-debug", "ui-surface-debug"]
]);

if (args[0] === "component") {
  console.error("Command 'topogram component' was renamed to 'topogram widget'.");
  process.exit(1);
}

for (const [oldArg, newArg] of RENAMED_CLI_ARGS) {
  if (args.includes(oldArg)) {
    console.error(`CLI flag '${oldArg}' was renamed to '${newArg}'.`);
    process.exit(1);
  }
}

function commandPath(index, fallback = "./topogram") {
  const value = args[index];
  return value && !value.startsWith("-") ? value : fallback;
}

const removedGenerateIndex = args.indexOf("--generate");
if (removedGenerateIndex >= 0) {
  const target = args[removedGenerateIndex + 1];
  const input = args[0] === "generate" ? commandPath(1) : commandPath(0);
  const replacement = target && !target.startsWith("-")
    ? `topogram emit ${target} ${input}`
    : "topogram emit <target> <path>";
  console.error(`The artifact flag '--generate' was removed. Use '${replacement}' instead.`);
  process.exit(1);
}

function commandOperandFrom(index, fallback = ".") {
  const valueFlags = new Set([
    "--accept-current",
    "--accept-candidate",
    "--delete-current",
    "--from",
    "--out",
    "--out-dir",
    "--reason",
    "--template",
    "--version"
  ]);
  for (let i = index; i < args.length; i += 1) {
    const value = args[i];
    if (!value) {
      continue;
    }
    if (!value.startsWith("-")) {
      return value;
    }
    if (valueFlags.has(value)) {
      i += 1;
    }
  }
  return fallback;
}

let commandArgs = null;
let inputPath = args[0];
commandArgs = parseSplitCommandArgs(args);
if (commandArgs) {
  // Parsed by split command modules.
} else if (args[0] === "release" && args[1] === "status") {
  commandArgs = { releaseStatus: true, inputPath: null };
} else if (args[0] === "release" && args[1] === "roll-consumers") {
  commandArgs = { releaseRollConsumers: true, releaseRollVersion: args[2], inputPath: null };
} else if (args[0] === "new" || args[0] === "create") {
  commandArgs = args.includes("--list-templates")
    ? { templateList: true, inputPath: null }
    : { newProject: true, inputPath: args[1] };
} else if (args[0] === "check") {
  commandArgs = { check: true, inputPath: commandPath(1) };
} else if (args[0] === "widget" && args[1] === "check") {
  commandArgs = { componentCheck: true, inputPath: commandPath(2) };
} else if (args[0] === "widget" && args[1] === "behavior") {
  commandArgs = { componentBehavior: true, inputPath: commandPath(2) };
} else if (args[0] === "widget") {
  printWidgetHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "agent" && args[1] === "brief") {
  commandArgs = { agentBrief: true, inputPath: commandPath(2) };
} else if (args[0] === "agent") {
  printAgentHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "generator" && args[1] === "list") {
  commandArgs = { generatorList: true, inputPath: null };
} else if (args[0] === "generator" && args[1] === "show") {
  commandArgs = { generatorShow: true, inputPath: args[2] };
} else if (args[0] === "generator" && args[1] === "check") {
  commandArgs = { generatorCheck: true, inputPath: args[2] };
} else if (args[0] === "generator" && args[1] === "policy" && args[2] === "init") {
  commandArgs = { generatorPolicyInit: true, inputPath: commandPath(3) };
} else if (args[0] === "generator" && args[1] === "policy" && args[2] === "status") {
  commandArgs = { generatorPolicyStatus: true, inputPath: commandPath(3) };
} else if (args[0] === "generator" && args[1] === "policy" && args[2] === "check") {
  commandArgs = { generatorPolicyCheck: true, inputPath: commandPath(3) };
} else if (args[0] === "generator" && args[1] === "policy" && args[2] === "explain") {
  commandArgs = { generatorPolicyExplain: true, inputPath: commandPath(3) };
} else if (args[0] === "generator" && args[1] === "policy" && args[2] === "pin") {
  commandArgs = { generatorPolicyPin: true, generatorPolicyPinSpec: args[3] && !args[3].startsWith("-") ? args[3] : null, inputPath: commandPath(4) };
} else if (args[0] === "generator") {
  printGeneratorHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "emit") {
  if (!args[1] || args[1].startsWith("-")) {
    printEmitHelp();
    process.exit(1);
  }
  commandArgs = { generateTarget: args[1], inputPath: commandPath(2), emitArtifact: true };
} else if (args[0] === "validate") {
  commandArgs = { validate: true, inputPath: args[1] };
} else if (args[0] === "generate" && args[1] === "app") {
  commandArgs = { generateTarget: "app-bundle", write: true, inputPath: commandPath(2), defaultOutDir: "./app" };
} else if (args[0] === "generate" && args[1] !== "journeys") {
  commandArgs = { generateTarget: "app-bundle", write: true, inputPath: commandPath(1), defaultOutDir: "./app" };
} else if (args[0] === "catalog" && args[1] === "list") {
  commandArgs = { catalogList: true, inputPath: args[2] && !args[2].startsWith("-") ? args[2] : null };
} else if (args[0] === "catalog" && args[1] === "show") {
  commandArgs = { catalogShow: true, inputPath: args[2] };
} else if (args[0] === "catalog" && args[1] === "doctor") {
  commandArgs = { catalogDoctor: true, inputPath: args[2] && !args[2].startsWith("-") ? args[2] : null };
} else if (args[0] === "catalog" && args[1] === "check") {
  commandArgs = { catalogCheck: true, inputPath: args[2] };
} else if (args[0] === "catalog" && args[1] === "copy") {
  commandArgs = { catalogCopy: true, catalogId: args[2], inputPath: args[3] };
} else if (args[0] === "package" && args[1] === "update-cli") {
  commandArgs = { packageUpdateCli: true, inputPath: args.includes("--latest") ? "latest" : args[2] };
} else if (args[0] === "template" && args[1] === "list") {
  commandArgs = { templateList: true, inputPath: null };
} else if (args[0] === "template" && args[1] === "show") {
  commandArgs = { templateShow: true, inputPath: args[2] };
} else if (args[0] === "template" && args[1] === "explain") {
  commandArgs = { templateExplain: true, inputPath: commandPath(2, ".") };
} else if (args[0] === "template" && args[1] === "status") {
  commandArgs = { templateStatus: true, inputPath: commandPath(2) };
} else if (args[0] === "template" && args[1] === "detach") {
  commandArgs = { templateDetach: true, inputPath: commandPath(2, ".") };
} else if (args[0] === "template" && args[1] === "policy" && args[2] === "init") {
  commandArgs = { templatePolicyInit: true, inputPath: commandPath(3) };
} else if (args[0] === "template" && args[1] === "policy" && args[2] === "check") {
  commandArgs = { templatePolicyCheck: true, inputPath: commandPath(3) };
} else if (args[0] === "template" && args[1] === "policy" && args[2] === "explain") {
  commandArgs = { templatePolicyExplain: true, inputPath: commandPath(3) };
} else if (args[0] === "template" && args[1] === "policy" && args[2] === "pin") {
  commandArgs = { templatePolicyPin: true, templatePolicyPinSpec: args[3] && !args[3].startsWith("-") ? args[3] : null, inputPath: commandPath(4) };
} else if (args[0] === "template" && args[1] === "check") {
  commandArgs = { templateCheck: true, inputPath: args[2] };
} else if (args[0] === "template" && args[1] === "update") {
  commandArgs = { templateUpdate: true, inputPath: commandPath(2) };
} else if (args[0] === "import" && args[1] === "diff") {
  commandArgs = { importDiff: true, inputPath: commandOperandFrom(2, ".") };
} else if (args[0] === "import" && args[1] === "refresh") {
  commandArgs = { importRefresh: true, inputPath: commandOperandFrom(2, ".") };
} else if (args[0] === "import" && args[1] === "check") {
  commandArgs = { importCheck: true, inputPath: commandPath(2, ".") };
} else if (args[0] === "import" && args[1] === "plan") {
  commandArgs = { importPlan: true, inputPath: commandPath(2, ".") };
} else if (args[0] === "import" && args[1] === "adopt" && (args[2] === "--list" || args[2] === "list")) {
  commandArgs = { importAdoptList: true, inputPath: commandPath(3, ".") };
} else if (args[0] === "import" && args[1] === "adopt") {
  commandArgs = { importAdopt: true, importAdoptSelector: args[2], inputPath: commandPath(3, ".") };
} else if (args[0] === "import" && args[1] === "status") {
  commandArgs = { importStatus: true, inputPath: commandPath(2, ".") };
} else if (args[0] === "import" && args[1] === "history") {
  commandArgs = { importHistory: true, inputPath: commandOperandFrom(2, ".") };
} else if (args[0] === "import" && args[1] === "app") {
  commandArgs = { workflowName: "import-app", inputPath: args[2] };
} else if (args[0] === "import" && args[1] === "docs") {
  commandArgs = { workflowName: "scan-docs", inputPath: args[2] };
} else if (args[0] === "import" && args[1] && !args[1].startsWith("-")) {
  commandArgs = { importWorkspace: true, inputPath: args[1] };
} else if (args[0] === "import") {
  printImportHelp();
  process.exit(args[1] ? 1 : 0);
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
} else if (args[0] === "query" && args[1] === "domain-coverage") {
  commandArgs = { queryName: "domain-coverage", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "domain-list") {
  commandArgs = { queryName: "domain-list", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "review-boundary") {
  commandArgs = { queryName: "review-boundary", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "write-scope") {
  commandArgs = { queryName: "write-scope", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "verification-targets") {
  commandArgs = { queryName: "verification-targets", inputPath: args[2] };
} else if (args[0] === "query" && args[1] === "widget-behavior") {
  commandArgs = { queryName: "widget-behavior", inputPath: commandPath(2) };
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
} else if (args[0] === "query") {
  printQueryHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "sdlc" && args[1] === "transition") {
  const sdlcInput = args[4] && !args[4].startsWith("--") ? args[4] : ".";
  commandArgs = { sdlcCommand: "transition", inputPath: sdlcInput, sdlcId: args[2], sdlcTargetStatus: args[3] };
} else if (args[0] === "sdlc" && args[1] === "check") {
  commandArgs = { sdlcCommand: "check", inputPath: args[2] || "." };
} else if (args[0] === "sdlc" && args[1] === "explain") {
  const sdlcInput = args[3] && !args[3].startsWith("--") ? args[3] : ".";
  commandArgs = { sdlcCommand: "explain", sdlcId: args[2], inputPath: sdlcInput };
} else if (args[0] === "sdlc" && args[1] === "archive") {
  commandArgs = { sdlcCommand: "archive", inputPath: args[2] || "." };
} else if (args[0] === "sdlc" && args[1] === "unarchive") {
  commandArgs = { sdlcCommand: "unarchive", sdlcId: args[2], inputPath: args[3] || "." };
} else if (args[0] === "sdlc" && args[1] === "compact") {
  commandArgs = { sdlcCommand: "compact", sdlcArchiveFile: args[2] };
} else if (args[0] === "sdlc" && args[1] === "new") {
  commandArgs = { sdlcCommand: "new", sdlcNewKind: args[2], sdlcNewSlug: args[3], inputPath: args[4] || "." };
} else if (args[0] === "sdlc" && args[1] === "adopt") {
  commandArgs = { sdlcCommand: "adopt", inputPath: args[2] || "." };
} else if (args[0] === "release") {
  commandArgs = { sdlcCommand: "release", inputPath: args[1] || "." };
}
if (commandArgs && Object.prototype.hasOwnProperty.call(commandArgs, "inputPath")) {
  inputPath = commandArgs.inputPath;
}
const emitJson = args.includes("--json");
const strictReleaseStatus = args.includes("--strict");
const shouldPushReleaseConsumers = !args.includes("--no-push");
const shouldWatchReleaseConsumers = args.includes("--watch");
const shouldPrintReleaseMarkdown = args.includes("--markdown");
const releaseReportIndex = args.indexOf("--write-report");
const releaseReportPath = releaseReportIndex >= 0 &&
  args[releaseReportIndex + 1] &&
  !args[releaseReportIndex + 1].startsWith("-")
  ? args[releaseReportIndex + 1]
  : null;
const shouldVersion = Boolean(commandArgs?.version);
const shouldDoctor = Boolean(commandArgs?.doctor);
const shouldReleaseStatus = Boolean(commandArgs?.releaseStatus);
const shouldReleaseRollConsumers = Boolean(commandArgs?.releaseRollConsumers);
const shouldCheck = Boolean(commandArgs?.check);
const shouldComponentCheck = Boolean(commandArgs?.componentCheck);
const shouldComponentBehavior = Boolean(commandArgs?.componentBehavior);
const shouldAgentBrief = Boolean(commandArgs?.agentBrief);
const shouldGeneratorList = Boolean(commandArgs?.generatorList);
const shouldGeneratorShow = Boolean(commandArgs?.generatorShow);
const shouldGeneratorCheck = Boolean(commandArgs?.generatorCheck);
const shouldGeneratorPolicyInit = Boolean(commandArgs?.generatorPolicyInit);
const shouldGeneratorPolicyStatus = Boolean(commandArgs?.generatorPolicyStatus);
const shouldGeneratorPolicyCheck = Boolean(commandArgs?.generatorPolicyCheck);
const shouldGeneratorPolicyExplain = Boolean(commandArgs?.generatorPolicyExplain);
const shouldGeneratorPolicyPin = Boolean(commandArgs?.generatorPolicyPin);
const shouldTrustTemplate = Boolean(commandArgs?.trustTemplate);
const shouldTrustStatus = Boolean(commandArgs?.trustStatus);
const shouldTrustDiff = Boolean(commandArgs?.trustDiff);
const shouldForce = Boolean(commandArgs?.force) || args.includes("--force");
const shouldCatalogList = Boolean(commandArgs?.catalogList);
const shouldCatalogShow = Boolean(commandArgs?.catalogShow);
const shouldCatalogDoctor = Boolean(commandArgs?.catalogDoctor);
const shouldCatalogCheck = Boolean(commandArgs?.catalogCheck);
const shouldCatalogCopy = Boolean(commandArgs?.catalogCopy);
const shouldPackageUpdateCli = Boolean(commandArgs?.packageUpdateCli);
const shouldSourceStatus = Boolean(commandArgs?.sourceStatus);
const shouldQueryList = Boolean(commandArgs?.queryList);
const shouldQueryShow = Boolean(commandArgs?.queryShow);
const shouldTemplateList = Boolean(commandArgs?.templateList);
const shouldTemplateShow = Boolean(commandArgs?.templateShow);
const shouldTemplateExplain = Boolean(commandArgs?.templateExplain);
const shouldTemplateStatus = Boolean(commandArgs?.templateStatus);
const shouldTemplateDetach = Boolean(commandArgs?.templateDetach);
const shouldTemplatePolicyInit = Boolean(commandArgs?.templatePolicyInit);
const shouldTemplatePolicyCheck = Boolean(commandArgs?.templatePolicyCheck);
const shouldTemplatePolicyExplain = Boolean(commandArgs?.templatePolicyExplain);
const shouldTemplatePolicyPin = Boolean(commandArgs?.templatePolicyPin);
const shouldTemplateCheck = Boolean(commandArgs?.templateCheck);
const shouldTemplateUpdate = Boolean(commandArgs?.templateUpdate);
const shouldImportWorkspace = Boolean(commandArgs?.importWorkspace);
const shouldImportDiff = Boolean(commandArgs?.importDiff);
const shouldImportRefresh = Boolean(commandArgs?.importRefresh);
const shouldImportCheck = Boolean(commandArgs?.importCheck);
const shouldImportPlan = Boolean(commandArgs?.importPlan);
const shouldImportAdoptList = Boolean(commandArgs?.importAdoptList);
const shouldImportAdopt = Boolean(commandArgs?.importAdopt);
const shouldImportStatus = Boolean(commandArgs?.importStatus);
const shouldImportHistory = Boolean(commandArgs?.importHistory);
const shouldValidate = Boolean(commandArgs?.validate) || args.includes("--validate");
const shouldResolve = args.includes("--resolve");
const generateTarget = commandArgs?.generateTarget || null;
if (RENAMED_GENERATE_TARGETS.has(generateTarget)) {
  console.error(`Artifact target '${generateTarget}' was renamed to '${RENAMED_GENERATE_TARGETS.get(generateTarget)}'.`);
  process.exit(1);
}
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
const componentIndex = args.indexOf("--widget");
const componentId = componentIndex >= 0 ? args[componentIndex + 1] : null;
const projectionIndex = args.indexOf("--projection");
const projectionId = projectionIndex >= 0 ? args[projectionIndex + 1] : null;
const entityIndex = args.indexOf("--entity");
const entityId = entityIndex >= 0 ? args[entityIndex + 1] : null;
const journeyIndex = args.indexOf("--journey");
const journeyId = journeyIndex >= 0 ? args[journeyIndex + 1] : null;
const surfaceIndex = args.indexOf("--surface");
const surfaceId = surfaceIndex >= 0 ? args[surfaceIndex + 1] : null;
const domainIndex = args.indexOf("--domain");
const domainId = domainIndex >= 0 ? args[domainIndex + 1] : null;
const seamIndex = args.indexOf("--seam");
const seamId = seamIndex >= 0 ? args[seamIndex + 1] : null;
const taskIndex = args.indexOf("--task");
const taskId = taskIndex >= 0 ? args[taskIndex + 1] : null;
const pitchIndex = args.indexOf("--pitch");
const pitchId = pitchIndex >= 0 ? args[pitchIndex + 1] : null;
const requirementIndex = args.indexOf("--requirement");
const requirementId = requirementIndex >= 0 ? args[requirementIndex + 1] : null;
const acceptanceIndex = args.indexOf("--acceptance");
const acceptanceId = acceptanceIndex >= 0 ? args[acceptanceIndex + 1] : null;
const bugIndex = args.indexOf("--bug");
const bugId = bugIndex >= 0 ? args[bugIndex + 1] : null;
const documentIndex = args.indexOf("--document");
const documentId = documentIndex >= 0 ? args[documentIndex + 1] : null;
const sdlcKindIndex = args.indexOf("--kind");
const sdlcKind = sdlcKindIndex >= 0 ? args[sdlcKindIndex + 1] : null;
const sdlcStatusIndex = args.indexOf("--status");
const sdlcStatus = sdlcStatusIndex >= 0 ? args[sdlcStatusIndex + 1] : null;
const sdlcNoteIndex = args.indexOf("--note");
const sdlcNote = sdlcNoteIndex >= 0 ? args[sdlcNoteIndex + 1] : null;
const reasonIndex = args.indexOf("--reason");
const reasonValue = reasonIndex >= 0 && args[reasonIndex + 1] && !args[reasonIndex + 1].startsWith("-")
  ? args[reasonIndex + 1]
  : null;
const sdlcActorIndex = args.indexOf("--actor");
const sdlcActor = sdlcActorIndex >= 0 ? args[sdlcActorIndex + 1] : null;
const sdlcAppVersionIndex = args.indexOf("--app-version");
const sdlcAppVersion = sdlcAppVersionIndex >= 0 ? args[sdlcAppVersionIndex + 1] : null;
const sdlcSinceIndex = args.indexOf("--since-tag");
const sdlcSinceTag = sdlcSinceIndex >= 0 ? args[sdlcSinceIndex + 1] : null;
const sdlcBeforeIndex = args.indexOf("--before");
const sdlcBefore = sdlcBeforeIndex >= 0 ? args[sdlcBeforeIndex + 1] : null;
const sdlcDryRun = args.includes("--dry-run");
const sdlcStrict = args.includes("--strict");
const sdlcIncludeArchived = args.includes("--include-archived");
const sdlcIncludeHistory = args.includes("--history") || args.includes("--include-history");
const sdlcBrief = args.includes("--brief");
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

if ((shouldCheck || shouldComponentCheck || shouldComponentBehavior || shouldGeneratorCheck || shouldGeneratorPolicyInit || shouldGeneratorPolicyStatus || shouldGeneratorPolicyCheck || shouldGeneratorPolicyExplain || shouldGeneratorPolicyPin || shouldValidate || shouldTrustTemplate || shouldTrustStatus || shouldTrustDiff || shouldSourceStatus || shouldTemplateExplain || shouldTemplateStatus || shouldTemplateDetach || shouldTemplatePolicyInit || shouldTemplatePolicyCheck || shouldTemplatePolicyExplain || shouldTemplatePolicyPin || shouldTemplateCheck || shouldTemplateUpdate || generateTarget === "app-bundle") && !inputPath) {
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

if (shouldPackageUpdateCli && !inputPath) {
  console.error("Missing required <version>.");
  printUsage();
  process.exit(1);
}

if (shouldReleaseStatus && args.includes("--write-report") && !releaseReportPath) {
  console.error("Missing required --write-report <path>.");
  printReleaseHelp();
  process.exit(1);
}

if (shouldReleaseRollConsumers && shouldWatchReleaseConsumers && !shouldPushReleaseConsumers) {
  console.error("Use either --watch or --no-push, not both.");
  printReleaseHelp();
  process.exit(1);
}

if (shouldImportWorkspace && !outPath) {
  console.error("Missing required --out <target>.");
  printImportHelp();
  process.exit(1);
}

if (shouldImportAdopt && (!commandArgs?.importAdoptSelector || commandArgs.importAdoptSelector.startsWith("-"))) {
  console.error("Missing required <selector>.");
  printImportHelp();
  process.exit(1);
}

if (shouldImportAdopt && shouldWrite && args.includes("--dry-run")) {
  console.error("Use either --dry-run or --write, not both.");
  printImportHelp();
  process.exit(1);
}

if (shouldQueryShow && !commandArgs?.queryShowName) {
  console.error("Missing required <name>.");
  printQueryHelp();
  process.exit(1);
}

if ((shouldCheck || shouldComponentCheck || shouldComponentBehavior || shouldAgentBrief || shouldValidate || shouldGeneratorPolicyInit || shouldGeneratorPolicyStatus || shouldGeneratorPolicyCheck || shouldGeneratorPolicyExplain || shouldGeneratorPolicyPin || shouldTrustTemplate || shouldTrustStatus || shouldTrustDiff || shouldTemplateExplain || shouldTemplateStatus || shouldTemplatePolicyInit || shouldTemplatePolicyCheck || shouldTemplatePolicyExplain || shouldTemplatePolicyPin || shouldTemplateUpdate || generateTarget === "app-bundle") && inputPath) {
  inputPath = normalizeTopogramPath(inputPath);
}

try {
  if (shouldVersion) {
    const payload = buildVersionPayload({
      executablePath: path.resolve(process.argv[1] || fileURLToPath(import.meta.url))
    });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printVersion(payload);
    }
    process.exit(0);
  }

  if (shouldDoctor) {
    const payload = buildDoctorPayload(catalogSource || inputPath || null);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printDoctor(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldAgentBrief) {
    const ast = parsePath(normalizeAgentTopogramPath(inputPath));
    const result = buildAgentBrief(inputPath, ast);
    if (!result.ok) {
      if (result.kind === "project") {
        console.error(formatProjectConfigErrors(result.validation, result.configPath));
      } else {
        console.error(formatValidationErrors(result.validation));
      }
      process.exit(1);
    }
    if (emitJson) {
      console.log(stableStringify(result.payload));
    } else {
      process.stdout.write(formatAgentBrief(result.payload));
    }
    process.exit(0);
  }

  if (shouldReleaseStatus) {
    const payload = buildReleaseStatusPayload({ strict: strictReleaseStatus });
    if (releaseReportPath) {
      const target = path.resolve(releaseReportPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, renderReleaseStatusMarkdown(payload), "utf8");
    }
    if (emitJson) {
      console.log(stableStringify(payload));
    } else if (shouldPrintReleaseMarkdown) {
      console.log(renderReleaseStatusMarkdown(payload).trimEnd());
    } else {
      printReleaseStatus(payload);
      if (releaseReportPath) {
        console.log(`Report: ${path.resolve(releaseReportPath)}`);
      }
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldReleaseRollConsumers) {
    const payload = buildReleaseRollConsumersPayload(commandArgs.releaseRollVersion, {
      push: shouldPushReleaseConsumers,
      watch: shouldWatchReleaseConsumers
    });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printReleaseRollConsumers(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldQueryList) {
    const payload = buildQueryListPayload();
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printQueryList(payload);
    }
    process.exit(0);
  }

  if (shouldQueryShow) {
    const payload = buildQueryShowPayload(commandArgs.queryShowName);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printQueryDefinition(payload);
    }
    process.exit(0);
  }

  if (shouldComponentCheck) {
    const ast = parsePath(inputPath);
    const result = generateWorkspace(ast, {
      target: "widget-conformance-report",
      projectionId,
      widgetId: componentId,
      componentId
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    const report = result.artifact;
    const ok = (report.summary?.errors || 0) === 0;
    if (emitJson) {
      console.log(stableStringify(report));
    } else {
      printWidgetConformanceReport(report);
    }
    process.exit(ok ? 0 : 1);
  }

  if (shouldComponentBehavior) {
    const ast = parsePath(inputPath);
    const result = generateWorkspace(ast, {
      target: "widget-behavior-report",
      projectionId,
      widgetId: componentId,
      componentId
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    const report = result.artifact;
    const ok = (report.summary?.errors || 0) === 0;
    if (emitJson) {
      console.log(stableStringify(report));
    } else {
      printWidgetBehaviorReport(report);
    }
    process.exit(ok ? 0 : 1);
  }

  if (shouldGeneratorCheck) {
    const payload = checkGeneratorPack(inputPath, { cwd: process.cwd() });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorCheck(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldGeneratorList) {
    const payload = buildGeneratorListPayload(process.cwd());
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorList(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldGeneratorShow) {
    const payload = buildGeneratorShowPayload(inputPath, process.cwd());
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorShow(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldGeneratorPolicyInit) {
    const payload = buildGeneratorPolicyInitPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyInitPayload(payload);
    }
    process.exit(0);
  }

  if (shouldGeneratorPolicyStatus) {
    const payload = buildGeneratorPolicyStatusPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyStatusPayload(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldGeneratorPolicyCheck) {
    const payload = buildGeneratorPolicyCheckPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyCheckPayload(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldGeneratorPolicyExplain) {
    const payload = buildGeneratorPolicyExplainPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyExplainPayload(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldGeneratorPolicyPin) {
    const payload = buildGeneratorPolicyPinPayload(inputPath, commandArgs?.generatorPolicyPinSpec);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printGeneratorPolicyPinPayload(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

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

  if (shouldCatalogDoctor) {
    const payload = buildCatalogDoctorPayload(catalogSource || inputPath || null);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printCatalogDoctor(payload);
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

  if (shouldPackageUpdateCli) {
    const payload = buildPackageUpdateCliPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printPackageUpdateCli(payload);
    }
    process.exit(0);
  }

  if (shouldImportWorkspace) {
    const payload = buildBrownfieldImportWorkspacePayload(inputPath, outPath, { from: fromValue });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportWorkspace(payload);
    }
    process.exit(0);
  }

  if (shouldImportDiff) {
    const payload = buildBrownfieldImportDiffPayload(inputPath, { sourcePath: fromValue });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportDiff(payload);
    }
    process.exit(0);
  }

  if (shouldImportRefresh) {
    const payload = buildBrownfieldImportRefreshPayload(inputPath, { sourcePath: fromValue, dryRun: args.includes("--dry-run") });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportRefresh(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldImportCheck) {
    const payload = buildBrownfieldImportCheckPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportCheck(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldImportPlan) {
    const payload = buildBrownfieldImportPlanPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportPlan(payload);
    }
    process.exit(0);
  }

  if (shouldImportAdoptList) {
    const payload = buildBrownfieldImportAdoptListPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportAdoptList(payload);
    }
    process.exit(0);
  }

  if (shouldImportAdopt) {
    const payload = buildBrownfieldImportAdoptPayload(commandArgs.importAdoptSelector, inputPath, {
      dryRun: args.includes("--dry-run"),
      write: shouldWrite,
      force: shouldForce,
      reason: reasonValue,
      refreshAdopted
    });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportAdopt(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldImportStatus) {
    const payload = buildBrownfieldImportStatusPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportStatus(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldImportHistory) {
    const payload = buildBrownfieldImportHistoryPayload(inputPath, { verify: args.includes("--verify") });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printBrownfieldImportHistory(payload);
    }
    process.exit(payload.ok ? 0 : 1);
  }

  if (shouldSourceStatus) {
    const sourceStatusRemote = args.includes("--remote");
    const payload = buildProjectSourceStatus(normalizeProjectRoot(inputPath), {
      local: args.includes("--local") && !sourceStatusRemote
    });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTopogramSourceStatus(payload);
    }
    process.exit(0);
  }

  if (commandArgs?.newProject) {
    const projectRoot = path.resolve(inputPath);
    const relativeToEngine = path.relative(ENGINE_ROOT, projectRoot);
    if (relativeToEngine === "" || (!relativeToEngine.startsWith("..") && !path.isAbsolute(relativeToEngine))) {
      throw new Error(
        `Refusing to create a generated project inside the engine directory. Use a path outside engine, for example '../${path.basename(projectRoot)}'.`
      );
    }
    const resolvedTemplate = resolveCatalogTemplateAlias(templateName, catalogSource);
    const result = createNewProject({
      targetPath: inputPath,
      templateName: resolvedTemplate.templateName,
      templateProvenance: resolvedTemplate.provenance,
      engineRoot: ENGINE_ROOT,
      templatesRoot: TEMPLATES_ROOT
    });
    printNewProjectResult(result, process.cwd());
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

  if (shouldTemplateExplain) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot explain template lifecycle without topogram.project.json.");
    }
    const payload = buildTemplateExplainPayload(projectConfigInfo);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTemplateExplain(payload);
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

  if (shouldTemplateDetach) {
    const projectConfigInfo = loadProjectConfig(inputPath);
    if (!projectConfigInfo) {
      throw new Error("Cannot detach template metadata without topogram.project.json.");
    }
    const payload = buildTemplateDetachPayload(projectConfigInfo, {
      dryRun: args.includes("--dry-run"),
      removePolicy: args.includes("--remove-policy")
    });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTemplateDetachPayload(payload);
    }
    process.exit(payload.ok ? 0 : 1);
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

  if (shouldTemplatePolicyExplain) {
    const payload = buildTemplatePolicyExplainPayload(inputPath);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printTemplatePolicyExplainPayload(payload);
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
    const recommendUpdate = args.includes("--recommend");
    const update = buildTemplateUpdateCliPayload({
      args,
      inputPath,
      templateIndex,
      templateName,
      useLatestTemplate,
      outPath
    });
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
    process.exit(runTrustTemplateCommand(inputPath, { force: shouldForce }));
  }

  if (shouldTrustStatus) {
    process.exit(runTrustStatusCommand(inputPath, { json: emitJson }));
  }

  if (shouldTrustDiff) {
    process.exit(runTrustDiffCommand(inputPath, { json: emitJson }));
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
          validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null, { configDir: projectConfigInfo.configDir }),
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

  if (commandArgs?.queryName === "domain-list") {
    const ast = parsePath(inputPath);
    const result = generateWorkspace(ast, { target: "domain-list" });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    console.log(stableStringify(result.artifact));
    process.exit(0);
  }

  if (commandArgs?.queryName === "domain-coverage") {
    if (!domainId) {
      console.error("query domain-coverage requires --domain <id>");
      process.exit(2);
    }
    const ast = parsePath(inputPath);
    const result = generateWorkspace(ast, { target: "domain-coverage", domainId });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    console.log(stableStringify(result.artifact));
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
      widgetId: componentId,
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId
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
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId);

    if (modeId || (!hasSelector && !fromTopogramPath)) {
      const effectiveModeId = modeId || "verification";
      const result = generateWorkspace(ast, {
        target: "context-task-mode",
        modeId: effectiveModeId,
        capabilityId,
        workflowId,
        projectionId,
        widgetId: componentId,
        componentId,
        entityId,
        journeyId,
        surfaceId,
        domainId,
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
      widgetId: componentId,
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId
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
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId);

    if (modeId || (!hasSelector && !fromTopogramPath)) {
      const effectiveModeId = modeId || "verification";
      const result = generateWorkspace(ast, {
        target: "context-task-mode",
        modeId: effectiveModeId,
        capabilityId,
        workflowId,
        projectionId,
        widgetId: componentId,
        componentId,
        entityId,
        journeyId,
        surfaceId,
        domainId,
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
      widgetId: componentId,
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId
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

  if (commandArgs?.queryName === "widget-behavior") {
    const ast = parsePath(normalizeTopogramPath(inputPath));
    const result = generateWorkspace(ast, {
      target: "widget-behavior-report",
      projectionId,
      componentId
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }
    console.log(stableStringify(result.artifact));
    process.exit((result.artifact.summary?.errors || 0) === 0 ? 0 : 1);
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }

    const hasSelector = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          componentId,
          entityId,
          journeyId,
          surfaceId,
          domainId
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
    const hasSelectors = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId || fromTopogramPath);
    const useImportAdoptPath =
      importAdoptOnlyRequested({ modeId, capabilityId, workflowId, projectionId, componentId, entityId, journeyId, surfaceId, domainId, fromTopogramPath }) ||
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          componentId,
          entityId,
          journeyId,
          surfaceId,
          domainId
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
    const hasSelectors = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId || fromTopogramPath);
    const useImportAdoptPath =
      importAdoptOnlyRequested({ modeId, capabilityId, workflowId, projectionId, componentId, entityId, journeyId, surfaceId, domainId, fromTopogramPath }) ||
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
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
    const hasSelectors = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId || fromTopogramPath);
    const useImportAdoptPath =
      importAdoptOnlyRequested({ modeId, capabilityId, workflowId, projectionId, componentId, entityId, journeyId, surfaceId, domainId, fromTopogramPath }) ||
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          componentId,
          entityId,
          journeyId,
          surfaceId,
          domainId
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
    const hasSelectors = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId || fromTopogramPath);
    const useImportAdoptPath =
      importAdoptOnlyRequested({ modeId, capabilityId, workflowId, projectionId, componentId, entityId, journeyId, surfaceId, domainId, fromTopogramPath }) ||
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const hasSelector = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          componentId,
          entityId,
          journeyId,
          surfaceId,
          domainId
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
      fromTopogramPath
    });
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }

    const hasSelector = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          componentId,
          entityId,
          journeyId,
          surfaceId,
          domainId
        })
      : null;
    if (sliceResult && !sliceResult.ok) {
      console.error(formatValidationErrors(sliceResult.validation));
      process.exit(1);
    }
    const resolvedForGeneratorTargets = resolveWorkspace(ast);
    if (!resolvedForGeneratorTargets.ok) {
      console.error(formatValidationErrors(resolvedForGeneratorTargets.validation));
      process.exit(1);
    }
    const generatorTargets = generatorTargetsForWorkflowContext({
      graph: resolvedForGeneratorTargets.graph,
      taskModeArtifact: result.artifact,
      sliceArtifact: sliceResult?.artifact || null
    });

    let importPlan = null;
    const resolvedWorkflowContextBase = {
      workspace: normalizeTopogramPath(inputPath),
      taskModeArtifact: result.artifact,
      generatorTargets,
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
      fromTopogramPath
    });
    if (!taskModeResult.ok) {
      console.error(formatValidationErrors(taskModeResult.validation));
      process.exit(1);
    }
    const resolvedForGeneratorTargets = resolveWorkspace(ast);
    if (!resolvedForGeneratorTargets.ok) {
      console.error(formatValidationErrors(resolvedForGeneratorTargets.validation));
      process.exit(1);
    }

    const hasSelector = Boolean(capabilityId || workflowId || projectionId || componentId || entityId || journeyId || surfaceId || domainId);
    const sliceResult = hasSelector
      ? generateWorkspace(ast, {
          target: "context-slice",
          capabilityId,
          workflowId,
          projectionId,
          componentId,
          entityId,
          journeyId,
          surfaceId,
          domainId
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
    const generatorTargets = generatorTargetsForWorkflowContext({
      graph: resolvedForGeneratorTargets.graph,
      taskModeArtifact: taskModeResult.artifact,
      sliceArtifact: sliceResult?.artifact || null,
      maintainedBoundaryArtifact: maintainedBundleResult?.artifact?.maintained_boundary || null
    });

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
      generatorTargets,
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
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
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

  if (commandArgs?.sdlcCommand) {
    const sdlcRoot = path.resolve(inputPath || ".");
    if (commandArgs.sdlcCommand === "transition") {
      const { transitionStatement } = await import("./sdlc/transition.js");
      const result = transitionStatement(sdlcRoot, commandArgs.sdlcId, commandArgs.sdlcTargetStatus, {
        actor: sdlcActor,
        note: sdlcNote,
        dryRun: sdlcDryRun
      });
      console.log(stableStringify(result));
      process.exit(result.ok ? 0 : 1);
    }
    if (commandArgs.sdlcCommand === "check") {
      const { checkWorkspace } = await import("./sdlc/check.js");
      const ast = parsePath(sdlcRoot);
      const resolved = resolveWorkspace(ast);
      if (!resolved.ok) {
        console.error(formatValidationErrors(resolved.validation));
        process.exit(1);
      }
      const result = checkWorkspace(sdlcRoot, resolved);
      console.log(stableStringify(result));
      process.exit(sdlcStrict && (!result.ok || result.warnings.length > 0) ? 1 : 0);
    }
    if (commandArgs.sdlcCommand === "explain") {
      const { explain } = await import("./sdlc/explain.js");
      const ast = parsePath(sdlcRoot);
      const resolved = resolveWorkspace(ast);
      if (!resolved.ok) {
        console.error(formatValidationErrors(resolved.validation));
        process.exit(1);
      }
      const result = explain(sdlcRoot, resolved, commandArgs.sdlcId, {
        includeHistory: sdlcIncludeHistory
      });
      if (sdlcBrief && result.ok) {
        console.log(stableStringify({
          id: result.id,
          status: result.status,
          next_action: result.next_action
        }));
      } else {
        console.log(stableStringify(result));
      }
      process.exit(result.ok ? 0 : 1);
    }
    if (commandArgs.sdlcCommand === "archive") {
      const { archiveBatch, archiveEligibleStatements } = await import("./archive/archive.js");
      const ast = parsePath(sdlcRoot);
      const resolved = resolveWorkspace(ast);
      if (!resolved.ok) {
        console.error(formatValidationErrors(resolved.validation));
        process.exit(1);
      }
      const ids = archiveEligibleStatements(resolved, {
        before: sdlcBefore,
        statuses: sdlcStatus ? sdlcStatus.split(",") : null
      });
      const result = archiveBatch(sdlcRoot, ids, { dryRun: sdlcDryRun, by: sdlcActor, reason: sdlcNote });
      console.log(stableStringify({ candidates: ids, ...result }));
      process.exit(result.ok ? 0 : 1);
    }
    if (commandArgs.sdlcCommand === "unarchive") {
      const { unarchive } = await import("./archive/unarchive.js");
      const result = unarchive(sdlcRoot, commandArgs.sdlcId, {});
      console.log(stableStringify(result));
      process.exit(result.ok ? 0 : 1);
    }
    if (commandArgs.sdlcCommand === "compact") {
      const { compact } = await import("./archive/compact.js");
      const result = compact(path.resolve(commandArgs.sdlcArchiveFile));
      console.log(stableStringify(result));
      process.exit(result.ok ? 0 : 1);
    }
    if (commandArgs.sdlcCommand === "new") {
      const { scaffoldNew } = await import("./sdlc/scaffold.js");
      const result = scaffoldNew(sdlcRoot, commandArgs.sdlcNewKind, commandArgs.sdlcNewSlug);
      console.log(stableStringify(result));
      process.exit(result.ok ? 0 : 1);
    }
    if (commandArgs.sdlcCommand === "adopt") {
      const { sdlcAdopt } = await import("./sdlc/adopt.js");
      const result = sdlcAdopt(sdlcRoot);
      console.log(stableStringify(result));
      process.exit(result.ok ? 0 : 1);
    }
    if (commandArgs.sdlcCommand === "release") {
      const { runRelease } = await import("./sdlc/release.js");
      const result = runRelease(sdlcRoot, {
        appVersion: sdlcAppVersion,
        sinceTag: sdlcSinceTag,
        dryRun: sdlcDryRun,
        actor: sdlcActor
      });
      console.log(stableStringify(result));
      process.exit(result.ok ? 0 : 1);
    }
    throw new Error(`Unknown sdlc command '${commandArgs.sdlcCommand}'`);
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
      ? validateProjectConfig(projectConfigInfo.config, resolvedForConfig.graph, { configDir: projectConfigInfo.configDir })
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
      widgetId: componentId,
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
      taskId,
      pitchId,
      requirementId,
      acceptanceId,
      bugId,
      documentId,
      kind: sdlcKind,
      appVersion: sdlcAppVersion,
      sinceTag: sdlcSinceTag,
      includeArchived: sdlcIncludeArchived,
      modeId,
      profileId,
      fromSnapshot: fromSnapshotPath ? JSON.parse(fs.readFileSync(fromSnapshotPath, "utf8")) : null,
      fromSnapshotPath,
      fromTopogramPath,
      topogramInputPath: topogramInputPathForGeneration(inputPath),
      implementation,
      projectConfig: projectConfigInfo?.config || null,
      configDir: projectConfigInfo?.configDir || projectRoot,
      projectRoot: projectConfigInfo?.configDir || projectRoot
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
        componentId,
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
