// Bug DoD per status.

export function checkDoD(bug, targetStatus, graph) {
  const errors = [];
  const warnings = [];

  if (targetStatus === "fixed" || targetStatus === "verified") {
    if (!bug.fixedIn || bug.fixedIn.length === 0) {
      errors.push(`status '${targetStatus}' requires field 'fixed_in' (the task that fixed it)`);
    }
  }

  if (targetStatus === "verified") {
    if (!bug.fixedInVerification || bug.fixedInVerification.length === 0) {
      errors.push("verified bug must reference 'fixed_in_verification' (the verification that proved the fix)");
    }
  }

  if (targetStatus === "wont-fix") {
    if (!bug.reproduction) {
      warnings.push("wont-fix bug without `reproduction` is hard to revisit later");
    }
  }

  return { satisfied: errors.length === 0, errors, warnings };
}
