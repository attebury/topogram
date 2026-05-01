// Document state machine (mirrors workspace-docs.DOC_STATUSES extension).
//
// draft → review → published → archived
//                      ↓
//                    review (when linked component changes — staleness signal)

export const LEGAL_TRANSITIONS = {
  draft: ["review"],
  review: ["published", "draft"],
  published: ["review", "archived"],
  archived: ["draft"]
};

export const TERMINAL_STATUSES = new Set(["archived"]);
export const ARCHIVABLE_STATUSES = new Set(["archived"]);

export function validateTransition(from, to) {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, error: `Unknown document status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Document cannot transition from '${from}' to '${to}' — allowed: ${allowed.join(", ")}`
    };
  }
  return { ok: true };
}
