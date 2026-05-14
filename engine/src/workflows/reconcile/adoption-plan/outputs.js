// @ts-check

import fs from "node:fs";
import path from "node:path";

import { adoptionItemKey } from "../../../adoption/plan.js";
import {
  applyDocLinkPatchToMarkdown as applyDocLinkPatchToMarkdownReconcile,
  applyDocMetadataPatchToMarkdown as applyDocMetadataPatchToMarkdownReconcile
} from "../../../reconcile/docs.js";
import { readJsonIfExists, readTextIfExists } from "../../shared.js";
import { canonicalRelativePathForItem } from "./paths.js";
import { applyProjectionAuthPatchToTopogram } from "./projection-patches.js";

/** @param {string} rootDir @param {string} relativePath @param {string} fieldName @returns {{ absolutePath: string, relativePath: string }} */
function resolveContainedTopoPath(rootDir, relativePath, fieldName) {
  const rawPath = String(relativePath || "").replaceAll("\\", "/");
  if (!rawPath.trim()) {
    throw new Error(`Adoption plan ${fieldName} must be a non-empty relative path.`);
  }
  if (rawPath.includes("\0") || path.isAbsolute(rawPath) || /^[A-Za-z]:\//.test(rawPath)) {
    throw new Error(`Adoption plan ${fieldName} must be relative to the topo workspace: ${relativePath}`);
  }
  const absoluteRoot = path.resolve(rootDir);
  const absolutePath = path.resolve(absoluteRoot, rawPath);
  const relativeToRoot = path.relative(absoluteRoot, absolutePath);
  if (!relativeToRoot || relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Adoption plan ${fieldName} escapes the topo workspace: ${relativePath}`);
  }
  return {
    absolutePath,
    relativePath: relativeToRoot.replaceAll(path.sep, "/")
  };
}

/** @param {WorkspacePaths} paths @returns {any} */
export function readAdoptionPlan(paths) {
  return readJsonIfExists(path.join(paths.topogramRoot, "candidates", "reconcile", "adoption-plan.json"));
}

/** @param {WorkspacePaths} paths @param {any[]} candidateFiles @param {any[]} planItems @param {any[]} selectedItems @param {WorkflowOptions} options @returns {any} */
export function buildCanonicalAdoptionOutputs(paths, candidateFiles, planItems, selectedItems, options = {}) {
  const refreshAdopted = Boolean(options.refreshAdopted);
  /** @type {WorkflowFiles} */
  /** @type {WorkflowFiles} */
  const files = {};
  /** @type {any[]} */
  const refreshedFiles = [];
  const selectedSet = new Set(selectedItems);
  const itemMap = new Map(planItems.map((/** @type {any} */ item) => [adoptionItemKey(item), item]));
  const capabilityBundleSet = new Set(
    [...selectedSet]
      .map((/** @type {any} */ key) => itemMap.get(key))
      .filter((/** @type {any} */ item) => item?.kind === "capability")
      .map((/** @type {any} */ item) => item.bundle)
  );
  const widgetShapeIdSet = new Set(
    [...selectedSet]
      .map((/** @type {any} */ key) => itemMap.get(key))
      .filter((/** @type {any} */ item) => item?.kind === "widget")
      .flatMap((/** @type {any} */ item) => item.related_shapes || [])
  );
  for (const item of planItems) {
    if (
      item.kind === "shape" &&
      item.status !== "skipped" &&
      (capabilityBundleSet.has(item.bundle) || widgetShapeIdSet.has(item.item))
    ) {
      selectedSet.add(adoptionItemKey(item));
    }
  }
  for (const item of planItems) {
    if (!selectedSet.has(adoptionItemKey(item))) {
      continue;
    }
    if (item.suggested_action === "skip_duplicate_shape") {
      continue;
    }
    const rawRelativeCanonicalPath = item.canonical_rel_path || canonicalRelativePathForItem(item.kind, item.item);
    if (!rawRelativeCanonicalPath) {
      continue;
    }
    const { absolutePath: canonicalPath, relativePath: relativeCanonicalPath } = resolveContainedTopoPath(
      paths.topogramRoot,
      rawRelativeCanonicalPath,
      "canonical_rel_path"
    );
    if (item.suggested_action === "apply_doc_link_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyDocLinkPatchToMarkdownReconcile(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (item.suggested_action === "apply_doc_metadata_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyDocMetadataPatchToMarkdownReconcile(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (item.suggested_action === "apply_projection_permission_patch" || item.suggested_action === "apply_projection_auth_patch" || item.suggested_action === "apply_projection_ownership_patch") {
      const baseContents = files[relativeCanonicalPath] || (fs.existsSync(canonicalPath) ? fs.readFileSync(canonicalPath, "utf8") : null);
      if (!baseContents) {
        continue;
      }
      const updatedContents = applyProjectionAuthPatchToTopogram(baseContents, item);
      if (!updatedContents || updatedContents === baseContents) {
        continue;
      }
      files[relativeCanonicalPath] = updatedContents;
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
      continue;
    }
    if (fs.existsSync(canonicalPath)) {
      if (!refreshAdopted) {
        continue;
      }
      const existingContents = fs.readFileSync(canonicalPath, "utf8");
      const machineManagedImported =
        existingContents.startsWith("# imported ") ||
        /\bsource_of_truth:\s*imported\b/.test(existingContents);
      if (!machineManagedImported) {
        continue;
      }
    }
    const candidateContents =
      candidateFiles[item.source_path] ||
      (item.source_path
        ? readTextIfExists(resolveContainedTopoPath(paths.topogramRoot, item.source_path, "source_path").absolutePath)
        : null);
    if (!candidateContents) {
      continue;
    }
    files[relativeCanonicalPath] = candidateContents;
    if (fs.existsSync(canonicalPath)) {
      refreshedFiles.push(relativeCanonicalPath.replaceAll(path.sep, "/"));
    }
  }
  return { files, refreshedFiles: [...new Set(refreshedFiles)].sort() };
}

/** @param {any[]} planItems @param {any[]} selectedItems @param {any[]} writtenCanonicalFiles @param {string} selector @returns {any} */
export function buildPromotedCanonicalItems(planItems, selectedItems, writtenCanonicalFiles, selector) {
  const itemMap = new Map((planItems || []).map((/** @type {any} */ item) => [adoptionItemKey(item), item]));
  const writtenSet = new Set((writtenCanonicalFiles || []).map((/** @type {any} */ item) => String(item).replaceAll(path.sep, "/")));
  return [...new Set(selectedItems || [])]
    .map((/** @type {any} */ key) => itemMap.get(key))
    .filter(Boolean)
    .filter((/** @type {any} */ item) => item.canonical_rel_path && writtenSet.has(String(item.canonical_rel_path).replaceAll(path.sep, "/")))
    .map((/** @type {any} */ item) => ({
      selector: selector || null,
      bundle: item.bundle,
      item: item.item,
      kind: item.kind,
      track: item.track || null,
      source_path: item.source_path || null,
      canonical_rel_path: String(item.canonical_rel_path).replaceAll(path.sep, "/"),
      canonical_path: item.canonical_path || `topo/${String(item.canonical_rel_path).replaceAll(path.sep, "/")}`,
      suggested_action: item.suggested_action || null
    }))
    .sort((/** @type {any} */ a, /** @type {any} */ b) =>
      (a.bundle || "").localeCompare(b.bundle || "") ||
      (a.track || "").localeCompare(b.track || "") ||
      (a.kind || "").localeCompare(b.kind || "") ||
      (a.item || "").localeCompare(b.item || "")
    );
}
