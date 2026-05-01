// Pitch state machine.
//
// draft → shaped → submitted → approved
//   ↓        ↓         ↓          ↓
//   └────────┴─────────┴───→ rejected
//
// A pitch may skip `shaped` and go straight to `submitted` for small or
// obvious work (per the SDLC design). All terminal-status pitches stay in
// the active workspace except `rejected`, which is archive-eligible.

export const LEGAL_TRANSITIONS = {
  draft: ["shaped", "submitted", "rejected"],
  shaped: ["submitted", "rejected", "draft"],
  submitted: ["approved", "rejected", "shaped"],
  approved: ["rejected"],
  rejected: ["draft"]
};

export const TERMINAL_STATUSES = new Set(["approved", "rejected"]);
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
