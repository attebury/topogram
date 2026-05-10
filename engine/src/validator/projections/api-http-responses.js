// @ts-check

import {
  blockSymbolItems,
  getFieldValue,
  pushError,
  symbolValues
} from "../utils.js";
import { resolveCapabilityContractFields } from "./helpers.js";

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
export function validateProjectionHttpResponses(errors, statement, fieldMap, registry) {
  if (statement.kind !== "projection") {
    return;
  }

  const httpResponsesField = fieldMap.get("responses")?.[0];
  if (!httpResponsesField || httpResponsesField.value.type !== "block") {
    return;
  }

  const realized = new Set(symbolValues(getFieldValue(statement, "realizes")));
  for (const entry of httpResponsesField.value.entries) {
    const tokens = blockSymbolItems(entry).map((item) => item.value);
    const capabilityId = tokens[0];
    const capability = registry.get(capabilityId);

    if (!capability) {
      pushError(errors, `Projection ${statement.id} responses references missing capability '${capabilityId}'`, entry.loc);
      continue;
    }
    if (capability.kind !== "capability") {
      pushError(errors, `Projection ${statement.id} responses must target a capability, found ${capability.kind} '${capability.id}'`, entry.loc);
    }
    if (!realized.has(capabilityId)) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must also appear in 'realizes'`, entry.loc);
    }

    const directives = parseProjectionHttpResponsesDirectives(tokens.slice(1));
    for (const message of directives.errors) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' ${message}`, entry.loc);
    }

    if (!directives.mode) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'mode'`, entry.loc);
    }

    const mode = directives.mode;
    if (mode && !["item", "collection", "paged", "cursor"].includes(mode)) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' has invalid mode '${mode}'`, entry.loc);
    }

    const itemShapeId = directives.item;
    if (mode && mode !== "item" && !itemShapeId) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'item' for mode '${mode}'`, entry.loc);
    }
    if (itemShapeId) {
      const itemShape = registry.get(itemShapeId);
      if (!itemShape) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' references missing shape '${itemShapeId}'`, entry.loc);
      } else if (itemShape.kind !== "shape") {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must reference a shape for 'item', found ${itemShape.kind} '${itemShape.id}'`, entry.loc);
      }
    }

    if (mode === "cursor") {
      if (!directives.cursor?.requestAfter) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'cursor request_after <field>'`, entry.loc);
      }
      if (!directives.cursor?.responseNext) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'cursor response_next <wire_name>'`, entry.loc);
      }
      if (!directives.limit) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'limit field <field> default <n> max <n>'`, entry.loc);
      }
      if (!directives.sort) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must include 'sort by <field> direction <asc|desc>'`, entry.loc);
      }
    }

    if (directives.sort && !["asc", "desc"].includes(directives.sort.direction || "")) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' has invalid sort direction '${directives.sort.direction}'`, entry.loc);
    }

    if (directives.total && !["true", "false"].includes(directives.total.included || "")) {
      pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' has invalid total included value '${directives.total.included}'`, entry.loc);
    }

    if (directives.limit) {
      const defaultValue = Number.parseInt(directives.limit.defaultValue || "", 10);
      const maxValue = Number.parseInt(directives.limit.maxValue || "", 10);
      if (!Number.isInteger(defaultValue) || !Number.isInteger(maxValue)) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must use integer default/max values for 'limit'`, entry.loc);
      } else if (defaultValue > maxValue) {
        pushError(errors, `Projection ${statement.id} responses for '${capabilityId}' must use default <= max for 'limit'`, entry.loc);
      }
    }

    const inputFields = resolveCapabilityContractFields(registry, capabilityId, "input");
    const outputFields = resolveCapabilityContractFields(registry, capabilityId, "output");
    if (directives.cursor?.requestAfter && inputFields.size > 0 && !inputFields.has(directives.cursor.requestAfter)) {
      pushError(errors, `Projection ${statement.id} responses references unknown input field '${directives.cursor.requestAfter}' for cursor request_after on ${capabilityId}`, entry.loc);
    }
    if (directives.limit?.field && inputFields.size > 0 && !inputFields.has(directives.limit.field)) {
      pushError(errors, `Projection ${statement.id} responses references unknown input field '${directives.limit.field}' for limit on ${capabilityId}`, entry.loc);
    }
    if (directives.sort?.field && outputFields.size > 0 && !outputFields.has(directives.sort.field)) {
      pushError(errors, `Projection ${statement.id} responses references unknown output field '${directives.sort.field}' for sort on ${capabilityId}`, entry.loc);
    }
  }
}

/**
 * @param {string[]} tokens
 * @returns {{
 *   mode: string | null,
 *   item: string | null,
 *   cursor: { requestAfter: string | null, responseNext: string | null, responsePrev: string | null } | null,
 *   limit: { field: string | null, defaultValue: string | null, maxValue: string | null } | null,
 *   sort: { field: string | null, direction: string | null } | null,
 *   total: { included: string | null } | null,
 *   errors: string[]
 * }}
 */
export function parseProjectionHttpResponsesDirectives(tokens) {
  /** @type {{
   *   mode: string | null,
   *   item: string | null,
   *   cursor: { requestAfter: string | null, responseNext: string | null, responsePrev: string | null } | null,
   *   limit: { field: string | null, defaultValue: string | null, maxValue: string | null } | null,
   *   sort: { field: string | null, direction: string | null } | null,
   *   total: { included: string | null } | null,
   *   errors: string[]
   * }}
   */
  const result = {
    mode: null,
    item: null,
    cursor: null,
    limit: null,
    sort: null,
    total: null,
    errors: []
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "mode") {
      result.mode = tokens[i + 1] || null;
      if (!tokens[i + 1]) {
        result.errors.push("is missing a value for 'mode'");
      }
      i += 1;
      continue;
    }
    if (token === "item") {
      result.item = tokens[i + 1] || null;
      if (!tokens[i + 1]) {
        result.errors.push("is missing a value for 'item'");
      }
      i += 1;
      continue;
    }
    if (token === "cursor") {
      const requestKeyword = tokens[i + 1];
      const requestField = tokens[i + 2];
      const responseKeyword = tokens[i + 3];
      const responseNext = tokens[i + 4];
      let responsePrev = null;
      let consumed = 4;
      if (tokens[i + 5] === "response_prev") {
        responsePrev = tokens[i + 6] || null;
        consumed = 6;
      }
      result.cursor = {
        requestAfter: requestKeyword === "request_after" ? requestField : null,
        responseNext: responseKeyword === "response_next" ? responseNext : null,
        responsePrev
      };
      if (requestKeyword !== "request_after") {
        result.errors.push("must use 'cursor request_after <field>'");
      }
      if (responseKeyword !== "response_next") {
        result.errors.push("must use 'cursor response_next <wire_name>'");
      }
      i += consumed;
      continue;
    }
    if (token === "limit") {
      result.limit = {
        field: tokens[i + 1] === "field" ? tokens[i + 2] || null : null,
        defaultValue: tokens[i + 3] === "default" ? tokens[i + 4] || null : null,
        maxValue: tokens[i + 5] === "max" ? tokens[i + 6] || null : null
      };
      if (tokens[i + 1] !== "field" || tokens[i + 3] !== "default" || tokens[i + 5] !== "max") {
        result.errors.push("must use 'limit field <field> default <n> max <n>'");
      }
      i += 6;
      continue;
    }
    if (token === "sort") {
      result.sort = {
        field: tokens[i + 1] === "by" ? tokens[i + 2] || null : null,
        direction: tokens[i + 3] === "direction" ? tokens[i + 4] || null : null
      };
      if (tokens[i + 1] !== "by" || tokens[i + 3] !== "direction") {
        result.errors.push("must use 'sort by <field> direction <asc|desc>'");
      }
      i += 4;
      continue;
    }
    if (token === "total") {
      result.total = {
        included: tokens[i + 1] === "included" ? tokens[i + 2] || null : null
      };
      if (tokens[i + 1] !== "included") {
        result.errors.push("must use 'total included <true|false>'");
      }
      i += 2;
      continue;
    }

    result.errors.push(`has unknown directive '${token}'`);
  }

  return result;
}
