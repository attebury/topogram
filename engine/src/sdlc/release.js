// `topogram release --app-version X.Y.Z` — single best-effort checkpointed
// operation:
//   1. Assemble release notes (from current/archived terminal-status data)
//   2. Stamp `app_version` on documents whose `app_version` is missing or
//      older than the release version
//   3. Archive eligible terminal-status artifacts
//
// `--dry-run` prints the planned mutations without touching disk.

import { readFileSync, writeFileSync } from "node:fs";

import { parsePath } from "../parser.js";
import { resolveWorkspace } from "../resolver/index.js";
import { generateSdlcReleaseNotes } from "../generator/sdlc/release-notes.js";
import { archiveBatch, archiveEligibleStatements } from "../archive/archive.js";

function stampDocsWithVersion(docs, appVersion, options = {}) {
  const planned = [];
  const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;
  for (const doc of docs) {
    if (doc.parseError || !doc.file) continue;
    let raw;
    try {
      raw = readFileSync(doc.file, "utf8");
    } catch {
      continue;
    }
    const match = raw.match(FRONTMATTER_RE);
    if (!match) continue;
    const frontmatter = match[1];
    if (frontmatter.includes(`app_version: ${appVersion}`)) continue;

    const updated = frontmatter.includes("app_version:")
      ? frontmatter.replace(/app_version:.*$/m, `app_version: ${appVersion}`)
      : frontmatter + `\napp_version: ${appVersion}`;
    const newRaw = raw.replace(FRONTMATTER_RE, `---\n${updated}\n---\n`);
    planned.push({ file: doc.file, before: doc.metadata?.app_version || null, after: appVersion });
    if (!options.dryRun) {
      writeFileSync(doc.file, newRaw, "utf8");
    }
  }
  return planned;
}

export function runRelease(workspaceRoot, options = {}) {
  if (!options.appVersion) {
    return { ok: false, error: "release requires --app-version <label>" };
  }

  const ast = parsePath(workspaceRoot);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    return { ok: false, error: "workspace failed validation; cannot release", validation: resolved.validation };
  }

  const releaseNotes = generateSdlcReleaseNotes(resolved.graph, {
    appVersion: options.appVersion,
    sinceTag: options.sinceTag
  });

  const docPlan = stampDocsWithVersion(ast.docs || [], options.appVersion, { dryRun: options.dryRun });

  const archiveCandidates = archiveEligibleStatements(resolved, {});
  const archiveResult = archiveBatch(workspaceRoot, archiveCandidates, {
    dryRun: options.dryRun,
    by: options.actor,
    release: options.appVersion
  });

  return {
    ok: true,
    appVersion: options.appVersion,
    dryRun: options.dryRun === true,
    release_notes: releaseNotes,
    document_app_version_updates: docPlan,
    archive: { candidates: archiveCandidates, ...archiveResult }
  };
}
