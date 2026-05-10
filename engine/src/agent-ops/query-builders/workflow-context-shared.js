import {
  WORKFLOW_QUERY_FAMILIES_BY_MODE,
  stableSortedStrings
} from "./common.js";
export function outputIdsForWorkflowContext(taskModeArtifact, maintainedBoundary = null) {
  return stableSortedStrings([
    ...((taskModeArtifact?.verification_targets?.output_verification_targets || []).map((entry) => entry.output_id)),
    ...((maintainedBoundary?.outputs || []).map((entry) => entry.output_id))
  ]);
}

export function integrationCategoriesForWorkflowContext(taskModeArtifact, importPlan = null) {
  const categories = [];
  if (taskModeArtifact?.mode === "import-adopt") categories.push("provider_adoption");
  if (taskModeArtifact?.mode === "maintained-app-edit") categories.push("maintained_app");
  if ((taskModeArtifact?.verification_targets?.maintained_app_checks || []).length > 0) categories.push("maintained_boundary");
  if ((importPlan?.requires_human_review || []).length > 0) categories.push("human_review");
  return stableSortedStrings(categories);
}

export function currentFocusFromTaskMode(taskModeArtifact) {
  const selectedSurface = taskModeArtifact?.summary?.selected_surface || null;
  if (selectedSurface) {
    return selectedSurface;
  }
  const focus = taskModeArtifact?.summary?.focus || null;
  return focus ? { kind: "mode_focus", label: focus } : null;
}

export function verificationSurfaceForTargets(verificationTargets) {
  const targetCount = ((verificationTargets?.generated_checks || []).length)
    + ((verificationTargets?.maintained_app_checks || []).length)
    + ((verificationTargets?.verification_ids || []).length);
  return targetCount > 0 ? "verification-targets" : null;
}

export function recommendedQueryFamilyForAction(nextAction, mode = null) {
  switch (nextAction?.kind) {
    case "review_staged":
    case "review_bundle":
    case "inspect_review_group":
    case "inspect_proposal_surface":
    case "customize_workflow_preset":
    case "refresh_workflow_preset_customization":
    case "import_declared_workflow_preset":
      return "import-plan";
    case "review_diff_impact":
    case "inspect_projection":
    case "inspect_diff":
    case "review_diff_boundaries":
      return "change-plan";
    case "inspect_maintained_impact":
    case "inspect_boundary_before_edit":
    case "run_maintained_checks":
      return "maintained-boundary";
    case "inspect_verification_targets":
      return "verification-targets";
    case "inspect_workspace_digest":
      return "single-agent-plan";
    default:
      break;
  }

  if (mode === "import-adopt") return "import-plan";
  if (mode === "maintained-app-edit") return "maintained-boundary";
  if (mode === "verification") return "verification-targets";
  return "change-plan";
}

export function immediateArtifacts(primaryArtifacts = []) {
  return (primaryArtifacts || []).slice(0, 2);
}

export function buildOperatorLoopSummary({
  mode = null,
  nextAction = null,
  primaryArtifacts = [],
  verificationTargets = null,
  currentSurface = null
} = {}) {
  return {
    current_surface: currentSurface,
    start_query_family: recommendedQueryFamilyForAction(nextAction, mode),
    immediate_artifacts: immediateArtifacts(primaryArtifacts),
    review_surface: "review-packet",
    decision_surface: "proceed-decision",
    verification_surface: verificationSurfaceForTargets(verificationTargets)
  };
}

export function nextActionRequiresReview(nextAction) {
  const reviewKinds = new Set([
    "review_staged",
    "inspect_review_group",
    "inspect_proposal_surface",
    "inspect_plan",
    "inspect_boundary_before_edit",
    "review_diff_boundaries",
    "review_diff_impact",
    "inspect_maintained_impact",
    "inspect_generated_impact",
    "inspect_diff",
    "inspect_verification_targets",
    "inspect_workspace_digest"
  ]);
  return reviewKinds.has(nextAction?.kind);
}

export function buildReviewBoundaries(taskModeArtifact, importPlan = null) {
  return {
    ownership_boundary: taskModeArtifact?.ownership_boundary || null,
    review_emphasis: taskModeArtifact?.review_emphasis || [],
    approved_review_groups: importPlan?.review_groups || [],
    requires_human_review: importPlan?.requires_human_review || []
  };
}

export function buildBlockingConditions(taskModeArtifact, importPlan = null) {
  const blocking = [];
  const nextAction = taskModeArtifact?.next_action || null;

  if (nextAction?.kind === "missing_plan") {
    blocking.push({
      kind: "missing_artifact",
      artifact: "candidates/reconcile/adoption-plan.agent.json",
      reason: nextAction.reason || "No staged adoption plan exists yet.",
      recommended_step: "Run reconcile first."
    });
  }

  if ((importPlan?.requires_human_review || []).length > 0) {
    blocking.push({
      kind: "human_review_required",
      count: importPlan.requires_human_review.length,
      items: importPlan.requires_human_review,
      reason: `${importPlan.requires_human_review.length} staged proposal(s) still require human review or mapping decisions before canonical adoption.`
    });
  }

  if (nextAction && nextActionRequiresReview(nextAction)) {
    blocking.push({
      kind: "review_gate",
      next_action_kind: nextAction.kind,
      reason: nextAction.reason || "The next step is review-oriented rather than directly executable."
    });
  }

  return blocking;
}

export function firstPrimaryArtifact(taskModeArtifact) {
  return (taskModeArtifact?.preferred_context_artifacts || [])[0] || null;
}

export function buildImportAdoptSequence(taskModeArtifact, importPlan = null) {
  const steps = [];
  const primaryArtifact = firstPrimaryArtifact(taskModeArtifact);
  if (primaryArtifact) {
    steps.push({
      order: steps.length + 1,
      action: "read_primary_artifact",
      artifact: primaryArtifact,
      review_required: false,
      reason: "Start from the staged adoption view before changing canonical Topogram."
    });
  }
  if (importPlan) {
    steps.push({
      order: steps.length + 1,
      action: "inspect_adoption_state",
      review_required: (importPlan.requires_human_review || []).length > 0,
      reason: `${(importPlan.staged_items || []).length} staged item(s) and ${(importPlan.requires_human_review || []).length} review-required item(s) are currently in scope.`
    });
  }
  if (taskModeArtifact?.next_action) {
    steps.push({
      order: steps.length + 1,
      action: "follow_next_action",
      next_action_kind: taskModeArtifact.next_action.kind,
      review_required: nextActionRequiresReview(taskModeArtifact.next_action),
      reason: taskModeArtifact.next_action.reason || "Follow the current staged adoption step."
    });
  }
  steps.push({
    order: steps.length + 1,
    action: "run_proof_targets",
    review_required: false,
    proof_targets: taskModeArtifact?.verification_targets || null,
    reason: "Validate proposal state before any canonical write."
  });
  return steps;
}

export function buildMaintainedAppEditSequence(taskModeArtifact) {
  const steps = [];
  const primaryArtifact = firstPrimaryArtifact(taskModeArtifact);
  if (primaryArtifact) {
    steps.push({
      order: 1,
      action: "read_primary_artifact",
      artifact: primaryArtifact,
      review_required: false,
      reason: "Start from the maintained-app bundle to see accepted, guarded, and no-go seams."
    });
  }
  steps.push({
    order: steps.length + 1,
    action: "inspect_review_boundaries",
    review_required: true,
    reason: "Review human-owned seams and guarded boundaries before editing maintained code."
  });
  steps.push({
    order: steps.length + 1,
    action: "respect_write_scope",
    review_required: false,
    reason: "Keep edits inside the maintained write scope attached to the current proof bundle."
  });
  steps.push({
    order: steps.length + 1,
    action: "run_proof_targets",
    review_required: false,
    proof_targets: taskModeArtifact?.verification_targets || null,
    reason: "Run maintained proof checks after the bounded edit."
  });
  return steps;
}

export function buildGenericSequence(taskModeArtifact, {
  readReason,
  reviewReason,
  proofReason
} = {}) {
  const steps = [];
  const primaryArtifact = firstPrimaryArtifact(taskModeArtifact);
  if (primaryArtifact) {
    steps.push({
      order: steps.length + 1,
      action: "read_primary_artifact",
      artifact: primaryArtifact,
      review_required: false,
      reason: readReason || "Start from the preferred context artifact for this mode."
    });
  }
  if (taskModeArtifact?.next_action) {
    steps.push({
      order: steps.length + 1,
      action: "follow_next_action",
      next_action_kind: taskModeArtifact.next_action.kind,
      review_required: nextActionRequiresReview(taskModeArtifact.next_action),
      reason: taskModeArtifact.next_action.reason || "Follow the current recommended next action."
    });
  }
  steps.push({
    order: steps.length + 1,
    action: "inspect_review_boundaries",
    review_required: true,
    reason: reviewReason || "Use the attached review emphasis and ownership boundary before mutating durable meaning."
  });
  steps.push({
    order: steps.length + 1,
    action: "run_proof_targets",
    review_required: false,
    proof_targets: taskModeArtifact?.verification_targets || null,
    reason: proofReason || "Run the smallest proof set attached to this mode."
  });
  return steps;
}

export function buildRecommendedSequence(taskModeArtifact, importPlan = null) {
  const mode = taskModeArtifact?.mode || null;
  if (mode === "import-adopt") {
    return buildImportAdoptSequence(taskModeArtifact, importPlan);
  }
  if (mode === "maintained-app-edit") {
    return buildMaintainedAppEditSequence(taskModeArtifact);
  }
  if (mode === "diff-review") {
    return buildGenericSequence(taskModeArtifact, {
      readReason: "Start from the diff or focused slice before choosing an edit path.",
      reviewReason: "Diff review should stay read-first until maintained and generated impact is clear.",
      proofReason: "Keep proof selection attached to the affected semantic change."
    });
  }
  if (mode === "verification") {
    return buildGenericSequence(taskModeArtifact, {
      readReason: "Start from the focused verification context before running checks.",
      reviewReason: "Confirm the intended verification surface before widening the check set.",
      proofReason: "Run the smallest correct proof set for the current task."
    });
  }
  return buildGenericSequence(taskModeArtifact, {
    readReason: "Start from the focused modeling context before editing canonical Topogram.",
    reviewReason: "Review semantic boundaries before changing durable intent.",
    proofReason: "Run the proof targets attached to the selected semantic closure."
  });
}

export function coreWorkflowQueriesForMode(mode) {
  return WORKFLOW_QUERY_FAMILIES_BY_MODE[mode] || ["change-plan", "risk-summary", "verification-targets"];
}
