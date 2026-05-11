import path from "node:path";

import { resolveTopoRoot, resolveWorkspaceContext } from "../workspace-paths.js";

export const SDLC_RECORD_ROOT = "sdlc";

export function topogramRootForSdlc(inputPath) {
  return resolveTopoRoot(inputPath);
}

export function sdlcRootForSdlc(inputPath) {
  return path.join(topogramRootForSdlc(inputPath), SDLC_RECORD_ROOT);
}

export function projectRootForSdlc(inputPath) {
  return resolveWorkspaceContext(inputPath).projectRoot;
}
