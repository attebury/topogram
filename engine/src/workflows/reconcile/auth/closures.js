// @ts-check

/** @param {any[]} items @returns {any} */
export function summarizeHintClosureState(items) {
  const statuses = (items || []).map((/** @type {any} */ item) => item.status).filter(Boolean);
  if (statuses.length === 0) {
    return {
      closure_state: "unresolved",
      closure_reason: "No reviewed projection patch has been applied for this inferred auth hint yet."
    };
  }
  if (statuses.every((/** @type {any} */ status) => status === "applied")) {
    return {
      closure_state: "adopted",
      closure_reason: "All matching projection patch actions for this inferred auth hint have been applied."
    };
  }
  if (statuses.every((/** @type {any} */ status) => ["applied", "approved", "skipped"].includes(status))) {
    return {
      closure_state: "deferred",
      closure_reason: "This inferred auth hint has been reviewed or intentionally held back, but not every matching projection patch has been applied yet."
    };
  }
  return {
    closure_state: "unresolved",
    closure_reason: "At least one matching projection patch for this inferred auth hint is still blocked on review or waiting to be applied."
  };
}

/** @param {WorkflowRecord} bundle @param {any[]} planItems @returns {any} */
export function annotateBundleAuthHintClosures(bundle, planItems) {
  const bundleItems = (planItems || []).filter((/** @type {any} */ item) => item.bundle === bundle.slug);
  const annotatedPermissions = (bundle.authPermissionHints || []).map((/** @type {any} */ hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((/** @type {any} */ item) =>
      item.suggested_action === "apply_projection_permission_patch" &&
      item.permission === hint.permission
    ))
  }));
  const annotatedClaims = (bundle.authClaimHints || []).map((/** @type {any} */ hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((/** @type {any} */ item) =>
      item.suggested_action === "apply_projection_auth_patch" &&
      item.claim === hint.claim &&
      item.claim_value === (Object.prototype.hasOwnProperty.call(hint, "claim_value") ? hint.claim_value : null)
    ))
  }));
  const annotatedOwnerships = (bundle.authOwnershipHints || []).map((/** @type {any} */ hint) => ({
    ...hint,
    ...summarizeHintClosureState(bundleItems.filter((/** @type {any} */ item) =>
      item.suggested_action === "apply_projection_ownership_patch" &&
      item.ownership === hint.ownership &&
      item.ownership_field === hint.ownership_field
    ))
  }));
  return {
    ...bundle,
    authPermissionHints: annotatedPermissions,
    authClaimHints: annotatedClaims,
    authOwnershipHints: annotatedOwnerships
  };
}

/** @param {WorkflowRecord} bundle @returns {any} */
export function buildAuthHintClosureSummary(bundle) {
  const hints = [
    ...(bundle.authPermissionHints || []),
    ...(bundle.authClaimHints || []),
    ...(bundle.authOwnershipHints || [])
  ];
  const counts = hints.reduce(
    (/** @type {any} */ acc, /** @type {any} */ hint) => {
      const state = hint.closure_state || "unresolved";
      if (state === "adopted") {
        acc.adopted += 1;
      } else if (state === "deferred") {
        acc.deferred += 1;
      } else {
        acc.unresolved += 1;
      }
      return acc;
    },
    { total: hints.length, adopted: 0, deferred: 0, unresolved: 0 }
  );
  if (counts.total === 0) {
    return {
      status: "no_auth_hints",
      label: "no auth hints",
      reason: "This bundle does not currently carry inferred permission, claim, or ownership hints.",
      ...counts
    };
  }
  if (counts.unresolved === 0 && counts.deferred === 0) {
    return {
      status: "mostly_closed",
      label: "mostly closed",
      reason: "All inferred auth hints for this bundle have been adopted into canonical projection rules.",
      ...counts
    };
  }
  if (counts.unresolved === 0) {
    return {
      status: "partially_closed",
      label: "partially closed",
      reason: "Every inferred auth hint has been reviewed, but at least one is still intentionally deferred instead of adopted.",
      ...counts
    };
  }
  return {
    status: "high_risk",
    label: "high risk",
    reason: "At least one inferred auth hint is still unresolved, so the recovered auth story for this bundle is not closed yet.",
    ...counts
  };
}
