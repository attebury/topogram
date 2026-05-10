// @ts-check

import { dashedTopogramId } from "../ids.js";

/** @param {string} kind @param {string} item @returns {any} */
export function canonicalRelativePathForItem(kind, item) {
  switch (kind) {
    case "actor":
      return `actors/${dashedTopogramId(item)}.tg`;
    case "role":
      return `roles/${dashedTopogramId(item)}.tg`;
    case "enum":
      return `enums/enum-${dashedTopogramId(String(item || "").replace(/^enum_/, ""))}.tg`;
    case "entity":
      return `entities/${dashedTopogramId(item)}.tg`;
    case "shape":
      return `shapes/${dashedTopogramId(item)}.tg`;
    case "capability":
      return `capabilities/${dashedTopogramId(item)}.tg`;
    case "widget":
      return `widgets/${dashedTopogramId(item)}.tg`;
    case "verification":
      return `verifications/${dashedTopogramId(item)}.tg`;
    default:
      return null;
  }
}

/** @param {string} kind @param {string} item @returns {any} */
export function canonicalDisplayPathForItem(kind, item) {
  const relativePath = canonicalRelativePathForItem(kind, item);
  return relativePath ? `topo/${relativePath}` : null;
}

/** @param {CandidateBundle} bundle @param {string} kind @param {WorkflowRecord} item @returns {any} */
export function candidateSourcePathForItem(bundle, kind, item) {
  const base = `candidates/reconcile/model/bundles/${bundle.slug}`;
  switch (kind) {
    case "actor":
      return `${base}/actors/${item}.tg`;
    case "role":
      return `${base}/roles/${item}.tg`;
    case "enum":
      return `${base}/enums/${item}.tg`;
    case "entity":
      return `${base}/entities/${item}.tg`;
    case "shape":
      return `${base}/shapes/${item}.tg`;
    case "capability":
      return `${base}/capabilities/${item}.tg`;
    case "widget":
      return `${base}/widgets/${item}.tg`;
    case "verification":
      return `${base}/verifications/${item}.tg`;
    default:
      return `${base}/README.md`;
  }
}
