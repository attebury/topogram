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
//   - plan: draft
//   - pitch: draft
//   - document: draft

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  listArchiveFiles,
  parseArchiveFile,
  rewriteArchiveFile
} from "./jsonl.js";
import { isArchivableKind } from "./schema.js";
import { sdlcRootForSdlc } from "../sdlc/paths.js";

const REOPEN_STATUSES = {
  bug: "open",
  task: "claimed",
  plan: "draft",
  pitch: "draft",
  document: "draft"
};

const SAFE_ARCHIVE_ID = /^[A-Za-z][A-Za-z0-9_]*$/;

function recordDirForKind(kind) {
  if (kind === "acceptance_criterion") return "acceptance_criteria";
  return `${kind}s`;
}

function isContainedPath(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validateArchivedEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return "Archived entry is not an object";
  }
  if (!isArchivableKind(entry.kind)) {
    return `Archived entry kind '${entry.kind}' is not supported for unarchive`;
  }
  if (typeof entry.id !== "string" || !SAFE_ARCHIVE_ID.test(entry.id)) {
    return `Archived entry id '${entry.id}' is not a safe Topogram identifier`;
  }
  return null;
}

function resolveTargetFile(workspaceRoot, entry, options = {}) {
  const recordRoot = path.resolve(sdlcRootForSdlc(workspaceRoot), recordDirForKind(entry.kind));
  const targetDir = path.resolve(options.targetDir || recordRoot);
  if (!isContainedPath(recordRoot, targetDir)) {
    return {
      ok: false,
      error: `Target directory '${targetDir}' escapes SDLC ${entry.kind} record root '${recordRoot}'`
    };
  }
  const targetFile = path.resolve(targetDir, `${entry.id}.tg`);
  if (!isContainedPath(recordRoot, targetFile)) {
    return {
      ok: false,
      error: `Archived entry id '${entry.id}' resolves outside SDLC ${entry.kind} record root '${recordRoot}'`
    };
  }
  return { ok: true, recordRoot, targetDir, targetFile };
}

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
  if (entry.kind === "plan") {
    if (entry.fields?.task?.id) lines.push(`  task ${entry.fields.task.id}`);
    if (entry.fields?.priority) lines.push(`  priority ${entry.fields.priority}`);
    if (entry.fields?.notes) lines.push(`  notes "${String(entry.fields.notes).replace(/"/g, "\\\"")}"`);
    if (entry.fields?.outcome) lines.push(`  outcome "${String(entry.fields.outcome).replace(/"/g, "\\\"")}"`);
    lines.push("  steps {");
    for (const step of entry.fields?.steps || []) {
      const parts = [
        "step",
        step.id,
        "status",
        step.status,
        "description",
        `"${String(step.description || "").replace(/"/g, "\\\"")}"`
      ];
      if (step.notes) parts.push("notes", `"${String(step.notes).replace(/"/g, "\\\"")}"`);
      if (step.outcome) parts.push("outcome", `"${String(step.outcome).replace(/"/g, "\\\"")}"`);
      lines.push(`    ${parts.join(" ")}`);
    }
    lines.push("  }");
    lines.push(`  status ${newStatus}`);
    lines.push("}");
    return lines.join("\n") + "\n";
  }
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
  const entryError = validateArchivedEntry(entry);
  if (entryError) {
    return { ok: false, error: entryError };
  }
  const reopenStatus = options.status || REOPEN_STATUSES[entry.kind] || "draft";
  const target = resolveTargetFile(workspaceRoot, entry, options);
  if (!target.ok) {
    return target;
  }
  const { targetDir, targetFile } = target;
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

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
