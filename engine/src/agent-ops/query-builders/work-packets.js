import { buildPresetGuidanceSummary } from "./change-risk.js";
import { buildAuthReviewPacketPayload } from "./auth.js";
export function handoffTemplateFromLane(lane, mode) {
  if (!lane) return null;
  return {
    packet_id: lane.publishes?.[0] || `handoff:${lane.lane_id}`,
    from_lane: lane.lane_id,
    to_lane: lane.role === "verification_runner" ? null : lane.role === "adoption_operator" ? "verification_runner" : "adoption_operator",
    status: "pending",
    scope: {
      bundle: lane.bundle || null,
      review_groups: lane.owned_targets?.review_groups || []
    },
    decision_summary: {
      completion_condition: lane.completion_condition || null
    },
    canonical_targets: lane.owned_targets?.canonical_targets || [],
    recommended_next_action: {
      action: lane.role === "adoption_operator"
        ? "run_from_plan_write"
        : lane.role === "verification_runner"
          ? "run_proof_targets"
          : "publish_review_state",
      selector: lane.role === "adoption_operator"
        ? "from-plan"
        : (lane.owned_targets?.review_groups || [])[0] || lane.bundle || null
    },
    blocking_reasons: lane.blocking_dependencies || [],
    proof_expectations: lane.proof_targets || null,
    mode
  };
}

export function joinPointsForLane(multiAgentPlan, laneId) {
  return (multiAgentPlan?.join_points || []).filter((joinPoint) =>
    (joinPoint.requires || []).includes(laneId) ||
    (joinPoint.then_enables || []).includes(laneId)
  );
}

export function serializedGatesForLane(multiAgentPlan, laneId) {
  return (multiAgentPlan?.serialized_gates || []).filter((gate) =>
    gate.owner_lane === laneId || (gate.blocks_until || []).includes(laneId)
  );
}

export function overlapRulesForLane(multiAgentPlan, laneId) {
  return (multiAgentPlan?.overlap_rules || []).filter((rule) => (rule.lanes || []).includes(laneId));
}

export function recommendedStepsForLane(multiAgentPlan, lane, publishedHandoffPacket) {
  const resolvedWorkflowContext = multiAgentPlan?.resolved_workflow_context || null;
  const steps = [
    {
      order: 1,
      action: "read_allowed_inputs",
      reason: "Start from the bounded artifacts assigned to this lane before making any recommendation."
    }
  ];

  if ((lane.blocking_dependencies || []).length > 0) {
    steps.push({
      order: steps.length + 1,
      action: "wait_for_dependencies",
      reason: `This lane is blocked until ${lane.blocking_dependencies.join(", ")} is satisfied.`,
      blocking_dependencies: lane.blocking_dependencies
    });
  }

  if (["bundle_reviewer", "auth_reviewer", "mapping_reviewer", "doc_promoter"].includes(lane.role)) {
    if ((resolvedWorkflowContext?.effective_review_policy?.escalate_categories || []).length > 0) {
      steps.push({
        order: steps.length + 1,
        action: "apply_resolved_review_policy",
        reason: `This lane should honor resolved review escalations for ${resolvedWorkflowContext.effective_review_policy.escalate_categories.join(", ")}.`
      });
    }
    steps.push({
      order: steps.length + 1,
      action: "review_scoped_work",
      reason: lane.completion_condition,
      selector: (lane.owned_targets?.review_groups || [])[0] || lane.bundle || null
    });
    steps.push({
      order: steps.length + 1,
      action: "publish_handoff_packet",
      reason: "Publish a structured handoff packet instead of coordinating through freeform messaging.",
      packet_id: publishedHandoffPacket?.packet_id || null
    });
    return steps;
  }

  if (lane.role === "adoption_operator") {
    steps.push({
      order: steps.length + 1,
      action: "collect_review_packets",
      reason: "Wait for review-oriented lanes to publish their handoff packets before canonical adoption."
    });
    steps.push({
      order: steps.length + 1,
      action: "run_from_plan_write",
      reason: "Canonical adoption stays serialized and single-writer.",
      selector: "from-plan"
    });
    steps.push({
      order: steps.length + 1,
      action: "publish_handoff_packet",
      reason: "Publish canonical adoption completion for the verification lane.",
      packet_id: publishedHandoffPacket?.packet_id || null
    });
    return steps;
  }

  if (lane.role === "verification_runner") {
    steps.push({
      order: steps.length + 1,
      action: "apply_resolved_verification_policy",
      reason: "Use the embedded resolved workflow context before running lane proof targets.",
      verification_requirements: resolvedWorkflowContext?.effective_verification_policy || null
    });
    steps.push({
      order: steps.length + 1,
      action: "run_proof_targets",
      reason: "Run the attached proof set only after canonical adoption completes.",
      proof_targets: lane.proof_targets || null
    });
    steps.push({
      order: steps.length + 1,
      action: "publish_handoff_packet",
      reason: "Publish verification completion for auditability.",
      packet_id: publishedHandoffPacket?.packet_id || null
    });
  }

  return steps;
}

export function buildWorkPacketPayload({
  workspace,
  multiAgentPlan,
  laneId
}) {
  const lane = (multiAgentPlan?.lanes || []).find((entry) => entry.lane_id === laneId);
  if (!lane) {
    throw new Error(`Unknown multi-agent lane '${laneId}'.`);
  }
  const publishedHandoffPacket = (multiAgentPlan?.handoff_packets || []).find((packet) => packet.from_lane === laneId)
    || handoffTemplateFromLane(lane, multiAgentPlan?.mode || null);
  const resolvedWorkflowContext = multiAgentPlan?.resolved_workflow_context || null;
  const extractionContext = multiAgentPlan?.extraction_context || resolvedWorkflowContext?.extraction_context || null;
  const presetGuidanceSummary = multiAgentPlan?.preset_guidance_summary || buildPresetGuidanceSummary(null, resolvedWorkflowContext);
  const effectiveWriteScope = lane.workflow_context_overrides?.effective_write_scope || lane.write_scope || resolvedWorkflowContext?.effective_write_scope || null;
  const effectiveVerificationPolicy = lane.workflow_context_overrides?.effective_verification_policy || {
    ...(resolvedWorkflowContext?.effective_verification_policy || {}),
    lane_proof_targets: lane.proof_targets || null
  };
  return {
    type: "work_packet",
    workspace: workspace || null,
    mode: multiAgentPlan?.mode || null,
    lane: {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: lane.bundle || null
    },
    summary: {
      purpose: lane.purpose,
      canonical_writer: lane.role === "adoption_operator",
      review_lane: ["bundle_reviewer", "auth_reviewer", "mapping_reviewer", "doc_promoter"].includes(lane.role),
      completion_condition: lane.completion_condition || null
    },
    allowed_inputs: lane.allowed_inputs || [],
    preset_guidance_summary: presetGuidanceSummary,
    active_preset_ids: presetGuidanceSummary.active_preset_ids,
    recommended_preset_action: presetGuidanceSummary.recommended_preset_action,
    extraction_context: extractionContext,
    write_scope: lane.write_scope || null,
    effective_write_scope: effectiveWriteScope,
    owned_targets: lane.owned_targets || null,
    blocking_dependencies: lane.blocking_dependencies || [],
    proof_targets: lane.proof_targets || null,
    effective_verification_policy: effectiveVerificationPolicy,
    required_handoff_packets: (multiAgentPlan?.handoff_packets || []).filter((packet) => packet.to_lane === laneId),
    published_handoff_packet: publishedHandoffPacket,
    overlap_rules: overlapRulesForLane(multiAgentPlan, laneId),
    serialized_gates: serializedGatesForLane(multiAgentPlan, laneId),
    join_points: joinPointsForLane(multiAgentPlan, laneId),
    recommended_steps: recommendedStepsForLane(multiAgentPlan, lane, publishedHandoffPacket),
    resolved_workflow_context: resolvedWorkflowContext
  };
}

export function authReviewPacketForBundle(report, adoptionStatus, bundleSlug) {
  try {
    return buildAuthReviewPacketPayload(report, adoptionStatus, bundleSlug);
  } catch {
    return null;
  }
}

export function bundlePriorityForBundle(adoptionStatus, bundleSlug) {
  return (adoptionStatus?.bundle_priorities || []).find((entry) => entry.bundle === bundleSlug) || null;
}

export function laneStatusRecord(lane, { multiAgentPlan, report, adoptionStatus }) {
  if (lane.role === "bundle_reviewer") {
    const bundlePriority = bundlePriorityForBundle(adoptionStatus, lane.bundle);
    const complete = !bundlePriority || (
      (bundlePriority.next_review_groups || []).length === 0 &&
      !bundlePriority.recommend_bundle_review_selector
    );
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: lane.bundle || null,
      status: complete ? "complete" : "ready",
      ready_for_handoff: complete,
      blocking_dependencies: [],
      reason: complete
        ? "Bundle review requirements for this bundle appear resolved in the current adoption state."
        : "This bundle still has review-oriented work before canonical adoption."
    };
  }

  if (lane.role === "auth_reviewer") {
    const packet = authReviewPacketForBundle(report, adoptionStatus, lane.bundle);
    const unresolvedCount = (packet?.unresolved_hints || []).length;
    const deferredCount = (packet?.deferred_hints || []).length;
    const roleFollowupCount = (packet?.auth_role_followup || []).length;
    const complete = unresolvedCount === 0 && deferredCount === 0 && roleFollowupCount === 0;
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: lane.bundle || null,
      status: complete ? "complete" : "ready",
      ready_for_handoff: complete,
      blocking_dependencies: [],
      reason: complete
        ? "Auth hints and auth-relevant role follow-up are resolved for this bundle."
        : `This bundle still has ${unresolvedCount + deferredCount + roleFollowupCount} auth-sensitive follow-up item(s).`
    };
  }

  if (lane.role === "mapping_reviewer") {
    const pending = (lane.owned_targets?.canonical_targets || []).length;
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: null,
      status: pending > 0 ? "ready" : "complete",
      ready_for_handoff: pending === 0,
      blocking_dependencies: [],
      reason: pending > 0
        ? "Mapping/customization-sensitive proposal surfaces still need explicit review."
        : "No mapping-sensitive proposal surfaces remain."
    };
  }

  if (lane.role === "doc_promoter") {
    const pending = (lane.owned_targets?.canonical_targets || []).length;
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: null,
      status: pending > 0 ? "ready" : "complete",
      ready_for_handoff: pending === 0,
      blocking_dependencies: [],
      reason: pending > 0
        ? "Documentation-oriented proposal surfaces still need review before promotion."
        : "No documentation promotion work remains."
    };
  }

  const prereqReviewLanes = (multiAgentPlan?.lanes || [])
    .filter((entry) => !["adoption_operator", "verification_runner"].includes(entry.role));
  const reviewStatuses = prereqReviewLanes.map((entry) => laneStatusRecord(entry, { multiAgentPlan, report, adoptionStatus }));
  const incompleteReviewLanes = reviewStatuses.filter((entry) => entry.status !== "complete");

  if (lane.role === "adoption_operator") {
    const complete = !adoptionStatus?.next_bundle;
    if (complete) {
      return {
        lane_id: lane.lane_id,
        role: lane.role,
        bundle: null,
        status: "complete",
        ready_for_handoff: true,
        blocking_dependencies: [],
        reason: "Canonical adoption appears complete in the current adoption state."
      };
    }
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: null,
      status: incompleteReviewLanes.length === 0 ? "ready" : "blocked",
      ready_for_handoff: false,
      blocking_dependencies: incompleteReviewLanes.map((entry) => entry.lane_id),
      reason: incompleteReviewLanes.length === 0
        ? "All review-oriented lanes are resolved, so canonical adoption can proceed."
        : "Canonical adoption remains blocked until review-oriented lanes publish resolved handoff state."
    };
  }

  if (lane.role === "verification_runner") {
    const adoptionLaneStatus = laneStatusRecord(
      (multiAgentPlan?.lanes || []).find((entry) => entry.role === "adoption_operator"),
      { multiAgentPlan, report, adoptionStatus }
    );
    return {
      lane_id: lane.lane_id,
      role: lane.role,
      bundle: null,
      status: adoptionLaneStatus.status === "complete" ? "ready" : "blocked",
      ready_for_handoff: false,
      blocking_dependencies: adoptionLaneStatus.status === "complete" ? [] : ["adoption_operator"],
      reason: adoptionLaneStatus.status === "complete"
        ? "Merged canonical state is ready for proof."
        : "Verification remains blocked until canonical adoption completes."
    };
  }

  return {
    lane_id: lane.lane_id,
    role: lane.role,
    bundle: lane.bundle || null,
    status: "ready",
    ready_for_handoff: false,
    blocking_dependencies: lane.blocking_dependencies || [],
    reason: lane.completion_condition || null
  };
}

export function buildLaneStatusPayload({
  workspace,
  multiAgentPlan,
  report,
  adoptionStatus
}) {
  const lanes = (multiAgentPlan?.lanes || []).map((lane) => laneStatusRecord(lane, {
    multiAgentPlan,
    report,
    adoptionStatus
  }));
  const statusCounts = lanes.reduce((acc, lane) => {
    acc[lane.status] = (acc[lane.status] || 0) + 1;
    return acc;
  }, {});
  const blocked = lanes.filter((lane) => lane.status === "blocked").map((lane) => lane.lane_id);
  const ready = lanes.filter((lane) => lane.status === "ready").map((lane) => lane.lane_id);
  const complete = lanes.filter((lane) => lane.status === "complete").map((lane) => lane.lane_id);
  return {
    type: "lane_status_query",
    workspace: workspace || null,
    mode: multiAgentPlan?.mode || null,
    summary: {
      lane_count: lanes.length,
      status_counts: statusCounts,
      blocked_lanes: blocked,
      ready_lanes: ready,
      complete_lanes: complete
    },
    lanes
  };
}

export function buildHandoffStatusPayload({
  workspace,
  multiAgentPlan,
  report,
  adoptionStatus
}) {
  const laneStatus = buildLaneStatusPayload({
    workspace,
    multiAgentPlan,
    report,
    adoptionStatus
  });
  const statusByLane = new Map(laneStatus.lanes.map((entry) => [entry.lane_id, entry]));
  const handoffs = (multiAgentPlan?.handoff_packets || []).map((packet) => {
    const lane = statusByLane.get(packet.from_lane);
    const status = lane?.status === "complete"
      ? "published"
      : lane?.status === "blocked"
        ? "blocked"
        : "pending";
    return {
      packet_id: packet.packet_id,
      from_lane: packet.from_lane,
      to_lane: packet.to_lane,
      status,
      blocking_dependencies: lane?.blocking_dependencies || [],
      scope: packet.scope || null,
      canonical_targets: packet.canonical_targets || [],
      reason: status === "published"
        ? "The source lane appears resolved in the current artifact-backed status view."
        : status === "blocked"
          ? "The source lane is still blocked, so this handoff cannot be published yet."
          : "The source lane still has review or execution work before publishing this handoff."
    };
  });
  const statusCounts = handoffs.reduce((acc, handoff) => {
    acc[handoff.status] = (acc[handoff.status] || 0) + 1;
    return acc;
  }, {});
  return {
    type: "handoff_status_query",
    workspace: workspace || null,
    mode: multiAgentPlan?.mode || null,
    summary: {
      handoff_count: handoffs.length,
      status_counts: statusCounts,
      published_packets: handoffs.filter((entry) => entry.status === "published").map((entry) => entry.packet_id),
      pending_packets: handoffs.filter((entry) => entry.status === "pending").map((entry) => entry.packet_id),
      blocked_packets: handoffs.filter((entry) => entry.status === "blocked").map((entry) => entry.packet_id)
    },
    handoffs
  };
}
