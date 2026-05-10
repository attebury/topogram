// @ts-check

import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} filePath
 * @returns {any|null}
 */
export function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, any>|null} projectPackage
 * @param {string} packageName
 * @returns {{ field: string|null, spec: string|null }}
 */
function dependencySpecForPackage(projectPackage, packageName) {
  const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  for (const field of dependencyFields) {
    const dependencies = projectPackage?.[field];
    if (dependencies && typeof dependencies === "object" && typeof dependencies[packageName] === "string") {
      return {
        field,
        spec: dependencies[packageName]
      };
    }
  }
  return {
    field: null,
    spec: null
  };
}

/**
 * @param {Record<string, any>|null} lockfile
 * @param {string} packageName
 * @returns {{ version: string|null, resolved: string|null, integrity: string|null, entryPath: string|null }}
 */
function npmLockfileInfoForPackage(lockfile, packageName) {
  const packageEntryPath = `node_modules/${packageName}`;
  const packageEntry = lockfile?.packages?.[packageEntryPath];
  if (packageEntry && typeof packageEntry === "object") {
    return {
      version: typeof packageEntry.version === "string" ? packageEntry.version : null,
      resolved: typeof packageEntry.resolved === "string" ? packageEntry.resolved : null,
      integrity: typeof packageEntry.integrity === "string" ? packageEntry.integrity : null,
      entryPath: packageEntryPath
    };
  }
  const dependencyEntry = lockfile?.dependencies?.[packageName];
  if (dependencyEntry && typeof dependencyEntry === "object") {
    return {
      version: typeof dependencyEntry.version === "string" ? dependencyEntry.version : null,
      resolved: typeof dependencyEntry.resolved === "string" ? dependencyEntry.resolved : null,
      integrity: typeof dependencyEntry.integrity === "string" ? dependencyEntry.integrity : null,
      entryPath: packageName
    };
  }
  return {
    version: null,
    resolved: null,
    integrity: null,
    entryPath: null
  };
}

/**
 * @param {string} projectRoot
 * @returns {{ kind: "npm"|"pnpm"|"yarn"|"bun"|null, path: string|null, data: Record<string, any>|null, note: string|null }}
 */
function lockfileMetadataForProject(projectRoot) {
  const npmLockfilePath = path.join(projectRoot, "package-lock.json");
  if (fs.existsSync(npmLockfilePath)) {
    return {
      kind: "npm",
      path: npmLockfilePath,
      data: readJsonIfPresent(npmLockfilePath),
      note: null
    };
  }
  const candidates = [
    { kind: "pnpm", file: "pnpm-lock.yaml" },
    { kind: "yarn", file: "yarn.lock" },
    { kind: "bun", file: "bun.lock" },
    { kind: "bun", file: "bun.lockb" }
  ];
  for (const candidate of candidates) {
    const lockfilePath = path.join(projectRoot, candidate.file);
    if (fs.existsSync(lockfilePath)) {
      return {
        kind: /** @type {"pnpm"|"yarn"|"bun"} */ (candidate.kind),
        path: lockfilePath,
        data: null,
        note: `${candidate.file} found; package versions are not inspected by this command.`
      };
    }
  }
  return {
    kind: null,
    path: null,
    data: null,
    note: null
  };
}

/**
 * @param {string} projectRoot
 * @param {string} packageName
 * @returns {{ dependencyField: string|null, dependencySpec: string|null, installedVersion: string|null, installedPackageJsonPath: string|null, lockfileKind: "npm"|"pnpm"|"yarn"|"bun"|null, lockfilePath: string|null, lockfileVersion: string|null, lockfileResolved: string|null, lockfileIntegrity: string|null, lockfileEntryPath: string|null, lockfileNote: string|null }}
 */
export function packageInfoForGenerator(projectRoot, packageName) {
  const projectPackage = readJsonIfPresent(path.join(projectRoot, "package.json"));
  const dependency = dependencySpecForPackage(projectPackage, packageName);
  const lockfile = lockfileMetadataForProject(projectRoot);
  const lockfileInfo = lockfile.kind === "npm"
    ? npmLockfileInfoForPackage(lockfile.data, packageName)
    : {
        version: null,
        resolved: null,
        integrity: null,
        entryPath: null
      };
  const installedPackageJsonPath = path.join(projectRoot, "node_modules", ...packageName.split("/"), "package.json");
  const installedPackage = readJsonIfPresent(installedPackageJsonPath);
  return {
    dependencyField: dependency.field,
    dependencySpec: dependency.spec,
    installedVersion: typeof installedPackage?.version === "string" ? installedPackage.version : null,
    installedPackageJsonPath: installedPackage ? installedPackageJsonPath : null,
    lockfileKind: lockfile.kind,
    lockfilePath: lockfile.path,
    lockfileVersion: lockfileInfo.version,
    lockfileResolved: lockfileInfo.resolved,
    lockfileIntegrity: lockfileInfo.integrity,
    lockfileEntryPath: lockfileInfo.entryPath,
    lockfileNote: lockfile.note
  };
}

/**
 * @param {ReturnType<typeof packageInfoForGenerator>} packageInfo
 * @returns {string}
 */
export function formatGeneratorPackageLockfile(packageInfo) {
  if (!packageInfo.lockfileKind || !packageInfo.lockfilePath) {
    return "(not found)";
  }
  const label = path.basename(packageInfo.lockfilePath);
  if (packageInfo.lockfileVersion) {
    return `${packageInfo.lockfileKind} ${packageInfo.lockfileVersion}`;
  }
  return `${label} (version not inspected)`;
}
