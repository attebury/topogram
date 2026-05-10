// @ts-check

import {
  blockSymbolItems,
  pushError,
  valueAsArray
} from "./utils.js";

/**
 * @param {unknown} token
 * @returns {token is string}
 */
function isIdentifierLike(token) {
  return typeof token === "string" && token.length > 0;
}

/**
 * @param {unknown} token
 * @returns {token is string}
 */
function isComparator(token) {
  return typeof token === "string" && ["==", "!=", "<", "<=", ">", ">="].includes(token);
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramBlockEntry} entry
 * @returns {void}
 */
function validateInvariantEntry(errors, statement, entry) {
  const tokens = blockSymbolItems(entry).map((item) => item.value);
  if (tokens.length < 2) {
    pushError(errors, `Invariant on ${statement.kind} ${statement.id} is too short`, entry.loc);
    return;
  }

  const [left, op, ...rest] = tokens;
  if (!isIdentifierLike(left)) {
    pushError(errors, `Invariant on ${statement.kind} ${statement.id} must start with a field or expression target`, entry.loc);
    return;
  }

  if (op === "requires") {
    if (rest.length < 3) {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} must be '<field> requires <field> <op> <value>'`, entry.loc);
    } else if (!isComparator(rest[1])) {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} uses an invalid comparator '${rest[1]}'`, entry.loc);
    }
    return;
  }

  if (op === "length") {
    if (rest.length !== 2 || !["<", "<=", ">", ">=", "=="].includes(rest[0])) {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} must be '<field> length <op> <number>'`, entry.loc);
    }
    return;
  }

  if (op === "format") {
    if (rest.length !== 2 || rest[0] !== "==") {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} must be '<field> format == <format>'`, entry.loc);
    }
    return;
  }

  if (isComparator(op)) {
    if (rest.length < 1) {
      pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} is missing a right-hand value`, entry.loc);
      return;
    }

    if (rest[1] === "implies") {
      const [, , impliedField, impliedOperator, impliedValue] = rest;
      if (!impliedField || !impliedOperator || !impliedValue) {
        pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} must fully specify the implied clause`, entry.loc);
      } else if (!(impliedOperator === "is" || isComparator(impliedOperator))) {
        pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} has invalid implied operator '${impliedOperator}'`, entry.loc);
      }
      return;
    }

    return;
  }

  pushError(errors, `Invariant '${tokens.join(" ")}' on ${statement.kind} ${statement.id} uses unsupported form`, entry.loc);
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramField | null | undefined} field
 * @param {string} label
 * @returns {void}
 */
function validateRuleExpressionValue(errors, statement, field, label) {
  if (!field) {
    return;
  }

  const items = valueAsArray(field.value);
  if (items.length !== 1) {
    pushError(errors, `Field '${label}' on rule ${statement.id} must contain a single expression`, field.loc);
    return;
  }

  const item = items[0];
  if (item.type !== "string" && item.type !== "symbol") {
    pushError(errors, `Field '${label}' on rule ${statement.id} must be a string or symbol expression`, field.loc);
    return;
  }

  const text = item.value.trim();
  if (text.length === 0) {
    pushError(errors, `Field '${label}' on rule ${statement.id} must not be empty`, field.loc);
    return;
  }

  if (label === "requirement" || label === "condition") {
    if (!/(==|!=|<=|>=|<|>)/.test(text)) {
      pushError(errors, `Field '${label}' on rule ${statement.id} must include a comparison operator`, field.loc);
    }
  }
}

/**
 * @param {ValidationErrors} errors
 * @param {TopogramStatement} statement
 * @param {TopogramFieldMap} fieldMap
 * @returns {void}
 */
export function validateExpressions(errors, statement, fieldMap) {
  if (statement.kind === "entity") {
    const invariantsField = fieldMap.get("invariants")?.[0];
    if (invariantsField?.value.type === "block") {
      for (const entry of invariantsField.value.entries) {
        validateInvariantEntry(errors, statement, entry);
      }
    }
  }

  if (statement.kind === "rule") {
    validateRuleExpressionValue(errors, statement, fieldMap.get("condition")?.[0], "condition");
    validateRuleExpressionValue(errors, statement, fieldMap.get("requirement")?.[0], "requirement");
  }
}
