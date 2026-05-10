// @ts-check

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} currentPath
 * @param {string} relativePath
 * @param {string[]} files
 * @returns {void}
 */
export function collectFiles(currentPath, relativePath, files) {
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    files.push(relativePath.replace(/\\/g, "/"));
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  for (const entry of fs.readdirSync(currentPath)) {
    collectFiles(path.join(currentPath, entry), path.join(relativePath, entry), files);
  }
}

/**
 * @param {string} filePath
 * @returns {{ sha256: string, size: number }}
 */
export function fileHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length
  };
}

/**
 * @param {string} targetPath
 * @returns {void}
 */
export function ensureEmptyDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    return;
  }
  if (!fs.statSync(targetPath).isDirectory()) {
    throw new Error(`Cannot copy catalog topogram into non-directory path '${targetPath}'.`);
  }
  const entries = fs.readdirSync(targetPath).filter((/** @type {string} */ entry) => entry !== ".DS_Store");
  if (entries.length > 0) {
    throw new Error(`Refusing to copy catalog topogram into non-empty directory '${targetPath}'.`);
  }
}

/**
 * @param {string} sourcePath
 * @param {string} targetPath
 * @param {string} relativePath
 * @param {string[]} files
 * @returns {void}
 */
export function copyPath(sourcePath, targetPath, relativePath, files) {
  fs.cpSync(sourcePath, targetPath, { recursive: true });
  collectFiles(targetPath, relativePath, files);
}
