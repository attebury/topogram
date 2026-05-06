export function buildProjectionReviewGroups(items) {
  const groups = new Map();
  for (const item of items) {
    for (const dependency of item.blocking_dependencies || []) {
      if (dependency.type !== "projection_review") {
        continue;
      }
      if (!groups.has(dependency.id)) {
        groups.set(dependency.id, {
          id: dependency.id,
          projection_id: dependency.projection_id,
          kind: dependency.kind,
          platform: dependency.platform,
          reason: dependency.reason,
          items: []
        });
      }
      groups.get(dependency.id).items.push({
        bundle: item.bundle,
        item: item.item,
        kind: item.kind,
        status: item.status
      });
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) =>
        a.bundle.localeCompare(b.bundle) ||
        a.kind.localeCompare(b.kind) ||
        a.item.localeCompare(b.item)
      )
    }))
    .sort((a, b) => a.projection_id.localeCompare(b.projection_id));
}

export function buildUiReviewGroups(items) {
  const groups = new Map();
  for (const item of items) {
    for (const dependency of item.blocking_dependencies || []) {
      if (dependency.type !== "ui_review") {
        continue;
      }
      if (!groups.has(dependency.id)) {
        groups.set(dependency.id, {
          id: dependency.id,
          projection_id: dependency.projection_id,
          kind: dependency.kind,
          platform: dependency.platform,
          reason: dependency.reason,
          items: []
        });
      }
      groups.get(dependency.id).items.push({ bundle: item.bundle, item: item.item, kind: item.kind, status: item.status });
    }
  }
  return [...groups.values()].sort((a, b) => a.projection_id.localeCompare(b.projection_id));
}

export function buildWorkflowReviewGroups(items) {
  const groups = new Map();
  for (const item of items) {
    for (const dependency of item.blocking_dependencies || []) {
      if (dependency.type !== "workflow_review") {
        continue;
      }
      if (!groups.has(dependency.id)) {
        groups.set(dependency.id, {
          id: dependency.id,
          reason: dependency.reason,
          items: []
        });
      }
      groups.get(dependency.id).items.push({ bundle: item.bundle, item: item.item, kind: item.kind, status: item.status });
    }
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildBundleBlockerSummaries(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.bundle)) {
      groups.set(item.bundle, {
        bundle: item.bundle,
        pending_items: [],
        approved_items: [],
        applied_items: [],
        skipped_items: [],
        blocked_items: [],
        blocking_dependencies: new Set()
      });
    }
    const group = groups.get(item.bundle);
    if (item.status === "pending") {
      group.pending_items.push(item.item);
    } else if (item.status === "approved") {
      group.approved_items.push(item.item);
    } else if (item.status === "applied") {
      group.applied_items.push(item.item);
    } else if (item.status === "skipped") {
      group.skipped_items.push(item.item);
    } else if (["needs_projection_review", "needs_ui_review", "needs_workflow_review"].includes(item.status)) {
      group.blocked_items.push(item.item);
      for (const dependency of item.blocking_dependencies || []) {
        group.blocking_dependencies.add(dependency.id);
      }
    }
  }
  return [...groups.values()]
    .map((group) => ({
      bundle: group.bundle,
      pending_items: group.pending_items.sort(),
      approved_items: group.approved_items.sort(),
      applied_items: group.applied_items.sort(),
      skipped_items: group.skipped_items.sort(),
      blocked_items: group.blocked_items.sort(),
      blocking_dependencies: [...group.blocking_dependencies].sort()
    }))
    .sort((a, b) => a.bundle.localeCompare(b.bundle));
}

function buildReviewGroupLookup(report) {
  const lookup = new Map();
  for (const group of report.projection_review_groups || []) {
    lookup.set(group.id, {
      id: group.id,
      label: group.projection_id,
      type: "projection",
      item_count: (group.items || []).length,
      reason: group.reason
    });
  }
  for (const group of report.ui_review_groups || []) {
    lookup.set(group.id, {
      id: group.id,
      label: group.projection_id,
      type: "ui",
      item_count: (group.items || []).length,
      reason: group.reason
    });
  }
  for (const group of report.workflow_review_groups || []) {
    lookup.set(group.id, {
      id: group.id,
      label: group.id.replace(/^workflow_review:/, ""),
      type: "workflow",
      item_count: (group.items || []).length,
      reason: group.reason
    });
  }
  return lookup;
}

export function buildBundleAdoptionPriorities(report, confidenceRank) {
  const reviewGroupLookup = buildReviewGroupLookup(report);
  const adoptionItemsByBundle = new Map();
  for (const item of report.adoption_plan_items || []) {
    if (!adoptionItemsByBundle.has(item.bundle)) {
      adoptionItemsByBundle.set(item.bundle, []);
    }
    adoptionItemsByBundle.get(item.bundle).push(item);
  }
  const bundleEvidence = new Map(
    (report.candidate_model_bundles || []).map((bundle) => [
      bundle.slug,
      {
        actors: bundle.actors.length,
        roles: bundle.roles.length,
        entities: bundle.entities.length,
        enums: bundle.enums.length,
        capabilities: bundle.capabilities.length,
        shapes: bundle.shapes.length,
        components: bundle.components?.length || 0,
        screens: bundle.screens.length,
        workflows: bundle.workflows.length,
        docs: bundle.docs.length
      }
    ])
  );
  function authClosureRank(summary) {
    return {
      high_risk: 3,
      partially_closed: 2,
      mostly_closed: 1,
      no_auth_hints: 0
    }[summary?.status || "no_auth_hints"] ?? 0;
  }

  return (report.bundle_blockers || [])
    .map((bundle) => {
      const matchedBundle = (report.candidate_model_bundles || [])
        .find((entry) => entry.slug === bundle.bundle);
      const nextReviewGroups = (bundle.blocking_dependencies || [])
        .map((id) => reviewGroupLookup.get(id))
        .filter(Boolean)
        .sort((a, b) => b.item_count - a.item_count || a.id.localeCompare(b.id));
      const evidence = bundleEvidence.get(bundle.bundle) || {
        actors: 0,
        roles: 0,
        entities: 0,
        enums: 0,
        capabilities: 0,
        shapes: 0,
        screens: 0,
        workflows: 0,
        docs: 0
      };
      const evidenceScore =
        evidence.roles * 4 +
        evidence.actors * 3 +
        evidence.entities * 8 +
        evidence.capabilities * 6 +
        evidence.workflows * 5 +
        evidence.shapes * 3 +
        evidence.enums * 2 +
        evidence.screens * 1 +
        evidence.docs * 1;
      const authRoleGuidance = matchedBundle?.auth_role_guidance || [];
      const authRoleIds = new Set(authRoleGuidance.map((entry) => entry.role_id));
      const authRoleGuidanceById = new Map(authRoleGuidance.map((entry) => [entry.role_id, entry]));
      const actorRoleRecommendations = (adoptionItemsByBundle.get(bundle.bundle) || [])
        .filter((item) => ["actor", "role"].includes(item.kind))
        .filter((item) => ["pending", "approved"].includes(item.status))
        .sort((a, b) =>
          Number(authRoleIds.has(b.item)) - Number(authRoleIds.has(a.item)) ||
          confidenceRank(b.confidence || "low") - confidenceRank(a.confidence || "low") ||
          a.kind.localeCompare(b.kind) ||
          a.item.localeCompare(b.item)
        )
        .slice(0, 3)
        .map((item) => {
          const guidance = authRoleGuidanceById.get(item.item);
          return {
          item: item.item,
          kind: item.kind,
          confidence: item.confidence || "low",
          recommendation: item.recommendation || null,
          auth_relevant: authRoleIds.has(item.item),
          followup_action: guidance?.followup_action || null,
          followup_label: guidance?.followup_label || null,
          followup_reason: guidance?.followup_reason || null,
          followup_doc_ids: guidance?.followup_doc_ids || [],
          related_docs: item.related_docs || [],
          related_capabilities: item.related_capabilities || []
          };
        });
      const docLinkRecommendations = matchedBundle?.doc_link_suggestions || [];
      const docDriftRecommendations = (matchedBundle?.doc_drift_summaries || [])
        .slice()
        .sort((a, b) =>
          Number(b.recommendation_type === "possible_canonical_drift") - Number(a.recommendation_type === "possible_canonical_drift") ||
          confidenceRank(b.imported_confidence || "low") - confidenceRank(a.imported_confidence || "low") ||
          b.differing_fields.length - a.differing_fields.length ||
          a.doc_id.localeCompare(b.doc_id)
        );
      const docMetadataPatchRecommendations = (matchedBundle?.doc_metadata_patches || [])
        .slice()
        .sort((a, b) =>
          confidenceRank(b.imported_confidence || "low") - confidenceRank(a.imported_confidence || "low") ||
          a.doc_id.localeCompare(b.doc_id)
        );
      const authClosureSummary = matchedBundle?.operator_summary?.authClosureSummary || null;
      return {
        bundle: bundle.bundle,
        blocked_items: bundle.blocked_items.length,
        approved_items: bundle.approved_items.length,
        applied_items: bundle.applied_items.length,
        pending_items: bundle.pending_items.length,
        is_complete:
          bundle.blocked_items.length === 0 &&
          bundle.pending_items.length === 0 &&
          bundle.approved_items.length === 0,
        auth_closure_summary: authClosureSummary,
        auth_risk_rank: authClosureRank(authClosureSummary),
        evidence_score: evidenceScore,
        evidence,
        recommended_actor_role_actions: actorRoleRecommendations,
        recommended_doc_link_actions: docLinkRecommendations
          .slice()
          .sort((a, b) =>
            (b.auth_role_followups?.length || 0) - (a.auth_role_followups?.length || 0) ||
            a.doc_id.localeCompare(b.doc_id)
          )
          .slice(0, 3),
        recommended_doc_drift_actions: docDriftRecommendations.slice(0, 3),
        recommended_doc_metadata_patch_actions: docMetadataPatchRecommendations.slice(0, 3),
        next_review_groups: nextReviewGroups,
        recommend_bundle_review_selector: nextReviewGroups.length > 0 ? `bundle-review:${bundle.bundle}` : null,
        recommend_from_plan: bundle.blocked_items.length === 0 && (bundle.approved_items.length > 0 || bundle.pending_items.length > 0)
      };
    })
    .sort((a, b) =>
      Number(a.is_complete) - Number(b.is_complete) ||
      (b.next_review_groups.length > 0) - (a.next_review_groups.length > 0) ||
      b.auth_risk_rank - a.auth_risk_rank ||
      Number(a.applied_items > 0 && a.pending_items === 0 && a.approved_items === 0) - Number(b.applied_items > 0 && b.pending_items === 0 && b.approved_items === 0) ||
      b.evidence_score - a.evidence_score ||
      b.blocked_items - a.blocked_items ||
      b.pending_items - a.pending_items ||
      b.approved_items - a.approved_items ||
      a.bundle.localeCompare(b.bundle)
    );
}

export function selectNextBundle(bundlePriorities) {
  const priorities = bundlePriorities || [];
  return (
    priorities.find((bundle) => !bundle.is_complete && (bundle.pending_items > 0 || bundle.approved_items > 0 || bundle.applied_items === 0)) ||
    priorities.find((bundle) => !bundle.is_complete) ||
    null
  );
}
