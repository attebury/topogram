export const REVIEW_AUTOMATION_CLASSES = Object.freeze([
  "safe",
  "review_required",
  "manual_decision",
  "no_go"
]);

export const ADOPTION_STATE_VOCABULARY = Object.freeze([
  "accept",
  "map",
  "customize",
  "stage",
  "reject"
]);

function buildReviewBoundary(automationClass, reasons = [], extras = {}) {
  return {
    automation_class: automationClass,
    reasons: [...new Set((reasons || []).filter(Boolean))].sort(),
    ...extras
  };
}

export function defaultOwnershipBoundary() {
  return {
    canonical_topogram: {
      owner: "human",
      agent_mode: "propose_review_adopt"
    },
    generated_artifacts: {
      owner: "engine",
      agent_mode: "regenerate_or_compare"
    },
    maintained_code: {
      owner: "human",
      agent_mode: "bounded_edit_only"
    },
    proposal_surfaces: {
      owner: "human",
      agent_mode: "stage_map_customize_reject"
    }
  };
}

export function reviewBoundaryForCapability(capability) {
  if ((capability.creates || []).length > 0 || (capability.updates || []).length > 0 || (capability.deletes || []).length > 0) {
    return buildReviewBoundary("review_required", ["writes_modeled_state"]);
  }

  return buildReviewBoundary("safe", ["read_only_surface"]);
}

export function reviewBoundaryForProjection(projection) {
  if ((projection.uiScreens || []).length > 0 || (projection.uiActions || []).length > 0) {
    return buildReviewBoundary("manual_decision", ["ui_surface"]);
  }

  if ((projection.dbTables || []).length > 0 || (projection.dbColumns || []).length > 0 || (projection.dbRelations || []).length > 0) {
    return buildReviewBoundary("review_required", ["db_surface"]);
  }

  if ((projection.http || []).length > 0) {
    return buildReviewBoundary("review_required", ["api_surface"]);
  }

  return buildReviewBoundary("safe", ["metadata_only"]);
}

export function reviewBoundaryForEntity(entity) {
  if ((entity.relations || []).length > 0) {
    return buildReviewBoundary("manual_decision", ["relation_surface"]);
  }

  return buildReviewBoundary("review_required", ["schema_surface"]);
}

export function reviewBoundaryForWorkflowDoc(workflow) {
  return workflow.reviewRequired
    ? buildReviewBoundary("manual_decision", ["doc_review_required"])
    : buildReviewBoundary("review_required", ["workflow_semantics"]);
}

export function reviewBoundaryForJourneyDoc(journey) {
  return journey.reviewRequired
    ? buildReviewBoundary("manual_decision", ["journey_review_required"])
    : buildReviewBoundary("review_required", ["journey_surface"]);
}

export function reviewBoundaryForMaintainedClassification(classification) {
  if (classification === "accepted_change") {
    return buildReviewBoundary("review_required", ["maintained_surface", "accepted_change"]);
  }
  if (classification === "guarded_manual_decision") {
    return buildReviewBoundary("manual_decision", ["maintained_surface", "product_judgment_required"]);
  }
  if (classification === "no_go") {
    return buildReviewBoundary("no_go", ["maintained_surface", "unsafe_semantic_drift"]);
  }
  if (classification === "independent_review") {
    return buildReviewBoundary("review_required", ["independent_review_artifact"]);
  }
  return buildReviewBoundary("review_required", ["maintained_surface"]);
}

export function reviewBoundaryForImportProposal(item) {
  if ((item.blocking_dependencies || []).length > 0) {
    return buildReviewBoundary("manual_decision", ["proposal_has_blocking_dependencies"]);
  }
  if ((item.projection_impacts || []).length > 0 || (item.ui_impacts || []).length > 0 || (item.workflow_impacts || []).length > 0) {
    return buildReviewBoundary("manual_decision", ["proposal_impacts_existing_surface"]);
  }
  if (item.track === "docs") {
    return buildReviewBoundary("review_required", ["proposal_doc_surface"]);
  }
  if (item.kind === "entity" || item.kind === "shape" || item.kind === "capability") {
    return buildReviewBoundary("review_required", ["proposal_modeled_surface"]);
  }
  return buildReviewBoundary("safe", ["proposal_metadata_only"]);
}

export function ownershipBoundaryForMaintainedSurface() {
  const ownership = defaultOwnershipBoundary();
  return {
    ...ownership,
    maintained_code: {
      owner: "human",
      agent_mode: "explicit_boundary_required"
    }
  };
}
