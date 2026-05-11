// @ts-check

import {
  CLI_COMMAND_EFFECTS,
  CLI_COMMAND_OPTION_TYPES,
  CLI_COMMAND_OUTPUT_FORMATS,
  IDENTIFIER_PATTERN
} from "../kinds.js";
import {
  blockEntries,
  getFieldValue,
  pushError
} from "../utils.js";

/**
 * @param {TopogramToken | null | undefined} token
 * @returns {string | null}
 */
function tokenText(token) {
  return token?.type === "symbol" || token?.type === "string" ? token.value : null;
}

/**
 * @param {TopogramToken | null | undefined} token
 * @returns {string | null}
 */
function tokenDirectiveValue(token) {
  if (!token) {
    return null;
  }
  if (token.type === "list") {
    return token.items.map((item) => tokenText(item)).filter((value) => value !== null).join(",");
  }
  return tokenText(token);
}

/**
 * @param {TopogramBlockEntry} entry
 * @returns {string[]}
 */
function entryTokens(entry) {
  const values = [];
  for (const token of entry.items) {
    const value = tokenDirectiveValue(token);
    if (value !== null) {
      values.push(value);
    }
  }
  return values;
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramBlockEntry} entry
 * @param {string[]} tokens
 * @param {number} startIndex
 * @param {string} context
 * @returns {Map<string, string>}
 */
function parseDirectives(errors, statement, entry, tokens, startIndex, context) {
  const directives = new Map();
  for (let index = startIndex; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!key) {
      continue;
    }
    if (!value) {
      pushError(errors, `Projection ${statement.id} ${context} is missing a value for '${key}'`, entry.loc);
      continue;
    }
    directives.set(key, value);
  }
  return directives;
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {boolean}
 */
function validateCliOwnership(errors, statement, fieldMap) {
  const cliFields = ["commands", "command_options", "command_outputs", "command_effects", "command_examples"];
  const hasCliFields = cliFields.some((key) => fieldMap.has(key));
  if (!hasCliFields) {
    return false;
  }

  const typeValue = tokenText(fieldMap.get("type")?.[0]?.value);
  if (typeValue !== "cli_surface") {
    for (const key of cliFields) {
      const field = fieldMap.get(key)?.[0];
      if (field) {
        pushError(errors, `Projection ${statement.id} ${key} belongs on cli_surface projections`, field.loc);
      }
    }
    return false;
  }
  return true;
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramRegistry} registry
 * @returns {Set<string>}
 */
function validateCommands(errors, statement, registry) {
  const commandIds = new Set();
  const entries = blockEntries(getFieldValue(statement, "commands"));
  for (const entry of entries) {
    const tokens = entryTokens(entry);
    if (tokens[0] !== "command") {
      pushError(errors, `Projection ${statement.id} commands entries must start with 'command'`, entry.loc);
      continue;
    }
    const commandId = tokens[1];
    if (!commandId || !IDENTIFIER_PATTERN.test(commandId)) {
      pushError(errors, `Projection ${statement.id} command id '${commandId || ""}' must be a Topogram identifier`, entry.loc);
      continue;
    }
    if (commandIds.has(commandId)) {
      pushError(errors, `Projection ${statement.id} commands has duplicate command '${commandId}'`, entry.loc);
    }
    commandIds.add(commandId);

    const directives = parseDirectives(errors, statement, entry, tokens, 2, `command '${commandId}'`);
    const capabilityId = directives.get("capability");
    if (capabilityId) {
      const capability = registry.get(capabilityId);
      if (!capability || capability.kind !== "capability") {
        pushError(errors, `Projection ${statement.id} command '${commandId}' references unknown capability '${capabilityId}'`, entry.loc);
      }
    }
    const mode = directives.get("mode");
    if (mode && !CLI_COMMAND_EFFECTS.has(mode)) {
      pushError(errors, `Projection ${statement.id} command '${commandId}' has invalid mode '${mode}'`, entry.loc);
    }
  }
  return commandIds;
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {Set<string>} commandIds
 * @returns {void}
 */
function validateCommandOptions(errors, statement, commandIds) {
  for (const entry of blockEntries(getFieldValue(statement, "command_options"))) {
    const tokens = entryTokens(entry);
    const commandId = tokens[0] === "command" ? tokens[1] : null;
    if (!commandId || tokens[2] !== "option" || !tokens[3]) {
      pushError(errors, `Projection ${statement.id} command_options entries must use 'command <id> option <name> type <type>'`, entry.loc);
      continue;
    }
    if (!commandIds.has(commandId)) {
      pushError(errors, `Projection ${statement.id} command_options references unknown command '${commandId}'`, entry.loc);
    }
    const directives = parseDirectives(errors, statement, entry, tokens, 4, `command option '${commandId}.${tokens[3]}'`);
    const type = directives.get("type");
    if (!type) {
      pushError(errors, `Projection ${statement.id} command option '${commandId}.${tokens[3]}' must include type`, entry.loc);
    } else if (!CLI_COMMAND_OPTION_TYPES.has(type)) {
      pushError(errors, `Projection ${statement.id} command option '${commandId}.${tokens[3]}' has invalid type '${type}'`, entry.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramRegistry} registry
 * @param {Set<string>} commandIds
 * @returns {void}
 */
function validateCommandOutputs(errors, statement, registry, commandIds) {
  for (const entry of blockEntries(getFieldValue(statement, "command_outputs"))) {
    const tokens = entryTokens(entry);
    const commandId = tokens[0] === "command" ? tokens[1] : null;
    if (!commandId || tokens[2] !== "format" || !tokens[3]) {
      pushError(errors, `Projection ${statement.id} command_outputs entries must use 'command <id> format <format>'`, entry.loc);
      continue;
    }
    if (!commandIds.has(commandId)) {
      pushError(errors, `Projection ${statement.id} command_outputs references unknown command '${commandId}'`, entry.loc);
    }
    const format = tokens[3];
    if (!CLI_COMMAND_OUTPUT_FORMATS.has(format)) {
      pushError(errors, `Projection ${statement.id} command output '${commandId}' has invalid format '${format}'`, entry.loc);
    }
    const directives = parseDirectives(errors, statement, entry, tokens, 4, `command output '${commandId}'`);
    const schemaId = directives.get("schema");
    if (schemaId) {
      const schema = registry.get(schemaId);
      if (!schema || schema.kind !== "shape") {
        pushError(errors, `Projection ${statement.id} command output '${commandId}' references unknown shape '${schemaId}'`, entry.loc);
      }
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {Set<string>} commandIds
 * @returns {void}
 */
function validateCommandEffects(errors, statement, commandIds) {
  for (const entry of blockEntries(getFieldValue(statement, "command_effects"))) {
    const tokens = entryTokens(entry);
    const commandId = tokens[0] === "command" ? tokens[1] : null;
    if (!commandId || tokens[2] !== "effect" || !tokens[3]) {
      pushError(errors, `Projection ${statement.id} command_effects entries must use 'command <id> effect <effect>'`, entry.loc);
      continue;
    }
    if (!commandIds.has(commandId)) {
      pushError(errors, `Projection ${statement.id} command_effects references unknown command '${commandId}'`, entry.loc);
    }
    if (!CLI_COMMAND_EFFECTS.has(tokens[3])) {
      pushError(errors, `Projection ${statement.id} command effect '${commandId}' has invalid effect '${tokens[3]}'`, entry.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {Set<string>} commandIds
 * @returns {void}
 */
function validateCommandExamples(errors, statement, commandIds) {
  for (const entry of blockEntries(getFieldValue(statement, "command_examples"))) {
    const tokens = entryTokens(entry);
    const commandId = tokens[0] === "command" ? tokens[1] : null;
    if (!commandId || tokens[2] !== "example" || !tokens[3]) {
      pushError(errors, `Projection ${statement.id} command_examples entries must use 'command <id> example <command-line>'`, entry.loc);
      continue;
    }
    if (!commandIds.has(commandId)) {
      pushError(errors, `Projection ${statement.id} command_examples references unknown command '${commandId}'`, entry.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateCliProjection(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }
  if (!validateCliOwnership(errors, statement, fieldMap)) {
    return;
  }
  const commandIds = validateCommands(errors, statement, registry);
  validateCommandOptions(errors, statement, commandIds);
  validateCommandOutputs(errors, statement, registry, commandIds);
  validateCommandEffects(errors, statement, commandIds);
  validateCommandExamples(errors, statement, commandIds);
}
