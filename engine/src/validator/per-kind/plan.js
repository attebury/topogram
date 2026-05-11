// @ts-check

import {
  PLAN_IDENTIFIER_PATTERN,
  PLAN_STEP_STATUSES,
  PRIORITY_VALUES
} from "../kinds.js";
import {
  blockEntries,
  pushError,
  symbolValue
} from "../utils.js";
import { parsePlanStepEntry } from "../../sdlc/plan-steps.js";

/** @param {ValidationErrors} errors @param {TopogramStatement} statement */
function validatePlanIdentifier(errors, statement) {
  if (!PLAN_IDENTIFIER_PATTERN.test(statement.id)) {
    pushError(
      errors,
      `Plan identifier '${statement.id}' must match ${PLAN_IDENTIFIER_PATTERN.source}`,
      statement.loc
    );
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap */
function validatePriority(errors, statement, fieldMap) {
  const field = fieldMap.get("priority")?.[0];
  if (!field) return;
  if (field.value.type !== "symbol") {
    pushError(errors, `Field 'priority' on plan ${statement.id} must be a symbol`, field.loc);
    return;
  }
  if (!PRIORITY_VALUES.has(field.value.value)) {
    pushError(errors, `Invalid priority '${field.value.value}' on plan ${statement.id}`, field.loc);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @param {TopogramRegistry} registry
 * @returns {void}
 */
function validatePlanTask(errors, statement, fieldMap, registry) {
  const field = fieldMap.get("task")?.[0];
  if (!field || field.value.type !== "symbol") return;
  const target = registry.get(field.value.value);
  if (!target) return;
  if (target.kind !== "task") {
    pushError(errors, `Plan ${statement.id} task must reference a task, found ${target.kind} '${target.id}'`, field.loc);
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
function validateStepRows(errors, statement, fieldMap) {
  const field = fieldMap.get("steps")?.[0];
  if (!field || field.value.type !== "block") return;

  const seen = new Set();
  const entries = blockEntries(field.value);
  if (entries.length === 0) {
    pushError(errors, `Plan ${statement.id} must include at least one step`, field.loc);
  }
  for (const entry of entries) {
    const [kindToken, idToken, ...rest] = entry.items;
    if (kindToken?.type !== "symbol" || kindToken.value !== "step") {
      pushError(errors, `Each 'steps' entry on plan ${statement.id} must start with 'step'`, entry.loc);
      continue;
    }
    if (idToken?.type !== "symbol" || !/^[a-z][a-z0-9_]*$/.test(idToken.value)) {
      pushError(errors, `Plan ${statement.id} step id must be a symbol matching /^[a-z][a-z0-9_]*$/`, idToken?.loc || entry.loc);
      continue;
    }
    if (seen.has(idToken.value)) {
      pushError(errors, `Plan ${statement.id} has duplicate step '${idToken.value}'`, idToken.loc);
    }
    seen.add(idToken.value);

    if (rest.length % 2 !== 0) {
      pushError(errors, `Plan ${statement.id} step '${idToken.value}' fields must be key/value pairs`, entry.loc);
    }

    const allowedKeys = new Set(["status", "description", "notes", "outcome"]);
    for (let index = 0; index < rest.length - 1; index += 2) {
      const keyToken = rest[index];
      if (keyToken?.type !== "symbol" || !allowedKeys.has(keyToken.value)) {
        pushError(errors, `Plan ${statement.id} step '${idToken.value}' has unsupported field '${keyToken?.value || "unknown"}'`, keyToken?.loc || entry.loc);
      }
    }

    const parsed = parsePlanStepEntry(entry);
    if (!parsed.status) {
      pushError(errors, `Plan ${statement.id} step '${idToken.value}' requires status`, entry.loc);
    } else if (!PLAN_STEP_STATUSES.has(parsed.status)) {
      pushError(errors, `Invalid step status '${parsed.status}' on plan ${statement.id} step '${idToken.value}'`, entry.loc);
    }
    if (!parsed.description) {
      pushError(errors, `Plan ${statement.id} step '${idToken.value}' requires description`, entry.loc);
    }
  }
}

/** @param {ValidationErrors} errors @param {TopogramStatement} statement @param {TopogramFieldMap} fieldMap @param {TopogramRegistry} registry */
export function validatePlan(errors, statement, fieldMap, registry) {
  if (statement.kind !== "plan") {
    return;
  }
  validatePlanIdentifier(errors, statement);
  validatePriority(errors, statement, fieldMap);
  validatePlanTask(errors, statement, fieldMap, registry);
  validateStepRows(errors, statement, fieldMap);

  const status = symbolValue(fieldMap.get("status")?.[0]?.value);
  if (status === "complete") {
    const steps = blockEntries(fieldMap.get("steps")?.[0]?.value).map((entry) => parsePlanStepEntry(entry));
    const incomplete = steps.filter((step) => step.status !== "done" && step.status !== "skipped");
    if (incomplete.length > 0) {
      pushError(errors, `Plan ${statement.id} status 'complete' requires all steps to be done or skipped`, fieldMap.get("status")?.[0]?.loc || statement.loc);
    }
  }
}
