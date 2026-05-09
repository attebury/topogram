// @ts-check

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadImplementationProvider } from "../../example-implementation.js";
import { stableStringify } from "../../format.js";
import { buildOutputFiles, generateWorkspace } from "../../generator.js";
import { parsePath } from "../../parser.js";
import {
  formatProjectConfigErrors,
  loadProjectConfig,
  outputOwnershipForPath,
  projectConfigOrDefault,
  validateProjectConfig
} from "../../project-config.js";
import { resolveWorkspace } from "../../resolver.js";
import { formatValidationErrors } from "../../validator.js";

export const GENERATED_OUTPUT_SENTINEL = ".topogram-generated.json";

const REPO_ROOT = path.resolve(decodeURIComponent(new URL("../../../../", import.meta.url).pathname));
const IMPLEMENTATION_PROVIDER_TARGETS = new Set([
  "persistence-scaffold",
  "hono-server",
  "express-server",
  "sveltekit-app",
  "environment-plan",
  "environment-bundle",
  "deployment-plan",
  "deployment-bundle",
  "runtime-smoke-plan",
  "runtime-smoke-bundle",
  "runtime-check-plan",
  "runtime-check-bundle",
  "compile-check-plan",
  "compile-check-bundle",
  "app-bundle-plan",
  "app-bundle",
  "native-parity-plan",
  "native-parity-bundle"
]);

/**
 * @typedef {Record<string, any>} AnyRecord
 */

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
function isSameOrInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * @param {string} message
 * @returns {never}
 */
function rejectOutputDir(message) {
  throw new Error(`${message} Choose a generated output directory such as ./app.`);
}

/**
 * @param {string} outDir
 * @param {string} topogramRoot
 * @returns {void}
 */
export function assertSafeGeneratedOutputDir(outDir, topogramRoot) {
  const resolvedOutDir = path.resolve(outDir);
  const resolvedTopogramRoot = path.resolve(topogramRoot);
  const homeDir = path.resolve(os.homedir());
  const cwd = path.resolve(process.cwd());

  if (resolvedOutDir === cwd) {
    rejectOutputDir("Refusing to replace the current working directory.");
  }
  if (resolvedOutDir === REPO_ROOT) {
    rejectOutputDir("Refusing to replace the repository root.");
  }
  if (resolvedOutDir === homeDir) {
    rejectOutputDir("Refusing to replace the home directory.");
  }
  if (isSameOrInside(resolvedOutDir, resolvedTopogramRoot) || isSameOrInside(resolvedTopogramRoot, resolvedOutDir)) {
    rejectOutputDir("Refusing to replace the Topogram source directory or one of its parents/children.");
  }

  if (!fs.existsSync(resolvedOutDir)) {
    return;
  }
  const stat = fs.statSync(resolvedOutDir);
  if (!stat.isDirectory()) {
    throw new Error(`Refusing to write generated output over non-directory path: ${resolvedOutDir}`);
  }
  const hasSentinel = fs.existsSync(path.join(resolvedOutDir, GENERATED_OUTPUT_SENTINEL));
  const isEmpty = fs.readdirSync(resolvedOutDir).length === 0;
  if (!isEmpty && !hasSentinel) {
    rejectOutputDir(
      `Refusing to replace non-empty directory without ${GENERATED_OUTPUT_SENTINEL}: ${resolvedOutDir}.`
    );
  }
}

/**
 * @param {{ config: any, configPath: string|null, configDir: string }|null|undefined} configInfo
 * @param {string} outDir
 * @returns {void}
 */
export function assertProjectOutputAllowsWrite(configInfo, outDir) {
  const ownership = outputOwnershipForPath(configInfo, outDir);
  if (ownership?.ownership === "maintained") {
    throw new Error(
      `Refusing to write generated output to maintained output '${ownership.name}': ${ownership.path}`
    );
  }
}

/**
 * @param {string} target
 * @returns {string}
 */
export function generatedOutputSentinel(target) {
  return `${JSON.stringify({
    generated_by: "topogram",
    target,
    safe_to_replace: true
  }, null, 2)}\n`;
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
export function topogramInputPathForGeneration(inputPath) {
  const absolute = path.resolve(inputPath);
  if (isSameOrInside(REPO_ROOT, absolute)) {
    return `./${path.relative(REPO_ROOT, absolute).replace(/\\/g, "/")}`;
  }
  return path.basename(absolute) === "topogram" ? "./topogram" : ".";
}

/**
 * @param {string} target
 * @returns {boolean}
 */
export function targetRequiresImplementationProvider(target) {
  return IMPLEMENTATION_PROVIDER_TARGETS.has(target);
}

/**
 * @param {{
 *   inputPath: string,
 *   projectRoot: string,
 *   outDir?: string|null,
 *   profileId?: string|null
 * }} options
 * @returns {Promise<number>}
 */
export async function runGenerateAppCommand(options) {
  const ast = parsePath(options.inputPath);
  const explicitProjectConfig = loadProjectConfig(options.projectRoot) || loadProjectConfig(options.inputPath);
  const shouldLoadImplementation = Boolean(explicitProjectConfig?.config?.implementation);
  const implementation = shouldLoadImplementation
    ? await loadImplementationProvider(explicitProjectConfig?.configDir || options.projectRoot)
    : null;
  const resolvedForConfig = resolveWorkspace(ast);
  if (!resolvedForConfig.ok) {
    console.error(formatValidationErrors(resolvedForConfig.validation));
    return 1;
  }
  const defaultProjectConfig = projectConfigOrDefault(options.projectRoot, resolvedForConfig.graph, implementation);
  const projectConfigInfo = explicitProjectConfig || defaultProjectConfig;
  if (!projectConfigInfo) {
    console.error("Unable to resolve topogram.project.json or derive a default project config.");
    return 1;
  }
  const projectConfigValidation = validateProjectConfig(projectConfigInfo.config, resolvedForConfig.graph, {
    configDir: projectConfigInfo.configDir
  });
  if (!projectConfigValidation.ok) {
    console.error(formatProjectConfigErrors(projectConfigValidation, projectConfigInfo?.configPath || "topogram.project.json"));
    return 1;
  }

  const result = generateWorkspace(ast, {
    target: "app-bundle",
    profileId: options.profileId,
    topogramInputPath: topogramInputPathForGeneration(options.inputPath),
    implementation,
    projectConfig: projectConfigInfo.config,
    configDir: projectConfigInfo.configDir || options.projectRoot,
    projectRoot: projectConfigInfo.configDir || options.projectRoot
  });
  if (!result.ok) {
    console.error(formatValidationErrors(result.validation));
    return 1;
  }

  const resolvedOutDir = path.resolve(options.outDir || "./app");
  assertProjectOutputAllowsWrite(projectConfigInfo, resolvedOutDir);
  assertSafeGeneratedOutputDir(resolvedOutDir, options.inputPath);
  const outputFiles = buildOutputFiles(result, {});
  outputFiles.unshift({
    path: GENERATED_OUTPUT_SENTINEL,
    contents: generatedOutputSentinel("app-bundle")
  });
  fs.rmSync(resolvedOutDir, { recursive: true, force: true });
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  for (const file of outputFiles) {
    const destination = path.join(resolvedOutDir, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const contents =
      typeof file.contents === "string" ? file.contents : `${stableStringify(file.contents)}\n`;
    fs.writeFileSync(destination, contents, "utf8");
  }

  console.log(`Wrote ${outputFiles.length} file(s) to ${resolvedOutDir}`);
  return 0;
}
