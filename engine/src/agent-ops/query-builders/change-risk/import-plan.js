import { buildImportMaintainedRisk } from "../maintained-risk.js";
import { buildImportPlanNextAction } from "../workflow-presets-core.js";
import { buildPresetGuidanceSummary } from "./risk.js";

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
