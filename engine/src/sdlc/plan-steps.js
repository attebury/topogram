// @ts-check

import { blockEntries } from "../validator.js";

/**
 * @typedef {{
 *   id: string|null,
 *   status: string|null,
 *   description: string|null,
 *   notes: string|null,
 *   outcome: string|null,
 *   raw: string[],
 *   loc: any
 * }} PlanStep
 */

/**
 * @param {any} token
 * @returns {string|null}
 */
function tokenValue(token) {
  return token && (token.type === "symbol" || token.type === "string") ? token.value : null;
}

/**
 * @param {any[]} items
 * @param {string} key
 * @returns {string|null}
 */
function keyedValue(items, key) {
  for (let index = 2; index < items.length - 1; index += 2) {
    if (tokenValue(items[index]) === key) {
      return tokenValue(items[index + 1]);
    }
  }
  return null;
}

/**
 * @param {any} entry
 * @returns {PlanStep}
 */
export function parsePlanStepEntry(entry) {
  const items = entry?.items || [];
  return {
    id: tokenValue(items[1]),
    status: keyedValue(items, "status"),
    description: keyedValue(items, "description"),
    notes: keyedValue(items, "notes"),
    outcome: keyedValue(items, "outcome"),
    raw: items.map(/** @param {any} item */ (item) => tokenValue(item)).filter(/** @param {string|null} value */ (value) => value !== null),
    loc: entry?.loc || null
  };
}

/**
 * @param {any} value
 * @returns {PlanStep[]}
 */
export function parsePlanSteps(value) {
  return blockEntries(value).map((entry) => parsePlanStepEntry(entry));
}

/**
 * @param {string} planId
 * @param {string} stepId
 * @returns {string}
 */
export function planStepHistoryId(planId, stepId) {
  return `${planId}#${stepId}`;
}
