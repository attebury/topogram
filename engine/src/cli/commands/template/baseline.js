// @ts-check

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../../../format.js";
import { TEMPLATE_FILES_MANIFEST } from "./constants.js";

/**
 * @param {string} filePath
 * @returns {{ sha256: string, size: number }}
 */
function projectFileHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length
  };
}

/**
 * @param {string} projectRoot
 * @param {string} relativePath
 * @returns {{ sha256: string, size: number }}
 */
function templateBaselineFileHash(projectRoot, relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  if (relativePath === "topogram.project.json") {
    const content = `${stableStringify(JSON.parse(fs.readFileSync(filePath, "utf8")))}\n`;
    return {
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
      size: Buffer.byteLength(content)
    };
  }
  return projectFileHash(filePath);
}

/**
 * @param {string} projectRoot
 * @returns {{ exists: boolean, path: string, status: "missing"|"clean"|"changed", state: "missing"|"matches-template"|"diverged", meaning: "no-template-baseline"|"matches-template-baseline"|"local-project-owns-changes", changedAllowed: boolean, localOwnership: boolean, blocksCheck: boolean, blocksGenerate: boolean, nextCommand: string|null, content: { changed: string[], added: string[], removed: string[] }, trustedFiles: number }}
 */
export function buildTemplateOwnedBaselineStatus(projectRoot) {
  const manifestPath = path.join(projectRoot, TEMPLATE_FILES_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    return {
      exists: false,
      path: manifestPath,
      status: "missing",
      state: "missing",
      meaning: "no-template-baseline",
      changedAllowed: true,
      localOwnership: false,
      blocksCheck: false,
      blocksGenerate: false,
      nextCommand: null,
      content: { changed: [], added: [], removed: [] },
      trustedFiles: 0
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const trustedFiles = Array.isArray(manifest.files) ? manifest.files : [];
  const changed = [];
  const removed = [];
  for (const file of trustedFiles) {
    const relativePath = String(file.path || "");
    if (!relativePath) {
      continue;
    }
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      removed.push(relativePath);
      continue;
    }
    const current = templateBaselineFileHash(projectRoot, relativePath);
    if (current.sha256 !== file.sha256 || current.size !== file.size) {
      changed.push(relativePath);
    }
  }
  const status = changed.length || removed.length ? "changed" : "clean";
  const diverged = status === "changed";
  return {
    exists: true,
    path: manifestPath,
    status,
    state: diverged ? "diverged" : "matches-template",
    meaning: diverged ? "local-project-owns-changes" : "matches-template-baseline",
    changedAllowed: true,
    localOwnership: diverged,
    blocksCheck: false,
    blocksGenerate: false,
    nextCommand: diverged ? "topogram template update --check" : null,
    content: {
      changed: changed.sort((a, b) => a.localeCompare(b)),
      added: [],
      removed: removed.sort((a, b) => a.localeCompare(b))
    },
    trustedFiles: trustedFiles.length
  };
}
