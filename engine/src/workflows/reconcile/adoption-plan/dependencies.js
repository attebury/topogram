// @ts-check

/** @param {WorkflowRecord} step @param {any[]} projectionImpacts @param {any[]} uiImpacts @param {any[]} workflowImpacts @returns {any} */
export function adoptionStatusForStep(step, projectionImpacts = [], uiImpacts = [], workflowImpacts = []) {
  if (step.action === "skip_duplicate_shape") {
    return "skipped";
  }
  if (step.action === "apply_projection_permission_patch") {
    return "needs_projection_review";
  }
  if (step.action === "apply_projection_auth_patch") {
    return "needs_projection_review";
  }
  if (step.action === "apply_projection_ownership_patch") {
    return "needs_projection_review";
  }
  if (step.action.includes("capability") && projectionImpacts.length > 0) {
    return "needs_projection_review";
  }
  if (step.action.includes("ui_") && uiImpacts.length > 0) {
    return "needs_ui_review";
  }
  if (step.action.includes("workflow") && workflowImpacts.length > 0) {
    return "needs_workflow_review";
  }
  return "pending";
}

/** @param {CandidateBundle} bundle @param {WorkflowRecord} step @returns {any} */
export function projectionImpactsForAdoptionItem(bundle, step) {
  if (!step.action.includes("capability")) {
    return [];
  }
  return (bundle.projectionImpacts || [])
    .filter((/** @type {any} */ impact) => (impact.missing_capabilities || []).includes(step.item))
    .map((/** @type {any} */ impact) => ({
      projection_id: impact.projection_id,
      kind: impact.kind,
      projection_type: impact.projection_type,
      reason: impact.reason
    }));
}

/** @param {any[]} projectionImpacts @returns {any} */
export function blockingDependenciesForProjectionImpacts(projectionImpacts) {
  return projectionImpacts.map((/** @type {any} */ impact) => ({
    type: "projection_review",
    id: `projection_review:${impact.projection_id}`,
    projection_id: impact.projection_id,
    kind: impact.kind,
    projection_type: impact.projection_type,
    reason: impact.reason
  }));
}

/** @param {any[]} uiImpacts @returns {any} */
export function blockingDependenciesForUiImpacts(uiImpacts) {
  return uiImpacts.map((/** @type {any} */ impact) => ({
    type: "ui_review",
    id: `ui_review:${impact.projection_id}`,
    projection_id: impact.projection_id,
    kind: impact.kind,
    projection_type: impact.projection_type,
    reason: impact.reason
  }));
}

/** @param {any[]} workflowImpacts @returns {any} */
export function blockingDependenciesForWorkflowImpacts(workflowImpacts) {
  return workflowImpacts.map((/** @type {any} */ impact) => ({
    type: "workflow_review",
    id: impact.review_group_id,
    reason: impact.reason
  }));
}
