import path from "node:path";

import { stableStringify } from "../format.js";

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function normalizeReportPath(value) {
  return String(value || "").replaceAll("\\", "/").replaceAll(path.sep, "/");
}

function formatClaimValueInline(value) {
  return value == null ? "_dynamic_" : `\`${value}\``;
}

function formatAuthClaimHintInline(hint) {
  return `claim \`${hint.claim}\` = ${formatClaimValueInline(hint.claim_value)} (${hint.confidence})`;
}

function formatAuthPermissionHintInline(hint) {
  return `permission \`${hint.permission}\` (${hint.confidence})`;
}

function formatClosureInline(value) {
  return value || "unresolved";
}

function formatRoleFollowupInline(item) {
  if (!item?.followup_action) {
    return "";
  }
  if (item.followup_action === "link_role_to_docs" && (item.followup_doc_ids || []).length > 0) {
    return ` -> link role to docs ${(item.followup_doc_ids || []).map((entry) => `\`${entry}\``).join(", ")}`;
  }
  if (item.followup_action === "promote_role") {
    return " -> promote role";
  }
  return " -> review only";
}

function formatDocLinkAuthRoleFollowupInline(item) {
  if (!(item?.auth_role_followups || []).length) {
    return "";
  }
  return `\n    - auth role follow-up: ${(item.auth_role_followups || []).map((entry) => `${entry.followup_label} for \`${entry.role_id}\``).join(", ")}`;
}

function previewFollowupRank(action) {
  return {
    promote_role: 0,
    link_role_to_docs: 1,
    review_only: 2
  }[action] ?? 9;
}

function buildPreviewFollowupGuidance(summary) {
  if (!summary?.adopt_selector || summary.adopt_write_mode || !summary?.next_bundle) {
    return [];
  }
  const guidance = [];
  const seenRoles = new Set();
  for (const item of summary.next_bundle.recommended_actor_role_actions || []) {
    if (!item.auth_relevant || !item.followup_action) {
      continue;
    }
    seenRoles.add(item.item);
    guidance.push({
      role_id: item.item,
      action: item.followup_action,
      doc_ids: item.followup_doc_ids || [],
      source: "actor_role_action",
      reason: item.followup_reason || null
    });
  }
  for (const suggestion of summary.next_bundle.recommended_doc_link_actions || []) {
    for (const followup of suggestion.auth_role_followups || []) {
      if (seenRoles.has(followup.role_id)) {
        continue;
      }
      seenRoles.add(followup.role_id);
      guidance.push({
        role_id: followup.role_id,
        action: followup.followup_action,
        doc_ids: [suggestion.doc_id],
        source: "doc_link_action",
        reason: null
      });
    }
  }
  return guidance.sort((a, b) =>
    previewFollowupRank(a.action) - previewFollowupRank(b.action) ||
    a.role_id.localeCompare(b.role_id)
  );
}

export function renderPreviewFollowupMarkdown(summary) {
  const guidance = summary?.preview_followup_guidance || buildPreviewFollowupGuidance(summary);
  if (!(guidance || []).length) {
    return "";
  }
  return (
    "## Preview Follow-Up Guidance\n\n" +
    guidance.map((item) => {
      if (item.action === "promote_role") {
        return `- role \`${item.role_id}\`: promote role first${item.reason ? ` (${item.reason})` : ""}`;
      }
      if (item.action === "link_role_to_docs") {
        return `- role \`${item.role_id}\`: patch docs first${item.doc_ids.length ? ` in ${item.doc_ids.map((entry) => `\`${entry}\``).join(", ")}` : ""}${item.reason ? ` (${item.reason})` : ""}`;
      }
      return `- role \`${item.role_id}\`: review only for now${item.reason ? ` (${item.reason})` : ""}`;
    }).join("\n") +
    "\n\n"
  );
}

function reviewGroupSelector(groupId) {
  const normalized = String(groupId || "");
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

export function buildBundleNextAction(bundle) {
  if (!bundle) {
    return null;
  }
  const nextReviewGroup = bundle.next_review_groups?.[0] || null;
  if (bundle.is_complete) {
    return {
      kind: "complete",
      label: "No action required",
      selector: null,
      reason: "This bundle has no blocked, approved, or pending work left.",
      unlock_review_group_id: null,
      unlock_review_selector: null,
      safe_adopt_now_count: 0
    };
  }
  if (nextReviewGroup) {
    return {
      kind: "review_bundle",
      label: "Review this bundle next",
      selector: bundle.recommend_bundle_review_selector || null,
      reason: nextReviewGroup.reason || `This bundle is blocked by ${nextReviewGroup.type} review.`,
      unlock_review_group_id: nextReviewGroup.id,
      unlock_review_selector: reviewGroupSelector(nextReviewGroup.id),
      safe_adopt_now_count: bundle.approved_items || 0
    };
  }
  if (bundle.recommend_from_plan) {
    return {
      kind: "adopt_from_plan",
      label: "Adopt approved items now",
      selector: "from-plan",
      reason: `${bundle.approved_items || 0} approved item(s) are ready to promote safely.`,
      unlock_review_group_id: null,
      unlock_review_selector: null,
      safe_adopt_now_count: bundle.approved_items || 0
    };
  }
  if ((bundle.pending_items || 0) > 0) {
    return {
      kind: "inspect_pending",
      label: "Inspect pending items",
      selector: null,
      reason: `${bundle.pending_items} pending item(s) remain, but nothing is approved yet.`,
      unlock_review_group_id: null,
      unlock_review_selector: null,
      safe_adopt_now_count: 0
    };
  }
  return {
    kind: "inspect_bundle",
    label: "Inspect bundle state",
    selector: null,
    reason: "This bundle still has unresolved adoption work.",
    unlock_review_group_id: null,
    unlock_review_selector: null,
    safe_adopt_now_count: bundle.approved_items || 0
  };
}

export function annotateBundlePriorities(bundlePriorities) {
  return (bundlePriorities || []).map((bundle) => ({
    ...bundle,
    next_action: buildBundleNextAction(bundle)
  }));
}

export function attachBundleOperatorHints(bundlePriorities, candidateModelBundles) {
  const bundleMap = new Map(
    (candidateModelBundles || []).flatMap((bundle) => [
      [bundle.slug, bundle],
      [bundle.id, bundle]
    ]).filter((entry) => entry[0])
  );
  return (bundlePriorities || []).map((bundle) => {
    const matchedBundle = bundleMap.get(bundle.bundle);
    return {
      ...bundle,
      auth_permission_hints: matchedBundle?.auth_permission_hints || [],
      auth_claim_hints: matchedBundle?.auth_claim_hints || [],
      auth_ownership_hints: matchedBundle?.auth_ownership_hints || [],
      auth_role_guidance: matchedBundle?.auth_role_guidance || [],
      auth_closure_summary: matchedBundle?.operator_summary?.authClosureSummary || null,
      auth_aging_summary: matchedBundle?.operator_summary?.authAging || null,
      operator_summary: matchedBundle?.operator_summary || null
    };
  });
}

export function renderNextBestActionMarkdown(bundle) {
  if (!bundle) {
    return "## Next Best Action\n\n- None\n\n";
  }
  const action = bundle.next_action || buildBundleNextAction(bundle);
  const lines = [
    "## Next Best Action",
    "",
    `- Bundle: \`${bundle.bundle}\``,
    `- Action: ${action.label}`,
    `- Why now: ${action.reason}`,
    `- Selector: ${action.selector ? `\`${action.selector}\`` : "_none_"}`,
    `- Safe to adopt now: ${action.safe_adopt_now_count || 0} approved item(s)`
  ];
  if (action.unlock_review_group_id) {
    lines.push(`- Unlock review group: \`${action.unlock_review_group_id}\``);
  }
  if (action.unlock_review_selector) {
    lines.push(`- Unlock selector: \`${action.unlock_review_selector}\``);
  }
  if ((bundle.auth_permission_hints || []).length > 0) {
    lines.push(`- Permission review: Review ${bundle.auth_permission_hints.length} inferred permission hint(s) before promoting auth-sensitive items from this bundle.`);
    for (const hint of bundle.auth_permission_hints) {
      lines.push(`  - ${formatAuthPermissionHintInline(hint)}`);
      lines.push(`    - Closure: ${formatClosureInline(hint.closure_state)}`);
      if (hint.closure_reason) {
        lines.push(`    - Closure reason: ${hint.closure_reason}`);
      }
      if (hint.why_inferred) {
        lines.push(`    - Why inferred: ${hint.why_inferred}`);
      }
      if (hint.review_guidance) {
        lines.push(`    - Review next: ${hint.review_guidance}`);
      }
    }
  }
  if ((bundle.auth_claim_hints || []).length > 0) {
    lines.push(`- Auth review: Review ${bundle.auth_claim_hints.length} inferred claim hint(s) before promoting auth-sensitive items from this bundle.`);
    for (const hint of bundle.auth_claim_hints) {
      lines.push(`  - ${formatAuthClaimHintInline(hint)}`);
      lines.push(`    - Closure: ${formatClosureInline(hint.closure_state)}`);
      if (hint.closure_reason) {
        lines.push(`    - Closure reason: ${hint.closure_reason}`);
      }
      if (hint.why_inferred) {
        lines.push(`    - Why inferred: ${hint.why_inferred}`);
      }
      if (hint.review_guidance) {
        lines.push(`    - Review next: ${hint.review_guidance}`);
      }
    }
  }
  if ((bundle.auth_ownership_hints || []).length > 0) {
    lines.push(`- Ownership review: Review ${bundle.auth_ownership_hints.length} inferred ownership hint(s) before promoting auth-sensitive items from this bundle.`);
    for (const hint of bundle.auth_ownership_hints) {
      lines.push(`  - ownership \`${hint.ownership}\` field \`${hint.ownership_field}\` (${hint.confidence})`);
      lines.push(`    - Closure: ${formatClosureInline(hint.closure_state)}`);
      if (hint.closure_reason) {
        lines.push(`    - Closure reason: ${hint.closure_reason}`);
      }
      if (hint.why_inferred) {
        lines.push(`    - Why inferred: ${hint.why_inferred}`);
      }
      if (hint.review_guidance) {
        lines.push(`    - Review next: ${hint.review_guidance}`);
      }
    }
  }
  if ((bundle.auth_role_guidance || []).length > 0) {
    lines.push(`- Participant review: Review ${bundle.auth_role_guidance.length} auth-relevant role hint(s) before promoting auth-sensitive participant changes from this bundle.`);
    for (const entry of bundle.auth_role_guidance) {
      lines.push(`  - role \`${entry.role_id}\` (${entry.confidence}) -> ${entry.followup_label}`);
      if (entry.why_inferred) {
        lines.push(`    - Why inferred: ${entry.why_inferred}`);
      }
      if (entry.followup_reason) {
        lines.push(`    - Why this follow-up: ${entry.followup_reason}`);
      }
      if (entry.review_guidance) {
        lines.push(`    - Review next: ${entry.review_guidance}`);
      }
    }
  }
  if (bundle.auth_closure_summary && bundle.auth_closure_summary.status !== "no_auth_hints") {
    lines.push(`- Auth closure score: ${bundle.auth_closure_summary.label} (adopted=${bundle.auth_closure_summary.adopted}, deferred=${bundle.auth_closure_summary.deferred}, unresolved=${bundle.auth_closure_summary.unresolved})`);
    lines.push(`  - Why this score: ${bundle.auth_closure_summary.reason}`);
    if (bundle.auth_closure_summary.status === "high_risk") {
      lines.push("  - Priority note: This bundle should be reviewed ahead of lower-risk bundles with similar adoption pressure.");
    }
  }
  if (bundle.auth_aging_summary && bundle.auth_aging_summary.escalationLevel !== "none") {
    lines.push(`- Auth escalation: ${bundle.auth_aging_summary.escalationLevel === "stale_high_risk" ? "escalated" : "fresh attention"} (high-risk runs=${bundle.auth_aging_summary.repeatCount})`);
    lines.push(`  - Why this escalation: ${bundle.auth_aging_summary.escalationReason}`);
    if (bundle.auth_aging_summary.escalationLevel === "stale_high_risk") {
      lines.push("  - Escalation note: This bundle has stayed unresolved and high risk across multiple reconcile runs.");
    }
  }
  return `${lines.join("\n")}\n\n`;
}

export function renderBundlePriorityActionsMarkdown(bundlePriorities) {
  if (!(bundlePriorities || []).length) {
    return "## Bundle Priorities\n\n- None\n\n";
  }
  return (
    "## Bundle Priorities\n\n" +
    bundlePriorities.map((bundle) => {
      const action = bundle.next_action || buildBundleNextAction(bundle);
      return `- \`${bundle.bundle}\`: action=${action.selector ? `\`${action.selector}\`` : action.kind}, why=${action.reason}, safe-now=${action.safe_adopt_now_count || 0}${(bundle.auth_permission_hints || []).length ? `, permission-hints=${bundle.auth_permission_hints.length}` : ""}${(bundle.auth_claim_hints || []).length ? `, auth-hints=${bundle.auth_claim_hints.length}` : ""}${(bundle.auth_ownership_hints || []).length ? `, ownership-hints=${bundle.auth_ownership_hints.length}` : ""}${bundle.auth_closure_summary && bundle.auth_closure_summary.status !== "no_auth_hints" ? `, auth-closure=${bundle.auth_closure_summary.status}` : ""}${bundle.auth_aging_summary && bundle.auth_aging_summary.escalationLevel !== "none" ? `, auth-aging=${bundle.auth_aging_summary.escalationLevel}, high-risk-runs=${bundle.auth_aging_summary.repeatCount}` : ""}${bundle.auth_risk_rank > 0 ? `, auth-priority=${bundle.auth_risk_rank}` : ""}`;
    }).join("\n") +
    "\n\n"
  );
}

export function buildPromotedCanonicalItems(planItems, selectedItems, writtenCanonicalFiles, selector, adoptionItemKey, refreshedCanonicalFiles = []) {
  const itemMap = new Map((planItems || []).map((item) => [adoptionItemKey(item), item]));
  const writtenSet = new Set((writtenCanonicalFiles || []).map((item) => normalizeReportPath(item)));
  const updatedSet = new Set((refreshedCanonicalFiles || []).map((item) => normalizeReportPath(item)));
  return [...new Set(selectedItems || [])]
    .map((key) => itemMap.get(key))
    .filter(Boolean)
    .filter((item) => item.canonical_rel_path && writtenSet.has(normalizeReportPath(item.canonical_rel_path)))
    .map((item) => ({
      selector: selector || null,
      bundle: item.bundle,
      item: item.item,
      kind: item.kind,
      track: item.track || null,
      source_path: item.source_path || null,
      canonical_rel_path: normalizeReportPath(item.canonical_rel_path),
      canonical_path: item.canonical_path || `topogram/${normalizeReportPath(item.canonical_rel_path)}`,
      suggested_action: item.suggested_action || null,
      change_type: updatedSet.has(normalizeReportPath(item.canonical_rel_path)) ? "update" : "create"
    }))
    .sort((a, b) =>
      (a.bundle || "").localeCompare(b.bundle || "") ||
      (a.track || "").localeCompare(b.track || "") ||
      (a.kind || "").localeCompare(b.kind || "") ||
      (a.item || "").localeCompare(b.item || "")
    );
}

function summarizeCanonicalChangeTypes(items) {
  return (items || []).reduce(
    (acc, item) => {
      if (item.change_type === "update") {
        acc.updates += 1;
      } else {
        acc.creates += 1;
      }
      return acc;
    },
    { creates: 0, updates: 0 }
  );
}

export function renderPromotedCanonicalItemsMarkdown(items, options = {}) {
  if (!(items || []).length) {
    return "";
  }
  const includeItemId = options.includeItemId !== false;
  const includeSummary = options.includeSummary !== false;
  const title = options.title || "## Promoted Canonical Items";
  const counts = summarizeCanonicalChangeTypes(items);
  return (
    `${title}\n\n` +
    `${includeSummary ? `- Creates: ${counts.creates}\n- Updates: ${counts.updates}\n\n` : ""}` +
    items
      .map((item) =>
        includeItemId
          ? `- [${item.bundle}] \`${item.item}\` \`${item.source_path}\` -> \`${item.canonical_rel_path}\` (${item.change_type || "create"})`
          : `- [${item.bundle}] \`${item.source_path}\` -> \`${item.canonical_rel_path}\` (${item.change_type || "create"})`
      )
      .join("\n") +
    "\n\n"
  );
}

export function renderPreviewRiskMarkdown(summary) {
  if (!summary?.adopt_selector || summary.adopt_write_mode) {
    return "";
  }
  return (
    "## Remaining Risk After Preview\n\n" +
    `- Blocked items after selector: ${summary.blocked_item_count}\n` +
    `- Projection review groups still needed: ${summary.projection_review_groups.length}\n` +
    `- UI review groups still needed: ${summary.ui_review_groups.length}\n` +
    `- Workflow review groups still needed: ${summary.workflow_review_groups.length}\n\n`
  );
}

export function buildAdoptionStatusSummary(report, selectNextBundle) {
  const bundlePriorities = annotateBundlePriorities(attachBundleOperatorHints(report.bundle_priorities, report.candidate_model_bundles));
  const nextBundle = selectNextBundle(bundlePriorities);
  const baseSummary = {
    type: "adoption_status",
    workspace: report.workspace,
    bootstrapped_topogram_root: report.bootstrapped_topogram_root,
    adoption_plan_path: report.adoption_plan_path,
    adopt_selector: report.adopt_selector || null,
    adopt_write_mode: Boolean(report.adopt_write_mode),
    approved_review_groups: report.approved_review_groups,
    approved_item_count: report.approved_items.length,
    applied_item_count: report.applied_items.length,
    blocked_item_count: report.blocked_items.length,
    promoted_canonical_items: report.promoted_canonical_items || [],
    bundle_blockers: report.bundle_blockers,
    bundle_priorities: bundlePriorities,
    next_bundle: nextBundle,
    projection_review_groups: report.projection_review_groups,
    ui_review_groups: report.ui_review_groups,
    workflow_review_groups: report.workflow_review_groups
  };
  return {
    ...baseSummary,
    preview_followup_guidance: buildPreviewFollowupGuidance(baseSummary)
  };
}

export function buildAdoptionStatusFiles(summary, formatDocLinkSuggestionInline, formatDocDriftSummaryInline, formatDocMetadataPatchInline) {
  const canonicalChangeTitle = summary.adopt_selector && !summary.adopt_write_mode
    ? "## Preview Canonical Changes"
    : "## Promoted Canonical Items";
  return {
    "candidates/reconcile/adoption-status.json": `${stableStringify(summary)}\n`,
    "candidates/reconcile/adoption-status.md": ensureTrailingNewline(
      `# Adoption Status\n\n` +
      `## Summary\n\n` +
      `- Plan: \`${summary.adoption_plan_path}\`\n` +
      `- Selector: \`${summary.adopt_selector || "none"}\`\n` +
      `- Write mode: ${summary.adopt_write_mode ? "yes" : "no"}\n` +
      `- Approved items: ${summary.approved_item_count}\n` +
      `- Applied items: ${summary.applied_item_count}\n` +
      `- Blocked items: ${summary.blocked_item_count}\n\n` +
      `${renderPromotedCanonicalItemsMarkdown(summary.promoted_canonical_items || [], { includeItemId: false, title: canonicalChangeTitle })}` +
      `${renderPreviewRiskMarkdown(summary)}` +
      `${renderPreviewFollowupMarkdown(summary)}` +
      `${renderNextBestActionMarkdown(summary.next_bundle)}` +
      `${summary.next_bundle ? `## Next Bundle\n\n- \`${summary.next_bundle.bundle}\`\n- Next review: ${summary.next_bundle.next_review_groups.length ? `\`${summary.next_bundle.next_review_groups[0].id}\`` : "_none_"}\n- Bundle review: ${summary.next_bundle.recommend_bundle_review_selector ? `\`${summary.next_bundle.recommend_bundle_review_selector}\`` : "_none_"}\n- Ready for from-plan: ${summary.next_bundle.recommend_from_plan ? "yes" : "no"}${summary.next_bundle.recommended_actor_role_actions?.length ? `\n- Suggested actor/role actions:\n${summary.next_bundle.recommended_actor_role_actions.map((item) => `  - ${item.kind} \`${item.item}\` (${item.confidence})${item.auth_relevant ? " auth-relevant" : ""}${formatRoleFollowupInline(item)}`).join("\n")}` : ""}${summary.next_bundle.recommended_doc_link_actions?.length ? `\n- Suggested doc link updates:\n${summary.next_bundle.recommended_doc_link_actions.map((item) => `  - ${formatDocLinkSuggestionInline(item).replace(/^doc /, "")}${formatDocLinkAuthRoleFollowupInline(item)}`).join("\n")}` : ""}${summary.next_bundle.recommended_doc_drift_actions?.length ? `\n- Suggested doc drift reviews:\n${summary.next_bundle.recommended_doc_drift_actions.map((item) => `  - ${formatDocDriftSummaryInline(item)}`).join("\n")}` : ""}${summary.next_bundle.recommended_doc_metadata_patch_actions?.length ? `\n- Suggested doc metadata patches:\n${summary.next_bundle.recommended_doc_metadata_patch_actions.map((item) => `  - ${formatDocMetadataPatchInline(item)}`).join("\n")}` : ""}\n\n` : "## Next Bundle\n\n- None\n\n"}` +
      `${renderBundlePriorityActionsMarkdown(summary.bundle_priorities)}` +
      `## Approved Review Groups\n\n` +
      `${summary.approved_review_groups.length ? summary.approved_review_groups.map((item) => `- \`${item}\``).join("\n") : "- None"}\n`
    )
  };
}
