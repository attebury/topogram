// @ts-check

import { buildDoctorPayload, printDoctor } from "./commands/doctor.js";
import { buildVersionPayload, printVersion } from "./commands/version.js";
import { runAgentBriefCommand } from "./commands/agent.js";
import { runCatalogCommand } from "./commands/catalog.js";
import { runCheckCommand } from "./commands/check.js";
import { runEmitCommand } from "./commands/emit.js";
import { runGenerateAppCommand } from "./commands/generate.js";
import { runGeneratorCommand } from "./commands/generator.js";
import { runGeneratorPolicyCommand } from "./commands/generator-policy.js";
import { runImportCommand } from "./commands/import-runner.js";
import { runMigrateCommand } from "./commands/migrate.js";
import { runNewProjectCommand } from "./commands/new.js";
import { runPackageCommand } from "./commands/package.js";
import { runParseCommand, runResolveCommand } from "./commands/inspect.js";
import {
  buildQueryListPayload,
  buildQueryShowPayload,
  printQueryDefinition,
  printQueryList,
  runQueryCommand
} from "./commands/query.js";
import { runReleaseCommand } from "./commands/release.js";
import { runSdlcCommand } from "./commands/sdlc.js";
import { runSourceCommand } from "./commands/source.js";
import { runTemplateCommand } from "./commands/template-runner.js";
import { runTrustCommand } from "./commands/trust.js";
import {
  runWidgetBehaviorCommand,
  runWidgetCheckCommand
} from "./commands/widget.js";
import {
  runLegacyWorkflowCommand,
  runValidateCommand
} from "./commands/workflow.js";
import { artifactTargetMigrationError } from "./migration-guidance.js";
import {
  normalizeProjectRoot,
  normalizeTopogramPath
} from "./path-normalization.js";
import { printQueryHelp, printUsage } from "./help-dispatch.js";
import { stableStringify } from "../format.js";

/**
 * @typedef {Record<string, any>} CommandArgs
 * @typedef {Record<string, any>} CliOptions
 */

/**
 * Preserve legacy runtime behavior while satisfying the checked JS boundary.
 * Some command paths intentionally let downstream commands produce the missing
 * argument diagnostic.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
function commandInputPath(value) {
  return /** @type {string} */ (value);
}

/**
 * @param {{
 *   args: string[],
 *   commandArgs: CommandArgs|null,
 *   inputPath: string|null|undefined,
 *   cliOptions: CliOptions,
 *   executablePath: string
 * }} context
 * @returns {Promise<number>}
 */
export async function runCliDispatch(context) {
  const { args, commandArgs, cliOptions, executablePath } = context;
  let inputPath = context.inputPath;
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
    return 1;
  }

  if ((shouldCheck || shouldWidgetCheck || shouldWidgetBehavior || commandArgs?.generatorPolicyCommand || shouldValidate || commandArgs?.trustCommand || commandArgs?.sourceCommand || generateTarget === "app-bundle") && !inputPath) {
    console.error("Missing required <path>.");
    printUsage();
    return 1;
  }

  if (shouldQueryShow && !commandArgs?.queryShowName) {
    console.error("Missing required <name>.");
    printQueryHelp();
    return 1;
  }

  if ((shouldCheck || shouldWidgetCheck || shouldWidgetBehavior || shouldAgentBrief || shouldValidate || commandArgs?.generatorPolicyCommand || commandArgs?.trustCommand || commandArgs?.queryName || commandArgs?.workflowPresetCommand || generateTarget) && inputPath) {
    inputPath = normalizeTopogramPath(inputPath);
  }
  const effectiveInputPath = commandInputPath(inputPath);

  if (shouldVersion) {
    const payload = buildVersionPayload({ executablePath });
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printVersion(payload);
    }
    return 0;
  }

  if (shouldDoctor) {
    const payload = buildDoctorPayload(catalogSource || inputPath || null);
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printDoctor(payload);
    }
    return payload.ok ? 0 : 1;
  }

  if (shouldAgentBrief) {
    return runAgentBriefCommand(effectiveInputPath, { json: emitJson });
  }

  if (commandArgs?.releaseCommand) {
    return runReleaseCommand({ commandArgs, args, json: emitJson });
  }

  if (shouldQueryList) {
    const payload = buildQueryListPayload();
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printQueryList(payload);
    }
    return 0;
  }

  if (shouldQueryShow) {
    const payload = buildQueryShowPayload(/** @type {string} */ (commandArgs?.queryShowName));
    if (emitJson) {
      console.log(stableStringify(payload));
    } else {
      printQueryDefinition(payload);
    }
    return 0;
  }

  if (shouldWidgetCheck) {
    return runWidgetCheckCommand(effectiveInputPath, {
      json: emitJson,
      projectionId,
      widgetId: componentId
    });
  }

  if (shouldWidgetBehavior) {
    return runWidgetBehaviorCommand(effectiveInputPath, {
      json: emitJson,
      projectionId,
      widgetId: componentId
    });
  }

  if (commandArgs?.generatorCommand) {
    return runGeneratorCommand({
      commandArgs,
      inputPath,
      json: emitJson,
      cwd: process.cwd()
    });
  }

  if (commandArgs?.generatorPolicyCommand) {
    return runGeneratorPolicyCommand({ commandArgs, inputPath, json: emitJson });
  }

  if (commandArgs?.catalogCommand) {
    return runCatalogCommand({
      commandArgs,
      inputPath,
      catalogSource,
      requestedVersion,
      json: emitJson
    });
  }

  if (commandArgs?.packageCommand) {
    return runPackageCommand({ commandArgs, inputPath, json: emitJson });
  }

  if (commandArgs?.migrateCommand) {
    return runMigrateCommand(inputPath, { write: shouldWrite, json: emitJson });
  }

  if (commandArgs?.importCommand) {
    return runImportCommand({
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
    });
  }

  if (commandArgs?.sourceCommand) {
    return runSourceCommand({ commandArgs, inputPath, args, json: emitJson });
  }

  if (commandArgs?.newProject) {
    return runNewProjectCommand(effectiveInputPath, { templateName, catalogSource, cwd: process.cwd() });
  }

  if (commandArgs?.templateCommand) {
    return runTemplateCommand({
      commandArgs,
      args,
      inputPath,
      catalogSource,
      templateName,
      outPath,
      json: emitJson
    });
  }

  if (commandArgs?.trustCommand) {
    return runTrustCommand({ commandArgs, inputPath, json: emitJson });
  }

  if (shouldCheck) {
    return runCheckCommand(effectiveInputPath, { json: emitJson });
  }

  if (commandArgs?.queryName || commandArgs?.workflowPresetCommand) {
    return (await runQueryCommand({
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
    })) || 0;
  }

  if (commandArgs?.sdlcCommand) {
    return runSdlcCommand({ commandArgs, args, inputPath });
  }

  if (workflowName) {
    return runLegacyWorkflowCommand({
      workflowName,
      inputPath,
      from: fromValue,
      adopt: adoptValue,
      write: shouldWrite,
      refreshAdopted,
      outDir: effectiveOutDir
    });
  }

  if (generateTarget === "app-bundle" && shouldWrite && !commandArgs?.emitArtifact) {
    return runGenerateAppCommand({
      inputPath: effectiveInputPath,
      projectRoot: normalizeProjectRoot(effectiveInputPath),
      outDir: effectiveOutDir,
      profileId
    });
  }

  if (generateTarget) {
    return runEmitCommand({
      inputPath: effectiveInputPath,
      projectRoot: normalizeProjectRoot(effectiveInputPath),
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
    });
  }

  if (shouldResolve) {
    return runResolveCommand(inputPath);
  }

  if (shouldValidate) {
    return runValidateCommand(inputPath);
  }

  return runParseCommand(inputPath, { json: emitJson });
}
