import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { generateWorkspace } from "../../src/generator.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const contentApprovalTopogramPath = path.join(repoRoot, "examples", "content-approval", "topogram");
const cliPath = path.join(repoRoot, "engine", "src", "cli.js");
const adoptionPlanFixtureScriptPath = path.join(repoRoot, "engine", "scripts", "build-adoption-plan-fixture.mjs");

function buildAdoptionPlanFixture(sourceTopogramPath, options = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-adoption-fixture-"));
  const args = [
    adoptionPlanFixtureScriptPath,
    sourceTopogramPath
  ];
  if (options.scenario) {
    args.push("--scenario", options.scenario);
  }
  args.push("--out-dir", tempRoot, "--json");
  const fixtureRun = spawnSync(process.execPath, [
    ...args
  ], { encoding: "utf8" });
  assert.equal(fixtureRun.status, 0, fixtureRun.stderr);
  const payload = JSON.parse(fixtureRun.stdout);
  return payload.staged_topogram_root;
}

function writeWorkflowPresetFixture(topogramRoot, { providerPreset = null, teamPreset = null, providerManifest = null } = {}) {
  if (providerPreset) {
    const providerDir = path.join(topogramRoot, "candidates", "providers", "workflow-presets");
    fs.mkdirSync(providerDir, { recursive: true });
    fs.writeFileSync(path.join(providerDir, `${providerPreset.id}.json`), JSON.stringify(providerPreset, null, 2));
  }
  if (providerManifest) {
    const manifestDir = path.join(topogramRoot, "candidates", "providers", "manifests");
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, `${providerManifest.provider.id}.json`), JSON.stringify(providerManifest, null, 2));
  }
  if (teamPreset) {
    const teamDir = path.join(topogramRoot, "topogram", "workflow-presets");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(path.join(teamDir, `${teamPreset.id}.json`), JSON.stringify(teamPreset, null, 2));
  }
}

function runCliCaptured(args) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-cli-capture-"));
  const stdoutPath = path.join(tempRoot, "stdout.json");
  const stdoutFd = fs.openSync(stdoutPath, "w");
  const run = spawnSync(process.execPath, args, {
    encoding: "utf8",
    stdio: ["ignore", stdoutFd, "pipe"]
  });
  fs.closeSync(stdoutFd);
  return {
    ...run,
    stdout: fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, "utf8") : ""
  };
}

test("context task mode modeling prefers slice-driven Topogram work", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-task-mode",
    modeId: "modeling",
    capabilityId: "cap_request_article_revision"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.mode, "modeling");
  assert.match(JSON.stringify(result.artifact.preferred_context_artifacts), /cap_request_article_revision/);
  assert.ok(Array.isArray(result.artifact.write_scope.safe_to_edit));
  assert.ok(Array.isArray(result.artifact.verification_targets.generated_checks));
  assert.equal(result.artifact.next_action.kind, "edit_canonical_topogram");
});

test("context task mode modeling recommends diff review first when baseline impact reaches maintained surfaces", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-task-mode",
    modeId: "modeling",
    capabilityId: "cap_request_article_revision",
    fromTopogramPath: path.join(repoRoot, "examples", "todo", "topogram")
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.mode, "modeling");
  assert.equal(result.artifact.next_action.kind, "review_diff_impact");
  assert.match(result.artifact.next_action.reason, /seam\(s\) across/);
  assert.match(result.artifact.next_action.reason, /highest severity/);
});

test("context task mode maintained-app-edit exposes maintained file scope and proof checks", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-task-mode",
    modeId: "maintained-app-edit"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.mode, "maintained-app-edit");
  assert.match(JSON.stringify(result.artifact.preferred_context_artifacts), /maintained-boundary/);
  assert.match(JSON.stringify(result.artifact.write_scope.safe_to_edit), /product\/app\/src\/issues.js/);
  assert.match(JSON.stringify(result.artifact.verification_targets.maintained_app_checks), /runtime-check/);
});

test("context task mode diff-review recommends maintained impact review when diff touches maintained surfaces", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-task-mode",
    modeId: "diff-review",
    capabilityId: "cap_request_article_revision",
    fromTopogramPath: path.join(repoRoot, "examples", "todo", "topogram")
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.mode, "diff-review");
  assert.equal(result.artifact.next_action.kind, "inspect_maintained_impact");
  assert.match(result.artifact.next_action.reason, /seam\(s\) across/);
  assert.match(result.artifact.next_action.reason, /highest severity/);
});

test("context task mode verification recommends maintained checks when maintained proof gates exist", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-task-mode",
    modeId: "verification"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.mode, "verification");
  assert.equal(result.artifact.next_action.kind, "run_maintained_checks");
  assert.match(result.artifact.next_action.reason, /maintained_app/);
  assert.match(JSON.stringify(result.artifact.verification_targets), /output_verification_targets/);
});

test("context task mode import-adopt consumes a real generated adoption plan when present", () => {
  const topogramRoot = buildAdoptionPlanFixture(
    path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
    { scenario: "projection-impact" }
  );

  const parsed = parsePath(topogramRoot);
  const result = generateWorkspace(parsed, {
    target: "context-task-mode",
    modeId: "import-adopt"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.mode, "import-adopt");
  assert.equal(result.artifact.summary.plan_present, true);
  assert.ok(Array.isArray(result.artifact.staged_items));
  assert.ok(result.artifact.staged_items.length > 0);
  assert.match(result.artifact.summary.preferred_start, /adoption-plan\.agent\.json/);
  assert.equal(result.artifact.next_action.kind, "review_staged");
});

test("query cli can return task-mode, adoption-plan, maintained-boundary, maintained-conformance, maintained-drift, seam-check, diff, slice, review-boundary, write-scope, verification-targets, change-plan, import-plan, risk-summary, canonical-writes, proceed-decision, review-packet, next-action, single-agent-plan, multi-agent-plan, workflow-preset-customization, workflow-preset-diff, and resolved-workflow-context artifacts", () => {
  const topogramRoot = buildAdoptionPlanFixture(contentApprovalTopogramPath);
  writeWorkflowPresetFixture(topogramRoot, {
    providerPreset: {
      id: "provider_preset_teamcity_ci",
      label: "TeamCity CI Review",
      kind: "provider_workflow_preset",
      provider: { id: "teamcity_generic", kind: "deployment_provider" },
      adoption_state: "customize",
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      preferred_queries: ["review-packet"],
      review_policy: {
        escalate_categories: ["deployment_assumptions"]
      },
      refresh_baseline: {
        id: "provider_preset_teamcity_ci",
        preferred_queries: ["import-plan"],
        review_policy: {
          escalate_categories: []
        }
      }
    },
    providerManifest: {
      provider: {
        id: "teamcity_generic",
        kind: "deployment_provider",
        display_name: "TeamCity Generic",
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
            id: "provider_preset_teamcity_ci",
            path: "workflow-presets/provider_preset_teamcity_ci.json",
            kind: "provider_workflow_preset",
            applies_to: {
              task_classes: ["import-adopt"],
              integration_categories: ["provider_adoption"]
            }
          },
          {
            id: "provider_preset_missing",
            path: "workflow-presets/provider_preset_missing.json",
            kind: "provider_workflow_preset"
          }
        ]
      }
    },
    teamPreset: {
      id: "team_preset_provider_adoption",
      label: "Provider Adoption Review",
      kind: "team_workflow_preset",
      adoption_state: "accept",
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      preferred_queries: ["risk-summary"],
      review_policy: {
        block_on: ["manual_decision", "no_go"],
        escalate_categories: ["maintained_boundary"]
      },
      handoff_defaults: {
        required_fields: ["affected_outputs"]
      },
      derived_from: {
        provider_id: "teamcity_generic",
        provider_preset_id: "provider_preset_teamcity_ci",
        source_path: "candidates/providers/workflow-presets/provider_preset_teamcity_ci.json",
        source_fingerprint: "outdated-source"
      }
    }
  });

  const taskModeRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "task-mode",
    topogramRoot,
    "--mode",
    "modeling",
    "--capability",
    "cap_request_article_revision"
  ], { encoding: "utf8" });
  assert.equal(taskModeRun.status, 0, taskModeRun.stderr);
  assert.match(taskModeRun.stdout, /"mode": "modeling"/);

  const adoptionPlanRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "adoption-plan",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    )
  ], { encoding: "utf8" });
  assert.equal(adoptionPlanRun.status, 0, adoptionPlanRun.stderr);
  assert.match(adoptionPlanRun.stdout, /"staged_items"/);

  const maintainedBoundaryRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "maintained-boundary",
    topogramRoot
  ], { encoding: "utf8" });
  assert.equal(maintainedBoundaryRun.status, 0, maintainedBoundaryRun.stderr);
  assert.match(maintainedBoundaryRun.stdout, /"maintained_files_in_scope"/);
  assert.match(maintainedBoundaryRun.stdout, /"outputs"/);

  const maintainedConformanceRun = runCliCaptured([
    cliPath,
    "query",
    "maintained-conformance",
    topogramRoot
  ]);
  assert.equal(maintainedConformanceRun.status, 0, maintainedConformanceRun.stderr);
  assert.match(maintainedConformanceRun.stdout, /"type": "maintained_conformance_query"/);
  assert.match(maintainedConformanceRun.stdout, /"conformance_status"/);
  assert.match(maintainedConformanceRun.stdout, /"seams"/);
  assert.match(maintainedConformanceRun.stdout, /"outputs"/);

  const maintainedDriftRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "maintained-drift",
    topogramRoot,
    "--from-topogram",
    path.join(repoRoot, "examples", "todo", "topogram")
  ], { encoding: "utf8" });
  assert.equal(maintainedDriftRun.status, 0, maintainedDriftRun.stderr);
  assert.match(maintainedDriftRun.stdout, /"type": "maintained_drift_query"/);
  assert.match(maintainedDriftRun.stdout, /"affected_seams"/);
  assert.match(maintainedDriftRun.stdout, /"outputs"/);
  assert.match(maintainedDriftRun.stdout, /"highest_severity"/);

  const seamCheckRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "seam-check",
    contentApprovalTopogramPath
  ], { encoding: "utf8" });
  assert.equal(seamCheckRun.status, 0, seamCheckRun.stderr);
  assert.match(seamCheckRun.stdout, /"type": "seam_check_query"/);
  assert.match(seamCheckRun.stdout, /"seams"/);
  assert.match(seamCheckRun.stdout, /"probes"/);

  const maintainedConformanceDiffRun = runCliCaptured([
    cliPath,
    "query",
    "maintained-conformance",
    topogramRoot,
    "--from-topogram",
    path.join(repoRoot, "examples", "todo", "topogram")
  ]);
  assert.equal(maintainedConformanceDiffRun.status, 0, maintainedConformanceDiffRun.stderr);
  assert.match(maintainedConformanceDiffRun.stdout, /"type": "maintained_conformance_query"/);
  assert.match(maintainedConformanceDiffRun.stdout, /"outputs"/);
  assert.match(maintainedConformanceDiffRun.stdout, /"drift_suspected|no_go|review_required"/);

  const diffRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "diff",
    topogramRoot,
    "--from-topogram",
    path.join(repoRoot, "examples", "todo", "topogram")
  ], { encoding: "utf8" });
  assert.equal(diffRun.status, 0, diffRun.stderr);
  assert.match(diffRun.stdout, /"affected_generated_surfaces"/);

  const sliceRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "slice",
    topogramRoot,
    "--capability",
    "cap_request_article_revision"
  ], { encoding: "utf8" });
  assert.equal(sliceRun.status, 0, sliceRun.stderr);
  assert.match(sliceRun.stdout, /"focus": \{\n\s+"id": "cap_request_article_revision"/);

  const reviewBoundaryRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "review-boundary",
    topogramRoot,
    "--capability",
    "cap_request_article_revision"
  ], { encoding: "utf8" });
  assert.equal(reviewBoundaryRun.status, 0, reviewBoundaryRun.stderr);
  assert.match(reviewBoundaryRun.stdout, /"review_boundary"/);
  assert.match(reviewBoundaryRun.stdout, /"ownership_boundary"/);

  const sliceWriteScopeRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "write-scope",
    topogramRoot,
    "--capability",
    "cap_request_article_revision"
  ], { encoding: "utf8" });
  assert.equal(sliceWriteScopeRun.status, 0, sliceWriteScopeRun.stderr);
  assert.match(sliceWriteScopeRun.stdout, /"source": "context-slice"/);
  assert.match(sliceWriteScopeRun.stdout, /"write_scope"/);
  assert.match(sliceWriteScopeRun.stdout, /"safe_to_edit"/);

  const maintainedWriteScopeRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "write-scope",
    topogramRoot,
    "--surface",
    "maintained-boundary"
  ], { encoding: "utf8" });
  assert.equal(maintainedWriteScopeRun.status, 0, maintainedWriteScopeRun.stderr);
  assert.match(maintainedWriteScopeRun.stdout, /"source": "maintained-boundary"/);
  assert.match(maintainedWriteScopeRun.stdout, /"maintained_file_count"/);

  const modeWriteScopeRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "write-scope",
    topogramRoot,
    "--mode",
    "import-adopt"
  ], { encoding: "utf8" });
  assert.equal(modeWriteScopeRun.status, 0, modeWriteScopeRun.stderr);
  assert.match(modeWriteScopeRun.stdout, /"source": "context-task-mode"/);
  assert.match(modeWriteScopeRun.stdout, /"mode": "import-adopt"/);

  const sliceVerificationTargetsRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "verification-targets",
    topogramRoot,
    "--capability",
    "cap_request_article_revision"
  ], { encoding: "utf8" });
  assert.equal(sliceVerificationTargetsRun.status, 0, sliceVerificationTargetsRun.stderr);
  assert.match(sliceVerificationTargetsRun.stdout, /"source": "context-slice"/);
  assert.match(sliceVerificationTargetsRun.stdout, /"verification_targets"/);
  assert.match(sliceVerificationTargetsRun.stdout, /"generated_checks"/);

  const diffVerificationTargetsRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "verification-targets",
    topogramRoot,
    "--from-topogram",
    path.join(repoRoot, "examples", "todo", "topogram")
  ], { encoding: "utf8" });
  assert.equal(diffVerificationTargetsRun.status, 0, diffVerificationTargetsRun.stderr);
  assert.match(diffVerificationTargetsRun.stdout, /"source": "context-diff"/);
  assert.match(diffVerificationTargetsRun.stdout, /"affected_verifications"/);

  const modeVerificationTargetsRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "verification-targets",
    topogramRoot,
    "--mode",
    "verification",
    "--capability",
    "cap_request_article_revision"
  ], { encoding: "utf8" });
  assert.equal(modeVerificationTargetsRun.status, 0, modeVerificationTargetsRun.stderr);
  assert.match(modeVerificationTargetsRun.stdout, /"source": "context-task-mode"/);
  assert.match(modeVerificationTargetsRun.stdout, /"mode": "verification"/);

  const changePlanRun = runCliCaptured([
    cliPath,
    "query",
    "change-plan",
    topogramRoot,
    "--mode",
    "modeling",
    "--capability",
    "cap_request_article_revision",
    "--from-topogram",
    path.join(repoRoot, "examples", "todo", "topogram")
  ]);
  assert.equal(changePlanRun.status, 0, changePlanRun.stderr);
  assert.match(changePlanRun.stdout, /"type": "change_plan_query"/);
  assert.match(changePlanRun.stdout, /"focus"/);
  assert.match(changePlanRun.stdout, /"next_action"/);
  assert.match(changePlanRun.stdout, /"review_boundary"/);
  assert.match(changePlanRun.stdout, /"write_scope"/);
  assert.match(changePlanRun.stdout, /"verification_targets"/);
  assert.match(changePlanRun.stdout, /"diff_summary"/);

  const importPlanRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "import-plan",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    )
  ], { encoding: "utf8" });
  assert.equal(importPlanRun.status, 0, importPlanRun.stderr);
  assert.match(importPlanRun.stdout, /"type": "import_plan_query"/);
  assert.match(importPlanRun.stdout, /"next_action"/);
  assert.match(importPlanRun.stdout, /"write_scope"/);
  assert.match(importPlanRun.stdout, /"verification_targets"/);
  assert.match(importPlanRun.stdout, /"staged_items"/);
  assert.match(importPlanRun.stdout, /"proposal_surfaces"/);
  assert.match(importPlanRun.stdout, /"maintained_risk"/);
  assert.match(importPlanRun.stdout, /"workflow_presets"/);
  assert.match(importPlanRun.stdout, /"workflow_preset_surfaces"/);

  const presetImportPlanRun = runCliCaptured([
    cliPath,
    "query",
    "import-plan",
    topogramRoot
  ]);
  assert.equal(presetImportPlanRun.status, 0, presetImportPlanRun.stderr);
  const presetImportPlan = JSON.parse(presetImportPlanRun.stdout);
  assert.ok(Array.isArray(presetImportPlan.workflow_presets.provider_manifest_declarations));
  assert.ok(presetImportPlan.preset_guidance_summary);
  assert.equal(presetImportPlan.workflow_presets.provider_manifest_summary.missing_declared_workflow_preset_count, 1);
  assert.equal(presetImportPlan.workflow_presets.workflow_preset_surfaces[0].customization_status.status, "customization_stale");
  assert.equal(presetImportPlan.workflow_presets.workflow_preset_surfaces[0].recommended_customization_action, "refresh_local_customization");

  const riskSummaryRun = runCliCaptured([
    cliPath,
    "query",
    "risk-summary",
    topogramRoot,
    "--mode",
    "modeling",
    "--capability",
    "cap_request_article_revision",
    "--from-topogram",
    path.join(repoRoot, "examples", "todo", "topogram")
  ]);
  assert.equal(riskSummaryRun.status, 0, riskSummaryRun.stderr);
  assert.match(riskSummaryRun.stdout, /"type": "risk_summary_query"/);
  assert.match(riskSummaryRun.stdout, /"overall_risk"/);
  assert.match(riskSummaryRun.stdout, /"recommended_next_action"/);
  assert.match(riskSummaryRun.stdout, /"maintained_risk"/);
  assert.match(riskSummaryRun.stdout, /"affected_outputs"/);
  assert.match(riskSummaryRun.stdout, /"affected_seams"/);

  const canonicalWritesRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "canonical-writes",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    )
  ], { encoding: "utf8" });
  assert.equal(canonicalWritesRun.status, 0, canonicalWritesRun.stderr);
  assert.match(canonicalWritesRun.stdout, /"type": "canonical_writes_query"/);
  assert.match(canonicalWritesRun.stdout, /"canonical_writes"/);
  assert.match(canonicalWritesRun.stdout, /"source": "import-plan"/);
  assert.match(canonicalWritesRun.stdout, /"canonical_rel_path"/);

  const proceedDecisionRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "proceed-decision",
    topogramRoot,
    "--mode",
    "modeling",
    "--capability",
    "cap_request_article_revision",
    "--from-topogram",
    path.join(repoRoot, "examples", "todo", "topogram")
  ], { encoding: "utf8" });
  assert.equal(proceedDecisionRun.status, 0, proceedDecisionRun.stderr);
  assert.match(proceedDecisionRun.stdout, /"type": "proceed_decision_query"/);
  assert.match(proceedDecisionRun.stdout, /"decision"/);
  assert.match(proceedDecisionRun.stdout, /"recommended_next_action"/);
  assert.match(proceedDecisionRun.stdout, /"maintained_risk"/);
  assert.match(proceedDecisionRun.stdout, /"output_verification_targets"/);
  assert.match(proceedDecisionRun.stdout, /"preset_guidance_summary"/);

  const reviewPacketRun = runCliCaptured([
    cliPath,
    "query",
    "review-packet",
    topogramRoot,
    "--mode",
    "modeling",
    "--capability",
    "cap_request_article_revision",
    "--from-topogram",
    path.join(repoRoot, "examples", "todo", "topogram")
  ]);
  assert.equal(reviewPacketRun.status, 0, reviewPacketRun.stderr);
  assert.match(reviewPacketRun.stdout, /"type": "review_packet_query"/);
  assert.match(reviewPacketRun.stdout, /"risk_summary"/);
  assert.match(reviewPacketRun.stdout, /"canonical_writes"/);
  assert.match(reviewPacketRun.stdout, /"verification_targets"/);
  assert.match(reviewPacketRun.stdout, /"change_summary"/);
  assert.match(reviewPacketRun.stdout, /"maintained_impacts"/);
  assert.match(reviewPacketRun.stdout, /"alignment_recommendations"/);
  assert.match(reviewPacketRun.stdout, /"output_verification_targets"/);

  const importReviewPacketRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "review-packet",
    topogramRoot
  ], { encoding: "utf8" });
  assert.equal(importReviewPacketRun.status, 0, importReviewPacketRun.stderr);
  assert.match(importReviewPacketRun.stdout, /"recommended_preset_action"/);
  assert.match(importReviewPacketRun.stdout, /"preset_guidance_summary"/);

  const workflowPresetCustomizationRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "workflow-preset-customization",
    topogramRoot,
    "--provider",
    "teamcity_generic",
    "--preset",
    "provider_preset_teamcity_ci"
  ], { encoding: "utf8" });
  assert.equal(workflowPresetCustomizationRun.status, 0, workflowPresetCustomizationRun.stderr);
  assert.match(workflowPresetCustomizationRun.stdout, /"type": "workflow_preset_customization_query"/);
  assert.match(workflowPresetCustomizationRun.stdout, /"recommended_local_path": "workflow-presets\/provider\.teamcity_generic\.provider_preset_teamcity_ci\.json"/);
  assert.match(workflowPresetCustomizationRun.stdout, /"customization_template"/);
  assert.match(workflowPresetCustomizationRun.stdout, /"derived_from"/);

  const workflowPresetActivationRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "workflow-preset-activation",
    topogramRoot,
    "--mode",
    "import-adopt",
    "--provider",
    "teamcity_generic"
  ], { encoding: "utf8" });
  assert.equal(workflowPresetActivationRun.status, 0, workflowPresetActivationRun.stderr);
  assert.match(workflowPresetActivationRun.stdout, /"type": "workflow_preset_activation_query"/);
  assert.match(workflowPresetActivationRun.stdout, /"active_presets"/);
  assert.match(workflowPresetActivationRun.stdout, /"skipped_presets"/);
  assert.match(workflowPresetActivationRun.stdout, /"provider_manifest_declarations"/);

  const resolvedWorkflowRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "resolved-workflow-context",
    topogramRoot,
    "--mode",
    "import-adopt",
    "--provider",
    "teamcity_generic"
  ], { encoding: "utf8" });
  assert.equal(resolvedWorkflowRun.status, 0, resolvedWorkflowRun.stderr);
  assert.match(resolvedWorkflowRun.stdout, /"type": "resolved_workflow_context_query"/);
  assert.match(resolvedWorkflowRun.stdout, /"resolved_task_mode": "import-adopt"/);
  assert.match(resolvedWorkflowRun.stdout, /"applied_presets"/);
  assert.match(resolvedWorkflowRun.stdout, /"skipped_presets"/);
  assert.match(resolvedWorkflowRun.stdout, /"field_resolution"/);
  assert.match(resolvedWorkflowRun.stdout, /"policy_notes"/);
  assert.match(resolvedWorkflowRun.stdout, /"workflow_presets"/);

  const workflowPresetDiffRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "workflow-preset-diff",
    topogramRoot,
    "--provider",
    "teamcity_generic"
  ], { encoding: "utf8" });
  assert.equal(workflowPresetDiffRun.status, 0, workflowPresetDiffRun.stderr);
  assert.match(workflowPresetDiffRun.stdout, /"type": "workflow_preset_diff_query"/);
  assert.match(workflowPresetDiffRun.stdout, /"change_status": "locally_customized"/);
  assert.match(workflowPresetDiffRun.stdout, /"recommended_customization_action": "refresh_local_customization"/);

  const nextActionRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "next-action",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    )
  ], { encoding: "utf8" });
  assert.equal(nextActionRun.status, 0, nextActionRun.stderr);
  assert.match(nextActionRun.stdout, /"type": "next_action_query"/);
  assert.match(nextActionRun.stdout, /"next_action"/);
  assert.match(nextActionRun.stdout, /"kind": "review_staged"/);
  assert.match(nextActionRun.stdout, /"plan_present": true/);

  const singleAgentImportRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "single-agent-plan",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    ),
    "--mode",
    "import-adopt"
  ], { encoding: "utf8" });
  assert.equal(singleAgentImportRun.status, 0, singleAgentImportRun.stderr);
  assert.match(singleAgentImportRun.stdout, /"type": "single_agent_plan"/);
  assert.match(singleAgentImportRun.stdout, /"mode": "import-adopt"/);
  assert.match(singleAgentImportRun.stdout, /"next_action"/);
  assert.match(singleAgentImportRun.stdout, /"primary_artifacts"/);
  assert.match(singleAgentImportRun.stdout, /"blocking_conditions"/);
  assert.match(singleAgentImportRun.stdout, /"preset_guidance_summary"/);
  assert.match(singleAgentImportRun.stdout, /"resolved_workflow_context"/);

  const singleAgentMaintainedRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "single-agent-plan",
    topogramRoot,
    "--mode",
    "maintained-app-edit"
  ], { encoding: "utf8" });
  assert.equal(singleAgentMaintainedRun.status, 0, singleAgentMaintainedRun.stderr);
  assert.match(singleAgentMaintainedRun.stdout, /"type": "single_agent_plan"/);
  assert.match(singleAgentMaintainedRun.stdout, /"mode": "maintained-app-edit"/);
  assert.match(singleAgentMaintainedRun.stdout, /"proof_targets"/);
  assert.match(singleAgentMaintainedRun.stdout, /"context-bundle\.maintained-app\.json"/);

  const multiAgentImportRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "multi-agent-plan",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    ),
    "--mode",
    "import-adopt"
  ], { encoding: "utf8" });
  assert.equal(multiAgentImportRun.status, 0, multiAgentImportRun.stderr);
  assert.match(multiAgentImportRun.stdout, /"type": "multi_agent_plan"/);
  assert.match(multiAgentImportRun.stdout, /"mode": "import-adopt"/);
  assert.match(multiAgentImportRun.stdout, /"lanes"/);
  assert.match(multiAgentImportRun.stdout, /"serialized_gates"/);
  assert.match(multiAgentImportRun.stdout, /"handoff_packets"/);
  assert.match(multiAgentImportRun.stdout, /"preset_guidance_summary"/);
  assert.match(multiAgentImportRun.stdout, /"resolved_workflow_context"/);

  const workPacketRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "work-packet",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    ),
    "--mode",
    "import-adopt",
    "--lane",
    "bundle_reviewer.task"
  ], { encoding: "utf8" });
  assert.equal(workPacketRun.status, 0, workPacketRun.stderr);
  assert.match(workPacketRun.stdout, /"type": "work_packet"/);
  assert.match(workPacketRun.stdout, /"lane_id": "bundle_reviewer\.task"/);
  assert.match(workPacketRun.stdout, /"published_handoff_packet"/);
  assert.match(workPacketRun.stdout, /"recommended_steps"/);
  assert.match(workPacketRun.stdout, /"preset_guidance_summary"/);
  assert.match(workPacketRun.stdout, /"resolved_workflow_context"/);
  assert.match(workPacketRun.stdout, /"effective_write_scope"/);

  const laneStatusRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "lane-status",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    ),
    "--mode",
    "import-adopt"
  ], { encoding: "utf8" });
  assert.equal(laneStatusRun.status, 0, laneStatusRun.stderr);
  assert.match(laneStatusRun.stdout, /"type": "lane_status_query"/);
  assert.match(laneStatusRun.stdout, /"status_counts"/);
  assert.match(laneStatusRun.stdout, /"blocked_lanes"/);

  const handoffStatusRun = spawnSync(process.execPath, [
    cliPath,
    "query",
    "handoff-status",
    buildAdoptionPlanFixture(
      path.join(repoRoot, "engine", "tests", "fixtures", "import", "incomplete-topogram", "topogram"),
      { scenario: "projection-impact" }
    ),
    "--mode",
    "import-adopt"
  ], { encoding: "utf8" });
  assert.equal(handoffStatusRun.status, 0, handoffStatusRun.stderr);
  assert.match(handoffStatusRun.stdout, /"type": "handoff_status_query"/);
  assert.match(handoffStatusRun.stdout, /"pending_packets"/);
  assert.match(handoffStatusRun.stdout, /"handoffs"/);
});

test("workflow-preset customize dry-run and write use the shared scaffold and refuse overwrite", () => {
  const topogramRoot = buildAdoptionPlanFixture(contentApprovalTopogramPath);
  writeWorkflowPresetFixture(topogramRoot, {
    providerPreset: {
      id: "provider_preset_teamcity_ci",
      label: "TeamCity CI Review",
      kind: "provider_workflow_preset",
      provider: { id: "teamcity_generic", kind: "deployment_provider" },
      adoption_state: "customize",
      applies_to: {
        task_classes: ["import-adopt"],
        integration_categories: ["provider_adoption"]
      },
      preferred_queries: ["review-packet"],
      review_policy: {
        escalate_categories: ["deployment_assumptions"]
      }
    }
  });

  const dryRun = spawnSync(process.execPath, [
    cliPath,
    "workflow-preset",
    "customize",
    topogramRoot,
    "--provider",
    "teamcity_generic",
    "--preset",
    "provider_preset_teamcity_ci"
  ], { encoding: "utf8" });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /"type": "workflow_preset_customization_query"/);

  const writeRun = spawnSync(process.execPath, [
    cliPath,
    "workflow-preset",
    "customize",
    topogramRoot,
    "--provider",
    "teamcity_generic",
    "--preset",
    "provider_preset_teamcity_ci",
    "--write"
  ], { encoding: "utf8" });
  assert.equal(writeRun.status, 0, writeRun.stderr);
  assert.match(writeRun.stdout, /"written": true/);
  const writtenPath = path.join(topogramRoot, "workflow-presets", "provider.teamcity_generic.provider_preset_teamcity_ci.json");
  assert.equal(fs.existsSync(writtenPath), true);
  const writtenPayload = JSON.parse(fs.readFileSync(writtenPath, "utf8"));
  assert.equal(writtenPayload.kind, "team_workflow_preset");
  assert.equal(writtenPayload.derived_from.provider_id, "teamcity_generic");
  assert.equal(writtenPayload.derived_from.provider_preset_id, "provider_preset_teamcity_ci");

  const overwriteRun = spawnSync(process.execPath, [
    cliPath,
    "workflow-preset",
    "customize",
    topogramRoot,
    "--provider",
    "teamcity_generic",
    "--preset",
    "provider_preset_teamcity_ci",
    "--write"
  ], { encoding: "utf8" });
  assert.notEqual(overwriteRun.status, 0);
  assert.match(overwriteRun.stderr, /Refusing to overwrite existing workflow preset customization/);

  const providerPresetPath = path.join(topogramRoot, "candidates", "providers", "workflow-presets", "provider_preset_teamcity_ci.json");
  const providerPreset = JSON.parse(fs.readFileSync(providerPresetPath, "utf8"));
  assert.equal(providerPreset.kind, "provider_workflow_preset");
  assert.equal(providerPreset.adoption_state, "customize");
});
