// Release notes generator.
//
// Assembles the changes that landed in a release window from:
//   - Approved pitches whose `affects` was touched
//   - Tasks in `done` status (or archived in this window)
//   - Bugs in `verified` or `wont-fix` (or archived in this window)
//
// Inputs:
//   options.appVersion   — required; release version label
//   options.sinceTag     — optional; ISO date or git-tag-like marker for window start
//   options.includeArchived — optional; default true (release notes need archived data)
//
// Output: structured JSON the caller can render to markdown or a board.

function withinWindow(updated, sinceIso) {
  if (!sinceIso) return true;
  if (!updated) return false;
  return updated >= sinceIso;
}

function summarizeMinimal(s) {
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    priority: s.priority || null,
    severity: s.severity || null,
    domain: s.resolvedDomain ? s.resolvedDomain.id : null,
    updated: s.updated || null,
    archived: !!s.archived
  };
}

export function generateSdlcReleaseNotes(graph, options = {}) {
  if (!options.appVersion) {
    throw new Error("sdlc-release-notes requires --app-version <label>");
  }
  const sinceIso = options.sinceTag || options.since || null;

  const pitches = (graph.byKind?.pitch || [])
    .filter((p) => p.status === "approved" && withinWindow(p.updated, sinceIso))
    .map(summarizeMinimal);

  const tasks = (graph.byKind?.task || [])
    .filter((t) => (t.status === "done" || t.archived) && withinWindow(t.updated, sinceIso))
    .map(summarizeMinimal);

  const bugs = (graph.byKind?.bug || [])
    .filter((b) => (b.status === "verified" || b.status === "wont-fix" || b.archived) && withinWindow(b.updated, sinceIso))
    .map(summarizeMinimal);

  return {
    type: "sdlc_release_notes",
    version: 1,
    app_version: options.appVersion,
    since: sinceIso,
    counts: { pitches: pitches.length, tasks: tasks.length, bugs: bugs.length },
    pitches,
    tasks,
    bugs
  };
}
