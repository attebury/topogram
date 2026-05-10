import {
  canonicalWriteCandidatesFromWriteScope
} from "../common.js";
import {
  buildMaintainedRiskSummary
} from "../maintained-risk.js";
import {
  buildOperatorLoopSummary,
  recommendedQueryFamilyForAction
} from "../workflow-context-shared.js";
import { buildPresetGuidanceSummary } from "./risk.js";

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
        canonical_path: `topo/${surface.canonical_rel_path}`
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
        canonical_path: `topo/${surface.canonical_rel_path}`
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
