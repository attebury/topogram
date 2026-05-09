// @ts-check

import { parseCoreCommandArgs } from "./command-parsers/core.js";
import { parseGeneratorCommandArgs } from "./command-parsers/generator.js";
import { parseImportCommandArgs } from "./command-parsers/import.js";
import { parseLegacyWorkflowCommandArgs } from "./command-parsers/legacy-workflow.js";
import { parseProjectCommandArgs } from "./command-parsers/project.js";
import { parseSdlcCommandArgs } from "./command-parsers/sdlc.js";
import { parseTemplateCommandArgs } from "./command-parsers/template.js";

const COMMAND_PARSERS = [
  parseCoreCommandArgs,
  parseGeneratorCommandArgs,
  parseTemplateCommandArgs,
  parseProjectCommandArgs,
  parseImportCommandArgs,
  parseLegacyWorkflowCommandArgs,
  parseSdlcCommandArgs
];

/**
 * Parses command families that have already been split out of the CLI shim.
 *
 * Keep this module as a composition root. Command-family parsing belongs in
 * `cli/command-parsers/*` so the parser does not become another CLI shim.
 *
 * @param {string[]} args
 * @returns {import("./command-parsers/shared.js").SplitCommandArgs|null}
 */
export function parseSplitCommandArgs(args) {
  for (const parser of COMMAND_PARSERS) {
    const commandArgs = parser(args);
    if (commandArgs) {
      return commandArgs;
    }
  }
  return null;
}
