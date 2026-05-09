// @ts-check

import { stableStringify } from "../../format.js";
import { parsePath } from "../../parser.js";
import { resolveWorkspace } from "../../resolver.js";
import { formatValidationErrors } from "../../validator.js";

/**
 * @param {Record<string, any>} workspaceAst
 * @returns {void}
 */
function summarize(workspaceAst) {
  const statements = workspaceAst.files.flatMap((/** @type {{ statements: any[] }} */ file) => file.statements);
  const byKind = new Map();

  for (const statement of statements) {
    byKind.set(statement.kind, (byKind.get(statement.kind) || 0) + 1);
  }

  console.log(`Parsed ${workspaceAst.files.length} file(s) and ${statements.length} statement(s).`);
  for (const [kind, count] of [...byKind.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`- ${kind}: ${count}`);
  }
}

/**
 * @param {string|null|undefined} inputPath
 * @returns {number}
 */
export function runResolveCommand(inputPath) {
  const ast = parsePath(inputPath || ".");
  const result = resolveWorkspace(ast);
  if (!result.ok) {
    console.error(formatValidationErrors(result.validation));
    return 1;
  }

  console.log(JSON.stringify(result.graph, null, 2));
  return 0;
}

/**
 * @param {string|null|undefined} inputPath
 * @param {{ json?: boolean }} [options]
 * @returns {number}
 */
export function runParseCommand(inputPath, options = {}) {
  const ast = parsePath(inputPath || ".");
  if (options.json) {
    console.log(stableStringify(ast));
  } else {
    summarize(ast);
  }
  return 0;
}
