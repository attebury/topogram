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
  assert.deepEqual(candidateIds(summary.candidates.ui.components), [
    "component_ui_task_list_results"
  ]);
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
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram", "candidates", "app", "report.md")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram", "candidates", "reconcile", "model", "bundles", "task", "entities", "entity_task.tg")), true);

  const check = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.ok, true);
  assert.equal(checkPayload.import.status, "clean");
  assert.equal(checkPayload.topogram.ok, true);

  fs.appendFileSync(
    path.join(targetRoot, "topogram", "candidates", "reconcile", "model", "bundles", "task", "README.md"),
    "\nLocal review note.\n"
  );
  const editedCheck = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(editedCheck.status, 0, editedCheck.stderr || editedCheck.stdout);
  assert.equal(JSON.parse(editedCheck.stdout).import.status, "clean");
});

test("brownfield UI import writes reviewable component candidates and shared bindings", () => {
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
  assert.equal(payload.candidateCounts.uiComponents, 1);

  const uiCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topogram", "candidates", "app", "ui", "candidates.json"), "utf8"));
  const componentCandidate = uiCandidates.components[0];
  assert.equal(componentCandidate.id_hint, "component_ui_task_list_results");
  assert.equal(componentCandidate.inferred_region, "results");
  assert.equal(componentCandidate.inferred_pattern, "search_results");
  assert.deepEqual(componentCandidate.inferred_props, [
    { name: "rows", type: "array", required: true, source: "cap_list_tasks" }
  ]);
  assert.deepEqual(componentCandidate.inferred_events, []);
  assert.equal(componentCandidate.missing_decisions.includes("confirm supported regions and patterns"), true);
  assert.equal((componentCandidate.evidence || []).length > 0, true);

  const sharedDraftPath = path.join(targetRoot, "topogram", "candidates", "app", "ui", "drafts", "proj-ui-shared.tg");
  const componentDraftPath = path.join(targetRoot, "topogram", "candidates", "app", "ui", "drafts", "components", "ui-task-list-results.tg");
  assert.equal(fs.existsSync(sharedDraftPath), true);
  assert.equal(fs.existsSync(componentDraftPath), true);

  const sharedDraft = fs.readFileSync(sharedDraftPath, "utf8");
  assert.match(sharedDraft, /platform ui_shared/);
  assert.match(sharedDraft, /ui_design \{/);
  assert.match(sharedDraft, /ui_components \{/);
  assert.match(sharedDraft, /screen task_list region results component component_ui_task_list_results data rows from cap_list_tasks/);
  assert.doesNotMatch(sharedDraft, /\[object Object\]/);

  const componentDraft = fs.readFileSync(componentDraftPath, "utf8");
  assert.match(componentDraft, /# Import metadata: confidence low; evidence \d+; inferred pattern search_results; inferred region results\./);
  assert.match(componentDraft, /# Missing decisions: confirm component reuse boundary; confirm prop names and data source; confirm events and behavior; confirm supported regions and patterns\./);
  assert.match(componentDraft, /component component_ui_task_list_results \{/);
  assert.match(componentDraft, /patterns \[search_results\]/);
  assert.match(componentDraft, /status proposed/);

  const uiReport = fs.readFileSync(path.join(targetRoot, "topogram", "candidates", "app", "ui", "report.md"), "utf8");
  assert.match(uiReport, /## Component Candidates/);
  assert.match(uiReport, /`component_ui_task_list_results` confidence low pattern `search_results` region `results` evidence \d+ missing decisions 4/);
  assert.match(uiReport, /topogram component check <path>/);
  assert.match(uiReport, /topogram component behavior <path>/);

  const plan = runCli(["import", "plan", targetRoot, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const planPayload = JSON.parse(plan.stdout);
  assert.equal(planPayload.summary.proposalItemCount, 9);
  assert.deepEqual(planPayload.bundles[0].kindCounts, {
    capability: 3,
    component: 1,
    doc: 1,
    ui: 4
  });
  const adoptionPlan = JSON.parse(fs.readFileSync(planPayload.artifacts.adoptionPlan, "utf8"));
  const componentItems = adoptionPlan.imported_proposal_surfaces.filter((item) => item.kind === "component");
  assert.deepEqual(componentItems.map((item) => item.item), ["component_ui_task_list_results"]);
  assert.equal(componentItems[0].source_path, "candidates/reconcile/model/bundles/task/components/component_ui_task_list_results.tg");
  assert.equal(componentItems[0].canonical_rel_path, "components/component-ui-task-list-results.tg");
  const reconcileReport = fs.readFileSync(path.join(targetRoot, "topogram", "candidates", "reconcile", "report.md"), "utf8");
  assert.match(reconcileReport, /1 components/);
  assert.match(reconcileReport, /main components `component_ui_task_list_results`/);
  const bundleReadme = fs.readFileSync(path.join(targetRoot, "topogram", "candidates", "reconcile", "model", "bundles", "task", "README.md"), "utf8");
  assert.match(bundleReadme, /Components: 1/);
  assert.match(bundleReadme, /Main components: `component_ui_task_list_results`/);

  const selectorList = runCli(["import", "adopt", "--list", targetRoot, "--json"]);
  assert.equal(selectorList.status, 0, selectorList.stderr || selectorList.stdout);
  const selectorPayload = JSON.parse(selectorList.stdout);
  const componentSelector = selectorPayload.broadSelectors.find((selector) => selector.selector === "components");
  assert.equal(componentSelector.itemCount, 1);
  assert.match(componentSelector.previewCommand, /topogram import adopt components .* --dry-run/);
  assert.match(componentSelector.writeCommand, /topogram import adopt components .* --write/);

  const humanSelectorList = runCli(["import", "adopt", "--list", targetRoot]);
  assert.equal(humanSelectorList.status, 0, humanSelectorList.stderr || humanSelectorList.stdout);
  assert.match(humanSelectorList.stdout, /Broad selectors:/);
  assert.match(humanSelectorList.stdout, /components: 1 components/);

  const adopt = runCli(["import", "adopt", "components", targetRoot, "--write", "--json"]);
  assert.equal(adopt.status, 0, adopt.stderr || adopt.stdout);
  const adoptPayload = JSON.parse(adopt.stdout);
  assert.equal(adoptPayload.promotedCanonicalItems.some((item) => item.kind === "component" && item.item === "component_ui_task_list_results"), true);
  assert.equal(adoptPayload.receipt.writtenFileHashes.some((item) => item.path === "components/component-ui-task-list-results.tg" && item.sha256 && item.size > 0), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram", "components", "component-ui-task-list-results.tg")), true);

  const check = runCli(["check", targetRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const status = runCli(["import", "status", targetRoot, "--json"]);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.equal(JSON.parse(status.stdout).adoption.summary.appliedItemCount, 1);
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
  const journeyPath = path.join(targetRoot, "topogram", "docs", "journeys", "task_journey.md");
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
  const dryRunDbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topogram", "candidates", "app", "db", "candidates.json"), "utf8"));
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
  assert.equal(refreshPayload.writtenFiles.includes("topogram/docs/journeys/task_journey.md"), false);
  assert.match(fs.readFileSync(journeyPath, "utf8"), /Local owner note/);

  const refreshedDbCandidates = JSON.parse(fs.readFileSync(path.join(targetRoot, "topogram", "candidates", "app", "db", "candidates.json"), "utf8"));
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
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram", "entities", "entity-task.tg")), false);
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
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram", "entities", "entity-task.tg")), true);

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

  fs.appendFileSync(path.join(targetRoot, "topogram", "entities", "entity-task.tg"), "\n");
  const changedVerify = runCli(["import", "history", targetRoot, "--verify", "--json"]);
  assert.equal(changedVerify.status, 0, changedVerify.stderr || changedVerify.stdout);
  const changedVerifyPayload = JSON.parse(changedVerify.stdout);
  assert.equal(changedVerifyPayload.verification.status, "changed");
  assert.equal(changedVerifyPayload.verification.summary.changedFileCount, 1);
  assert.equal(changedVerifyPayload.verification.files.find((item) => item.path === "entities/entity-task.tg").status, "changed");

  const editedCheck = runCli(["import", "check", targetRoot, "--json"]);
  assert.equal(editedCheck.status, 0, editedCheck.stderr || editedCheck.stdout);
  assert.equal(JSON.parse(editedCheck.stdout).import.status, "clean");

  fs.rmSync(path.join(targetRoot, "topogram", "docs", "journeys", "task_journey.md"));
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
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram", "entities", "entity-task.tg")), false);

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
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram", "entities", "entity-task.tg")), true);

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
