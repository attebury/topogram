// @ts-check

import path from "node:path";

import { resolveCatalogTemplateAlias } from "../catalog-alias.js";
import { GENERATOR_POLICY_FILE } from "../../generator-policy.js";
import { createNewProject } from "../../new-project.js";

const ENGINE_ROOT = path.resolve(decodeURIComponent(new URL("../../../", import.meta.url).pathname));
const TEMPLATES_ROOT = path.join(ENGINE_ROOT, "templates");

/**
 * @param {ReturnType<typeof createNewProject>} result
 * @param {string} cwd
 * @returns {string}
 */
function displayProjectRootForNewProject(result, cwd) {
  const relativeProjectRoot = path.relative(cwd, result.projectRoot);
  return !relativeProjectRoot || relativeProjectRoot.startsWith("..")
    ? result.projectRoot
    : relativeProjectRoot;
}

/**
 * @param {ReturnType<typeof createNewProject>} result
 * @param {string} cwd
 * @returns {void}
 */
export function printNewProjectResult(result, cwd) {
  const template = result.template || {};
  console.log(`Created Topogram project at ${result.projectRoot}.`);
  console.log(`Template: ${result.templateName}`);
  console.log(`Source: ${template.source || "unknown"}`);
  if (template.sourceSpec) {
    console.log(`Source spec: ${template.sourceSpec}`);
  }
  if (template.catalog) {
    console.log(`Catalog: ${template.catalog.id} from ${template.catalog.source}`);
    console.log(`Package: ${template.catalog.packageSpec}`);
  }
  console.log(`Executable implementation: ${template.includesExecutableImplementation ? "yes" : "no"}`);
  console.log("Policy: topogram.template-policy.json");
  console.log(`Generator policy: ${GENERATOR_POLICY_FILE}`);
  console.log("Template files: .topogram-template-files.json");
  if (template.includesExecutableImplementation) {
    console.log("Trust: .topogram-template-trust.json");
  }
  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${displayProjectRootForNewProject(result, cwd)}`);
  console.log("  npm install");
  console.log("  npm run agent:brief");
  console.log("  npm run doctor");
  console.log("  npm run source:status");
  console.log("  npm run template:explain");
  console.log("  npm run check");
  console.log("  npm run generator:policy:status");
  console.log("  npm run generator:policy:check");
  if (template.includesExecutableImplementation) {
    console.log("  npm run template:policy:explain");
    console.log("  npm run trust:status");
  }
  console.log("  npm run generate");
  console.log("  npm run verify");
}

/**
 * @param {string} inputPath
 * @param {{ templateName: string, catalogSource?: string|null, cwd?: string }} options
 * @returns {number}
 */
export function runNewProjectCommand(inputPath, options) {
  const cwd = options.cwd || process.cwd();
  const projectRoot = path.resolve(inputPath);
  const relativeToEngine = path.relative(ENGINE_ROOT, projectRoot);
  if (relativeToEngine === "" || (!relativeToEngine.startsWith("..") && !path.isAbsolute(relativeToEngine))) {
    throw new Error(
      `Refusing to create a generated project inside the engine directory. Use a path outside engine, for example '../${path.basename(projectRoot)}'.`
    );
  }
  const resolvedTemplate = resolveCatalogTemplateAlias(options.templateName, options.catalogSource || null);
  const result = createNewProject({
    targetPath: inputPath,
    templateName: resolvedTemplate.templateName,
    templateProvenance: resolvedTemplate.provenance,
    engineRoot: ENGINE_ROOT,
    templatesRoot: TEMPLATES_ROOT
  });
  printNewProjectResult(result, cwd);
  return 0;
}
