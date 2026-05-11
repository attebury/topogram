// Plan DoD per status.

export function checkDoD(plan, targetStatus) {
  const errors = [];
  const warnings = [];

  if (targetStatus === "complete") {
    const incomplete = (plan.steps || []).filter((step) => step.status !== "done" && step.status !== "skipped");
    if (incomplete.length > 0) {
      errors.push(`status 'complete' requires all plan steps to be done or skipped: ${incomplete.map((step) => step.id).join(", ")}`);
    }
  }

  return { satisfied: errors.length === 0, errors, warnings };
}
