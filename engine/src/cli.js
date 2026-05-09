#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSplitCommandArgs } from "./cli/command-parser.js";
import { runCliDispatch } from "./cli/dispatcher.js";
import {
  handleGlobalHelp,
  handleUnparsedCommandHelp,
  printEmitHelp
} from "./cli/help-dispatch.js";
import { cliMigrationError } from "./cli/migration-guidance.js";
import { parseCliOptions } from "./cli/options.js";
import { handleSetupCommand } from "./cli/commands/setup.js";
import { assertSupportedNode } from "./runtime-support.js";
import { LOCAL_NPMRC_ENV } from "./npm-safety.js";
import { formatValidationErrors } from "./validator.js";

try {
  assertSupportedNode();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("--allow-local-npmrc") && !process.env[LOCAL_NPMRC_ENV]) {
  process.env[LOCAL_NPMRC_ENV] = "1";
}

const helpExitCode = handleGlobalHelp(args);
if (helpExitCode !== null) {
  process.exit(helpExitCode);
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

const commandArgs = parseSplitCommandArgs(args);
if (commandArgs?.emitHelp) {
  printEmitHelp();
  process.exit(1);
}
if (!commandArgs) {
  const unparsedHelpExitCode = handleUnparsedCommandHelp(args);
  if (unparsedHelpExitCode !== null) {
    process.exit(unparsedHelpExitCode);
  }
}

const inputPath = commandArgs && Object.prototype.hasOwnProperty.call(commandArgs, "inputPath")
  ? commandArgs.inputPath
  : args[0];
const cliOptions = parseCliOptions(args, commandArgs);

try {
  process.exit(await runCliDispatch({
    args,
    commandArgs,
    inputPath,
    cliOptions,
    executablePath: path.resolve(process.argv[1] || fileURLToPath(import.meta.url))
  }));
} catch (error) {
  if (error.validation) {
    console.error(formatValidationErrors(error.validation));
  } else {
    console.error(error.message);
  }
  process.exit(1);
}
