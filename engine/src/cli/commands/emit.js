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
import { readFromSnapshot } from "./emit/snapshot-input.js";

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

const IMPLEMENTATION_OPTIONAL_TARGETS = new Set([
  "app-bundle-plan",
  "app-bundle",
  "environment-plan",
  "environment-bundle",
  "compile-check-plan",
  "compile-check-bundle"
]);

/**
 * @param {string} target
 * @returns {boolean}
 */
function targetRequiresImplementationProvider(target) {
  return IMPLEMENTATION_PROVIDER_TARGETS.has(target);
}

/**
 * @param {{
 *   inputPath: string,
 *   projectRoot: string,
 *   target: string,
 *   write?: boolean,
 *   outDir?: string|null,
 *   selectors?: Record<string, any>,
 *   outputSelectors?: Record<string, any>,
 *   profileId?: string|null,
 *   fromSnapshotPath?: string|null,
 *   fromTopogramPath?: string|null
 * }} options
 * @returns {Promise<number>}
 */
export async function runEmitCommand(options) {
  const ast = parsePath(options.inputPath);
  let fromSnapshot = null;
  if (options.fromSnapshotPath) {
    const parsedSnapshot = readFromSnapshot(options.fromSnapshotPath);
    if (!parsedSnapshot.ok) {
      console.error(parsedSnapshot.message);
      return 1;
    }
    fromSnapshot = parsedSnapshot.snapshot;
  }
  const explicitProjectConfig = loadProjectConfig(options.projectRoot) || loadProjectConfig(options.inputPath);
  const shouldLoadImplementation = targetRequiresImplementationProvider(options.target) &&
    (!IMPLEMENTATION_OPTIONAL_TARGETS.has(options.target) || Boolean(explicitProjectConfig?.config?.implementation));
  const implementation = shouldLoadImplementation
    ? await loadImplementationProvider(explicitProjectConfig?.configDir || options.projectRoot)
    : null;
  const resolvedForConfig = targetRequiresImplementationProvider(options.target) || explicitProjectConfig
    ? resolveWorkspace(ast)
    : null;
  if (resolvedForConfig && !resolvedForConfig.ok) {
    console.error(formatValidationErrors(resolvedForConfig.validation));
    return 1;
  }
  const projectConfigInfo = resolvedForConfig
    ? (explicitProjectConfig || projectConfigOrDefault(options.projectRoot, resolvedForConfig.graph, implementation))
    : null;
  const projectConfigValidation = projectConfigInfo
    ? validateProjectConfig(projectConfigInfo.config, resolvedForConfig?.graph || null, { configDir: projectConfigInfo.configDir })
    : { ok: true, errors: [] };
  if (!projectConfigValidation.ok) {
    console.error(formatProjectConfigErrors(projectConfigValidation, projectConfigInfo?.configPath || "topogram.project.json"));
    return 1;
  }

  const result = generateWorkspace(ast, {
    target: options.target,
    ...(options.selectors || {}),
    profileId: options.profileId,
    fromSnapshot,
    fromSnapshotPath: options.fromSnapshotPath,
    fromTopogramPath: options.fromTopogramPath,
    topogramInputPath: topogramInputPathForGeneration(options.inputPath),
    implementation,
    projectConfig: projectConfigInfo?.config || null,
    configDir: projectConfigInfo?.configDir || options.projectRoot,
    projectRoot: projectConfigInfo?.configDir || options.projectRoot
  });
  if (!result.ok) {
    console.error(formatValidationErrors(result.validation));
    return 1;
  }

  if (options.write) {
    const resolvedOutDir = path.resolve(options.outDir || "artifacts");
    assertProjectOutputAllowsWrite(projectConfigInfo, resolvedOutDir);
    assertSafeGeneratedOutputDir(resolvedOutDir, options.inputPath);
    const outputFiles = buildOutputFiles(result, options.outputSelectors || {});
    outputFiles.unshift({
      path: GENERATED_OUTPUT_SENTINEL,
      contents: generatedOutputSentinel(options.target)
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

  console.log(typeof result.artifact === "string" ? result.artifact : stableStringify(result.artifact));
  return 0;
}
