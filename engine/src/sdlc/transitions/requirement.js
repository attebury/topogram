// Requirement state machine.
//
// draft → in-review → approved → superseded
//
// Requirements are always-live: even `superseded` requirements stay in the
// active workspace because tasks may still reference them in the
// traceability matrix.

export const LEGAL_TRANSITIONS = {
  draft: ["in-review"],
  "in-review": ["approved", "draft"],
  approved: ["superseded", "in-review"],
  superseded: []
};

export const TERMINAL_STATUSES = new Set(["superseded"]);
export const ARCHIVABLE_STATUSES = new Set();

export function validateTransition(from, to) {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, error: `Unknown requirement status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Requirement cannot transition from '${from}' to '${to}' — allowed: ${allowed.join(", ") || "(terminal)"}`
    };
  }
  return { ok: true };
}
