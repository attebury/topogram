function relationSignature(relation) {
  if (!relation) {
    return null;
  }

  return {
    field: relation.field || null,
    targetId: relation.target?.id || null,
    targetField: relation.target?.field || null,
    onDelete: relation.onDelete || null
  };
}

export function assessProjectOwnerRelationChange({ fromRelation, toRelation }) {
  const previous = relationSignature(fromRelation);
  const next = relationSignature(toRelation);

  if (!previous && !next) {
    return {
      kind: "project_owner_relation",
      manualDecisionRequired: false,
      reason: null
    };
  }

  if (!previous && next) {
    return {
      kind: "project_owner_relation",
      manualDecisionRequired: false,
      reason: null
    };
  }

  if (previous && !next) {
    return {
      kind: "project_owner_relation",
      manualDecisionRequired: true,
      reason: "Project ownership semantics were removed from the maintained app surface."
    };
  }

  const changed =
    previous.field !== next.field ||
    previous.targetId !== next.targetId ||
    previous.targetField !== next.targetField ||
    previous.onDelete !== next.onDelete;

  if (!changed) {
    return {
      kind: "project_owner_relation",
      manualDecisionRequired: false,
      reason: null
    };
  }

  return {
    kind: "project_owner_relation",
    manualDecisionRequired: true,
    reason: "Project ownership semantics changed and require a human decision before updating maintained UI behavior.",
    previous,
    next
  };
}

export function summarizeProjectOwnerRelationDecision(assessment) {
  if (!assessment.manualDecisionRequired) {
    return "Project owner relation is stable enough for guided app updates.";
  }

  const previousTarget = assessment.previous?.targetId
    ? `${assessment.previous.targetId}.${assessment.previous.targetField}`
    : "none";
  const nextTarget = assessment.next?.targetId
    ? `${assessment.next.targetId}.${assessment.next.targetField}`
    : "none";

  return [
    "Manual decision required.",
    `Previous target: ${previousTarget}.`,
    `Next target: ${nextTarget}.`,
    assessment.reason
  ].join(" ");
}
