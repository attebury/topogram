// @ts-check

import fs from "node:fs";
import path from "node:path";

import { CLI_PACKAGE_NAME } from "./constants.js";

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function packageNameFromPath(projectRoot) {
  const baseName = path.basename(path.resolve(projectRoot)).toLowerCase();
  const normalized = baseName
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "");
  return normalized || "topogram-app";
}

/**
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @returns {string}
 */
function fileDependencyForEngine(projectRoot, engineRoot) {
  const relative = path.relative(projectRoot, engineRoot).replace(/\\/g, "/");
  if (!relative || relative.startsWith("..")) {
    return `file:${engineRoot}`;
  }
  return `file:./${relative}`;
}

/**
 * @param {string} engineRoot
 * @returns {{ name: string, version: string }}
 */
function readCliPackageMetadata(engineRoot) {
  const packagePath = path.join(engineRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return {
    name: typeof pkg.name === "string" ? pkg.name : CLI_PACKAGE_NAME,
    version: typeof pkg.version === "string" ? pkg.version : "0.0.0"
  };
}

/**
 * @param {string} engineRoot
 * @returns {boolean}
 */
function isSourceCheckoutEngine(engineRoot) {
  return fs.existsSync(path.join(engineRoot, "tests", "active"));
}

/**
 * @param {string} projectRoot
 * @param {string} engineRoot
 * @returns {{ name: string, spec: string }}
 */
export function cliDependencyForProject(projectRoot, engineRoot) {
  const metadata = readCliPackageMetadata(engineRoot);
  const overrideSpec = process.env.TOPOGRAM_CLI_PACKAGE_SPEC || "";
  if (overrideSpec) {
    return { name: metadata.name, spec: overrideSpec };
  }
  if (isSourceCheckoutEngine(engineRoot)) {
    return { name: metadata.name, spec: fileDependencyForEngine(projectRoot, engineRoot) };
  }
  return { name: metadata.name, spec: metadata.version };
}

/**
 * @param {string} projectRoot
 * @param {{ name: string, spec: string }} cliDependency
 * @returns {void}
 */
export function writeProjectNpmConfig(projectRoot, cliDependency) {
  void projectRoot;
  void cliDependency;
}

/**
 * @param {string} templateRoot
 * @returns {Record<string, string>}
 */
export function generatorDependenciesForTemplate(templateRoot) {
  const packagePath = path.join(templateRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    return {};
  }
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const explicit = pkg.topogramGeneratorDependencies &&
    typeof pkg.topogramGeneratorDependencies === "object" &&
    !Array.isArray(pkg.topogramGeneratorDependencies)
    ? pkg.topogramGeneratorDependencies
    : {};
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...explicit
  };
  return Object.fromEntries(Object.entries(dependencies).filter(([name, spec]) =>
    typeof name === "string" &&
    (name.includes("topogram-generator") || name.startsWith("@topogram/generator-")) &&
    typeof spec === "string" &&
    spec.length > 0
  ));
}

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
export function isSameOrInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isLocalTemplateSpec(value) {
  return value === "." ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    path.isAbsolute(value);
}

/**
 * @param {string} spec
 * @returns {string}
 */
export function packageNameFromSpec(spec) {
  if (spec.startsWith("@")) {
    const segments = spec.split("/");
    if (segments.length < 2) {
      throw new Error(`Invalid scoped template package spec '${spec}'.`);
    }
    const scope = segments[0];
    const nameAndVersion = segments[1];
    const versionIndex = nameAndVersion.indexOf("@");
    const name = versionIndex >= 0 ? nameAndVersion.slice(0, versionIndex) : nameAndVersion;
    return `${scope}/${name}`;
  }
  const versionIndex = spec.indexOf("@");
  return versionIndex >= 0 ? spec.slice(0, versionIndex) : spec;
}

/**
 * @param {string|null|undefined} spec
 * @returns {string|null}
 */
export function packageScopeFromSpec(spec) {
  if (!spec) {
    return null;
  }
  const packageName = packageNameFromSpec(spec);
  return packageName.startsWith("@") ? packageName.split("/")[0] : null;
}
