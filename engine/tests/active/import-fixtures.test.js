import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runImportAppWorkflow } from "../../src/import/index.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const importFixtureRoot = path.join(repoRoot, "engine", "tests", "fixtures", "import");
const cliPath = path.join(repoRoot, "engine", "src", "cli.js");
const retainedImportFixtures = [
  "cli-basic",
  "prisma-openapi",
  "route-fallback",
  "sql-openapi"
];

test("engine import fixtures are limited to actively tested smoke inputs", () => {
  const actual = fs.readdirSync(importFixtureRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(actual, retainedImportFixtures);
});

test("Prisma plus OpenAPI import fixture extracts DB and API candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "prisma-openapi"), {
    from: "db,api"
  }).summary;

  assert.deepEqual(summary.tracks, ["db", "api"]);
  assert.deepEqual(detectionIds(summary), ["api.openapi", "db.prisma"]);
  assert.deepEqual(candidateIds(summary.candidates.db.entities), ["entity_task", "entity_user"]);
  assert.deepEqual(candidateIds(summary.candidates.db.enums), ["task_priority"]);
  assert.deepEqual(candidateIds(summary.candidates.api.capabilities), ["cap_create_task", "cap_update_task"]);
});

test("SQL plus OpenAPI import fixture extracts DB and API candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "sql-openapi"), {
    from: "db,api"
  }).summary;

  assert.deepEqual(summary.tracks, ["db", "api"]);
  assert.deepEqual(detectionIds(summary), ["api.openapi", "db.sql"]);
  assert.deepEqual(candidateIds(summary.candidates.db.entities), ["entity_task", "entity_user"]);
  assert.deepEqual(candidateIds(summary.candidates.db.enums), ["task_priority"]);
  assert.deepEqual(candidateIds(summary.candidates.api.capabilities), ["cap_create_task", "cap_update_task"]);
});

test("route fallback import fixture extracts API routes and React screens", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "route-fallback"), {
    from: "api,ui"
  }).summary;

  assert.deepEqual(summary.tracks, ["api", "ui"]);
  assert.deepEqual(detectionIds(summary), ["api.generic-route-fallback", "ui.react-router"]);
  assert.deepEqual(candidateIds(summary.candidates.api.capabilities), [
    "cap_create_task",
    "cap_list_tasks",
    "cap_update_task"
  ]);
  assert.deepEqual(candidateIds(summary.candidates.ui.screens), [
    "task_create",
    "task_detail",
    "task_edit",
    "task_list"
  ]);
  assert.deepEqual(candidateIds(summary.candidates.ui.widgets), [
    "widget_task_list_results"
  ]);
  assert.equal(Object.hasOwn(summary.candidates.ui, "components"), false);
});

test("CLI import fixture extracts command surface candidates", () => {
  const summary = runImportAppWorkflow(path.join(importFixtureRoot, "cli-basic"), {
    from: "cli"
  }).summary;

  assert.deepEqual(summary.tracks, ["cli"]);
  assert.deepEqual(detectionIds(summary), ["cli.generic"]);
  assert.deepEqual((summary.candidates.cli.commands || []).map((item) => item.command_id).sort(), ["check", "import"]);
  assert.deepEqual(candidateIds(summary.candidates.cli.capabilities), ["cap_check", "cap_import"]);
  assert.deepEqual(candidateIds(summary.candidates.cli.surfaces), ["proj_cli_surface"]);
  const surface = summary.candidates.cli.surfaces[0];
  assert.deepEqual(surface.commands, ["check", "import"]);
  assert.deepEqual(
    (surface.options || []).map((item) => `${item.command_id}:${item.name}`).sort(),
    ["check:json", "import:from", "import:json", "import:out"]
  );
  assert.deepEqual(
    (surface.effects || []).map((item) => `${item.command_id}:${item.effect}`).sort(),
    ["check:read_only", "import:filesystem", "import:writes_workspace"]
  );
});

test("brownfield import creates editable Topogram workspace with source provenance", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-workspace."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "import",
    path.join(importFixtureRoot, "sql-openapi"),
    "--out",
    targetRoot,
    "--from",
    "db,api",
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.tracks, ["db", "api"]);
  assert.equal(payload.candidateCounts.dbEntities, 2);
  assert.equal(payload.candidateCounts.apiCapabilities, 2);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-import.json")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "candidates", "app", "report.md")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "entities", "entity_task.tg")), true);

  const check = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.ok, true);
  assert.equal(checkPayload.import.status, "clean");
  assert.equal(checkPayload.topogram.ok, true);

  fs.appendFileSync(
    path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "README.md"),
    "\nLocal review note.\n"
  );
  const editedCheck = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(editedCheck.status, 0, editedCheck.stderr || editedCheck.stdout);
  assert.equal(JSON.parse(editedCheck.stdout).import.status, "clean");
});

test("brownfield CLI import writes reviewable command surface and adopts canonical projection", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-cli."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "import",
    path.join(importFixtureRoot, "cli-basic"),
    "--out",
    targetRoot,
    "--from",
    "cli",
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.tracks, ["cli"]);
  assert.equal(payload.candidateCounts.cliCommands, 2);
  assert.equal(payload.candidateCounts.cliCapabilities, 2);
  assert.equal(payload.candidateCounts.cliSurfaces, 1);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "candidates", "app", "cli", "report.md")), true);

  const candidateProjectionPath = path.join(
    targetRoot,
    "topo",
    "candidates",
    "reconcile",
    "model",
    "bundles",
    "cli",
    "projections",
    "proj_cli_surface.tg"
  );
  assert.equal(fs.existsSync(candidateProjectionPath), true);
  const candidateProjection = fs.readFileSync(candidateProjectionPath, "utf8");
  assert.match(candidateProjection, /type cli_surface/);
  assert.match(candidateProjection, /command check capability cap_check/);
  assert.match(candidateProjection, /command import capability cap_import/);
  assert.match(candidateProjection, /command import effect writes_workspace/);

  const plan = runCli(["import", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.summary.proposalItemCount, 4);
  assert.deepEqual(planPayload.bundles[0].kindCounts, {
    capability: 2,
    doc: 1,
    projection: 1
  });

  const selectorList = runCli(["import", "adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  const cliSelector = selectorPayload.broadSelectors.find((selector) => selector.selector === "cli");
  assert.equal(cliSelector.itemCount, 4);

  const adopt = runCli(["import", "adopt", "cli", targetRoot, "--write", "--json"]);
  assert.equal(adopt.status, 0, adopt.stderr || adopt.stdout);
  const adoptPayload = JSON.parse(adopt.stdout);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "projection" && item.item === "proj_cli_surface"), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "projections", "proj-cli-surface.tg")), true);

  const check = runCli(["check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("brownfield UI import writes reviewable widget candidates and shared bindings", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-ui-components."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "import",
    path.join(importFixtureRoot, "route-fallback"),
    "--out",
    targetRoot,
    "--from",
    "api,ui",
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.candidateCounts.uiWidgets, 1);
  assert.equal(payload.candidateCounts.uiShapes, 1);
  assert.equal(Object.hasOwn(payload.candidateCounts, "uiComponents"), false);

  const uiCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "ui", "candidates.json"), "utf8"));
  assert.equal(Object.hasOwn(uiCandidates, "components"), false);
  const widgetCandidate = uiCandidates.widgets[0];
  assert.equal(widgetCandidate.id_hint, "widget_task_list_results");
  assert.equal(widgetCandidate.inferred_region, "results");
  assert.equal(widgetCandidate.inferred_pattern, "search_results");
  assert.deepEqual(widgetCandidate.inferred_props, [
    { name: "rows", type: "array", required: true, source: "cap_list_tasks" }
  ]);
  assert.deepEqual(widgetCandidate.inferred_events, [
    {
      name: "row_select",
      kind: "selection",
      action: "navigate",
      target_screen: "task_detail",
      payload_shape: "shape_event_task_row_select",
      confidence: "medium",
      evidence: [
        "engine/tests/fixtures/import/route-fallback/apps/web/src/App.tsx#/tasks/:id"
      ],
      payload_fields: [
        { name: "id", field_type: "string", required: true }
      ],
      requires_payload_shape_review: true
    }
  ]);
  assert.deepEqual(uiCandidates.shapes.map((shape) => shape.id_hint), ["shape_event_task_row_select"]);
  assert.deepEqual(uiCandidates.shapes[0].fields, [
    { name: "id", field_type: "string", required: true }
  ]);
  assert.equal(widgetCandidate.missing_decisions.includes("confirm supported regions and patterns"), true);
  assert.equal((widgetCandidate.evidence || []).length > 0, true);

  const sharedDraftPath = path.join(targetRoot, "topo", "candidates", "app", "ui", "drafts", "proj-ui-contract.tg");
  const componentDraftPath = path.join(targetRoot, "topo", "candidates", "app", "ui", "drafts", "widgets", "widget-task-list-results.tg");
  const shapeDraftPath = path.join(targetRoot, "topo", "candidates", "app", "ui", "drafts", "shapes", "shape-event-task-row-select.tg");
  assert.equal(fs.existsSync(sharedDraftPath), true);
  assert.equal(fs.existsSync(componentDraftPath), true);
  assert.equal(fs.existsSync(shapeDraftPath), true);

  const sharedDraft = fs.readFileSync(sharedDraftPath, "utf8");
  assert.match(sharedDraft, /type ui_contract/);
  assert.match(sharedDraft, /design_tokens \{/);
  assert.match(sharedDraft, /widget_bindings \{/);
  assert.match(sharedDraft, /screen task_list region results widget widget_task_list_results data rows from cap_list_tasks event row_select navigate task_detail/);
  assert.doesNotMatch(sharedDraft, /\[object Object\]/);

  const componentDraft = fs.readFileSync(componentDraftPath, "utf8");
  assert.match(componentDraft, /# Import metadata: confidence low; evidence \d+; inferred pattern search_results; inferred region results\./);
  assert.match(componentDraft, /# Missing decisions: confirm widget reuse boundary; confirm prop names and data source; confirm events and behavior; confirm supported regions and patterns\./);
  assert.match(componentDraft, /# Inferred event: row_select navigate task_detail; review payload shape shape_event_task_row_select\./);
  assert.match(componentDraft, /# Event declarations are draft bindings and require payload shape review before adoption\./);
  assert.match(componentDraft, /widget widget_task_list_results \{/);
  assert.match(componentDraft, /events \{\n    row_select shape_event_task_row_select\n  \}/);
  assert.match(componentDraft, /selection mode single emits row_select/);
  assert.match(componentDraft, /patterns \[search_results\]/);
  assert.match(componentDraft, /status proposed/);

  const shapeDraft = fs.readFileSync(shapeDraftPath, "utf8");
  assert.match(shapeDraft, /shape shape_event_task_row_select \{/);
  assert.match(shapeDraft, /id string required/);

  const uiReport = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "ui", "report.md"), "utf8");
  assert.match(uiReport, /Event payload shapes: 1/);
  assert.match(uiReport, /## Widget Candidates/);
  assert.match(uiReport, /`widget_task_list_results` confidence low pattern `search_results` region `results` events 1 evidence \d+ missing decisions 4/);
  assert.match(uiReport, /topogram widget check <path>/);
  assert.match(uiReport, /topogram widget behavior <path>/);

  const plan = runCli(["import", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.summary.proposalItemCount, 10);
  assert.deepEqual(planPayload.bundles[0].kindCounts, {
    capability: 3,
    shape: 1,
    widget: 1,
    doc: 1,
    ui: 4
  });
  const adoptionPlan = JSON.parse(fs.readFileSync(planPayload.artifacts.adoptionPlan, "utf8"));
  const widgetItems = adoptionPlan.imported_proposal_surfaces.filter((item) => item.kind === "widget");
  assert.deepEqual(widgetItems.map((item) => item.item), ["widget_task_list_results"]);
  assert.deepEqual(widgetItems[0].related_shapes, ["shape_event_task_row_select"]);
  assert.equal(widgetItems[0].source_path, "candidates/reconcile/model/bundles/task/widgets/widget_task_list_results.tg");
  assert.equal(widgetItems[0].canonical_rel_path, "widgets/widget-task-list-results.tg");
  const reconcileReportJson = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "report.json"), "utf8"));
  const taskBundle = reconcileReportJson.candidate_model_bundles.find((bundle) => bundle.slug === "task");
  assert.deepEqual(taskBundle.shapes, ["shape_event_task_row_select"]);
  assert.deepEqual(taskBundle.widgets, ["widget_task_list_results"]);
  assert.equal(Object.hasOwn(taskBundle, "components"), false);
  assert.deepEqual(taskBundle.operator_summary.widgetIds, ["widget_task_list_results"]);
  assert.equal(Object.hasOwn(taskBundle.operator_summary, "componentIds"), false);
  const reconcileReport = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "report.md"), "utf8");
  assert.match(reconcileReport, /1 widgets/);
  assert.match(reconcileReport, /main widgets `widget_task_list_results`/);
  const bundleReadme = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "README.md"), "utf8");
  assert.match(bundleReadme, /Widgets: 1/);
  assert.match(bundleReadme, /Main widgets: `widget_task_list_results`/);
  const bundleShape = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "shapes", "shape_event_task_row_select.tg"), "utf8");
  assert.match(bundleShape, /shape shape_event_task_row_select \{/);
  assert.match(bundleShape, /id string required/);
  const bundleWidget = fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "model", "bundles", "task", "widgets", "widget_task_list_results.tg"), "utf8");
  assert.match(bundleWidget, /# Inferred event: row_select navigate task_detail\./);
  assert.match(bundleWidget, /events \{\n    row_select shape_event_task_row_select\n  \}/);

  const selectorList = runCli(["import", "adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  const widgetSelector = selectorPayload.broadSelectors.find((selector) => selector.selector === "widgets");
  assert.equal(widgetSelector.itemCount, 1);
  assert.match(widgetSelector.previewCommand, /topogram import adopt widgets .* --dry-run/);
  assert.match(widgetSelector.writeCommand, /topogram import adopt widgets .* --write/);
  const uiSelector = selectorPayload.broadSelectors.find((selector) => selector.selector === "ui");
  assert.equal(uiSelector.itemCount, 6);
  assert.match(uiSelector.label, /UI reports, widgets, and event shapes/);

  const humanSelectorList = runCli(["import", "adopt", "--list", targetRoot]);
  assert.equal(humanSelectorList.status, 0, humanSelectorList.stderr || humanSelectorList.stdout);
  assert.match(humanSelectorList.stdout, /Broad selectors:/);
  assert.match(humanSelectorList.stdout, /widgets: 1 widgets/);

  const adopt = runCli(["import", "adopt", "widgets", targetRoot, "--write", "--json"]);
  assert.equal(adopt.status, 0, adopt.stderr || adopt.stdout);
  const adoptPayload = JSON.parse(adopt.stdout);
  assert.equal(adoptPayload.promotedCanonicalItemCount, 2);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "shape" && item.item === "shape_event_task_row_select"), true);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "widget" && item.item === "widget_task_list_results"), true);
  assert.equal(adoptPayload.receipt.writtenFileHashes.some((item) => item.path === "shapes/shape-event-task-row-select.tg" && item.sha256 && item.size > 0), true);
  assert.equal(adoptPayload.receipt.writtenFileHashes.some((item) => item.path === "widgets/widget-task-list-results.tg" && item.sha256 && item.size > 0), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "shapes", "shape-event-task-row-select.tg")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "widgets", "widget-task-list-results.tg")), true);

  const check = runCli(["check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const status = runCli(["import", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.equal(JSON.parse(status.stdout).adoption.summary.appliedItemCount, 2);
});

test("brownfield UI broad selector promotes widgets and related event payload shapes", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-ui-selector."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "import",
    path.join(importFixtureRoot, "route-fallback"),
    "--out",
    targetRoot,
    "--from",
    "api,ui",
    "--json"
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const adopt = runCli(["import", "adopt", "ui", targetRoot, "--write", "--json"]);
  assert.equal(adopt.status, 0, adopt.stderr || adopt.stdout);
  const adoptPayload = JSON.parse(adopt.stdout);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "shape" && item.item === "shape_event_task_row_select"), true);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "widget" && item.item === "widget_task_list_results"), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "shapes", "shape-event-task-row-select.tg")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "widgets", "widget-task-list-results.tg")), true);

  const check = runCli(["check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const status = runCli(["import", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.equal(JSON.parse(status.stdout).adoption.summary.appliedItemCount, 6);
});

test("brownfield import workflow keeps project-owned files under topo workspace", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-topo-workflow."));
  const targetRoot = path.join(runRoot, "imported");
  const sourceRoot = path.join(importFixtureRoot, "route-fallback");
  const topoRoot = path.join(targetRoot, "topo");

  const result = runCli([
    "import",
    sourceRoot,
    "--out",
    targetRoot,
    "--from",
    "api,ui",
    "--json"
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.workspaceRoot, topoRoot);
  assert.equal(payload.topogramRoot, topoRoot);
  assert.equal(fs.existsSync(path.join(topoRoot, "candidates", "app", "ui", "candidates.json")), true);
  assert.equal(fs.existsSync(path.join(topoRoot, "candidates", "reconcile", "adoption-plan.agent.json")), true);
  assertNoLegacyTopogramWorkspace(targetRoot);
  assert.equal(payload.writtenFiles.every((filePath) => filePath === "topogram.project.json" || !filePath.startsWith("topogram/")), true);

  const check = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.workspaceRoot, topoRoot);
  assert.equal(checkPayload.import.status, "clean");

  const diff = runCli(["import", "diff", targetRoot, "--json"]);
  assert.equal(diff.status, 0, diff.stderr || diff.stdout);
  const diffPayload = JSON.parse(diff.stdout);
  assert.equal(diffPayload.ok, true);
  assert.equal(diffPayload.workspaceRoot, topoRoot);
  assert.equal(diffPayload.topogramRoot, topoRoot);

  const plan = runCli(["import", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.ok, true);
  assert.equal(planPayload.workspaceRoot, topoRoot);
  assert.equal(planPayload.topogramRoot, topoRoot);
  assert.equal(planPayload.summary.proposalItemCount > 0, true);

  const selectorList = runCli(["import", "adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  assert.equal(selectorPayload.workspaceRoot, topoRoot);
  assert.equal(selectorPayload.topogramRoot, topoRoot);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "widgets"), true);

  const preview = runCli(["import", "adopt", "widgets", targetRoot, "--dry-run", "--json"]);
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  const previewPayload = JSON.parse(preview.stdout);
  assert.equal(previewPayload.dryRun, true);
  assert.equal(previewPayload.workspaceRoot, topoRoot);
  assert.equal(previewPayload.topogramRoot, topoRoot);
  assert.deepEqual(previewPayload.writtenFiles, []);
  assert.equal(fs.existsSync(path.join(topoRoot, "widgets")), false);

  const write = runCli(["import", "adopt", "widgets", targetRoot, "--write", "--json"]);
  assert.equal(write.status, 0, write.stderr || write.stdout);
  const writePayload = JSON.parse(write.stdout);
  assert.equal(writePayload.workspaceRoot, topoRoot);
  assert.equal(writePayload.topogramRoot, topoRoot);
  assert.equal(writePayload.receipt.workspaceRoot, topoRoot);
  assert.equal(writePayload.receipt.topogramRoot, topoRoot);
  assert.equal(writePayload.receipt.selector, "widgets");
  assert.equal(fs.existsSync(path.join(topoRoot, "widgets", "widget-task-list-results.tg")), true);
  assert.equal(writePayload.writtenFiles.every((filePath) => !filePath.startsWith("topogram/")), true);
  assertNoLegacyTopogramWorkspace(targetRoot);

  const status = runCli(["import", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.workspaceRoot, topoRoot);
  assert.equal(statusPayload.topogramRoot, topoRoot);
  assert.equal(statusPayload.import.status, "clean");
  assert.equal(statusPayload.adoption.summary.appliedItemCount, 2);

  const history = runCli(["import", "history", targetRoot, "--verify", "--json"]);
  assert.equal(history.status, 0, history.stderr || history.stdout);
  const historyPayload = JSON.parse(history.stdout);
  assert.equal(historyPayload.workspaceRoot, topoRoot);
  assert.equal(historyPayload.verified, true);
  assert.equal(historyPayload.summary.receiptCount, 1);
  assert.deepEqual(historyPayload.entries, historyPayload.receipts);
  assert.equal(historyPayload.receipts[0].selector, "widgets");
  assert.equal(historyPayload.verification.status, "matched");

  const dryRefresh = runCli(["import", "refresh", "--from", sourceRoot, targetRoot, "--dry-run", "--json"]);
  assert.equal(dryRefresh.status, 0, dryRefresh.stderr || dryRefresh.stdout);
  const dryRefreshPayload = JSON.parse(dryRefresh.stdout);
  assert.equal(dryRefreshPayload.dryRun, true);
  assert.equal(dryRefreshPayload.workspaceRoot, topoRoot);
  assert.equal(dryRefreshPayload.topogramRoot, topoRoot);
  assert.deepEqual(dryRefreshPayload.writtenFiles, []);

  const refresh = runCli(["import", "refresh", "--from", sourceRoot, targetRoot, "--json"]);
  assert.equal(refresh.status, 0, refresh.stderr || refresh.stdout);
  const refreshPayload = JSON.parse(refresh.stdout);
  assert.equal(refreshPayload.ok, true);
  assert.equal(refreshPayload.workspaceRoot, topoRoot);
  assert.equal(refreshPayload.topogramRoot, topoRoot);
  assert.equal(refreshPayload.currentImportStatus, "clean");
  assert.equal(refreshPayload.writtenFiles.every((filePath) => filePath === "topogram.project.json" || !filePath.startsWith("topogram/")), true);
  assertNoLegacyTopogramWorkspace(targetRoot);
});

test("legacy imported UI component candidates are read as widgets without rewriting public reports", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-ui-legacy-components."));
  const targetRoot = path.join(runRoot, "imported");
  const result = runCli([
    "import",
    path.join(importFixtureRoot, "route-fallback"),
    "--out",
    targetRoot,
    "--from",
    "api,ui",
    "--json"
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const uiCandidatesPath = path.join(targetRoot, "topo", "candidates", "app", "ui", "candidates.json");
  const uiCandidates = JSON.parse(fs.readFileSync(uiCandidatesPath, "utf8"));
  const legacyUiCandidates = {
    ...uiCandidates,
    components: uiCandidates.widgets
  };
  delete legacyUiCandidates.widgets;
  fs.writeFileSync(uiCandidatesPath, `${JSON.stringify(legacyUiCandidates, null, 2)}\n`);

  const plan = runCli(["import", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  const adoptionPlan = JSON.parse(fs.readFileSync(planPayload.artifacts.adoptionPlan, "utf8"));
  const widgetItems = adoptionPlan.imported_proposal_surfaces.filter((item) => item.kind === "widget");
  assert.deepEqual(widgetItems.map((item) => item.item), ["widget_task_list_results"]);

  const reconcileReportJson = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "reconcile", "report.json"), "utf8"));
  const taskBundle = reconcileReportJson.candidate_model_bundles.find((bundle) => bundle.slug === "task");
  assert.deepEqual(taskBundle.widgets, ["widget_task_list_results"]);
  assert.equal(Object.hasOwn(taskBundle, "components"), false);
});

test("brownfield import refresh updates candidates and provenance without overwriting adopted Topogram", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-refresh."));
  const sourceRoot = path.join(runRoot, "source");
  const targetRoot = path.join(runRoot, "imported");
  fs.cpSync(path.join(importFixtureRoot, "sql-openapi"), sourceRoot, { recursive: true });

  const importResult = runCli(["import", sourceRoot, "--out", targetRoot, "--from", "db,api"]);
  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);

  const write = runCli(["import", "adopt", "bundle:task", targetRoot, "--write", "--json"]);
  assert.equal(write.status, 0, write.stderr || write.stdout);
  const journeyPath = path.join(targetRoot, "topo", "docs", "journeys", "task_journey.md");
  fs.appendFileSync(journeyPath, "\nLocal owner note.\n");

  fs.appendFileSync(
    path.join(sourceRoot, "db", "schema.sql"),
    "\nCREATE TABLE labels (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL\n);\n"
  );

  const dirtyCheck = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(dirtyCheck.status, 1);
  const dirtyPayload = JSON.parse(dirtyCheck.stdout);
  assert.equal(dirtyPayload.import.status, "changed");
  assert.deepEqual(dirtyPayload.import.content.changed, ["db/schema.sql"]);

  const beforeDryRunRecord = JSON.parse(fs.readFileSync(path.join(targetRoot, ".topogram-import.json"), "utf8"));
  assert.equal(beforeDryRunRecord.refreshedAt, undefined);
  const diff = runCli(["import", "diff", targetRoot, "--json"]);
  assert.equal(diff.status, 0, diff.stderr || diff.stdout);
  const diffPayload = JSON.parse(diff.stdout);
  assert.equal(diffPayload.importStatus, "changed");
  assert.equal(diffPayload.sourceDiff.counts.changed, 1);
  assert.deepEqual(diffPayload.sourceDiff.changed, ["db/schema.sql"]);
  assert.deepEqual(diffPayload.candidateCountDeltas.deltas.dbEntities, { previous: 2, next: 3, delta: 1 });
  assert.equal(diffPayload.adoptionPlanDeltas.added.length > 0, true);
  assert.equal(diffPayload.receiptVerification.status, "changed");

  const dryRun = runCli(["import", "refresh", "--from", sourceRoot, targetRoot, "--dry-run", "--json"]);
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  const dryRunPayload = JSON.parse(dryRun.stdout);
  assert.equal(dryRunPayload.dryRun, true);
  assert.equal(dryRunPayload.previousImportStatus, "changed");
  assert.equal(dryRunPayload.currentImportStatus, "changed");
  assert.equal(dryRunPayload.writtenFiles.length, 0);
  assert.equal(dryRunPayload.plannedFiles.includes(".topogram-import.json"), true);
  assert.deepEqual(dryRunPayload.candidateCountDeltas.deltas.dbEntities, { previous: 2, next: 3, delta: 1 });
  const afterDryRunRecord = JSON.parse(fs.readFileSync(path.join(targetRoot, ".topogram-import.json"), "utf8"));
  assert.equal(afterDryRunRecord.refreshedAt, undefined);
  const dryRunDbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "db", "candidates.json"), "utf8"));
  assert.equal(candidateIds(dryRunDbCandidates.entities).includes("entity_label"), false);

  const refresh = runCli(["import", "refresh", "--from", sourceRoot, targetRoot, "--json"]);
  assert.equal(refresh.status, 0, refresh.stderr || refresh.stdout);
  const refreshPayload = JSON.parse(refresh.stdout);
  assert.equal(refreshPayload.ok, true);
  assert.equal(refreshPayload.dryRun, false);
  assert.equal(refreshPayload.previousImportStatus, "changed");
  assert.equal(refreshPayload.currentImportStatus, "clean");
  assert.equal(refreshPayload.refreshMetadata.previousSourceStatus, "changed");
  assert.deepEqual(refreshPayload.refreshMetadata.sourceDiffCounts, { changed: 1, added: 0, removed: 0 });
  assert.equal(refreshPayload.candidateCounts.dbEntities, 3);
  assert.equal(refreshPayload.removedCandidateFiles.rawCandidateFiles > 0, true);
  assert.equal(refreshPayload.removedCandidateFiles.reconcileFiles > 0, true);
  assert.equal(refreshPayload.writtenFiles.includes(".topogram-import.json"), true);
  assert.equal(refreshPayload.writtenFiles.includes("topo/docs/journeys/task_journey.md"), false);
  assert.match(fs.readFileSync(journeyPath, "utf8"), /Local owner note/);

  const refreshedDbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topo", "candidates", "app", "db", "candidates.json"), "utf8"));
  assert.equal(candidateIds(refreshedDbCandidates.entities).includes("entity_label"), true);
  const refreshedRecord = JSON.parse(fs.readFileSync(path.join(targetRoot, ".topogram-import.json"), "utf8"));
  assert.equal(typeof refreshedRecord.refreshedAt, "string");
  assert.equal(refreshedRecord.refresh.previousSourceStatus, "changed");
  assert.deepEqual(refreshedRecord.refresh.sourceDiffCounts, { changed: 1, added: 0, removed: 0 });

  const cleanCheck = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(cleanCheck.status, 0, cleanCheck.stderr || cleanCheck.stdout);
  assert.equal(JSON.parse(cleanCheck.stdout).import.status, "clean");

  const humanRefresh = runCli(["import", "refresh", targetRoot]);
  assert.equal(humanRefresh.status, 0, humanRefresh.stderr || humanRefresh.stdout);
  assert.match(humanRefresh.stdout, /Refreshed brownfield import candidates/);
  assert.match(humanRefresh.stdout, /Canonical Topogram files were not overwritten/);
});

test("brownfield import plan, adopt, and status expose public adoption UX", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-adoption."));
  const targetRoot = path.join(runRoot, "imported");
  const importResult = runCli([
    "import",
    path.join(importFixtureRoot, "sql-openapi"),
    "--out",
    targetRoot,
    "--from",
    "db,api"
  ]);
  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);

  const plan = runCli(["import", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.ok, true);
  assert.deepEqual(planPayload.bundles.map((bundle) => bundle.bundle), ["task", "user"]);
  assert.equal(planPayload.summary.proposalItemCount, 6);
  assert.match(planPayload.nextCommand, /topogram import adopt bundle:task .* --dry-run/);

  const humanPlan = runCli(["import", "plan", targetRoot]);
  assert.equal(humanPlan.status, 0, humanPlan.stderr || humanPlan.stdout);
  assert.match(humanPlan.stdout, /Import adoption plan for/);
  assert.match(humanPlan.stdout, /- task: 5 item\(s\), 5 pending, 0 applied/);
  assert.match(humanPlan.stdout, /Next: topogram import adopt bundle:task .* --dry-run/);

  const selectorList = runCli(["import", "adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  assert.equal(selectorPayload.selectorCount, 2);
  assert.deepEqual(selectorPayload.selectors.map((selector) => selector.selector), ["bundle:task", "bundle:user"]);
  assert.match(selectorPayload.selectors[0].previewCommand, /topogram import adopt bundle:task .* --dry-run/);
  assert.match(selectorPayload.selectors[0].writeCommand, /topogram import adopt bundle:task .* --write/);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "from-plan"), true);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "capabilities"), true);
  assert.equal(selectorPayload.broadSelectors.some((selector) => selector.selector === "entities"), true);

  const humanSelectorList = runCli(["import", "adopt", "--list", targetRoot]);
  assert.equal(humanSelectorList.status, 0, humanSelectorList.stderr || humanSelectorList.stdout);
  assert.match(humanSelectorList.stdout, /Import adoption selectors for/);
  assert.match(humanSelectorList.stdout, /bundle:task/);
  assert.match(humanSelectorList.stdout, /Broad selectors:/);

  const preview = runCli(["import", "adopt", "bundle:task", targetRoot, "--json"]);
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  const previewPayload = JSON.parse(preview.stdout);
  assert.equal(previewPayload.dryRun, true);
  assert.equal(previewPayload.write, false);
  assert.equal(previewPayload.promotedCanonicalItemCount, 5);
  assert.deepEqual(previewPayload.writtenFiles, []);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-task.tg")), false);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-import-adoptions.jsonl")), false);

  const write = runCli(["import", "adopt", "bundle:task", targetRoot, "--write", "--json"]);
  assert.equal(write.status, 0, write.stderr || write.stdout);
  const writePayload = JSON.parse(write.stdout);
  assert.equal(writePayload.dryRun, false);
  assert.equal(writePayload.write, true);
  assert.equal(writePayload.forced, false);
  assert.equal(writePayload.promotedCanonicalItemCount, 5);
  assert.equal(writePayload.writtenFiles.includes("entities/entity-task.tg"), true);
  assert.equal(writePayload.receipt.selector, "bundle:task");
  assert.equal(writePayload.receipt.sourceProvenance.status, "clean");
  assert.equal(writePayload.receipt.writtenFiles.includes("entities/entity-task.tg"), true);
  assert.equal(writePayload.receipt.writtenFileHashes.some((item) => item.path === "entities/entity-task.tg" && item.sha256 && item.size > 0), true);
  assert.equal(writePayload.receiptPath, path.join(targetRoot, ".topogram-import-adoptions.jsonl"));
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-task.tg")), true);

  const status = runCli(["import", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, true);
  assert.equal(statusPayload.import.status, "clean");
  assert.equal(statusPayload.topogram.ok, true);
  assert.equal(statusPayload.adoption.summary.appliedItemCount, 5);
  assert.equal(statusPayload.adoption.summary.pendingItemCount, 1);
  assert.equal(statusPayload.adoption.bundles.find((bundle) => bundle.bundle === "task").complete, true);
  assert.equal(statusPayload.adoption.history.receiptCount, 1);
  assert.equal(statusPayload.adoption.history.forcedWriteCount, 0);

  const humanStatus = runCli(["import", "status", targetRoot]);
  assert.equal(humanStatus.status, 0, humanStatus.stderr || humanStatus.stdout);
  assert.match(humanStatus.stdout, /Import status: clean/);
  assert.match(humanStatus.stdout, /Topogram check: passed/);
  assert.match(humanStatus.stdout, /Adoption: 5 applied, 1 pending, 0 blocked/);

  const history = runCli(["import", "history", targetRoot, "--json"]);
  assert.equal(history.status, 0, history.stderr || history.stdout);
  const historyPayload = JSON.parse(history.stdout);
  assert.equal(historyPayload.summary.receiptCount, 1);
  assert.equal(historyPayload.summary.writeCount, 1);
  assert.equal(historyPayload.summary.forcedWriteCount, 0);
  assert.equal(historyPayload.receipts[0].selector, "bundle:task");
  assert.equal(historyPayload.receipts[0].sourceProvenance.status, "clean");
  assert.equal(historyPayload.receipts[0].writtenFileHashes.some((item) => item.path === "entities/entity-task.tg" && item.sha256), true);

  const cleanVerify = runCli(["import", "history", "--verify", targetRoot, "--json"]);
  assert.equal(cleanVerify.status, 0, cleanVerify.stderr || cleanVerify.stdout);
  const cleanVerifyPayload = JSON.parse(cleanVerify.stdout);
  assert.equal(cleanVerifyPayload.verified, true);
  assert.equal(cleanVerifyPayload.verification.status, "matched");
  assert.equal(cleanVerifyPayload.verification.summary.changedFileCount, 0);
  assert.equal(cleanVerifyPayload.verification.summary.removedFileCount, 0);
  assert.equal(cleanVerifyPayload.verification.summary.matchedFileCount, writePayload.writtenFiles.length);

  fs.appendFileSync(path.join(targetRoot, "topo", "entities", "entity-task.tg"), "\n");
  const changedVerify = runCli(["import", "history", targetRoot, "--verify", "--json"]);
  assert.equal(changedVerify.status, 0, changedVerify.stderr || changedVerify.stdout);
  const changedVerifyPayload = JSON.parse(changedVerify.stdout);
  assert.equal(changedVerifyPayload.verification.status, "changed");
  assert.equal(changedVerifyPayload.verification.summary.changedFileCount, 1);
  assert.equal(changedVerifyPayload.verification.files.find((item) => item.path === "entities/entity-task.tg").status, "changed");

  const editedCheck = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(editedCheck.status, 0, editedCheck.stderr || editedCheck.stdout);
  assert.equal(JSON.parse(editedCheck.stdout).import.status, "clean");

  fs.rmSync(path.join(targetRoot, "topo", "docs", "journeys", "task_journey.md"));
  const removedVerify = runCli(["import", "history", targetRoot, "--verify", "--json"]);
  assert.equal(removedVerify.status, 0, removedVerify.stderr || removedVerify.stdout);
  const removedVerifyPayload = JSON.parse(removedVerify.stdout);
  assert.equal(removedVerifyPayload.verification.summary.removedFileCount, 1);
  assert.equal(removedVerifyPayload.verification.files.find((item) => item.path === "docs/journeys/task_journey.md").status, "removed");

  const humanHistory = runCli(["import", "history", targetRoot]);
  assert.equal(humanHistory.status, 0, humanHistory.stderr || humanHistory.stdout);
  assert.match(humanHistory.stdout, /Import adoption history for/);
  assert.match(humanHistory.stdout, /Receipts: 1/);
  assert.match(humanHistory.stdout, /bundle:task/);

  const humanVerify = runCli(["import", "history", targetRoot, "--verify"]);
  assert.equal(humanVerify.status, 0, humanVerify.stderr || humanVerify.stdout);
  assert.match(humanVerify.stdout, /Verification: changed/);
  assert.match(humanVerify.stdout, /entities\/entity-task\.tg: changed/);
  assert.match(humanVerify.stdout, /docs\/journeys\/task_journey\.md: removed/);
  assert.match(humanVerify.stdout, /audit-only/);
});

test("brownfield import check reports changed source evidence", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-drift."));
  const sourceRoot = path.join(runRoot, "source");
  const targetRoot = path.join(runRoot, "imported");
  fs.cpSync(path.join(importFixtureRoot, "sql-openapi"), sourceRoot, { recursive: true });

  const importResult = runCli(["import", sourceRoot, "--out", targetRoot, "--from", "db,api"]);
  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);

  fs.appendFileSync(path.join(sourceRoot, "openapi.yaml"), "\n# source changed after import\n");
  const check = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(check.status, 1);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.import.status, "changed");
  assert.deepEqual(payload.import.content.changed, ["openapi.yaml"]);
  assert.equal(payload.topogram.ok, true);

  const refusedWrite = runCli(["import", "adopt", "bundle:task", targetRoot, "--write", "--json"]);
  assert.equal(refusedWrite.status, 1);
  assert.match(refusedWrite.stderr, /Refusing to write import adoption because brownfield source provenance is changed/);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-task.tg")), false);

  const missingReason = runCli(["import", "adopt", "bundle:task", targetRoot, "--write", "--force", "--json"]);
  assert.equal(missingReason.status, 1);
  assert.match(missingReason.stderr, /Forced import adoption writes require --reason <text>/);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-import-adoptions.jsonl")), false);

  const forcedWrite = runCli(["import", "adopt", "bundle:task", targetRoot, "--write", "--force", "--reason", "Reviewed source drift", "--json"]);
  assert.equal(forcedWrite.status, 0, forcedWrite.stderr || forcedWrite.stdout);
  const forcedPayload = JSON.parse(forcedWrite.stdout);
  assert.equal(forcedPayload.forced, true);
  assert.equal(forcedPayload.reason, "Reviewed source drift");
  assert.equal(forcedPayload.import.status, "changed");
  assert.equal(forcedPayload.warnings.length, 1);
  assert.equal(forcedPayload.receipt.forced, true);
  assert.equal(forcedPayload.receipt.reason, "Reviewed source drift");
  assert.equal(forcedPayload.receipt.sourceProvenance.status, "changed");
  assert.equal(forcedPayload.receipt.writtenFileHashes.some((item) => item.path === "entities/entity-task.tg" && item.sha256), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topo", "entities", "entity-task.tg")), true);

  const history = runCli(["import", "history", targetRoot, "--json"]);
  assert.equal(history.status, 0, history.stderr || history.stdout);
  const historyPayload = JSON.parse(history.stdout);
  assert.equal(historyPayload.summary.receiptCount, 1);
  assert.equal(historyPayload.summary.forcedWriteCount, 1);
  assert.equal(historyPayload.receipts[0].reason, "Reviewed source drift");
  assert.equal(historyPayload.receipts[0].sourceProvenance.status, "changed");
});

function candidateIds(items) {
  return (items || []).map((item) => item.id_hint).sort();
}

function detectionIds(summary) {
  return Object.values(summary.extractor_detections || {})
    .flat()
    .map((item) => item.extractor)
    .sort();
}

function assertNoLegacyTopogramWorkspace(projectRoot) {
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram")), false);
}

function runCli(args) {
  return childProcess.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    }
  });
}
