// @ts-check

import path from "node:path";

/**
 * @param {any} files
 * @param {{ filePathMessage: string, contentMessage: (filePath: string) => string }} messages
 * @returns {{ ok: boolean, message: string }}
 */
export function validateRelativeStringFileMap(files, messages) {
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return { ok: false, message: "files must be an object" };
  }
  for (const [filePath, content] of Object.entries(files)) {
    const normalizedPath = typeof filePath === "string" ? path.normalize(filePath) : "";
    if (
      typeof filePath !== "string" ||
      filePath.length === 0 ||
      path.isAbsolute(filePath) ||
      normalizedPath === ".." ||
      normalizedPath.startsWith(`..${path.sep}`)
    ) {
      return { ok: false, message: messages.filePathMessage };
    }
    if (typeof content !== "string") {
      return { ok: false, message: messages.contentMessage(filePath) };
    }
  }
  return { ok: true, message: "files are valid" };
}
