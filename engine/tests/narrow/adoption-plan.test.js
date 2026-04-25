import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  adoptionItemKey,
  applyAdoptionSelector,
  buildAgentAdoptionPlan,
  mergeAdoptionPlanState,
  parseAdoptSelector,
  refreshDerivedStatuses,
  selectorMatchesItem,
  summarizeAdoptionPlanItems
} from "../../src/adoption/plan.js";

function loadJsonFixture(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

test("parseAdoptSelector accepts supported selectors and rejects unsupported ones", () => {
  assert.equal(parseAdoptSelector("journeys"), "journeys");
  assert.equal(parseAdoptSelector("docs"), "docs");
  assert.equal(parseAdoptSelector("workflow-review:issue"), "workflow-review:issue");
  assert.equal(parseAdoptSelector("projection-review:proj_api"), "projection-review:proj_api");
  assert.equal(parseAdoptSelector("bundle-review:issue"), "bundle-review:issue");
  assert.equal(parseAdoptSelector("bundle:issue"), "bundle:issue");
  assert.equal(parseAdoptSelector(" from-plan "), "from-plan");
  assert.equal(parseAdoptSelector(null), null);
  assert.throws(() => parseAdoptSelector("not-a-selector"), /Unsupported adopt selector/);
});

test("selectorMatchesItem covers journeys docs workflows review groups and bundles", () => {
  const item = {
    bundle: "issue",
    kind: "decision",
    item: "issue_journey",
    track: "docs",
    canonical_rel_path: "docs/journeys/issue_journey.md",
    blocking_dependencies: [
      { id: "projection_review:proj_api", type: "projection_review" },
      { id: "workflow_review:issue", type: "workflow_review" }
    ]
  };

  assert.equal(selectorMatchesItem("journeys", item), true);
  assert.equal(selectorMatchesItem("docs", item), true);
  assert.equal(selectorMatchesItem("workflows", item), true);
  assert.equal(selectorMatchesItem("projection-review:proj_api", item), true);
  assert.equal(selectorMatchesItem("workflow-review:issue", item), true);
  assert.equal(selectorMatchesItem("bundle-review:issue", item), true);
  assert.equal(selectorMatchesItem("bundle:issue", item), true);
  assert.equal(selectorMatchesItem("actors", item), false);
});

test("refreshDerivedStatuses preserves terminal states and derives blocked and approved items", () => {
  const refreshed = refreshDerivedStatuses([
    {
      bundle: "issue",
      kind: "capability",
      item: "cap_get_issue",
      status: "pending",
      blocking_dependencies: []
    },
    {
      bundle: "issue",
      kind: "capability",
      item: "cap_update_issue",
      status: "pending",
      projection_impacts: [{ projection_id: "proj_api" }],
      blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
    },
    {
      bundle: "issue",
      kind: "capability",
      item: "cap_patch_issue",
      status: "pending",
      blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }],
      projection_impacts: [{ projection_id: "proj_api" }]
    },
    {
      bundle: "issue",
      kind: "shape",
      item: "shape_output_issue",
      status: "pending",
      blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
    },
    {
      bundle: "issue",
      kind: "shape",
      item: "shape_applied",
      status: "applied"
    },
    {
      bundle: "issue",
      kind: "shape",
      item: "shape_skipped",
      status: "skipped"
    }
  ], ["projection_review:proj_api"]);

  assert.equal(refreshed.find((item) => item.item === "cap_get_issue").status, "pending");
  assert.equal(refreshed.find((item) => item.item === "cap_update_issue").status, "approved");
  assert.equal(refreshed.find((item) => item.item === "cap_patch_issue").status, "approved");
  assert.equal(refreshed.find((item) => item.item === "shape_output_issue").status, "approved");
  assert.equal(refreshed.find((item) => item.item === "shape_applied").status, "applied");
  assert.equal(refreshed.find((item) => item.item === "shape_skipped").status, "skipped");
});

test("refreshDerivedStatuses keeps blocked review items blocked until their review group is approved", () => {
  const refreshed = refreshDerivedStatuses([
    {
      bundle: "issue",
      kind: "capability",
      item: "cap_update_issue",
      status: "pending",
      projection_impacts: [{ projection_id: "proj_api" }],
      blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
    }
  ], []);

  assert.equal(refreshed[0].status, "needs_projection_review");
});

test("applyAdoptionSelector from-plan expands dependent shapes and summarizes results", () => {
  const capability = {
    bundle: "issue",
    kind: "capability",
    item: "cap_list_issues",
    status: "approved",
    blocking_dependencies: []
  };
  const shape = {
    bundle: "issue",
    kind: "shape",
    item: "shape_output_issue",
    status: "pending",
    blocking_dependencies: []
  };
  const skipped = {
    bundle: "account",
    kind: "shape",
    item: "shape_skipped",
    status: "skipped",
    blocking_dependencies: []
  };

  const result = applyAdoptionSelector({
    approved_review_groups: [],
    items: [capability, shape, skipped]
  }, "from-plan", false);

  assert.deepEqual(
    result.selectedItems.sort(),
    [adoptionItemKey(capability), adoptionItemKey(shape)].sort()
  );
  assert.deepEqual(result.appliedItems.sort(), ["cap_list_issues", "shape_output_issue"]);
  assert.deepEqual(result.skippedItems, ["shape_skipped"]);
  assert.deepEqual(
    summarizeAdoptionPlanItems([
      { item: "cap_list_issues", status: "approved" },
      { item: "shape_output_issue", status: "applied" },
      { item: "shape_skipped", status: "skipped" },
      { item: "cap_update_issue", status: "needs_projection_review" }
    ]),
    {
      approved_items: ["cap_list_issues"],
      applied_items: ["shape_output_issue"],
      skipped_items: ["shape_skipped"],
      blocked_items: ["cap_update_issue"]
    }
  );
});

test("applyAdoptionSelector from-plan also adopts pending items with no blockers", () => {
  const capability = {
    bundle: "account",
    kind: "capability",
    item: "cap_create_account",
    status: "pending",
    blocking_dependencies: []
  };
  const entity = {
    bundle: "account",
    kind: "entity",
    item: "entity_account",
    status: "pending",
    blocking_dependencies: []
  };
  const blocked = {
    bundle: "account",
    kind: "capability",
    item: "cap_update_account",
    status: "needs_projection_review",
    blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
  };

  const result = applyAdoptionSelector({
    approved_review_groups: [],
    items: [capability, entity, blocked]
  }, "from-plan", false);

  assert.deepEqual(
    result.selectedItems.sort(),
    [adoptionItemKey(capability), adoptionItemKey(entity)].sort()
  );
  assert.deepEqual(result.appliedItems.sort(), ["cap_create_account", "entity_account"]);
  assert.deepEqual(result.blockedItems, ["cap_update_account"]);
});

test("applyAdoptionSelector previews review-group approvals without requiring write mode", () => {
  const result = applyAdoptionSelector({
    approved_review_groups: [],
    items: [
      {
        bundle: "issue",
        kind: "capability",
        item: "cap_update_issue",
        status: "needs_projection_review",
        projection_impacts: [{ projection_id: "proj_api" }],
        blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
      }
    ]
  }, "projection-review:proj_api", false);

  assert.deepEqual(result.plan.approved_review_groups, ["projection_review:proj_api"]);
  assert.equal(result.plan.items[0].status, "approved");
  assert.deepEqual(result.approvedItems, ["cap_update_issue"]);
});

test("buildAgentAdoptionPlan uses stage for non-canonical proposal state", () => {
  const agentPlan = buildAgentAdoptionPlan({
    type: "reconcile_adoption_plan",
    workspace: "/tmp/example",
    approved_review_groups: [],
    items: [
      {
        bundle: "issue",
        kind: "capability",
        item: "cap_update_issue",
        status: "pending",
        track: "model",
        source_path: "candidates/imported/cap-update-issue.tg",
        canonical_rel_path: "capabilities/cap-update-issue.tg",
        blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
      },
      {
        bundle: "issue",
        kind: "shape",
        item: "shape_issue",
        status: "applied",
        track: "model",
        source_path: "candidates/imported/shape-issue.tg",
        canonical_rel_path: "shapes/shape-issue.tg",
        blocking_dependencies: []
      },
      {
        bundle: "issue",
        kind: "journey",
        item: "issue_journey",
        status: "skipped",
        track: "docs",
        source_path: "candidates/imported/issue-journey.md",
        canonical_rel_path: "docs/journeys/issue-journey.md",
        blocking_dependencies: []
      }
    ]
  });

  assert.deepEqual(agentPlan.adoption_state_vocabulary, ["accept", "map", "customize", "stage", "reject"]);
  assert.deepEqual(agentPlan.staged_items, ["issue:capability:cap_update_issue"]);
  assert.deepEqual(agentPlan.accepted_items, ["issue:shape:shape_issue"]);
  assert.deepEqual(agentPlan.rejected_items, ["issue:journey:issue_journey"]);
  assert.equal(agentPlan.imported_proposal_surfaces[0].current_state, "stage");
  assert.equal(agentPlan.imported_proposal_surfaces[0].human_review_required, true);
});

test("buildAgentAdoptionPlan infers maintained seam candidates from proposal dependencies", () => {
  const agentPlan = buildAgentAdoptionPlan({
    type: "reconcile_adoption_plan",
    workspace: "/tmp/example",
    approved_review_groups: [],
    items: [
      {
        bundle: "issue",
        kind: "capability",
        item: "cap_update_issue",
        status: "pending",
        track: "model",
        source_path: "candidates/imported/cap-update-issue.tg",
        canonical_rel_path: "capabilities/cap-update-issue.tg",
        related_capabilities: ["cap_update_issue"],
        related_workflows: ["workflow_issue_review"],
        blocking_dependencies: []
      }
    ]
  }, {
    seams: [
      {
        seam_id: "seam_issue_detail",
        output_id: "maintained_app",
        label: "issue detail treatment",
        kind: "ui_presenter",
        ownership_class: "contract_bound",
        status: "review_required",
        maintained_modules: ["examples/maintained/proof-app/src/issues.js"],
        emitted_dependencies: ["cap_update_issue", "workflow_issue_review"],
        allowed_change_classes: ["safe", "review_required"],
        drift_signals: ["emitted_contract_changed"]
      }
    ],
    outputs: [
      {
        output_id: "maintained_app",
        root_paths: ["examples/maintained/proof-app/**"]
      }
    ]
  });

  assert.equal(agentPlan.imported_proposal_surfaces[0].maintained_seam_candidates.length, 1);
  assert.equal(agentPlan.imported_proposal_surfaces[0].maintained_seam_candidates[0].seam_id, "seam_issue_detail");
  assert.match(agentPlan.imported_proposal_surfaces[0].maintained_seam_candidates[0].match_reasons.join(" "), /semantic overlap/);
});

test("buildAgentAdoptionPlan emits a clear maintained seam candidate from a real-trial-derived backend fixture", () => {
  const fixture = loadJsonFixture("../fixtures/import/maintained-seam-candidates/supabase-clear-match.json");
  const agentPlan = buildAgentAdoptionPlan(fixture.adoption_plan, fixture.maintained_boundary);
  const candidates = agentPlan.imported_proposal_surfaces[0].maintained_seam_candidates;

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].seam_id, "seam_workspace_profile_route");
  assert.ok(candidates[0].confidence >= 0.58);
  assert.match(candidates[0].match_reasons.join(" "), /semantic overlap/);
  assert.match(candidates[0].match_reasons.join(" "), /path token corroboration|proposal\/seam kind alignment|output path corroboration/);
});

test("buildAgentAdoptionPlan suppresses non-specific maintained seam candidates from a real-trial-derived UI fixture", () => {
  const fixture = loadJsonFixture("../fixtures/import/maintained-seam-candidates/eshop-ui-ambiguous.json");
  const agentPlan = buildAgentAdoptionPlan(fixture.adoption_plan, fixture.maintained_boundary);

  assert.deepEqual(agentPlan.imported_proposal_surfaces[0].maintained_seam_candidates, []);
});

test("buildAgentAdoptionPlan keeps dependency-only overlap below threshold when corroboration is weak", () => {
  const agentPlan = buildAgentAdoptionPlan({
    type: "reconcile_adoption_plan",
    workspace: "/tmp/example",
    approved_review_groups: [],
    items: [
      {
        bundle: "issue",
        kind: "capability",
        item: "cap_update_issue",
        status: "pending",
        track: "model",
        source_path: "candidates/reconcile/model/bundles/issue/capabilities/cap_update_issue.tg",
        canonical_rel_path: "capabilities/cap-update-issue.tg",
        related_capabilities: ["cap_update_issue"],
        blocking_dependencies: []
      }
    ]
  }, {
    seams: [
      {
        seam_id: "seam_generic_issue_adapter",
        output_id: "maintained_app",
        label: "generic issue adapter",
        kind: "api_adapter",
        ownership_class: "contract_bound",
        status: "review_required",
        maintained_modules: ["examples/maintained/proof-app/src/routes/admin/issues-handler.ts"],
        emitted_dependencies: ["cap_update_issue", "cap_list_issue_comments", "workflow_issue_review"],
        allowed_change_classes: ["review_required"],
        drift_signals: ["emitted_contract_changed"]
      }
    ],
    outputs: [
      {
        output_id: "maintained_app",
        root_paths: ["examples/maintained/proof-app/src/routes/admin/**"]
      }
    ]
  });

  assert.deepEqual(agentPlan.imported_proposal_surfaces[0].maintained_seam_candidates, []);
});

test("mergeAdoptionPlanState marks canonical files as applied and preserves historical applied items", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-adoption-plan-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "journeys"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "docs", "journeys", "issue_journey.md"), "# existing\n");

  const merged = mergeAdoptionPlanState(
    [
      {
        bundle: "issue",
        kind: "journey",
        item: "issue_journey",
        status: "pending",
        suggested_action: "promote_doc",
        canonical_rel_path: "docs/journeys/issue_journey.md",
        blocking_dependencies: []
      }
    ],
    {
      approved_review_groups: [],
      items: [
        {
          bundle: "legacy",
          kind: "entity",
          item: "entity_legacy",
          status: "applied"
        }
      ]
    },
    tempRoot
  );

  assert.equal(merged.find((item) => item.item === "issue_journey").status, "applied");
  assert.equal(merged.find((item) => item.item === "entity_legacy").status, "applied");
});

test("mergeAdoptionPlanState does not auto-apply projection auth patches just because the projection file exists", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-adoption-auth-patch-"));
  fs.mkdirSync(path.join(tempRoot, "projections"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "projections", "proj-api.tg"), "projection proj_api {\n  status active\n}\n");

  const merged = mergeAdoptionPlanState(
    [
      {
        bundle: "task",
        kind: "projection_auth_patch",
        item: "projection_auth_patch:proj_api:http_authz:reviewer",
        status: "needs_projection_review",
        suggested_action: "apply_projection_auth_patch",
        canonical_rel_path: "projections/proj-api.tg",
        blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
      }
    ],
    {
      approved_review_groups: [],
      items: []
    },
    tempRoot
  );

  assert.equal(merged[0].status, "needs_projection_review");
});

test("mergeAdoptionPlanState does not auto-apply projection permission patches just because the projection file exists", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-adoption-permission-patch-"));
  fs.mkdirSync(path.join(tempRoot, "projections"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "projections", "proj-api.tg"), "projection proj_api {\n  status active\n}\n");

  const merged = mergeAdoptionPlanState(
    [
      {
        bundle: "issue",
        kind: "projection_permission_patch",
        item: "projection_permission_patch:proj_api:http_authz:issues.update",
        status: "needs_projection_review",
        suggested_action: "apply_projection_permission_patch",
        canonical_rel_path: "projections/proj-api.tg",
        blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
      }
    ],
    {
      approved_review_groups: [],
      items: []
    },
    tempRoot
  );

  assert.equal(merged[0].status, "needs_projection_review");
});

test("mergeAdoptionPlanState does not auto-apply projection ownership patches just because the projection file exists", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-adoption-ownership-patch-"));
  fs.mkdirSync(path.join(tempRoot, "projections"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "projections", "proj-api.tg"), "projection proj_api {\n  status active\n}\n");

  const merged = mergeAdoptionPlanState(
    [
      {
        bundle: "issue",
        kind: "projection_ownership_patch",
        item: "projection_ownership_patch:proj_api:assignee_id",
        status: "needs_projection_review",
        suggested_action: "apply_projection_ownership_patch",
        canonical_rel_path: "projections/proj-api.tg",
        blocking_dependencies: [{ id: "projection_review:proj_api", type: "projection_review" }]
      }
    ],
    {
      approved_review_groups: [],
      items: []
    },
    tempRoot
  );

  assert.equal(merged[0].status, "needs_projection_review");
});
