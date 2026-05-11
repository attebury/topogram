// Plan state machine.
//
// draft → active → complete
//          └────→ superseded
//
// `complete` and `superseded` are archive-eligible. Plans are optional
// support artifacts; their state machine tracks the plan artifact, not the
// owning task's DoD.

export const LEGAL_TRANSITIONS = {
  draft: ["active", "superseded"],
  active: ["complete", "superseded", "draft"],
  complete: [],
  superseded: []
};

export const TERMINAL_STATUSES = new Set(["complete", "superseded"]);
export const ARCHIVABLE_STATUSES = new Set(["complete", "superseded"]);

export function validateTransition(from, to) {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, error: `Unknown plan status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Plan cannot transition from '${from}' to '${to}' — allowed: ${allowed.join(", ") || "(terminal)"}`
    };
  }
  return { ok: true };
}
