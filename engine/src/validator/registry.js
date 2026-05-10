// @ts-check

import { IDENTIFIER_PATTERN, STATEMENT_KINDS } from "./kinds.js";
import { pushError } from "./utils.js";

/**
 * @param {string} oldName
 * @param {string} newName
 * @param {string} example
 * @returns {string}
 */
function renameDiagnostic(oldName, newName, example) {
  return `${oldName} was renamed to ${newName}. Example fix: ${example}`;
}

/**
 * @param {import("../parser.js").WorkspaceAst} workspaceAst
 * @param {ValidationErrors} errors
 * @returns {TopogramRegistry}
 */
export function buildRegistry(workspaceAst, errors) {
  const registry = new Map();

  for (const file of workspaceAst.files) {
    for (const statement of file.statements) {
      if (!STATEMENT_KINDS.has(statement.kind)) {
        if (statement.kind === "component") {
          pushError(errors, `Statement kind ${renameDiagnostic("'component'", "'widget'", "widget widget_data_grid { ... }")}`, statement.loc);
        } else {
          pushError(errors, `Unknown statement kind '${statement.kind}'`, statement.loc);
        }
      }

      if (!IDENTIFIER_PATTERN.test(statement.id)) {
        pushError(errors, `Invalid identifier '${statement.id}'`, statement.loc);
      }

      if (registry.has(statement.id)) {
        pushError(errors, `Duplicate statement id '${statement.id}'`, statement.loc);
        continue;
      }

      registry.set(statement.id, statement);
    }
  }

  return registry;
}
