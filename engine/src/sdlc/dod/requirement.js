// Requirement DoD per status.

export function checkDoD(requirement, targetStatus, graph) {
  const errors = [];
  const warnings = [];

  if (targetStatus === "in-review" || targetStatus === "approved") {
    if (!requirement.affects || requirement.affects.length === 0) {
      errors.push("requirement must list at least one `affects` target before review");
    }
  }

  if (targetStatus === "approved") {
    if (!requirement.acceptanceCriteria || requirement.acceptanceCriteria.length === 0) {
      errors.push("approved requirement must have at least one acceptance_criterion");
    }
    const acs = requirement.acceptanceCriteria || [];
    const byId = graph?.byId;
    if (byId) {
      const undraftedAcs = acs.filter((id) => byId.get(id)?.status === "draft");
      if (undraftedAcs.length > 0) {
        warnings.push(`approved requirement has draft ACs: ${undraftedAcs.join(", ")}`);
      }
    }
  }

  if (targetStatus === "superseded") {
    if (!requirement.supersedes || requirement.supersedes.length === 0) {
      warnings.push("superseded status without listing what supersedes it loses traceability");
    }
  }

  return { satisfied: errors.length === 0, errors, warnings };
}
