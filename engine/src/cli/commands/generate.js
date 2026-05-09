// @ts-check

import fs from "node:fs";
import path from "node:path";

import { loadImplementationProvider } from "../../example-implementation.js";
import { stableStringify } from "../../format.js";
import { buildOutputFiles, generateWorkspace } from "../../generator.js";
import { parsePath } from "../../parser.js";
import {
  formatProjectConfigErrors,
  loadProjectConfig,
  projectConfigOrDefault,
  validateProjectConfig
} from "../../project-config.js";
import { resolveWorkspace } from "../../resolver.js";
import { formatValidationErrors } from "../../validator.js";
import {
  assertProjectOutputAllowsWrite,
  assertSafeGeneratedOutputDir,
  GENERATED_OUTPUT_SENTINEL,
  generatedOutputSentinel,
  topogramInputPathForGeneration
} from "../output-safety.js";

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
