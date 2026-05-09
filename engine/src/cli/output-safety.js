// @ts-check

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { outputOwnershipForPath } from "../project-config.js";

export const GENERATED_OUTPUT_SENTINEL = ".topogram-generated.json";

const REPO_ROOT = path.resolve(decodeURIComponent(new URL("../../../", import.meta.url).pathname));

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
