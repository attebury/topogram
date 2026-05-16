// Pitch state machine.
//
// draft → shaped → submitted → approved
//   ↓        ↓         ↓          ↓
//   └────────┴─────────┴───→ rejected | covered | superseded
//
// A pitch may skip `shaped` and go straight to `submitted` for small or
// obvious work (per the SDLC design). `covered` means the pitch's problem was
// handled by linked requirements/decisions without needing more backlog work.
// All terminal-status pitches stay in the active workspace except `rejected`,
// which is archive-eligible.

export const LEGAL_TRANSITIONS = {
  draft: ["shaped", "submitted", "covered", "superseded", "rejected"],
  shaped: ["submitted", "covered", "superseded", "rejected", "draft"],
  submitted: ["approved", "covered", "superseded", "rejected", "shaped"],
  approved: ["covered", "superseded", "rejected"],
  covered: ["draft"],
  superseded: ["draft"],
  rejected: ["draft"]
};

export const TERMINAL_STATUSES = new Set(["approved", "covered", "superseded", "rejected"]);
export const ARCHIVABLE_STATUSES = new Set(["rejected"]);

export function validateTransition(from, to) {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, error: `Unknown pitch status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Pitch cannot transition from '${from}' to '${to}' — allowed: ${allowed.join(", ")}`
    };
  }
  return { ok: true };
}
