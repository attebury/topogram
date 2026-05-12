// @ts-check

import path from "node:path";

import { stableStringify } from "../../format.js";
import { initTopogramProject } from "../../init-project.js";

/**
 * @param {string} projectRoot
 * @param {string} cwd
 * @returns {string}
 */
function displayProjectRoot(projectRoot, cwd) {
  const relative = path.relative(cwd, projectRoot);
  return !relative || relative.startsWith("..")
    ? projectRoot
    : relative.split(path.sep).join("/");
}

/**
 * @param {ReturnType<typeof initTopogramProject>} result
 * @param {string} cwd
 * @returns {void}
 */
export function printInitProjectResult(result, cwd) {
  console.log(`Initialized Topogram workspace at ${result.projectRoot}.`);
  console.log("Workspace: topo/");
  console.log("Project config: topogram.project.json");
  console.log("Output ownership: maintained (.)");
  console.log("Template: none");
  console.log("Generated app output: none");
  console.log(`SDLC: ${result.sdlc.enabled ? "adopted/enforced" : "not adopted"}`);
  if (result.created.length > 0) {
    console.log(`Created: ${result.created.join(", ")}`);
  }
  if (result.skipped.length > 0) {
    console.log(`Skipped existing files: ${result.skipped.join(", ")}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${displayProjectRoot(result.projectRoot, cwd)}`);
  console.log("  topogram agent brief --json");
  console.log("  topogram check --json");
  console.log("  topogram query list --json");
  if (result.sdlc.enabled) {
    console.log("  topogram sdlc policy explain --json");
    console.log("  topogram sdlc prep commit . --json");
  } else {
    console.log("  topogram sdlc policy init .");
  }
  console.log("  topogram emit <target> ./topo --json");
}

/**
 * @param {string} inputPath
 * @param {{ json?: boolean, cwd?: string, withSdlc?: boolean }} [options]
 * @returns {number}
 */
export function runInitProjectCommand(inputPath, options = {}) {
  const result = initTopogramProject({ targetPath: inputPath || ".", withSdlc: Boolean(options.withSdlc) });
  if (options.json) {
    console.log(stableStringify(result));
  } else {
    printInitProjectResult(result, options.cwd || process.cwd());
  }
  return 0;
}
