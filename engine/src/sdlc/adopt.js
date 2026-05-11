// `sdlc adopt` — brownfield onramp.
//
// Sets up the SDLC folder skeleton inside an existing topogram workspace
// without backfilling historical artifacts. After running, an author can
// `topogram sdlc new pitch <slug>` to start adding artifacts immediately.

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DEFAULT_TOPO_FOLDER_NAME, resolveTopoRoot } from "../workspace-paths.js";
import { sdlcRootForSdlc } from "./paths.js";

const SDLC_FOLDERS = [
  "pitches",
  "requirements",
  "acceptance_criteria",
  "tasks",
  "plans",
  "bugs",
  "decisions",
  "_archive"
];

function ensureFolder(root, name) {
  const dir = path.join(sdlcRootForSdlc(root), name);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return { name, created: true };
  }
  return { name, created: false };
}

function scanPressure(root) {
  // Pressure scan: count statements per kind so the operator knows the
  // workspace's current shape. We do not attempt to backfill — that's the
  // operator's job after they pick a starting point.
  const tg = resolveTopoRoot(root);
  if (!existsSync(tg)) return { error: `No '${DEFAULT_TOPO_FOLDER_NAME}/' workspace folder found at ${root}` };
  let totalFiles = 0;
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === "_archive" || entry.startsWith(".")) continue;
        walk(full);
      } else if (entry.endsWith(".tg")) {
        totalFiles += 1;
      }
    }
  }
  walk(tg);
  return { totalFiles };
}

export function sdlcAdopt(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  if (!existsSync(resolveTopoRoot(root))) {
    return { ok: false, error: `No '${DEFAULT_TOPO_FOLDER_NAME}/' workspace folder at ${root}; run 'topogram new' first` };
  }
  const folders = SDLC_FOLDERS.map((name) => ensureFolder(root, name));
  const pressure = scanPressure(root);
  return {
    ok: true,
    workspaceRoot: root,
    folders_created: folders.filter((f) => f.created).map((f) => f.name),
    folders_existing: folders.filter((f) => !f.created).map((f) => f.name),
    pressure
  };
}
