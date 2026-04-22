import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBundleAdoptionPriorities,
  buildBundleBlockerSummaries,
  buildProjectionReviewGroups,
  buildUiReviewGroups,
  buildWorkflowReviewGroups,
  selectNextBundle
} from "../../src/adoption/review-groups.js";

function confidenceRank(value) {
  return { low: 0, medium: 1, high: 2 }[value] ?? -1;
}

test("review group builders aggregate dependencies and sort their items", () => {
  const items = [
    {
      bundle: "issue",
      kind: "capability",
      item: "cap_update_issue",
      status: "needs_projection_review",
      blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review", projection_id: "proj_api", kind: "api", platform: "http", reason: "missing capability" }]
    },
    {
      bundle: "issue",
      kind: "screen",
      item: "issue_detail",
      status: "needs_ui_review",
      blocking_dependencies: [{ id: "ui_review:proj_ui_web", type: "ui_review", projection_id: "proj_ui_web", kind: "ui", platform: "ui_web", reason: "missing screen" }]
    },
    {
      bundle: "issue",
      kind: "decision",
      item: "workflow_issue",
      status: "needs_workflow_review",
      blocking_dependencies: [{ id: "workflow_review:issue", type: "workflow_review", reason: "workflow mismatch" }]
    },
    {
      bundle: "account",
      kind: "capability",
      item: "cap_create_account",
      status: "needs_projection_review",
      blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review", projection_id: "proj_api", kind: "api", platform: "http", reason: "missing capability" }]
    }
  ];

  assert.deepEqual(
    buildProjectionReviewGroups(items),
    [
      {
        id: "projection_review:proj_api",
        projection_id: "proj_api",
        kind: "api",
        platform: "http",
        reason: "missing capability",
        items: [
          { bundle: "account", item: "cap_create_account", kind: "capability", status: "needs_projection_review" },
          { bundle: "issue", item: "cap_update_issue", kind: "capability", status: "needs_projection_review" }
        ]
      }
    ]
  );

  assert.deepEqual(buildUiReviewGroups(items), [
    {
      id: "ui_review:proj_ui_web",
      projection_id: "proj_ui_web",
      kind: "ui",
      platform: "ui_web",
      reason: "missing screen",
      items: [{ bundle: "issue", item: "issue_detail", kind: "screen", status: "needs_ui_review" }]
    }
  ]);

  assert.deepEqual(buildWorkflowReviewGroups(items), [
    {
      id: "workflow_review:issue",
      reason: "workflow mismatch",
      items: [{ bundle: "issue", item: "workflow_issue", kind: "decision", status: "needs_workflow_review" }]
    }
  ]);
});

test("bundle blocker summaries keep mixed statuses distinct", () => {
  const summaries = buildBundleBlockerSummaries([
    { bundle: "issue", item: "cap_update_issue", status: "needs_projection_review", blocking_dependencies: [{ id: "projection_review:proj_api" }] },
    { bundle: "issue", item: "cap_list_issues", status: "approved" },
    { bundle: "issue", item: "entity_issue", status: "applied" },
    { bundle: "issue", item: "shape_output_issue", status: "pending" },
    { bundle: "issue", item: "screen_issue_detail", status: "skipped" }
  ]);

  assert.deepEqual(summaries, [
    {
      bundle: "issue",
      pending_items: ["shape_output_issue"],
      approved_items: ["cap_list_issues"],
      applied_items: ["entity_issue"],
      skipped_items: ["screen_issue_detail"],
      blocked_items: ["cap_update_issue"],
      blocking_dependencies: ["projection_review:proj_api"]
    }
  ]);
});

test("bundle priorities and next bundle selection stay stable", () => {
  const report = {
    projection_review_groups: [
      {
        id: "projection_review:proj_api",
        projection_id: "proj_api",
        reason: "missing capability",
        items: [{}, {}]
      }
    ],
    ui_review_groups: [],
    workflow_review_groups: [],
    adoption_plan_items: [
      {
        bundle: "issue",
        kind: "actor",
        item: "actor_user",
        status: "approved",
        confidence: "high",
        recommendation: "promote",
        related_docs: ["issue_resolution_and_closure"],
        related_capabilities: ["cap_update_issue"]
      },
      {
        bundle: "issue",
        kind: "role",
        item: "role_assignee",
        status: "pending",
        confidence: "medium",
        recommendation: "promote"
      }
    ],
    candidate_model_bundles: [
      {
        slug: "issue",
        actors: [{}],
        roles: [{}],
        entities: [{}, {}],
        enums: [],
        capabilities: [{}, {}],
        shapes: [{}],
        screens: [{}],
        workflows: [],
        docs: [{}],
        doc_link_suggestions: [{ doc_id: "issue_resolution_and_closure", recommendation: "update links" }],
        doc_drift_summaries: [],
        doc_metadata_patches: []
      },
      {
        slug: "account",
        actors: [],
        roles: [],
        entities: [{}],
        enums: [],
        capabilities: [{}],
        shapes: [],
        screens: [],
        workflows: [],
        docs: [],
        doc_link_suggestions: [],
        doc_drift_summaries: [],
        doc_metadata_patches: []
      }
    ],
    bundle_blockers: [
      {
        bundle: "issue",
        blocked_items: ["cap_update_issue"],
        approved_items: ["actor_user"],
        applied_items: [],
        pending_items: ["role_assignee"],
        blocking_dependencies: ["projection_review:proj_api"]
      },
      {
        bundle: "account",
        blocked_items: [],
        approved_items: [],
        applied_items: ["entity_account"],
        pending_items: [],
        blocking_dependencies: []
      }
    ]
  };

  const priorities = buildBundleAdoptionPriorities(report, confidenceRank);
  assert.equal(priorities[0].bundle, "issue");
  assert.equal(priorities[0].next_review_groups[0].id, "projection_review:proj_api");
  assert.equal(priorities[0].recommend_bundle_review_selector, "bundle-review:issue");
  assert.equal(priorities[0].recommend_from_plan, false);
  assert.equal(priorities[0].recommended_actor_role_actions[0].item, "actor_user");
  assert.equal(priorities[1].bundle, "account");
  assert.equal(priorities[1].is_complete, true);

  assert.equal(selectNextBundle(priorities)?.bundle, "issue");
  assert.equal(selectNextBundle([{ bundle: "done", is_complete: true }]), null);
});

test("auth-relevant role guidance carries follow-up classification into recommendations", () => {
  const report = {
    projection_review_groups: [],
    ui_review_groups: [],
    workflow_review_groups: [],
    adoption_plan_items: [
      {
        bundle: "article",
        kind: "role",
        item: "role_reviewer",
        status: "approved",
        confidence: "medium",
        recommendation: "promote"
      }
    ],
    candidate_model_bundles: [
      {
        slug: "article",
        actors: [],
        roles: [{}],
        entities: [{}],
        enums: [],
        capabilities: [{}],
        shapes: [],
        screens: [],
        workflows: [],
        docs: [{}],
        auth_role_guidance: [
          {
            role_id: "role_reviewer",
            confidence: "medium",
            followup_action: "link_role_to_docs",
            followup_label: "link role to docs `article_review`",
            followup_reason: "Canonical docs already exist.",
            followup_doc_ids: ["article_review"]
          }
        ],
        doc_link_suggestions: [
          {
            doc_id: "article_review",
            recommendation: "update links",
            auth_role_followups: [
              {
                role_id: "role_reviewer",
                followup_action: "link_role_to_docs",
                followup_label: "link role to docs `article_review`"
              }
            ]
          }
        ],
        doc_drift_summaries: [],
        doc_metadata_patches: []
      }
    ],
    bundle_blockers: [
      {
        bundle: "article",
        blocked_items: [],
        approved_items: ["role_reviewer"],
        applied_items: [],
        pending_items: [],
        blocking_dependencies: []
      }
    ]
  };

  const priorities = buildBundleAdoptionPriorities(report, confidenceRank);
  assert.equal(priorities[0].recommended_actor_role_actions[0].item, "role_reviewer");
  assert.equal(priorities[0].recommended_actor_role_actions[0].followup_action, "link_role_to_docs");
  assert.deepEqual(priorities[0].recommended_actor_role_actions[0].followup_doc_ids, ["article_review"]);
  assert.equal(priorities[0].recommended_doc_link_actions[0].doc_id, "article_review");
  assert.equal(priorities[0].recommended_doc_link_actions[0].auth_role_followups[0].role_id, "role_reviewer");
});

test("high-risk auth bundles are prioritized ahead of lower-risk bundles with similar pressure", () => {
  const report = {
    projection_review_groups: [],
    ui_review_groups: [],
    workflow_review_groups: [],
    adoption_plan_items: [],
    candidate_model_bundles: [
      {
        slug: "article",
        actors: [],
        roles: [],
        entities: [{}],
        enums: [],
        capabilities: [{}],
        shapes: [],
        screens: [],
        workflows: [],
        docs: [],
        operator_summary: {
          authClosureSummary: {
            status: "high_risk",
            label: "high risk",
            adopted: 0,
            deferred: 0,
            unresolved: 2
          }
        },
        doc_link_suggestions: [],
        doc_drift_summaries: [],
        doc_metadata_patches: []
      },
      {
        slug: "task",
        actors: [],
        roles: [],
        entities: [{}],
        enums: [],
        capabilities: [{}],
        shapes: [],
        screens: [],
        workflows: [],
        docs: [],
        operator_summary: {
          authClosureSummary: {
            status: "mostly_closed",
            label: "mostly closed",
            adopted: 1,
            deferred: 0,
            unresolved: 0
          }
        },
        doc_link_suggestions: [],
        doc_drift_summaries: [],
        doc_metadata_patches: []
      }
    ],
    bundle_blockers: [
      {
        bundle: "task",
        blocked_items: [],
        approved_items: [],
        applied_items: [],
        pending_items: ["cap_update_task"],
        blocking_dependencies: []
      },
      {
        bundle: "article",
        blocked_items: [],
        approved_items: [],
        applied_items: [],
        pending_items: ["cap_publish_article"],
        blocking_dependencies: []
      }
    ]
  };

  const priorities = buildBundleAdoptionPriorities(report, confidenceRank);
  assert.equal(priorities[0].bundle, "article");
  assert.equal(priorities[0].auth_closure_summary.status, "high_risk");
  assert.equal(priorities[0].auth_risk_rank, 3);
});
