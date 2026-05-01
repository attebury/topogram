// Bug state machine.
//
// open → in-progress → fixed → verified
//   └──────────┴────────┴────→ wont-fix
//
// `verified` and `wont-fix` are archive-eligible.

export const LEGAL_TRANSITIONS = {
  open: ["in-progress", "wont-fix"],
  "in-progress": ["fixed", "open", "wont-fix"],
  fixed: ["verified", "in-progress", "wont-fix"],
  verified: ["in-progress"],
  "wont-fix": ["open"]
};

export const TERMINAL_STATUSES = new Set(["verified", "wont-fix"]);
export const ARCHIVABLE_STATUSES = new Set(["verified", "wont-fix"]);

export function validateTransition(from, to) {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, error: `Unknown bug status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Bug cannot transition from '${from}' to '${to}' — allowed: ${allowed.join(", ")}`
    };
  }
  return { ok: true };
}
