// Task DoD per status.

export function checkDoD(task, targetStatus, graph) {
  const errors = [];
  const warnings = [];

  if (targetStatus === "claimed" || targetStatus === "in-progress" || targetStatus === "done") {
    if (!task.claimedBy || task.claimedBy.length === 0) {
      errors.push(`status '${targetStatus}' requires field 'claimed_by'`);
    }
  }

  if (targetStatus === "in-progress") {
    const byId = graph?.byId;
    const blockers = task.blockedBy || [];
    if (byId && blockers.length > 0) {
      const stillBlocking = blockers
        .map((ref) => byId.get(typeof ref === "string" ? ref : ref?.id))
        .filter((b) => b && b.status !== "done");
      if (stillBlocking.length > 0) {
        errors.push(
          `cannot start work — blocked_by tasks not yet done: ${stillBlocking.map((b) => b.id).join(", ")}`
        );
      }
    }
  }

  if (targetStatus === "done") {
    if (!task.satisfies || task.satisfies.length === 0) {
      warnings.push("done task without `satisfies` references is hard to trace");
    }
    const acs = task.acceptanceRefs || [];
    if (acs.length === 0 && task.workType !== "documentation" && task.workType !== "review") {
      warnings.push("done task without `acceptance_refs` cannot tie back to verification");
    }
  }

  return { satisfied: errors.length === 0, errors, warnings };
}
