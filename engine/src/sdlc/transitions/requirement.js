// Requirement state machine.
//
// draft → in-review → approved → satisfied
//                         ├────→ ongoing
//                         └────→ superseded
// ongoing → approved | superseded
//
// Requirements are always-live: even `satisfied` and `superseded`
// requirements stay in the active workspace because tasks may still reference
// them in the traceability matrix. `satisfied` is an explicit closeout state
// for accepted requirements that are proven enough for now, not a replacement
// for supersession.

export const LEGAL_TRANSITIONS = {
  draft: ["in-review"],
  "in-review": ["approved", "draft"],
  approved: ["satisfied", "ongoing", "superseded", "in-review"],
  satisfied: ["approved", "superseded"],
  ongoing: ["approved", "superseded"],
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
