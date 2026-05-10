import { resolveTopoRoot, resolveWorkspaceContext } from "../workspace-paths.js";

export function topogramRootForSdlc(inputPath) {
  return resolveTopoRoot(inputPath);
}

export function projectRootForSdlc(inputPath) {
  return resolveWorkspaceContext(inputPath).projectRoot;
}
