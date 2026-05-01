// Pitch → Requirement → AC → (Task | Bug) → Verification table.
//
// Each row is one acceptance criterion; columns are the chain anchored on
// it. This is the canonical "did everything we shipped have a reason and a
// verification?" report.

export function generateSdlcTraceabilityMatrix(graph, options = {}) {
  const acs = graph.byKind?.acceptance_criterion || [];
  const requirementsById = new Map((graph.byKind?.requirement || []).map((r) => [r.id, r]));
  const pitchesById = new Map((graph.byKind?.pitch || []).map((p) => [p.id, p]));
  const tasksById = new Map((graph.byKind?.task || []).map((t) => [t.id, t]));
  const bugsById = new Map((graph.byKind?.bug || []).map((b) => [b.id, b]));
  const verificationsById = new Map((graph.byKind?.verification || []).map((v) => [v.id, v]));

  const rows = [];
  for (const ac of acs) {
    const requirement = ac.requirement?.id ? requirementsById.get(ac.requirement.id) : null;
    const pitchId = requirement?.pitch?.id || null;
    const pitch = pitchId ? pitchesById.get(pitchId) : null;

    const taskIds = (ac.tasks || []).slice().sort();
    const verificationIds = (ac.verifications || []).slice().sort();

    const linkedBugIds = [];
    for (const bug of bugsById.values()) {
      const linkedTask = (bug.fixedIn || []).some((ref) => taskIds.includes(typeof ref === "string" ? ref : ref?.id));
      if (linkedTask) linkedBugIds.push(bug.id);
    }

    rows.push({
      pitch: pitch
        ? { id: pitch.id, status: pitch.status, name: pitch.name }
        : null,
      requirement: requirement
        ? { id: requirement.id, status: requirement.status, name: requirement.name }
        : null,
      acceptance_criterion: { id: ac.id, status: ac.status, name: ac.name },
      tasks: taskIds.map((id) => {
        const t = tasksById.get(id);
        return t ? { id, status: t.status, work_type: t.workType } : { id, status: "missing" };
      }),
      bugs: linkedBugIds.sort().map((id) => {
        const b = bugsById.get(id);
        return { id, status: b?.status, severity: b?.severity };
      }),
      verifications: verificationIds.map((id) => {
        const v = verificationsById.get(id);
        return v ? { id, method: v.method, status: v.status } : { id, status: "missing" };
      }),
      gap: !verificationIds.length || !taskIds.length
    });
  }

  rows.sort((a, b) => (a.acceptance_criterion.id || "").localeCompare(b.acceptance_criterion.id || ""));

  return {
    type: "sdlc_traceability_matrix",
    version: 1,
    counts: {
      rows: rows.length,
      gaps: rows.filter((r) => r.gap).length
    },
    rows
  };
}
