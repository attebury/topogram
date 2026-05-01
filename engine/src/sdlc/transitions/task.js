// Task state machine.
//
// unclaimed → claimed → in-progress → done
//                 ↓         ↓
//                 └────→ blocked ←──┘
//
// `blocked` is exit-able back to whichever in-flight status the task came
// from; in practice agents return through `in-progress`. `done` is
// archive-eligible.

export const LEGAL_TRANSITIONS = {
  unclaimed: ["claimed"],
  claimed: ["in-progress", "unclaimed", "blocked"],
  "in-progress": ["done", "blocked", "claimed"],
  blocked: ["claimed", "in-progress"],
  done: []
};

export const TERMINAL_STATUSES = new Set(["done"]);
export const ARCHIVABLE_STATUSES = new Set(["done"]);

export function validateTransition(from, to) {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, error: `Unknown task status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Task cannot transition from '${from}' to '${to}' — allowed: ${allowed.join(", ") || "(terminal)"}`
    };
  }
  return { ok: true };
}
