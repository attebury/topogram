import {
  stableSortedStrings,
  summarizeDiffArtifact
} from "../common.js";
import {
  buildGeneratorTargets,
  buildProjectionImpacts
} from "../projection-impacts.js";
import {
  buildMaintainedImpacts
} from "../maintained-risk.js";

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
