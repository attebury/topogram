// Acceptance criterion DoD per status.

export function checkDoD(ac, targetStatus, graph) {
  const errors = [];
  const warnings = [];

  if (!ac.requirement) {
    errors.push("acceptance_criterion must reference a requirement");
  }

  if (targetStatus === "approved") {
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
