function normalizeWorkflowSurface(surface) {
  return {
    canRequestRevision: Boolean(surface?.canRequestRevision),
    canResubmit: Boolean(surface?.canResubmit),
    requestRevisionRoute: surface?.requestRevisionRoute || null
  };
}

export function assessArticleWorkflowSurfaceChange({ fromSurface, toSurface }) {
  const previous = normalizeWorkflowSurface(fromSurface);
  const next = normalizeWorkflowSurface(toSurface);

  const changed =
    previous.canRequestRevision !== next.canRequestRevision ||
    previous.canResubmit !== next.canResubmit ||
    previous.requestRevisionRoute !== next.requestRevisionRoute;

  if (!changed) {
    return {
      kind: "article_workflow_surface",
      manualDecisionRequired: false,
      reason: null,
      previous,
      next
    };
  }

  const additiveWorkflowAffordance =
    (!previous.canRequestRevision && next.canRequestRevision) ||
    (!previous.canResubmit && next.canResubmit) ||
    (!previous.requestRevisionRoute && next.requestRevisionRoute);

  if (additiveWorkflowAffordance) {
    return {
      kind: "article_workflow_surface",
      manualDecisionRequired: true,
      reason:
        "A new workflow affordance appeared. The maintained app should preserve a human decision about placement, tone, and user guidance before updating the UI.",
      previous,
      next
    };
  }

  return {
    kind: "article_workflow_surface",
    manualDecisionRequired: true,
    reason:
      "Workflow affordances changed in a non-trivial way and require a human review of the maintained UI behavior.",
    previous,
    next
  };
}

export function summarizeArticleWorkflowDecision(assessment) {
  if (!assessment.manualDecisionRequired) {
    return "Article workflow surface is stable enough for guided app updates.";
  }

  return [
    "Manual decision required.",
    `Previous surface: requestRevision=${assessment.previous.canRequestRevision}, resubmit=${assessment.previous.canResubmit}, route=${assessment.previous.requestRevisionRoute || "none"}.`,
    `Next surface: requestRevision=${assessment.next.canRequestRevision}, resubmit=${assessment.next.canResubmit}, route=${assessment.next.requestRevisionRoute || "none"}.`,
    assessment.reason
  ].join(" ");
}
