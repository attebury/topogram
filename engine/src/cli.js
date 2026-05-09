#!/usr/bin/env node

import fs from "node:fs";
import childProcess from "node:child_process";
import crypto from "node:crypto";
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
  buildCatalogDoctorAuth,
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
  checkDoctorNode,
  checkDoctorNpm,
  checkDoctorPackageAccess,
  checkTemplatePackageStatus,
  CLI_PACKAGE_NAME,
  inspectTopogramCliLockfile,
  isLocalCliDependencySpec,
  isPackageVersion,
  latestTopogramCliVersion,
  localTemplatePackageStatus,
  normalizeRegistryUrl,
  NPMJS_REGISTRY,
  npmConfigGet,
  printPackageHelp,
  printPackageUpdateCli,
  readInstalledCliPackageVersion,
  readProjectCliDependencySpec
} from "./cli/commands/package.js";
import {
  buildTemplateListPayload,
  buildTemplateShowPayload,
  buildTemplateStatusPayload,
  buildTemplateExplainPayload,
  buildTemplateDetachPayload,
  buildTemplateOwnedBaselineStatus,
  latestTemplateInfo,
  printTemplateHelp,
  printTemplateList,
  printTemplateShow,
  printTemplateStatus,
  printTemplateExplain,
  printTemplateDetachPayload,
  templateMetadataFromProjectConfig
} from "./cli/commands/template.js";
import {
  printEmitHelp,
  printGenerateHelp,
  printNewHelp,
  printUsage,
  printWidgetHelp
} from "./cli/help.js";
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
  loadTemplatePolicy,
  packageScopeFromSpec,
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
  templateTrustRecoveryGuidance,
  validateProjectImplementationTrust,
  writeTemplateTrustRecord
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
  catalogSourceOrDefault,
  buildTopogramSourceStatus,
  isCatalogSourceDisabled,
  loadCatalog,
  TOPOGRAM_SOURCE_FILE
} from "./catalog.js";
import {
  buildTopogramImportStatus,
  collectImportSourceFileRecords,
  TOPOGRAM_IMPORT_FILE,
  writeTopogramImportRecord
} from "./import/provenance.js";
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
import { LOCAL_NPMRC_ENV, localNpmrcStatus } from "./npm-safety.js";
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
const TOPOGRAM_IMPORT_ADOPTIONS_FILE = ".topogram-import-adoptions.jsonl";
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

function printDoctorHelp() {
  console.log("Usage: topogram doctor [--json] [--catalog <path-or-source>]");
  console.log("");
  console.log("Checks local runtime, npm, public package access, CLI lockfile metadata, and catalog access.");
  console.log("");
  console.log("Fresh install check:");
  console.log("  npm install --save-dev @topogram/cli");
  console.log("  npx topogram doctor");
  console.log("  npx topogram template list");
  console.log("  npx topogram new ./my-app --template hello-web");
  console.log("");
  console.log("Related setup commands:");
  console.log("  topogram setup package-auth");
  console.log("  topogram setup catalog-auth");
  console.log("");
  console.log("Examples:");
  console.log("  topogram doctor");
  console.log("  topogram doctor --json");
  console.log("  topogram doctor --catalog ./topograms.catalog.json");
  console.log("  topogram catalog doctor");
  console.log("");
  console.log("Use `catalog doctor` when you only want catalog/package-access diagnostics. Use `doctor --catalog` for the full environment check plus catalog diagnostics.");
}

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

function printSourceHelp() {
  console.log("Usage: topogram source status [path] [--local|--remote] [--json]");
  console.log("");
  console.log("Reports source provenance, template attachment state, and whether local edits affect template-owned files.");
  console.log("");
  console.log("Examples:");
  console.log("  topogram source status");
  console.log("  topogram source status --local");
  console.log("  topogram source status --remote");
  console.log("  topogram source status --json");
}

function printImportHelp() {
  console.log("Usage: topogram import <app-path> --out <target> [--from <track[,track]>] [--json]");
  console.log("   or: topogram import refresh [path] [--from <app-path>] [--dry-run] [--json]");
  console.log("   or: topogram import diff [path] [--json]");
  console.log("   or: topogram import check [path] [--json]");
  console.log("   or: topogram import plan [path] [--json]");
  console.log("   or: topogram import adopt --list [path] [--json]");
  console.log("   or: topogram import adopt <selector> [path] [--dry-run|--write] [--force --reason <text>] [--json]");
  console.log("   or: topogram import status [path] [--json]");
  console.log("   or: topogram import history [path] [--verify] [--json]");
  console.log("");
  console.log("Creates an editable Topogram workspace from a brownfield app without modifying the app.");
  console.log("");
  console.log("Behavior:");
  console.log("  - writes raw import candidates under topogram/candidates/app");
  console.log("  - writes reconcile proposal bundles under topogram/candidates/reconcile");
  console.log("  - writes topogram.project.json with maintained ownership and no generated stack binding");
  console.log(`  - writes ${TOPOGRAM_IMPORT_FILE} with source file hashes from import time`);
  console.log("  - imported Topogram artifacts are project-owned after creation");
  console.log("  - refresh rewrites only candidate/reconcile artifacts and source provenance");
  console.log("  - adoption previews never write canonical Topogram files unless --write is passed");
  console.log("  - adoption writes refuse dirty brownfield source provenance unless --force is passed");
  console.log(`  - adoption writes append audit receipts to ${TOPOGRAM_IMPORT_ADOPTIONS_FILE}`);
  console.log("  - forced adoption writes require --reason <text>");
  console.log("");
  console.log("Examples:");
  console.log("  topogram import ./existing-app --out ./imported-topogram");
  console.log("  topogram import ./existing-app --out ./imported-topogram --from db,api,ui");
  console.log("  topogram import diff ./imported-topogram");
  console.log("  topogram import refresh ./imported-topogram --from ./existing-app --dry-run");
  console.log("  topogram import refresh ./imported-topogram --from ./existing-app");
  console.log("  topogram import check ./imported-topogram");
  console.log("  topogram import plan ./imported-topogram");
  console.log("  topogram import adopt --list ./imported-topogram");
  console.log("  topogram import adopt bundle:task ./imported-topogram --dry-run");
  console.log("  topogram import adopt bundle:task ./imported-topogram --write");
  console.log("  topogram import adopt bundle:task ./imported-topogram --write --force --reason \"Reviewed source drift\"");
  console.log("  topogram import status ./imported-topogram");
  console.log("  topogram import history ./imported-topogram");
  console.log("  topogram import history ./imported-topogram --verify");
  console.log("  topogram import check --json");
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
 * @param {string|null} source
 * @returns {{ ok: boolean, node: { version: string, minimum: string, ok: boolean, diagnostics: any[] }, npm: { available: boolean, version: string|null, diagnostics: any[] }, localNpmrc: ReturnType<typeof localNpmrcStatus>, packageRegistry: { required: boolean, reason: string|null, registry: string, configuredRegistry: string|null, registryConfigured: boolean, nodeAuthTokenEnv: boolean, packageName: string, packageSpec: string|null, packageAccess: { ok: boolean, checkedVersion: string|null, diagnostics: any[] } }, lockfile: ReturnType<typeof inspectTopogramCliLockfile>, catalog: ReturnType<typeof buildCatalogDoctorPayload>, diagnostics: any[], errors: string[] }}
 */
function buildDoctorPayload(source) {
  const projectCliDependency = readProjectCliDependencySpec(process.cwd());
  const packageRegistryRequired = !isLocalCliDependencySpec(projectCliDependency);
  const node = checkDoctorNode();
  const npm = checkDoctorNpm();
  const configuredRegistry = npm.available ? npmConfigGet("@topogram:registry") : null;
  const registryConfigured = !configuredRegistry ||
    normalizeRegistryUrl(configuredRegistry) === normalizeRegistryUrl(NPMJS_REGISTRY);
  const registryDiagnostics = [];
  if (packageRegistryRequired && npm.available && !registryConfigured) {
    registryDiagnostics.push({
      code: "package_registry_registry_not_configured",
      severity: "error",
      message: `npm is configured to resolve @topogram packages from '${configuredRegistry}', not ${NPMJS_REGISTRY}.`,
      path: ".npmrc",
      suggestedFix: "Remove the custom @topogram registry config or set it to https://registry.npmjs.org, then rerun `topogram doctor`."
    });
  }
  const packageSpec = packageRegistryRequired ? `${CLI_PACKAGE_NAME}@${readInstalledCliPackageVersion()}` : null;
  const packageAccess = packageRegistryRequired && npm.available
    ? checkDoctorPackageAccess(packageSpec)
    : packageRegistryRequired ? {
        ok: false,
        checkedVersion: null,
        diagnostics: [{
          code: "npm_not_found",
          severity: "error",
          message: "npm is required to inspect the Topogram CLI package.",
          path: null,
          suggestedFix: "Install Node.js/npm, then rerun `topogram doctor`."
        }]
      } : {
        ok: true,
        checkedVersion: null,
        diagnostics: []
      };
  const catalog = buildDoctorCatalogPayload(source);
  const lockfile = inspectTopogramCliLockfile(process.cwd());
  const diagnostics = [
    ...node.diagnostics,
    ...npm.diagnostics,
    ...registryDiagnostics,
    ...packageAccess.diagnostics,
    ...lockfile.diagnostics,
    ...catalog.diagnostics
  ];
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    ok: errors.length === 0,
    node,
    npm,
    localNpmrc: localNpmrcStatus(process.cwd()),
    packageRegistry: {
      required: packageRegistryRequired,
      reason: packageRegistryRequired ? null : `Project uses local CLI dependency '${projectCliDependency}'.`,
      registry: NPMJS_REGISTRY,
      configuredRegistry,
      registryConfigured,
      nodeAuthTokenEnv: Boolean(process.env.NODE_AUTH_TOKEN),
      packageName: CLI_PACKAGE_NAME,
      packageSpec,
      packageAccess
    },
    lockfile,
    catalog,
    diagnostics,
    errors
  };
}

/**
 * @param {string|null} source
 * @returns {ReturnType<typeof buildCatalogDoctorPayload>}
 */
function buildDoctorCatalogPayload(source) {
  const resolvedSource = resolveDoctorCatalogSource(source);
  if (isCatalogSourceDisabled(resolvedSource)) {
    return {
      ok: true,
      source: resolvedSource,
      auth: buildCatalogDoctorAuth(resolvedSource),
      catalog: {
        reachable: false,
        version: null,
        entries: 0
      },
      packages: [],
      diagnostics: [{
        code: "catalog_check_skipped",
        severity: "warning",
        message: "Catalog access check was skipped for this project.",
        path: null,
        suggestedFix: "Pass --catalog <source> to check a catalog explicitly."
      }],
      errors: []
    };
  }
  return buildCatalogDoctorPayload(resolvedSource);
}

/**
 * @param {string|null} source
 * @returns {string}
 */
function resolveDoctorCatalogSource(source) {
  if (source) {
    return source;
  }
  const projectConfigInfo = loadProjectConfig(normalizeTopogramPath(process.cwd()));
  if (projectConfigInfo) {
    const catalog = projectConfigInfo.config?.template?.catalog;
    if (catalog && typeof catalog.source === "string" && catalog.source) {
      return catalog.source;
    }
    return "none";
  }
  return catalogSourceOrDefault(null);
}

/**
 * @param {ReturnType<typeof buildDoctorPayload>} payload
 * @returns {void}
 */
function printDoctorSetupGuidance(payload) {
  console.log("Setup guidance:");
  if (payload.packageRegistry.required) {
    console.log(`- CLI package access: public @topogram packages should install from ${payload.packageRegistry.registry} without auth.`);
  } else {
    console.log("- CLI package auth: skipped because this project uses a local Topogram CLI dependency.");
  }
  if (isCatalogSourceDisabled(payload.catalog.source)) {
    console.log("- Catalog auth: skipped because catalog discovery is disabled for this project.");
  } else {
    console.log("- Catalog auth: the default catalog is public; private catalogs should use GITHUB_TOKEN or GH_TOKEN. Local `gh auth login` is only a no-token fallback.");
  }
  console.log("- Template package auth: private template packages may need registry-specific npm auth during npm install.");
  console.log(`- Local .npmrc: ignored by default. Use --allow-local-npmrc or ${LOCAL_NPMRC_ENV}=1 only after reviewing the file.`);
  console.log("- Catalog disabled mode: TOPOGRAM_CATALOG_SOURCE=none skips catalog aliases, including the default hello-web starter.");
}

/**
 * @param {ReturnType<typeof buildDoctorPayload>} payload
 * @returns {void}
 */
function printDoctor(payload) {
  console.log(payload.ok ? "Topogram doctor passed." : "Topogram doctor found issues.");
  console.log(`Node: ${payload.node.version} (${payload.node.ok ? "ok" : `requires ${payload.node.minimum}`})`);
  console.log(`npm: ${payload.npm.available ? `${payload.npm.version || "available"} (ok)` : "not found"}`);
  console.log(`local .npmrc: ${payload.localNpmrc.exists ? (payload.localNpmrc.enabled ? "enabled" : "ignored") : "not found"}`);
  if (payload.localNpmrc.exists) {
    console.log(`local .npmrc reason: ${payload.localNpmrc.reason}`);
  }
  console.log(`npm registry: ${payload.packageRegistry.required ? (payload.packageRegistry.registryConfigured ? "ok" : "misconfigured") : "not required"}`);
  if (payload.packageRegistry.reason) {
    console.log(`npm registry reason: ${payload.packageRegistry.reason}`);
  }
  if (payload.packageRegistry.configuredRegistry) {
    console.log(`Configured @topogram registry: ${payload.packageRegistry.configuredRegistry}`);
  }
  console.log(`CLI package access: ${payload.packageRegistry.required ? (payload.packageRegistry.packageAccess.ok ? `${payload.packageRegistry.packageSpec} ok` : `${payload.packageRegistry.packageSpec} failed`) : "not checked"}`);
  if (payload.lockfile.checked && payload.lockfile.packageVersion) {
    console.log(`CLI lockfile: ${payload.lockfile.packageVersion}${payload.lockfile.refreshRecommended ? " (refresh recommended)" : " (ok)"}`);
  }
  console.log(`Catalog source: ${payload.catalog.source}`);
  console.log(`Catalog reachable: ${payload.catalog.catalog.reachable ? "yes" : "no"}`);
  if (payload.catalog.catalog.reachable) {
    console.log(`Catalog entries: ${payload.catalog.catalog.entries}`);
    const failedPackages = payload.catalog.packages.filter((item) => !item.ok).length;
    console.log(`Catalog package access: ${failedPackages === 0 ? "ok" : `${failedPackages} failed`}`);
  }
  if (payload.catalog.source !== "none" || payload.catalog.catalog.reachable || payload.packageRegistry.required) {
    console.log("Project provenance: run `topogram source status --local` for catalog, template, trust, and baseline details.");
  }
  printDoctorSetupGuidance(payload);
  if (payload.diagnostics.length > 0) {
    console.log("Diagnostics:");
    for (const diagnostic of payload.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`- ${label}: ${diagnostic.message}`);
      if (diagnostic.suggestedFix) {
        console.log(`  Fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
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

/**
 * @param {string} targetPath
 * @returns {void}
 */
function ensureEmptyImportTarget(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    return;
  }
  if (!fs.statSync(targetPath).isDirectory()) {
    throw new Error(`Cannot import into non-directory path '${targetPath}'.`);
  }
  const entries = fs.readdirSync(targetPath).filter((entry) => entry !== ".DS_Store");
  if (entries.length > 0) {
    throw new Error(`Refusing to import into non-empty directory '${targetPath}'.`);
  }
}

/**
 * @param {string} outDir
 * @param {Record<string, any>} files
 * @returns {string[]}
 */
function writeRelativeFiles(outDir, files) {
  const written = [];
  for (const [relativePath, contents] of Object.entries(files || {})) {
    const normalizedRelativePath = relativePath.replaceAll(path.sep, "/");
    const destination = path.join(outDir, normalizedRelativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, typeof contents === "string" ? contents : `${stableStringify(contents)}\n`, "utf8");
    written.push(normalizedRelativePath);
  }
  return written.sort((a, b) => a.localeCompare(b));
}

/**
 * @returns {Record<string, any>}
 */
function importedProjectConfig() {
  return {
    version: "0.1",
    outputs: {
      maintained_app: {
        path: "./app",
        ownership: "maintained"
      }
    },
    topology: {
      runtimes: []
    }
  };
}

/**
 * @param {string} sourceRoot
 * @param {string} targetRoot
 * @param {ReturnType<typeof runWorkflow>["summary"]} importSummary
 * @returns {string}
 */
function importedWorkspaceReadme(sourceRoot, targetRoot, importSummary) {
  return [
    "# Imported Topogram Workspace",
    "",
    "This workspace was created from a brownfield app import.",
    "",
    `- Imported source: \`${sourceRoot}\``,
    `- Target workspace: \`${targetRoot}\``,
    `- Tracks: ${(importSummary.tracks || []).join(", ") || "none"}`,
    `- Provenance: \`${TOPOGRAM_IMPORT_FILE}\``,
    "",
    "Imported Topogram artifacts are project-owned after creation. Edit them directly, promote candidates deliberately, and run `topogram check` before generation or maintained-app work.",
    "",
    "Useful commands:",
    "",
    "```sh",
    "topogram import check",
    "topogram check",
    "topogram query import-plan ./topogram",
    "```",
    ""
  ].join("\n");
}

/**
 * @param {Record<string, any>} summary
 * @returns {Record<string, number>}
 */
function importCandidateCounts(summary) {
  const candidates = summary.candidates || {};
  return {
    dbEntities: candidates.db?.entities?.length || 0,
    dbEnums: candidates.db?.enums?.length || 0,
    apiCapabilities: candidates.api?.capabilities?.length || 0,
    apiRoutes: candidates.api?.routes?.length || 0,
    uiScreens: candidates.ui?.screens?.length || 0,
    uiRoutes: candidates.ui?.routes?.length || 0,
    uiWidgets: candidates.ui?.widgets?.length || candidates.ui?.components?.length || 0,
    workflows: candidates.workflows?.workflows?.length || 0,
    verifications: candidates.verification?.verifications?.length || 0
  };
}

/**
 * @param {string} rootPath
 * @returns {number}
 */
function countFilesRecursive(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return 0;
  }
  let count = 0;
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const childPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      count += countFilesRecursive(childPath);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

/**
 * @param {string} projectRoot
 * @returns {{ path: string, record: Record<string, any> }}
 */
function readTopogramImportRecord(projectRoot) {
  const importPath = path.join(normalizeProjectRoot(projectRoot), TOPOGRAM_IMPORT_FILE);
  if (!fs.existsSync(importPath)) {
    throw new Error(`No brownfield import provenance found at '${importPath}'. Run 'topogram import <app-path> --out <target>' first.`);
  }
  try {
    return { path: importPath, record: JSON.parse(fs.readFileSync(importPath, "utf8")) };
  } catch (error) {
    throw new Error(`Invalid brownfield import provenance JSON at '${importPath}'.`);
  }
}

/**
 * @param {Record<string, any>} importRecord
 * @returns {string|null}
 */
function importTrackValueFromRecord(importRecord) {
  const tracks = Array.isArray(importRecord.import?.tracks)
    ? importRecord.import.tracks.map((track) => String(track).trim()).filter(Boolean)
    : [];
  return tracks.length ? [...new Set(tracks)].join(",") : null;
}

/**
 * @param {string} topogramRoot
 * @returns {{ rawCandidateFiles: number, reconcileFiles: number }}
 */
function clearImportRefreshCandidateArtifacts(topogramRoot) {
  const appCandidatesRoot = path.join(topogramRoot, "candidates", "app");
  const reconcileRoot = path.join(topogramRoot, "candidates", "reconcile");
  const removed = {
    rawCandidateFiles: countFilesRecursive(appCandidatesRoot),
    reconcileFiles: countFilesRecursive(reconcileRoot)
  };
  fs.rmSync(appCandidatesRoot, { recursive: true, force: true });
  fs.rmSync(reconcileRoot, { recursive: true, force: true });
  return removed;
}

function sourceDiffCounts(content = {}) {
  return {
    changed: content.changed?.length || 0,
    added: content.added?.length || 0,
    removed: content.removed?.length || 0
  };
}

function compareImportRecordToSource(projectRoot, importRecord, sourceRoot) {
  const trustedFiles = Array.isArray(importRecord.files) ? importRecord.files : [];
  const trustedByPath = new Map(trustedFiles.map((file) => [String(file.path), file]));
  const currentFiles = collectImportSourceFileRecords(sourceRoot, { excludeRoots: [projectRoot] });
  const currentByPath = new Map(currentFiles.map((file) => [file.path, file]));
  const changed = [];
  const added = [];
  const removed = [];
  for (const [filePath, current] of currentByPath) {
    const trusted = trustedByPath.get(filePath);
    if (!trusted) {
      added.push(filePath);
    } else if (trusted.sha256 !== current.sha256 || trusted.size !== current.size) {
      changed.push(filePath);
    }
  }
  for (const filePath of trustedByPath.keys()) {
    if (!currentByPath.has(filePath)) {
      removed.push(filePath);
    }
  }
  const content = {
    changed: changed.sort((a, b) => a.localeCompare(b)),
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b))
  };
  const counts = sourceDiffCounts(content);
  const clean = counts.changed === 0 && counts.added === 0 && counts.removed === 0;
  return {
    ok: clean,
    status: clean ? "clean" : "changed",
    content,
    counts,
    files: currentFiles
  };
}

function buildCountDeltas(previous = {}, next = {}) {
  const keys = [...new Set([...Object.keys(previous || {}), ...Object.keys(next || {})])].sort((a, b) => a.localeCompare(b));
  const deltas = {};
  const changed = [];
  for (const key of keys) {
    const previousCount = Number(previous?.[key] || 0);
    const nextCount = Number(next?.[key] || 0);
    const delta = nextCount - previousCount;
    deltas[key] = { previous: previousCount, next: nextCount, delta };
    if (delta !== 0) {
      changed.push({ key, previous: previousCount, next: nextCount, delta });
    }
  }
  return {
    previous,
    next,
    deltas,
    changed
  };
}

function adoptionSurfaceKey(item) {
  return `${item?.bundle || "unbundled"}:${item?.kind || "unknown"}:${item?.item || item?.id || "unknown"}`;
}

function summarizeAdoptionSurface(item) {
  return {
    key: adoptionSurfaceKey(item),
    bundle: item?.bundle || "unbundled",
    kind: item?.kind || "unknown",
    item: item?.item || item?.id || "unknown",
    currentState: item?.current_state || null
  };
}

function summarizeAdoptionPlanDeltas(currentSurfaces = [], nextSurfaces = []) {
  const currentByKey = new Map((currentSurfaces || []).map((item) => [adoptionSurfaceKey(item), item]));
  const nextByKey = new Map((nextSurfaces || []).map((item) => [adoptionSurfaceKey(item), item]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [key, next] of nextByKey) {
    const current = currentByKey.get(key);
    if (!current) {
      added.push(summarizeAdoptionSurface(next));
    } else if (stableStringify(current) !== stableStringify(next)) {
      changed.push({
        ...summarizeAdoptionSurface(next),
        previousState: current.current_state || null,
        nextState: next.current_state || null
      });
    }
  }
  for (const [key, current] of currentByKey) {
    if (!nextByKey.has(key)) {
      removed.push(summarizeAdoptionSurface(current));
    }
  }
  const currentByBundle = countByField(currentSurfaces, "bundle");
  const nextByBundle = countByField(nextSurfaces, "bundle");
  return {
    added: added.sort((left, right) => left.key.localeCompare(right.key)),
    removed: removed.sort((left, right) => left.key.localeCompare(right.key)),
    changed: changed.sort((left, right) => left.key.localeCompare(right.key)),
    byBundle: buildCountDeltas(currentByBundle, nextByBundle)
  };
}

function adoptionSurfacesFromPlanFile(fileContents) {
  if (!fileContents) {
    return [];
  }
  const parsed = JSON.parse(fileContents);
  return parsed.imported_proposal_surfaces || [];
}

function buildRefreshPreviewReconcile(projectRoot, topogramRoot, importFiles) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-refresh-preview."));
  try {
    const tempProjectRoot = path.join(tempRoot, "workspace");
    const tempTopogramRoot = path.join(tempProjectRoot, "topogram");
    fs.mkdirSync(tempProjectRoot, { recursive: true });
    fs.cpSync(topogramRoot, tempTopogramRoot, { recursive: true });
    const projectConfigPath = path.join(projectRoot, "topogram.project.json");
    if (fs.existsSync(projectConfigPath)) {
      fs.cpSync(projectConfigPath, path.join(tempProjectRoot, "topogram.project.json"));
    }
    clearImportRefreshCandidateArtifacts(tempTopogramRoot);
    writeRelativeFiles(tempTopogramRoot, importFiles || {});
    const reconcileResult = runWorkflow("reconcile", tempProjectRoot, {});
    return {
      reconcileFileCount: Object.keys(reconcileResult.files || {}).length,
      reconcileFilePaths: Object.keys(reconcileResult.files || {}).sort((a, b) => a.localeCompare(b)),
      adoptionSurfaces: adoptionSurfacesFromPlanFile(reconcileResult.files?.["candidates/reconcile/adoption-plan.agent.json"]),
      summary: reconcileResult.summary || {}
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function readCurrentAdoptionSurfaces(topogramRoot) {
  const planPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-plan.agent.json");
  if (!fs.existsSync(planPath)) {
    return [];
  }
  return adoptionSurfacesFromPlanFile(fs.readFileSync(planPath, "utf8"));
}

function buildBrownfieldImportRefreshAnalysis(inputPath, options = {}) {
  const projectRoot = normalizeProjectRoot(inputPath);
  const topogramRoot = normalizeTopogramPath(projectRoot);
  if (!fs.existsSync(topogramRoot) || !fs.statSync(topogramRoot).isDirectory()) {
    throw new Error(`No topogram directory found for imported workspace '${inputPath}'.`);
  }

  const { record: importRecord } = readTopogramImportRecord(projectRoot);
  const sourcePath = options.sourcePath && !String(options.sourcePath).startsWith("-")
    ? options.sourcePath
    : importRecord.source?.path;
  if (!sourcePath) {
    throw new Error("No brownfield source path was provided or recorded. Use 'topogram import refresh <workspace> --from <app-path>'.");
  }
  const sourceRoot = path.resolve(sourcePath);
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new Error(`Cannot refresh from missing app directory '${sourcePath}'.`);
  }
  if (sourceRoot === projectRoot) {
    throw new Error("Refusing to refresh import from the imported Topogram workspace itself.");
  }

  const sourceComparison = compareImportRecordToSource(projectRoot, importRecord, sourceRoot);
  const trackValue = importTrackValueFromRecord(importRecord);
  const importResult = runWorkflow("import-app", sourceRoot, { from: trackValue });
  const candidateCounts = importCandidateCounts(importResult.summary);
  const candidateCountDeltas = buildCountDeltas(importRecord.import?.candidateCounts || {}, candidateCounts);
  const removedCandidateFiles = {
    rawCandidateFiles: countFilesRecursive(path.join(topogramRoot, "candidates", "app")),
    reconcileFiles: countFilesRecursive(path.join(topogramRoot, "candidates", "reconcile"))
  };
  const previewReconcile = buildRefreshPreviewReconcile(projectRoot, topogramRoot, importResult.files || {});
  const currentAdoptionSurfaces = readCurrentAdoptionSurfaces(topogramRoot);
  const adoptionPlanDeltas = summarizeAdoptionPlanDeltas(currentAdoptionSurfaces, previewReconcile.adoptionSurfaces);
  const receiptVerification = verifyImportAdoptionReceipts(projectRoot, readImportAdoptionReceipts(projectRoot));
  const plannedFiles = [
    TOPOGRAM_IMPORT_FILE,
    ...Object.keys(importResult.files || {}).map((filePath) => `topogram/${filePath}`),
    ...previewReconcile.reconcileFilePaths.map((filePath) => `topogram/${filePath}`)
  ].sort((a, b) => a.localeCompare(b));
  const analysis = {
    projectRoot,
    topogramRoot,
    sourcePath: sourceRoot,
    provenancePath: path.join(projectRoot, TOPOGRAM_IMPORT_FILE),
    importedAt: importRecord.importedAt || null,
    previousImportStatus: sourceComparison.status,
    sourceDiff: {
      status: sourceComparison.status,
      counts: sourceComparison.counts,
      changed: sourceComparison.content.changed,
      added: sourceComparison.content.added,
      removed: sourceComparison.content.removed
    },
    tracks: importResult.summary.tracks || [],
    sourceFiles: sourceComparison.files.length,
    removedCandidateFiles,
    rawCandidateFiles: Object.keys(importResult.files || {}).length,
    reconcileFiles: previewReconcile.reconcileFileCount,
    candidateCounts,
    candidateCountDeltas,
    adoptionPlanDeltas,
    receiptVerification,
    plannedFiles
  };
  Object.defineProperty(analysis, "importResult", {
    value: importResult,
    enumerable: false
  });
  return analysis;
}

/**
 * @param {string} sourcePath
 * @param {string} targetPath
 * @param {{ from?: string|null }} [options]
 * @returns {{ ok: boolean, sourcePath: string, targetPath: string, topogramRoot: string, projectConfigPath: string, provenancePath: string, tracks: string[], sourceFiles: number, rawCandidateFiles: number, reconcileFiles: number, writtenFiles: string[], candidateCounts: Record<string, number>, nextCommands: string[] }}
 */
function buildBrownfieldImportWorkspacePayload(sourcePath, targetPath, options = {}) {
  const sourceRoot = path.resolve(sourcePath);
  const targetRoot = path.resolve(targetPath);
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new Error(`Cannot import missing app directory '${sourcePath}'.`);
  }
  if (sourceRoot === targetRoot) {
    throw new Error("Refusing to import into the same directory as the brownfield app.");
  }
  ensureEmptyImportTarget(targetRoot);

  const topogramRoot = path.join(targetRoot, "topogram");
  fs.mkdirSync(topogramRoot, { recursive: true });
  const sourceFiles = collectImportSourceFileRecords(sourceRoot, { excludeRoots: [targetRoot] });
  const importResult = runWorkflow("import-app", sourceRoot, { from: options.from || null });
  const rawCandidateFiles = writeRelativeFiles(topogramRoot, importResult.files || {});

  const projectConfigPath = path.join(targetRoot, "topogram.project.json");
  fs.writeFileSync(projectConfigPath, `${stableStringify(importedProjectConfig())}\n`, "utf8");
  fs.writeFileSync(path.join(targetRoot, "README.md"), importedWorkspaceReadme(sourceRoot, targetRoot, importResult.summary), "utf8");

  const reconcileResult = runWorkflow("reconcile", targetRoot, {});
  const reconcileFiles = writeRelativeFiles(topogramRoot, reconcileResult.files || {});
  const candidateCounts = importCandidateCounts(importResult.summary);
  const provenance = writeTopogramImportRecord(targetRoot, {
    sourceRoot,
    ignoredRoots: [targetRoot],
    tracks: importResult.summary.tracks || [],
    findingsCount: importResult.summary.findings_count || 0,
    candidateCounts,
    files: sourceFiles
  });
  const writtenFiles = [
    "README.md",
    "topogram.project.json",
    TOPOGRAM_IMPORT_FILE,
    ...rawCandidateFiles.map((filePath) => `topogram/${filePath}`),
    ...reconcileFiles.map((filePath) => `topogram/${filePath}`)
  ].sort((a, b) => a.localeCompare(b));
  return {
    ok: true,
    sourcePath: sourceRoot,
    targetPath: targetRoot,
    topogramRoot,
    projectConfigPath,
    provenancePath: provenance.path,
    tracks: importResult.summary.tracks || [],
    sourceFiles: sourceFiles.length,
    rawCandidateFiles: rawCandidateFiles.length,
    reconcileFiles: reconcileFiles.length,
    writtenFiles,
    candidateCounts,
    nextCommands: [
      "topogram import check",
      "topogram import plan",
      "topogram import adopt bundle:task --dry-run",
      "topogram import status",
      "topogram check",
      "topogram query import-plan ./topogram"
    ]
  };
}

/**
 * @param {string} inputPath
 * @param {{ sourcePath?: string|null, dryRun?: boolean }} [options]
 * @returns {{ ok: boolean, dryRun: boolean, projectRoot: string, topogramRoot: string, sourcePath: string, provenancePath: string, previousImportStatus: string, currentImportStatus: string, tracks: string[], sourceFiles: number, sourceDiff: Record<string, any>, removedCandidateFiles: Record<string, number>, rawCandidateFiles: number, reconcileFiles: number, writtenFiles: string[], plannedFiles: string[], candidateCounts: Record<string, number>, candidateCountDeltas: Record<string, any>, adoptionPlanDeltas: Record<string, any>, receiptVerification: Record<string, any>, refreshMetadata: Record<string, any>|null, nextCommands: string[] }}
 */
function buildBrownfieldImportRefreshPayload(inputPath, options = {}) {
  const analysis = buildBrownfieldImportRefreshAnalysis(inputPath, options);
  const dryRun = Boolean(options.dryRun);
  let provenancePath = analysis.provenancePath;
  let currentImportStatus = dryRun ? analysis.previousImportStatus : "unknown";
  let writtenFiles = [];
  let refreshMetadata = null;
  if (!dryRun) {
    const removedCandidateFiles = clearImportRefreshCandidateArtifacts(analysis.topogramRoot);
    const rawCandidateFiles = writeRelativeFiles(analysis.topogramRoot, analysis.importResult.files || {});
    const reconcileResult = runWorkflow("reconcile", analysis.projectRoot, {});
    const reconcileFiles = writeRelativeFiles(analysis.topogramRoot, reconcileResult.files || {});
    const refreshedAt = new Date().toISOString();
    refreshMetadata = {
      refreshedAt,
      previousSourceStatus: analysis.previousImportStatus,
      sourceDiffCounts: analysis.sourceDiff.counts
    };
    const provenance = writeTopogramImportRecord(analysis.projectRoot, {
      sourceRoot: analysis.sourcePath,
      ignoredRoots: [analysis.projectRoot],
      importedAt: analysis.importedAt || undefined,
      refreshedAt,
      refresh: {
        previousSourceStatus: analysis.previousImportStatus,
        sourceDiffCounts: analysis.sourceDiff.counts
      },
      tracks: analysis.importResult.summary.tracks || [],
      findingsCount: analysis.importResult.summary.findings_count || 0,
      candidateCounts: analysis.candidateCounts,
      files: collectImportSourceFileRecords(analysis.sourcePath, { excludeRoots: [analysis.projectRoot] })
    });
    provenancePath = provenance.path;
    currentImportStatus = buildTopogramImportStatus(analysis.projectRoot).status;
    writtenFiles = [
      TOPOGRAM_IMPORT_FILE,
      ...rawCandidateFiles.map((filePath) => `topogram/${filePath}`),
      ...reconcileFiles.map((filePath) => `topogram/${filePath}`)
    ].sort((a, b) => a.localeCompare(b));
    analysis.removedCandidateFiles = removedCandidateFiles;
    analysis.rawCandidateFiles = rawCandidateFiles.length;
    analysis.reconcileFiles = reconcileFiles.length;
  }
  return {
    ok: dryRun || currentImportStatus === "clean",
    dryRun,
    projectRoot: analysis.projectRoot,
    topogramRoot: analysis.topogramRoot,
    sourcePath: analysis.sourcePath,
    provenancePath,
    previousImportStatus: analysis.previousImportStatus,
    currentImportStatus,
    tracks: analysis.tracks,
    sourceFiles: analysis.sourceFiles,
    sourceDiff: analysis.sourceDiff,
    removedCandidateFiles: analysis.removedCandidateFiles,
    rawCandidateFiles: analysis.rawCandidateFiles,
    reconcileFiles: analysis.reconcileFiles,
    writtenFiles,
    plannedFiles: analysis.plannedFiles,
    candidateCounts: analysis.candidateCounts,
    candidateCountDeltas: analysis.candidateCountDeltas,
    adoptionPlanDeltas: analysis.adoptionPlanDeltas,
    receiptVerification: analysis.receiptVerification,
    refreshMetadata,
    nextCommands: [
      dryRun
        ? `topogram import refresh ${importProjectCommandPath(analysis.projectRoot)}`
        : `topogram import check ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram import plan ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram import status ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram import history ${importProjectCommandPath(analysis.projectRoot)} --verify`
    ]
  };
}

function buildBrownfieldImportDiffPayload(inputPath, options = {}) {
  const analysis = buildBrownfieldImportRefreshAnalysis(inputPath, options);
  return {
    ok: true,
    projectRoot: analysis.projectRoot,
    topogramRoot: analysis.topogramRoot,
    sourcePath: analysis.sourcePath,
    provenancePath: analysis.provenancePath,
    importStatus: analysis.previousImportStatus,
    sourceDiff: analysis.sourceDiff,
    tracks: analysis.tracks,
    sourceFiles: analysis.sourceFiles,
    candidateCounts: analysis.candidateCounts,
    candidateCountDeltas: analysis.candidateCountDeltas,
    adoptionPlanDeltas: analysis.adoptionPlanDeltas,
    receiptVerification: analysis.receiptVerification,
    plannedFiles: analysis.plannedFiles,
    nextCommands: [
      `topogram import refresh ${importProjectCommandPath(analysis.projectRoot)} --dry-run`,
      `topogram import refresh ${importProjectCommandPath(analysis.projectRoot)}`,
      `topogram import plan ${importProjectCommandPath(analysis.projectRoot)}`
    ]
  };
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportWorkspacePayload>} payload
 * @returns {void}
 */
function printBrownfieldImportWorkspace(payload) {
  console.log(`Imported brownfield app to ${payload.targetPath}.`);
  console.log(`Source: ${payload.sourcePath}`);
  console.log(`Topogram: ${payload.topogramRoot}`);
  console.log(`Project config: ${payload.projectConfigPath}`);
  console.log(`Import provenance: ${payload.provenancePath}`);
  console.log(`Tracked source files: ${payload.sourceFiles}`);
  console.log(`Raw candidate files: ${payload.rawCandidateFiles}`);
  console.log(`Reconcile proposal files: ${payload.reconcileFiles}`);
  console.log("Imported Topogram artifacts are project-owned after creation; source hashes record the app evidence trusted at import time.");
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${shellCommandArg(path.relative(process.cwd(), payload.targetPath) || ".")}`);
  for (const command of payload.nextCommands) {
    console.log(`  ${command}`);
  }
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportRefreshPayload>} payload
 * @returns {void}
 */
function printBrownfieldImportRefresh(payload) {
  console.log(`${payload.dryRun ? "Previewed" : "Refreshed"} brownfield import candidates for ${payload.projectRoot}.`);
  console.log(`Source: ${payload.sourcePath}`);
  console.log(`Topogram: ${payload.topogramRoot}`);
  console.log(`Import provenance: ${payload.provenancePath}`);
  console.log(`Previous source status: ${payload.previousImportStatus}`);
  console.log(`Current source status: ${payload.currentImportStatus}`);
  console.log(`Source diff: changed=${payload.sourceDiff.counts.changed}, added=${payload.sourceDiff.counts.added}, removed=${payload.sourceDiff.counts.removed}`);
  console.log(`Tracked source files: ${payload.sourceFiles}`);
  console.log(`Raw candidate files: ${payload.rawCandidateFiles}`);
  console.log(`Reconcile proposal files: ${payload.reconcileFiles}`);
  console.log(`Replaced candidate files: ${payload.removedCandidateFiles.rawCandidateFiles + payload.removedCandidateFiles.reconcileFiles}`);
  const candidateChanges = payload.candidateCountDeltas.changed || [];
  console.log(`Candidate count changes: ${candidateChanges.length}`);
  for (const item of candidateChanges.slice(0, 8)) {
    const sign = item.delta > 0 ? "+" : "";
    console.log(`- ${item.key}: ${item.previous} -> ${item.next} (${sign}${item.delta})`);
  }
  const adoptionDeltas = payload.adoptionPlanDeltas;
  console.log(`Adoption plan changes: added=${adoptionDeltas.added.length}, removed=${adoptionDeltas.removed.length}, changed=${adoptionDeltas.changed.length}`);
  console.log(`Receipt verification: ${payload.receiptVerification.status}`);
  if (payload.dryRun) {
    console.log("No files were written. Re-run without --dry-run to refresh candidates and source provenance.");
  }
  console.log("Canonical Topogram files were not overwritten. Adopt refreshed candidates explicitly after review.");
  console.log("");
  console.log("Next steps:");
  for (const command of payload.nextCommands) {
    console.log(`  ${command}`);
  }
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportDiffPayload>} payload
 * @returns {void}
 */
function printBrownfieldImportDiff(payload) {
  console.log(`Import diff for ${payload.projectRoot}`);
  console.log(`Source: ${payload.sourcePath}`);
  console.log(`Source status: ${payload.importStatus}`);
  console.log(`Source diff: changed=${payload.sourceDiff.counts.changed}, added=${payload.sourceDiff.counts.added}, removed=${payload.sourceDiff.counts.removed}`);
  for (const filePath of [...payload.sourceDiff.changed, ...payload.sourceDiff.added, ...payload.sourceDiff.removed].slice(0, 12)) {
    const status = payload.sourceDiff.changed.includes(filePath)
      ? "changed"
      : payload.sourceDiff.added.includes(filePath)
        ? "added"
        : "removed";
    console.log(`- ${filePath}: ${status}`);
  }
  console.log("");
  console.log("Candidate count changes:");
  const candidateChanges = payload.candidateCountDeltas.changed || [];
  if (candidateChanges.length === 0) {
    console.log("- None");
  } else {
    for (const item of candidateChanges) {
      const sign = item.delta > 0 ? "+" : "";
      console.log(`- ${item.key}: ${item.previous} -> ${item.next} (${sign}${item.delta})`);
    }
  }
  console.log("");
  console.log(`Adoption plan changes: added=${payload.adoptionPlanDeltas.added.length}, removed=${payload.adoptionPlanDeltas.removed.length}, changed=${payload.adoptionPlanDeltas.changed.length}`);
  for (const item of payload.adoptionPlanDeltas.added.slice(0, 8)) {
    console.log(`- added ${item.bundle}/${item.kind}/${item.item}`);
  }
  for (const item of payload.adoptionPlanDeltas.removed.slice(0, 8)) {
    console.log(`- removed ${item.bundle}/${item.kind}/${item.item}`);
  }
  console.log(`Receipt verification: ${payload.receiptVerification.status}`);
  const receiptSummary = payload.receiptVerification.summary;
  console.log(`Adopted file audit: changed=${receiptSummary.changedFileCount}, removed=${receiptSummary.removedFileCount}, unverifiable=${receiptSummary.unverifiableFileCount}`);
  console.log("");
  console.log("Next steps:");
  for (const command of payload.nextCommands) {
    console.log(`  ${command}`);
  }
}

/**
 * @param {string} inputPath
 * @returns {ReturnType<typeof checkSummaryPayload>}
 */
function buildTopogramCheckPayloadForPath(inputPath) {
  const ast = parsePath(inputPath);
  const resolved = resolveWorkspace(ast);
  const explicitProjectConfig = loadProjectConfig(inputPath);
  const projectValidation = explicitProjectConfig
    ? combineProjectValidationResults(
        validateProjectConfig(explicitProjectConfig.config, resolved.ok ? resolved.graph : null, { configDir: explicitProjectConfig.configDir }),
        validateProjectOutputOwnership(explicitProjectConfig),
        validateProjectImplementationTrust(explicitProjectConfig)
      )
    : { ok: false, errors: [{ message: "Missing topogram.project.json or compatible topogram.implementation.json", loc: null }] };
  return checkSummaryPayload({ inputPath, ast, resolved, projectConfigInfo: explicitProjectConfig, projectValidation });
}

/**
 * @param {string} projectRoot
 * @returns {{ ok: boolean, projectRoot: string, import: ReturnType<typeof buildTopogramImportStatus>, topogram: ReturnType<typeof buildTopogramCheckPayloadForPath>, errors: any[] }}
 */
function buildBrownfieldImportCheckPayload(projectRoot) {
  const resolvedRoot = normalizeProjectRoot(projectRoot);
  const importStatus = buildTopogramImportStatus(resolvedRoot);
  const topogramCheck = buildTopogramCheckPayloadForPath(resolvedRoot);
  return {
    ok: importStatus.ok && topogramCheck.ok,
    projectRoot: resolvedRoot,
    import: importStatus,
    topogram: topogramCheck,
    errors: [
      ...(importStatus.errors || []).map((message) => ({ source: "import", message })),
      ...(topogramCheck.errors || [])
    ]
  };
}

/**
 * @param {ReturnType<typeof buildBrownfieldImportCheckPayload>} payload
 * @returns {void}
 */
function printBrownfieldImportCheck(payload) {
  console.log(`Topogram import check: ${payload.import.status}`);
  console.log(`Project: ${payload.projectRoot}`);
  if (payload.import.source?.source?.path) {
    console.log(`Imported source: ${payload.import.source.source.path}`);
  }
  console.log(`Provenance: ${payload.import.path}`);
  if (payload.import.source?.files) {
    console.log(`Trusted source files: ${payload.import.source.files.length}`);
  }
  if (payload.import.status === "changed") {
    console.log(`Changed source files: ${payload.import.content.changed.length}`);
    console.log(`Added source files: ${payload.import.content.added.length}`);
    console.log(`Removed source files: ${payload.import.content.removed.length}`);
  }
  console.log(`Topogram check: ${payload.topogram.ok ? "passed" : "failed"}`);
  console.log("Imported Topogram artifacts are project-owned; import check compares only the brownfield source hashes trusted at import time plus normal Topogram validity.");
  for (const diagnostic of payload.import.diagnostics || []) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.message}`);
    if (diagnostic.suggestedFix) {
      console.log(`Fix: ${diagnostic.suggestedFix}`);
    }
  }
  for (const error of payload.topogram.errors || []) {
    console.log(`Error: ${error.message}`);
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function importAdoptionsPath(projectRoot) {
  return path.join(normalizeProjectRoot(projectRoot), TOPOGRAM_IMPORT_ADOPTIONS_FILE);
}

function readImportAdoptionReceipts(projectRoot) {
  const historyPath = importAdoptionsPath(projectRoot);
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  return fs.readFileSync(historyPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid import adoption receipt JSON at ${historyPath}:${index + 1}.`);
      }
    });
}

function appendImportAdoptionReceipt(projectRoot, receipt) {
  const historyPath = importAdoptionsPath(projectRoot);
  fs.appendFileSync(historyPath, `${JSON.stringify(receipt)}\n`, "utf8");
  return historyPath;
}

function countByField(items, fieldName) {
  const counts = {};
  for (const item of items || []) {
    const key = item?.[fieldName] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function importProjectCommandPath(projectRoot) {
  return shellCommandArg(path.relative(process.cwd(), projectRoot) || ".");
}

function importAdoptCommand(projectRoot, selector, write = false) {
  return `topogram import adopt ${selector} ${importProjectCommandPath(projectRoot)} ${write ? "--write" : "--dry-run"}`;
}

const BROWNFIELD_BROAD_ADOPT_SELECTORS = [
  {
    selector: "from-plan",
    kind: "plan",
    label: "approved or pending plan items",
    matches: (item) => item.current_state === "stage" || item.current_state === "accept"
  },
  { selector: "actors", kind: "kind", label: "actors", matches: (item) => item.kind === "actor" },
  { selector: "roles", kind: "kind", label: "roles", matches: (item) => item.kind === "role" },
  { selector: "enums", kind: "kind", label: "enums", matches: (item) => item.kind === "enum" },
  { selector: "shapes", kind: "kind", label: "shapes", matches: (item) => item.kind === "shape" },
  { selector: "entities", kind: "kind", label: "entities", matches: (item) => item.kind === "entity" },
  { selector: "capabilities", kind: "kind", label: "capabilities", matches: (item) => item.kind === "capability" },
  { selector: "widgets", kind: "kind", label: "widgets", matches: (item) => item.kind === "widget" },
  { selector: "docs", kind: "track", label: "docs", matches: (item) => item.track === "docs" },
  {
    selector: "journeys",
    kind: "track",
    label: "journey docs",
    matches: (item) => item.track === "docs" && String(item.canonical_rel_path || "").startsWith("docs/journeys/")
  },
  { selector: "workflows", kind: "track", label: "workflows", matches: (item) => item.track === "workflows" || item.kind === "decision" },
  { selector: "verification", kind: "kind", label: "verification", matches: (item) => item.kind === "verification" },
  { selector: "ui", kind: "track", label: "UI reports and widgets", matches: (item) => item.track === "ui" }
];

function readImportAdoptionArtifacts(inputPath) {
  const projectRoot = normalizeProjectRoot(inputPath);
  const topogramRoot = normalizeTopogramPath(inputPath);
  const reconcileRoot = path.join(topogramRoot, "candidates", "reconcile");
  const paths = {
    reconcileRoot,
    adoptionPlanAgent: path.join(reconcileRoot, "adoption-plan.agent.json"),
    adoptionPlan: path.join(reconcileRoot, "adoption-plan.json"),
    adoptionStatus: path.join(reconcileRoot, "adoption-status.json"),
    reconcileReport: path.join(reconcileRoot, "report.json")
  };
  if (!fs.existsSync(paths.adoptionPlanAgent)) {
    throw new Error(`No import adoption plan found under '${reconcileRoot}'. Run 'topogram import <app-path> --out <target>' first.`);
  }
  return {
    projectRoot,
    topogramRoot,
    paths,
    adoptionPlan: JSON.parse(fs.readFileSync(paths.adoptionPlanAgent, "utf8")),
    adoptionStatus: readJsonIfExists(paths.adoptionStatus),
    reconcileReport: readJsonIfExists(paths.reconcileReport)
  };
}

function buildBrownfieldBroadAdoptSelectors(projectRoot, adoptionPlan) {
  const surfaces = adoptionPlan.imported_proposal_surfaces || [];
  return BROWNFIELD_BROAD_ADOPT_SELECTORS.map((definition) => {
    const items = surfaces.filter(definition.matches);
    const pendingItems = items.filter((item) => !["accept", "accepted", "applied"].includes(item.current_state));
    const appliedItems = items.filter((item) => ["accept", "accepted", "applied"].includes(item.current_state));
    const blockedItems = items.filter((item) => item.human_review_required);
    return {
      selector: definition.selector,
      kind: definition.kind,
      label: definition.label,
      itemCount: items.length,
      pendingItemCount: pendingItems.length,
      appliedItemCount: appliedItems.length,
      blockedItemCount: blockedItems.length,
      previewCommand: importAdoptCommand(projectRoot, definition.selector, false),
      writeCommand: importAdoptCommand(projectRoot, definition.selector, true)
    };
  }).filter((selector) => selector.itemCount > 0);
}

function summarizeImportAdoption(adoptionPlan, adoptionStatus, projectRoot) {
  const surfaces = adoptionPlan.imported_proposal_surfaces || [];
  const slugs = [];
  const surfaceMap = new Map();
  for (const surface of surfaces) {
    const slug = surface.bundle || "unbundled";
    if (!surfaceMap.has(slug)) {
      surfaceMap.set(slug, []);
      slugs.push(slug);
    }
    surfaceMap.get(slug).push(surface);
  }
  for (const item of adoptionStatus?.bundle_priorities || []) {
    if (item?.bundle && !surfaceMap.has(item.bundle)) {
      surfaceMap.set(item.bundle, []);
      slugs.push(item.bundle);
    }
  }
  const blockersByBundle = new Map((adoptionStatus?.bundle_blockers || []).map((item) => [item.bundle, item]));
  const prioritiesByBundle = new Map((adoptionStatus?.bundle_priorities || []).map((item) => [item.bundle, item]));
  const bundles = slugs.sort((left, right) => left.localeCompare(right)).map((slug) => {
    const bundleSurfaces = surfaceMap.get(slug) || [];
    const blocker = blockersByBundle.get(slug) || null;
    const priority = prioritiesByBundle.get(slug) || null;
    const pendingItems = blocker?.pending_items || bundleSurfaces
      .filter((item) => !["accept", "accepted", "applied"].includes(item.current_state))
      .map((item) => item.item);
    const appliedItems = blocker?.applied_items || [];
    const blockedItems = blocker?.blocked_items || [];
    return {
      bundle: slug,
      itemCount: bundleSurfaces.length,
      pendingItemCount: pendingItems.length,
      appliedItemCount: appliedItems.length,
      blockedItemCount: blockedItems.length,
      humanReviewRequiredCount: bundleSurfaces.filter((item) => item.human_review_required).length,
      kindCounts: countByField(bundleSurfaces, "kind"),
      complete: Boolean(priority?.is_complete) || (pendingItems.length === 0 && blockedItems.length === 0 && appliedItems.length > 0),
      evidenceScore: priority?.evidence_score || 0,
      why: priority?.operator_summary?.whyThisBundle || null,
      nextCommand: importAdoptCommand(projectRoot, `bundle:${slug}`, false)
    };
  });
  const nextBundle = bundles.find((bundle) => !bundle.complete && bundle.pendingItemCount > 0) || bundles.find((bundle) => !bundle.complete) || bundles[0] || null;
  const blockedCount = bundles.reduce((total, bundle) => total + bundle.blockedItemCount, 0);
  const pendingCount = bundles.reduce((total, bundle) => total + bundle.pendingItemCount, 0);
  const appliedCount = adoptionStatus?.applied_item_count ?? bundles.reduce((total, bundle) => total + bundle.appliedItemCount, 0);
  return {
    summary: {
      bundleCount: bundles.length,
      proposalItemCount: surfaces.length,
      pendingItemCount: pendingCount,
      appliedItemCount: appliedCount,
      blockedItemCount: blockedCount,
      requiresHumanReviewCount: (adoptionPlan.requires_human_review || []).length || surfaces.filter((item) => item.human_review_required).length
    },
    bundles,
    risks: [
      ...(blockedCount > 0 ? [`${blockedCount} adoption item(s) are blocked.`] : []),
      ...(((adoptionPlan.requires_human_review || []).length || surfaces.some((item) => item.human_review_required))
        ? ["Imported proposal items require human review before adoption."]
        : [])
    ],
    nextCommand: nextBundle ? nextBundle.nextCommand : `topogram import status ${importProjectCommandPath(projectRoot)}`
  };
}

function buildBrownfieldImportPlanPayload(inputPath) {
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const adoptionStatus = runWorkflow("adoption-status", artifacts.projectRoot).summary || artifacts.adoptionStatus || {};
  const adoption = summarizeImportAdoption(artifacts.adoptionPlan, adoptionStatus, artifacts.projectRoot);
  return {
    ok: true,
    projectRoot: artifacts.projectRoot,
    topogramRoot: artifacts.topogramRoot,
    artifacts: {
      adoptionPlan: artifacts.paths.adoptionPlanAgent,
      adoptionStatus: artifacts.paths.adoptionStatus,
      reconcileReport: artifacts.paths.reconcileReport
    },
    ...adoption,
    commands: {
      check: `topogram import check ${importProjectCommandPath(artifacts.projectRoot)}`,
      status: `topogram import status ${importProjectCommandPath(artifacts.projectRoot)}`,
      next: adoption.nextCommand
    }
  };
}

function printBrownfieldImportPlan(payload) {
  console.log(`Import adoption plan for ${payload.projectRoot}`);
  console.log(`Proposal items: ${payload.summary.proposalItemCount}`);
  console.log(`Bundles: ${payload.summary.bundleCount}`);
  for (const bundle of payload.bundles) {
    console.log(`- ${bundle.bundle}: ${bundle.itemCount} item(s), ${bundle.pendingItemCount} pending, ${bundle.appliedItemCount} applied`);
    if (bundle.why) {
      console.log(`  ${bundle.why}`);
    }
    console.log(`  Preview: ${bundle.nextCommand}`);
  }
  if (payload.risks.length > 0) {
    console.log("Risks:");
    for (const risk of payload.risks) {
      console.log(`- ${risk}`);
    }
  }
  console.log("");
  console.log(`Next: ${payload.nextCommand}`);
}

function buildBrownfieldImportAdoptListPayload(inputPath) {
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const plan = buildBrownfieldImportPlanPayload(inputPath);
  const selectors = plan.bundles.map((bundle) => ({
    selector: `bundle:${bundle.bundle}`,
    kind: "bundle",
    bundle: bundle.bundle,
    itemCount: bundle.itemCount,
    pendingItemCount: bundle.pendingItemCount,
    appliedItemCount: bundle.appliedItemCount,
    blockedItemCount: bundle.blockedItemCount,
    complete: bundle.complete,
    previewCommand: importAdoptCommand(plan.projectRoot, `bundle:${bundle.bundle}`, false),
    writeCommand: importAdoptCommand(plan.projectRoot, `bundle:${bundle.bundle}`, true)
  }));
  const broadSelectors = buildBrownfieldBroadAdoptSelectors(plan.projectRoot, artifacts.adoptionPlan);
  return {
    ok: true,
    projectRoot: plan.projectRoot,
    topogramRoot: plan.topogramRoot,
    selectorCount: selectors.length,
    selectors,
    broadSelectorCount: broadSelectors.length,
    broadSelectors,
    nextCommand: selectors.find((selector) => !selector.complete)?.previewCommand || plan.commands.status
  };
}

function printBrownfieldImportAdoptList(payload) {
  console.log(`Import adoption selectors for ${payload.projectRoot}`);
  if (payload.selectors.length === 0) {
    console.log("No adoption selectors are available. Run `topogram import plan` to inspect reconcile artifacts.");
    return;
  }
  for (const selector of payload.selectors) {
    console.log(`- ${selector.selector}: ${selector.itemCount} item(s), ${selector.pendingItemCount} pending, ${selector.appliedItemCount} applied`);
    console.log(`  Preview: ${selector.previewCommand}`);
    console.log(`  Write: ${selector.writeCommand}`);
  }
  if (payload.broadSelectors.length > 0) {
    console.log("");
    console.log("Broad selectors:");
    for (const selector of payload.broadSelectors) {
      console.log(`- ${selector.selector}: ${selector.itemCount} ${selector.label}`);
      console.log(`  Preview: ${selector.previewCommand}`);
      console.log(`  Write: ${selector.writeCommand}`);
    }
  }
  console.log("");
  console.log(`Next: ${payload.nextCommand}`);
}

function writtenFileHashesForReceipt(outputRoot, writtenFiles) {
  return (writtenFiles || []).map((relativePath) => {
    const filePath = path.join(outputRoot, relativePath);
    const hash = fs.existsSync(filePath) ? projectFileHash(filePath) : null;
    return {
      path: relativePath,
      sha256: hash?.sha256 || null,
      size: hash?.size || null
    };
  });
}

function buildImportAdoptionReceipt({ artifacts, selector, options, importStatus, summary, writtenFiles, outputRoot }) {
  return {
    type: "topogram_import_adoption_receipt",
    version: "0.1",
    timestamp: new Date().toISOString(),
    cli: {
      packageName: CLI_PACKAGE_NAME,
      version: readInstalledCliPackageVersion()
    },
    projectRoot: artifacts.projectRoot,
    topogramRoot: artifacts.topogramRoot,
    selector,
    mode: "write",
    dryRun: false,
    forced: Boolean(options.force),
    reason: options.reason || null,
    sourceProvenance: {
      ok: importStatus.ok,
      status: importStatus.status,
      path: importStatus.path || null,
      changed: importStatus.content?.changed || [],
      added: importStatus.content?.added || [],
      removed: importStatus.content?.removed || []
    },
    promotedCanonicalItems: (summary.promoted_canonical_items || []).map((item) => ({
      bundle: item.bundle || null,
      kind: item.kind || null,
      item: item.item || null,
      canonicalRelPath: item.canonical_rel_path || null,
      sourcePath: item.source_path || null,
      changeType: item.change_type || null
    })),
    writtenFiles,
    writtenFileHashes: writtenFileHashesForReceipt(outputRoot, writtenFiles),
    outputRoot
  };
}

function buildBrownfieldImportAdoptPayload(selector, inputPath, options = {}) {
  if (!selector) {
    throw new Error("Missing required <selector>. Example: topogram import adopt bundle:task --dry-run");
  }
  if (options.write && options.dryRun) {
    throw new Error("Use either --dry-run or --write, not both.");
  }
  if (options.write && options.force && !options.reason) {
    throw new Error("Forced import adoption writes require --reason <text>.");
  }
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const importStatus = buildTopogramImportStatus(artifacts.projectRoot);
  if (options.write && !options.force && !importStatus.ok) {
    throw new Error(`Refusing to write import adoption because brownfield source provenance is ${importStatus.status}. Run 'topogram import check ${importProjectCommandPath(artifacts.projectRoot)}', review the changed source evidence, rerun import, or pass --force --reason <text> after review.`);
  }
  const result = runWorkflow("reconcile", artifacts.projectRoot, {
    adopt: selector,
    write: Boolean(options.write),
    refreshAdopted: Boolean(options.refreshAdopted)
  });
  const outputRoot = path.resolve(result.defaultOutDir || artifacts.topogramRoot);
  const writtenFiles = options.write ? writeRelativeFiles(outputRoot, result.files || {}) : [];
  const summary = result.summary || {};
  const receipt = options.write
    ? buildImportAdoptionReceipt({ artifacts, selector, options, importStatus, summary, writtenFiles, outputRoot })
    : null;
  const receiptPath = receipt ? appendImportAdoptionReceipt(artifacts.projectRoot, receipt) : null;
  return {
    ok: true,
    projectRoot: artifacts.projectRoot,
    topogramRoot: artifacts.topogramRoot,
    selector,
    dryRun: !options.write,
    write: Boolean(options.write),
    forced: Boolean(options.force),
    reason: options.reason || null,
    outputRoot,
    promotedCanonicalItemCount: (summary.promoted_canonical_items || []).length,
    promotedCanonicalItems: summary.promoted_canonical_items || [],
    writtenFiles,
    receipt,
    receiptPath,
    adoption: summary,
    import: importStatus,
    warnings: options.write && options.force && !importStatus.ok
      ? [`Brownfield source provenance is ${importStatus.status}; adoption write was forced with reason: ${options.reason}.`]
      : [],
    nextCommands: options.write
      ? [
          `topogram import history ${importProjectCommandPath(artifacts.projectRoot)}`,
          `topogram import status ${importProjectCommandPath(artifacts.projectRoot)}`,
          `topogram check ${importProjectCommandPath(artifacts.projectRoot)}`
        ]
      : [
          importAdoptCommand(artifacts.projectRoot, selector, true),
          `topogram import status ${importProjectCommandPath(artifacts.projectRoot)}`
        ]
  };
}

function printBrownfieldImportAdopt(payload) {
  console.log(`${payload.dryRun ? "Previewed" : "Applied"} import adoption for ${payload.selector}.`);
  console.log(`Project: ${payload.projectRoot}`);
  console.log(`Promoted canonical items: ${payload.promotedCanonicalItemCount}`);
  console.log(`Written files: ${payload.writtenFiles.length}`);
  if (payload.receiptPath) {
    console.log(`Receipt: ${payload.receiptPath}`);
  }
  if (payload.dryRun) {
    console.log("No files were written. Re-run with --write to promote these candidates.");
  }
  for (const warning of payload.warnings || []) {
    console.log(`Warning: ${warning}`);
  }
  console.log("");
  console.log("Next steps:");
  for (const command of payload.nextCommands) {
    console.log(`  ${command}`);
  }
}

function buildBrownfieldImportStatusPayload(inputPath) {
  const artifacts = readImportAdoptionArtifacts(inputPath);
  const importCheck = buildBrownfieldImportCheckPayload(artifacts.projectRoot);
  const adoptionStatus = runWorkflow("adoption-status", artifacts.projectRoot).summary || artifacts.adoptionStatus || {};
  const adoption = summarizeImportAdoption(artifacts.adoptionPlan, adoptionStatus, artifacts.projectRoot);
  const history = buildBrownfieldImportHistoryPayload(artifacts.projectRoot);
  return {
    ok: importCheck.ok,
    projectRoot: artifacts.projectRoot,
    topogramRoot: artifacts.topogramRoot,
    import: importCheck.import,
    topogram: importCheck.topogram,
    adoption: {
      status: adoptionStatus,
      summary: adoption.summary,
      bundles: adoption.bundles,
      risks: adoption.risks,
      nextCommand: adoption.nextCommand,
      history: history.summary
    },
    errors: importCheck.errors
  };
}

function printBrownfieldImportStatus(payload) {
  console.log(`Import status: ${payload.import.status}`);
  console.log(`Topogram check: ${payload.topogram.ok ? "passed" : "failed"}`);
  console.log(`Adoption: ${payload.adoption.summary.appliedItemCount} applied, ${payload.adoption.summary.pendingItemCount} pending, ${payload.adoption.summary.blockedItemCount} blocked`);
  const next = payload.adoption.nextCommand;
  if (next) {
    console.log(`Next: ${next}`);
  }
}

function verifyImportAdoptionReceipts(projectRoot, receipts) {
  const topogramRoot = normalizeTopogramPath(projectRoot);
  const files = [];
  for (const receipt of receipts || []) {
    const hashedFiles = Array.isArray(receipt.writtenFileHashes) ? receipt.writtenFileHashes : [];
    const hashedPaths = new Set(hashedFiles.map((item) => item.path));
    for (const item of hashedFiles) {
      const relativePath = item.path;
      const filePath = path.join(topogramRoot, relativePath);
      if (!fs.existsSync(filePath)) {
        files.push({
          receiptTimestamp: receipt.timestamp || null,
          selector: receipt.selector || null,
          path: relativePath,
          status: "removed",
          expectedSha256: item.sha256 || null,
          currentSha256: null,
          expectedSize: item.size ?? null,
          currentSize: null
        });
        continue;
      }
      const currentHash = projectFileHash(filePath);
      const matches = item.sha256 === currentHash.sha256 && item.size === currentHash.size;
      files.push({
        receiptTimestamp: receipt.timestamp || null,
        selector: receipt.selector || null,
        path: relativePath,
        status: matches ? "matched" : "changed",
        expectedSha256: item.sha256 || null,
        currentSha256: currentHash.sha256,
        expectedSize: item.size ?? null,
        currentSize: currentHash.size
      });
    }
    for (const relativePath of receipt.writtenFiles || []) {
      if (hashedPaths.has(relativePath)) {
        continue;
      }
      files.push({
        receiptTimestamp: receipt.timestamp || null,
        selector: receipt.selector || null,
        path: relativePath,
        status: "unverifiable",
        expectedSha256: null,
        currentSha256: null,
        expectedSize: null,
        currentSize: null
      });
    }
  }
  const summary = {
    checkedFileCount: files.length,
    matchedFileCount: files.filter((item) => item.status === "matched").length,
    changedFileCount: files.filter((item) => item.status === "changed").length,
    removedFileCount: files.filter((item) => item.status === "removed").length,
    unverifiableFileCount: files.filter((item) => item.status === "unverifiable").length
  };
  const status = summary.changedFileCount > 0 || summary.removedFileCount > 0
    ? "changed"
    : summary.unverifiableFileCount > 0
      ? "unverifiable"
      : "matched";
  return {
    status,
    summary,
    files,
    auditOnly: true,
    note: "History verification is audit-only. Imported/adopted Topogram files are project-owned, and edits do not make the workspace invalid."
  };
}

function buildBrownfieldImportHistoryPayload(inputPath, options = {}) {
  const projectRoot = normalizeProjectRoot(inputPath);
  const historyPath = importAdoptionsPath(projectRoot);
  const receipts = readImportAdoptionReceipts(projectRoot);
  const forcedWrites = receipts.filter((receipt) => receipt.forced);
  const verification = options.verify ? verifyImportAdoptionReceipts(projectRoot, receipts) : null;
  return {
    ok: true,
    projectRoot,
    path: historyPath,
    exists: fs.existsSync(historyPath),
    verified: Boolean(options.verify),
    summary: {
      receiptCount: receipts.length,
      writeCount: receipts.filter((receipt) => receipt.mode === "write").length,
      forcedWriteCount: forcedWrites.length,
      lastTimestamp: receipts[receipts.length - 1]?.timestamp || null,
      lastSelector: receipts[receipts.length - 1]?.selector || null
    },
    verification,
    receipts
  };
}

function printBrownfieldImportHistory(payload) {
  console.log(`Import adoption history for ${payload.projectRoot}`);
  console.log(`Receipts: ${payload.summary.receiptCount}`);
  console.log(`Forced writes: ${payload.summary.forcedWriteCount}`);
  if (!payload.exists) {
    console.log(`No history file found at ${payload.path}.`);
    return;
  }
  for (const receipt of payload.receipts) {
    const forced = receipt.forced ? " forced" : "";
    const reason = receipt.reason ? ` reason="${receipt.reason}"` : "";
    console.log(`- ${receipt.timestamp}: ${receipt.selector}${forced}, ${receipt.writtenFiles?.length || 0} file(s), source=${receipt.sourceProvenance?.status || "unknown"}${reason}`);
  }
  if (payload.verification) {
    const summary = payload.verification.summary;
    console.log("");
    console.log(`Verification: ${payload.verification.status}`);
    console.log(`Matched: ${summary.matchedFileCount}; changed: ${summary.changedFileCount}; removed: ${summary.removedFileCount}; unverifiable: ${summary.unverifiableFileCount}`);
    for (const file of payload.verification.files.filter((item) => item.status !== "matched")) {
      console.log(`- ${file.path}: ${file.status}`);
    }
    console.log(payload.verification.note);
  }
}

/**
 * @param {string} filePath
 * @returns {{ sha256: string, size: number }}
 */
function projectFileHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length
  };
}

/**
 * @param {string} projectRoot
 * @param {{ local?: boolean }} [options]
 * @returns {ReturnType<typeof buildTopogramSourceStatus> & { project: Record<string, any> }}
 */
function buildProjectSourceStatus(projectRoot, options = {}) {
  const resolvedRoot = normalizeProjectRoot(projectRoot);
  const sourceStatus = buildTopogramSourceStatus(resolvedRoot);
  const projectConfigInfo = loadProjectConfig(normalizeTopogramPath(resolvedRoot));
  const template = projectConfigInfo?.config?.template || null;
  const baseline = buildTemplateOwnedBaselineStatus(resolvedRoot);
  let trust = {
    requiresTrust: false,
    ok: true,
    status: "not-required",
    path: path.join(resolvedRoot, TEMPLATE_TRUST_FILE),
    template: null,
    implementation: null,
    content: { trustedDigest: null, currentDigest: null, changed: [], added: [], removed: [] },
    issues: []
  };
  if (projectConfigInfo?.config?.implementation) {
    const trustStatus = getTemplateTrustStatus({
      config: projectConfigInfo.config.implementation,
      configPath: projectConfigInfo.configPath,
      configDir: projectConfigInfo.configDir
    }, projectConfigInfo.config);
    trust = {
      requiresTrust: trustStatus.requiresTrust,
      ok: trustStatus.ok,
      status: trustStatus.requiresTrust ? (trustStatus.ok ? "trusted" : "review-required") : "not-required",
      path: trustStatus.trustPath,
      template: trustStatus.template,
      implementation: trustStatus.implementation,
      content: trustStatus.content,
      issues: trustStatus.issues
    };
  }
  const packageStatus = template?.source === "package" && template.sourceSpec
    ? (options.local ? localTemplatePackageStatus(template.sourceSpec) : checkTemplatePackageStatus(template.sourceSpec))
    : null;
  const projectDiagnostics = [];
  if (!projectConfigInfo) {
    projectDiagnostics.push({
      code: "project_config_missing",
      severity: "warning",
      message: "topogram.project.json was not found.",
      path: path.join(resolvedRoot, "topogram.project.json"),
      suggestedFix: "Run `topogram check` from a Topogram project root."
    });
  }
  return {
    ...sourceStatus,
    project: {
      root: resolvedRoot,
      config: projectConfigInfo
        ? { exists: true, path: projectConfigInfo.configPath }
        : { exists: false, path: path.join(resolvedRoot, "topogram.project.json") },
      catalog: template?.catalog || sourceStatus.source?.catalog || null,
      template: template
        ? {
            id: template.id || null,
            version: template.version || null,
            requested: template.requested || null,
            source: template.source || null,
            sourceSpec: template.sourceSpec || null,
            includesExecutableImplementation: typeof template.includesExecutableImplementation === "boolean"
              ? template.includesExecutableImplementation
              : null
          }
        : null,
      package: packageStatus,
      packageChecks: {
        mode: options.local ? "local" : "remote",
        skipped: Boolean(options.local),
        reason: options.local ? "Package registry checks were skipped because --local was used." : null
      },
      trust,
      templateBaseline: baseline,
      diagnostics: projectDiagnostics
    },
    diagnostics: [...sourceStatus.diagnostics, ...projectDiagnostics]
  };
}

/**
 * @param {ReturnType<typeof buildProjectSourceStatus>} payload
 * @returns {void}
 */
function printTopogramSourceStatus(payload) {
  if (payload.project?.package && payload.project?.packageChecks?.mode === "remote") {
    console.log("Package checks: remote. Use --local to skip registry access.");
  } else if (payload.project?.package && payload.project?.packageChecks?.mode === "local") {
    console.log("Package checks: local. Registry access skipped.");
  }
  if (!payload.exists) {
    console.log("Topogram source status: no provenance");
    console.log(`Expected: ${payload.path}`);
    console.log(`${TOPOGRAM_SOURCE_FILE} was not found. This workspace may not have been copied from a catalog topogram entry.`);
  } else {
    console.log(`Topogram source status: ${payload.status}`);
    console.log(`File: ${payload.path}`);
    if (payload.source?.catalog?.id) {
      console.log(`Catalog: ${payload.source.catalog.id}${payload.source.catalog.source ? ` from ${payload.source.catalog.source}` : ""}`);
    }
    if (payload.source?.package?.spec) {
      console.log(`Package: ${payload.source.package.spec}`);
    }
  }
  if (payload.project?.config?.exists) {
    console.log(`Project config: ${payload.project.config.path}`);
  }
  if (payload.project?.catalog?.id) {
    console.log(`Project catalog: ${payload.project.catalog.id}${payload.project.catalog.source ? ` from ${payload.project.catalog.source}` : ""}`);
  }
  if (payload.project?.template?.id) {
    console.log("Template attachment: attached");
    console.log(`Template: ${payload.project.template.id}@${payload.project.template.version || "unknown"}`);
    console.log(`Template source: ${payload.project.template.sourceSpec || payload.project.template.source || "unknown"}`);
    console.log(`Executable implementation: ${payload.project.template.includesExecutableImplementation ? "yes" : "no"}`);
  } else if (payload.project?.config?.exists) {
    console.log("Template attachment: detached");
    console.log("Template ownership: project-owned");
  }
  if (payload.project?.package?.package) {
    const packageStatus = payload.project.package;
    if (packageStatus.checked === false) {
      console.log(`Template package: ${packageStatus.packageSpec} (not checked, local mode)`);
    } else {
      const currentLabel = packageStatus.current === null ? "unknown" : (packageStatus.current ? "current" : "update available");
      console.log(`Template package: ${packageStatus.packageSpec} (${packageStatus.ok ? "reachable" : "unreachable"}, ${currentLabel})`);
      if (packageStatus.latestVersion) {
        console.log(`Latest template package version: ${packageStatus.latestVersion}`);
      }
    }
  }
  if (payload.project?.trust) {
    console.log(`Implementation trust: ${payload.project.trust.status}`);
    if (payload.project.trust.content.trustedDigest) {
      console.log(`Trusted digest: ${payload.project.trust.content.trustedDigest}`);
    }
    if (payload.project.trust.content.currentDigest) {
      console.log(`Current digest: ${payload.project.trust.content.currentDigest}`);
    }
  }
  if (payload.project?.templateBaseline) {
    const baseline = payload.project.templateBaseline;
    const blockLabel = baseline.blocksCheck || baseline.blocksGenerate
      ? "may block workflow"
      : "does not block check/generate";
    console.log(`Template baseline: ${baseline.state} (${baseline.trustedFiles} file(s), ${blockLabel})`);
    console.log(`Template baseline meaning: ${baseline.meaning}`);
    if (baseline.localOwnership) {
      console.log("Template baseline ownership: local project owns these changes");
    }
    console.log(`Template baseline changed: ${baseline.content.changed.length}`);
    console.log(`Template baseline removed: ${baseline.content.removed.length}`);
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
  if (payload.project?.package?.diagnostics?.length) {
    for (const diagnostic of payload.project.package.diagnostics) {
      const label = diagnostic.severity === "warning" ? "Warning" : "Error";
      console.log(`${label}: ${diagnostic.message}`);
      if (diagnostic.suggestedFix) {
        console.log(`Fix: ${diagnostic.suggestedFix}`);
      }
    }
  }
  if (payload.project?.trust?.issues?.length) {
    for (const issue of payload.project.trust.issues) {
      console.log(`Issue: ${issue}`);
    }
  }
  console.log("");
  console.log(`${TOPOGRAM_SOURCE_FILE} records catalog-copy provenance only. Local edits are allowed.`);
  console.log("Template attachment controls update tracking. Detaching makes the project fully owned by this workspace.");
  console.log("Template baseline drift does not block `topogram check` or `topogram generate`.");
  console.log("Implementation trust is separate and can block check/generate when review is required.");
  if (payload.project?.trust?.status === "review-required") {
    console.log("Next: review implementation changes, then run `topogram trust status` or `topogram trust template`.");
  } else if (payload.exists && payload.status === "changed") {
    console.log("Next: review the listed files, then run `topogram check` and `topogram generate` when ready.");
  } else if (payload.project?.templateBaseline?.state === "diverged") {
    console.log("Next: local template-derived changes are owned by this project. Run `topogram template update --check` only when reviewing upstream template changes.");
  } else if (!payload.exists) {
    console.log("Next: use `topogram catalog copy <id> <target>` for pure topogram provenance, or continue with template/project provenance above.");
  } else {
    console.log("Next: run `topogram check` or `topogram generate`.");
  }
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
  if (message.includes("contains implementation/") && message.includes("includesExecutableImplementation: true")) {
    return templateCheckDiagnostic({
      code: "template_implementation_undeclared",
      message,
      path: localTemplatePath(templateSpec, "topogram-template.json"),
      suggestedFix: "Set includesExecutableImplementation to true after reviewing implementation/, or remove implementation/.",
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
      suggestedFix: "Add topogram.project.json beside topogram/ with outputs and topology.runtimes.",
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
  if (message.includes("unsupported symlink")) {
    return templateCheckDiagnostic({
      code: "template_symlink_unsupported",
      message,
      path: path.isAbsolute(templateSpec) ? templateSpec : null,
      suggestedFix: "Replace template symlinks with real files or directories, then rerun `topogram new` or `topogram template check`.",
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
  const isTrust = error.message.includes(TEMPLATE_TRUST_FILE) ||
    error.message.includes("unsupported symlink") ||
    error.message.includes("must be under implementation/");
  return templateCheckDiagnostic({
    code: isTrust ? "template_trust_invalid" : "starter_check_failed",
    message: error.message,
    path: locFile || configPath,
    suggestedFix: isTrust
      ? templateTrustRecoveryGuidance(error.message)
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
 * @param {string} projectRoot
 * @returns {string[]}
 */
function templateCheckGeneratorDependencies(projectRoot) {
  const packagePath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    return [];
  }
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };
  return Object.keys(dependencies).filter((name) =>
    name.includes("topogram-generator") || name.startsWith("@topogram/generator-")
  ).sort();
}

/**
 * @param {string} projectRoot
 * @param {string[]} dependencies
 * @returns {TemplateCheckDiagnostic|null}
 */
function installTemplateCheckGeneratorDependencies(projectRoot, dependencies) {
  if (dependencies.length === 0) {
    return null;
  }
  const result = runNpmForPackageUpdate(["install", "--ignore-scripts"], projectRoot);
  if (result.status === 0) {
    return null;
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  return templateCheckDiagnostic({
    code: "template_generator_dependencies_install_failed",
    message: `Failed to install package-backed generator dependencies: ${dependencies.join(", ")}.`,
    path: path.join(projectRoot, "package.json"),
    suggestedFix: `Run npm install before checking this package-backed generator template.${output ? ` ${output.split(/\r?\n/).slice(-3).join(" ")}` : ""}`,
    step: "generator-dependencies"
  });
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
    const generatorDependencies = templateCheckGeneratorDependencies(projectRoot);
    const installDiagnostic = installTemplateCheckGeneratorDependencies(projectRoot, generatorDependencies);
    if (installDiagnostic) {
      diagnostics.push(installDiagnostic);
      steps.push(templateCheckStep("generator-dependencies", false, {
        dependencies: generatorDependencies
      }, [installDiagnostic]));
      return {
        ok: false,
        templateSpec,
        projectRoot,
        steps,
        diagnostics,
        errors: diagnostics.map((diagnostic) => diagnostic.message)
      };
    }
    if (generatorDependencies.length > 0) {
      steps.push(templateCheckStep("generator-dependencies", true, {
        dependencies: generatorDependencies
      }));
    }
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
    validateProjectConfig(projectConfigInfo.config, resolved.ok ? resolved.graph : null, { configDir: projectConfigInfo.configDir }),
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
  if (implementationInfo && implementationRequiresTrust(implementationInfo, projectConfigInfo.config)) {
    const trustStatus = getTemplateTrustStatus(implementationInfo, projectConfigInfo.config);
    const trustDiagnostics = trustStatus.issues.map((issue) => templateCheckDiagnostic({
      code: "template_trust_invalid",
      message: issue,
      path: trustStatus.trustPath,
      suggestedFix: templateTrustRecoveryGuidance(issue),
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
 * @param {ReturnType<typeof loadProjectConfig>} projectConfigInfo
 * @returns {{ requested: string, root: string, manifest: { id: string, version: string, kind: string, topogramVersion: string, includesExecutableImplementation: boolean }, source: "local"|"package", packageSpec: string|null }}
 */
function currentPolicyTemplate(projectConfigInfo) {
  const template = projectConfigInfo?.config.template || {};
  const source = template.source === "local" || template.source === "package"
    ? template.source
    : "local";
  return {
    requested: typeof template.requested === "string" ? template.requested : String(template.id || "unknown"),
    root: projectConfigInfo?.configDir || process.cwd(),
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
    const currentTemplate = currentPolicyTemplate(projectConfigInfo);
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
 * @param {string} name
 * @param {boolean} ok
 * @param {string} actual
 * @param {string} expected
 * @param {string} message
 * @param {string|null} fix
 * @returns {{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }}
 */
function templatePolicyRule(name, ok, actual, expected, message, fix = null) {
  return { name, ok, actual, expected, message, fix };
}

/**
 * @param {string} name
 * @returns {string}
 */
function templatePolicyRuleLabel(name) {
  return ({
    "policy-file": "Policy file",
    "allowed-source": "Allowed source",
    "allowed-template-id": "Allowed template id",
    "allowed-package-scope": "Allowed package scope",
    "pinned-version": "Pinned version",
    "executable-implementation": "Executable implementation"
  })[name] || name;
}

/**
 * @param {string} projectPath
 * @returns {{ ok: boolean, path: string, exists: boolean, policy: any, template: any, catalog: any, package: any, rules: Array<{ name: string, ok: boolean, actual: string, expected: string, message: string, fix: string|null }>, diagnostics: TemplateCheckDiagnostic[], errors: string[] }}
 */
function buildTemplatePolicyExplainPayload(projectPath) {
  const check = buildTemplatePolicyCheckPayload(projectPath);
  const projectConfigInfo = loadProjectConfig(projectPath);
  if (!projectConfigInfo) {
    return {
      ...check,
      template: null,
      catalog: null,
      package: null,
      rules: []
    };
  }
  const templateMetadata = projectConfigInfo.config.template || {};
  const currentTemplate = currentPolicyTemplate(projectConfigInfo);
  const policy = check.policy;
  const packageScope = currentTemplate.source === "package"
    ? packageScopeFromSpec(currentTemplate.packageSpec || currentTemplate.requested)
    : null;
  const rules = [];
  rules.push(templatePolicyRule(
    "policy-file",
    check.exists,
    check.exists ? "present" : "missing",
    "present",
    check.exists
      ? "Project has a template policy file."
      : "Project has no template policy file; template operations are permissive until one is defined.",
    check.exists ? null : "Run `topogram template policy init`."
  ));
  if (policy) {
    rules.push(templatePolicyRule(
      "allowed-source",
      policy.allowedSources.length === 0 || policy.allowedSources.includes(currentTemplate.source),
      currentTemplate.source,
      policy.allowedSources.length > 0 ? policy.allowedSources.join(", ") : "(any)",
      "Current template source must be allowed by allowedSources.",
      `Add '${currentTemplate.source}' to allowedSources after review, or run \`topogram template policy init\`.`
    ));
    rules.push(templatePolicyRule(
      "allowed-template-id",
      policy.allowedTemplateIds.length === 0 || policy.allowedTemplateIds.includes(currentTemplate.manifest.id),
      currentTemplate.manifest.id,
      policy.allowedTemplateIds.length > 0 ? policy.allowedTemplateIds.join(", ") : "(any)",
      "Current template id must be allowed by allowedTemplateIds.",
      `Run \`topogram template policy pin ${currentTemplate.manifest.id}@${currentTemplate.manifest.version}\` after review.`
    ));
    if (currentTemplate.source === "package") {
      rules.push(templatePolicyRule(
        "allowed-package-scope",
        !policy.allowedPackageScopes ||
          policy.allowedPackageScopes.length === 0 ||
          Boolean(packageScope && policy.allowedPackageScopes.includes(packageScope)),
        packageScope || "(unscoped)",
        policy.allowedPackageScopes && policy.allowedPackageScopes.length > 0 ? policy.allowedPackageScopes.join(", ") : "(any)",
        "Package-backed template source must be in an allowed package scope.",
        `Add '${packageScope || "(unscoped)"}' to allowedPackageScopes after review.`
      ));
    }
    const pinnedVersion = policy.pinnedVersions?.[currentTemplate.manifest.id] || null;
    rules.push(templatePolicyRule(
      "pinned-version",
      !pinnedVersion || pinnedVersion === currentTemplate.manifest.version,
      currentTemplate.manifest.version,
      pinnedVersion || "(unpinned)",
      "Pinned version must match the current template version when a pin exists.",
      `Run \`topogram template policy pin ${currentTemplate.manifest.id}@${currentTemplate.manifest.version}\` after review.`
    ));
    rules.push(templatePolicyRule(
      "executable-implementation",
      !currentTemplate.manifest.includesExecutableImplementation || policy.executableImplementation !== "deny",
      currentTemplate.manifest.includesExecutableImplementation ? "yes" : "no",
      policy.executableImplementation,
      "Executable template implementation must be allowed when implementation/ is present.",
      "Review implementation/, then set executableImplementation to 'allow' or choose a non-executable template."
    ));
  }
  return {
    ...check,
    template: {
      id: currentTemplate.manifest.id,
      version: currentTemplate.manifest.version,
      source: currentTemplate.source,
      requested: currentTemplate.requested,
      sourceSpec: currentTemplate.packageSpec,
      includesExecutableImplementation: currentTemplate.manifest.includesExecutableImplementation
    },
    catalog: templateMetadata.catalog || null,
    package: currentTemplate.source === "package" ? {
      spec: currentTemplate.packageSpec,
      scope: packageScope
    } : null,
    rules
  };
}

/**
 * @param {ReturnType<typeof buildTemplatePolicyExplainPayload>} payload
 * @returns {void}
 */
function printTemplatePolicyExplainPayload(payload) {
  console.log(payload.ok ? "Template policy: allowed" : "Template policy: denied");
  console.log(payload.ok
    ? "Decision: the current template is allowed by this project's template policy."
    : "Decision: the current template is blocked by this project's template policy.");
  console.log(`Policy file: ${payload.path}`);
  console.log(`Policy file exists: ${payload.exists ? "yes" : "no"}`);
  if (payload.template) {
    console.log(`Template: ${payload.template.id}@${payload.template.version}`);
    console.log(`Source: ${payload.template.source}`);
    console.log(`Requested: ${payload.template.requested}`);
    if (payload.template.sourceSpec) {
      console.log(`Source spec: ${payload.template.sourceSpec}`);
    }
    console.log(`Executable implementation: ${payload.template.includesExecutableImplementation ? "yes" : "no"}`);
  }
  if (payload.catalog?.id) {
    console.log(`Catalog: ${payload.catalog.id} from ${payload.catalog.source || "unknown"}`);
    console.log(`Catalog package: ${payload.catalog.packageSpec || payload.catalog.package || "unknown"}`);
  }
  if (payload.package) {
    console.log(`Package scope: ${payload.package.scope || "(unscoped)"}`);
  }
  if (payload.rules.length > 0) {
    console.log("");
    console.log("Policy checks:");
  }
  for (const rule of payload.rules) {
    console.log(`${rule.ok ? "PASS" : "FAIL"} ${templatePolicyRuleLabel(rule.name)}: ${rule.message}`);
    console.log(`  actual: ${rule.actual}`);
    console.log(`  expected: ${rule.expected}`);
    if (!rule.ok && rule.fix) {
      console.log(`  fix: ${rule.fix}`);
    }
  }
  for (const diagnostic of payload.diagnostics) {
    const label = diagnostic.severity === "warning" ? "Warning" : "Error";
    console.log(`${label}: ${diagnostic.code}: ${diagnostic.message}`);
    if (diagnostic.suggestedFix) {
      console.log(`  fix: ${diagnostic.suggestedFix}`);
    }
  }
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
} else if (args[0] === "doctor") {
  commandArgs = { doctor: true, inputPath: args[1] && !args[1].startsWith("-") ? args[1] : null };
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
} else if (args[0] === "trust" && args[1] === "template") {
  commandArgs = { trustTemplate: true, force: args.includes("--force"), inputPath: commandPath(2) };
} else if (args[0] === "trust" && args[1] === "status") {
  commandArgs = { trustStatus: true, inputPath: commandPath(2) };
} else if (args[0] === "trust" && args[1] === "diff") {
  commandArgs = { trustDiff: true, inputPath: commandPath(2) };
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
} else if (args[0] === "source" && args[1] === "status") {
  commandArgs = { sourceStatus: true, inputPath: commandPath(2, ".") };
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
    if (!projectConfigInfo.config.template?.id && !projectConfigInfo.config.template?.sourceSpec) {
      throw new Error("Cannot update template because this project is detached from template metadata.");
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
    const templateManifestPath = path.join(projectConfigInfo.configDir, "topogram-template.json");
    if (!projectConfigInfo.config.template && fs.existsSync(templateManifestPath) && !shouldForce) {
      throw new Error("Cannot write consumer template trust metadata in a template source repo. Template source repos should not contain .topogram-template-files.json or .topogram-template-trust.json. Run this command in a generated project, or pass --force if you intentionally need local trust metadata here.");
    }
    if (!projectConfigInfo.config.template && fs.existsSync(templateManifestPath) && shouldForce) {
      console.warn("Warning: writing consumer template trust metadata in a template source repo because --force was provided.");
    }
    const fileManifest = writeTemplateFilesManifest(projectConfigInfo.configDir, projectConfigInfo.config);
    console.log(`Wrote .topogram-template-files.json with ${fileManifest.files.length} template-owned file hash(es).`);
    if (projectConfigInfo.config.implementation) {
      const implementationInfo = {
        config: projectConfigInfo.config.implementation,
        configPath: projectConfigInfo.configPath,
        configDir: projectConfigInfo.configDir
      };
      if (implementationRequiresTrust(implementationInfo, projectConfigInfo.config)) {
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
      console.log(status.ok ? "Implementation trust status: trusted" : "Implementation trust status: review required");
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
        const guidance = templateTrustRecoveryGuidance(status.issues);
        if (guidance) {
          console.log(guidance);
        }
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
      if (!diff.ok) {
        const guidance = templateTrustRecoveryGuidance(diff.status.issues);
        if (guidance) {
          console.log(guidance);
        }
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
        const guidance = templateTrustRecoveryGuidance(diff.status.issues);
        if (guidance) {
          console.log(guidance);
        }
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
