import test from "node:test";
import assert from "node:assert/strict";

import { adoptionItemKey } from "../../src/adoption/plan.js";
import {
  buildAdoptionStatusFiles,
  buildAdoptionStatusSummary,
  buildPromotedCanonicalItems,
  renderPromotedCanonicalItemsMarkdown
} from "../../src/adoption/reporting.js";

test("buildPromotedCanonicalItems keeps only selected canonical writes and normalizes paths", () => {
  const planItems = [
    {
      bundle: "issue",
      kind: "journey",
      item: "issue_journey",
      track: "docs",
      source_path: "candidates/reconcile/model/bundles/issue/docs/journeys/issue_journey.md",
      canonical_rel_path: "docs\\journeys\\issue_journey.md",
      suggested_action: "promote_doc"
    },
    {
      bundle: "issue",
      kind: "capability",
      item: "cap_update_issue",
      track: "capabilities",
      source_path: "candidates/reconcile/model/bundles/issue/capabilities/cap_update_issue.tg",
      canonical_rel_path: "capabilities/cap-update-issue.tg",
      suggested_action: "promote_capability"
    },
    {
      bundle: "issue",
      kind: "report",
      item: "ui_issue_detail",
      track: "docs",
      source_path: "candidates/reconcile/model/bundles/issue/docs/reports/ui-issue-detail.md",
      canonical_rel_path: null,
      suggested_action: "apply_doc_metadata_patch"
    }
  ];

  const promoted = buildPromotedCanonicalItems(
    planItems,
    [
      adoptionItemKey(planItems[0]),
      adoptionItemKey(planItems[0]),
      adoptionItemKey(planItems[1]),
      adoptionItemKey(planItems[2])
    ],
    ["docs/journeys/issue_journey.md"],
    "journeys",
    adoptionItemKey,
    []
  );

  assert.deepEqual(promoted, [
    {
      selector: "journeys",
      bundle: "issue",
      item: "issue_journey",
      kind: "journey",
      track: "docs",
      source_path: "candidates/reconcile/model/bundles/issue/docs/journeys/issue_journey.md",
      canonical_rel_path: "docs/journeys/issue_journey.md",
      canonical_path: "topogram/docs/journeys/issue_journey.md",
      suggested_action: "promote_doc",
      change_type: "create"
    }
  ]);
});

test("reporting markdown and adoption status files keep promoted item sections compact", () => {
  const promotedItems = [
    {
      selector: "journeys",
      bundle: "issue",
      item: "issue_journey",
      source_path: "candidates/reconcile/model/bundles/issue/docs/journeys/issue_journey.md",
      canonical_rel_path: "docs/journeys/issue_journey.md",
      change_type: "create"
    }
  ];

  assert.match(
    renderPromotedCanonicalItemsMarkdown(promotedItems),
    /\[issue\] `issue_journey` `candidates\/reconcile\/model\/bundles\/issue\/docs\/journeys\/issue_journey\.md` -> `docs\/journeys\/issue_journey\.md`/
  );
  assert.match(
    renderPromotedCanonicalItemsMarkdown(promotedItems, { includeItemId: false }),
    /\[issue\] `candidates\/reconcile\/model\/bundles\/issue\/docs\/journeys\/issue_journey\.md` -> `docs\/journeys\/issue_journey\.md`/
  );

  const summary = buildAdoptionStatusSummary(
    {
      workspace: "/tmp/workspace",
      bootstrapped_topogram_root: false,
      adoption_plan_path: "candidates/reconcile/adoption-plan.json",
      adopt_selector: "journeys",
      adopt_write_mode: true,
      approved_review_groups: ["projection_review:proj_api"],
      approved_items: ["actor_user"],
      applied_items: ["issue_journey"],
      blocked_items: [],
      promoted_canonical_items: promotedItems,
      bundle_blockers: [],
      bundle_priorities: [{ bundle: "issue", is_complete: false, next_review_groups: [], recommend_bundle_review_selector: null, recommend_from_plan: true }],
      projection_review_groups: [],
      ui_review_groups: [],
      workflow_review_groups: []
    },
    (bundles) => bundles[0]
  );

  const files = buildAdoptionStatusFiles(
    summary,
    (item) => item.recommendation || item.doc_id,
    (item) => item.recommendation || item.doc_id,
    (item) => item.recommendation || item.doc_id
  );

  assert.match(files["candidates/reconcile/adoption-status.json"], /"promoted_canonical_items"/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /## Promoted Canonical Items/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /- Creates: 1/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /docs\/journeys\/issue_journey\.md/);
});

test("preview adoption status renders preview canonical changes and remaining risk", () => {
  const promotedItems = [
    {
      selector: "from-plan",
      bundle: "issue",
      item: "cap_update_issue",
      source_path: "candidates/reconcile/model/bundles/issue/capabilities/cap_update_issue.tg",
      canonical_rel_path: "capabilities/cap-update-issue.tg",
      change_type: "update"
    }
  ];

  const files = buildAdoptionStatusFiles(
    {
      workspace: "/tmp/workspace",
      adoption_plan_path: "candidates/reconcile/adoption-plan.json",
      adopt_selector: "from-plan",
      adopt_write_mode: false,
      approved_review_groups: [],
      approved_item_count: 1,
      applied_item_count: 0,
      blocked_item_count: 2,
      promoted_canonical_items: promotedItems,
      bundle_priorities: [],
      next_bundle: {
        bundle: "article",
        auth_closure_summary: {
          status: "partially_closed",
          label: "partially closed",
          adopted: 0,
          deferred: 1,
          unresolved: 0,
          reason: "Every inferred auth hint has been reviewed, but at least one is still intentionally deferred instead of adopted."
        },
        auth_claim_hints: [
          {
            claim: "reviewer",
            claim_value: "true",
            confidence: "medium",
            closure_state: "deferred",
            closure_reason: "Reviewed but not yet applied."
          }
        ],
        recommended_actor_role_actions: [
          {
            item: "role_reviewer",
            kind: "role",
            confidence: "medium",
            auth_relevant: true,
            followup_action: "link_role_to_docs",
            followup_doc_ids: ["article_review"],
            followup_reason: "Canonical docs already exist."
          }
        ],
        recommended_doc_link_actions: [],
        next_review_groups: [],
        recommend_bundle_review_selector: null,
        recommend_from_plan: false
      },
      preview_followup_guidance: [
        {
          role_id: "role_reviewer",
          action: "link_role_to_docs",
          doc_ids: ["article_review"],
          source: "actor_role_action",
          reason: "Canonical docs already exist."
        }
      ],
      projection_review_groups: [{ projection_id: "proj_api", items: [] }],
      ui_review_groups: [{ projection_id: "proj_ui_web", items: [] }],
      workflow_review_groups: []
    },
    () => "",
    () => "",
    () => ""
  );

  assert.match(files["candidates/reconcile/adoption-status.md"], /## Preview Canonical Changes/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /- Updates: 1/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /## Remaining Risk After Preview/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /## Preview Follow-Up Guidance/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /role `role_reviewer`: patch docs first in `article_review`/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /claim `reviewer` = `true` \(medium\)/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /Closure: deferred/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /Auth closure score: partially closed \(adopted=0, deferred=1, unresolved=0\)/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /Blocked items after selector: 2/);
});

test("adoption status markdown escalates stale high-risk auth bundles", () => {
  const files = buildAdoptionStatusFiles(
    {
      workspace: "/tmp/workspace",
      adoption_plan_path: "candidates/reconcile/adoption-plan.json",
      adopt_selector: null,
      adopt_write_mode: false,
      approved_review_groups: [],
      approved_item_count: 0,
      applied_item_count: 0,
      blocked_item_count: 1,
      promoted_canonical_items: [],
      bundle_priorities: [
        {
          bundle: "article",
          auth_closure_summary: {
            status: "high_risk",
            label: "high risk",
            adopted: 0,
            deferred: 0,
            unresolved: 2,
            reason: "At least one inferred auth hint is still unresolved."
          },
          auth_aging_summary: {
            repeatCount: 2,
            escalationLevel: "stale_high_risk",
            escalationReason: "This bundle has stayed high risk for 2 reconcile runs in a row."
          },
          next_review_groups: [],
          recommend_bundle_review_selector: null,
          recommend_from_plan: false
        }
      ],
      next_bundle: {
        bundle: "article",
        auth_closure_summary: {
          status: "high_risk",
          label: "high risk",
          adopted: 0,
          deferred: 0,
          unresolved: 2,
          reason: "At least one inferred auth hint is still unresolved."
        },
        auth_aging_summary: {
          repeatCount: 2,
          escalationLevel: "stale_high_risk",
          escalationReason: "This bundle has stayed high risk for 2 reconcile runs in a row."
        },
        next_review_groups: [],
        recommend_bundle_review_selector: null,
        recommend_from_plan: false
      },
      projection_review_groups: [],
      ui_review_groups: [],
      workflow_review_groups: []
    },
    () => "",
    () => "",
    () => ""
  );

  assert.match(files["candidates/reconcile/adoption-status.md"], /Auth escalation: escalated \(high-risk runs=2\)/);
  assert.match(files["candidates/reconcile/adoption-status.md"], /Escalation note: This bundle has stayed unresolved and high risk across multiple reconcile runs\./);
  assert.match(files["candidates/reconcile/adoption-status.md"], /auth-aging=stale_high_risk, high-risk-runs=2/);
});

test("adoption status markdown omits promoted section when nothing was promoted", () => {
  const files = buildAdoptionStatusFiles(
    {
      workspace: "/tmp/workspace",
      adoption_plan_path: "candidates/reconcile/adoption-plan.json",
      adopt_selector: null,
      adopt_write_mode: false,
      approved_review_groups: [],
      approved_item_count: 0,
      applied_item_count: 0,
      blocked_item_count: 0,
      promoted_canonical_items: [],
      bundle_priorities: [],
      next_bundle: null,
      projection_review_groups: [],
      ui_review_groups: [],
      workflow_review_groups: []
    },
    () => "",
    () => "",
    () => ""
  );

  assert.doesNotMatch(files["candidates/reconcile/adoption-status.md"], /## Promoted Canonical Items/);
});
