// @ts-check

import fs from "node:fs";
import path from "node:path";

import { installPackageSpec } from "../new-project.js";
import { catalogEntryPackageSpec } from "./entries.js";
import { copyPath, ensureEmptyDirectory } from "./files.js";
import { writeTopogramSourceRecord } from "./provenance.js";

/**
 * @param {any} entry
 * @param {string} targetPath
 * @param {{ version?: string|null, catalogSource?: string|null }} [options]
 * @returns {{ ok: boolean, id: string, kind: "topogram", packageSpec: string, targetPath: string, provenancePath: string, files: string[] }}
 */
export function copyCatalogTopogramEntry(entry, targetPath, options = {}) {
  if (entry.kind !== "topogram") {
    throw new Error(`Catalog entry '${entry.id}' is a ${entry.kind}, not a topogram.`);
  }
  const packageSpec = catalogEntryPackageSpec(entry, options.version || null);
  const packageRoot = installPackageSpec(packageSpec);
  const implementationRoot = path.join(packageRoot, "implementation");
  if (fs.existsSync(implementationRoot)) {
    throw new Error(
      `Catalog topogram entry '${entry.id}' package '${packageSpec}' contains implementation/, which is not allowed for v1 topogram entries.`
    );
  }
  const topogramRoot = path.join(packageRoot, "topogram");
  if (!fs.existsSync(topogramRoot) || !fs.statSync(topogramRoot).isDirectory()) {
    throw new Error(`Catalog topogram entry '${entry.id}' package '${packageSpec}' is missing topogram/.`);
  }

  const resolvedTarget = path.resolve(targetPath);
  ensureEmptyDirectory(resolvedTarget);
  /** @type {string[]} */
  const files = [];
  copyPath(topogramRoot, path.join(resolvedTarget, "topogram"), "topogram", files);
  for (const fileName of ["topogram.project.json", "README.md"]) {
    const sourcePath = path.join(packageRoot, fileName);
    if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile()) {
      copyPath(sourcePath, path.join(resolvedTarget, fileName), fileName, files);
    }
  }
  const provenance = writeTopogramSourceRecord(resolvedTarget, {
    catalogSource: options.catalogSource || null,
    entry,
    packageSpec,
    version: options.version || entry.defaultVersion
  });
  return {
    ok: true,
    id: entry.id,
    kind: "topogram",
    packageSpec,
    targetPath: resolvedTarget,
    provenancePath: provenance.path,
    files: files.sort((a, b) => a.localeCompare(b))
  };
}
