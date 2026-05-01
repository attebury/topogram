// Archive entry schema.
//
// An archived statement is a frozen snapshot of the resolved statement at
// the time of archiving, plus:
//   - `transitions`: full history (copied from the sidecar)
//   - `archived`: { at, by, release, reason }
//   - `archived: true` flag (for resolver-bridge's quick filter)
//
// Documents archive includes the body verbatim.

const ALLOWED_KINDS = new Set(["pitch", "task", "bug", "document"]);

export function isArchivableKind(kind) {
  return ALLOWED_KINDS.has(kind);
}

export function buildArchiveEntry(statement, transitions, archivedMeta = {}) {
  if (!isArchivableKind(statement.kind)) {
    throw new Error(`Kind '${statement.kind}' is not archivable`);
  }
  return {
    id: statement.id,
    kind: statement.kind,
    name: statement.name,
    description: statement.description,
    status: statement.status,
    fields: statement.archivedFields || serializeFields(statement),
    transitions: transitions || [],
    archived: {
      at: archivedMeta.at || new Date().toISOString(),
      by: archivedMeta.by || null,
      release: archivedMeta.release || null,
      reason: archivedMeta.reason || null
    }
  };
}

// Serialize a normalized resolved statement into a portable field map. We
// drop `loc`, `ast`, and resolver-derived back-link arrays (they'd be stale
// once frozen).
function serializeFields(statement) {
  const skip = new Set([
    "kind",
    "id",
    "name",
    "description",
    "status",
    "loc",
    "from",
    "transformGraph",
    "members",
    "policy",
    "plan",
    "monitoring",
    "vocabulary",
    "componentContract",
    "record",
    "flow",
    "affectedByPitches",
    "affectedByRequirements",
    "affectedByTasks",
    "affectedByBugs",
    "introducedByRequirements",
    "respectedByRequirements",
    "violatedByBugs",
    "surfacedByBugs",
    "introducedByTasks",
    "verifiedBy",
    "blockingMe",
    "blockedByMe",
    "tasks",
    "verifications",
    "documents",
    "rules",
    "acceptanceCriteria",
    "supersededBy",
    "decisionsFromPitch",
    "requirements",
    "projectedFields"
  ]);
  const out = {};
  for (const [key, value] of Object.entries(statement)) {
    if (skip.has(key)) continue;
    out[key] = value;
  }
  return out;
}
