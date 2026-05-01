// Unarchive: pull a frozen entry back into the active workspace.
//
// Strategy:
//   1. Find the entry across all archive files (kind+id).
//   2. Render it as a `.tg` statement and append to a target file.
//   3. Strip the entry from the archive file (rewrite without it).
//
// Status is reset to a sensible "re-opened" value per kind:
//   - bug: open
//   - task: claimed (caller must set claimed_by)
//   - pitch: draft
//   - document: draft

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  archiveDir,
  listArchiveFiles,
  parseArchiveFile,
  rewriteArchiveFile
} from "./jsonl.js";

const REOPEN_STATUSES = {
  bug: "open",
  task: "claimed",
  pitch: "draft",
  document: "draft"
};

function findEntry(workspaceRoot, id) {
  for (const file of listArchiveFiles(workspaceRoot)) {
    const entries = parseArchiveFile(file);
    const match = entries.find((e) => e.id === id);
    if (match) return { file, entries, entry: match };
  }
  return null;
}

function renderStatement(entry, newStatus) {
  // Render a minimal `.tg` representation. Unknown field types fall back to
  // a string. Lists are space-separated symbols inside `[ ... ]`.
  const lines = [];
  lines.push(`${entry.kind} ${entry.id} {`);
  if (entry.name) lines.push(`  name "${entry.name.replace(/"/g, "\\\"")}"`);
  if (entry.description) lines.push(`  description "${entry.description.replace(/"/g, "\\\"")}"`);
  for (const [key, value] of Object.entries(entry.fields || {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const items = value
        .map((v) => (typeof v === "string" ? v : v?.id))
        .filter(Boolean);
      if (items.length > 0) {
        lines.push(`  ${snakeCase(key)} [${items.join(", ")}]`);
      }
      continue;
    }
    if (typeof value === "object" && value.id) {
      lines.push(`  ${snakeCase(key)} ${value.id}`);
      continue;
    }
    if (typeof value === "string") {
      lines.push(`  ${snakeCase(key)} "${value.replace(/"/g, "\\\"")}"`);
      continue;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      lines.push(`  ${snakeCase(key)} ${value}`);
    }
  }
  lines.push(`  status ${newStatus}`);
  lines.push("}");
  return lines.join("\n") + "\n";
}

function snakeCase(camel) {
  return camel.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

export function unarchive(workspaceRoot, id, options = {}) {
  const found = findEntry(workspaceRoot, id);
  if (!found) {
    return { ok: false, error: `No archived entry with id '${id}'` };
  }

  const { file, entries, entry } = found;
  const reopenStatus = options.status || REOPEN_STATUSES[entry.kind] || "draft";
  const targetDir = options.targetDir || path.join(workspaceRoot, "topogram", `${entry.kind}s`);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, `${entry.id}.tg`);

  if (existsSync(targetFile)) {
    return { ok: false, error: `Target file '${targetFile}' already exists; refuse to overwrite` };
  }

  const rendered = renderStatement(entry, reopenStatus);
  writeFileSync(targetFile, rendered, "utf8");

  const remaining = entries.filter((e) => e.id !== id);
  rewriteArchiveFile(file, remaining);

  return {
    ok: true,
    id,
    kind: entry.kind,
    targetFile,
    archiveFile: file,
    reopenStatus
  };
}
