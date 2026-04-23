#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { parsePath } from "../src/parser.js";
import { resolveWorkspace } from "../src/resolver.js";
import { generateWorkspace } from "../src/generator.js";
import { stableStringify } from "../src/format.js";
import { formatValidationErrors, validateWorkspace } from "../src/validator.js";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(workspaceRoot, "..");
const todoRoot = path.join(repoRoot, "examples", "generated", "todo");
const todoPath = path.join(todoRoot, "topogram");
const expectedRoot = path.join(todoRoot, "topogram", "tests", "fixtures", "expected");
const migrationsRoot = path.join(todoRoot, "topogram", "tests", "fixtures", "migrations");
const todoAppsRoot = path.join(todoRoot, "apps", "local-stack");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, "utf8");
}

function writeText(filePath, value) {
  ensureDir(filePath);
  const text = value.endsWith("\n") ? value : `${value}\n`;
  fs.writeFileSync(filePath, text, "utf8");
}

function writeBundle(dirPath, files) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  for (const [relativePath, contents] of Object.entries(files)) {
    writeText(path.join(dirPath, relativePath), contents);
  }
}

function assertOk(result, label) {
  if (!result.ok) {
    throw new Error(`${label} failed:\n${formatValidationErrors(result.validation)}`);
  }
  return result.artifact;
}

function refreshExpectedFixtures() {
  const todoAst = parsePath(todoPath);
  const validation = validateWorkspace(todoAst);
  if (!validation.ok) {
    throw new Error(`Todo example failed validation:\n${formatValidationErrors(validation)}`);
  }

  const resolved = resolveWorkspace(todoAst);
  if (!resolved.ok) {
    throw new Error(`Todo example failed resolution:\n${formatValidationErrors(resolved.validation)}`);
  }

  writeJson(path.join(expectedRoot, "todo.resolve.json"), resolved.graph);

  const emptySnapshot = JSON.parse(fs.readFileSync(path.join(migrationsRoot, "empty.snapshot.json"), "utf8"));
  const additiveSnapshot = JSON.parse(
    fs.readFileSync(path.join(migrationsRoot, "proj_db_postgres.additive-from.snapshot.json"), "utf8")
  );
  const prioritySnapshot = JSON.parse(
    fs.readFileSync(path.join(migrationsRoot, "proj_db_postgres.priority-from.snapshot.json"), "utf8")
  );

  const jsonTargets = [
    [["todo.json-schema.json"], { target: "json-schema" }],
    [["docs-index.json"], { target: "docs-index" }],
    [["verification-plan.json"], { target: "verification-plan" }],
    [["shape_input_create_task.schema.json"], { target: "json-schema", shapeId: "shape_input_create_task" }],
    [["shape_output_task_card.schema.json"], { target: "json-schema", shapeId: "shape_output_task_card" }],
    [["shape_output_task_card.transform-graph.json"], { target: "shape-transform-graph", shapeId: "shape_output_task_card" }],
    [["cap_create_task.api-contract-graph.json"], { target: "api-contract-graph", capabilityId: "cap_create_task" }],
    [["cap_get_task.api-contract-graph.json"], { target: "api-contract-graph", capabilityId: "cap_get_task" }],
    [["cap_list_tasks.api-contract-graph.json"], { target: "api-contract-graph", capabilityId: "cap_list_tasks" }],
    [["cap_delete_task.api-contract-graph.json"], { target: "api-contract-graph", capabilityId: "cap_delete_task" }],
    [["cap_export_tasks.api-contract-graph.json"], { target: "api-contract-graph", capabilityId: "cap_export_tasks" }],
    [["cap_get_task_export_job.api-contract-graph.json"], { target: "api-contract-graph", capabilityId: "cap_get_task_export_job" }],
    [["cap_download_task_export.api-contract-graph.json"], { target: "api-contract-graph", capabilityId: "cap_download_task_export" }],
    [["proj_ui_shared.ui-contract-graph.json"], { target: "ui-contract-graph", projectionId: "proj_ui_shared" }],
    [["proj_ui_web.ui-web-contract.json"], { target: "ui-web-contract", projectionId: "proj_ui_web" }],
    [["proj_ui_web_react.ui-web-contract.json"], { target: "ui-web-contract", projectionId: "proj_ui_web_react" }],
    [["proj_db_postgres.db-contract-graph.json"], { target: "db-contract-graph", projectionId: "proj_db_postgres" }],
    [["proj_db_sqlite.db-contract-graph.json"], { target: "db-contract-graph", projectionId: "proj_db_sqlite" }],
    [["proj_db_postgres.db-schema-snapshot.json"], { target: "db-schema-snapshot", projectionId: "proj_db_postgres" }],
    [["proj_db_sqlite.db-schema-snapshot.json"], { target: "db-schema-snapshot", projectionId: "proj_db_sqlite" }],
    [["proj_db_postgres.initial.db-migration-plan.json"], { target: "db-migration-plan", projectionId: "proj_db_postgres", fromSnapshot: emptySnapshot, fromSnapshotPath: path.join(migrationsRoot, "empty.snapshot.json") }],
    [["proj_db_postgres.additive.db-migration-plan.json"], { target: "db-migration-plan", projectionId: "proj_db_postgres", fromSnapshot: additiveSnapshot, fromSnapshotPath: path.join(migrationsRoot, "proj_db_postgres.additive-from.snapshot.json") }],
    [["proj_db_postgres.priority.db-migration-plan.json"], { target: "db-migration-plan", projectionId: "proj_db_postgres", fromSnapshot: prioritySnapshot, fromSnapshotPath: path.join(migrationsRoot, "proj_db_postgres.priority-from.snapshot.json") }],
    [["proj_db_postgres.db-lifecycle-plan.json"], { target: "db-lifecycle-plan", projectionId: "proj_db_postgres" }],
    [["environment-plan.json"], { target: "environment-plan" }],
    [["environment-plan.local_process.json"], { target: "environment-plan", profileId: "local_process" }],
    [["deployment-plan.json"], { target: "deployment-plan" }],
    [["deployment-plan.railway.json"], { target: "deployment-plan", profileId: "railway" }],
    [["runtime-smoke-plan.json"], { target: "runtime-smoke-plan" }],
    [["runtime-check-plan.json"], { target: "runtime-check-plan" }],
    [["compile-check-plan.json"], { target: "compile-check-plan" }],
    [["app-bundle-plan.json"], { target: "app-bundle-plan" }],
    [["proj_api.server-contract.json"], { target: "server-contract", projectionId: "proj_api" }],
    [["cap_create_task.openapi.json"], { target: "openapi", capabilityId: "cap_create_task" }],
    [["cap_get_task.openapi.json"], { target: "openapi", capabilityId: "cap_get_task" }],
    [["cap_delete_task.openapi.json"], { target: "openapi", capabilityId: "cap_delete_task" }],
    [["cap_export_tasks.openapi.json"], { target: "openapi", capabilityId: "cap_export_tasks" }],
    [["cap_get_task_export_job.openapi.json"], { target: "openapi", capabilityId: "cap_get_task_export_job" }],
    [["cap_download_task_export.openapi.json"], { target: "openapi", capabilityId: "cap_download_task_export" }],
    [["cap_list_tasks.openapi.json"], { target: "openapi", capabilityId: "cap_list_tasks" }],
    [["openapi.json"], { target: "openapi" }]
  ];

  for (const [[fileName], options] of jsonTargets) {
    writeJson(path.join(expectedRoot, fileName), assertOk(generateWorkspace(todoAst, options), fileName));
  }

  const textTargets = [
    [["todo.docs.md"], { target: "docs" }],
    [["verification-checklist.md"], { target: "verification-checklist" }],
    [["shape_output_task_card.transform-debug.md"], { target: "shape-transform-debug", shapeId: "shape_output_task_card" }],
    [["cap_create_task.api-contract-debug.md"], { target: "api-contract-debug", capabilityId: "cap_create_task" }],
    [["proj_ui_shared.ui-contract-debug.md"], { target: "ui-contract-debug", projectionId: "proj_ui_shared" }],
    [["proj_ui_web.ui-web-debug.md"], { target: "ui-web-debug", projectionId: "proj_ui_web" }],
    [["proj_db_postgres.db-contract-debug.md"], { target: "db-contract-debug", projectionId: "proj_db_postgres" }],
    [["proj_db_postgres.sql"], { target: "sql-schema", projectionId: "proj_db_postgres" }],
    [["proj_db_sqlite.sql"], { target: "sql-schema", projectionId: "proj_db_sqlite" }],
    [["proj_db_postgres.initial.migration.sql"], { target: "sql-migration", projectionId: "proj_db_postgres", fromSnapshot: emptySnapshot, fromSnapshotPath: path.join(migrationsRoot, "empty.snapshot.json") }],
    [["proj_db_postgres.priority.migration.sql"], { target: "sql-migration", projectionId: "proj_db_postgres", fromSnapshot: prioritySnapshot, fromSnapshotPath: path.join(migrationsRoot, "proj_db_postgres.priority-from.snapshot.json") }],
    [["proj_db_postgres.prisma"], { target: "prisma-schema", projectionId: "proj_db_postgres" }],
    [["proj_db_postgres.drizzle.ts"], { target: "drizzle-schema", projectionId: "proj_db_postgres" }]
  ];

  for (const [[fileName], options] of textTargets) {
    writeText(path.join(expectedRoot, fileName), assertOk(generateWorkspace(todoAst, options), fileName));
  }

  const bundleTargets = [
    [["db-lifecycle"], { target: "db-lifecycle-bundle", projectionId: "proj_db_postgres" }],
    [["db-lifecycle-bundle"], { target: "db-lifecycle-bundle", projectionId: "proj_db_postgres" }],
    [["environment-bundle"], { target: "environment-bundle" }],
    [["environment-bundle.local_process"], { target: "environment-bundle", profileId: "local_process" }],
    [["deployment-bundle"], { target: "deployment-bundle" }],
    [["deployment-bundle.railway"], { target: "deployment-bundle", profileId: "railway" }],
    [["runtime-smoke-bundle"], { target: "runtime-smoke-bundle" }],
    [["runtime-check-bundle"], { target: "runtime-check-bundle" }],
    [["compile-check-bundle"], { target: "compile-check-bundle" }],
    [["app-bundle"], { target: "app-bundle" }],
    [["persistence-scaffold"], { target: "persistence-scaffold", projectionId: "proj_db_postgres" }],
    [["hono-server"], { target: "hono-server", projectionId: "proj_api" }],
    [["express-server"], { target: "express-server", projectionId: "proj_api" }]
  ];

  for (const [[dirName], options] of bundleTargets) {
    writeBundle(path.join(expectedRoot, dirName), assertOk(generateWorkspace(todoAst, options), dirName));
  }

  const localStackBundle = assertOk(generateWorkspace(todoAst, { target: "app-bundle" }), "apps/local-stack");
  writeText(path.join(todoAppsRoot, "app-bundle-plan.json"), localStackBundle["app-bundle-plan.json"]);
  writeText(path.join(todoAppsRoot, "README.md"), localStackBundle["README.md"]);
  writeText(path.join(todoAppsRoot, "package.json"), localStackBundle["package.json"]);
  writeText(path.join(todoAppsRoot, "scripts", "runtime-check.sh"), localStackBundle["scripts/runtime-check.sh"]);
  writeText(path.join(todoAppsRoot, "scripts", "smoke.sh"), localStackBundle["scripts/smoke.sh"]);
  writeBundle(
    path.join(todoAppsRoot, "runtime-check"),
    Object.fromEntries(
      Object.entries(localStackBundle)
        .filter(([relativePath]) => relativePath.startsWith("runtime-check/"))
        .map(([relativePath, contents]) => [relativePath.replace(/^runtime-check\//, ""), contents])
    )
  );
  writeBundle(
    path.join(todoAppsRoot, "smoke"),
    Object.fromEntries(
      Object.entries(localStackBundle)
        .filter(([relativePath]) => relativePath.startsWith("smoke/"))
        .map(([relativePath, contents]) => [relativePath.replace(/^smoke\//, ""), contents])
    )
  );
}

refreshExpectedFixtures();
console.log("Refreshed Todo example expected fixtures.");
