import {
  stableSortedStrings
} from "../common.js";
import {
  buildMaintainedRiskSummary
} from "../maintained-risk.js";
import {
  buildOperatorLoopSummary,
  recommendedQueryFamilyForAction
} from "../workflow-context-shared.js";

export function classifyRisk({ reviewBoundary, maintainedBoundary, diffSummary, verificationTargets, importPlan, maintainedRisk = null }) {
  const reasons = [];
  const blockingFactors = [];
  const normalizedMaintainedRisk = maintainedRisk || buildMaintainedRiskSummary({
    maintainedBoundary,
    diffSummary
  });
  const workflowPresets = importPlan?.workflow_presets || null;
  const workflowPresetEntries = [
    ...(workflowPresets?.provider || []),
    ...(workflowPresets?.team || [])
  ];
  const activeWorkflowPresets = workflowPresetEntries.filter((preset) =>
    preset.active_for_context &&
    (
      (preset.kind === "provider_workflow_preset" && ["accept", "accepted"].includes(preset.adoption_state)) ||
      (preset.kind === "team_workflow_preset" && !["reject", "rejected", "stage", "staged"].includes(preset.adoption_state))
    )
  );
  const manualDecisionPreset = activeWorkflowPresets.find((preset) => preset.review_class === "manual_decision");
  const reviewRequiredPreset = activeWorkflowPresets.find((preset) => preset.review_class === "review_required");
  const presetRefreshSummary = workflowPresets?.workflow_preset_refresh_summary?.summary || null;

  if (normalizedMaintainedRisk.highest_severity === "no_go") {
    reasons.push("maintained_no_go_seam");
    blockingFactors.push("Maintained-app proof boundaries include no-go changes.");
  }
  if ((reviewBoundary?.automation_class || null) === "no_go") {
    reasons.push("review_boundary_no_go");
    blockingFactors.push("Selected surface is classified as no-go for automation.");
  }
  if ((diffSummary?.review_boundary_change_count || 0) > 0) {
    reasons.push("review_boundary_changes_detected");
    blockingFactors.push("Semantic diff changes existing automation/review boundaries.");
  }
  if ((importPlan?.requires_human_review || []).length > 0) {
    reasons.push("import_requires_human_review");
    blockingFactors.push("Imported proposal surfaces still require human review or mapping decisions.");
  }
  if ((presetRefreshSummary?.requires_fresh_review_count || 0) > 0) {
    reasons.push("workflow_preset_refresh_review_required");
    blockingFactors.push("Provider workflow preset refresh changes require fresh review.");
  }
  if (manualDecisionPreset) {
    reasons.push("provider_workflow_preset_manual_decision");
    blockingFactors.push(`Workflow preset ${manualDecisionPreset.id} escalates provider-sensitive review categories.`);
  }
  if (reviewRequiredPreset) {
    reasons.push("provider_workflow_preset_review_required");
  }
  if (normalizedMaintainedRisk.affected_output_count > 1) {
    reasons.push("maintained_multi_output_impact");
  }
  if ((reviewBoundary?.automation_class || null) === "manual_decision") {
    reasons.push("manual_decision_surface");
  }
  if (normalizedMaintainedRisk.highest_severity === "manual_decision") {
    reasons.push("maintained_manual_decision_seam");
  }
  if (normalizedMaintainedRisk.highest_severity === "review_required") {
    reasons.push("maintained_review_required_seam");
  }
  if ((reviewBoundary?.automation_class || null) === "review_required") {
    reasons.push("review_required_surface");
  }
  if ((verificationTargets?.maintained_app_checks || []).length > 0) {
    reasons.push("maintained_proof_gates");
  }

  let overallRisk = "safe";
  if (reasons.includes("maintained_no_go_seam") || reasons.includes("review_boundary_no_go")) {
    overallRisk = "no_go";
  } else if (
    reasons.includes("review_boundary_changes_detected") ||
    reasons.includes("import_requires_human_review") ||
    reasons.includes("manual_decision_surface") ||
    reasons.includes("maintained_manual_decision_seam") ||
    reasons.includes("provider_workflow_preset_manual_decision") ||
    reasons.includes("workflow_preset_refresh_review_required")
  ) {
    overallRisk = "manual_decision";
  } else if (
    reasons.includes("review_required_surface") ||
    reasons.includes("maintained_review_required_seam") ||
    reasons.includes("maintained_proof_gates") ||
    reasons.includes("provider_workflow_preset_review_required")
  ) {
    overallRisk = "review_required";
  }

  return {
    overall_risk: overallRisk,
    risk_reasons: reasons,
    blocking_factors: blockingFactors,
    recommended_human_review: overallRisk !== "safe"
  };
}

export function buildRiskSummaryPayload({ source, risk, nextAction, maintainedRisk = null }) {
  return {
    type: "risk_summary_query",
    source,
    ...risk,
    maintained_risk: maintainedRisk,
    recommended_next_action: nextAction || null
  };
}

export function proceedDecisionFromRisk(risk, nextAction, writeScope, verificationTargets, maintainedRisk = null, workflowPresets = null, resolvedWorkflowContext = null) {
  let decision = "proceed";
  let reason = "No explicit review or safety blockers were detected.";

  if (risk.overall_risk === "no_go") {
    decision = "stop_no_go";
    reason = "At least one no-go boundary blocks automated progress.";
  } else if (risk.overall_risk === "manual_decision") {
    decision = "stage_only";
    reason = "This change should be staged or reviewed rather than applied directly.";
  } else if (risk.overall_risk === "review_required") {
    decision = "proceed_with_review";
    reason = "The change is possible, but it should proceed with explicit human review.";
  }

  const presetGuidanceSummary = buildPresetGuidanceSummary(workflowPresets, resolvedWorkflowContext);
  return {
    type: "proceed_decision_query",
    decision,
    reason,
    blocking_factors: risk.blocking_factors || [],
    required_human_review: Boolean(risk.recommended_human_review),
    recommended_next_action: nextAction || null,
    recommended_query_family: recommendedQueryFamilyForAction(nextAction, resolvedWorkflowContext?.resolved_task_mode || null),
    recommended_write_scope: writeScope || null,
    recommended_verification_targets: verificationTargets || null,
    operator_loop: buildOperatorLoopSummary({
      mode: resolvedWorkflowContext?.resolved_task_mode || null,
      nextAction,
      primaryArtifacts: resolvedWorkflowContext?.artifact_load_order || [],
      verificationTargets,
      currentSurface: "proceed-decision"
    }),
    maintained_risk: maintainedRisk,
    maintained_seam_review_summary: maintainedRisk?.maintained_seam_review_summary || null,
    output_verification_targets: maintainedRisk?.output_verification_targets || [],
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids
  };
}

export function buildPresetGuidanceSummary(workflowPresets = null, resolvedWorkflowContext = null) {
  const activePresetIds = [
    ...(resolvedWorkflowContext?.applied_presets || []).map((preset) => preset.id),
    ...((workflowPresets?.provider || []).filter((preset) => preset.active_for_context && ["accept", "accepted"].includes(preset.adoption_state)).map((preset) => preset.id)),
    ...((workflowPresets?.team || []).filter((preset) => preset.active_for_context && !["reject", "rejected", "stage", "staged"].includes(preset.adoption_state)).map((preset) => preset.id))
  ];
  const refreshSummary = workflowPresets?.workflow_preset_refresh_summary?.summary || null;
  const recommendedPresetAction = (workflowPresets?.workflow_preset_surfaces || [])
    .map((surface) => surface.recommended_customization_action)
    .find(Boolean)
    || ((workflowPresets?.provider_manifest_summary?.missing_declared_workflow_preset_count || 0) > 0 ? "import_declared_workflow_preset" : null);
  const presetBlockers = stableSortedStrings([
    ...(resolvedWorkflowContext?.effective_review_policy?.block_on || []),
    ...((refreshSummary?.requires_fresh_review_count || 0) > 0 ? ["workflow_preset_refresh_review_required"] : []),
    ...((workflowPresets?.provider_manifest_summary?.invalid_declared_workflow_preset_count || 0) > 0 ? ["invalid_manifest_declared_workflow_preset"] : [])
  ]);
  return {
    active_preset_ids: stableSortedStrings(activePresetIds),
    preset_blockers: presetBlockers,
    recommended_preset_action: recommendedPresetAction,
    summary: {
      active_provider_count: workflowPresets?.active_provider_count || 0,
      active_team_count: workflowPresets?.active_team_count || 0,
      skipped_count: (resolvedWorkflowContext?.skipped_presets || []).length,
      manifest_declared_count: workflowPresets?.provider_manifest_summary?.declared_workflow_preset_count || 0,
      missing_declared_count: workflowPresets?.provider_manifest_summary?.missing_declared_workflow_preset_count || 0
    }
  };
}
