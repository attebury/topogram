import fs from "node:fs";
import path from "node:path";

import { buildAgentAdoptionPlan } from "../../adoption/plan.js";
import { defaultOwnershipBoundary } from "../../policy/review-boundaries.js";
import {
  buildDefaultWriteScope,
  buildMaintainedWriteScope,
  maintainedProofMetadata,
  recommendedVerificationTargets,
  stableSortedStrings,
  summarizeById,
  workspaceInventory
} from "./shared.js";
import { generateContextBundle } from "./bundle.js";
import { generateContextDiff } from "./diff.js";
import { generateContextSlice } from "./slice.js";

function readAgentAdoptionPlan(graph) {
  const filePath = path.join(graph.root, "candidates", "reconcile", "adoption-plan.agent.json");
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function nextImportAdoptAction(plan) {
  if (!plan) {
    return {
      kind: "missing_plan",
      label: "Run reconcile first",
      reason: "No staged adoption plan exists yet under candidates/reconcile."
    };
  }
  const proposalSurfaces = plan.imported_proposal_surfaces || [];
  const stagedItems = plan.staged_items || [];
  const approvedReviewGroups = plan.approved_review_groups || [];
  const requiresHumanReview = plan.requires_human_review || [];
  const surfaceById = new Map(proposalSurfaces.map((surface) => [surface.id, surface]));
  if ((plan.requires_human_review || []).length > 0) {
    const targetId = requiresHumanReview[0];
    const surface = surfaceById.get(targetId) || null;
    return {
      kind: "review_staged",
      label: "Review staged proposal surfaces",
      reason: `${requiresHumanReview.length} staged proposal(s) still require human review or mapping decisions.`,
      target_id: targetId,
      current_state: surface?.current_state || "stage",
      recommended_state: surface?.recommended_state || null,
      target_review_group: approvedReviewGroups[0] || null
    };
  }
  if (stagedItems.length > 0) {
    const targetId = stagedItems[0];
    const surface = surfaceById.get(targetId) || null;
    return {
      kind: "adopt_staged",
      label: "Adopt staged proposal surfaces",
      reason: `${stagedItems.length} staged proposal(s) are available for explicit adoption.`,
      target_id: targetId,
      current_state: surface?.current_state || "stage",
      recommended_state: surface?.recommended_state || "accept",
      target_review_group: approvedReviewGroups[0] || null
    };
  }
  if (approvedReviewGroups.length > 0) {
    return {
      kind: "inspect_review_group",
      label: "Inspect approved review group",
      reason: `No staged proposal surfaces are waiting, but ${approvedReviewGroups[0]} remains the clearest adoption-review grouping to inspect next.`,
      target_review_group: approvedReviewGroups[0]
    };
  }
  if (proposalSurfaces.length > 0) {
    return {
      kind: "inspect_proposal_surface",
      label: "Inspect proposal surface",
      reason: `No staged adoption action is pending, so inspect ${proposalSurfaces[0].id} before changing canonical Topogram.`,
      target_id: proposalSurfaces[0].id,
      current_state: proposalSurfaces[0].current_state || null,
      recommended_state: proposalSurfaces[0].recommended_state || null
    };
  }
  return {
    kind: "inspect_plan",
    label: "Inspect adoption plan",
    reason: "No staged proposal surfaces are currently waiting, but the plan is still the right source of truth."
  };
}

function nextDiffReviewAction(diff, focus, options = {}) {
  if (!options.fromTopogramPath) {
    return {
      kind: "run_diff",
      label: "Run a semantic diff baseline",
      reason: "Diff-review mode is most useful when comparing the current Topogram against a baseline via --from-topogram."
    };
  }

  const maintainedOutputs = diff.affected_maintained_surfaces?.outputs || [];
  const maintainedSeams = diff.affected_maintained_surfaces?.affected_seams || [];
  const highestMaintainedSeverity = [...maintainedSeams]
    .sort((a, b) => maintainedSeverityRank(b.status) - maintainedSeverityRank(a.status))[0]?.status || null;
  const affectedOutputIds = stableSortedStrings(maintainedOutputs.map((output) => output.output_id).filter(Boolean));
  const maintainedImpactCount = maintainedSeams.length;
  const reviewBoundaryChangeCount = (diff.review_boundary_changes || []).length;
  const generatedImpactCount =
    (diff.affected_generated_surfaces?.capabilities || []).length +
    (diff.affected_generated_surfaces?.projections || []).length +
    (diff.affected_generated_surfaces?.workflows || []).length +
    (diff.affected_generated_surfaces?.journeys || []).length;

  if (reviewBoundaryChangeCount > 0) {
    return {
      kind: "review_boundary_changes",
      label: "Review changed automation boundaries first",
      reason: `${reviewBoundaryChangeCount} review-boundary change(s) alter what can be safely automated or must stay human-reviewed.`
    };
  }

  if (maintainedImpactCount > 0) {
    return {
      kind: "inspect_maintained_impact",
      label: "Inspect maintained-app impact next",
      reason: `${maintainedImpactCount} seam(s) across ${affectedOutputIds.length || maintainedOutputs.length} output(s) are in scope${highestMaintainedSeverity ? `, with highest severity ${highestMaintainedSeverity}` : ""}${affectedOutputIds.length > 0 ? ` (${affectedOutputIds.join(", ")})` : ""}, so human-owned seams should be reviewed before editing or regeneration.`
    };
  }

  if (generatedImpactCount > 0) {
    return {
      kind: "inspect_generated_impact",
      label: "Inspect generated surface impact next",
      reason: `${generatedImpactCount} generated surface(s) are affected; review those deltas before choosing a write path.`
    };
  }

  return {
    kind: "inspect_diff",
    label: "Inspect semantic diff",
    reason: focus ? `Review the semantic diff for ${focus.kind} ${focus.id}.` : "Review the semantic diff before taking action."
  };
}

function nextVerificationAction(verificationTargets, focus) {
  const maintainedChecks = verificationTargets?.maintained_app_checks || [];
  const generatedChecks = verificationTargets?.generated_checks || [];
  const outputVerificationTargets = verificationTargets?.output_verification_targets || [];
  const affectedOutputIds = stableSortedStrings(outputVerificationTargets.map((entry) => entry.output_id).filter(Boolean));
  if (maintainedChecks.length > 0) {
    return {
      kind: "run_maintained_checks",
      label: "Run maintained proof checks",
      reason: focus
        ? `${focus.kind} ${focus.id} touches maintained proof surfaces${affectedOutputIds.length === 1 ? ` in ${affectedOutputIds[0]}` : affectedOutputIds.length > 1 ? ` across ${affectedOutputIds.join(", ")}` : ""}, so start with the maintained-app check set.`
        : `This task touches maintained proof surfaces${affectedOutputIds.length === 1 ? ` in ${affectedOutputIds[0]}` : affectedOutputIds.length > 1 ? ` across ${affectedOutputIds.join(", ")}` : ""}, so start with the maintained-app check set.`
    };
  }
  if (generatedChecks.length > 0) {
    return {
      kind: "run_generated_checks",
      label: "Run generated verification checks",
      reason: `${generatedChecks.join(", ")} is the smallest generated proof set currently attached to this surface.`
    };
  }
  return {
    kind: "inspect_verification_targets",
    label: "Inspect verification targets",
    reason: "No concrete verification checks were attached, so inspect the verification target set before acting."
  };
}

function nextModelingAction(slice, diff, focus, options = {}) {
  if (options.fromTopogramPath && diff) {
    const reviewBoundaryChangeCount = (diff.review_boundary_changes || []).length;
    const maintainedSeams = diff.affected_maintained_surfaces?.affected_seams || [];
    const maintainedOutputs = diff.affected_maintained_surfaces?.outputs || [];
    const maintainedImpactCount = maintainedSeams.length;
    const highestMaintainedSeverity = [...maintainedSeams]
      .sort((a, b) => maintainedSeverityRank(b.status) - maintainedSeverityRank(a.status))[0]?.status || null;
    const affectedOutputIds = stableSortedStrings(maintainedOutputs.map((output) => output.output_id).filter(Boolean));
    if (reviewBoundaryChangeCount > 0) {
      return {
        kind: "review_diff_boundaries",
        label: "Review diff boundary changes first",
        reason: `${reviewBoundaryChangeCount} review-boundary change(s) were detected against the baseline Topogram.`
      };
    }
    if (maintainedImpactCount > 0) {
      return {
        kind: "review_diff_impact",
        label: "Review diff impact before editing",
        reason: `${maintainedImpactCount} seam(s) across ${affectedOutputIds.length || maintainedOutputs.length} output(s) would be affected${highestMaintainedSeverity ? `, with highest severity ${highestMaintainedSeverity}` : ""}${affectedOutputIds.length > 0 ? ` (${affectedOutputIds.join(", ")})` : ""}, so inspect the cross-surface impact before changing canonical Topogram.`
      };
    }
  }

  const automationClass = slice?.review_boundary?.automation_class || null;
  if (automationClass === "manual_decision" || automationClass === "no_go") {
    return {
      kind: "inspect_boundary_before_edit",
      label: "Inspect review boundary before editing",
      reason: focus
        ? `${focus.kind} ${focus.id} is not a routine modeling change; inspect its boundary classification before editing canonical Topogram.`
        : "The selected modeling surface has a non-routine review boundary."
    };
  }

  if (focus) {
    return {
      kind: "edit_canonical_topogram",
      label: "Edit canonical Topogram next",
      reason: `${focus.kind} ${focus.id} has a scoped context and verification target set, so canonical modeling work can proceed deliberately.`
    };
  }

  return {
    kind: "inspect_workspace_digest",
    label: "Inspect workspace digest first",
    reason: "No specific surface was selected, so start from the workspace digest before editing canonical Topogram."
  };
}

function maintainedSeverityRank(status) {
  if (status === "no_go") return 3;
  if (status === "manual_decision") return 2;
  if (status === "review_required") return 1;
  return 0;
}

function selectedSurface(options = {}) {
  if (options.capabilityId) return { kind: "capability", id: options.capabilityId };
  if (options.workflowId) return { kind: "workflow", id: options.workflowId };
  if (options.projectionId) return { kind: "projection", id: options.projectionId };
  if (options.entityId) return { kind: "entity", id: options.entityId };
  if (options.journeyId) return { kind: "journey", id: options.journeyId };
  if (options.surfaceId) return { kind: "surface", id: options.surfaceId };
  return null;
}

function preferredSlice(graph, options = {}) {
  const focus = selectedSurface(options);
  if (!focus) {
    return null;
  }
  return generateContextSlice(graph, options);
}

function modelingMode(graph, options = {}) {
  const focus = selectedSurface(options);
  const slice = preferredSlice(graph, options);
  const inventory = workspaceInventory(graph);
  const diff = options.fromTopogramPath ? generateContextDiff(graph, options) : null;
  return {
    type: "context_task_mode",
    version: 1,
    mode: "modeling",
    summary: {
      focus: "Canonical Topogram meaning changes",
      selected_surface: focus,
      preferred_start: focus ? "context-slice" : "context-digest"
    },
    preferred_context_artifacts: [
      focus ? `${focus.id}.context-slice.json` : "workspace.context-digest.json",
      "context-diff.json"
    ],
    review_emphasis: [
      "entities_and_relations",
      "capabilities",
      "workflows_and_journeys",
      "projection_semantics"
    ],
    write_scope: buildDefaultWriteScope(),
    verification_targets: slice?.verification_targets || recommendedVerificationTargets(graph, [
      ...inventory.capabilities,
      ...inventory.projections
    ], {
      rationale: "Modeling mode should verify the smallest semantic closure touched by the intended Topogram change."
    }),
    ownership_boundary: defaultOwnershipBoundary(),
    next_action: nextModelingAction(slice, diff, focus, options)
  };
}

function maintainedAppEditMode(graph, options = {}) {
  const bundle = generateContextBundle(graph, { taskId: "maintained-app" });
  return {
    type: "context_task_mode",
    version: 1,
    mode: "maintained-app-edit",
    summary: {
      focus: "Human-owned maintained code changes constrained by emitted Topogram artifacts",
      preferred_start: "context-bundle maintained-app"
    },
    preferred_context_artifacts: [
      "context-bundle.maintained-app.json",
      "maintained-boundary.json"
    ],
    review_emphasis: [
      "accepted_vs_guarded_vs_no_go",
      "human_owned_seams",
      "maintained_surface_boundaries"
    ],
    write_scope: buildMaintainedWriteScope(graph, bundle.maintained_boundary?.maintained_files_in_scope || []),
    verification_targets: bundle.verification_targets,
    ownership_boundary: bundle.ownership_boundary
  };
}

function importAdoptMode(graph, options = {}) {
  const existingAgentPlan = readAgentAdoptionPlan(graph);
  const agentPlan = existingAgentPlan || buildAgentAdoptionPlan({
    type: "reconcile_adoption_plan",
    workspace: graph.root,
    approved_review_groups: [],
    items: []
  });
  const proposalSurfaces = agentPlan.imported_proposal_surfaces || [];
  return {
    type: "context_task_mode",
    version: 1,
    mode: "import-adopt",
    summary: {
      focus: "Proposal review and adoption planning",
      preferred_start: "adoption-plan.agent.json",
      staged_item_count: (agentPlan.staged_items || []).length,
      requires_human_review_count: (agentPlan.requires_human_review || []).length,
      plan_present: Boolean(existingAgentPlan)
    },
    preferred_context_artifacts: [
      "candidates/reconcile/adoption-plan.agent.json",
      "workspace.context-digest.json"
    ],
    review_emphasis: [
      "accept_map_customize_stage_reject",
      "mapping_suggestions",
      "review_required_imports"
    ],
    write_scope: {
      safe_to_edit: ["candidates/**"],
      generator_owned: ["artifacts/**", "apps/**"],
      human_owned_review_required: ["topo/**"],
      out_of_bounds: [".git/**", "node_modules/**"]
    },
    verification_targets: {
      verification_ids: [],
      generated_checks: ["reconcile-review"],
      maintained_app_checks: [],
      rationale: "Import/adopt mode should validate proposal state before canonical writes."
    },
    ownership_boundary: defaultOwnershipBoundary(),
    adoption_state_vocabulary: agentPlan.adoption_state_vocabulary,
    next_action: nextImportAdoptAction(existingAgentPlan),
    staged_items: agentPlan.staged_items || [],
    requires_human_review: agentPlan.requires_human_review || [],
    accepted_items: agentPlan.accepted_items || [],
    rejected_items: agentPlan.rejected_items || [],
    approved_review_groups: agentPlan.approved_review_groups || [],
    proposal_surface_count: proposalSurfaces.length,
    proposal_surfaces: proposalSurfaces
  };
}

function diffReviewMode(graph, options = {}) {
  const focus = selectedSurface(options);
  const slice = preferredSlice(graph, options);
  const diff = options.fromTopogramPath ? generateContextDiff(graph, options) : null;
  return {
    type: "context_task_mode",
    version: 1,
    mode: "diff-review",
    summary: {
      focus: "Understand semantic change impact before editing",
      selected_surface: focus,
      preferred_start: options.fromTopogramPath ? "context-diff" : "context-slice"
    },
    preferred_context_artifacts: options.fromTopogramPath
      ? ["context-diff.json", focus ? `${focus.id}.context-slice.json` : "workspace.context-digest.json"]
      : [focus ? `${focus.id}.context-slice.json` : "workspace.context-digest.json"],
    review_emphasis: [
      "affected_generated_surfaces",
      "affected_maintained_surfaces",
      "review_boundary_changes"
    ],
    write_scope: {
      safe_to_edit: [],
      generator_owned: ["artifacts/**", "apps/**"],
      human_owned_review_required: ["topo/**", "examples/maintained/proof-app/**"],
      out_of_bounds: [".git/**", "node_modules/**"]
    },
    verification_targets: slice?.verification_targets || recommendedVerificationTargets(graph, [], {
      rationale: "Diff review mode should stay read-first until the affected verification surface is clear."
    }),
    ownership_boundary: defaultOwnershipBoundary(),
    next_action: nextDiffReviewAction(diff, focus, options)
  };
}

function verificationMode(graph, options = {}) {
  const focus = selectedSurface(options);
  const slice = preferredSlice(graph, options);
  const maintainedFiles = stableSortedStrings(maintainedProofMetadata(graph).flatMap((item) => item.maintainedFiles || []));
  const maintainedBundle = maintainedFiles.length > 0 ? generateContextBundle(graph, { taskId: "maintained-app" }) : null;
  const fallbackVerificationTargets = recommendedVerificationTargets(graph, [], {
    includeMaintainedApp: maintainedFiles.length > 0,
    rationale: "Verification mode should return the smallest relevant proof set for the selected semantic surface."
  });
  const verificationTargets = slice?.verification_targets || {
    ...(maintainedBundle?.verification_targets || fallbackVerificationTargets),
    output_verification_targets: (maintainedBundle?.maintained_boundary?.outputs || []).map((output) => ({
      output_id: output.output_id,
      verification_targets: output.verification_targets || null
    }))
  };
  return {
    type: "context_task_mode",
    version: 1,
    mode: "verification",
    summary: {
      focus: "Run the smallest correct proof set for a known change",
      selected_surface: focus,
      preferred_start: focus ? "context-slice" : "context-report"
    },
    preferred_context_artifacts: [
      focus ? `${focus.id}.context-slice.json` : "context-report.json"
    ],
    review_emphasis: [
      "smallest_correct_check_set",
      "verification_coverage",
      "maintained_proof_gates"
    ],
    write_scope: {
      safe_to_edit: [],
      generator_owned: ["artifacts/**", "apps/**"],
      human_owned_review_required: maintainedFiles.length > 0 ? ["examples/maintained/proof-app/**"] : [],
      out_of_bounds: [".git/**", "node_modules/**"]
    },
    verification_targets: verificationTargets,
    ownership_boundary: defaultOwnershipBoundary(),
    next_action: nextVerificationAction(verificationTargets, focus)
  };
}

export function generateContextTaskMode(graph, options = {}) {
  const mode = String(options.modeId || "").trim();
  if (!mode) {
    throw new Error("context-task-mode requires --mode <modeling|maintained-app-edit|import-adopt|diff-review|verification>");
  }

  if (mode === "modeling") {
    return modelingMode(graph, options);
  }
  if (mode === "maintained-app-edit") {
    return maintainedAppEditMode(graph, options);
  }
  if (mode === "import-adopt") {
    return importAdoptMode(graph, options);
  }
  if (mode === "diff-review") {
    return diffReviewMode(graph, options);
  }
  if (mode === "verification") {
    return verificationMode(graph, options);
  }

  throw new Error(`Unsupported context task mode '${mode}'`);
}
