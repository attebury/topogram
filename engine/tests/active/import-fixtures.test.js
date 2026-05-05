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

  const preview = runCli(["import", "adopt", "bundle:task", targetRoot, "--json"]);
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  const previewPayload = JSON.parse(preview.stdout);
  assert.equal(previewPayload.dryRun, true);
  assert.equal(previewPayload.write, false);
  assert.equal(previewPayload.promotedCanonicalItemCount, 5);
  assert.deepEqual(previewPayload.writtenFiles, []);
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram", "entities", "entity-task.tg")), false);

  const write = runCli(["import", "adopt", "bundle:task", targetRoot, "--write", "--json"]);
  assert.equal(write.status, 0, write.stderr || write.stdout);
  const writePayload = JSON.parse(write.stdout);
  assert.equal(writePayload.dryRun, false);
  assert.equal(writePayload.write, true);
  assert.equal(writePayload.promotedCanonicalItemCount, 5);
  assert.equal(writePayload.writtenFiles.includes("entities/entity-task.tg"), true);
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
