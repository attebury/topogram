import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBundleJourneyDraft,
  buildJourneyDrafts,
  shouldAddBundleJourneyDraft
} from "../../src/reconcile/journeys.js";

function buildGraph(overrides = {}) {
  return {
    docs: overrides.docs || [],
    byKind: {
      entity: overrides.entities || [],
      capability: overrides.capabilities || [],
      rule: overrides.rules || [],
      projection: overrides.projections || []
    }
  };
}

test("buildJourneyDrafts creates creation lifecycle and core flow drafts with stable metadata", () => {
  const graph = buildGraph({
    entities: [
      { id: "entity_issue", name: "Issue" },
      { id: "entity_dashboard", name: "Dashboard" }
    ],
    capabilities: [
      { id: "cap_create_issue", creates: [{ id: "entity_issue" }], actors: [{ id: "actor_user" }], roles: [{ id: "role_reporter" }] },
      { id: "cap_list_issues", reads: [{ id: "entity_issue" }] },
      { id: "cap_get_issue", reads: [{ id: "entity_issue" }] },
      { id: "cap_update_issue", updates: [{ id: "entity_issue" }], actors: [{ id: "actor_user" }], roles: [{ id: "role_assignee" }] },
      { id: "cap_close_issue", updates: [{ id: "entity_issue" }] },
      { id: "cap_refresh_dashboard", reads: [{ id: "entity_dashboard" }] },
      { id: "cap_sync_dashboard", updates: [{ id: "entity_dashboard" }] }
    ],
    rules: [
      { id: "rule_issue_assignment", name: "Active assignee only", appliesTo: [{ id: "entity_issue" }] }
    ],
    projections: [
      {
        id: "proj_ui_contract",
        platform: "ui_contract",
        type: "ui_contract",
        screens: [
          { id: "issue_list", kind: "list", title: "Issue Board" },
          { id: "issue_detail", kind: "detail", title: "Issue Detail" },
          { id: "issue_create", kind: "form", title: "Create Issue", submit: { id: "cap_create_issue" } }
        ]
      }
    ]
  });

  const result = buildJourneyDrafts(graph);
  assert.deepEqual(
    result.drafts.map((draft) => draft.id),
    ["dashboard_core_flow", "issue_creation_and_discovery", "issue_update_and_lifecycle"]
  );

  const creation = result.drafts.find((draft) => draft.id === "issue_creation_and_discovery");
  assert.equal(creation.path, "candidates/docs/journeys/issue-creation-and-discovery.md");
  assert.equal(creation.metadata.review_required, true);
  assert.deepEqual(creation.metadata.related_entities, ["entity_issue"]);
  assert.match(creation.body, /Issue list/);
  assert.match(creation.body, /Issue detail/);
  assert.match(creation.body, /cap_create_issue/);

  const lifecycle = result.drafts.find((draft) => draft.id === "issue_update_and_lifecycle");
  assert.match(lifecycle.body, /cap_close_issue/);
  assert.match(lifecycle.body, /rule_issue_assignment/);

  const core = result.drafts.find((draft) => draft.id === "dashboard_core_flow");
  assert.equal(core.path, "candidates/docs/journeys/dashboard-core-flow.md");
  assert.match(core.body, /core dashboard flow/i);
});

test("buildJourneyDrafts suppresses drafts for entities already covered by canonical journeys", () => {
  const graph = buildGraph({
    docs: [{ kind: "journey", relatedEntities: ["entity_issue"], relatedCapabilities: [] }],
    entities: [{ id: "entity_issue", name: "Issue" }],
    capabilities: [{ id: "cap_create_issue", creates: [{ id: "entity_issue" }] }],
    rules: [],
    projections: []
  });

  const result = buildJourneyDrafts(graph);
  assert.deepEqual(result.drafts, []);
  assert.deepEqual(result.skippedEntities, [{ entity_id: "entity_issue", reason: "canonical_journey_exists" }]);
});

test("bundle journey helpers keep draft gating metadata and output paths stable", () => {
  const graph = buildGraph({
    docs: [],
    entities: [],
    capabilities: [],
    rules: [],
    projections: []
  });
  const bundle = {
    id: "entity_issue",
    slug: "issue",
    label: "Issue",
    confidence: "high",
    mergeHints: { canonicalEntityTarget: "entity_issue" },
    entities: [{ id_hint: "entity_issue" }],
    capabilities: [{ id_hint: "cap_create_issue" }, { id_hint: "cap_get_issue" }, { id_hint: "cap_close_issue" }],
    workflows: [{ id_hint: "workflow_issue_resolution" }],
    actors: [{ id_hint: "actor_user" }],
    roles: [{ id_hint: "role_assignee" }],
    uiRoutes: [{ path: "/issues" }, { path: "/issues/:id" }],
    screens: [{ id_hint: "issue_list", screen_kind: "list" }, { id_hint: "issue_detail", screen_kind: "detail" }]
  };

  assert.equal(shouldAddBundleJourneyDraft(bundle, graph), true);

  const draft = buildBundleJourneyDraft(bundle);
  assert.equal(draft.id, "issue_journey");
  assert.equal(draft.canonical_rel_path, "docs/journeys/issue_journey.md");
  assert.equal(draft.source_path, "candidates/reconcile/model/bundles/issue/docs/journeys/issue_journey.md");
  assert.equal(draft.review_required, true);
  assert.deepEqual(draft.related_actors, ["actor_user"]);
  assert.deepEqual(draft.related_roles, ["role_assignee"]);
  assert.match(draft.body, /The strongest inferred participants are `actor_user`, `role_assignee`/);
  assert.match(draft.body, /cap_create_issue/);
  assert.match(draft.body, /workflow_issue_resolution/);

  const coveredGraph = buildGraph({
    docs: [{ kind: "journey", relatedEntities: ["entity_issue"], relatedCapabilities: [] }]
  });
  assert.equal(shouldAddBundleJourneyDraft(bundle, coveredGraph), false);
});
