// Acceptance criterion state machine.
//
// draft → approved → superseded
//
// ACs are always-live like requirements.

export const LEGAL_TRANSITIONS = {
  draft: ["approved"],
  approved: ["superseded", "draft"],
  superseded: []
};

export const TERMINAL_STATUSES = new Set(["superseded"]);
export const ARCHIVABLE_STATUSES = new Set();

export function validateTransition(from, to) {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, error: `Unknown acceptance_criterion status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Acceptance criterion cannot transition from '${from}' to '${to}' — allowed: ${allowed.join(", ") || "(terminal)"}`
    };
  }
  return { ok: true };
}
