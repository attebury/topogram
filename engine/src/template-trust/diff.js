// @ts-check

import {
  hashImplementationContent,
  implementationReviewFile,
  unifiedTextDiff
} from "./content.js";
import { getTemplateTrustStatus } from "./status.js";

/**
 * @param {{ config: Record<string, any>, configPath: string|null, configDir: string }} implementationInfo
 * @param {Record<string, any>|null} projectConfig
 * @returns {{ ok: boolean, requiresTrust: boolean, status: ReturnType<typeof getTemplateTrustStatus>, files: Array<{ path: string, kind: "added"|"removed"|"changed", trusted: { path: string, sha256: string|null, size: number|null }|null, current: { path: string, sha256: string|null, size: number|null, binary: boolean, diffOmitted: boolean }|null, binary: boolean, diffOmitted: boolean, unifiedDiff: string|null }> }}
 */
export function getTemplateTrustDiff(implementationInfo, projectConfig = null) {
  const status = getTemplateTrustStatus(implementationInfo, projectConfig);
  if (!status.requiresTrust || !status.trustRecord?.content) {
    return { ok: status.ok, requiresTrust: status.requiresTrust, status, files: [] };
  }
  let currentContent;
  try {
    currentContent = hashImplementationContent(implementationInfo.configDir);
  } catch (_error) {
    return { ok: false, requiresTrust: status.requiresTrust, status, files: [] };
  }
  const trustedByPath = new Map((status.trustRecord.content.files || []).map((file) => [file.path, file]));
  const currentByPath = new Map(currentContent.files.map((file) => [file.path, file]));
  /** @type {Array<{ path: string, kind: "added"|"removed"|"changed", trusted: { path: string, sha256: string|null, size: number|null }|null, current: { path: string, sha256: string|null, size: number|null, binary: boolean, diffOmitted: boolean }|null, binary: boolean, diffOmitted: boolean, unifiedDiff: string|null }>} */
  const files = [];

  for (const relativePath of status.content.changed) {
    const trusted = trustedByPath.get(relativePath) || null;
    const current = currentByPath.get(relativePath) || null;
    const currentReview = implementationReviewFile(implementationInfo.configDir, relativePath, current);
    files.push({
      path: relativePath,
      kind: "changed",
      trusted: trusted ? { path: relativePath, sha256: trusted.sha256, size: trusted.size } : null,
      current: {
        path: relativePath,
        sha256: currentReview.sha256,
        size: currentReview.size,
        binary: currentReview.binary,
        diffOmitted: currentReview.diffOmitted
      },
      binary: currentReview.binary,
      diffOmitted: true,
      unifiedDiff: null
    });
  }
  for (const relativePath of status.content.added) {
    const current = currentByPath.get(relativePath) || null;
    const currentReview = implementationReviewFile(implementationInfo.configDir, relativePath, current);
    files.push({
      path: relativePath,
      kind: "added",
      trusted: null,
      current: {
        path: relativePath,
        sha256: currentReview.sha256,
        size: currentReview.size,
        binary: currentReview.binary,
        diffOmitted: currentReview.diffOmitted
      },
      binary: currentReview.binary,
      diffOmitted: currentReview.binary || currentReview.diffOmitted,
      unifiedDiff: currentReview.binary || currentReview.diffOmitted
        ? null
        : unifiedTextDiff(relativePath, null, currentReview.text)
    });
  }
  for (const relativePath of status.content.removed) {
    const trusted = trustedByPath.get(relativePath) || null;
    files.push({
      path: relativePath,
      kind: "removed",
      trusted: trusted ? { path: relativePath, sha256: trusted.sha256, size: trusted.size } : null,
      current: null,
      binary: false,
      diffOmitted: true,
      unifiedDiff: null
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
  return {
    ok: status.ok,
    requiresTrust: status.requiresTrust,
    status,
    files
  };
}
