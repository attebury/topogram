// @ts-check

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../format.js";
import { parsePath } from "../../parser.js";
import { formatValidationErrors, validateWorkspace } from "../../validator.js";
import { resolveTopoRoot } from "../../workspace-paths.js";
import { runWorkflow } from "../../workflows.js";

/**
 * @param {string|null|undefined} inputPath
 * @returns {number}
 */
export function runValidateCommand(inputPath) {
  const requestedPath = inputPath || ".";
  const targetPath = fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
    ? requestedPath
    : resolveTopoRoot(requestedPath);
  const ast = parsePath(targetPath);
  const result = validateWorkspace(ast);
  if (!result.ok) {
    console.error(formatValidationErrors(result));
    return 1;
  }

  const files = /** @type {Array<{ statements: any[] }>} */ (ast.files || []);
  const statementCount = files.flatMap((file) => file.statements).length;
  console.log(`Validated ${files.length} file(s) and ${statementCount} statement(s) with 0 errors.`);
  return 0;
}

/**
 * @param {{
 *   workflowName: string,
 *   inputPath: string|null|undefined,
 *   from: string|null,
 *   adopt: string|null,
 *   write: boolean,
 *   refreshAdopted: boolean,
 *   outDir: string|null
 * }} context
 * @returns {number}
 */
export function runLegacyWorkflowCommand(context) {
  const result = runWorkflow(context.workflowName, context.inputPath || ".", {
    from: context.from,
    adopt: context.adopt,
    write: context.write,
    refreshAdopted: context.refreshAdopted
  });

  if (context.write) {
    const resolvedOutDir = path.resolve(context.outDir || result.defaultOutDir || "artifacts");
    fs.mkdirSync(resolvedOutDir, { recursive: true });
    for (const [relativePath, contents] of Object.entries(result.files || {})) {
      const destination = path.join(resolvedOutDir, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, typeof contents === "string" ? contents : `${stableStringify(contents)}\n`, "utf8");
    }
    console.log(`Wrote ${Object.keys(result.files || {}).length} file(s) to ${resolvedOutDir}`);
    return 0;
  }

  console.log(stableStringify(result.summary));
  return 0;
}
