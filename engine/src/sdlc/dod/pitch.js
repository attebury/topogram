// Pitch DoD per status.
//
// Returns { satisfied, errors, warnings }. Errors block the transition;
// warnings advise the author/agent.

export function checkDoD(pitch, targetStatus, graph) {
  const errors = [];
  const warnings = [];

  if (targetStatus === "shaped" || targetStatus === "submitted" || targetStatus === "approved") {
    if (!pitch.appetite) errors.push("appetite must be filled before leaving draft");
    if (!pitch.problem) errors.push("problem must be filled before leaving draft");
    if (!pitch.solutionSketch) warnings.push("solution_sketch is recommended");
  }

  if (targetStatus === "approved") {
    if (!pitch.affects || pitch.affects.length === 0) {
      warnings.push("approved pitch has no `affects` references (no downstream impact recorded)");
    }
  }

  if (targetStatus === "covered") {
    const requirements = Array.isArray(pitch.requirements) ? pitch.requirements : [];
    const decisions = [
      ...(Array.isArray(pitch.decisions) ? pitch.decisions : []),
      ...(Array.isArray(pitch.decisionsFromPitch) ? pitch.decisionsFromPitch : [])
    ];
    if (requirements.length === 0 && decisions.length === 0) {
      errors.push("covered pitch must link to at least one requirement or decision");
    }
  }

  return { satisfied: errors.length === 0, errors, warnings };
}
