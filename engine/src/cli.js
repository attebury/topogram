#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertSupportedNode } from "./runtime-support.js";
import { parseSplitCommandArgs } from "./cli/command-parser.js";
import {
  printAgentHelp,
  runAgentBriefCommand
} from "./cli/commands/agent.js";
import { runNewProjectCommand } from "./cli/commands/new.js";
import { handleSetupCommand, printSetupHelp } from "./cli/commands/setup.js";
import { buildVersionPayload, printVersion } from "./cli/commands/version.js";
import {
  checkSummaryPayload,
  combineProjectValidationResults,
  printCheckHelp,
  printTopologySummary
} from "./cli/commands/check.js";
import {
  buildQueryListPayload,
  buildQueryShowPayload,
  printQueryDefinition,
  printQueryHelp,
  printQueryList
} from "./cli/commands/query.js";
import {
  printGeneratorHelp,
  runGeneratorCommand
} from "./cli/commands/generator.js";
import { runGeneratorPolicyCommand } from "./cli/commands/generator-policy.js";
import {
  printCatalogHelp,
  runCatalogCommand
} from "./cli/commands/catalog.js";
import {
  printPackageHelp,
  runPackageCommand
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
  runWidgetBehaviorCommand,
  runWidgetCheckCommand
} from "./cli/commands/widget.js";
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
import { loadImplementationProvider } from "./example-implementation.js";
import { runGenerateAppCommand } from "./cli/commands/generate.js";
import { runEmitCommand } from "./cli/commands/emit.js";
import { runQueryCommand } from "./cli/commands/query.js";
import { runSdlcCommand } from "./cli/commands/sdlc.js";
import {
  runLegacyWorkflowCommand,
  runValidateCommand
} from "./cli/commands/workflow.js";
import { writeTemplatePolicyForProject } from "./new-project.js";
import {
  TEMPLATE_TRUST_FILE,
  validateProjectImplementationTrust
} from "./template-trust.js";
import { GENERATOR_POLICY_FILE } from "./generator-policy.js";
import { resolveWorkspace } from "./resolver.js";
import { formatValidationErrors } from "./validator.js";
import { isCatalogSourceDisabled } from "./catalog.js";
import {
  formatProjectConfigErrors,
  loadProjectConfig,
  projectConfigOrDefault,
  validateProjectConfig,
  validateProjectOutputOwnership
} from "./project-config.js";
import { LOCAL_NPMRC_ENV } from "./npm-safety.js";
import {
  buildDoctorPayload,
  printDoctor,
  printDoctorHelp
} from "./cli/commands/doctor.js";
import {
  printSourceHelp,
  runSourceCommand
} from "./cli/commands/source.js";
import {
  printTrustHelp,
  runTrustCommand
} from "./cli/commands/trust.js";
import {
  buildReleaseRollConsumersPayload,
  buildReleaseStatusPayload,
  printReleaseHelp,
  printReleaseRollConsumers,
  printReleaseStatus,
  renderReleaseStatusMarkdown
} from "./cli/commands/release.js";

try {
  assertSupportedNode();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
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
if (commandArgs?.emitHelp) {
  printEmitHelp();
  process.exit(1);
} else if (commandArgs) {
  // Parsed by split command modules.
} else if (args[0] === "check") {
  commandArgs = { check: true, inputPath: commandPath(1) };
} else if (args[0] === "widget") {
  printWidgetHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "agent") {
  printAgentHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "generator") {
  printGeneratorHelp();
  process.exit(args[1] ? 1 : 0);
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
} else if (args[0] === "import" && args[1] && !args[1].startsWith("-")) {
  commandArgs = { importWorkspace: true, inputPath: args[1] };
} else if (args[0] === "import") {
  printImportHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "query") {
  printQueryHelp();
  process.exit(args[1] ? 1 : 0);
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
const shouldWidgetCheck = Boolean(commandArgs?.widgetCheck);
const shouldWidgetBehavior = Boolean(commandArgs?.widgetBehavior);
const shouldAgentBrief = Boolean(commandArgs?.agentBrief);
const shouldForce = Boolean(commandArgs?.force) || args.includes("--force");
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
const reasonIndex = args.indexOf("--reason");
const reasonValue = reasonIndex >= 0 && args[reasonIndex + 1] && !args[reasonIndex + 1].startsWith("-")
  ? args[reasonIndex + 1]
  : null;
const sdlcAppVersionIndex = args.indexOf("--app-version");
const sdlcAppVersion = sdlcAppVersionIndex >= 0 ? args[sdlcAppVersionIndex + 1] : null;
const sdlcSinceIndex = args.indexOf("--since-tag");
const sdlcSinceTag = sdlcSinceIndex >= 0 ? args[sdlcSinceIndex + 1] : null;
const sdlcIncludeArchived = args.includes("--include-archived");
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

if ((shouldCheck || shouldWidgetCheck || shouldWidgetBehavior || commandArgs?.generatorPolicyCommand || shouldValidate || commandArgs?.trustCommand || commandArgs?.sourceCommand || shouldTemplateExplain || shouldTemplateStatus || shouldTemplateDetach || shouldTemplatePolicyInit || shouldTemplatePolicyCheck || shouldTemplatePolicyExplain || shouldTemplatePolicyPin || shouldTemplateCheck || shouldTemplateUpdate || generateTarget === "app-bundle") && !inputPath) {
  console.error("Missing required <path>.");
  printUsage();
  process.exit(1);
}

if (shouldTemplateShow && !inputPath) {
  console.error("Missing required <id>.");
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

if ((shouldCheck || shouldWidgetCheck || shouldWidgetBehavior || shouldAgentBrief || shouldValidate || commandArgs?.generatorPolicyCommand || commandArgs?.trustCommand || shouldTemplateExplain || shouldTemplateStatus || shouldTemplatePolicyInit || shouldTemplatePolicyCheck || shouldTemplatePolicyExplain || shouldTemplatePolicyPin || shouldTemplateUpdate || generateTarget === "app-bundle") && inputPath) {
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
    process.exit(runAgentBriefCommand(inputPath, { json: emitJson }));
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

  if (shouldWidgetCheck) {
    process.exit(runWidgetCheckCommand(inputPath, {
      json: emitJson,
      projectionId,
      widgetId: componentId
    }));
  }

  if (shouldWidgetBehavior) {
    process.exit(runWidgetBehaviorCommand(inputPath, {
      json: emitJson,
      projectionId,
      widgetId: componentId
    }));
  }

  if (commandArgs?.generatorCommand) {
    process.exit(runGeneratorCommand({
      commandArgs,
      inputPath,
      json: emitJson,
      cwd: process.cwd()
    }));
  }

  if (commandArgs?.generatorPolicyCommand) {
    process.exit(runGeneratorPolicyCommand({ commandArgs, inputPath, json: emitJson }));
  }

  if (commandArgs?.catalogCommand) {
    process.exit(runCatalogCommand({
      commandArgs,
      inputPath,
      catalogSource,
      requestedVersion,
      json: emitJson
    }));
  }

  if (commandArgs?.packageCommand) {
    process.exit(runPackageCommand({ commandArgs, inputPath, json: emitJson }));
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

  if (commandArgs?.sourceCommand) {
    process.exit(runSourceCommand({ commandArgs, inputPath, args, json: emitJson }));
  }

  if (commandArgs?.newProject) {
    process.exit(runNewProjectCommand(inputPath, { templateName, catalogSource, cwd: process.cwd() }));
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

  if (commandArgs?.trustCommand) {
    process.exit(runTrustCommand({ commandArgs, inputPath, json: emitJson }));
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

  if (commandArgs?.queryName || commandArgs?.workflowPresetCommand) {
    process.exit(await runQueryCommand({
      commandArgs,
      inputPath,
      capabilityId,
      workflowId,
      projectionId,
      componentId,
      entityId,
      journeyId,
      surfaceId,
      domainId,
      seamId,
      modeId,
      providerId,
      presetId,
      bundleSlug,
      laneId,
      fromTopogramPath,
      shouldWrite,
      outPath
    }));
  }

  if (commandArgs?.sdlcCommand) {
    process.exit(await runSdlcCommand({ commandArgs, args, inputPath }));
  }

  if (workflowName) {
    process.exit(runLegacyWorkflowCommand({
      workflowName,
      inputPath,
      from: fromValue,
      adopt: adoptValue,
      write: shouldWrite,
      refreshAdopted,
      outDir: effectiveOutDir
    }));
  }

  if (generateTarget === "app-bundle" && shouldWrite && !commandArgs?.emitArtifact) {
    process.exit(await runGenerateAppCommand({
      inputPath,
      projectRoot: normalizeProjectRoot(inputPath),
      outDir: effectiveOutDir,
      profileId
    }));
  }

  if (generateTarget) {
    process.exit(await runEmitCommand({
      inputPath,
      projectRoot: normalizeProjectRoot(inputPath),
      target: generateTarget,
      write: shouldWrite,
      outDir: effectiveOutDir,
      profileId,
      fromSnapshotPath,
      fromTopogramPath,
      selectors: {
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
        modeId
      },
      outputSelectors: {
        shapeId,
        capabilityId,
        workflowId,
        projectionId,
        componentId,
        entityId,
        journeyId,
        taskId,
        modeId
      }
    }));
  }

  if (shouldResolve) {
    const ast = parsePath(inputPath);
    const result = resolveWorkspace(ast);
    if (!result.ok) {
      console.error(formatValidationErrors(result.validation));
      process.exit(1);
    }

    console.log(JSON.stringify(result.graph, null, 2));
    process.exit(0);
  }

  if (shouldValidate) {
    process.exit(runValidateCommand(inputPath));
  }

  const ast = parsePath(inputPath);

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
