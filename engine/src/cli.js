#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertSupportedNode } from "./runtime-support.js";
import { parseSplitCommandArgs } from "./cli/command-parser.js";
import {
  artifactTargetMigrationError,
  cliMigrationError
} from "./cli/migration-guidance.js";
import { parseCliOptions } from "./cli/options.js";
import {
  printAgentHelp,
  runAgentBriefCommand
} from "./cli/commands/agent.js";
import { runNewProjectCommand } from "./cli/commands/new.js";
import { handleSetupCommand, printSetupHelp } from "./cli/commands/setup.js";
import { buildVersionPayload, printVersion } from "./cli/commands/version.js";
import {
  printCheckHelp,
  runCheckCommand
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
  printTemplateHelp
} from "./cli/commands/template.js";
import { runTemplateCommand } from "./cli/commands/template-runner.js";
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
  printImportHelp
} from "./cli/commands/import.js";
import { runImportCommand } from "./cli/commands/import-runner.js";
import { stableStringify } from "./format.js";
import { runGenerateAppCommand } from "./cli/commands/generate.js";
import { runEmitCommand } from "./cli/commands/emit.js";
import {
  runParseCommand,
  runResolveCommand
} from "./cli/commands/inspect.js";
import { runQueryCommand } from "./cli/commands/query.js";
import { runSdlcCommand } from "./cli/commands/sdlc.js";
import {
  runLegacyWorkflowCommand,
  runValidateCommand
} from "./cli/commands/workflow.js";
import { formatValidationErrors } from "./validator.js";
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
  printReleaseHelp,
  runReleaseCommand
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

const migrationError = cliMigrationError(args);
if (migrationError) {
  console.error(migrationError);
  process.exit(1);
}

let commandArgs = null;
let inputPath = args[0];
commandArgs = parseSplitCommandArgs(args);
if (commandArgs?.emitHelp) {
  printEmitHelp();
  process.exit(1);
} else if (commandArgs) {
  // Parsed by split command modules.
} else if (args[0] === "widget") {
  printWidgetHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "agent") {
  printAgentHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "generator") {
  printGeneratorHelp();
  process.exit(args[1] ? 1 : 0);
} else if (args[0] === "template") {
  printTemplateHelp();
  process.exit(args[1] ? 1 : 0);
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
const cliOptions = parseCliOptions(args, commandArgs);
const {
  emitJson,
  shouldForce,
  shouldValidate,
  shouldResolve,
  generateTarget,
  workflowName,
  workflowId,
  fromValue,
  adoptValue,
  reasonValue,
  modeId,
  profileId,
  providerId,
  presetId,
  templateName,
  catalogSource,
  requestedVersion,
  bundleSlug,
  laneId,
  fromSnapshotPath,
  fromTopogramPath,
  shouldWrite,
  refreshAdopted,
  outPath,
  effectiveOutDir
} = cliOptions;
const {
  shapeId,
  capabilityId,
  projectionId,
  widgetId: componentId,
  entityId,
  journeyId,
  surfaceId,
  domainId,
  seamId,
  taskId,
  pitchId,
  requirementId,
  acceptanceId,
  bugId,
  documentId,
  kind: sdlcKind,
  appVersion: sdlcAppVersion,
  sinceTag: sdlcSinceTag,
  includeArchived: sdlcIncludeArchived
} = cliOptions.selectors;
const shouldVersion = Boolean(commandArgs?.version);
const shouldDoctor = Boolean(commandArgs?.doctor);
const shouldCheck = Boolean(commandArgs?.check);
const shouldWidgetCheck = Boolean(commandArgs?.widgetCheck);
const shouldWidgetBehavior = Boolean(commandArgs?.widgetBehavior);
const shouldAgentBrief = Boolean(commandArgs?.agentBrief);
const shouldQueryList = Boolean(commandArgs?.queryList);
const shouldQueryShow = Boolean(commandArgs?.queryShow);
const targetMigrationError = artifactTargetMigrationError(generateTarget);
if (targetMigrationError) {
  console.error(targetMigrationError);
  process.exit(1);
}

if ((shouldCheck || shouldWidgetCheck || shouldWidgetBehavior || commandArgs?.generatorPolicyCommand || shouldValidate || commandArgs?.trustCommand || commandArgs?.sourceCommand || generateTarget === "app-bundle") && !inputPath) {
  console.error("Missing required <path>.");
  printUsage();
  process.exit(1);
}

if (shouldQueryShow && !commandArgs?.queryShowName) {
  console.error("Missing required <name>.");
  printQueryHelp();
  process.exit(1);
}

if ((shouldCheck || shouldWidgetCheck || shouldWidgetBehavior || shouldAgentBrief || shouldValidate || commandArgs?.generatorPolicyCommand || commandArgs?.trustCommand || generateTarget === "app-bundle") && inputPath) {
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

  if (commandArgs?.releaseCommand) {
    process.exit(runReleaseCommand({ commandArgs, args, json: emitJson }));
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

  if (commandArgs?.importCommand) {
    process.exit(runImportCommand({
      commandArgs,
      inputPath,
      outPath,
      fromValue,
      reasonValue,
      refreshAdopted,
      dryRun: args.includes("--dry-run"),
      write: shouldWrite,
      force: shouldForce,
      json: emitJson
    }));
  }

  if (commandArgs?.sourceCommand) {
    process.exit(runSourceCommand({ commandArgs, inputPath, args, json: emitJson }));
  }

  if (commandArgs?.newProject) {
    process.exit(runNewProjectCommand(inputPath, { templateName, catalogSource, cwd: process.cwd() }));
  }

  if (commandArgs?.templateCommand) {
    process.exit(runTemplateCommand({
      commandArgs,
      args,
      inputPath,
      catalogSource,
      templateName,
      outPath,
      json: emitJson
    }));
  }

  if (commandArgs?.trustCommand) {
    process.exit(runTrustCommand({ commandArgs, inputPath, json: emitJson }));
  }

  if (shouldCheck) {
    process.exit(await runCheckCommand(inputPath, { json: emitJson }));
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
    process.exit(runResolveCommand(inputPath));
  }

  if (shouldValidate) {
    process.exit(runValidateCommand(inputPath));
  }

  process.exit(runParseCommand(inputPath, { json: emitJson }));
} catch (error) {
  if (error.validation) {
    console.error(formatValidationErrors(error.validation));
  } else {
    console.error(error.message);
  }
  process.exit(1);
}
