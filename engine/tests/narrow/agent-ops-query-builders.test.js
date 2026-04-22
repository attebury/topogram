import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildAuthHintsQueryPayload,
  buildAuthReviewPacketPayload,
  buildCanonicalWritesPayloadForImportPlan,
  buildChangePlanPayload,
  buildImportPlanPayload,
  buildResolvedWorkflowContextPayload,
  buildWorkflowPresetActivationPayload,
  buildWorkflowPresetCustomizationPayload,
  buildWorkflowPresetDiffPayload,
  buildWorkflowPresetState,
  buildHandoffStatusPayload,
  buildLaneStatusPayload,
  buildMaintainedRiskSummary,
  buildMaintainedConformancePayload,
  buildMaintainedDriftPayload,
  buildMultiAgentPlanPayload,
  buildSeamCheckPayload,
  buildReviewPacketPayloadForChangePlan,
  buildReviewPacketPayloadForImportPlan,
  buildRiskSummaryPayload,
  buildSingleAgentPlanPayload,
  buildWorkPacketPayload,
  classifyRisk,
  proceedDecisionFromRisk,
  summarizeDiffArtifact
} from "../../src/agent-ops/query-builders.js";
import { buildMaintainedBoundaryArtifact, maintainedProofMetadata } from "../../src/generator/context/shared.js";

function makeChangePlanGraph() {
  return {
    statements: [
      {
        id: "entity_article",
        kind: "entity",
        name: "Article",
        fields: []
      },
      {
        id: "shape_output_article",
        kind: "shape",
        name: "Article Output"
      },
      {
        id: "cap_update_article",
        kind: "capability",
        name: "Update Article",
        reads: [{ id: "entity_article" }],
        updates: [{ id: "entity_article" }],
        input: [],
        output: [{ id: "shape_output_article" }]
      },
      {
        id: "proj_api",
        kind: "projection",
        name: "API",
        platform: "api",
        outputs: ["api_contract"],
        realizes: [{ id: "cap_update_article" }],
        http: [{ capability: { id: "cap_update_article" }, entity: { id: "entity_article" } }],
        uiRoutes: [],
        uiWeb: [],
        uiScreens: [],
        dbTables: [],
        dbColumns: [],
        dbRelations: [],
        generatorDefaults: []
      },
      {
        id: "proj_ui_shared",
        kind: "projection",
        name: "Shared UI",
        platform: "ui_shared",
        outputs: ["ui_contract"],
        realizes: [{ id: "cap_update_article" }],
        uiScreens: [{ id: "article_detail", viewShape: { id: "shape_output_article" } }],
        uiRoutes: [],
        uiWeb: [],
        http: [],
        dbTables: [],
        dbColumns: [],
        dbRelations: [],
        generatorDefaults: []
      },
      {
        id: "proj_ui_web",
        kind: "projection",
        name: "Web UI",
        platform: "ui_web",
        outputs: ["ui_contract", "web_app"],
        realizes: [{ id: "proj_ui_shared" }, { id: "cap_update_article" }],
        uiScreens: [],
        uiRoutes: [{ screenId: "article_detail", path: "/articles/:id" }],
        uiWeb: [{ targetKind: "screen", targetId: "article_detail", directive: "layout", value: "detail_page" }],
        http: [],
        dbTables: [],
        dbColumns: [],
        dbRelations: [],
        generatorDefaults: [{ key: "profile", value: "sveltekit" }]
      },
      {
        id: "proj_db_postgres",
        kind: "projection",
        name: "DB",
        platform: "db_postgres",
        outputs: ["db_contract"],
        realizes: [{ id: "entity_article" }],
        http: [],
        uiRoutes: [],
        uiWeb: [],
        uiScreens: [],
        dbTables: [{ entity: { id: "entity_article" }, table: "articles" }],
        dbColumns: [],
        dbRelations: [],
        generatorDefaults: []
      },
      {
        id: "rule_article_access",
        kind: "rule",
        name: "Article Access",
        appliesTo: [{ id: "cap_update_article" }]
      },
      {
        id: "ver_article_review_flow",
        kind: "verification",
        name: "Article Review Flow",
        validates: [{ id: "cap_update_article" }]
      }
    ],
    byKind: {
      entity: [{ id: "entity_article", kind: "entity", name: "Article", fields: [] }],
      shape: [{ id: "shape_output_article", kind: "shape", name: "Article Output" }],
      capability: [{
        id: "cap_update_article",
        kind: "capability",
        name: "Update Article",
        reads: [{ id: "entity_article" }],
        updates: [{ id: "entity_article" }],
        input: [],
        output: [{ id: "shape_output_article" }]
      }],
      projection: [
        {
          id: "proj_api",
          kind: "projection",
          name: "API",
          platform: "api",
          outputs: ["api_contract"],
          realizes: [{ id: "cap_update_article" }],
          http: [{ capability: { id: "cap_update_article" }, entity: { id: "entity_article" } }],
          uiRoutes: [],
          uiWeb: [],
          uiScreens: [],
          dbTables: [],
          dbColumns: [],
          dbRelations: [],
          generatorDefaults: []
        },
        {
          id: "proj_ui_shared",
          kind: "projection",
          name: "Shared UI",
          platform: "ui_shared",
          outputs: ["ui_contract"],
          realizes: [{ id: "cap_update_article" }],
          uiScreens: [{ id: "article_detail", viewShape: { id: "shape_output_article" } }],
          uiRoutes: [],
          uiWeb: [],
          http: [],
          dbTables: [],
          dbColumns: [],
          dbRelations: [],
          generatorDefaults: []
        },
        {
          id: "proj_ui_web",
          kind: "projection",
          name: "Web UI",
          platform: "ui_web",
          outputs: ["ui_contract", "web_app"],
          realizes: [{ id: "proj_ui_shared" }, { id: "cap_update_article" }],
          uiScreens: [],
          uiRoutes: [{ screenId: "article_detail", path: "/articles/:id" }],
          uiWeb: [{ targetKind: "screen", targetId: "article_detail", directive: "layout", value: "detail_page" }],
          http: [],
          dbTables: [],
          dbColumns: [],
          dbRelations: [],
          generatorDefaults: [{ key: "profile", value: "sveltekit" }]
        },
        {
          id: "proj_db_postgres",
          kind: "projection",
          name: "DB",
          platform: "db_postgres",
          outputs: ["db_contract"],
          realizes: [{ id: "entity_article" }],
          http: [],
          uiRoutes: [],
          uiWeb: [],
          uiScreens: [],
          dbTables: [{ entity: { id: "entity_article" }, table: "articles" }],
          dbColumns: [],
          dbRelations: [],
          generatorDefaults: []
        }
      ],
      rule: [{
        id: "rule_article_access",
        kind: "rule",
        name: "Article Access",
        appliesTo: [{ id: "cap_update_article" }]
      }],
      verification: [{ id: "ver_article_review_flow", kind: "verification", name: "Article Review Flow", validates: [{ id: "cap_update_article" }] }]
    },
    docs: [
      {
        id: "workflow_article_review",
        kind: "workflow",
        title: "Article Review",
        relatedCapabilities: ["cap_update_article"],
        relatedProjections: ["proj_ui_shared"]
      },
      {
        id: "journey_article_editing",
        kind: "journey",
        title: "Article Editing",
        relatedCapabilities: ["cap_update_article"],
        relatedWorkflows: ["workflow_article_review"],
        relatedProjections: ["proj_ui_web"]
      }
    ]
  };
}

function makeRootedGraphWithMaintainedFiles() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-seam-probes-"));
  fs.mkdirSync(path.join(root, "product", "app", "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "product", "app", "proof"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "product", "app", "src", "content-approval-change-guards.js"),
    "export const requestRevisionRoute = '/articles/request-revision';\nexport const workflowSummary = 'article revision review';\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, "product", "app", "proof", "content-approval-workflow-decision-story.md"),
    "# Content Approval Workflow Decision Story\n",
    "utf8"
  );
  return {
    ...makeChangePlanGraph(),
    root
  };
}

function makeIssuesCrossSurfaceGraph() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-issues-cross-surface-"));
  fs.mkdirSync(path.join(root, "product", "app", "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "product", "app", "proof"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "product", "app", "src", "issues.js"),
    [
      "export const issueDetailSurface = 'issue_detail';",
      "export const issueListSurface = 'issue_list';",
      "export const ownerOrAdminRule = 'owner_or_admin';",
      "export const assigneeId = 'user_runtime';"
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, "product", "app", "proof", "issues-cross-surface-alignment-story.md"),
    "# Issues Cross-Surface Alignment Story\n",
    "utf8"
  );
  return {
    ...makeChangePlanGraph(),
    root
  };
}

test("classifyRisk escalates seam-aware maintained no-go and review-boundary changes", () => {
  const maintainedRisk = buildMaintainedRiskSummary({
    maintainedImpacts: {
      affected_outputs: [
        {
          output_id: "maintained_app",
          kind: "maintained_runtime",
          highest_severity: "no_go",
          affected_seams: [
            {
              seam_id: "seam_visibility_guard",
              output_id: "maintained_app",
              kind: "policy_interpretation",
              status: "no_go",
              ownership_class: "out_of_bounds"
            }
          ],
          maintained_files_in_scope: ["product/app/src/issues.js"],
          verification_targets: { maintained_app_checks: ["runtime-check"] }
        }
      ],
      affected_seams: [
        {
          seam_id: "seam_visibility_guard",
          output_id: "maintained_app",
          kind: "policy_interpretation",
          status: "no_go",
          ownership_class: "out_of_bounds"
        }
      ],
      maintained_files_in_scope: ["product/app/src/issues.js"]
    },
    diffSummary: { affected_output_count: 1, affected_seam_count: 1, highest_maintained_severity: "no_go" }
  });
  const noGoRisk = classifyRisk({
    reviewBoundary: { automation_class: "no_go" },
    maintainedBoundary: { summary: { no_go_count: 1 }, maintained_files_in_scope: ["product/app/src/issues.js"] },
    diffSummary: { review_boundary_change_count: 2, maintained_file_count: 1 },
    verificationTargets: { maintained_app_checks: ["runtime-check"] },
    maintainedRisk
  });

  assert.equal(noGoRisk.overall_risk, "no_go");
  assert.match(JSON.stringify(noGoRisk.risk_reasons), /review_boundary_no_go/);
  assert.match(JSON.stringify(noGoRisk.risk_reasons), /maintained_no_go_seam/);
  assert.equal(noGoRisk.recommended_human_review, true);
});

test("classifyRisk uses seam severity and does not escalate on maintained files alone", () => {
  const manualRisk = classifyRisk({
    diffSummary: { maintained_file_count: 2 },
    verificationTargets: { generated_checks: ["compile-check"] },
    maintainedRisk: {
      affected_output_count: 1,
      affected_seam_count: 1,
      highest_severity: "manual_decision",
      status_counts: { aligned: 0, review_required: 0, manual_decision: 1, no_go: 0 },
      affected_outputs: [{ output_id: "web_app", kind: "web_app", highest_severity: "manual_decision", affected_seam_count: 1, maintained_file_count: 2, verification_targets: null }],
      affected_seams: [{ seam_id: "seam_copy", output_id: "web_app", kind: "ui_presenter", status: "manual_decision", ownership_class: "contract_bound" }],
      maintained_files_in_scope: ["product/app/src/a.js", "product/app/src/b.js"],
      output_verification_targets: []
    }
  });
  const filesOnlyRisk = classifyRisk({
    diffSummary: { maintained_file_count: 2 },
    verificationTargets: { generated_checks: ["compile-check"] },
    maintainedRisk: {
      affected_output_count: 0,
      affected_seam_count: 0,
      highest_severity: "aligned",
      status_counts: { aligned: 0, review_required: 0, manual_decision: 0, no_go: 0 },
      affected_outputs: [],
      affected_seams: [],
      maintained_files_in_scope: ["product/app/src/a.js", "product/app/src/b.js"],
      output_verification_targets: []
    }
  });
  const reviewRequiredRisk = classifyRisk({
    verificationTargets: { generated_checks: ["compile-check"] },
    maintainedRisk: {
      affected_output_count: 1,
      affected_seam_count: 1,
      highest_severity: "review_required",
      status_counts: { aligned: 0, review_required: 1, manual_decision: 0, no_go: 0 },
      affected_outputs: [{ output_id: "web_app", kind: "web_app", highest_severity: "review_required", affected_seam_count: 1, maintained_file_count: 1, verification_targets: null }],
      affected_seams: [{ seam_id: "seam_detail", output_id: "web_app", kind: "ui_presenter", status: "review_required", ownership_class: "contract_bound" }],
      maintained_files_in_scope: ["product/app/src/a.js"],
      output_verification_targets: []
    }
  });

  assert.equal(manualRisk.overall_risk, "manual_decision");
  assert.match(JSON.stringify(manualRisk.risk_reasons), /maintained_manual_decision_seam/);
  assert.equal(filesOnlyRisk.overall_risk, "safe");
  assert.doesNotMatch(JSON.stringify(filesOnlyRisk.risk_reasons), /maintained_code_in_scope/);
  assert.equal(reviewRequiredRisk.overall_risk, "review_required");
  assert.match(JSON.stringify(reviewRequiredRisk.risk_reasons), /maintained_review_required_seam/);
});

test("proceedDecisionFromRisk maps risk classes into operator decisions", () => {
  const manualRisk = {
    overall_risk: "manual_decision",
    blocking_factors: ["Imported proposal surfaces still require human review."],
    recommended_human_review: true
  };

  const decision = proceedDecisionFromRisk(
    manualRisk,
    { kind: "review_staged" },
    { safe_to_edit: ["candidates/**"] },
    { generated_checks: ["reconcile-review"] },
    {
      affected_output_count: 1,
      affected_seam_count: 1,
      highest_severity: "manual_decision",
      status_counts: { aligned: 0, review_required: 0, manual_decision: 1, no_go: 0 },
      affected_outputs: [{ output_id: "maintained_app", kind: "maintained_runtime", highest_severity: "manual_decision", affected_seam_count: 1, maintained_file_count: 1, verification_targets: { maintained_app_checks: ["runtime-check"] } }],
      affected_seams: [{ seam_id: "seam_copy", output_id: "maintained_app", kind: "ui_presenter", status: "manual_decision", ownership_class: "contract_bound" }],
      maintained_files_in_scope: ["product/app/src/issues.js"],
      output_verification_targets: [{ output_id: "maintained_app", verification_targets: { maintained_app_checks: ["runtime-check"] } }]
    }
  );

  assert.equal(decision.decision, "stage_only");
  assert.equal(decision.required_human_review, true);
  assert.equal(decision.recommended_next_action.kind, "review_staged");
  assert.equal(decision.output_verification_targets[0].output_id, "maintained_app");
});

test("buildImportPlanPayload and import review packet keep staged proposal metadata", () => {
  const taskModeArtifact = {
    summary: { focus: "Proposal review and adoption planning" },
    next_action: { kind: "review_staged" },
    write_scope: { safe_to_edit: ["candidates/**"] },
    verification_targets: { generated_checks: ["reconcile-review"] }
  };
  const adoptionPlan = {
    adoption_state_vocabulary: ["accept", "map", "customize", "stage", "reject"],
    approved_review_groups: ["projection_review:proj_api"],
    staged_items: ["issue:capability:cap_update_issue"],
    accepted_items: [],
    rejected_items: [],
    requires_human_review: ["issue:capability:cap_update_issue"],
    imported_proposal_surfaces: [
      {
        id: "issue:capability:cap_update_issue",
        canonical_rel_path: "capabilities/cap-update-issue.tg",
        projection_impacts: [{ projection_id: "proj_api" }],
        maintained_seam_candidates: [
          {
            seam_id: "seam_explicit_mapping",
            output_id: "maintained_app",
            label: "explicit maintained seam",
            kind: "ui_presenter",
            ownership_class: "contract_bound",
            status: "manual_decision",
            maintained_modules: ["product/app/src/content-approval.js"],
            emitted_dependencies: ["cap_non_matching"],
            allowed_change_classes: ["manual_decision"],
            drift_signals: ["workflow_state_changed"],
            match_reasons: ["dependency overlap: `cap_update_article`"],
            confidence: 0.86
          }
        ],
        requirements: {
          related_capabilities: ["cap_update_article"]
        }
      }
    ]
  };

  const importPlan = buildImportPlanPayload(adoptionPlan, taskModeArtifact, {
    outputs: [
      {
        output_id: "maintained_app",
        kind: "maintained_runtime",
        maintained_files_in_scope: ["product/app/src/issues.js"],
        verification_targets: { maintained_app_checks: ["runtime-check"] },
        seams: [{ seam_id: "seam_issues_detail_presenter" }]
      },
      {
        output_id: "maintained_app",
        kind: "maintained_runtime",
        maintained_files_in_scope: ["product/app/src/content-approval.js"],
        verification_targets: { maintained_app_checks: ["runtime-check"] },
        seams: [{ seam_id: "seam_explicit_mapping" }]
      }
    ],
    seams: [
      {
        seam_id: "seam_issues_detail_presenter",
        output_id: "maintained_app",
        label: "issues detail presenter",
        kind: "ui_presenter",
        ownership_class: "contract_bound",
        status: "review_required",
        maintained_modules: ["product/app/src/issues.js"],
        emitted_dependencies: ["cap_update_article", "proj_api"],
        proof_stories: []
      },
      {
        seam_id: "seam_explicit_mapping",
        output_id: "maintained_app",
        label: "explicit maintained seam",
        kind: "ui_presenter",
        ownership_class: "contract_bound",
        status: "manual_decision",
        maintained_modules: ["product/app/src/content-approval.js"],
        emitted_dependencies: ["cap_non_matching"],
        proof_stories: []
      }
    ]
  });
  const risk = classifyRisk({ importPlan, verificationTargets: importPlan.verification_targets, maintainedRisk: importPlan.maintained_risk });
  const reviewPacket = buildReviewPacketPayloadForImportPlan({ importPlan, risk });

  assert.equal(importPlan.type, "import_plan_query");
  assert.equal(importPlan.maintained_risk.affected_outputs[0].output_id, "maintained_app");
  assert.equal(importPlan.proposal_surfaces[0].maintained_impacts.maintained_seam_candidates[0].seam_id, "seam_explicit_mapping");
  assert.equal(importPlan.proposal_surfaces[0].maintained_impacts.maintained_seam_candidates[0].confidence, 0.86);
  assert.match(importPlan.proposal_surfaces[0].maintained_impacts.maintained_seam_candidates[0].match_reasons.join(" "), /dependency overlap/);
  assert.equal(importPlan.proposal_surfaces[0].maintained_impacts.affected_seams[0].seam_id, "seam_explicit_mapping");
  assert.equal(reviewPacket.type, "review_packet_query");
  assert.equal(reviewPacket.source, "import-plan");
  assert.equal(reviewPacket.canonical_writes[0].canonical_rel_path, "capabilities/cap-update-issue.tg");
  assert.equal(reviewPacket.output_verification_targets[0].output_id, "maintained_app");
});

test("workflow preset inventory and import review packet expose provider and team preset categories", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-workflow-preset-"));
  const topogramRoot = path.join(workspaceRoot, "topogram");
  fs.mkdirSync(path.join(topogramRoot, "topogram", "workflow-presets"), { recursive: true });
  fs.mkdirSync(path.join(topogramRoot, "candidates", "providers", "workflow-presets"), { recursive: true });

  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "workflow-presets", "teamcity-ci.json"),
    JSON.stringify({
      id: "provider_preset_teamcity_ci",
      label: "TeamCity CI Review",
      kind: "provider_workflow_preset",
      provider: { id: "teamcity_generic", kind: "deployment_provider" },
      adoption_state: "accept",
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      recommended_task_mode: "import-adopt",
      preferred_queries: ["import-plan", "review-packet"],
      review_policy: {
        escalate_categories: ["deployment_assumptions"]
      },
      verification_policy: {
        required: ["reconcile-review"]
      }
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(topogramRoot, "topogram", "workflow-presets", "team-provider-adoption.json"),
    JSON.stringify({
      id: "team_preset_provider_adoption",
      label: "Provider Adoption Review",
      kind: "team_workflow_preset",
      adoption_state: "accept",
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      preferred_queries: ["risk-summary", "proceed-decision"],
      review_policy: {
        block_on: ["manual_decision", "no_go"],
        escalate_categories: ["maintained_boundary"]
      },
      handoff_defaults: {
        required_fields: ["affected_outputs", "verification_summary"]
      }
    }, null, 2)
  );

  const taskModeArtifact = {
    mode: "import-adopt",
    summary: { focus: "Proposal review and adoption planning" },
    next_action: { kind: "review_staged" },
    write_scope: { safe_to_edit: ["candidates/**"] },
    verification_targets: { generated_checks: ["reconcile-review"] }
  };
  const workflowPresets = buildWorkflowPresetState({
    workspace: topogramRoot,
    selectors: {
      mode: "import-adopt",
      task_class: "import-adopt",
      integration_categories: ["provider_adoption"],
      query_family: "import-plan"
    }
  });
  const adoptionPlan = {
    adoption_state_vocabulary: ["accept", "map", "customize", "stage", "reject"],
    approved_review_groups: [],
    staged_items: ["issue:capability:cap_update_issue"],
    accepted_items: [],
    rejected_items: [],
    requires_human_review: [],
    imported_proposal_surfaces: []
  };

  const importPlan = buildImportPlanPayload(adoptionPlan, taskModeArtifact, null, workflowPresets);
  const risk = classifyRisk({
    importPlan,
    verificationTargets: importPlan.verification_targets,
    maintainedRisk: importPlan.maintained_risk || null
  });
  const reviewPacket = buildReviewPacketPayloadForImportPlan({ importPlan, risk });

  assert.equal(importPlan.workflow_presets.provider.length, 1);
  assert.equal(importPlan.workflow_presets.team.length, 1);
  assert.equal(importPlan.workflow_presets.provider[0].id, "provider_preset_teamcity_ci");
  assert.equal(importPlan.workflow_presets.workflow_preset_surfaces[0].recommended_state, "accept");
  assert.equal(importPlan.workflow_presets.workflow_preset_surfaces[0].customization_status.status, null);
  assert.equal(importPlan.workflow_presets.workflow_preset_surfaces[0].recommended_customization_action, null);
  assert.match(importPlan.workflow_presets.workflow_preset_surfaces[0].recommended_local_path, /workflow-presets\/provider\.teamcity_generic\.provider_preset_teamcity_ci\.json$/);
  assert.equal(risk.overall_risk, "manual_decision");
  assert.ok(risk.risk_reasons.includes("provider_workflow_preset_manual_decision"));
  assert.equal(reviewPacket.workflow_presets.team[0].id, "team_preset_provider_adoption");
  assert.equal(reviewPacket.workflow_preset_surfaces[0].id, "provider_preset_teamcity_ci");
});

test("buildWorkflowPresetCustomizationPayload emits a derived team preset scaffold with workspace-relative provenance", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-workflow-preset-customization-"));
  const topogramRoot = path.join(workspaceRoot, "topogram");
  fs.mkdirSync(path.join(topogramRoot, "candidates", "providers", "workflow-presets"), { recursive: true });

  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "workflow-presets", "provider_preset_teamcity_ci.json"),
    JSON.stringify({
      id: "provider_preset_teamcity_ci",
      kind: "provider_workflow_preset",
      label: "TeamCity CI Review",
      provider: { id: "teamcity_generic", kind: "deployment_provider" },
      adoption_state: "customize",
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      recommended_task_mode: "import-adopt",
      preferred_queries: ["import-plan", "review-packet"],
      artifact_load_order: ["provider_manifest", "review_packet"],
      review_policy: {
        block_on: ["manual_decision"],
        escalate_categories: ["deployment_assumptions"]
      },
      verification_policy: {
        required: ["reconcile-review"],
        recommended: ["teamcity-pipeline-check"]
      },
      multi_agent_policy: {
        allowed: true,
        default_strategy: "serialized_adoption_after_parallel_review"
      },
      handoff_defaults: {
        required_fields: ["verification_summary"]
      },
      tool_hints: {
        cursor: {
          summary_style: "concise"
        }
      }
    }, null, 2)
  );

  const payload = buildWorkflowPresetCustomizationPayload({
    workspace: topogramRoot,
    providerId: "teamcity_generic",
    presetId: "provider_preset_teamcity_ci"
  });

  assert.equal(payload.type, "workflow_preset_customization_query");
  assert.equal(payload.provider_id, "teamcity_generic");
  assert.equal(payload.preset_id, "provider_preset_teamcity_ci");
  assert.equal(payload.recommended_local_path, "workflow-presets/provider.teamcity_generic.provider_preset_teamcity_ci.json");
  assert.equal(payload.customization_template.kind, "team_workflow_preset");
  assert.equal(payload.customization_template.adoption_state, "accept");
  assert.equal(payload.customization_template.derived_from.provider_id, "teamcity_generic");
  assert.equal(payload.customization_template.derived_from.provider_preset_id, "provider_preset_teamcity_ci");
  assert.equal(payload.customization_template.derived_from.source_path, "candidates/providers/workflow-presets/provider_preset_teamcity_ci.json");
  assert.equal(
    payload.customization_template.derived_from.source_fingerprint,
    payload.required_provenance.source_fingerprint
  );
  assert.deepEqual(payload.customization_template.applies_to.task_classes, ["import-adopt"]);
  assert.deepEqual(payload.customization_template.preferred_queries, ["import-plan", "review-packet"]);
  assert.ok(payload.suggested_fields_to_customize.includes("verification_policy"));
  assert.deepEqual(payload.warnings, []);
});

test("buildWorkflowPresetDiffPayload distinguishes new, changed, customized, and orphaned provider preset states", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-workflow-preset-diff-"));
  const topogramRoot = path.join(workspaceRoot, "topogram");
  fs.mkdirSync(path.join(topogramRoot, "topogram", "workflow-presets"), { recursive: true });
  fs.mkdirSync(path.join(topogramRoot, "candidates", "providers", "workflow-presets"), { recursive: true });

  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "workflow-presets", "provider_preset_new.json"),
    JSON.stringify({
      id: "provider_preset_new",
      kind: "provider_workflow_preset",
      label: "New Provider Preset",
      provider: { id: "aws_generic", kind: "cloud_platform" },
      adoption_state: "stage",
      applies_to: { task_classes: ["import-adopt"] }
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "workflow-presets", "provider_preset_changed.json"),
    JSON.stringify({
      id: "provider_preset_changed",
      kind: "provider_workflow_preset",
      label: "Changed Provider Preset",
      provider: { id: "aws_generic", kind: "cloud_platform" },
      adoption_state: "accept",
      preferred_queries: ["import-plan", "risk-summary"],
      review_policy: { escalate_categories: ["deployment_assumptions"] },
      refresh_baseline: {
        id: "provider_preset_changed",
        preferred_queries: ["import-plan"],
        review_policy: { escalate_categories: [] }
      }
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "workflow-presets", "provider_preset_customized.json"),
    JSON.stringify({
      id: "provider_preset_customized",
      kind: "provider_workflow_preset",
      label: "Customized Provider Preset",
      provider: { id: "aws_generic", kind: "cloud_platform" },
      adoption_state: "customize",
      preferred_queries: ["review-packet"],
      review_policy: { escalate_categories: ["maintained_boundary"] }
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(topogramRoot, "topogram", "workflow-presets", "team_preset_provider_preset_customized.json"),
    JSON.stringify({
      id: "team_preset_provider_preset_customized",
      kind: "team_workflow_preset",
      label: "Customized Local Preset",
      adoption_state: "accept",
      preferred_queries: ["risk-summary"],
      derived_from: {
        provider_id: "aws_generic",
        provider_preset_id: "provider_preset_customized",
        source_path: "candidates/providers/workflow-presets/provider_preset_customized.json",
        source_fingerprint: "old-fingerprint"
      }
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(topogramRoot, "topogram", "workflow-presets", "team_preset_orphaned.json"),
    JSON.stringify({
      id: "team_preset_orphaned",
      kind: "team_workflow_preset",
      label: "Orphaned Local Preset",
      adoption_state: "accept",
      derived_from: {
        provider_id: "aws_generic",
        provider_preset_id: "provider_preset_orphaned"
      }
    }, null, 2)
  );

  const diff = buildWorkflowPresetDiffPayload({
    workspace: topogramRoot,
    providerId: "aws_generic"
  });

  assert.equal(diff.type, "workflow_preset_diff_query");
  assert.equal(diff.summary.diff_count, 4);
  assert.equal(diff.diffs.find((entry) => entry.preset_id === "provider_preset_new").change_status, "new");
  assert.equal(diff.diffs.find((entry) => entry.preset_id === "provider_preset_changed").change_status, "changed");
  assert.ok(diff.diffs.find((entry) => entry.preset_id === "provider_preset_changed").changed_fields.includes("preferred_queries"));
  assert.equal(diff.diffs.find((entry) => entry.preset_id === "provider_preset_changed").recommended_customization_action, null);
  assert.equal(diff.diffs.find((entry) => entry.preset_id === "provider_preset_customized").change_status, "locally_customized");
  assert.equal(diff.diffs.find((entry) => entry.preset_id === "provider_preset_customized").recommended_customization_action, "refresh_local_customization");
  assert.equal(diff.diffs.find((entry) => entry.preset_id === "provider_preset_orphaned").change_status, "orphaned_customization");
  assert.equal(diff.diffs.find((entry) => entry.preset_id === "provider_preset_orphaned").recommended_customization_action, "remove_or_replace_orphaned_customization");
});

test("buildResolvedWorkflowContextPayload composes active provider and team presets deterministically", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-resolved-workflow-"));
  const topogramRoot = path.join(workspaceRoot, "topogram");
  fs.mkdirSync(path.join(topogramRoot, "topogram", "workflow-presets"), { recursive: true });
  fs.mkdirSync(path.join(topogramRoot, "candidates", "providers", "workflow-presets"), { recursive: true });
  fs.mkdirSync(path.join(topogramRoot, "candidates", "providers", "manifests"), { recursive: true });

  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "manifests", "aws_generic.json"),
    JSON.stringify({
      provider: {
        id: "aws_generic",
        kind: "cloud_platform",
        display_name: "AWS Generic",
        version: "0.1.0"
      },
      requirements: {
        workflow_core_version: "1"
      },
      review_defaults: {
        workflow_presets: "review_required"
      },
      exports: {
        workflow_presets: [
          {
            id: "provider_preset_aws_deploy",
            label: "AWS Deploy Adoption",
            path: "workflow-presets/aws-deploy.json",
            applies_to: {
              task_classes: ["import-adopt"],
              integration_categories: ["provider_adoption"]
            }
          },
          {
            id: "provider_preset_missing",
            label: "Missing Declared Preset",
            path: "workflow-presets/missing.json",
            kind: "provider_workflow_preset",
            applies_to: {
              task_classes: ["import-adopt"]
            }
          }
        ]
      }
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "workflow-presets", "aws-deploy.json"),
    JSON.stringify({
      id: "provider_preset_aws_deploy",
      label: "AWS Deploy Adoption",
      kind: "provider_workflow_preset",
      provider: { id: "aws_generic", kind: "cloud_platform" },
      adoption_state: "accept",
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      recommended_task_mode: "verification",
      preferred_queries: ["review-packet", "verification-targets"],
      artifact_load_order: ["provider_manifest", "review_packet"],
      review_policy: {
        escalate_categories: ["deployment_assumptions"]
      },
      verification_policy: {
        required: ["reconcile-review"],
        recommended: ["aws-smoke-check"]
      },
      multi_agent_policy: {
        allowed: true,
        default_strategy: "parallel_review_then_serialized_adoption"
      },
      tool_hints: {
        cursor: {
          summary_style: "concise"
        }
      },
      priority: 100
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(topogramRoot, "topogram", "workflow-presets", "local-provider-adoption.json"),
    JSON.stringify({
      id: "team_preset_provider_adoption",
      label: "Local Provider Adoption",
      kind: "team_workflow_preset",
      adoption_state: "accept",
      priority: 300,
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      recommended_task_mode: "import-adopt",
      preferred_queries: ["import-plan", "risk-summary"],
      artifact_load_order: ["import_plan"],
      review_policy: {
        block_on: ["manual_decision", "no_go"],
        escalate_categories: ["maintained_boundary"]
      },
      verification_policy: {
        required: ["local-smoke-check"],
        recommended: ["team-review-check"]
      },
      multi_agent_policy: {
        allowed: false
      },
      handoff_defaults: {
        required_fields: ["affected_outputs", "verification_summary"]
      },
      tool_hints: {
        cursor: {
          keep_edits_in: ["candidates/**"]
        }
      }
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(topogramRoot, "topogram", "workflow-presets", "inactive-provider-adoption.json"),
    JSON.stringify({
      id: "team_preset_inactive_provider_adoption",
      label: "Inactive Provider Adoption",
      kind: "team_workflow_preset",
      adoption_state: "accept",
      active: false,
      priority: 500,
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      preferred_queries: ["should-not-apply"]
    }, null, 2)
  );

  const payload = buildResolvedWorkflowContextPayload({
    workspace: topogramRoot,
    taskModeArtifact: {
      mode: "import-adopt",
      preferred_context_artifacts: ["candidates/reconcile/adoption-plan.agent.json"],
      write_scope: { safe_to_edit: ["candidates/**"] },
      verification_targets: {
        generated_checks: ["reconcile-review"]
      }
    },
    selectors: {
      mode: "import-adopt",
      task_class: "import-adopt",
      provider_id: "aws_generic",
      integration_categories: ["provider_adoption"]
    }
  });

  assert.equal(payload.type, "resolved_workflow_context_query");
  assert.equal(payload.resolved_task_mode, "import-adopt");
  assert.deepEqual(payload.preferred_queries.slice(0, 4), [
    "import-plan",
    "risk-summary",
    "review-packet",
    "verification-targets"
  ]);
  assert.ok(payload.effective_review_policy.block_on.includes("manual_decision"));
  assert.deepEqual(payload.effective_multi_agent_policy, {
    allowed: false,
    default_strategy: "parallel_review_then_serialized_adoption"
  });
  assert.ok(payload.effective_handoff_defaults.required_fields.includes("affected_outputs"));
  assert.deepEqual(payload.tool_hints.cursor, {
    summary_style: "concise",
    keep_edits_in: ["candidates/**"]
  });
  assert.equal(payload.applied_presets.length, 2);
  assert.ok(payload.skipped_presets.some((preset) => preset.id === "team_preset_inactive_provider_adoption"));
  assert.ok(payload.field_resolution.preferred_queries.length > 0);
  assert.ok(payload.policy_notes.some((note) => /manifest-declared workflow preset\(s\) are not yet imported/i.test(note)));
  assert.equal(payload.workflow_presets.provider_manifest_summary.missing_declared_workflow_preset_count, 1);
  assert.equal(payload.conflict_notes.length, 1);
  assert.match(payload.conflict_notes[0], /overrode an earlier task-mode recommendation/);
});

test("buildWorkflowPresetActivationPayload reports active, skipped, and manifest-declared workflow presets", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-workflow-preset-activation-"));
  const topogramRoot = path.join(workspaceRoot, "topogram");
  fs.mkdirSync(path.join(topogramRoot, "workflow-presets"), { recursive: true });
  fs.mkdirSync(path.join(topogramRoot, "candidates", "providers", "workflow-presets"), { recursive: true });
  fs.mkdirSync(path.join(topogramRoot, "candidates", "providers", "manifests"), { recursive: true });

  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "manifests", "teamcity_generic.json"),
    JSON.stringify({
      provider: { id: "teamcity_generic", kind: "deployment_provider", display_name: "TeamCity Generic" },
      requirements: { workflow_core_version: "1" },
      review_defaults: { workflow_presets: "review_required" },
      exports: {
        workflow_presets: [
          { id: "provider_preset_teamcity_ci", path: "workflow-presets/provider_preset_teamcity_ci.json", kind: "provider_workflow_preset" },
          { id: "provider_preset_invalid", kind: "wrong_kind" }
        ]
      }
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(topogramRoot, "candidates", "providers", "workflow-presets", "provider_preset_teamcity_ci.json"),
    JSON.stringify({
      id: "provider_preset_teamcity_ci",
      kind: "provider_workflow_preset",
      label: "TeamCity CI Review",
      provider: { id: "teamcity_generic", kind: "deployment_provider" },
      adoption_state: "accept",
      applies_to: { task_classes: ["import-adopt"], integration_categories: ["provider_adoption"] }
    }, null, 2)
  );
  fs.writeFileSync(
    path.join(topogramRoot, "workflow-presets", "team_preset_manual_only.json"),
    JSON.stringify({
      id: "team_preset_manual_only",
      kind: "team_workflow_preset",
      label: "Manual Only",
      adoption_state: "accept",
      activation: { manual_only: true },
      applies_to: { task_classes: ["import-adopt"] }
    }, null, 2)
  );

  const payload = buildWorkflowPresetActivationPayload({
    workspace: topogramRoot,
    taskModeArtifact: {
      mode: "import-adopt",
      write_scope: { safe_to_edit: ["candidates/**"] },
      verification_targets: { generated_checks: ["reconcile-review"] }
    },
    selectors: {
      mode: "import-adopt",
      task_class: "import-adopt",
      integration_categories: ["provider_adoption"]
    }
  });

  assert.equal(payload.type, "workflow_preset_activation_query");
  assert.equal(payload.summary.active_provider_count, 1);
  assert.equal(payload.summary.active_team_count, 0);
  assert.ok(payload.skipped_presets.some((preset) => preset.id === "team_preset_manual_only" && preset.reason === "manual_only"));
  assert.equal(payload.provider_manifest_declarations.find((entry) => entry.declaration_id === "provider_preset_invalid").valid, false);
  assert.equal(payload.summary.missing_declared_workflow_preset_count, 1);
});

test("buildChangePlanPayload, diff summary, and change review packet stay composable", () => {
  const graph = makeChangePlanGraph();
  const diffArtifact = {
    baseline_root: "/tmp/baseline",
    review_boundary_changes: [{ kind: "capability", id: "cap_request_article_revision" }],
    affected_maintained_surfaces: { maintained_files_in_scope: ["product/app/src/issues.js"] },
    affected_verifications: [{ id: "ver_article_review_flow" }],
    entities: [{ id: "entity_article" }],
    capabilities: [{ id: "cap_update_article" }],
    rules: [],
    workflows: [],
    journeys: [],
    shapes: [],
    projections: []
  };
  const changePlan = buildChangePlanPayload({
    graph,
    taskModeArtifact: {
      mode: "modeling",
      summary: { focus: "Canonical Topogram meaning changes" },
      preferred_context_artifacts: ["cap_request_article_revision.context-slice.json"],
      next_action: { kind: "review_diff_impact" },
      write_scope: { safe_to_edit: ["topogram/**"] },
      verification_targets: { generated_checks: ["compile-check", "runtime-check"] }
    },
    sliceArtifact: {
      focus: { kind: "capability", id: "cap_request_article_revision" },
      review_boundary: { automation_class: "review_required" },
      ownership_boundary: { canonical_topogram: { owner: "human" } }
    },
    diffArtifact,
    maintainedBoundaryArtifact: {
      summary: { no_go_count: 0 },
      maintained_files_in_scope: ["product/app/src/issues.js"],
      seams: [
        {
          seam_id: "seam_issues_detail_presenter",
          label: "issues detail presenter",
          kind: "ui_presenter",
          ownership_class: "contract_bound",
          status: "review_required",
          maintained_modules: ["product/app/src/issues.js"],
          emitted_dependencies: ["proj_ui_web"],
          allowed_change_classes: ["safe", "review_required"],
          drift_signals: ["emitted_contract_changed"],
          proof_stories: [
            {
              classification: "accepted_change",
              relativePath: "product/app/proof/issues-ownership-visibility-story.md",
              review_boundary: { automation_class: "safe" }
            }
          ]
        }
      ],
      proof_stories: [
        {
          classification: "accepted_change",
          relativePath: "product/app/proof/issues-ownership-visibility-story.md",
          maintained_files: ["product/app/src/issues.js"],
          review_boundary: { automation_class: "safe" }
        }
      ]
    }
  });

  const diffSummary = summarizeDiffArtifact(diffArtifact);
  const risk = classifyRisk({
    reviewBoundary: changePlan.review_boundary,
    maintainedBoundary: changePlan.maintained_boundary,
    diffSummary,
    verificationTargets: changePlan.verification_targets,
    maintainedRisk: buildMaintainedRiskSummary({
      maintainedImpacts: changePlan.maintained_impacts,
      maintainedBoundary: changePlan.maintained_boundary,
      diffSummary
    })
  });
  const maintainedRisk = buildMaintainedRiskSummary({
    maintainedImpacts: changePlan.maintained_impacts,
    maintainedBoundary: changePlan.maintained_boundary,
    diffSummary
  });
  const reviewPacket = buildReviewPacketPayloadForChangePlan({ changePlan, risk });
  const riskSummary = buildRiskSummaryPayload({ source: "change-plan", risk, nextAction: changePlan.next_action, maintainedRisk });

  assert.equal(changePlan.type, "change_plan_query");
  assert.equal(diffSummary.review_boundary_change_count, 1);
  assert.equal(diffSummary.affected_output_count, 0);
  assert.equal(diffSummary.affected_seam_count, 0);
  assert.equal(changePlan.change_summary.has_diff_baseline, true);
  assert.equal(changePlan.change_summary.affected_projection_count, 4);
  assert.match(JSON.stringify(changePlan.projection_impacts), /changed_capability/);
  assert.match(JSON.stringify(changePlan.generator_targets), /api-contract-graph/);
  assert.match(JSON.stringify(changePlan.generator_targets), /ui-contract-graph/);
  assert.match(JSON.stringify(changePlan.generator_targets), /ui-web-contract/);
  assert.match(JSON.stringify(changePlan.generator_targets), /db-contract-graph/);
  assert.match(JSON.stringify(changePlan.generator_targets), /sveltekit-app/);
  assert.equal(changePlan.maintained_impacts.maintained_code_likely_impacted, true);
  assert.equal(changePlan.maintained_impacts.maintained_files_in_scope[0], "product/app/src/issues.js");
  assert.equal(changePlan.change_summary.affected_output_count, 1);
  assert.equal(changePlan.change_summary.affected_seam_count, 1);
  assert.equal(changePlan.maintained_impacts.affected_outputs[0].output_id, "maintained_app");
  assert.ok(changePlan.maintained_impacts.affected_outputs[0].verification_targets);
  assert.equal(changePlan.maintained_impacts.affected_seams[0].seam_id, "seam_issues_detail_presenter");
  assert.match(JSON.stringify(changePlan.alignment_recommendations), /seam_issues_detail_presenter/);
  assert.match(JSON.stringify(changePlan.alignment_recommendations), /maintained_app/);
  assert.match(JSON.stringify(changePlan.alignment_recommendations), /output_verification_targets/);
  assert.match(JSON.stringify(changePlan.alignment_recommendations), /run_verification_targets/);
  assert.equal(riskSummary.type, "risk_summary_query");
  assert.equal(riskSummary.maintained_risk.affected_outputs[0].output_id, "maintained_app");
  assert.equal(riskSummary.maintained_risk.affected_seams[0].seam_id, "seam_issues_detail_presenter");
  assert.equal(reviewPacket.type, "review_packet_query");
  assert.equal(reviewPacket.source, "change-plan");
  assert.equal(reviewPacket.change_summary.affected_seam_count, 1);
  assert.equal(reviewPacket.maintained_impacts.affected_outputs[0].output_id, "maintained_app");
  assert.equal(reviewPacket.output_verification_targets[0].output_id, "maintained_app");
  assert.match(JSON.stringify(reviewPacket.alignment_recommendations), /run_verification_targets/);
  assert.equal(reviewPacket.canonical_writes[0].path, "topogram/**");
});

test("buildChangePlanPayload derives a minimal projection closure without a diff baseline", () => {
  const graph = makeChangePlanGraph();
  const changePlan = buildChangePlanPayload({
    graph,
    taskModeArtifact: {
      mode: "modeling",
      summary: { focus: "Canonical Topogram meaning changes" },
      preferred_context_artifacts: ["cap_update_article.context-slice.json"],
      next_action: { kind: "inspect_capability" },
      write_scope: { safe_to_edit: ["topogram/**"] },
      verification_targets: { generated_checks: ["compile-check"] }
    },
    sliceArtifact: {
      focus: { kind: "capability", id: "cap_update_article" },
      depends_on: { projections: ["proj_api", "proj_ui_shared", "proj_ui_web"] },
      review_boundary: { automation_class: "review_required" },
      ownership_boundary: { canonical_topogram: { owner: "human" } }
    },
    diffArtifact: null,
    maintainedBoundaryArtifact: null
  });

  assert.equal(changePlan.change_summary.has_diff_baseline, false);
  assert.equal(changePlan.projection_impacts.length, 3);
  assert.equal(changePlan.projection_impacts[0].impact_source, "selected_capability");
  assert.deepEqual(
    changePlan.generator_targets.map((entry) => entry.target),
    ["api-contract-debug", "api-contract-graph", "server-contract", "ui-contract-debug", "ui-contract-graph", "sveltekit-app", "ui-web-contract", "ui-web-debug"]
  );
  assert.equal(changePlan.maintained_impacts.maintained_code_likely_impacted, false);
});

test("buildChangePlanPayload prefers diff-driven affected seams when maintained proof stories are in scope", () => {
  const graph = makeChangePlanGraph();
  const changePlan = buildChangePlanPayload({
    graph,
    taskModeArtifact: {
      mode: "modeling",
      summary: { focus: "Canonical Topogram meaning changes" },
      preferred_context_artifacts: ["context-diff.json"],
      next_action: { kind: "review_diff_impact" },
      write_scope: { safe_to_edit: ["topogram/**"] },
      verification_targets: { generated_checks: ["compile-check", "runtime-check"] }
    },
    sliceArtifact: {
      focus: { kind: "capability", id: "cap_update_article" },
      review_boundary: { automation_class: "review_required" },
      ownership_boundary: { canonical_topogram: { owner: "human" } }
    },
    diffArtifact: {
      baseline_root: "/tmp/baseline",
      review_boundary_changes: [],
      affected_maintained_surfaces: {
        ownership_interpretation: {
          generated_only_impact: false,
          maintained_code_impact: true,
          human_review_required_impact: true
        },
        maintained_files_in_scope: ["product/app/src/issues.js"],
        affected_seams: [
          {
            seam_id: "seam_visibility_guard",
            label: "visibility guard",
            kind: "policy_interpretation",
            ownership_class: "out_of_bounds",
            status: "no_go",
            maintained_modules: ["product/app/src/issues.js"],
            emitted_dependencies: ["proj_ui_web", "journey_article_editing"],
            allowed_change_classes: ["no_go"],
            drift_signals: ["emitted_contract_changed", "workflow_state_changed"],
            proof_stories: [
              {
                classification: "no_go",
                relativePath: "product/app/proof/issues-ownership-visibility-drift-story.md",
                review_boundary: { automation_class: "no_go" }
              }
            ]
          }
        ],
        proof_stories: [
          {
            classification: "no_go",
            relativePath: "product/app/proof/issues-ownership-visibility-drift-story.md",
            maintained_files: ["product/app/src/issues.js"],
            review_boundary: { automation_class: "no_go" }
          }
        ]
      },
      affected_verifications: [],
      entities: [{ id: "entity_article" }],
      capabilities: [],
      rules: [],
      workflows: [],
      journeys: [],
      shapes: [],
      projections: []
    },
    maintainedBoundaryArtifact: {
      summary: { no_go_count: 1 },
      maintained_files_in_scope: ["product/app/src/issues.js", "product/app/src/content-approval.js"],
      seams: [
        {
          seam_id: "seam_unrelated_boundary_entry",
          label: "unrelated boundary entry",
          kind: "ui_presenter",
          ownership_class: "contract_bound",
          status: "review_required",
          maintained_modules: ["product/app/src/content-approval.js"],
          emitted_dependencies: ["proj_ui_web"],
          allowed_change_classes: ["review_required"],
          drift_signals: ["emitted_contract_changed"],
          proof_stories: []
        }
      ],
      proof_stories: []
    }
  });

  assert.equal(changePlan.change_summary.affected_seam_count, 1);
  assert.equal(changePlan.change_summary.affected_output_count, 1);
  assert.equal(changePlan.maintained_impacts.affected_outputs[0].output_id, "maintained_app");
  assert.equal(changePlan.maintained_impacts.affected_seams[0].seam_id, "seam_visibility_guard");
  assert.equal(changePlan.maintained_impacts.affected_seams[0].status, "no_go");
  assert.equal(changePlan.maintained_impacts.impact_scope, "review_sensitive");
});

test("buildMaintainedDriftPayload summarizes seam severity and maintained follow-up", () => {
  const payload = buildMaintainedDriftPayload({
    diffArtifact: {
      baseline_root: "/tmp/baseline",
      review_boundary_changes: [],
      affected_verifications: [{ id: "ver_article_review_flow" }],
      affected_maintained_surfaces: {
        ownership_interpretation: {
          generated_only_impact: false,
          maintained_code_impact: true,
          human_review_required_impact: true
        },
        maintained_files_in_scope: ["product/app/src/issues.js"],
        affected_seams: [
          {
            seam_id: "seam_visibility_guard",
            label: "visibility guard",
            kind: "policy_interpretation",
            ownership_class: "out_of_bounds",
            status: "no_go",
            maintained_modules: ["product/app/src/issues.js"],
            emitted_dependencies: ["proj_ui_web"],
            allowed_change_classes: ["no_go"],
            drift_signals: ["emitted_contract_changed"],
            proof_stories: [
              {
                classification: "no_go",
                relativePath: "product/app/proof/issues-ownership-visibility-drift-story.md",
                review_boundary: { automation_class: "no_go" }
              }
            ]
          },
          {
            seam_id: "seam_detail_presenter",
            label: "detail presenter",
            kind: "ui_presenter",
            ownership_class: "contract_bound",
            status: "review_required",
            maintained_modules: ["product/app/src/issues.js"],
            emitted_dependencies: ["proj_ui_web"],
            allowed_change_classes: ["safe", "review_required"],
            drift_signals: ["emitted_contract_changed"],
            proof_stories: []
          }
        ],
        proof_stories: [
          {
            classification: "no_go",
            relativePath: "product/app/proof/issues-ownership-visibility-drift-story.md",
            maintained_files: ["product/app/src/issues.js"],
            review_boundary: { automation_class: "no_go" }
          }
        ]
      }
    },
    maintainedBoundaryArtifact: {
      human_owned_seams: ["visibility guard", "detail presenter"],
      maintained_files_in_scope: ["product/app/src/issues.js"]
    },
    verificationTargets: {
      maintained_app_checks: ["product/app/scripts/runtime-check.mjs"]
    },
    nextAction: { kind: "inspect_maintained_drift" }
  });

  assert.equal(payload.type, "maintained_drift_query");
  assert.equal(payload.summary.affected_seam_count, 2);
  assert.equal(payload.summary.affected_output_count, 1);
  assert.equal(payload.summary.highest_severity, "no_go");
  assert.equal(payload.summary.status_counts.no_go, 1);
  assert.equal(payload.outputs[0].output_id, "maintained_app");
  assert.equal(payload.outputs[0].summary.affected_seam_count, 2);
  assert.equal(payload.outputs[0].verification_targets.maintained_app_checks[0], "product/app/scripts/runtime-check.mjs");
  assert.equal(payload.affected_seams[0].seam_id, "seam_visibility_guard");
  assert.equal(payload.verification_targets.maintained_app_checks[0], "product/app/scripts/runtime-check.mjs");
  assert.equal(payload.recommended_next_action.kind, "inspect_maintained_drift");
});

test("buildMaintainedConformancePayload summarizes current seam posture conservatively", () => {
  const payload = buildMaintainedConformancePayload({
    graph: makeChangePlanGraph(),
    diffArtifact: null,
    maintainedBoundaryArtifact: {
      seams: [
        {
          seam_id: "seam_ui_presenter",
          label: "ui presenter",
          kind: "ui_presenter",
          ownership_class: "contract_bound",
          status: "review_required",
          maintained_modules: ["product/app/src/issues.js"],
          emitted_dependencies: ["proj_ui_web"],
          allowed_change_classes: ["safe", "review_required"],
          drift_signals: ["emitted_contract_changed"],
          proof_stories: [
            {
              classification: "accepted_change",
              relativePath: "product/app/proof/issues-ownership-visibility-story.md",
              review_boundary: { automation_class: "review_required" }
            }
          ]
        },
        {
          seam_id: "seam_policy_guard",
          label: "policy guard",
          kind: "policy_interpretation",
          ownership_class: "out_of_bounds",
          status: "no_go",
          maintained_modules: ["product/app/src/issues.js"],
          emitted_dependencies: ["proj_ui_web"],
          allowed_change_classes: ["no_go"],
          drift_signals: ["emitted_contract_changed"],
          proof_stories: [
            {
              classification: "no_go",
              relativePath: "product/app/proof/issues-ownership-visibility-drift-story.md",
              review_boundary: { automation_class: "no_go" }
            }
          ]
        },
        {
          seam_id: "seam_unverifiable",
          label: "unverifiable seam",
          kind: "verification_harness",
          ownership_class: "advisory_only",
          status: "aligned",
          maintained_modules: [],
          emitted_dependencies: [],
          allowed_change_classes: ["review_required"],
          drift_signals: [],
          proof_stories: []
        }
      ]
    },
    verificationTargets: {
      generated_checks: ["compile-check"],
      maintained_app_checks: ["product/app/scripts/runtime-check.mjs"],
      verification_ids: ["ver_article_review_flow"]
    },
    nextAction: { kind: "inspect_verification_targets" }
  });

  assert.equal(payload.type, "maintained_conformance_query");
  assert.equal(payload.conformance_status, "no_go");
  assert.equal(payload.summary.governed_seam_count, 3);
  assert.equal(payload.summary.no_go_count, 1);
  assert.equal(payload.summary.review_required_count, 1);
  assert.equal(payload.summary.unverifiable_count, 1);
  assert.equal(payload.outputs[0].output_id, "maintained_app");
  assert.equal(payload.outputs[0].conformance_status, "no_go");
  assert.equal(payload.outputs[0].verification_targets.maintained_app_checks[0], "product/app/scripts/runtime-check.mjs");
  assert.equal(payload.seams[0].conformance_state, "no_go");
  assert.equal(payload.seams[2].conformance_state, "unverifiable");
  assert.equal(payload.recommended_next_action.kind, "inspect_verification_targets");
});

test("buildMaintainedConformancePayload marks diff-backed governed seams as drift suspected", () => {
  const payload = buildMaintainedConformancePayload({
    graph: makeChangePlanGraph(),
    diffArtifact: {
      baseline_root: "/tmp/baseline",
      review_boundary_changes: [],
      affected_verifications: [],
      affected_maintained_surfaces: {
        affected_seams: [
          {
            seam_id: "seam_action_bar",
            label: "action bar",
            kind: "workflow_affordance",
            ownership_class: "advisory_only",
            status: "manual_decision",
            maintained_modules: ["product/app/src/content-approval-change-guards.js"],
            emitted_dependencies: ["cap_request_article_revision"],
            allowed_change_classes: ["manual_decision"],
            drift_signals: ["workflow_state_changed"],
            proof_stories: [
              {
                classification: "guarded_manual_decision",
                relativePath: "product/app/proof/content-approval-workflow-decision-story.md",
                review_boundary: { automation_class: "manual_decision" }
              }
            ]
          }
        ]
      }
    },
    maintainedBoundaryArtifact: { seams: [] },
    verificationTargets: {
      generated_checks: ["compile-check"]
    },
    nextAction: { kind: "inspect_maintained_impact" }
  });

  assert.equal(payload.conformance_status, "drift_suspected");
  assert.equal(payload.summary.drift_suspected_count, 1);
  assert.equal(payload.outputs[0].output_id, "maintained_app");
  assert.equal(payload.outputs[0].conformance_status, "drift_suspected");
  assert.equal(payload.outputs[0].verification_targets.generated_checks[0], "compile-check");
  assert.equal(payload.seams[0].conformance_state, "drift_suspected");
});

test("buildSeamCheckPayload reports seam probes and stale diff pressure", () => {
  const payload = buildSeamCheckPayload({
    graph: makeRootedGraphWithMaintainedFiles(),
    diffArtifact: {
      baseline_root: "/tmp/baseline",
      affected_maintained_surfaces: {
        affected_seams: [
          {
            seam_id: "seam_article_detail",
            output_id: "maintained_app",
            label: "article detail",
            kind: "ui_presenter",
            ownership_class: "contract_bound",
            status: "review_required",
            maintained_modules: ["product/app/src/content-approval-change-guards.js"],
            emitted_dependencies: ["cap_request_article_revision", "journey_editorial_review_and_revision"],
            proof_stories: [
              {
                classification: "accepted_change",
                relativePath: "product/app/proof/content-approval-workflow-decision-story.md",
                maintained_files: ["product/app/src/content-approval-change-guards.js"],
                review_boundary: { automation_class: "review_required" }
              }
            ]
          }
        ]
      }
    },
    maintainedBoundaryArtifact: {
      outputs: [
        {
          output_id: "maintained_app",
          verification_targets: {
            generated_checks: ["compile-check"],
            maintained_app_checks: ["runtime-check"]
          }
        }
      ]
    },
    verificationTargets: {
      generated_checks: ["compile-check"],
      maintained_app_checks: ["runtime-check"]
    }
  });

  assert.equal(payload.type, "seam_check_query");
  assert.equal(payload.summary.stale_count, 1);
  assert.equal(payload.seams[0].check_status, "stale");
  assert.match(JSON.stringify(payload.seams[0].probes), /maintained_modules_present/);
  assert.match(JSON.stringify(payload.seams[0].probes), /emitted_dependencies_resolved/);
  assert.match(JSON.stringify(payload.seams[0].probes), /maintained_modules_exist/);
  assert.match(JSON.stringify(payload.seams[0].probes), /proof_story_files_exist/);
  assert.match(JSON.stringify(payload.seams[0].probes), /proof_story_maintained_files_in_scope/);
  assert.match(JSON.stringify(payload.seams[0].probes), /emitted_dependency_tokens_corroborated/);
  assert.match(JSON.stringify(payload.seams[0].probes), /verification_targets_cover_seam_kind/);
  assert.match(JSON.stringify(payload.seams[0].probes), /\"probe_id\":\"maintained_modules_exist\",\"status\":\"pass\"/);
  assert.match(JSON.stringify(payload.seams[0].probes), /\"probe_id\":\"proof_story_files_exist\",\"status\":\"pass\"/);
  assert.match(JSON.stringify(payload.seams[0].probes), /\"probe_id\":\"proof_story_maintained_files_in_scope\",\"status\":\"pass\"/);
  assert.match(JSON.stringify(payload.seams[0].probes), /\"probe_id\":\"emitted_dependency_tokens_corroborated\",\"status\":\"pass\"/);
});

test("maintained proof metadata includes the issues cross-surface alignment story", () => {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
  const boundary = buildMaintainedBoundaryArtifact({
    proofStories: maintainedProofMetadata({ root: repoRoot })
  });

  const crossSurfaceStory = boundary.proof_stories.find(
    (story) => story.relativePath === "product/app/proof/issues-cross-surface-alignment-story.md"
  );
  const crossSurfaceSeams = boundary.seams.filter((seam) => seam.seam_family_id === "issues_cross_surface_alignment");

  assert.ok(crossSurfaceStory);
  assert.equal(crossSurfaceStory.seam_family_id, "issues_cross_surface_alignment");
  assert.equal(crossSurfaceStory.seam_family_label, "issues cross-surface ownership alignment");
  assert.equal(crossSurfaceSeams.length, 3);
  assert.deepEqual(
    crossSurfaceSeams.map((seam) => seam.label),
    ["issues detail action state", "issues list/card summary state", "issues route and action metadata"]
  );
});

test("maintained payloads group cross-surface issues seams under one family", () => {
  const graph = makeIssuesCrossSurfaceGraph();
  const affectedSeams = [
    {
      seam_id: "seam_issues_detail_action_state",
      seam_family_id: "issues_cross_surface_alignment",
      seam_family_label: "issues cross-surface ownership alignment",
      output_id: "maintained_app",
      label: "issues detail action state",
      kind: "ui_presenter",
      ownership_class: "contract_bound",
      status: "review_required",
      maintained_modules: ["product/app/src/issues.js"],
      emitted_dependencies: ["proj_web", "journey_issue_resolution_and_closure"],
      proof_stories: [
        {
          classification: "accepted_change",
          relativePath: "product/app/proof/issues-cross-surface-alignment-story.md",
          maintained_files: ["product/app/src/issues.js"],
          seam_family_id: "issues_cross_surface_alignment",
          seam_family_label: "issues cross-surface ownership alignment",
          review_boundary: { automation_class: "review_required" }
        }
      ]
    },
    {
      seam_id: "seam_issues_list_card_summary_state",
      seam_family_id: "issues_cross_surface_alignment",
      seam_family_label: "issues cross-surface ownership alignment",
      output_id: "maintained_app",
      label: "issues list/card summary state",
      kind: "ui_presenter",
      ownership_class: "contract_bound",
      status: "review_required",
      maintained_modules: ["product/app/src/issues.js"],
      emitted_dependencies: ["proj_web", "journey_issue_creation_and_assignment"],
      proof_stories: [
        {
          classification: "accepted_change",
          relativePath: "product/app/proof/issues-cross-surface-alignment-story.md",
          maintained_files: ["product/app/src/issues.js"],
          seam_family_id: "issues_cross_surface_alignment",
          seam_family_label: "issues cross-surface ownership alignment",
          review_boundary: { automation_class: "review_required" }
        }
      ]
    },
    {
      seam_id: "seam_issues_route_and_action_metadata",
      seam_family_id: "issues_cross_surface_alignment",
      seam_family_label: "issues cross-surface ownership alignment",
      output_id: "maintained_app",
      label: "issues route and action metadata",
      kind: "route_glue",
      ownership_class: "contract_bound",
      status: "review_required",
      maintained_modules: ["product/app/src/issues.js"],
      emitted_dependencies: ["proj_api", "proj_web", "journey_issue_resolution_and_closure"],
      proof_stories: [
        {
          classification: "accepted_change",
          relativePath: "product/app/proof/issues-cross-surface-alignment-story.md",
          maintained_files: ["product/app/src/issues.js"],
          seam_family_id: "issues_cross_surface_alignment",
          seam_family_label: "issues cross-surface ownership alignment",
          review_boundary: { automation_class: "review_required" }
        }
      ]
    }
  ];

  const maintainedBoundaryArtifact = {
    maintained_files_in_scope: ["product/app/src/issues.js"],
    outputs: [
      {
        output_id: "maintained_app",
        label: "Maintained App",
        kind: "maintained_runtime",
        root_paths: ["product/app/**"],
        maintained_files_in_scope: ["product/app/src/issues.js"],
        seams: affectedSeams.map((seam) => ({ seam_id: seam.seam_id })),
        proof_stories: [
          {
            classification: "accepted_change",
            relativePath: "product/app/proof/issues-cross-surface-alignment-story.md",
            maintained_files: ["product/app/src/issues.js"],
            seam_family_id: "issues_cross_surface_alignment",
            seam_family_label: "issues cross-surface ownership alignment",
            review_boundary: { automation_class: "review_required" }
          }
        ]
      }
    ],
    seams: affectedSeams,
    proof_stories: [
      {
        classification: "accepted_change",
        relativePath: "product/app/proof/issues-cross-surface-alignment-story.md",
        maintained_files: ["product/app/src/issues.js"],
        seam_family_id: "issues_cross_surface_alignment",
        seam_family_label: "issues cross-surface ownership alignment",
        review_boundary: { automation_class: "review_required" }
      }
    ]
  };
  const diffArtifact = {
    baseline_root: "/tmp/baseline",
    review_boundary_changes: [],
    affected_verifications: [],
    affected_maintained_surfaces: {
      maintained_files_in_scope: ["product/app/src/issues.js"],
      affected_seams: affectedSeams,
      proof_stories: maintainedBoundaryArtifact.proof_stories
    }
  };
  const verificationTargets = {
    generated_checks: ["compile-check"],
    maintained_app_checks: ["product/app/scripts/runtime-check.mjs"]
  };

  const driftPayload = buildMaintainedDriftPayload({
    diffArtifact,
    maintainedBoundaryArtifact,
    verificationTargets,
    nextAction: { kind: "inspect_maintained_drift" }
  });
  const conformancePayload = buildMaintainedConformancePayload({
    graph,
    diffArtifact,
    maintainedBoundaryArtifact,
    verificationTargets,
    nextAction: { kind: "inspect_verification_targets" }
  });
  const seamCheckPayload = buildSeamCheckPayload({
    graph,
    diffArtifact,
    maintainedBoundaryArtifact,
    verificationTargets
  });

  assert.equal(driftPayload.summary.affected_seam_count, 3);
  assert.equal(driftPayload.summary.affected_seam_family_count, 1);
  assert.deepEqual(driftPayload.affected_seam_families, ["issues_cross_surface_alignment"]);
  assert.deepEqual(driftPayload.outputs[0].seam_families, ["issues_cross_surface_alignment"]);
  assert.equal(driftPayload.outputs[0].summary.affected_seam_family_count, 1);
  assert.equal(driftPayload.affected_seams[0].seam_family_label, "issues cross-surface ownership alignment");

  assert.equal(conformancePayload.summary.affected_seam_family_count, 1);
  assert.deepEqual(conformancePayload.summary.affected_seam_families, ["issues_cross_surface_alignment"]);
  assert.equal(conformancePayload.outputs[0].summary.affected_seam_family_count, 1);
  assert.deepEqual(conformancePayload.outputs[0].summary.affected_seam_families, ["issues_cross_surface_alignment"]);

  assert.equal(seamCheckPayload.summary.seam_family_count, 1);
  assert.equal(seamCheckPayload.seams[0].seam_family_id, "issues_cross_surface_alignment");
});

test("buildChangePlanPayload surfaces direct projection changes conservatively", () => {
  const graph = makeChangePlanGraph();
  const changePlan = buildChangePlanPayload({
    graph,
    taskModeArtifact: {
      mode: "modeling",
      summary: { focus: "Canonical Topogram meaning changes" },
      preferred_context_artifacts: ["proj_ui_web.context-slice.json", "context-diff.json"],
      next_action: { kind: "inspect_projection" },
      write_scope: { safe_to_edit: ["topogram/**"] },
      verification_targets: { generated_checks: ["compile-check", "runtime-check"] }
    },
    sliceArtifact: {
      focus: { kind: "projection", id: "proj_ui_web" },
      review_boundary: { automation_class: "review_required" },
      ownership_boundary: { canonical_topogram: { owner: "human" } }
    },
    diffArtifact: {
      baseline_root: "/tmp/baseline",
      review_boundary_changes: [],
      affected_maintained_surfaces: { maintained_files_in_scope: [] },
      affected_verifications: [],
      entities: [],
      capabilities: [],
      rules: [],
      workflows: [{ id: "workflow_article_review" }],
      journeys: [{ id: "journey_article_editing" }],
      shapes: [],
      projections: [{ id: "proj_ui_web" }]
    },
    maintainedBoundaryArtifact: null
  });

  const webImpact = changePlan.projection_impacts.find((impact) => impact.projection_id === "proj_ui_web");
  assert.equal(webImpact.impact_source, "direct_projection_change");
  assert.match(JSON.stringify(webImpact.impact_sources), /changed_workflow/);
  assert.match(JSON.stringify(webImpact.impact_sources), /changed_journey/);
  assert.deepEqual(
    changePlan.generator_targets
      .filter((entry) => entry.projection_id === "proj_ui_web")
      .map((entry) => entry.target),
    ["sveltekit-app", "ui-web-contract", "ui-web-debug"]
  );
});

test("buildCanonicalWritesPayloadForImportPlan keeps canonical destination metadata", () => {
  const result = buildCanonicalWritesPayloadForImportPlan([
    {
      id: "issue:capability:cap_update_issue",
      current_state: "stage",
      recommended_state: "customize",
      canonical_rel_path: "capabilities/cap-update-issue.tg"
    }
  ]);

  assert.equal(result.type, "canonical_writes_query");
  assert.equal(result.source, "import-plan");
  assert.equal(result.canonical_writes[0].canonical_path, "topogram/capabilities/cap-update-issue.tg");
});

test("buildAuthHintsQueryPayload separates hint closure states and stale bundles", () => {
  const query = buildAuthHintsQueryPayload(
    {
      workspace: "/tmp/topogram",
      candidate_model_bundles: [
        {
          slug: "article",
          operator_summary: {
            authClosureSummary: {
              status: "high_risk"
            },
            authAging: {
              repeatCount: 2,
              escalationLevel: "stale_high_risk",
              escalationReason: "This bundle has stayed high risk for 2 reconcile runs in a row."
            }
          },
          auth_permission_hints: [
            {
              permission: "articles.update",
              confidence: "medium",
              closure_state: "unresolved",
              closure_reason: "Still blocked on review.",
              why_inferred: "Route guard naming matched update policy.",
              review_guidance: "Confirm the permission rule.",
              related_capabilities: ["cap_update_article"]
            }
          ],
          auth_claim_hints: [
            {
              claim: "reviewer",
              claim_value: "true",
              confidence: "medium",
              closure_state: "deferred",
              closure_reason: "Reviewed but not applied.",
              why_inferred: "Review-oriented capability naming matched reviewer role.",
              review_guidance: "Confirm the reviewer claim rule.",
              related_capabilities: ["cap_approve_article"]
            }
          ],
          auth_ownership_hints: [
            {
              ownership: "owner_or_admin",
              ownership_field: "author_id",
              confidence: "medium",
              closure_state: "adopted",
              closure_reason: "Applied into the canonical projection.",
              why_inferred: "Ownership field naming matched canonical write access.",
              review_guidance: "No further review needed.",
              related_capabilities: ["cap_update_article"]
            }
          ],
          auth_role_guidance: [
            {
              role_id: "role_reviewer",
              confidence: "medium",
              followup_action: "promote_role",
              followup_label: "promote role",
              followup_reason: "No canonical reviewer role exists yet.",
              review_guidance: "Promote the reviewer role first.",
              related_capabilities: ["cap_approve_article"],
              related_docs: []
            }
          ]
        }
      ],
      bundle_priorities: [
        {
          bundle: "article",
          auth_closure_summary: {
            status: "high_risk",
            label: "high risk",
            adopted: 1,
            deferred: 1,
            unresolved: 1,
            reason: "At least one auth hint is unresolved."
          },
          auth_aging_summary: {
            repeatCount: 2,
            escalationLevel: "stale_high_risk",
            escalationReason: "This bundle has stayed high risk for 2 reconcile runs in a row."
          },
          next_review_groups: [
            {
              id: "projection_review:proj_api",
              type: "projection_review",
              reason: "Projection review is still required."
            }
          ],
          recommend_bundle_review_selector: "bundle-review:article",
          recommend_from_plan: true
        }
      ]
    },
    {
      workspace: "/tmp/topogram",
      next_bundle: {
        bundle: "article"
      }
    }
  );

  assert.equal(query.type, "auth_hints_query");
  assert.equal(query.summary.total_bundles_with_auth_hints, 1);
  assert.equal(query.summary.hint_closure_counts.unresolved, 1);
  assert.equal(query.summary.hint_closure_counts.deferred, 1);
  assert.equal(query.summary.hint_closure_counts.adopted, 1);
  assert.equal(query.summary.bundle_auth_closure_counts.high_risk, 1);
  assert.equal(query.summary.stale_high_risk_bundle_count, 1);
  assert.equal(query.high_risk_bundles.length, 1);
  assert.equal(query.stale_high_risk_bundles.length, 1);
  assert.equal(query.unresolved_hints[0].projection_patch_action, "apply_projection_permission_patch");
  assert.equal(query.deferred_hints[0].projection_patch_action, "apply_projection_auth_patch");
  assert.equal(query.adopted_hints[0].projection_patch_action, "apply_projection_ownership_patch");
  assert.equal(query.auth_role_followup[0].followup_action, "promote_role");
  assert.deepEqual(
    query.recommended_steps.map((step) => step.action),
    ["review_projection_group", "promote_role_first", "run_from_plan_write"]
  );
});

test("buildAuthReviewPacketPayload narrows auth review state to one bundle", () => {
  const report = {
    workspace: "/tmp/topogram",
    candidate_model_bundles: [
      {
        slug: "article",
        operator_summary: {
          authClosureSummary: {
            status: "high_risk",
            label: "high risk"
          },
          authAging: {
            repeatCount: 2,
            escalationLevel: "stale_high_risk"
          }
        },
        auth_claim_hints: [
          {
            claim: "reviewer",
            claim_value: "true",
            confidence: "medium",
            closure_state: "unresolved",
            closure_reason: "Still blocked on review.",
            why_inferred: "Review-oriented capability naming matched reviewer role.",
            review_guidance: "Confirm the reviewer claim rule.",
            related_capabilities: ["cap_approve_article"]
          }
        ],
        auth_permission_hints: [
          {
            permission: "articles.read",
            confidence: "medium",
            closure_state: "deferred",
            closure_reason: "Deferred until projection review completes.",
            why_inferred: "Secured route naming matched read permission.",
            review_guidance: "Confirm the read permission.",
            related_capabilities: ["cap_list_articles"]
          }
        ],
        auth_role_guidance: [
          {
            role_id: "role_reviewer",
            confidence: "medium",
            followup_action: "promote_role",
            followup_label: "promote role",
            followup_reason: "No canonical reviewer role exists yet.",
            review_guidance: "Promote the reviewer role first.",
            related_capabilities: ["cap_approve_article"],
            related_docs: []
          }
        ]
      }
    ]
  };
  const adoptionStatus = {
    workspace: "/tmp/topogram",
    bundle_priorities: [
      {
        bundle: "article",
        auth_closure_summary: {
          status: "high_risk",
          label: "high risk"
        },
        auth_aging_summary: {
          repeatCount: 2,
          escalationLevel: "stale_high_risk"
        },
        next_review_groups: [
          {
            id: "projection_review:proj_api",
            type: "projection_review",
            reason: "Projection review is still required."
          }
        ],
        recommend_bundle_review_selector: "bundle-review:article",
        recommend_from_plan: true
      }
    ]
  };

  const packet = buildAuthReviewPacketPayload(report, adoptionStatus, "article");

  assert.equal(packet.type, "auth_review_packet_query");
  assert.equal(packet.bundle, "article");
  assert.equal(packet.auth_closure.status, "high_risk");
  assert.equal(packet.auth_aging.escalationLevel, "stale_high_risk");
  assert.equal(packet.next_review_selector, "projection-review:proj_api");
  assert.equal(packet.unresolved_hints.length, 1);
  assert.equal(packet.deferred_hints.length, 1);
  assert.equal(packet.auth_role_followup[0].followup_action, "promote_role");
  assert.deepEqual(
    packet.projection_patch_actions.map((entry) => entry.action),
    ["apply_projection_auth_patch", "apply_projection_permission_patch"]
  );
  assert.deepEqual(
    packet.recommended_steps.map((step) => step.action),
    ["review_projection_group", "promote_role_first", "run_from_plan_write"]
  );
});

test("buildSingleAgentPlanPayload produces an import-adopt baseline from task mode and import plan", () => {
  const taskModeArtifact = {
    mode: "import-adopt",
    summary: {
      focus: "Proposal review and adoption planning",
      preferred_start: "adoption-plan.agent.json",
      staged_item_count: 2,
      requires_human_review_count: 1,
      plan_present: true
    },
    preferred_context_artifacts: [
      "candidates/reconcile/adoption-plan.agent.json",
      "workspace.context-digest.json"
    ],
    review_emphasis: [
      "accept_map_customize_stage_reject",
      "mapping_suggestions"
    ],
    ownership_boundary: {
      canonical_semantics: "human_owned"
    },
    write_scope: {
      safe_to_edit: ["candidates/**"],
      human_owned_review_required: ["topogram/**"]
    },
    verification_targets: {
      generated_checks: ["reconcile-review"]
    },
    next_action: {
      kind: "review_staged",
      label: "Review staged proposal surfaces",
      reason: "1 staged proposal still requires human review."
    }
  };
  const importPlan = {
    review_groups: ["projection_review:proj_api"],
    requires_human_review: ["proposal:article-auth-patch"],
    staged_items: ["proposal:article-capability"]
  };

  const plan = buildSingleAgentPlanPayload({
    workspace: "/tmp/topogram",
    taskModeArtifact,
    importPlan,
    resolvedWorkflowContext: {
      type: "resolved_workflow_context_query",
      artifact_load_order: ["import-plan", "review-packet"],
      preferred_queries: ["import-plan", "review-packet"],
      effective_write_scope: { safe_to_edit: ["candidates/**"] }
    }
  });

  assert.equal(plan.type, "single_agent_plan");
  assert.equal(plan.mode, "import-adopt");
  assert.equal(plan.current_focus.label, "Proposal review and adoption planning");
  assert.equal(plan.next_action.kind, "review_staged");
  assert.deepEqual(plan.primary_artifacts, [
    "import-plan",
    "review-packet",
    "candidates/reconcile/adoption-plan.agent.json",
    "workspace.context-digest.json"
  ]);
  assert.equal(plan.review_boundaries.requires_human_review.length, 1);
  assert.equal(plan.recommended_sequence[0].action, "read_primary_artifact");
  assert.equal(plan.recommended_sequence[1].action, "inspect_adoption_state");
  assert.equal(plan.recommended_sequence[2].next_action_kind, "review_staged");
  assert.equal(plan.blocking_conditions[0].kind, "human_review_required");
  assert.equal(plan.resolved_workflow_context.type, "resolved_workflow_context_query");
});

test("buildSingleAgentPlanPayload produces a maintained-app-edit plan without import artifacts", () => {
  const taskModeArtifact = {
    mode: "maintained-app-edit",
    summary: {
      focus: "Human-owned maintained code changes constrained by emitted Topogram artifacts",
      preferred_start: "context-bundle maintained-app"
    },
    preferred_context_artifacts: [
      "context-bundle.maintained-app.json",
      "maintained-boundary.json"
    ],
    review_emphasis: [
      "accepted_vs_guarded_vs_no_go",
      "human_owned_seams"
    ],
    ownership_boundary: {
      maintained_code: "human_owned"
    },
    write_scope: {
      safe_to_edit: ["product/app/**"]
    },
    verification_targets: {
      maintained_app_checks: ["verify-product-app.sh"]
    },
    next_action: null
  };

  const plan = buildSingleAgentPlanPayload({
    workspace: "/tmp/topogram",
    taskModeArtifact
  });

  assert.equal(plan.type, "single_agent_plan");
  assert.equal(plan.mode, "maintained-app-edit");
  assert.equal(plan.primary_artifacts[0], "context-bundle.maintained-app.json");
  assert.equal(plan.recommended_sequence[1].action, "inspect_review_boundaries");
  assert.equal(plan.recommended_sequence[3].action, "run_proof_targets");
  assert.equal(plan.blocking_conditions.length, 0);
});

test("buildMultiAgentPlanPayload decomposes import-adopt into lanes, handoffs, and serialized gates", () => {
  const singleAgentPlan = {
    type: "single_agent_plan",
    workspace: "/tmp/topogram",
    mode: "import-adopt",
    summary: {
      focus: "Proposal review and adoption planning"
    },
    write_scope: {
      safe_to_edit: ["candidates/**"],
      human_owned_review_required: ["topogram/**"]
    },
    proof_targets: {
      generated_checks: ["reconcile-review"]
    }
  };
  const importPlan = {
    review_groups: ["projection_review:proj_api"],
    requires_human_review: ["article:capability:cap_approve_article"],
    proposal_surfaces: [
      {
        id: "article:capability:cap_approve_article",
        canonical_rel_path: "projections/proj-api.tg",
        recommended_state: "customize",
        projection_impacts: [{ projection_id: "proj_api" }]
      },
      {
        id: "article:journey:article_journey",
        canonical_rel_path: "docs/journeys/article_journey.md",
        recommended_state: "accept",
        projection_impacts: []
      }
    ]
  };
  const report = {
    candidate_model_bundles: [
      {
        slug: "article",
        auth_claim_hints: [
          {
            claim: "reviewer",
            claim_value: "true",
            closure_state: "unresolved",
            related_capabilities: ["cap_approve_article"],
            review_guidance: "Confirm reviewer claim rule."
          }
        ],
        auth_role_guidance: []
      }
    ]
  };
  const adoptionStatus = {
    bundle_priorities: [
      {
        bundle: "article",
        recommend_bundle_review_selector: "bundle-review:article",
        next_review_groups: [
          {
            id: "projection_review:proj_api",
            type: "projection_review",
            reason: "Projection review is still required."
          }
        ],
        recommend_from_plan: true,
        auth_closure_summary: {
          status: "high_risk"
        }
      }
    ]
  };

  const payload = buildMultiAgentPlanPayload({
    workspace: "/tmp/topogram",
    singleAgentPlan,
    importPlan,
    report,
    adoptionStatus,
    resolvedWorkflowContext: {
      type: "resolved_workflow_context_query",
      effective_review_policy: {
        block_on: ["manual_decision", "no_go"],
        escalate_categories: ["deployment_assumptions"]
      },
      effective_verification_policy: {
        required: ["reconcile-review"]
      },
      effective_write_scope: {
        safe_to_edit: ["candidates/**"]
      }
    }
  });

  assert.equal(payload.type, "multi_agent_plan");
  assert.equal(payload.mode, "import-adopt");
  assert.equal(payload.source_single_agent_plan.type, "single_agent_plan");
  assert.ok(payload.lanes.some((lane) => lane.role === "bundle_reviewer"));
  assert.ok(payload.lanes.some((lane) => lane.role === "auth_reviewer"));
  assert.ok(payload.lanes.some((lane) => lane.role === "mapping_reviewer"));
  assert.ok(payload.lanes.some((lane) => lane.role === "doc_promoter"));
  assert.equal(payload.lanes.filter((lane) => lane.role === "adoption_operator").length, 1);
  assert.equal(payload.serialized_gates[1].owner_lane, "adoption_operator");
  assert.ok(payload.handoff_packets.some((packet) => packet.to_lane === "adoption_operator"));
  assert.ok(payload.join_points.some((join) => join.join_id === "join.review_packets_ready"));
  assert.ok(payload.recommended_sequence.some((step) => step.action === "run_from_plan_write"));
  assert.equal(payload.resolved_workflow_context.type, "resolved_workflow_context_query");
  assert.ok(payload.lanes.some((lane) => lane.workflow_context_overrides));
});

test("buildWorkPacketPayload derives a bounded packet for one multi-agent lane", () => {
  const singleAgentPlan = {
    type: "single_agent_plan",
    workspace: "/tmp/topogram",
    mode: "import-adopt",
    summary: {
      focus: "Proposal review and adoption planning"
    },
    write_scope: {
      safe_to_edit: ["candidates/**"],
      human_owned_review_required: ["topogram/**"]
    },
    proof_targets: {
      generated_checks: ["reconcile-review"]
    }
  };
  const importPlan = {
    review_groups: ["projection_review:proj_api"],
    requires_human_review: ["article:capability:cap_approve_article"],
    proposal_surfaces: [
      {
        id: "article:capability:cap_approve_article",
        canonical_rel_path: "projections/proj-api.tg",
        recommended_state: "customize",
        projection_impacts: [{ projection_id: "proj_api" }]
      }
    ]
  };
  const report = {
    candidate_model_bundles: [
      {
        slug: "article",
        auth_claim_hints: [
          {
            claim: "reviewer",
            claim_value: "true",
            closure_state: "unresolved",
            related_capabilities: ["cap_approve_article"],
            review_guidance: "Confirm reviewer claim rule."
          }
        ],
        auth_role_guidance: []
      }
    ]
  };
  const adoptionStatus = {
    bundle_priorities: [
      {
        bundle: "article",
        recommend_bundle_review_selector: "bundle-review:article",
        next_review_groups: [
          {
            id: "projection_review:proj_api",
            type: "projection_review",
            reason: "Projection review is still required."
          }
        ],
        recommend_from_plan: true,
        auth_closure_summary: {
          status: "high_risk"
        }
      }
    ]
  };
  const multiAgentPlan = buildMultiAgentPlanPayload({
    workspace: "/tmp/topogram",
    singleAgentPlan,
    importPlan,
    report,
    adoptionStatus,
    resolvedWorkflowContext: {
      type: "resolved_workflow_context_query",
      effective_write_scope: {
        safe_to_edit: ["candidates/**"]
      },
      effective_verification_policy: {
        required: ["reconcile-review"]
      }
    }
  });

  const packet = buildWorkPacketPayload({
    workspace: "/tmp/topogram",
    multiAgentPlan,
    laneId: "auth_reviewer.article"
  });

  assert.equal(packet.type, "work_packet");
  assert.equal(packet.mode, "import-adopt");
  assert.equal(packet.lane.lane_id, "auth_reviewer.article");
  assert.equal(packet.lane.role, "auth_reviewer");
  assert.equal(packet.summary.review_lane, true);
  assert.deepEqual(packet.allowed_inputs, [
    "candidates/reconcile/report.json",
    "candidates/reconcile/adoption-status.json"
  ]);
  assert.equal(packet.published_handoff_packet.packet_id, "handoff:auth-review.article");
  assert.ok(packet.overlap_rules.length >= 1);
  assert.equal(packet.recommended_steps[1].action, "review_scoped_work");
  assert.equal(packet.recommended_steps[2].action, "publish_handoff_packet");
  assert.equal(packet.resolved_workflow_context.type, "resolved_workflow_context_query");
  assert.deepEqual(packet.effective_write_scope, {
    safe_to_edit: ["candidates/**"],
    human_owned_review_required: ["topogram/**"]
  });
});

test("buildLaneStatusPayload and buildHandoffStatusPayload summarize artifact-backed coordination state", () => {
  const singleAgentPlan = {
    type: "single_agent_plan",
    workspace: "/tmp/topogram",
    mode: "import-adopt",
    summary: { focus: "Proposal review and adoption planning" },
    write_scope: {
      safe_to_edit: ["candidates/**"],
      human_owned_review_required: ["topogram/**"]
    },
    proof_targets: {
      generated_checks: ["reconcile-review"]
    }
  };
  const importPlan = {
    review_groups: ["projection_review:proj_api"],
    requires_human_review: ["article:capability:cap_approve_article"],
    proposal_surfaces: [
      {
        id: "article:capability:cap_approve_article",
        canonical_rel_path: "projections/proj-api.tg",
        recommended_state: "customize",
        projection_impacts: [{ projection_id: "proj_api" }]
      }
    ]
  };
  const report = {
    candidate_model_bundles: [
      {
        slug: "article",
        auth_claim_hints: [
          {
            claim: "reviewer",
            claim_value: "true",
            closure_state: "unresolved",
            related_capabilities: ["cap_approve_article"],
            review_guidance: "Confirm reviewer claim rule."
          }
        ],
        auth_role_guidance: [
          {
            role_id: "role_reviewer",
            confidence: "medium",
            followup_action: "promote_role",
            review_guidance: "Confirm reviewer role."
          }
        ]
      }
    ]
  };
  const adoptionStatus = {
    next_bundle: {
      bundle: "article"
    },
    bundle_priorities: [
      {
        bundle: "article",
        recommend_bundle_review_selector: "bundle-review:article",
        next_review_groups: [
          {
            id: "projection_review:proj_api",
            type: "projection_review",
            reason: "Projection review is still required."
          }
        ],
        recommend_from_plan: true,
        auth_closure_summary: { status: "high_risk" }
      }
    ]
  };
  const multiAgentPlan = buildMultiAgentPlanPayload({
    workspace: "/tmp/topogram",
    singleAgentPlan,
    importPlan,
    report,
    adoptionStatus
  });

  const laneStatus = buildLaneStatusPayload({
    workspace: "/tmp/topogram",
    multiAgentPlan,
    report,
    adoptionStatus
  });
  const handoffStatus = buildHandoffStatusPayload({
    workspace: "/tmp/topogram",
    multiAgentPlan,
    report,
    adoptionStatus
  });

  assert.equal(laneStatus.type, "lane_status_query");
  assert.ok(laneStatus.lanes.some((lane) => lane.lane_id === "bundle_reviewer.article" && lane.status === "ready"));
  assert.ok(laneStatus.lanes.some((lane) => lane.lane_id === "auth_reviewer.article" && lane.status === "ready"));
  assert.ok(laneStatus.lanes.some((lane) => lane.lane_id === "adoption_operator" && lane.status === "blocked"));
  assert.equal(handoffStatus.type, "handoff_status_query");
  assert.ok(handoffStatus.handoffs.some((handoff) => handoff.packet_id === "handoff:bundle-review.article" && handoff.status === "pending"));
  assert.ok(handoffStatus.handoffs.some((handoff) => handoff.packet_id === "handoff:auth-review.article" && handoff.status === "pending"));
});
