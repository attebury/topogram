import {
  artifactLoadOrderFromGeneratorTargets,
  canonicalWriteCandidatesFromWriteScope,
  recommendedArtifactQueriesFromGeneratorTargets,
  stableSortedStrings,
  summarizeDiffArtifact
} from "./common.js";
import { buildImportPlanNextAction } from "./workflow-presets-core.js";
import {
  buildGeneratorTargets,
  buildProjectionImpacts
} from "./projection-impacts.js";
import {
  buildImportMaintainedRisk,
  buildMaintainedImpacts,
  buildMaintainedRiskSummary
} from "./maintained-risk.js";
import {
  buildOperatorLoopSummary,
  recommendedQueryFamilyForAction
} from "./workflow-context-shared.js";
export function buildImportPlanPayload(adoptionPlan, taskModeArtifact, maintainedBoundaryArtifact = null, workflowPresetState = null) {
  const importMaintained = buildImportMaintainedRisk(adoptionPlan.imported_proposal_surfaces || [], maintainedBoundaryArtifact);
  const importNextAction = buildImportPlanNextAction(taskModeArtifact.next_action || null, workflowPresetState);
  const presetGuidanceSummary = buildPresetGuidanceSummary(workflowPresetState, null);
  return {
    type: "import_plan_query",
    summary: taskModeArtifact.summary || null,
    adoption_state_vocabulary: adoptionPlan.adoption_state_vocabulary || [],
    next_action: importNextAction,
    write_scope: taskModeArtifact.write_scope || null,
    verification_targets: taskModeArtifact.verification_targets || null,
    review_groups: adoptionPlan.approved_review_groups || [],
    staged_items: adoptionPlan.staged_items || [],
    accepted_items: adoptionPlan.accepted_items || [],
    rejected_items: adoptionPlan.rejected_items || [],
    requires_human_review: adoptionPlan.requires_human_review || [],
    proposal_surfaces: importMaintained.proposal_surfaces,
    maintained_risk: importMaintained.maintained_risk,
    maintained_seam_review_summary: importMaintained.maintained_seam_review_summary,
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    preset_blockers: presetGuidanceSummary.preset_blockers,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    workflow_presets: workflowPresetState || {
      provider: [],
      team: [],
      active_provider_count: 0,
      active_team_count: 0,
      workflow_preset_surfaces: [],
      workflow_preset_refresh_summary: {
        type: "workflow_preset_diff_query",
        diffs: [],
        summary: {
          diff_count: 0,
          new_count: 0,
          unchanged_count: 0,
          changed_count: 0,
          locally_customized_count: 0,
          orphaned_customization_count: 0,
          requires_fresh_review_count: 0
        }
      }
    }
  };
}

export function classifyChangePlan(changePlan, diffArtifact, projectionImpacts, generatorTargets, maintainedImpacts) {
  const focusKind = changePlan.focus?.kind || null;
  const semanticSections = diffArtifact
    ? ["entities", "capabilities", "components", "rules", "workflows", "journeys", "shapes", "projections"]
        .filter((section) => (diffArtifact[section] || []).length > 0)
    : [];
  let classification = "context_review";
  if (diffArtifact) {
    classification = semanticSections.length > 0 ? "semantic_diff" : "diff_without_semantic_change";
  } else if (focusKind === "projection") {
    classification = "projection_focused_change";
  } else if (focusKind === "capability" || focusKind === "entity") {
    classification = "surface_closure_review";
  }
  if (maintainedImpacts.maintained_code_likely_impacted) {
    classification = `${classification}_with_maintained_followup`;
  }

  return {
    classification,
    selected_mode: changePlan.mode,
    focus: changePlan.focus,
    has_diff_baseline: Boolean(diffArtifact),
    semantic_sections_changed: semanticSections,
    affected_projection_count: projectionImpacts.length,
    affected_output_count: maintainedImpacts.affected_outputs.length,
    affected_seam_count: maintainedImpacts.affected_seams.length,
    recommended_generator_count: generatorTargets.length,
    maintained_code_likely_impacted: maintainedImpacts.maintained_code_likely_impacted
  };
}

export function buildAlignmentRecommendations(changePlan, projectionImpacts, generatorTargets, maintainedImpacts) {
  const recommendations = [
    {
      action: "inspect_semantic_scope",
      order: 1,
      reason: changePlan.diff_summary
        ? "Review the semantic diff and affected projection closure before regenerating downstream surfaces."
        : "Review the selected surface and its projection closure before regenerating downstream surfaces."
    }
  ];

  if (projectionImpacts.length > 0) {
    recommendations.push({
      action: "regenerate_projection_targets",
      order: 2,
      reason: `Regenerate the recommended targets for ${projectionImpacts.length} affected projection(s).`,
      targets: stableSortedStrings(generatorTargets.map((entry) => entry.target))
    });
  }

  if (maintainedImpacts.maintained_code_likely_impacted) {
    recommendations.push({
      action: "review_maintained_followup",
      order: 3,
      reason: "Maintained code is likely impacted, so human-owned seams should be reviewed after regeneration.",
      maintained_files_in_scope: maintainedImpacts.maintained_files_in_scope,
      affected_outputs: stableSortedStrings(maintainedImpacts.affected_outputs.map((output) => output.output_id)),
      affected_seams: stableSortedStrings(maintainedImpacts.affected_seams.map((seam) => seam.seam_id || seam.label))
    });
  }

  recommendations.push({
    action: "run_verification_targets",
    order: maintainedImpacts.maintained_code_likely_impacted ? 4 : 3,
    reason: "Run the smallest recommended proof set once generated and maintained surfaces are aligned.",
    verification_targets: changePlan.verification_targets || null,
    output_verification_targets: maintainedImpacts.affected_outputs.map((output) => ({
      output_id: output.output_id,
      verification_targets: output.verification_targets || null
    }))
  });

  return recommendations;
}

export function buildMaintainedDriftPayload({ diffArtifact, maintainedBoundaryArtifact, verificationTargets, nextAction }) {
  const diffMaintained = diffArtifact?.affected_maintained_surfaces || null;
  const affectedSeams = (diffMaintained?.affected_seams || maintainedBoundaryArtifact?.seams || [])
    .map((seam) => normalizeSeamSummary(seam))
    .sort((a, b) => {
      const severityCompare = severityRank(b.status) - severityRank(a.status);
      return severityCompare !== 0 ? severityCompare : String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
    });

  const statusCounts = {
    aligned: affectedSeams.filter((seam) => seam.status === "aligned").length,
    review_required: affectedSeams.filter((seam) => seam.status === "review_required").length,
    manual_decision: affectedSeams.filter((seam) => seam.status === "manual_decision").length,
    no_go: affectedSeams.filter((seam) => seam.status === "no_go").length
  };
  const highestSeverity = affectedSeams[0]?.status || "aligned";
  const maintainedFiles = stableSortedStrings(diffMaintained?.maintained_files_in_scope || maintainedBoundaryArtifact?.maintained_files_in_scope || []);
  const humanOwnedSeams = stableSortedStrings([
    ...(maintainedBoundaryArtifact?.human_owned_seams || []),
    ...affectedSeams.map((seam) => seam.label)
  ]);
  const outputs = buildMaintainedOutputGroups(
    diffMaintained?.outputs || maintainedBoundaryArtifact?.outputs || [],
    affectedSeams,
    {
      summaryField: "status",
      severitySelector: severityRank,
      verificationTargetsFallback: verificationTargets || null
    }
  ).map((output) => ({
    output_id: output.output_id,
    label: output.label,
    kind: output.kind,
    root_paths: output.root_paths,
    ownership_boundary: output.ownership_boundary,
    write_scope: output.write_scope,
    verification_targets: output.verification_targets,
    maintained_files_in_scope: output.maintained_files_in_scope,
    human_owned_seams: output.human_owned_seams,
    seam_families: output.seam_families,
    affected_seams: output.seams,
    proof_stories: output.proof_stories,
    summary: output.summary
  }));
  const affectedSeamFamilies = stableSortedStrings(affectedSeams.map((seam) => seam.seam_family_id).filter(Boolean));

  return {
    type: "maintained_drift_query",
    baseline_root: diffArtifact?.baseline_root || null,
    diff_summary: summarizeDiffArtifact(diffArtifact),
    ownership_interpretation: diffMaintained?.ownership_interpretation || {
      generated_only_impact: affectedSeams.length === 0,
      maintained_code_impact: affectedSeams.length > 0,
      human_review_required_impact: highestSeverity !== "aligned"
    },
    summary: {
      affected_seam_count: affectedSeams.length,
      affected_seam_family_count: affectedSeamFamilies.length,
      affected_output_count: outputs.length,
      maintained_file_count: maintainedFiles.length,
      highest_severity: highestSeverity,
      status_counts: statusCounts,
      affected_seam_families: affectedSeamFamilies
    },
    outputs,
    maintained_files_in_scope: maintainedFiles,
    human_owned_seams: humanOwnedSeams,
    affected_seam_families: affectedSeamFamilies,
    affected_seams: affectedSeams,
    proof_stories: (diffMaintained?.proof_stories || maintainedBoundaryArtifact?.proof_stories || []).map((story) => normalizeProofStorySummary(story)),
    verification_targets: verificationTargets || null,
    recommended_next_action: nextAction || null
  };
}

export function conformanceSeverityRank(state) {
  if (state === "no_go") return 4;
  if (state === "drift_suspected") return 3;
  if (state === "review_required") return 2;
  if (state === "unverifiable") return 1;
  return 0;
}

export function seamConformanceState(seam, { diffBacked }) {
  if ((seam?.status || null) === "no_go") {
    return "no_go";
  }
  if (diffBacked && (seam?.status === "manual_decision" || seam?.status === "review_required")) {
    return "drift_suspected";
  }
  if (!Array.isArray(seam?.proof_stories) || seam.proof_stories.length === 0 || !Array.isArray(seam?.maintained_modules) || seam.maintained_modules.length === 0) {
    return "unverifiable";
  }
  if ((seam?.status || null) === "manual_decision" || (seam?.status || null) === "review_required") {
    return "review_required";
  }
  return "aligned";
}

export function buildMaintainedConformancePayload({
  graph,
  diffArtifact,
  maintainedBoundaryArtifact,
  verificationTargets,
  nextAction
}) {
  const diffMaintained = diffArtifact?.affected_maintained_surfaces || null;
  const diffBacked = Boolean(diffArtifact);
  const sourceSeams = (diffMaintained?.affected_seams || []).length > 0
    ? diffMaintained.affected_seams
    : (maintainedBoundaryArtifact?.seams || []);
  const seams = sourceSeams
    .map((seam) => {
      const seamChecks = buildSeamProbeReport(graph, seam, {
        verificationTargets: verificationTargetsForOutput(seam.output_id, maintainedBoundaryArtifact, verificationTargets),
        outputRecord: (maintainedBoundaryArtifact?.outputs || []).find((output) => output.output_id === seam.output_id) || null,
        diffBacked
      });
      const outputVerificationTargets = verificationTargetsForOutput(seam.output_id, maintainedBoundaryArtifact, verificationTargets);
      const conformanceState = conformanceStateFromSeamCheck(seam, seamChecks);
      return {
        ...normalizeSeamSummary(seam),
        conformance_state: conformanceState,
        seam_checks: seamChecks,
        evidence: {
          proof_story_count: (seam.proof_stories || []).length,
          has_maintained_modules: Array.isArray(seam.maintained_modules) && seam.maintained_modules.length > 0,
          has_emitted_dependencies: Array.isArray(seam.emitted_dependencies) && seam.emitted_dependencies.length > 0,
          diff_pressure: diffBacked,
          review_boundary_classes: stableSortedStrings((seam.proof_stories || []).map((story) => story.review_boundary?.automation_class).filter(Boolean)),
          verification_target_types: [
            ...((outputVerificationTargets?.generated_checks || []).length > 0 ? ["generated_checks"] : []),
            ...((outputVerificationTargets?.maintained_app_checks || []).length > 0 ? ["maintained_app_checks"] : [])
          ]
        },
        recommended_checks: {
          generated_checks: outputVerificationTargets?.generated_checks || [],
          maintained_app_checks: outputVerificationTargets?.maintained_app_checks || [],
          verification_ids: outputVerificationTargets?.verification_ids || []
        }
      };
    })
    .sort((a, b) => {
      const severityCompare = conformanceSeverityRank(b.conformance_state) - conformanceSeverityRank(a.conformance_state);
      return severityCompare !== 0 ? severityCompare : String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
    });

  const counts = {
    aligned: seams.filter((seam) => seam.conformance_state === "aligned").length,
    review_required: seams.filter((seam) => seam.conformance_state === "review_required").length,
    drift_suspected: seams.filter((seam) => seam.conformance_state === "drift_suspected").length,
    no_go: seams.filter((seam) => seam.conformance_state === "no_go").length,
    unverifiable: seams.filter((seam) => seam.conformance_state === "unverifiable").length
  };
  const conformanceStatus = seams[0]?.conformance_state || "aligned";
  const outputs = buildMaintainedOutputGroups(
    diffMaintained?.outputs || maintainedBoundaryArtifact?.outputs || [],
    seams,
    {
      summaryField: "conformance_state",
      severitySelector: conformanceSeverityRank,
      verificationTargetsFallback: verificationTargets || null
    }
  ).map((output) => ({
    output_id: output.output_id,
    label: output.label,
    kind: output.kind,
    root_paths: output.root_paths,
    ownership_boundary: output.ownership_boundary,
    write_scope: output.write_scope,
    verification_targets: output.verification_targets,
    maintained_files_in_scope: output.maintained_files_in_scope,
    human_owned_seams: output.human_owned_seams,
    seam_families: output.seam_families,
    conformance_status: output.summary.highest_severity,
    summary: {
      governed_seam_count: output.seams.length,
      affected_seam_family_count: output.summary.affected_seam_family_count || 0,
      aligned_count: output.seams.filter((seam) => seam.conformance_state === "aligned").length,
      review_required_count: output.seams.filter((seam) => seam.conformance_state === "review_required").length,
      drift_suspected_count: output.seams.filter((seam) => seam.conformance_state === "drift_suspected").length,
      no_go_count: output.seams.filter((seam) => seam.conformance_state === "no_go").length,
      unverifiable_count: output.seams.filter((seam) => seam.conformance_state === "unverifiable").length,
      highest_severity: output.summary.highest_severity,
      affected_seam_families: output.summary.affected_seam_families || []
    },
    seams: output.seams
  }));
  const seamFamilies = stableSortedStrings(seams.map((seam) => seam.seam_family_id).filter(Boolean));

  return {
    type: "maintained_conformance_query",
    baseline_root: diffArtifact?.baseline_root || null,
    diff_summary: summarizeDiffArtifact(diffArtifact),
    conformance_status: conformanceStatus,
    summary: {
      governed_seam_count: seams.length,
      affected_seam_family_count: seamFamilies.length,
      aligned_count: counts.aligned,
      review_required_count: counts.review_required,
      drift_suspected_count: counts.drift_suspected,
      no_go_count: counts.no_go,
      unverifiable_count: counts.unverifiable,
      highest_severity: conformanceStatus,
      affected_seam_families: seamFamilies
    },
    outputs,
    seams,
    verification_targets: verificationTargets || null,
    recommended_next_action: nextAction || null
  };
}

export function buildSeamCheckPayload({
  graph,
  maintainedBoundaryArtifact,
  diffArtifact = null,
  verificationTargets = null,
  nextAction = null,
  seamId = null
}) {
  const diffBacked = Boolean(diffArtifact);
  const sourceSeams = (diffArtifact?.affected_maintained_surfaces?.affected_seams || []).length > 0
    ? diffArtifact.affected_maintained_surfaces.affected_seams
    : (maintainedBoundaryArtifact?.seams || []);
  const filteredSeams = seamId
    ? sourceSeams.filter((seam) => seam.seam_id === seamId || seam.label === seamId)
    : sourceSeams;
  const seamChecks = filteredSeams
    .map((seam) => {
      const normalized = normalizeSeamSummary(seam);
      const check = buildSeamProbeReport(graph, seam, {
        verificationTargets: verificationTargetsForOutput(normalized.output_id, maintainedBoundaryArtifact, verificationTargets),
        outputRecord: (maintainedBoundaryArtifact?.outputs || []).find((output) => output.output_id === normalized.output_id) || null,
        diffBacked
      });
      return {
        ...compactMaintainedSeamSummary(normalized),
        label: normalized.label,
        check_status: check.check_status,
        probes: check.probes,
        verification_targets: verificationTargetsForOutput(normalized.output_id, maintainedBoundaryArtifact, verificationTargets)
      };
    })
    .sort((a, b) => {
      const rank = { no_go: 4, stale: 3, guarded: 2, unverifiable: 1, aligned: 0 };
      const severityCompare = (rank[b.check_status] ?? 0) - (rank[a.check_status] ?? 0);
      return severityCompare !== 0 ? severityCompare : String(a.seam_id || "").localeCompare(String(b.seam_id || ""));
    });
  const summary = {
    seam_count: seamChecks.length,
    seam_family_count: stableSortedStrings(seamChecks.map((item) => item.seam_family_id).filter(Boolean)).length,
    aligned_count: seamChecks.filter((item) => item.check_status === "aligned").length,
    guarded_count: seamChecks.filter((item) => item.check_status === "guarded").length,
    stale_count: seamChecks.filter((item) => item.check_status === "stale").length,
    no_go_count: seamChecks.filter((item) => item.check_status === "no_go").length,
    unverifiable_count: seamChecks.filter((item) => item.check_status === "unverifiable").length,
    highest_status: seamChecks[0]?.check_status || "aligned"
  };

  return {
    type: "seam_check_query",
    baseline_root: diffArtifact?.baseline_root || null,
    diff_summary: summarizeDiffArtifact(diffArtifact),
    summary,
    seams: seamChecks,
    recommended_next_action: nextAction || null
  };
}

export function buildChangePlanPayload({ graph, taskModeArtifact, sliceArtifact, diffArtifact, maintainedBoundaryArtifact }) {
  const basePayload = {
    type: "change_plan_query",
    mode: taskModeArtifact.mode,
    focus: sliceArtifact?.focus || taskModeArtifact.summary?.selected_surface || null,
    summary: taskModeArtifact.summary || null,
    preferred_context_artifacts: taskModeArtifact.preferred_context_artifacts || [],
    next_action: taskModeArtifact.next_action || null,
    review_boundary: sliceArtifact?.review_boundary || null,
    ownership_boundary: sliceArtifact?.ownership_boundary || taskModeArtifact.ownership_boundary || null,
    write_scope: taskModeArtifact.write_scope || sliceArtifact?.write_scope || null,
    verification_targets: taskModeArtifact.verification_targets || sliceArtifact?.verification_targets || null,
    maintained_boundary: maintainedBoundaryArtifact || null,
    diff_summary: summarizeDiffArtifact(diffArtifact)
  };

  const projectionImpacts = graph ? buildProjectionImpacts(graph, { sliceArtifact, diffArtifact }) : [];
  const generatorTargets = graph ? buildGeneratorTargets(graph, projectionImpacts, diffArtifact) : [];
  const maintainedImpacts = buildMaintainedImpacts({
    diffArtifact,
    maintainedBoundaryArtifact,
    sliceArtifact,
    verificationTargets: basePayload.verification_targets
  });

  return {
    ...basePayload,
    change_summary: classifyChangePlan(basePayload, diffArtifact, projectionImpacts, generatorTargets, maintainedImpacts),
    projection_impacts: projectionImpacts,
    generator_targets: generatorTargets,
    maintained_impacts: maintainedImpacts,
    alignment_recommendations: buildAlignmentRecommendations(basePayload, projectionImpacts, generatorTargets, maintainedImpacts)
  };
}

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

export function buildCanonicalWritesPayloadForImportPlan(proposalSurfaces = []) {
  return {
    type: "canonical_writes_query",
    source: "import-plan",
    canonical_writes: proposalSurfaces
      .filter((surface) => surface.canonical_rel_path)
      .map((surface) => ({
        id: surface.id,
        current_state: surface.current_state,
        recommended_state: surface.recommended_state,
        canonical_rel_path: surface.canonical_rel_path,
        canonical_path: `topogram/${surface.canonical_rel_path}`
      }))
  };
}

export function buildCanonicalWritesPayloadForChangePlan(writeScope) {
  return {
    type: "canonical_writes_query",
    source: "change-plan",
    canonical_writes: canonicalWriteCandidatesFromWriteScope(writeScope).map((entry) => ({
      path: entry
    }))
  };
}

export function buildReviewPacketPayloadForImportPlan({ importPlan, risk }) {
  const presetGuidanceSummary = buildPresetGuidanceSummary(importPlan.workflow_presets || null, null);
  return {
    type: "review_packet_query",
    source: "import-plan",
    summary: importPlan.summary || null,
    risk_summary: {
      overall_risk: risk.overall_risk,
      risk_reasons: risk.risk_reasons,
      blocking_factors: risk.blocking_factors,
      maintained_risk: importPlan.maintained_risk || null
    },
    next_action: importPlan.next_action || null,
    recommended_query_family: recommendedQueryFamilyForAction(importPlan.next_action, "import-adopt"),
    canonical_writes: (importPlan.proposal_surfaces || [])
      .filter((surface) => surface.canonical_rel_path)
      .map((surface) => ({
        id: surface.id,
        canonical_rel_path: surface.canonical_rel_path,
        canonical_path: `topogram/${surface.canonical_rel_path}`
      })),
    review_groups: importPlan.review_groups || [],
    write_scope: importPlan.write_scope || null,
    verification_targets: importPlan.verification_targets || null,
    proposal_surfaces: importPlan.proposal_surfaces || [],
    maintained_risk: importPlan.maintained_risk || null,
    maintained_seam_review_summary: importPlan.maintained_seam_review_summary || null,
    operator_loop: buildOperatorLoopSummary({
      mode: "import-adopt",
      nextAction: importPlan.next_action || null,
      primaryArtifacts: ["import-plan", "adoption-plan.agent.json"],
      verificationTargets: importPlan.verification_targets || null,
      currentSurface: "review-packet"
    }),
    output_verification_targets: importPlan.maintained_risk?.output_verification_targets || [],
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    preset_blockers: presetGuidanceSummary.preset_blockers,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    workflow_presets: importPlan.workflow_presets || null,
    workflow_preset_surfaces: importPlan.workflow_presets?.workflow_preset_surfaces || [],
    workflow_preset_refresh_summary: importPlan.workflow_presets?.workflow_preset_refresh_summary || null
  };
}

export function buildReviewPacketPayloadForChangePlan({ changePlan, risk }) {
  const maintainedRisk = buildMaintainedRiskSummary({
    maintainedImpacts: changePlan.maintained_impacts,
    maintainedBoundary: changePlan.maintained_boundary,
    diffSummary: changePlan.diff_summary
  });
  return {
    type: "review_packet_query",
    source: "change-plan",
    summary: changePlan.summary || null,
    change_summary: changePlan.change_summary || null,
    risk_summary: {
      overall_risk: risk.overall_risk,
      risk_reasons: risk.risk_reasons,
      blocking_factors: risk.blocking_factors,
      maintained_risk: maintainedRisk
    },
    next_action: changePlan.next_action || null,
    recommended_query_family: recommendedQueryFamilyForAction(changePlan.next_action, changePlan.mode || null),
    canonical_writes: canonicalWriteCandidatesFromWriteScope(changePlan.write_scope).map((entry) => ({
      path: entry
    })),
    review_boundary: changePlan.review_boundary || null,
    maintained_boundary: changePlan.maintained_boundary || null,
    maintained_impacts: changePlan.maintained_impacts || null,
    diff_summary: changePlan.diff_summary || null,
    write_scope: changePlan.write_scope || null,
    verification_targets: changePlan.verification_targets || null,
    generator_targets: changePlan.generator_targets || [],
    operator_loop: buildOperatorLoopSummary({
      mode: changePlan.mode || null,
      nextAction: changePlan.next_action || null,
      primaryArtifacts: changePlan.context_artifacts || [],
      verificationTargets: changePlan.verification_targets || null,
      currentSurface: "review-packet"
    }),
    alignment_recommendations: changePlan.alignment_recommendations || [],
    output_verification_targets: maintainedRisk.output_verification_targets || []
  };
}
