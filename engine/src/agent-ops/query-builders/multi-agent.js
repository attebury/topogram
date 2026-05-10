import { stableSortedStrings } from "./common.js";
import { buildPresetGuidanceSummary } from "./change-risk.js";
import {
  buildAuthHintsQueryPayload,
  buildAuthReviewPacketPayload,
  normalizeReviewGroupSelector
} from "./auth.js";
export function laneRolePriority(role) {
  switch (role) {
    case "bundle_reviewer":
      return 0;
    case "auth_reviewer":
      return 1;
    case "mapping_reviewer":
      return 2;
    case "doc_promoter":
      return 3;
    case "adoption_operator":
      return 4;
    case "verification_runner":
      return 5;
    default:
      return 99;
  }
}

export function canonicalTargetsForProposalSurfaces(proposalSurfaces = []) {
  return stableSortedStrings(
    proposalSurfaces
      .filter((surface) => surface.canonical_rel_path)
      .map((surface) => `topo/${surface.canonical_rel_path}`)
  );
}

export function reviewSelectorsFromImportPlan(importPlan = null) {
  return stableSortedStrings(
    (importPlan?.review_groups || []).map((id) => normalizeReviewGroupSelector(id)).filter(Boolean)
  );
}

export function projectionIdsFromProposalSurfaces(proposalSurfaces = []) {
  return stableSortedStrings(
    proposalSurfaces.flatMap((surface) => (surface.projection_impacts || []).map((impact) => impact.projection_id)).filter(Boolean)
  );
}

export function bundleProposalSurfaces(bundleSlug, importPlan = null) {
  if (!bundleSlug) {
    return [];
  }
  return (importPlan?.proposal_surfaces || []).filter((surface) => String(surface.id || "").includes(`${bundleSlug}:`) || String(surface.id || "").includes(`:${bundleSlug}`) || String(surface.canonical_rel_path || "").includes(`/${bundleSlug}`));
}

export function buildLane({
  lane_id,
  role,
  bundle = null,
  purpose,
  allowed_inputs,
  write_scope,
  owned_targets,
  proof_targets,
  blocking_dependencies = [],
  completion_condition,
  publishes
}) {
  return {
    lane_id,
    role,
    bundle,
    purpose,
    allowed_inputs,
    write_scope,
    owned_targets,
    proof_targets,
    blocking_dependencies,
    completion_condition,
    publishes
  };
}

export function buildBundleReviewerLanes(report, adoptionStatus, importPlan, singleAgentPlan) {
  return (report?.candidate_model_bundles || []).map((bundle) => {
    const bundlePriority = (adoptionStatus?.bundle_priorities || []).find((entry) => entry.bundle === bundle.slug) || null;
    const proposalSurfaces = bundleProposalSurfaces(bundle.slug, importPlan);
    const reviewSelectors = stableSortedStrings([
      bundlePriority?.recommend_bundle_review_selector || null,
      ...(bundlePriority?.next_review_groups || []).map((group) => normalizeReviewGroupSelector(group.id)).filter(Boolean)
    ]);
    return buildLane({
      lane_id: `bundle_reviewer.${bundle.slug}`,
      role: "bundle_reviewer",
      bundle: bundle.slug,
      purpose: "Review one candidate bundle and its proposal state before canonical adoption.",
      allowed_inputs: [
        "candidates/reconcile/report.json",
        "candidates/reconcile/adoption-status.json",
        "candidates/reconcile/adoption-plan.agent.json"
      ],
      write_scope: singleAgentPlan.write_scope,
      owned_targets: {
        bundles: [bundle.slug],
        review_groups: reviewSelectors,
        canonical_targets: canonicalTargetsForProposalSurfaces(proposalSurfaces),
        projection_ids: projectionIdsFromProposalSurfaces(proposalSurfaces)
      },
      proof_targets: singleAgentPlan.proof_targets,
      completion_condition: "Bundle review is complete when its review-oriented proposal surfaces are accepted, deferred, or clearly blocked with reason.",
      publishes: [`handoff:bundle-review.${bundle.slug}`]
    });
  });
}

export function buildAuthReviewerLanes(report, adoptionStatus, importPlan, singleAgentPlan) {
  const hintsQuery = buildAuthHintsQueryPayload(report, adoptionStatus);
  const bundles = new Set([
    ...hintsQuery.unresolved_hints.map((hint) => hint.bundle),
    ...hintsQuery.deferred_hints.map((hint) => hint.bundle)
  ]);
  return [...bundles].sort().map((bundleSlug) => {
    const bundlePacket = buildAuthReviewPacketPayload(report, adoptionStatus, bundleSlug);
    const proposalSurfaces = bundleProposalSurfaces(bundleSlug, importPlan);
    return buildLane({
      lane_id: `auth_reviewer.${bundleSlug}`,
      role: "auth_reviewer",
      bundle: bundleSlug,
      purpose: "Review auth-sensitive hints and follow-up for one bundle before canonical promotion.",
      allowed_inputs: [
        "candidates/reconcile/report.json",
        "candidates/reconcile/adoption-status.json"
      ],
      write_scope: singleAgentPlan.write_scope,
      owned_targets: {
        bundles: [bundleSlug],
        review_groups: stableSortedStrings([bundlePacket?.next_review_selector, bundlePacket?.bundle_review_selector].filter(Boolean)),
        canonical_targets: stableSortedStrings([
          ...canonicalTargetsForProposalSurfaces(proposalSurfaces),
          ...(bundlePacket?.projection_patch_actions || []).map((entry) => `patch:${entry.action}`)
        ]),
        projection_ids: projectionIdsFromProposalSurfaces(proposalSurfaces)
      },
      proof_targets: singleAgentPlan.proof_targets,
      completion_condition: "Auth review is complete when unresolved and deferred auth hints are resolved into adopted, deferred, or blocked outcomes with explicit reasoning.",
      publishes: [`handoff:auth-review.${bundleSlug}`]
    });
  });
}

export function buildMappingReviewerLane(importPlan, singleAgentPlan) {
  const mappingSurfaces = (importPlan?.proposal_surfaces || []).filter((surface) =>
    surface.recommended_state === "map" || surface.recommended_state === "customize" || surface.current_state === "map" || surface.current_state === "customize"
  );
  if (mappingSurfaces.length === 0) {
    return [];
  }
  return [buildLane({
    lane_id: "mapping_reviewer",
    role: "mapping_reviewer",
    purpose: "Resolve proposal surfaces that still need mapping or customization decisions before canonical adoption.",
    allowed_inputs: [
      "candidates/reconcile/adoption-plan.agent.json",
      "candidates/reconcile/report.json"
    ],
    write_scope: singleAgentPlan.write_scope,
    owned_targets: {
      bundles: [],
      review_groups: reviewSelectorsFromImportPlan(importPlan),
      canonical_targets: canonicalTargetsForProposalSurfaces(mappingSurfaces),
      projection_ids: projectionIdsFromProposalSurfaces(mappingSurfaces)
    },
    proof_targets: singleAgentPlan.proof_targets,
    blocking_dependencies: [],
    completion_condition: "All mapping-sensitive proposal surfaces are mapped, customized, deferred, or explicitly rejected.",
    publishes: ["handoff:mapping-review"]
  })];
}

export function buildDocPromoterLane(importPlan, singleAgentPlan) {
  const docSurfaces = (importPlan?.proposal_surfaces || []).filter((surface) => String(surface.canonical_rel_path || "").startsWith("docs/"));
  if (docSurfaces.length === 0) {
    return [];
  }
  return [buildLane({
    lane_id: "doc_promoter",
    role: "doc_promoter",
    purpose: "Review and prepare documentation-oriented proposal surfaces for later adoption.",
    allowed_inputs: [
      "candidates/reconcile/adoption-plan.agent.json",
      "candidates/reconcile/report.json"
    ],
    write_scope: singleAgentPlan.write_scope,
    owned_targets: {
      bundles: [],
      review_groups: reviewSelectorsFromImportPlan(importPlan),
      canonical_targets: canonicalTargetsForProposalSurfaces(docSurfaces),
      projection_ids: projectionIdsFromProposalSurfaces(docSurfaces)
    },
    proof_targets: singleAgentPlan.proof_targets,
    blocking_dependencies: [],
    completion_condition: "Documentation proposal surfaces are reviewed and ready for explicit adoption or deferral.",
    publishes: ["handoff:doc-promotion-review"]
  })];
}

export function buildAdoptionOperatorLane(importPlan, singleAgentPlan) {
  const canonicalTargets = canonicalTargetsForProposalSurfaces(importPlan?.proposal_surfaces || []);
  return buildLane({
    lane_id: "adoption_operator",
    role: "adoption_operator",
    purpose: "Own the single-writer canonical adoption step after review lanes finish.",
    allowed_inputs: [
      "candidates/reconcile/adoption-plan.agent.json",
      "candidates/reconcile/report.json",
      "candidates/reconcile/adoption-status.json"
    ],
    write_scope: singleAgentPlan.write_scope,
    owned_targets: {
      bundles: [],
      review_groups: reviewSelectorsFromImportPlan(importPlan),
      canonical_targets: canonicalTargets,
      projection_ids: projectionIdsFromProposalSurfaces(importPlan?.proposal_surfaces || [])
    },
    proof_targets: singleAgentPlan.proof_targets,
    blocking_dependencies: [],
    completion_condition: "Canonical adoption runs exactly once against the merged reviewed state.",
    publishes: ["handoff:canonical-adoption"]
  });
}

export function buildVerificationRunnerLane(singleAgentPlan) {
  return buildLane({
    lane_id: "verification_runner",
    role: "verification_runner",
    purpose: "Run the proof set against merged canonical state after adoption completes.",
    allowed_inputs: [
      "candidates/reconcile/adoption-status.json",
      "candidates/reconcile/report.json"
    ],
    write_scope: singleAgentPlan.write_scope,
    owned_targets: {
      bundles: [],
      review_groups: [],
      canonical_targets: [],
      projection_ids: []
    },
    proof_targets: singleAgentPlan.proof_targets,
    blocking_dependencies: ["gate.canonical_adoption"],
    completion_condition: "The smallest attached proof set has been run after canonical adoption completes.",
    publishes: ["handoff:verification"]
  });
}

export function targetsOverlap(a = [], b = []) {
  const set = new Set(a || []);
  return (b || []).some((entry) => set.has(entry));
}

export function laneOverlapSummary(laneA, laneB) {
  const reasons = [];
  if (targetsOverlap(laneA.owned_targets?.canonical_targets, laneB.owned_targets?.canonical_targets)) {
    reasons.push("shared_canonical_targets");
  }
  if (targetsOverlap(laneA.owned_targets?.review_groups, laneB.owned_targets?.review_groups)) {
    reasons.push("shared_review_groups");
  }
  if (targetsOverlap(laneA.owned_targets?.projection_ids, laneB.owned_targets?.projection_ids)) {
    reasons.push("shared_projection_ids");
  }
  if (targetsOverlap(laneA.owned_targets?.bundles, laneB.owned_targets?.bundles) &&
      ((laneA.owned_targets?.canonical_targets || []).length > 0 || (laneB.owned_targets?.canonical_targets || []).length > 0)) {
    reasons.push("shared_bundle_scope");
  }
  return reasons;
}

export function buildOverlapRules(lanes = []) {
  const rules = [];
  for (let index = 0; index < lanes.length; index += 1) {
    for (let inner = index + 1; inner < lanes.length; inner += 1) {
      const left = lanes[index];
      const right = lanes[inner];
      const overlapReasons = laneOverlapSummary(left, right);
      if (overlapReasons.length > 0) {
        rules.push({
          rule_id: `${left.lane_id}__${right.lane_id}`,
          lanes: [left.lane_id, right.lane_id],
          overlap_reasons: overlapReasons,
          policy: "serialize",
          reason: "Parallel work must not compete for the same canonical destination or review ownership."
        });
      }
    }
  }
  return rules;
}

export function buildHandoffPackets(lanes = [], overlapRules = []) {
  const overlapMap = new Map();
  for (const rule of overlapRules) {
    for (const laneId of rule.lanes || []) {
      if (!overlapMap.has(laneId)) {
        overlapMap.set(laneId, []);
      }
      overlapMap.get(laneId).push(rule);
    }
  }

  return lanes
    .filter((lane) => lane.role !== "adoption_operator" && lane.role !== "verification_runner")
    .map((lane) => ({
      packet_id: lane.publishes?.[0] || `handoff:${lane.lane_id}`,
      from_lane: lane.lane_id,
      to_lane: "adoption_operator",
      status: "awaiting_review",
      scope: {
        bundle: lane.bundle || null,
        review_groups: lane.owned_targets?.review_groups || []
      },
      decision_summary: {
        completion_condition: lane.completion_condition,
        overlap_constraints: (overlapMap.get(lane.lane_id) || []).map((rule) => rule.rule_id)
      },
      canonical_targets: lane.owned_targets?.canonical_targets || [],
      recommended_next_action: {
        action: lane.role === "auth_reviewer" || lane.role === "bundle_reviewer" || lane.role === "mapping_reviewer" || lane.role === "doc_promoter"
          ? "publish_review_state"
          : "wait",
        selector: (lane.owned_targets?.review_groups || [])[0] || null
      },
      blocking_reasons: lane.blocking_dependencies || [],
      proof_expectations: lane.proof_targets || null
    }));
}

export function buildSerializedGates(lanes = []) {
  const reviewLaneIds = lanes
    .filter((lane) => !["adoption_operator", "verification_runner"].includes(lane.role))
    .map((lane) => lane.lane_id);
  return [
    {
      gate_id: "gate.review_resolution",
      owner_lane: null,
      action: "resolve_review_packets",
      blocks_until: reviewLaneIds,
      reason: "Canonical adoption must wait until review-oriented lanes publish their outcomes."
    },
    {
      gate_id: "gate.canonical_adoption",
      owner_lane: "adoption_operator",
      action: "run_from_plan_write",
      blocks_until: ["gate.review_resolution"],
      reason: "Canonical promotion is a single-writer step."
    },
    {
      gate_id: "gate.post_adoption_proof",
      owner_lane: "verification_runner",
      action: "run_proof_targets",
      blocks_until: ["gate.canonical_adoption"],
      reason: "Proof should run against merged canonical state."
    }
  ];
}

export function buildJoinPoints(lanes = []) {
  const reviewLaneIds = lanes
    .filter((lane) => !["adoption_operator", "verification_runner"].includes(lane.role))
    .map((lane) => lane.lane_id);
  return [
    {
      join_id: "join.review_packets_ready",
      requires: reviewLaneIds,
      then_enables: ["gate.review_resolution"]
    },
    {
      join_id: "join.canonical_state_ready",
      requires: ["gate.canonical_adoption"],
      then_enables: ["gate.post_adoption_proof"]
    },
    {
      join_id: "join.proof_complete",
      requires: ["gate.post_adoption_proof"],
      then_enables: []
    }
  ];
}

export function buildParallelWorkstreams(lanes = [], overlapRules = []) {
  const reviewLanes = lanes.filter((lane) => !["adoption_operator", "verification_runner", "mapping_reviewer", "doc_promoter"].includes(lane.role));
  const blockedPairs = new Set(overlapRules.flatMap((rule) => {
    const [a, b] = rule.lanes || [];
    return [`${a}::${b}`, `${b}::${a}`];
  }));
  const workstreams = [];
  for (const lane of reviewLanes.sort((a, b) => laneRolePriority(a.role) - laneRolePriority(b.role) || String(a.bundle || a.lane_id).localeCompare(String(b.bundle || b.lane_id)))) {
    let placed = false;
    for (const stream of workstreams) {
      const conflicts = stream.lane_ids.some((existingLaneId) => blockedPairs.has(`${lane.lane_id}::${existingLaneId}`));
      if (!conflicts) {
        stream.lane_ids.push(lane.lane_id);
        if (lane.bundle && !stream.bundles.includes(lane.bundle)) {
          stream.bundles.push(lane.bundle);
        }
        placed = true;
        break;
      }
    }
    if (!placed) {
      workstreams.push({
        workstream_id: `parallel.${workstreams.length + 1}`,
        lane_ids: [lane.lane_id],
        bundles: lane.bundle ? [lane.bundle] : [],
        reason: "These review-oriented lanes do not overlap on canonical targets or review ownership."
      });
    }
  }
  return workstreams;
}

export function buildMultiAgentSummary(lanes, parallelWorkstreams, overlapRules, handoffPackets) {
  const laneCounts = lanes.reduce((acc, lane) => {
    acc[lane.role] = (acc[lane.role] || 0) + 1;
    return acc;
  }, {});
  return {
    lane_count: lanes.length,
    role_counts: laneCounts,
    parallel_workstream_count: parallelWorkstreams.length,
    serialized_gate_count: 3,
    overlap_rule_count: overlapRules.length,
    handoff_packet_count: handoffPackets.length
  };
}

export function buildMultiAgentRecommendedSequence(singleAgentPlan, parallelWorkstreams, serializedGates, resolvedWorkflowContext = null) {
  const steps = [
    {
      order: 1,
      action: "read_single_agent_plan",
      reason: "Start from the default single-agent plan before splitting work.",
      source: singleAgentPlan.type
    },
    {
      order: 2,
      action: "dispatch_parallel_review_lanes",
      reason: parallelWorkstreams.length > 0
        ? `Dispatch ${parallelWorkstreams.length} non-overlapping review workstream(s).`
        : "No safe parallel review workstreams were identified; keep review serialized."
    },
    {
      order: 3,
      action: "resolve_review_packets",
      reason: "Wait for review-oriented lanes to publish handoff packets before canonical adoption."
    },
    {
      order: 4,
      action: "run_from_plan_write",
      reason: serializedGates.find((gate) => gate.gate_id === "gate.canonical_adoption")?.reason || "Canonical promotion is a single-writer step."
    },
    {
      order: 5,
      action: "run_proof_targets",
      reason: serializedGates.find((gate) => gate.gate_id === "gate.post_adoption_proof")?.reason || "Proof should run after canonical adoption."
    }
  ];
  if ((resolvedWorkflowContext?.effective_review_policy?.escalate_categories || []).length > 0) {
    steps.splice(2, 0, {
      order: 3,
      action: "apply_resolved_workflow_review_policy",
      reason: `Carry resolved review escalation categories through the lane plan: ${resolvedWorkflowContext.effective_review_policy.escalate_categories.join(", ")}.`
    });
    for (let index = 3; index < steps.length; index += 1) {
      steps[index].order = index + 1;
    }
  }
  return steps;
}

export function laneWorkflowContextOverrides(lane, resolvedWorkflowContext) {
  if (!resolvedWorkflowContext) return null;
  const overrides = {};
  if (JSON.stringify(lane.write_scope || null) !== JSON.stringify(resolvedWorkflowContext.effective_write_scope || null)) {
    overrides.effective_write_scope = lane.write_scope || null;
  }
  if (JSON.stringify(lane.proof_targets || null) !== JSON.stringify(resolvedWorkflowContext.effective_verification_policy || null)) {
    overrides.effective_verification_policy = {
      ...resolvedWorkflowContext.effective_verification_policy,
      lane_proof_targets: lane.proof_targets || null
    };
  }
  return Object.keys(overrides).length > 0 ? overrides : null;
}

export function buildMultiAgentPlanPayload({
  workspace,
  singleAgentPlan,
  importPlan,
  report,
  adoptionStatus,
  resolvedWorkflowContext = null
}) {
  const presetGuidanceSummary = buildPresetGuidanceSummary(importPlan?.workflow_presets || null, resolvedWorkflowContext || singleAgentPlan?.resolved_workflow_context || null);
  const lanes = [
    ...buildBundleReviewerLanes(report, adoptionStatus, importPlan, singleAgentPlan),
    ...buildAuthReviewerLanes(report, adoptionStatus, importPlan, singleAgentPlan),
    ...buildMappingReviewerLane(importPlan, singleAgentPlan),
    ...buildDocPromoterLane(importPlan, singleAgentPlan),
    buildAdoptionOperatorLane(importPlan, singleAgentPlan),
    buildVerificationRunnerLane(singleAgentPlan)
  ].map((lane) => ({
    ...lane,
    workflow_context_overrides: laneWorkflowContextOverrides(lane, resolvedWorkflowContext)
  }));
  const overlapRules = buildOverlapRules(lanes);
  const parallelWorkstreams = buildParallelWorkstreams(lanes, overlapRules);
  const handoffPackets = buildHandoffPackets(lanes, overlapRules);
  const serializedGates = buildSerializedGates(lanes);
  const joinPoints = buildJoinPoints(lanes);
  return {
    type: "multi_agent_plan",
    workspace: workspace || null,
    mode: "import-adopt",
    source_single_agent_plan: singleAgentPlan,
    summary: buildMultiAgentSummary(lanes, parallelWorkstreams, overlapRules, handoffPackets),
    coordination_strategy: {
      model: "artifact_handoff",
      freeform_agent_messaging: "discouraged",
      single_writer_for_canonical: true
    },
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    preset_blockers: presetGuidanceSummary.preset_blockers,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    resolved_workflow_context: resolvedWorkflowContext || singleAgentPlan?.resolved_workflow_context || null,
    lanes,
    parallel_workstreams: parallelWorkstreams,
    serialized_gates: serializedGates,
    join_points: joinPoints,
    overlap_rules: overlapRules,
    handoff_packets: handoffPackets,
    recommended_sequence: buildMultiAgentRecommendedSequence(
      singleAgentPlan,
      parallelWorkstreams,
      serializedGates,
      resolvedWorkflowContext || singleAgentPlan?.resolved_workflow_context || null
    )
  };
}
