// Acceptance criterion DoD per status.

function hasGivenWhenThen(description) {
  return /\bGiven\b[\s\S]*\bwhen\b[\s\S]*\bthen\b/i.test(description || "");
}

export function checkDoD(ac, targetStatus, graph) {
  const errors = [];
  const warnings = [];

  if (!ac.requirement) {
    errors.push("acceptance_criterion must reference a requirement");
  }

  if (targetStatus === "approved") {
    if (!hasGivenWhenThen(ac.description)) {
      errors.push("approved acceptance_criterion description must use observable Given/When/Then wording");
    }
    const byId = graph?.byId;
    if (byId && ac.requirement?.id) {
      const req = byId.get(ac.requirement.id);
      if (req && req.status === "draft") {
        warnings.push(`acceptance_criterion approved while parent requirement '${req.id}' is still draft`);
      }
    }
  }

  return { satisfied: errors.length === 0, errors, warnings };
}
