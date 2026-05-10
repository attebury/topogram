export function formatAuthClaimValueInline(value) {
  return value == null ? "_dynamic_" : `${value}`;
}

export function normalizeReviewGroupSelector(id) {
  const normalized = String(id || "");
  if (normalized.startsWith("projection_review:")) {
    return `projection-review:${normalized.slice("projection_review:".length)}`;
  }
  if (normalized.startsWith("ui_review:")) {
    return `ui-review:${normalized.slice("ui_review:".length)}`;
  }
  if (normalized.startsWith("workflow_review:")) {
    return `workflow-review:${normalized.slice("workflow_review:".length)}`;
  }
  return null;
}

export function buildHintLabel(hintType, hint) {
  if (hintType === "permission") {
    return `permission ${hint.permission}`;
  }
  if (hintType === "claim") {
    return `claim ${hint.claim} = ${formatAuthClaimValueInline(hint.claim_value)}`;
  }
  return `ownership ${hint.ownership} ownership_field ${hint.ownership_field}`;
}

export function flattenHints(candidateModelBundles = []) {
  const hintGroups = [
    {
      collection: "auth_permission_hints",
      hintType: "permission",
      action: "apply_projection_permission_patch"
    },
    {
      collection: "auth_claim_hints",
      hintType: "claim",
      action: "apply_projection_auth_patch"
    },
    {
      collection: "auth_ownership_hints",
      hintType: "ownership",
      action: "apply_projection_ownership_patch"
    }
  ];
  return candidateModelBundles.flatMap((bundle) =>
    hintGroups.flatMap(({ collection, hintType, action }) =>
      (bundle[collection] || []).map((hint) => ({
        bundle: bundle.slug,
        hint_type: hintType,
        hint_label: buildHintLabel(hintType, hint),
        confidence: hint.confidence || null,
        related_capabilities: hint.related_capabilities || [],
        closure_state: hint.closure_state || "unresolved",
        closure_reason: hint.closure_reason || null,
        why_inferred: hint.why_inferred || hint.explanation || null,
        review_guidance: hint.review_guidance || null,
        projection_patch_action: action
      }))
    )
  );
}

export function flattenAuthRoleFollowup(candidateModelBundles = []) {
  return candidateModelBundles.flatMap((bundle) =>
    (bundle.auth_role_guidance || []).map((entry) => ({
      bundle: bundle.slug,
      role_id: entry.role_id,
      confidence: entry.confidence || null,
      followup_action: entry.followup_action || null,
      followup_label: entry.followup_label || null,
      followup_reason: entry.followup_reason || null,
      review_guidance: entry.review_guidance || null,
      related_capabilities: entry.related_capabilities || [],
      related_docs: entry.related_docs || []
    }))
  );
}

export function buildHighRiskBundles(bundlePriorities = []) {
  return (bundlePriorities || [])
    .filter((bundle) => bundle.auth_closure_summary?.status === "high_risk")
    .map((bundle) => ({
      bundle: bundle.bundle,
      auth_closure: bundle.auth_closure_summary || null,
      auth_aging: bundle.auth_aging_summary || null,
      next_review_group: bundle.next_review_groups?.[0]
        ? {
            id: bundle.next_review_groups[0].id,
            type: bundle.next_review_groups[0].type || null,
            reason: bundle.next_review_groups[0].reason || null,
            selector: normalizeReviewGroupSelector(bundle.next_review_groups[0].id)
          }
        : null,
      bundle_review_selector: bundle.recommend_bundle_review_selector || null,
      from_plan_ready: Boolean(bundle.recommend_from_plan)
    }));
}

export function buildBundleReviewSummary(bundle) {
  if (!bundle) {
    return null;
  }
  return {
      bundle: bundle.bundle,
      auth_closure: bundle.auth_closure_summary || null,
      auth_aging: bundle.auth_aging_summary || null,
      next_review_group: bundle.next_review_groups?.[0]
        ? {
            id: bundle.next_review_groups[0].id,
            type: bundle.next_review_groups[0].type || null,
            reason: bundle.next_review_groups[0].reason || null,
            selector: normalizeReviewGroupSelector(bundle.next_review_groups[0].id)
          }
        : null,
      bundle_review_selector: bundle.recommend_bundle_review_selector || null,
      from_plan_ready: Boolean(bundle.recommend_from_plan)
    };
}

export function buildRecommendedSteps({ highRiskBundles, authRoleFollowup, nextBundle }) {
  const priorityBundles = [];
  if (nextBundle?.bundle) {
    priorityBundles.push(nextBundle.bundle);
  }
  for (const bundle of highRiskBundles || []) {
    if (!priorityBundles.includes(bundle.bundle)) {
      priorityBundles.push(bundle.bundle);
    }
  }

  const highRiskMap = new Map((highRiskBundles || []).map((bundle) => [bundle.bundle, bundle]));
  const roleMap = new Map();
  for (const entry of authRoleFollowup || []) {
    if (!roleMap.has(entry.bundle)) {
      roleMap.set(entry.bundle, []);
    }
    roleMap.get(entry.bundle).push(entry);
  }

  const steps = [];
  for (const bundleId of priorityBundles) {
    const bundle = highRiskMap.get(bundleId);
    if (!bundle) {
      continue;
    }
    const nextReviewSelector = bundle.next_review_group?.selector || null;
    if (nextReviewSelector?.startsWith("projection-review:")) {
      steps.push({
        bundle: bundle.bundle,
        action: "review_projection_group",
        selector: nextReviewSelector,
        reason: bundle.next_review_group.reason || "Projection review is still required before auth hints can be adopted safely."
      });
    } else if (bundle.bundle_review_selector) {
      steps.push({
        bundle: bundle.bundle,
        action: "review_bundle",
        selector: bundle.bundle_review_selector,
        reason: bundle.next_review_group?.reason || "Bundle review is the safest next step before promoting auth-sensitive changes."
      });
    }

    for (const entry of roleMap.get(bundle.bundle) || []) {
      if (entry.followup_action === "promote_role") {
        steps.push({
          bundle: bundle.bundle,
          action: "promote_role_first",
          selector: null,
          reason: entry.followup_reason || `Promote role ${entry.role_id} before promoting related auth-sensitive changes.`
        });
      } else if (entry.followup_action === "link_role_to_docs") {
        steps.push({
          bundle: bundle.bundle,
          action: "patch_docs_first",
          selector: null,
          reason: entry.followup_reason || `Patch docs for role ${entry.role_id} before promoting related auth-sensitive changes.`
        });
      }
    }

    if (bundle.from_plan_ready) {
      steps.push({
        bundle: bundle.bundle,
        action: "run_from_plan_write",
        selector: "from-plan",
        reason: "Reviewed auth-sensitive items are ready to promote through from-plan adoption."
      });
    }
  }
  return steps;
}

export function buildAuthHintsQueryPayload(report, adoptionStatus) {
  const candidateModelBundles = report?.candidate_model_bundles || [];
  const bundlePriorities = adoptionStatus?.bundle_priorities || report?.bundle_priorities || [];
  const allHints = flattenHints(candidateModelBundles);
  const authRoleFollowup = flattenAuthRoleFollowup(candidateModelBundles);
  const highRiskBundles = buildHighRiskBundles(bundlePriorities);
  const staleHighRiskBundles = highRiskBundles.filter((bundle) => bundle.auth_aging?.escalationLevel === "stale_high_risk");
  const bundlesWithHints = candidateModelBundles.filter((bundle) =>
    (bundle.auth_permission_hints || []).length > 0 ||
    (bundle.auth_claim_hints || []).length > 0 ||
    (bundle.auth_ownership_hints || []).length > 0
  );

  const hintClosureCounts = allHints.reduce(
    (acc, hint) => {
      if (hint.closure_state === "adopted") {
        acc.adopted += 1;
      } else if (hint.closure_state === "deferred") {
        acc.deferred += 1;
      } else {
        acc.unresolved += 1;
      }
      return acc;
    },
    { adopted: 0, deferred: 0, unresolved: 0 }
  );

  const bundleClosureCounts = candidateModelBundles.reduce(
    (acc, bundle) => {
      const status = bundle.operator_summary?.authClosureSummary?.status || "no_auth_hints";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { no_auth_hints: 0, mostly_closed: 0, partially_closed: 0, high_risk: 0 }
  );

  return {
    type: "auth_hints_query",
    workspace: report?.workspace || adoptionStatus?.workspace || null,
    summary: {
      total_bundles_with_auth_hints: bundlesWithHints.length,
      hint_closure_counts: hintClosureCounts,
      bundle_auth_closure_counts: bundleClosureCounts,
      stale_high_risk_bundle_count: staleHighRiskBundles.length
    },
    high_risk_bundles: highRiskBundles,
    stale_high_risk_bundles: staleHighRiskBundles,
    unresolved_hints: allHints.filter((hint) => hint.closure_state === "unresolved"),
    deferred_hints: allHints.filter((hint) => hint.closure_state === "deferred"),
    adopted_hints: allHints.filter((hint) => hint.closure_state === "adopted"),
    auth_role_followup: authRoleFollowup,
    recommended_steps: buildRecommendedSteps({
      highRiskBundles,
      authRoleFollowup,
      nextBundle: adoptionStatus?.next_bundle || null
    })
  };
}

export function buildProjectionPatchActionsForBundle(hints = []) {
  const actions = new Map();
  for (const hint of hints) {
    const actionId = hint.projection_patch_action;
    if (!actionId) {
      continue;
    }
    if (!actions.has(actionId)) {
      actions.set(actionId, {
        action: actionId,
        hint_types: [],
        hint_labels: []
      });
    }
    const entry = actions.get(actionId);
    if (hint.hint_type && !entry.hint_types.includes(hint.hint_type)) {
      entry.hint_types.push(hint.hint_type);
    }
    if (hint.hint_label && !entry.hint_labels.includes(hint.hint_label)) {
      entry.hint_labels.push(hint.hint_label);
    }
  }
  return [...actions.values()];
}

export function buildBundleRecommendedSteps({ bundle, authRoleFollowup = [] }) {
  if (!bundle) {
    return [];
  }

  const steps = [];
  const nextReviewSelector = bundle.next_review_group?.selector || null;
  if (nextReviewSelector?.startsWith("projection-review:")) {
    steps.push({
      bundle: bundle.bundle,
      action: "review_projection_group",
      selector: nextReviewSelector,
      reason: bundle.next_review_group.reason || "Projection review is still required before auth hints can be adopted safely."
    });
  } else if (bundle.bundle_review_selector) {
    steps.push({
      bundle: bundle.bundle,
      action: "review_bundle",
      selector: bundle.bundle_review_selector,
      reason: bundle.next_review_group?.reason || "Bundle review is the safest next step before promoting auth-sensitive changes."
    });
  }

  for (const entry of authRoleFollowup || []) {
    if (entry.followup_action === "promote_role") {
      steps.push({
        bundle: bundle.bundle,
        action: "promote_role_first",
        selector: null,
        reason: entry.followup_reason || `Promote role ${entry.role_id} before promoting related auth-sensitive changes.`
      });
    } else if (entry.followup_action === "link_role_to_docs") {
      steps.push({
        bundle: bundle.bundle,
        action: "patch_docs_first",
        selector: null,
        reason: entry.followup_reason || `Patch docs for role ${entry.role_id} before promoting related auth-sensitive changes.`
      });
    }
  }

  if (bundle.from_plan_ready) {
    steps.push({
      bundle: bundle.bundle,
      action: "run_from_plan_write",
      selector: "from-plan",
      reason: "Reviewed auth-sensitive items are ready to promote through from-plan adoption."
    });
  }

  return steps;
}

export function buildAuthReviewPacketPayload(report, adoptionStatus, bundleSlug) {
  const candidateModelBundles = report?.candidate_model_bundles || [];
  const bundlePriorities = adoptionStatus?.bundle_priorities || report?.bundle_priorities || [];
  const targetBundle = candidateModelBundles.find((bundle) => bundle.slug === bundleSlug) || null;
  if (!targetBundle) {
    return null;
  }

  const bundlePriority = bundlePriorities.find((bundle) => bundle.bundle === bundleSlug) || null;
  const allBundleHints = flattenHints([targetBundle]);
  const unresolvedHints = allBundleHints.filter((hint) => hint.closure_state === "unresolved");
  const deferredHints = allBundleHints.filter((hint) => hint.closure_state === "deferred");
  const adoptedHints = allBundleHints.filter((hint) => hint.closure_state === "adopted");
  const authRoleFollowup = flattenAuthRoleFollowup([targetBundle]);
  const projectionPatchActions = buildProjectionPatchActionsForBundle([...unresolvedHints, ...deferredHints, ...adoptedHints]);
  const highRiskBundle = buildBundleReviewSummary(bundlePriority) || {
    bundle: bundleSlug,
    auth_closure: targetBundle.operator_summary?.authClosureSummary || null,
    auth_aging: targetBundle.operator_summary?.authAging || null,
    next_review_group: null,
    bundle_review_selector: null,
    from_plan_ready: false
  };

  return {
    type: "auth_review_packet_query",
    workspace: report?.workspace || adoptionStatus?.workspace || null,
    bundle: bundleSlug,
    auth_closure: highRiskBundle.auth_closure,
    auth_aging: highRiskBundle.auth_aging,
    next_review_selector: highRiskBundle.next_review_group?.selector || null,
    bundle_review_selector: highRiskBundle.bundle_review_selector || null,
    from_plan_ready: Boolean(highRiskBundle.from_plan_ready),
    unresolved_hints: unresolvedHints,
    deferred_hints: deferredHints,
    adopted_hints: adoptedHints,
    auth_role_followup: authRoleFollowup,
    projection_patch_actions: projectionPatchActions,
    recommended_steps: buildBundleRecommendedSteps({
      bundle: highRiskBundle,
      authRoleFollowup
    })
  };
}
