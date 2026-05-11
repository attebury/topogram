// @ts-check

import { blockEntries, getFieldValue } from "../validator/utils.js";

/**
 * @param {TopogramToken | null | undefined} token
 * @returns {string | null}
 */
function tokenText(token) {
  return token?.type === "symbol" || token?.type === "string" ? token.value : null;
}

/**
 * @param {TopogramToken[]} items
 * @returns {(string | string[])[]}
 */
function normalizeSequence(items) {
  return items.map((item) => {
    if (item.type === "symbol" || item.type === "string") {
      return item.value;
    }
    if (item.type === "list") {
      return item.items.map((nested) => tokenText(nested)).filter((value) => value !== null);
    }
    return item.type;
  });
}

/**
 * @param {TopogramToken[]} items
 * @param {number} startIndex
 * @returns {Record<string, string | string[]>}
 */
function parseDirectives(items, startIndex) {
  /** @type {Record<string, string | string[]>} */
  const directives = {};
  for (let index = startIndex; index < items.length; index += 2) {
    const key = tokenText(items[index]);
    const valueToken = items[index + 1];
    const value = valueToken?.type === "list"
      ? valueToken.items.map((item) => tokenText(item)).filter((item) => item !== null)
      : tokenText(valueToken);
    if (key && value != null) {
      directives[key] = value;
    }
  }
  return directives;
}

/**
 * @param {TopogramStatement} statement
 * @param {TopogramRegistry} registry
 * @returns {Record<string, any>[]}
 */
export function parseProjectionCliCommandsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "commands")).map((entry) => {
    const commandId = tokenText(entry.items[1]);
    const directives = parseDirectives(entry.items, 2);
    const capabilityId = typeof directives.capability === "string" ? directives.capability : null;
    return {
      type: "cli_command",
      id: commandId,
      capability: capabilityId
        ? {
            id: capabilityId,
            kind: registry.get(capabilityId)?.kind || null
          }
        : null,
      usage: typeof directives.usage === "string" ? directives.usage : null,
      mode: typeof directives.mode === "string" ? directives.mode : null,
      description: typeof directives.description === "string" ? directives.description : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

/**
 * @param {TopogramStatement} statement
 * @returns {Record<string, any>[]}
 */
export function parseProjectionCliOptionsBlock(statement) {
  return blockEntries(getFieldValue(statement, "command_options")).map((entry) => {
    const directives = parseDirectives(entry.items, 4);
    return {
      type: "cli_option",
      command: tokenText(entry.items[1]),
      name: tokenText(entry.items[3]),
      optionType: typeof directives.type === "string" ? directives.type : null,
      flag: typeof directives.flag === "string" ? directives.flag : null,
      required: directives.required === "true",
      defaultValue: directives.default ?? null,
      description: typeof directives.description === "string" ? directives.description : null,
      values: Array.isArray(directives.values) ? directives.values : [],
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

/**
 * @param {TopogramStatement} statement
 * @param {TopogramRegistry} registry
 * @returns {Record<string, any>[]}
 */
export function parseProjectionCliOutputsBlock(statement, registry) {
  return blockEntries(getFieldValue(statement, "command_outputs")).map((entry) => {
    const directives = parseDirectives(entry.items, 4);
    const schemaId = typeof directives.schema === "string" ? directives.schema : null;
    return {
      type: "cli_output",
      command: tokenText(entry.items[1]),
      format: tokenText(entry.items[3]),
      schema: schemaId
        ? {
            id: schemaId,
            kind: registry.get(schemaId)?.kind || null
          }
        : null,
      description: typeof directives.description === "string" ? directives.description : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

/**
 * @param {TopogramStatement} statement
 * @returns {Record<string, any>[]}
 */
export function parseProjectionCliEffectsBlock(statement) {
  return blockEntries(getFieldValue(statement, "command_effects")).map((entry) => {
    const directives = parseDirectives(entry.items, 4);
    return {
      type: "cli_effect",
      command: tokenText(entry.items[1]),
      effect: tokenText(entry.items[3]),
      target: typeof directives.target === "string" ? directives.target : null,
      description: typeof directives.description === "string" ? directives.description : null,
      raw: normalizeSequence(entry.items),
      loc: entry.loc
    };
  });
}

/**
 * @param {TopogramStatement} statement
 * @returns {Record<string, any>[]}
 */
export function parseProjectionCliExamplesBlock(statement) {
  return blockEntries(getFieldValue(statement, "command_examples")).map((entry) => ({
    type: "cli_example",
    command: tokenText(entry.items[1]),
    example: tokenText(entry.items[3]),
    raw: normalizeSequence(entry.items),
    loc: entry.loc
  }));
}
