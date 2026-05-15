// Task DoD per status.

function refId(ref) {
  return typeof ref === "string" ? ref : ref?.id || null;
}

function refsFor(value) {
  return Array.isArray(value) ? value.map(refId).filter(Boolean) : [];
}

function requireRefs(kind, ids, byId, errors, options = {}) {
  for (const id of ids) {
    const target = byId?.get(id);
    if (!target) {
      errors.push(`status 'done' references missing ${kind} '${id}'`);
      continue;
    }
    if (target.kind !== kind) {
      errors.push(`status 'done' expected ${id} to be ${kind}, found ${target.kind}`);
      continue;
    }
    if (options.status && target.status !== options.status) {
      errors.push(`status 'done' requires ${kind} '${id}' to be ${options.status}, found ${target.status}`);
    }
  }
}

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
    const byId = graph?.byId;
    if (!task.satisfies || task.satisfies.length === 0) {
      errors.push("status 'done' requires field 'satisfies'");
    }
    const acs = task.acceptanceRefs || [];
    if (acs.length === 0) {
      errors.push("status 'done' requires field 'acceptance_refs'");
    }
    const verifications = task.verificationRefs || [];
    if (verifications.length === 0) {
      errors.push("status 'done' requires field 'verification_refs'");
    }
    if (byId) {
      requireRefs("requirement", refsFor(task.satisfies), byId, errors);
      requireRefs("acceptance_criterion", refsFor(acs), byId, errors, { status: "approved" });
      requireRefs("verification", refsFor(verifications), byId, errors);
    }
  }

  return { satisfied: errors.length === 0, errors, warnings };
}
