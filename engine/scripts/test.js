#!/usr/bin/env node

import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parsePath } from "../src/parser.js";
import { stableStringify } from "../src/format.js";
import { generateWorkspace } from "../src/generator.js";
import { buildApiRealization } from "../src/realization/api/index.js";
import {
  buildDbMigrationPlanRealization,
  buildDbRealization
} from "../src/realization/db/index.js";
import { buildBackendRuntimeRealization } from "../src/realization/backend/index.js";
import { buildUiSharedRealization, buildWebRealization } from "../src/realization/ui/index.js";
import { renderCreateTable, renderIndexes } from "../src/generator/db/shared.js";
import { resolveWorkspace } from "../src/resolver.js";
import { formatValidationErrors, validateWorkspace } from "../src/validator.js";
import { runWorkflow } from "../src/workflows.js";
import { buildBackendParityEvidence } from "../src/proofs/backend-parity.js";
import { buildIssuesParityEvidence } from "../src/proofs/issues-parity.js";
import { buildWebParityEvidence } from "../src/proofs/web-parity.js";
import { analyzeSurveyAtRoot } from "./analyze-ui-survey.mjs";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeText(value) {
  return `${value.replace(/\s+$/, "")}\n`;
}

function writeGeneratedFiles(rootDir, files) {
  for (const [filePath, contents] of Object.entries(files)) {
    const destination = path.join(rootDir, filePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents, "utf8");
  }
}

function listRelativeFiles(rootDir, currentDir = rootDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRelativeFiles(rootDir, absolutePath));
    } else {
      files.push(path.relative(rootDir, absolutePath));
    }
  }
  return files.sort();
}

function assertIncludes(haystack, needles, label) {
  for (const needle of needles) {
    if (!haystack.includes(needle)) {
      throw new Error(`${label} is missing expected text: ${needle}`);
    }
  }
}

function assertExcludes(haystack, needles, label) {
  for (const needle of needles) {
    if (haystack.includes(needle)) {
      throw new Error(`${label} unexpectedly included text: ${needle}`);
    }
  }
}

function assertConfirmedProofStatus(topogramRoot, label) {
  const statusPath = path.join(topogramRoot, "candidates", "reconcile", "adoption-status.json");
  const status = readJson(statusPath);
  if (status.next_bundle !== null) {
    throw new Error(`Expected ${label} to have no remaining next bundle, found ${status.next_bundle.bundle}`);
  }
  if ((status.blocked_item_count || 0) !== 0) {
    throw new Error(`Expected ${label} to have zero blocked adoption items`);
  }
  if ((status.applied_item_count || 0) <= 0) {
    throw new Error(`Expected ${label} to have applied canonical adoption items`);
  }
}

function assertDeepEqual(actual, expected, label) {
  const actualText = stableStringify(actual);
  const expectedText = stableStringify(expected);

  if (actualText !== expectedText) {
    throw new Error(`${label} did not match expected output`);
  }
}

function assertRedirectEscapesCatch(source, label) {
  for (const match of source.matchAll(/try\s*{([\s\S]*?)}\s*catch\s*\(error\)/g)) {
    if (match[1].includes("throw redirect(")) {
      throw new Error(`${label} catches a success redirect inside try/catch`);
    }
  }
  assertIncludes(source, ["throw redirect("], label);
}

function runNodeScript(cwd, relativePath) {
  const run = childProcess.spawnSync(process.execPath, [relativePath], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || ""
    }
  });
  if (run.status !== 0) {
    throw new Error(`Expected ${relativePath} to succeed in ${cwd}:\n${run.stderr || run.stdout}`);
  }
}

function runCli(args, cwd = workspaceRoot) {
  return childProcess.spawnSync(process.execPath, ["./src/cli.js", ...args], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || ""
    }
  });
}

function runNodeTests(cwd, relativeDir) {
  const absoluteDir = path.join(cwd, relativeDir);
  const testFiles = listRelativeFiles(absoluteDir)
    .filter((filePath) => filePath.endsWith(".test.js"))
    .map((filePath) => path.join(relativeDir, filePath));
  if (testFiles.length === 0) {
    throw new Error(`Expected at least one narrow test under ${relativeDir}`);
  }
  const run = childProcess.spawnSync(process.execPath, ["--test", ...testFiles], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
  if (run.status !== 0) {
    throw new Error(`Expected narrow tests in ${relativeDir} to succeed:\n${run.stderr || run.stdout}`);
  }
}

function runShellScript(cwd, relativePath, env = {}) {
  const run = childProcess.spawnSync("bash", [relativePath], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
      PATH: process.env.PATH || ""
    }
  });
  if (run.status !== 0) {
    throw new Error(`Expected ${relativePath} to succeed in ${cwd}:\n${run.stderr || run.stdout}`);
  }
  return run.stdout;
}

function runShellScriptExpectFailure(cwd, relativePath, env = {}) {
  const run = childProcess.spawnSync("bash", [relativePath], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
      PATH: process.env.PATH || ""
    }
  });
  if (run.status === 0) {
    throw new Error(`Expected ${relativePath} to fail in ${cwd}`);
  }
  return {
    stdout: run.stdout,
    stderr: run.stderr,
    status: run.status
  };
}

function querySqlite(databasePath, sql) {
  const run = childProcess.spawnSync("sqlite3", [databasePath, sql], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || ""
    }
  });
  if (run.status !== 0) {
    throw new Error(`Expected sqlite3 query to succeed for ${databasePath}:\n${run.stderr || run.stdout}`);
  }
  return run.stdout.trim();
}

function applySqliteSchemaSnapshot(databasePath, snapshot) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const statements = [];
  for (const table of snapshot.tables || []) {
    statements.push(renderCreateTable(table, "sqlite"));
    statements.push(...renderIndexes(table));
  }
  const run = childProcess.spawnSync("sqlite3", [databasePath], {
    input: `${statements.join("\n\n")}\n`,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || ""
    }
  });
  if (run.status !== 0) {
    throw new Error(`Expected sqlite schema application to succeed for ${databasePath}:\n${run.stderr || run.stdout}`);
  }
}

function writeLifecycleBundle(rootDir, files) {
  fs.rmSync(rootDir, { recursive: true, force: true });
  writeGeneratedFiles(rootDir, files);
}

function writeSurveyFixture(rootDir, manifest) {
  fs.mkdirSync(rootDir, { recursive: true });
  fs.writeFileSync(path.join(rootDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(rootDir, "concept-taxonomy.json"),
    `${JSON.stringify({ version: 1, note: "test fixture" }, null, 2)}\n`,
    "utf8"
  );
}

function deriveTodoPrioritySqliteSnapshot(todoAst) {
  const snapshotResult = generateWorkspace(todoAst, {
    target: "db-schema-snapshot",
    projectionId: "proj_db_sqlite"
  });
  if (!snapshotResult.ok) {
    throw new Error(`Expected Todo SQLite DB snapshot generation to succeed:\n${formatValidationErrors(snapshotResult.validation)}`);
  }
  const snapshot = snapshotResult.artifact;
  return {
    ...snapshot,
    enums: (snapshot.enums || []).filter((entry) => entry.id !== "task_priority"),
    tables: (snapshot.tables || []).map((table) =>
      table.table === "tasks"
        ? {
            ...table,
            columns: table.columns.filter((column) => column.name !== "priority")
          }
        : table
    )
  };
}

function deriveContentApprovalNeedsRevisionSqliteSnapshot(contentApprovalAst) {
  const snapshotResult = generateWorkspace(contentApprovalAst, {
    target: "db-schema-snapshot",
    projectionId: "proj_db_sqlite"
  });
  if (!snapshotResult.ok) {
    throw new Error(`Expected content-approval SQLite DB snapshot generation to succeed:\n${formatValidationErrors(snapshotResult.validation)}`);
  }
  const snapshot = snapshotResult.artifact;
  return {
    ...snapshot,
    enums: (snapshot.enums || []).map((entry) =>
      entry.id === "article_status"
        ? {
            ...entry,
            values: entry.values.filter((value) => value !== "needs_revision")
          }
        : entry
    ),
    tables: (snapshot.tables || []).map((table) =>
      table.table === "articles"
        ? {
            ...table,
            columns: table.columns.filter((column) => column.name !== "revision_requested_at")
          }
        : table
    )
  };
}

function run() {
  runNodeTests(workspaceRoot, "tests/narrow");

  const repoRoot = path.resolve(workspaceRoot, "..");
  const todoRoot = path.join(repoRoot, "examples", "generated", "todo");
  const todoPath = path.join(todoRoot, "topogram");
  const issuesRoot = path.join(repoRoot, "examples", "generated", "issues");
  const issuesPath = path.join(issuesRoot, "topogram");
  const contentApprovalRoot = path.join(repoRoot, "examples", "generated", "content-approval");
  const contentApprovalPath = path.join(contentApprovalRoot, "topogram");
  const invalidPath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "missing-reference");
  const invalidShapePath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "shape-transform");
  const invalidExpressionPath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "expression");
  const invalidHttpResponsesPath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "http-responses");
  const invalidHttpCachePath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "http-cache");
  const invalidHttpApiPath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "http-api-semantics");
  const invalidUiPath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "ui");
  const invalidUiWebPath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "ui-web");
  const invalidDbPath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "db");
  const invalidDocsPath = path.join(workspaceRoot, "tests", "fixtures", "invalid", "docs");
  const importFixturesRoot = path.join(workspaceRoot, "tests", "fixtures", "import");
  const prismaOpenApiPath = path.join(importFixturesRoot, "prisma-openapi");
  const sqlOpenApiPath = path.join(importFixturesRoot, "sql-openapi");
  const incompleteImportTopogramPath = path.join(importFixturesRoot, "incomplete-topogram", "topogram");
  const routeFallbackPath = path.join(importFixturesRoot, "route-fallback");
  const supabaseExpressTrialPath = path.join(workspaceRoot, "..", "trials", "supabase-express-api");
  const trpcTrialPath = path.join(workspaceRoot, "..", "trials", "trpc-examples-next-prisma-starter");
  const fastifyTrialPath = path.join(workspaceRoot, "..", "trials", "fastify-demo");
  const railsTrialPath = path.join(workspaceRoot, "..", "trials", "rails-realworld-example-app");
  const djangoTrialPath = path.join(workspaceRoot, "..", "trials", "django-realworld-example-app");
  const springTrialPath = path.join(workspaceRoot, "..", "trials", "realworld-backend-spring");
  const springBootRealworldTrialPath = path.join(workspaceRoot, "..", "trials", "spring-boot-realworld-example-app");
  const cleanArchitectureDeliveryTrialPath = path.join(workspaceRoot, "..", "trials", "clean-architecture-delivery-example");
  const quarkusTrialPath = path.join(workspaceRoot, "..", "trials", "realworld-api-quarkus");
  const micronautTrialPath = path.join(workspaceRoot, "..", "trials", "realworld-backend-micronaut");
  const jakartaEeTrialPath = path.join(workspaceRoot, "..", "trials", "jakartaee-rest-sample");
  const aspnetCoreTrialPath = path.join(workspaceRoot, "..", "trials", "aspnetcore-realworld-example-app");
  const eShopOnWebTrialPath = path.join(workspaceRoot, "..", "trials", "eShopOnWeb");
  const pokedexComposeTrialPath = path.join(importFixturesRoot, "pokedex-compose-source");
  const swiftUiTrialPath = path.join(workspaceRoot, "..", "trials", "clean-architecture-swiftui");
  const uiKitTrialPath = path.join(importFixturesRoot, "focus-ios-source");
  const mauiTodoRestTrialPath = path.join(importFixturesRoot, "maui-todo-rest-source");
  const flutterGoRestTrialPath = path.join(importFixturesRoot, "flutter-go-rest-source");
  const reactNativeTrialPath = path.join(importFixturesRoot, "react-native-clean-architecture-source");
  const graphqlSdlTrialPath = path.join(importFixturesRoot, "graphql-sdl-first-source");
  const nestGraphqlTrialPath = path.join(importFixturesRoot, "nest-graphql-source");
  const nextGraphqlTrialPath = path.join(importFixturesRoot, "nextjs-graphql-source");
  const nexusGraphqlTrialPath = path.join(importFixturesRoot, "graphql-nexus-source");
  const migrationsDir = path.join(todoRoot, "topogram", "tests", "fixtures", "migrations");
  const contentApprovalMigrationsDir = path.join(contentApprovalRoot, "topogram", "tests", "fixtures", "migrations");
  const expectedDir = path.join(todoRoot, "topogram", "tests", "fixtures", "expected");
  const issuesExpectedDir = path.join(issuesRoot, "topogram", "tests", "fixtures", "expected");
  const contentApprovalExpectedDir = path.join(contentApprovalRoot, "topogram", "tests", "fixtures", "expected");
  const todoAst = parsePath(todoPath);
  const issuesAst = parsePath(issuesPath);
  const contentApprovalAst = parsePath(contentApprovalPath);

  const validation = validateWorkspace(todoAst);
  if (!validation.ok) {
    throw new Error(`Expected todo fixtures to validate cleanly:\n${formatValidationErrors(validation)}`);
  }

  const resolved = resolveWorkspace(todoAst);
  if (!resolved.ok) {
    throw new Error(`Expected todo fixtures to resolve cleanly:\n${formatValidationErrors(resolved.validation)}`);
  }

  assertDeepEqual(
    resolved.graph,
    readJson(path.join(expectedDir, "todo.resolve.json")),
    "Resolved semantic graph"
  );

  const generatedAll = generateWorkspace(todoAst, { target: "json-schema" });
  if (!generatedAll.ok) {
    throw new Error(`Expected schema generation to succeed:\n${formatValidationErrors(generatedAll.validation)}`);
  }
  assertDeepEqual(
    generatedAll.artifact,
    readJson(path.join(expectedDir, "todo.json-schema.json")),
    "Generated schema set"
  );

  const generatedDocsIndex = generateWorkspace(todoAst, { target: "docs-index" });
  if (!generatedDocsIndex.ok) {
    throw new Error(`Expected docs-index generation to succeed:\n${formatValidationErrors(generatedDocsIndex.validation)}`);
  }
  const todoJourneyDoc = generatedDocsIndex.artifact.docs.find((doc) => doc.id === "task_creation_and_ownership");
  if (!todoJourneyDoc || todoJourneyDoc.kind !== "journey" || !todoJourneyDoc.related_capabilities.includes("cap_create_task")) {
    throw new Error("Expected Todo docs index to include the canonical task creation journey");
  }
  assertDeepEqual(
    generatedDocsIndex.artifact,
    readJson(path.join(expectedDir, "docs-index.json")),
    "Todo docs index"
  );

  const generatedVerificationPlan = generateWorkspace(todoAst, { target: "verification-plan" });
  if (!generatedVerificationPlan.ok) {
    throw new Error(`Expected verification-plan generation to succeed:\n${formatValidationErrors(generatedVerificationPlan.validation)}`);
  }
  assertDeepEqual(
    generatedVerificationPlan.artifact,
    readJson(path.join(expectedDir, "verification-plan.json")),
    "Todo verification plan"
  );

  const generatedOne = generateWorkspace(todoAst, {
    target: "json-schema",
    shapeId: "shape_input_create_task"
  });
  if (!generatedOne.ok) {
    throw new Error(`Expected single-shape generation to succeed:\n${formatValidationErrors(generatedOne.validation)}`);
  }
  assertDeepEqual(
    generatedOne.artifact,
    readJson(path.join(expectedDir, "shape_input_create_task.schema.json")),
    "Single shape schema"
  );

  const generatedRenamed = generateWorkspace(todoAst, {
    target: "json-schema",
    shapeId: "shape_output_task_card"
  });
  if (!generatedRenamed.ok) {
    throw new Error(`Expected renamed shape generation to succeed:\n${formatValidationErrors(generatedRenamed.validation)}`);
  }
  assertDeepEqual(
    generatedRenamed.artifact,
    readJson(path.join(expectedDir, "shape_output_task_card.schema.json")),
    "Renamed and overridden shape schema"
  );

  const generatedDocs = generateWorkspace(todoAst, { target: "docs" });
  if (!generatedDocs.ok) {
    throw new Error(`Expected docs generation to succeed:\n${formatValidationErrors(generatedDocs.validation)}`);
  }
  if (normalizeText(generatedDocs.artifact) !== normalizeText(readText(path.join(expectedDir, "todo.docs.md")))) {
    throw new Error("Generated docs did not match expected output");
  }

  const generatedVerificationChecklist = generateWorkspace(todoAst, { target: "verification-checklist" });
  if (!generatedVerificationChecklist.ok) {
    throw new Error(`Expected verification-checklist generation to succeed:\n${formatValidationErrors(generatedVerificationChecklist.validation)}`);
  }
  if (
    normalizeText(generatedVerificationChecklist.artifact) !==
    normalizeText(readText(path.join(expectedDir, "verification-checklist.md")))
  ) {
    throw new Error("Generated verification checklist did not match expected output");
  }

  const generatedTransformGraph = generateWorkspace(todoAst, {
    target: "shape-transform-graph",
    shapeId: "shape_output_task_card"
  });
  if (!generatedTransformGraph.ok) {
    throw new Error(`Expected transform graph generation to succeed:\n${formatValidationErrors(generatedTransformGraph.validation)}`);
  }
  assertDeepEqual(
    generatedTransformGraph.artifact,
    readJson(path.join(expectedDir, "shape_output_task_card.transform-graph.json")),
    "Shape transform graph"
  );

  const generatedTransformDebug = generateWorkspace(todoAst, {
    target: "shape-transform-debug",
    shapeId: "shape_output_task_card"
  });
  if (!generatedTransformDebug.ok) {
    throw new Error(`Expected transform debug generation to succeed:\n${formatValidationErrors(generatedTransformDebug.validation)}`);
  }
  if (
    normalizeText(generatedTransformDebug.artifact) !==
    normalizeText(readText(path.join(expectedDir, "shape_output_task_card.transform-debug.md")))
  ) {
    throw new Error("Generated transform debug output did not match expected output");
  }

  const generatedApiContractGraph = generateWorkspace(todoAst, {
    target: "api-contract-graph",
    capabilityId: "cap_create_task"
  });
  if (!generatedApiContractGraph.ok) {
    throw new Error(`Expected API contract graph generation to succeed:\n${formatValidationErrors(generatedApiContractGraph.validation)}`);
  }
  assertDeepEqual(
    generatedApiContractGraph.artifact,
    readJson(path.join(expectedDir, "cap_create_task.api-contract-graph.json")),
    "API contract graph"
  );

  const generatedGetApiContractGraph = generateWorkspace(todoAst, {
    target: "api-contract-graph",
    capabilityId: "cap_get_task"
  });
  if (!generatedGetApiContractGraph.ok) {
    throw new Error(`Expected get-task API contract graph generation to succeed:\n${formatValidationErrors(generatedGetApiContractGraph.validation)}`);
  }
  assertDeepEqual(
    generatedGetApiContractGraph.artifact,
    readJson(path.join(expectedDir, "cap_get_task.api-contract-graph.json")),
    "Get-task API contract graph"
  );
  if (
    !generatedGetApiContractGraph.artifact.endpoint?.cache?.some(
      (rule) => rule.responseHeader === "ETag" && rule.requestHeader === "If-None-Match" && rule.notModified === 304
    )
  ) {
    throw new Error("Expected get-task API contract graph to expose conditional read cache metadata");
  }

  const generatedListApiContractGraph = generateWorkspace(todoAst, {
    target: "api-contract-graph",
    capabilityId: "cap_list_tasks"
  });
  if (!generatedListApiContractGraph.ok) {
    throw new Error(`Expected list API contract graph generation to succeed:\n${formatValidationErrors(generatedListApiContractGraph.validation)}`);
  }
  if (
    generatedListApiContractGraph.artifact.responseContract?.mode !== "cursor" ||
    generatedListApiContractGraph.artifact.responseContract?.jsonSchema?.type !== "object" ||
    generatedListApiContractGraph.artifact.responseContract?.jsonSchema?.properties?.items?.type !== "array" ||
    !generatedListApiContractGraph.artifact.responseContract?.cursor?.requestAfter ||
    !generatedListApiContractGraph.artifact.responseContract?.limit?.field
  ) {
    throw new Error("Expected list capability response contract to resolve as a cursor envelope");
  }
  assertDeepEqual(
    generatedListApiContractGraph.artifact,
    readJson(path.join(expectedDir, "cap_list_tasks.api-contract-graph.json")),
    "List API contract graph"
  );

  const generatedDeleteApiContractGraph = generateWorkspace(todoAst, {
    target: "api-contract-graph",
    capabilityId: "cap_delete_task"
  });
  if (!generatedDeleteApiContractGraph.ok) {
    throw new Error(`Expected delete-task API contract graph generation to succeed:\n${formatValidationErrors(generatedDeleteApiContractGraph.validation)}`);
  }
  assertDeepEqual(
    generatedDeleteApiContractGraph.artifact,
    readJson(path.join(expectedDir, "cap_delete_task.api-contract-graph.json")),
    "Delete-task API contract graph"
  );
  if (
    !generatedDeleteApiContractGraph.artifact.endpoint?.delete?.some(
      (rule) => rule.mode === "soft" && rule.field === "status" && rule.value === "archived" && rule.response === "body"
    )
  ) {
    throw new Error("Expected delete-task API contract graph to expose soft-delete lifecycle metadata");
  }

  const generatedExportApiContractGraph = generateWorkspace(todoAst, {
    target: "api-contract-graph",
    capabilityId: "cap_export_tasks"
  });
  if (!generatedExportApiContractGraph.ok) {
    throw new Error(`Expected export-task API contract graph generation to succeed:\n${formatValidationErrors(generatedExportApiContractGraph.validation)}`);
  }
  assertDeepEqual(
    generatedExportApiContractGraph.artifact,
    readJson(path.join(expectedDir, "cap_export_tasks.api-contract-graph.json")),
    "Export-task API contract graph"
  );
  if (
    !generatedExportApiContractGraph.artifact.endpoint?.async?.some(
      (rule) => rule.mode === "job" && rule.accepted === 202 && rule.locationHeader === "Location"
    )
  ) {
    throw new Error("Expected export-task API contract graph to expose async job metadata");
  }
  if (
    !generatedExportApiContractGraph.artifact.endpoint?.authz?.some(
      (rule) => rule.permission === "tasks.export"
    )
  ) {
    throw new Error("Expected export-task API contract graph to expose authorization semantics");
  }
  if (
    !generatedExportApiContractGraph.artifact.endpoint?.callbacks?.some(
      (rule) => rule.event === "export_completed" && rule.targetField === "callback_url"
    )
  ) {
    throw new Error("Expected export-task API contract graph to expose callback semantics");
  }

  const generatedStatusApiContractGraph = generateWorkspace(todoAst, {
    target: "api-contract-graph",
    capabilityId: "cap_get_task_export_job"
  });
  if (!generatedStatusApiContractGraph.ok) {
    throw new Error(`Expected export-status API contract graph generation to succeed:\n${formatValidationErrors(generatedStatusApiContractGraph.validation)}`);
  }
  assertDeepEqual(
    generatedStatusApiContractGraph.artifact,
    readJson(path.join(expectedDir, "cap_get_task_export_job.api-contract-graph.json")),
    "Export-status API contract graph"
  );
  if (
    !generatedStatusApiContractGraph.artifact.endpoint?.status?.some(
      (rule) => rule.stateField === "status" && rule.downloadCapability?.id === "cap_download_task_export"
    )
  ) {
    throw new Error("Expected export-status API contract graph to expose terminal status semantics");
  }

  const generatedDownloadApiContractGraph = generateWorkspace(todoAst, {
    target: "api-contract-graph",
    capabilityId: "cap_download_task_export"
  });
  if (!generatedDownloadApiContractGraph.ok) {
    throw new Error(`Expected export-download API contract graph generation to succeed:\n${formatValidationErrors(generatedDownloadApiContractGraph.validation)}`);
  }
  assertDeepEqual(
    generatedDownloadApiContractGraph.artifact,
    readJson(path.join(expectedDir, "cap_download_task_export.api-contract-graph.json")),
    "Export-download API contract graph"
  );
  if (
    !generatedDownloadApiContractGraph.artifact.endpoint?.download?.some(
      (rule) => rule.media === "application/zip" && rule.disposition === "attachment"
    )
  ) {
    throw new Error("Expected export-download API contract graph to expose binary download semantics");
  }

  const generatedApiContractDebug = generateWorkspace(todoAst, {
    target: "api-contract-debug",
    capabilityId: "cap_create_task"
  });
  if (!generatedApiContractDebug.ok) {
    throw new Error(`Expected API contract debug generation to succeed:\n${formatValidationErrors(generatedApiContractDebug.validation)}`);
  }
  if (
    normalizeText(generatedApiContractDebug.artifact) !==
    normalizeText(readText(path.join(expectedDir, "cap_create_task.api-contract-debug.md")))
  ) {
    throw new Error("Generated API contract debug output did not match expected output");
  }

  const generatedUiContractGraph = generateWorkspace(todoAst, {
    target: "ui-contract-graph",
    projectionId: "proj_ui_shared"
  });
  if (!generatedUiContractGraph.ok) {
    throw new Error(`Expected UI contract graph generation to succeed:\n${formatValidationErrors(generatedUiContractGraph.validation)}`);
  }
  assertDeepEqual(
    generatedUiContractGraph.artifact,
    readJson(path.join(expectedDir, "proj_ui_shared.ui-contract-graph.json")),
    "UI contract graph"
  );

  const generatedUiContractDebug = generateWorkspace(todoAst, {
    target: "ui-contract-debug",
    projectionId: "proj_ui_shared"
  });
  if (!generatedUiContractDebug.ok) {
    throw new Error(`Expected UI contract debug generation to succeed:\n${formatValidationErrors(generatedUiContractDebug.validation)}`);
  }
  if (
    normalizeText(generatedUiContractDebug.artifact) !==
    normalizeText(readText(path.join(expectedDir, "proj_ui_shared.ui-contract-debug.md")))
  ) {
    throw new Error("Generated UI contract debug output did not match expected output");
  }

  const generatedUiWebContract = generateWorkspace(todoAst, {
    target: "ui-web-contract",
    projectionId: "proj_ui_web"
  });
  if (!generatedUiWebContract.ok) {
    throw new Error(`Expected UI web contract generation to succeed:\n${formatValidationErrors(generatedUiWebContract.validation)}`);
  }
  assertDeepEqual(
    generatedUiWebContract.artifact,
    readJson(path.join(expectedDir, "proj_ui_web.ui-web-contract.json")),
    "UI web contract"
  );

  const generatedUiWebDebug = generateWorkspace(todoAst, {
    target: "ui-web-debug",
    projectionId: "proj_ui_web"
  });
  if (!generatedUiWebDebug.ok) {
    throw new Error(`Expected UI web debug generation to succeed:\n${formatValidationErrors(generatedUiWebDebug.validation)}`);
  }
  if (
    normalizeText(generatedUiWebDebug.artifact) !==
    normalizeText(readText(path.join(expectedDir, "proj_ui_web.ui-web-debug.md")))
  ) {
    throw new Error("Generated UI web debug output did not match expected output");
  }

  const generatedDbContractPg = generateWorkspace(todoAst, {
    target: "db-contract-graph",
    projectionId: "proj_db_postgres"
  });
  if (!generatedDbContractPg.ok) {
    throw new Error(`Expected Postgres DB contract generation to succeed:\n${formatValidationErrors(generatedDbContractPg.validation)}`);
  }
  assertDeepEqual(
    generatedDbContractPg.artifact,
    readJson(path.join(expectedDir, "proj_db_postgres.db-contract-graph.json")),
    "Postgres DB contract graph"
  );

  const generatedDbContractSqlite = generateWorkspace(todoAst, {
    target: "db-contract-graph",
    projectionId: "proj_db_sqlite"
  });
  if (!generatedDbContractSqlite.ok) {
    throw new Error(`Expected SQLite DB contract generation to succeed:\n${formatValidationErrors(generatedDbContractSqlite.validation)}`);
  }
  assertDeepEqual(
    generatedDbContractSqlite.artifact,
    readJson(path.join(expectedDir, "proj_db_sqlite.db-contract-graph.json")),
    "SQLite DB contract graph"
  );

  const generatedDbDebugPg = generateWorkspace(todoAst, {
    target: "db-contract-debug",
    projectionId: "proj_db_postgres"
  });
  if (!generatedDbDebugPg.ok) {
    throw new Error(`Expected Postgres DB debug generation to succeed:\n${formatValidationErrors(generatedDbDebugPg.validation)}`);
  }
  if (
    normalizeText(generatedDbDebugPg.artifact) !==
    normalizeText(readText(path.join(expectedDir, "proj_db_postgres.db-contract-debug.md")))
  ) {
    throw new Error("Generated Postgres DB debug output did not match expected output");
  }

  const generatedPostgresSql = generateWorkspace(todoAst, {
    target: "sql-schema",
    projectionId: "proj_db_postgres"
  });
  if (!generatedPostgresSql.ok) {
    throw new Error(`Expected Postgres SQL generation to succeed:\n${formatValidationErrors(generatedPostgresSql.validation)}`);
  }
  if (normalizeText(generatedPostgresSql.artifact) !== normalizeText(readText(path.join(expectedDir, "proj_db_postgres.sql")))) {
    throw new Error("Generated Postgres SQL did not match expected output");
  }

  const generatedSqliteSql = generateWorkspace(todoAst, {
    target: "sql-schema",
    projectionId: "proj_db_sqlite"
  });
  if (!generatedSqliteSql.ok) {
    throw new Error(`Expected SQLite SQL generation to succeed:\n${formatValidationErrors(generatedSqliteSql.validation)}`);
  }
  if (normalizeText(generatedSqliteSql.artifact) !== normalizeText(readText(path.join(expectedDir, "proj_db_sqlite.sql")))) {
    throw new Error("Generated SQLite SQL did not match expected output");
  }

  const generatedDbSnapshotPg = generateWorkspace(todoAst, {
    target: "db-schema-snapshot",
    projectionId: "proj_db_postgres"
  });
  if (!generatedDbSnapshotPg.ok) {
    throw new Error(`Expected Postgres DB snapshot generation to succeed:\n${formatValidationErrors(generatedDbSnapshotPg.validation)}`);
  }
  assertDeepEqual(
    generatedDbSnapshotPg.artifact,
    readJson(path.join(expectedDir, "proj_db_postgres.db-schema-snapshot.json")),
    "Postgres DB schema snapshot"
  );

  const generatedDbSnapshotSqlite = generateWorkspace(todoAst, {
    target: "db-schema-snapshot",
    projectionId: "proj_db_sqlite"
  });
  if (!generatedDbSnapshotSqlite.ok) {
    throw new Error(`Expected SQLite DB snapshot generation to succeed:\n${formatValidationErrors(generatedDbSnapshotSqlite.validation)}`);
  }
  assertDeepEqual(
    generatedDbSnapshotSqlite.artifact,
    readJson(path.join(expectedDir, "proj_db_sqlite.db-schema-snapshot.json")),
    "SQLite DB schema snapshot"
  );

  const generatedInitialMigrationPlan = generateWorkspace(todoAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: readJson(path.join(migrationsDir, "empty.snapshot.json")),
    fromSnapshotPath: path.join(migrationsDir, "empty.snapshot.json")
  });
  if (!generatedInitialMigrationPlan.ok) {
    throw new Error(`Expected initial migration plan generation to succeed:\n${formatValidationErrors(generatedInitialMigrationPlan.validation)}`);
  }
  assertDeepEqual(
    generatedInitialMigrationPlan.artifact,
    readJson(path.join(expectedDir, "proj_db_postgres.initial.db-migration-plan.json")),
    "Initial DB migration plan"
  );

  const generatedInitialSqlMigration = generateWorkspace(todoAst, {
    target: "sql-migration",
    projectionId: "proj_db_postgres",
    fromSnapshot: readJson(path.join(migrationsDir, "empty.snapshot.json")),
    fromSnapshotPath: path.join(migrationsDir, "empty.snapshot.json")
  });
  if (!generatedInitialSqlMigration.ok) {
    throw new Error(`Expected initial SQL migration generation to succeed:\n${formatValidationErrors(generatedInitialSqlMigration.validation)}`);
  }
  if (
    normalizeText(generatedInitialSqlMigration.artifact) !==
    normalizeText(readText(path.join(expectedDir, "proj_db_postgres.initial.migration.sql")))
  ) {
    throw new Error("Generated initial SQL migration did not match expected output");
  }

  const generatedAdditiveMigrationPlan = generateWorkspace(todoAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: readJson(path.join(migrationsDir, "proj_db_postgres.additive-from.snapshot.json")),
    fromSnapshotPath: path.join(migrationsDir, "proj_db_postgres.additive-from.snapshot.json")
  });
  if (!generatedAdditiveMigrationPlan.ok) {
    throw new Error(`Expected additive migration plan generation to succeed:\n${formatValidationErrors(generatedAdditiveMigrationPlan.validation)}`);
  }
  assertDeepEqual(
    generatedAdditiveMigrationPlan.artifact,
    readJson(path.join(expectedDir, "proj_db_postgres.additive.db-migration-plan.json")),
    "Additive DB migration plan"
  );

  const generatedPriorityMigrationPlan = generateWorkspace(todoAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: readJson(path.join(migrationsDir, "proj_db_postgres.priority-from.snapshot.json")),
    fromSnapshotPath: path.join(migrationsDir, "proj_db_postgres.priority-from.snapshot.json")
  });
  if (!generatedPriorityMigrationPlan.ok) {
    throw new Error(`Expected Todo priority migration plan generation to succeed:\n${formatValidationErrors(generatedPriorityMigrationPlan.validation)}`);
  }
  assertDeepEqual(
    generatedPriorityMigrationPlan.artifact,
    readJson(path.join(expectedDir, "proj_db_postgres.priority.db-migration-plan.json")),
    "Todo priority DB migration plan"
  );

  const generatedPrioritySqlMigration = generateWorkspace(todoAst, {
    target: "sql-migration",
    projectionId: "proj_db_postgres",
    fromSnapshot: readJson(path.join(migrationsDir, "proj_db_postgres.priority-from.snapshot.json")),
    fromSnapshotPath: path.join(migrationsDir, "proj_db_postgres.priority-from.snapshot.json")
  });
  if (!generatedPrioritySqlMigration.ok) {
    throw new Error(`Expected Todo priority SQL migration generation to succeed:\n${formatValidationErrors(generatedPrioritySqlMigration.validation)}`);
  }
  if (
    normalizeText(generatedPrioritySqlMigration.artifact) !==
    normalizeText(readText(path.join(expectedDir, "proj_db_postgres.priority.migration.sql")))
  ) {
    throw new Error("Generated Todo priority SQL migration did not match expected output");
  }

  const generatedDbLifecyclePlan = generateWorkspace(todoAst, {
    target: "db-lifecycle-plan",
    projectionId: "proj_db_postgres"
  });
  if (!generatedDbLifecyclePlan.ok) {
    throw new Error(`Expected DB lifecycle plan generation to succeed:\n${formatValidationErrors(generatedDbLifecyclePlan.validation)}`);
  }
  assertDeepEqual(
    generatedDbLifecyclePlan.artifact,
    readJson(path.join(expectedDir, "proj_db_postgres.db-lifecycle-plan.json")),
    "DB lifecycle plan"
  );

  const generatedDbLifecycleBundle = generateWorkspace(todoAst, {
    target: "db-lifecycle-bundle",
    projectionId: "proj_db_postgres"
  });
  if (!generatedDbLifecycleBundle.ok) {
    throw new Error(`Expected DB lifecycle bundle generation to succeed:\n${formatValidationErrors(generatedDbLifecycleBundle.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedDbLifecycleBundle.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "prisma/schema.prisma",
      "drizzle/schema.ts",
      "scripts/db-bootstrap-or-migrate.sh",
      "scripts/db-bootstrap.sh",
      "scripts/db-common.sh",
      "scripts/db-migrate.sh",
      "scripts/db-status.sh",
      "snapshots/empty.snapshot.json"
    ],
    "DB lifecycle bundle files"
  );
  for (const [filePath, label] of [
    [".env.example", "DB lifecycle env example"],
    ["README.md", "DB lifecycle readme"],
    ["scripts/db-common.sh", "DB lifecycle common script"],
    ["scripts/db-bootstrap.sh", "DB lifecycle bootstrap script"],
    ["scripts/db-migrate.sh", "DB lifecycle migrate script"],
    ["scripts/db-bootstrap-or-migrate.sh", "DB lifecycle bootstrap-or-migrate script"]
  ]) {
    if (
      normalizeText(generatedDbLifecycleBundle.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "db-lifecycle", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedEnvironmentPlan = generateWorkspace(todoAst, {
    target: "environment-plan"
  });
  if (!generatedEnvironmentPlan.ok) {
    throw new Error(`Expected environment plan generation to succeed:\n${formatValidationErrors(generatedEnvironmentPlan.validation)}`);
  }
  assertDeepEqual(
    generatedEnvironmentPlan.artifact,
    readJson(path.join(expectedDir, "environment-plan.json")),
    "Environment plan"
  );

  const generatedEnvironmentBundle = generateWorkspace(todoAst, {
    target: "environment-bundle"
  });
  if (!generatedEnvironmentBundle.ok) {
    throw new Error(`Expected environment bundle generation to succeed:\n${formatValidationErrors(generatedEnvironmentBundle.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedEnvironmentBundle.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "docker-compose.yml",
      "package.json",
      "scripts/bootstrap-db.sh",
      "scripts/docker-db.sh",
      "scripts/docker-stack.sh",
      "scripts/load-env.sh",
      "scripts/server-dev.sh",
      "scripts/stack-dev.sh",
      "scripts/web-dev.sh",
      "server/src/index.ts",
      "web/src/lib/api/client.ts",
      "db/scripts/db-bootstrap-or-migrate.sh"
    ],
    "Environment bundle files"
  );
  for (const [filePath, label] of [
    [".env.example", "Environment env example"],
    ["README.md", "Environment readme"],
    ["docker-compose.yml", "Environment docker compose"],
    ["package.json", "Environment package manifest"],
    ["scripts/bootstrap-db.sh", "Environment DB bootstrap script"],
    ["scripts/stack-dev.sh", "Environment stack dev script"],
    ["server/src/index.ts", "Environment bundled server entrypoint"],
    ["web/src/lib/api/client.ts", "Environment bundled web API client"],
    ["db/scripts/db-bootstrap-or-migrate.sh", "Environment bundled DB lifecycle script"]
  ]) {
    if (
      normalizeText(generatedEnvironmentBundle.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "environment-bundle", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedEnvironmentPlanProcess = generateWorkspace(todoAst, {
    target: "environment-plan",
    profileId: "local_process"
  });
  if (!generatedEnvironmentPlanProcess.ok) {
    throw new Error(`Expected local-process environment plan generation to succeed:\n${formatValidationErrors(generatedEnvironmentPlanProcess.validation)}`);
  }
  assertDeepEqual(
    generatedEnvironmentPlanProcess.artifact,
    readJson(path.join(expectedDir, "environment-plan.local_process.json")),
    "Local-process environment plan"
  );

  const generatedEnvironmentBundleProcess = generateWorkspace(todoAst, {
    target: "environment-bundle",
    profileId: "local_process"
  });
  if (!generatedEnvironmentBundleProcess.ok) {
    throw new Error(`Expected local-process environment bundle generation to succeed:\n${formatValidationErrors(generatedEnvironmentBundleProcess.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedEnvironmentBundleProcess.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "package.json",
      "scripts/bootstrap-db.sh",
      "scripts/load-env.sh",
      "scripts/server-dev.sh",
      "scripts/stack-dev.sh",
      "scripts/web-dev.sh",
      "server/src/index.ts",
      "web/src/lib/api/client.ts",
      "db/scripts/db-bootstrap-or-migrate.sh"
    ],
    "Local-process environment bundle files"
  );
  if (Object.keys(generatedEnvironmentBundleProcess.artifact).includes("docker-compose.yml")) {
    throw new Error("Local-process environment bundle should not include docker-compose.yml");
  }
  for (const [filePath, label] of [
    [".env.example", "Local-process environment env example"],
    ["README.md", "Local-process environment readme"],
    ["package.json", "Local-process environment package manifest"],
    ["scripts/bootstrap-db.sh", "Local-process environment DB bootstrap script"],
    ["scripts/stack-dev.sh", "Local-process environment stack dev script"]
  ]) {
    if (
      normalizeText(generatedEnvironmentBundleProcess.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "environment-bundle.local_process", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedDeploymentPlan = generateWorkspace(todoAst, {
    target: "deployment-plan"
  });
  if (!generatedDeploymentPlan.ok) {
    throw new Error(`Expected deployment plan generation to succeed:\n${formatValidationErrors(generatedDeploymentPlan.validation)}`);
  }
  assertDeepEqual(
    generatedDeploymentPlan.artifact,
    readJson(path.join(expectedDir, "deployment-plan.json")),
    "Deployment plan"
  );

  const generatedDeploymentBundle = generateWorkspace(todoAst, {
    target: "deployment-bundle"
  });
  if (!generatedDeploymentBundle.ok) {
    throw new Error(`Expected deployment bundle generation to succeed:\n${formatValidationErrors(generatedDeploymentBundle.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedDeploymentBundle.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "fly.toml",
      "package.json",
      "scripts/deploy-check.sh",
      "scripts/deploy-migrate.sh",
      "server/Dockerfile",
      "server/src/index.ts",
      "web/vercel.json"
    ],
    "Deployment bundle files"
  );
  for (const [filePath, label] of [
    [".env.example", "Deployment env example"],
    ["README.md", "Deployment readme"],
    ["fly.toml", "Fly deployment config"],
    ["package.json", "Deployment package manifest"],
    ["scripts/deploy-check.sh", "Deployment check script"],
    ["scripts/deploy-migrate.sh", "Deployment migrate script"]
  ]) {
    if (
      normalizeText(generatedDeploymentBundle.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "deployment-bundle", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedDeploymentPlanRailway = generateWorkspace(todoAst, {
    target: "deployment-plan",
    profileId: "railway"
  });
  if (!generatedDeploymentPlanRailway.ok) {
    throw new Error(`Expected railway deployment plan generation to succeed:\n${formatValidationErrors(generatedDeploymentPlanRailway.validation)}`);
  }
  assertDeepEqual(
    generatedDeploymentPlanRailway.artifact,
    readJson(path.join(expectedDir, "deployment-plan.railway.json")),
    "Railway deployment plan"
  );

  const generatedDeploymentBundleRailway = generateWorkspace(todoAst, {
    target: "deployment-bundle",
    profileId: "railway"
  });
  if (!generatedDeploymentBundleRailway.ok) {
    throw new Error(`Expected railway deployment bundle generation to succeed:\n${formatValidationErrors(generatedDeploymentBundleRailway.validation)}`);
  }
  if (Object.keys(generatedDeploymentBundleRailway.artifact).includes("fly.toml")) {
    throw new Error("Railway deployment bundle should not include fly.toml");
  }
  assertIncludes(
    Object.keys(generatedDeploymentBundleRailway.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "railway.json",
      "package.json",
      "scripts/deploy-check.sh",
      "scripts/deploy-migrate.sh",
      "server/Dockerfile",
      "web/vercel.json"
    ],
    "Railway deployment bundle files"
  );
  for (const [filePath, label] of [
    [".env.example", "Railway deployment env example"],
    ["README.md", "Railway deployment readme"],
    ["railway.json", "Railway deployment config"]
  ]) {
    if (
      normalizeText(generatedDeploymentBundleRailway.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "deployment-bundle.railway", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedRuntimeSmokePlan = generateWorkspace(todoAst, {
    target: "runtime-smoke-plan"
  });
  if (!generatedRuntimeSmokePlan.ok) {
    throw new Error(`Expected runtime smoke plan generation to succeed:\n${formatValidationErrors(generatedRuntimeSmokePlan.validation)}`);
  }
  assertDeepEqual(
    generatedRuntimeSmokePlan.artifact,
    readJson(path.join(expectedDir, "runtime-smoke-plan.json")),
    "Runtime smoke plan"
  );

  const generatedRuntimeSmokeBundle = generateWorkspace(todoAst, {
    target: "runtime-smoke-bundle"
  });
  if (!generatedRuntimeSmokeBundle.ok) {
    throw new Error(`Expected runtime smoke bundle generation to succeed:\n${formatValidationErrors(generatedRuntimeSmokeBundle.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedRuntimeSmokeBundle.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "runtime-smoke-plan.json",
      "scripts/smoke.sh",
      "scripts/smoke.mjs"
    ],
    "Runtime smoke bundle files"
  );
  for (const [filePath, label] of [
    [".env.example", "Runtime smoke env example"],
    ["README.md", "Runtime smoke readme"],
    ["scripts/smoke.sh", "Runtime smoke shell script"],
    ["scripts/smoke.mjs", "Runtime smoke module"]
  ]) {
    if (
      normalizeText(generatedRuntimeSmokeBundle.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "runtime-smoke-bundle", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedRuntimeCheckPlan = generateWorkspace(todoAst, {
    target: "runtime-check-plan"
  });
  if (!generatedRuntimeCheckPlan.ok) {
    throw new Error(`Expected runtime check plan generation to succeed:\n${formatValidationErrors(generatedRuntimeCheckPlan.validation)}`);
  }
  assertDeepEqual(
    generatedRuntimeCheckPlan.artifact,
    readJson(path.join(expectedDir, "runtime-check-plan.json")),
    "Runtime check plan"
  );

  const generatedRuntimeCheckBundle = generateWorkspace(todoAst, {
    target: "runtime-check-bundle"
  });
  if (!generatedRuntimeCheckBundle.ok) {
    throw new Error(`Expected runtime check bundle generation to succeed:\n${formatValidationErrors(generatedRuntimeCheckBundle.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedRuntimeCheckBundle.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "runtime-check-plan.json",
      "api-contracts.json",
      "scripts/check.sh",
      "scripts/check.mjs"
    ],
    "Runtime check bundle files"
  );
  for (const [filePath, label] of [
    [".env.example", "Runtime check env example"],
    ["README.md", "Runtime check readme"],
    ["scripts/check.sh", "Runtime check shell script"],
    ["scripts/check.mjs", "Runtime check module"]
  ]) {
    if (
      normalizeText(generatedRuntimeCheckBundle.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "runtime-check-bundle", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }
  {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-runtime-check-"));
    writeGeneratedFiles(tempRoot, generatedRuntimeCheckBundle.artifact);
    const moduleRun = childProcess.spawnSync(process.execPath, ["scripts/check.mjs"], {
      cwd: tempRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH || ""
      }
    });
    if (moduleRun.status === 0) {
      throw new Error("Expected runtime check module to fail when required env is missing");
    }
    const report = readJson(path.join(tempRoot, "state", "runtime-check-report.json"));
    const environmentStage = report.stages.find((stage) => stage.id === "environment");
    const apiStage = report.stages.find((stage) => stage.id === "api");
    if (!environmentStage || environmentStage.ok !== false) {
      throw new Error("Expected runtime check report to mark the environment stage as failed");
    }
    if (!apiStage || apiStage.skipped !== true) {
      throw new Error("Expected runtime check report to skip the API stage after environment failure");
    }
    const shellRun = childProcess.spawnSync("bash", ["scripts/check.sh"], {
      cwd: tempRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH || ""
      }
    });
    if (shellRun.status === 0) {
      throw new Error("Expected runtime check shell wrapper to exit non-zero when checks fail");
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  const generatedCompileCheckPlan = generateWorkspace(todoAst, {
    target: "compile-check-plan"
  });
  if (!generatedCompileCheckPlan.ok) {
    throw new Error(`Expected compile-check plan generation to succeed:\n${formatValidationErrors(generatedCompileCheckPlan.validation)}`);
  }
  assertDeepEqual(
    generatedCompileCheckPlan.artifact,
    readJson(path.join(expectedDir, "compile-check-plan.json")),
    "Compile-check plan"
  );

  const generatedCompileCheckBundle = generateWorkspace(todoAst, {
    target: "compile-check-bundle"
  });
  if (!generatedCompileCheckBundle.ok) {
    throw new Error(`Expected compile-check bundle generation to succeed:\n${formatValidationErrors(generatedCompileCheckBundle.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedCompileCheckBundle.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "compile-check-plan.json",
      "scripts/check.sh",
      "server/package.json",
      "web/package.json"
    ],
    "Compile-check bundle files"
  );
  for (const [filePath, label] of [
    [".env.example", "Compile-check env example"],
    ["README.md", "Compile-check readme"],
    ["scripts/check.sh", "Compile-check script"],
    ["server/package.json", "Compile-check bundled server package"],
    ["web/package.json", "Compile-check bundled web package"]
  ]) {
    if (
      normalizeText(generatedCompileCheckBundle.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "compile-check-bundle", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedAppBundlePlan = generateWorkspace(todoAst, {
    target: "app-bundle-plan"
  });
  if (!generatedAppBundlePlan.ok) {
    throw new Error(`Expected app bundle plan generation to succeed:\n${formatValidationErrors(generatedAppBundlePlan.validation)}`);
  }
  assertDeepEqual(
    generatedAppBundlePlan.artifact,
    readJson(path.join(expectedDir, "app-bundle-plan.json")),
    "App bundle plan"
  );

  const generatedAppBundle = generateWorkspace(todoAst, {
    target: "app-bundle"
  });
  if (!generatedAppBundle.ok) {
    throw new Error(`Expected app bundle generation to succeed:\n${formatValidationErrors(generatedAppBundle.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedAppBundle.artifact).sort().join("\n"),
    [
      ".env.example",
      "README.md",
      "app-bundle-plan.json",
      "package.json",
      "scripts/bootstrap.sh",
      "scripts/compile-check.sh",
      "scripts/dev.sh",
      "scripts/runtime-check.sh",
      "scripts/smoke.sh",
      "scripts/deploy-check.sh",
      "app/scripts/stack-dev.sh",
      "compile/scripts/check.sh",
      "deploy/fly.toml",
      "runtime-check/scripts/check.mjs",
      "smoke/scripts/smoke.mjs"
    ],
    "App bundle files"
  );
  for (const [filePath, label] of [
    [".env.example", "App bundle env example"],
    ["README.md", "App bundle readme"],
    ["package.json", "App bundle package manifest"],
    ["scripts/bootstrap.sh", "App bundle bootstrap script"],
    ["scripts/compile-check.sh", "App bundle compile-check script"],
    ["scripts/dev.sh", "App bundle dev script"],
    ["scripts/runtime-check.sh", "App bundle runtime-check script"],
    ["scripts/smoke.sh", "App bundle smoke script"],
    ["scripts/deploy-check.sh", "App bundle deploy-check script"]
  ]) {
    if (
      normalizeText(generatedAppBundle.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "app-bundle", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }
  for (const filePath of listRelativeFiles(path.join(todoRoot, "apps", "local-stack", "runtime-check"))) {
    const generatedPath = `runtime-check/${filePath}`;
    if (
      normalizeText(generatedAppBundle.artifact[generatedPath]) !==
      normalizeText(readText(path.join(todoRoot, "apps", "local-stack", "runtime-check", filePath)))
    ) {
      throw new Error(`Generated Todo committed runtime-check/${filePath} did not match app-bundle output`);
    }
  }

  const generatedPrismaSchema = generateWorkspace(todoAst, {
    target: "prisma-schema",
    projectionId: "proj_db_postgres"
  });
  if (!generatedPrismaSchema.ok) {
    throw new Error(`Expected Prisma schema generation to succeed:\n${formatValidationErrors(generatedPrismaSchema.validation)}`);
  }
  if (normalizeText(generatedPrismaSchema.artifact) !== normalizeText(readText(path.join(expectedDir, "proj_db_postgres.prisma")))) {
    throw new Error("Generated Prisma schema did not match expected output");
  }

  const generatedDrizzleSchema = generateWorkspace(todoAst, {
    target: "drizzle-schema",
    projectionId: "proj_db_postgres"
  });
  if (!generatedDrizzleSchema.ok) {
    throw new Error(`Expected Drizzle schema generation to succeed:\n${formatValidationErrors(generatedDrizzleSchema.validation)}`);
  }
  if (normalizeText(generatedDrizzleSchema.artifact) !== normalizeText(readText(path.join(expectedDir, "proj_db_postgres.drizzle.ts")))) {
    throw new Error("Generated Drizzle schema did not match expected output");
  }

  const generatedPersistenceScaffold = generateWorkspace(todoAst, {
    target: "persistence-scaffold",
    projectionId: "proj_db_postgres"
  });
  if (!generatedPersistenceScaffold.ok) {
    throw new Error(`Expected persistence scaffold generation to succeed:\n${formatValidationErrors(generatedPersistenceScaffold.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedPersistenceScaffold.artifact).sort().join("\n"),
    [
      "drizzle/repositories.ts",
      "prisma/repositories.ts",
      "repositories.ts",
      "types.ts"
    ],
    "Persistence scaffold files"
  );
  for (const [filePath, label] of [
    ["repositories.ts", "Persistence repository interface"],
    ["types.ts", "Persistence repository types"],
    ["prisma/repositories.ts", "Prisma repository scaffold"],
    ["drizzle/repositories.ts", "Drizzle repository scaffold"]
  ]) {
    if (
      normalizeText(generatedPersistenceScaffold.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "persistence-scaffold", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedServerContract = generateWorkspace(todoAst, {
    target: "server-contract",
    projectionId: "proj_api"
  });
  if (!generatedServerContract.ok) {
    throw new Error(`Expected server contract generation to succeed:\n${formatValidationErrors(generatedServerContract.validation)}`);
  }
  assertDeepEqual(
    generatedServerContract.artifact,
    readJson(path.join(expectedDir, "proj_api.server-contract.json")),
    "Server contract graph"
  );

  const generatedHonoServer = generateWorkspace(todoAst, {
    target: "hono-server",
    projectionId: "proj_api"
  });
  if (!generatedHonoServer.ok) {
    throw new Error(`Expected Hono server generation to succeed:\n${formatValidationErrors(generatedHonoServer.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedHonoServer.artifact).sort().join("\n"),
    [
      "package.json",
      "scripts/seed-demo.mjs",
      "src/index.ts",
      "src/lib/server/app.ts",
      "src/lib/server/context.ts",
      "src/lib/server/helpers.ts",
      "src/lib/topogram/server-contract.ts",
      "src/lib/persistence/repositories.ts",
      "src/lib/persistence/types.ts"
    ],
    "Hono server scaffold files"
  );
  for (const [filePath, label] of [
    ["package.json", "Hono server package manifest"],
    ["scripts/seed-demo.mjs", "Hono server demo seed script"],
    ["src/index.ts", "Hono server entrypoint"],
    ["src/lib/server/app.ts", "Hono server app"],
    ["src/lib/server/context.ts", "Hono server context"],
    ["src/lib/server/helpers.ts", "Hono server helpers"],
    ["src/lib/topogram/server-contract.ts", "Hono server contract module"]
  ]) {
    if (
      normalizeText(generatedHonoServer.artifact[filePath]) !==
      normalizeText(readText(path.join(expectedDir, "hono-server", filePath)))
    ) {
      throw new Error(`${label} did not match expected output`);
    }
  }

  const generatedSvelteKitApp = generateWorkspace(todoAst, {
    target: "sveltekit-app",
    projectionId: "proj_ui_web"
  });
  if (!generatedSvelteKitApp.ok) {
    throw new Error(`Expected SvelteKit generation to succeed:\n${formatValidationErrors(generatedSvelteKitApp.validation)}`);
  }
  assertIncludes(
    Object.keys(generatedSvelteKitApp.artifact).sort().join("\n"),
    [
      "package.json",
      "src/lib/api/client.ts",
      "src/lib/topogram/api-contracts.json",
      "src/routes/tasks/+page.ts",
      "src/routes/tasks/+page.svelte",
      "src/routes/tasks/[id]/+page.svelte",
      "src/routes/tasks/[id]/+page.ts",
      "src/routes/tasks/new/+page.svelte",
      "src/routes/tasks/new/+page.server.ts",
      "src/routes/task-exports/[job_id]/+page.svelte",
      "src/routes/task-exports/[job_id]/+page.ts",
      "src/lib/topogram/ui-web-contract.json"
    ],
    "SvelteKit scaffold files"
  );
  assertIncludes(
    generatedSvelteKitApp.artifact["src/routes/tasks/+page.svelte"],
    ["This list screen was generated from `task_list`", "data.result.items", "/tasks/new"],
    "SvelteKit task list page"
  );
  assertIncludes(
    generatedSvelteKitApp.artifact["src/lib/api/client.ts"],
    ["PUBLIC_TOPOGRAM_API_BASE_URL", "export async function listTasks", "export async function createTask"],
    "SvelteKit API client"
  );
  assertRedirectEscapesCatch(
    generatedSvelteKitApp.artifact["src/routes/tasks/new/+page.server.ts"],
    "Todo create action"
  );
  assertRedirectEscapesCatch(
    generatedSvelteKitApp.artifact["src/routes/tasks/[id]/edit/+page.server.ts"],
    "Todo update action"
  );
  assertRedirectEscapesCatch(
    generatedSvelteKitApp.artifact["src/routes/tasks/[id]/+page.server.ts"],
    "Todo detail actions"
  );
  assertRedirectEscapesCatch(
    generatedSvelteKitApp.artifact["src/routes/tasks/+page.server.ts"],
    "Todo export action"
  );

  const generatedOpenApi = generateWorkspace(todoAst, {
    target: "openapi",
    capabilityId: "cap_create_task"
  });
  if (!generatedOpenApi.ok) {
    throw new Error(`Expected OpenAPI generation to succeed:\n${formatValidationErrors(generatedOpenApi.validation)}`);
  }
  assertDeepEqual(
    generatedOpenApi.artifact,
    readJson(path.join(expectedDir, "cap_create_task.openapi.json")),
    "OpenAPI document"
  );
  const createTask400 = generatedOpenApi.artifact.paths?.["/tasks"]?.post?.responses?.["400"]?.content?.["application/json"]?.schema;
  if (!createTask400?.oneOf || createTask400.oneOf.length !== 2) {
    throw new Error("Expected create-task 400 response to preserve both structured error variants");
  }
  const createTaskPost = generatedOpenApi.artifact.paths?.["/tasks"]?.post;
  if (!createTaskPost?.parameters?.some((parameter) => parameter.in === "header" && parameter.name === "Idempotency-Key")) {
    throw new Error("Expected create-task endpoint to expose an Idempotency-Key header");
  }
  if (!createTaskPost?.responses?.["409"]) {
    throw new Error("Expected create-task endpoint to expose a 409 idempotency/conflict response");
  }

  const generatedGetOpenApi = generateWorkspace(todoAst, {
    target: "openapi",
    capabilityId: "cap_get_task"
  });
  if (!generatedGetOpenApi.ok) {
    throw new Error(`Expected get-task OpenAPI generation to succeed:\n${formatValidationErrors(generatedGetOpenApi.validation)}`);
  }
  assertDeepEqual(
    generatedGetOpenApi.artifact,
    readJson(path.join(expectedDir, "cap_get_task.openapi.json")),
    "Get-task OpenAPI document"
  );

  const generatedDeleteOpenApi = generateWorkspace(todoAst, {
    target: "openapi",
    capabilityId: "cap_delete_task"
  });
  if (!generatedDeleteOpenApi.ok) {
    throw new Error(`Expected delete-task OpenAPI generation to succeed:\n${formatValidationErrors(generatedDeleteOpenApi.validation)}`);
  }
  assertDeepEqual(
    generatedDeleteOpenApi.artifact,
    readJson(path.join(expectedDir, "cap_delete_task.openapi.json")),
    "Delete-task OpenAPI document"
  );

  const generatedExportOpenApi = generateWorkspace(todoAst, {
    target: "openapi",
    capabilityId: "cap_export_tasks"
  });
  if (!generatedExportOpenApi.ok) {
    throw new Error(`Expected export-task OpenAPI generation to succeed:\n${formatValidationErrors(generatedExportOpenApi.validation)}`);
  }
  assertDeepEqual(
    generatedExportOpenApi.artifact,
    readJson(path.join(expectedDir, "cap_export_tasks.openapi.json")),
    "Export-task OpenAPI document"
  );

  const generatedStatusOpenApi = generateWorkspace(todoAst, {
    target: "openapi",
    capabilityId: "cap_get_task_export_job"
  });
  if (!generatedStatusOpenApi.ok) {
    throw new Error(`Expected export-status OpenAPI generation to succeed:\n${formatValidationErrors(generatedStatusOpenApi.validation)}`);
  }
  assertDeepEqual(
    generatedStatusOpenApi.artifact,
    readJson(path.join(expectedDir, "cap_get_task_export_job.openapi.json")),
    "Export-status OpenAPI document"
  );

  const generatedDownloadOpenApi = generateWorkspace(todoAst, {
    target: "openapi",
    capabilityId: "cap_download_task_export"
  });
  if (!generatedDownloadOpenApi.ok) {
    throw new Error(`Expected export-download OpenAPI generation to succeed:\n${formatValidationErrors(generatedDownloadOpenApi.validation)}`);
  }
  assertDeepEqual(
    generatedDownloadOpenApi.artifact,
    readJson(path.join(expectedDir, "cap_download_task_export.openapi.json")),
    "Export-download OpenAPI document"
  );

  const generatedOpenApiAll = generateWorkspace(todoAst, {
    target: "openapi"
  });
  if (!generatedOpenApiAll.ok) {
    throw new Error(`Expected full OpenAPI generation to succeed:\n${formatValidationErrors(generatedOpenApiAll.validation)}`);
  }
  assertDeepEqual(
    generatedOpenApiAll.artifact,
    readJson(path.join(expectedDir, "openapi.json")),
    "Full OpenAPI document"
  );
  const listTasks200 = generatedOpenApiAll.artifact.paths?.["/tasks"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema;
  if (!listTasks200?.$ref?.includes("CursorPageResponse")) {
    throw new Error("Expected list-tasks success response to reference a cursor envelope component");
  }
  const listTaskParameters = generatedOpenApiAll.artifact.paths?.["/tasks"]?.get?.parameters || [];
  if (!listTaskParameters.some((parameter) => parameter.name === "after") || !listTaskParameters.some((parameter) => parameter.name === "limit")) {
    throw new Error("Expected list-tasks query parameters to include cursor and limit controls");
  }
  const getTaskGet = generatedOpenApiAll.artifact.paths?.["/tasks/{id}"]?.get;
  if (!getTaskGet || !getTaskGet.parameters?.some((parameter) => parameter.in === "path" && parameter.name === "id")) {
    throw new Error("Expected get-task endpoint to expose a path id parameter");
  }
  if (!getTaskGet?.parameters?.some((parameter) => parameter.in === "header" && parameter.name === "If-None-Match")) {
    throw new Error("Expected get-task endpoint to expose an If-None-Match header");
  }
  if (!getTaskGet?.responses?.["200"]?.headers?.ETag) {
    throw new Error("Expected get-task success response to expose an ETag header");
  }
  if (!getTaskGet?.responses?.["304"]?.headers?.ETag) {
    throw new Error("Expected get-task endpoint to expose a 304 response with an ETag header");
  }
  if (!getTaskGet?.responses?.["404"]) {
    throw new Error("Expected get-task endpoint to expose a 404 not-found response");
  }
  const deleteTaskDelete = generatedOpenApiAll.artifact.paths?.["/tasks/{id}"]?.delete;
  if (!deleteTaskDelete?.parameters?.some((parameter) => parameter.in === "path" && parameter.name === "id")) {
    throw new Error("Expected delete-task endpoint to expose a path id parameter");
  }
  if (!deleteTaskDelete?.parameters?.some((parameter) => parameter.in === "header" && parameter.name === "If-Match")) {
    throw new Error("Expected delete-task endpoint to expose an If-Match precondition header");
  }
  if (!deleteTaskDelete?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref) {
    throw new Error("Expected delete-task endpoint to expose a success body");
  }
  if (!deleteTaskDelete?.responses?.["404"]) {
    throw new Error("Expected delete-task endpoint to expose a 404 not-found response");
  }
  const updateTaskPatch = generatedOpenApiAll.artifact.paths?.["/tasks/{id}"]?.patch;
  if (!updateTaskPatch?.parameters?.some((parameter) => parameter.in === "header" && parameter.name === "If-Match")) {
    throw new Error("Expected update-task endpoint to expose an If-Match precondition header");
  }
  if (!updateTaskPatch?.responses?.["412"]) {
    throw new Error("Expected update-task endpoint to expose a 412 precondition response");
  }
  const completeTaskPost = generatedOpenApiAll.artifact.paths?.["/tasks/{id}/complete"]?.post;
  if (!completeTaskPost?.parameters?.some((parameter) => parameter.in === "header" && parameter.name === "Idempotency-Key")) {
    throw new Error("Expected complete-task endpoint to expose an Idempotency-Key header");
  }
  if (!completeTaskPost?.responses?.["409"]) {
    throw new Error("Expected complete-task endpoint to expose a 409 idempotency/conflict response");
  }
  const exportTasksPost = generatedOpenApiAll.artifact.paths?.["/tasks/export"]?.post;
  if (!exportTasksPost?.responses?.["202"]?.headers?.Location) {
    throw new Error("Expected export-task endpoint to expose a Location header on 202");
  }
  if (!exportTasksPost?.responses?.["202"]?.headers?.["Retry-After"]) {
    throw new Error("Expected export-task endpoint to expose a Retry-After header on 202");
  }
  if (!exportTasksPost?.responses?.["202"]?.content?.["application/json"]?.schema?.$ref) {
    throw new Error("Expected export-task endpoint to expose an accepted job payload");
  }
  if (!exportTasksPost?.responses?.["202"]?.links?.cap_get_task_export_jobStatus) {
    throw new Error("Expected export-task endpoint to link to the export-status resource");
  }
  if (!exportTasksPost?.callbacks?.export_completed) {
    throw new Error("Expected export-task endpoint to expose an OpenAPI callback");
  }
  if (!exportTasksPost?.["x-topogram-authorization"]?.some((rule) => rule.permission === "tasks.export")) {
    throw new Error("Expected export-task endpoint to expose authorization metadata");
  }
  const exportStatusGet = generatedOpenApiAll.artifact.paths?.["/task-exports/{job_id}"]?.get;
  if (!exportStatusGet?.responses?.["200"]?.links?.cap_download_task_exportDownload) {
    throw new Error("Expected export-status endpoint to link to the export download operation");
  }
  if (!exportStatusGet?.["x-topogram-authorization"]?.some((rule) => rule.permission === "tasks.export.read")) {
    throw new Error("Expected export-status endpoint to expose authorization metadata");
  }
  const exportDownloadGet = generatedOpenApiAll.artifact.paths?.["/task-exports/{job_id}/download"]?.get;
  if (!exportDownloadGet?.responses?.["200"]?.content?.["application/zip"]?.schema?.format) {
    throw new Error("Expected export-download endpoint to expose a binary zip response");
  }
  if (!exportDownloadGet?.responses?.["200"]?.headers?.["Content-Disposition"]) {
    throw new Error("Expected export-download endpoint to expose a Content-Disposition header");
  }
  const generatedListOpenApi = generateWorkspace(todoAst, {
    target: "openapi",
    capabilityId: "cap_list_tasks"
  });
  if (!generatedListOpenApi.ok) {
    throw new Error(`Expected list OpenAPI generation to succeed:\n${formatValidationErrors(generatedListOpenApi.validation)}`);
  }
  assertDeepEqual(
    generatedListOpenApi.artifact,
    readJson(path.join(expectedDir, "cap_list_tasks.openapi.json")),
    "List OpenAPI document"
  );

  const issuesValidation = validateWorkspace(issuesAst);
  if (!issuesValidation.ok) {
    throw new Error(`Expected issues fixtures to validate cleanly:\n${formatValidationErrors(issuesValidation)}`);
  }

  const issuesResolved = resolveWorkspace(issuesAst);
  if (!issuesResolved.ok) {
    throw new Error(`Expected issues fixtures to resolve cleanly:\n${formatValidationErrors(issuesResolved.validation)}`);
  }
  assertDeepEqual(
    issuesResolved.graph,
    readJson(path.join(issuesExpectedDir, "issues.resolve.json")),
    "Resolved issues semantic graph"
  );

  const issuesDocs = generateWorkspace(issuesAst, { target: "docs" });
  if (!issuesDocs.ok) {
    throw new Error(`Expected issues docs generation to succeed:\n${formatValidationErrors(issuesDocs.validation)}`);
  }
  if (normalizeText(issuesDocs.artifact) !== normalizeText(readText(path.join(issuesExpectedDir, "issues.docs.md")))) {
    throw new Error("Generated issues docs did not match expected output");
  }

  const issuesVerificationChecklist = generateWorkspace(issuesAst, { target: "verification-checklist" });
  if (!issuesVerificationChecklist.ok) {
    throw new Error(`Expected issues verification-checklist generation to succeed:\n${formatValidationErrors(issuesVerificationChecklist.validation)}`);
  }
  if (
    normalizeText(issuesVerificationChecklist.artifact) !==
    normalizeText(readText(path.join(issuesExpectedDir, "verification-checklist.md")))
  ) {
    throw new Error("Generated issues verification checklist did not match expected output");
  }

  const issuesDocsIndex = generateWorkspace(issuesAst, { target: "docs-index" });
  if (!issuesDocsIndex.ok) {
    throw new Error(`Expected issues docs-index generation to succeed:\n${formatValidationErrors(issuesDocsIndex.validation)}`);
  }
  assertDeepEqual(
    issuesDocsIndex.artifact,
    readJson(path.join(issuesExpectedDir, "docs-index.json")),
    "Issues docs index"
  );

  const issuesVerificationPlan = generateWorkspace(issuesAst, { target: "verification-plan" });
  if (!issuesVerificationPlan.ok) {
    throw new Error(`Expected issues verification-plan generation to succeed:\n${formatValidationErrors(issuesVerificationPlan.validation)}`);
  }
  assertDeepEqual(
    issuesVerificationPlan.artifact,
    readJson(path.join(issuesExpectedDir, "verification-plan.json")),
    "Issues verification plan"
  );

  const issuesUiWeb = generateWorkspace(issuesAst, {
    target: "ui-web-contract",
    projectionId: "proj_ui_web"
  });
  if (!issuesUiWeb.ok) {
    throw new Error(`Expected issues UI web contract generation to succeed:\n${formatValidationErrors(issuesUiWeb.validation)}`);
  }
  assertDeepEqual(
    issuesUiWeb.artifact,
    readJson(path.join(issuesExpectedDir, "proj_ui_web.ui-web-contract.json")),
    "Issues UI web contract"
  );

  const issuesUiWebSvelteKit = generateWorkspace(issuesAst, {
    target: "ui-web-contract",
    projectionId: "proj_ui_web_sveltekit"
  });
  if (!issuesUiWebSvelteKit.ok) {
    throw new Error(`Expected issues SvelteKit UI web contract generation to succeed:\n${formatValidationErrors(issuesUiWebSvelteKit.validation)}`);
  }
  assertDeepEqual(
    issuesUiWebSvelteKit.artifact,
    readJson(path.join(issuesExpectedDir, "proj_ui_web_sveltekit.ui-web-contract.json")),
    "Issues SvelteKit UI web contract"
  );

  const issuesDbSnapshot = generateWorkspace(issuesAst, {
    target: "db-schema-snapshot",
    projectionId: "proj_db_sqlite"
  });
  if (!issuesDbSnapshot.ok) {
    throw new Error(`Expected issues DB snapshot generation to succeed:\n${formatValidationErrors(issuesDbSnapshot.validation)}`);
  }
  assertDeepEqual(
    issuesDbSnapshot.artifact,
    readJson(path.join(issuesExpectedDir, "proj_db_sqlite.db-schema-snapshot.json")),
    "Issues DB schema snapshot"
  );

  const issuesRuntimeCheckPlan = generateWorkspace(issuesAst, { target: "runtime-check-plan" });
  if (!issuesRuntimeCheckPlan.ok) {
    throw new Error(`Expected issues runtime-check plan generation to succeed:\n${formatValidationErrors(issuesRuntimeCheckPlan.validation)}`);
  }
  assertDeepEqual(
    issuesRuntimeCheckPlan.artifact,
    readJson(path.join(issuesExpectedDir, "runtime-check-plan.json")),
    "Issues runtime-check plan"
  );

  const issuesAppBundlePlan = generateWorkspace(issuesAst, { target: "app-bundle-plan" });
  if (!issuesAppBundlePlan.ok) {
    throw new Error(`Expected issues app-bundle plan generation to succeed:\n${formatValidationErrors(issuesAppBundlePlan.validation)}`);
  }
  assertDeepEqual(
    issuesAppBundlePlan.artifact,
    readJson(path.join(issuesExpectedDir, "app-bundle-plan.json")),
    "Issues app-bundle plan"
  );

  const issuesOpenApi = generateWorkspace(issuesAst, { target: "openapi" });
  if (!issuesOpenApi.ok) {
    throw new Error(`Expected issues OpenAPI generation to succeed:\n${formatValidationErrors(issuesOpenApi.validation)}`);
  }
  assertDeepEqual(
    issuesOpenApi.artifact,
    readJson(path.join(issuesExpectedDir, "openapi.json")),
    "Issues OpenAPI document"
  );

  const issuesBundleTargets = [
    ["hono-server", { target: "hono-server", projectionId: "proj_api" }],
    ["express-server", { target: "express-server", projectionId: "proj_api" }],
    ["react-app", { target: "sveltekit-app", projectionId: "proj_ui_web" }],
    ["sveltekit-app", { target: "sveltekit-app", projectionId: "proj_ui_web_sveltekit" }],
    ["runtime-check-bundle", { target: "runtime-check-bundle" }],
    ["app-bundle", { target: "app-bundle" }]
  ];

  for (const [dirName, options] of issuesBundleTargets) {
    const generatedBundle = generateWorkspace(issuesAst, options);
    if (!generatedBundle.ok) {
      throw new Error(`Expected issues ${dirName} generation to succeed:\n${formatValidationErrors(generatedBundle.validation)}`);
    }
    const bundleDir = path.join(issuesExpectedDir, dirName);
    for (const filePath of listRelativeFiles(bundleDir)) {
      if (normalizeText(generatedBundle.artifact[filePath]) !== normalizeText(readText(path.join(bundleDir, filePath)))) {
        throw new Error(`Generated issues ${dirName}/${filePath} did not match expected output`);
      }
    }
  }
  {
    const issuesAppBundle = generateWorkspace(issuesAst, { target: "app-bundle" });
    if (!issuesAppBundle.ok) {
      throw new Error(`Expected issues app-bundle generation to succeed:\n${formatValidationErrors(issuesAppBundle.validation)}`);
    }
    for (const filePath of listRelativeFiles(path.join(issuesRoot, "apps", "local-stack", "runtime-check"))) {
      const generatedPath = `runtime-check/${filePath}`;
      if (
        normalizeText(issuesAppBundle.artifact[generatedPath]) !==
        normalizeText(readText(path.join(issuesRoot, "apps", "local-stack", "runtime-check", filePath)))
      ) {
        throw new Error(`Generated issues committed runtime-check/${filePath} did not match app-bundle output`);
      }
    }
  }

  const generatedIssuesSvelteKitApp = generateWorkspace(issuesAst, {
    target: "sveltekit-app",
    projectionId: "proj_ui_web_sveltekit"
  });
  if (!generatedIssuesSvelteKitApp.ok) {
    throw new Error(
      `Expected issues SvelteKit app generation to succeed:\n${formatValidationErrors(generatedIssuesSvelteKitApp.validation)}`
    );
  }
  assertRedirectEscapesCatch(
    generatedIssuesSvelteKitApp.artifact["src/routes/issues/new/+page.server.ts"],
    "Issues create action"
  );
  assertRedirectEscapesCatch(
    generatedIssuesSvelteKitApp.artifact["src/routes/issues/[id]/edit/+page.server.ts"],
    "Issues update action"
  );
  assertRedirectEscapesCatch(
    generatedIssuesSvelteKitApp.artifact["src/routes/issues/[id]/+page.server.ts"],
    "Issues detail actions"
  );

  const issuesScanDocs = runWorkflow("scan-docs", issuesPath);
  assertIncludes(
    stableStringify(issuesScanDocs.summary.candidate_docs),
    ['"id": "board"', '"id": "issue"', '"id": "user"', '"id": "close-issue"'],
    "Issues scan-docs summary"
  );

  const todoScanDocs = runWorkflow("scan-docs", todoPath);
  assertIncludes(
    stableStringify(todoScanDocs.summary.candidate_docs),
    ['"id": "project"', '"id": "task"', '"id": "user"', '"id": "export-tasks"'],
    "Todo scan-docs summary"
  );

  const actorRoleDocsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-scan-docs-actors-roles-"));
  writeGeneratedFiles(actorRoleDocsRoot, {
    "README.md": `# Editorial Review

Authors can update draft articles and submit them for review.
Only managers may approve article changes.
Reviewers may request revision before publication.
Users can still browse the article list.
`,
    "artifacts/docs/notes.md": `# Runtime Notes

The author returns to editing after feedback.
Managers can approve or reject a submission.
`
  });
  const actorRoleScanDocs = runWorkflow("scan-docs", actorRoleDocsRoot);
  assertIncludes(
    stableStringify(actorRoleScanDocs.summary),
    ['"candidate_actors"', '"actor_author"', '"actor_user"', '"candidate_roles"', '"role_author"', '"role_manager"', '"role_reviewer"'],
    "Actor/role scan-docs summary"
  );
  assertExcludes(
    stableStringify(actorRoleScanDocs.summary),
    ['"actor_manager"', '"actor_reviewer"'],
    "Actor/role scan-docs suppresses permission-only actors"
  );
  assertIncludes(
    stableStringify(actorRoleScanDocs.summary),
    ['"related_docs"', '"lifecycle-flow"', '"review-workflow"'],
    "Actor/role scan-docs links"
  );
  if (
    !actorRoleScanDocs.files["candidates/docs/actors/author.tg"] ||
    !actorRoleScanDocs.files["candidates/docs/actors/user.tg"] ||
    !actorRoleScanDocs.files["candidates/docs/roles/manager.tg"]
  ) {
    throw new Error("Expected scan-docs to emit candidate actor/role files");
  }
  assertIncludes(
    actorRoleScanDocs.files["candidates/docs/actors/author.tg"],
    ["# imported related_doc: lifecycle-flow", "# imported inference: phrases="],
    "Actor candidate file includes related docs"
  );
  assertIncludes(
    actorRoleScanDocs.files["candidates/docs/roles/manager.tg"],
    ["# imported related_doc: review-workflow", "# imported inference: permission_hits="],
    "Role candidate file includes related docs"
  );
  assertIncludes(
    actorRoleScanDocs.files["candidates/docs/import-report.md"],
    ["## Candidate Actors", "## Candidate Roles", "`actor_author` (medium)", "`role_manager` (high)"],
    "Actor/role scan-docs markdown report"
  );
  const actorRoleReconcile = runWorkflow("reconcile", actorRoleDocsRoot);
  assertIncludes(
    stableStringify(actorRoleReconcile.summary.candidate_model_bundles),
    ['"id": "flow_lifecycle-flow"', '"actor_author"', '"role_manager"', '"lifecycle-flow"', '"actor_details"', '"related_docs"', '"review-workflow"'],
    "Actor/role reconcile summary"
  );
  assertIncludes(
    stableStringify(actorRoleReconcile.summary.adoption_plan_items),
    ['"item": "role_manager"', '"confidence": "high"', '"recommendation": "Promote this role (high)', '"related_docs"', '"lifecycle-flow"'],
    "Actor/role adoption plan guidance"
  );
  assertIncludes(
    stableStringify(actorRoleReconcile.summary.bundle_priorities),
    ['"bundle": "flow-lifecycle-flow"', '"recommended_actor_role_actions"', '"item": "role_manager"', '"confidence": "high"'],
    "Actor/role bundle priority guidance"
  );
  assertIncludes(
    actorRoleReconcile.files["candidates/reconcile/model/bundles/flow-lifecycle-flow/README.md"],
    ["## Actor Evidence", "related docs `lifecycle-flow`, `review-workflow`", "## Role Evidence", "role_manager", "related docs `lifecycle-flow`, `review-workflow`"],
    "Actor/role reconcile bundle readme"
  );
  assertIncludes(
    actorRoleReconcile.files["candidates/reconcile/report.md"],
    [
      "actor `actor_author` docs=`lifecycle-flow`, `review-workflow`",
      "role `role_manager` docs=`lifecycle-flow`, `review-workflow`",
      "## Next Best Action",
      "- Bundle: `flow-lifecycle-flow`"
    ],
    "Actor/role reconcile markdown report"
  );
  const actorRoleJourneyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-journey-participants-"));
  writeGeneratedFiles(actorRoleJourneyRoot, {
    "topogram/candidates/app/api/candidates.json": `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_update_article",
          label: "Update Article",
          confidence: "medium",
          source_kind: "route_code",
          provenance: ["fixture#PUT /articles/:slug"],
          track: "api",
          endpoint: { method: "PUT", path: "/articles/:slug" },
          input_fields: ["title", "body"],
          output_fields: ["slug", "title", "body"],
          path_params: [{ name: "slug" }],
          query_params: []
        }
      ],
      routes: [],
      stacks: []
    })}\n`,
    "topogram/candidates/docs/import-report.json": `${stableStringify({
      type: "scan_docs_report",
      workspace: actorRoleJourneyRoot,
      bootstrapped_topogram_root: false,
      source_count: 1,
      sources: ["README.md"],
      findings: [],
      candidate_docs: [
        {
          id: "article_review_flow",
          kind: "workflow",
          title: "Article Review Flow",
          path: "candidates/docs/workflows/article-review-flow.md",
          confidence: "medium",
          provenance: ["README.md"],
          related_entities: ["entity_article"],
          related_capabilities: ["cap_update_article"],
          related_rules: ["rule_only_active_users_may_review_articles"],
          source_of_truth: "imported"
        }
      ],
      candidate_actors: [
        {
          id_hint: "actor_author",
          label: "Author",
          confidence: "medium",
          source_kind: "docs",
          provenance: ["README.md"],
          related_docs: ["article_review_flow"],
          related_capabilities: ["cap_update_article"],
          inference_summary: "phrases=2, participant_hits=1, permission_overlap=0"
        }
      ],
      candidate_roles: [
        {
          id_hint: "role_reviewer",
          label: "Reviewer",
          confidence: "medium",
          source_kind: "docs",
          provenance: ["README.md"],
          related_docs: ["article_review_flow"],
          related_capabilities: ["cap_update_article"],
          inference_summary: "permission_hits=2, restrictive_hits=0, explicit_role_hits=0"
        }
      ]
    })}\n`
  });
  const actorRoleJourneyReconcile = runWorkflow("reconcile", path.join(actorRoleJourneyRoot, "topogram"));
  assertIncludes(
    actorRoleJourneyReconcile.files["candidates/reconcile/model/bundles/article/docs/journeys/article_journey.md"],
    [
      "The strongest inferred participants are `actor_author`, `role_reviewer`.",
      "The strongest inferred constraints come from `rule_only_active_users_may_review_articles`.",
      "`actor_author`, `role_reviewer` enter the flow through the article API surface.",
      "## Recovered Signals",
      "Rules: `rule_only_active_users_may_review_articles`",
      "## Promotion Notes",
      "Canonical destination: `docs/journeys/article_journey.md`.",
      "`reconcile adopt journeys --write`"
    ],
    "Journey draft includes inferred participants"
  );
  const actorRoleAdoptionStatus = runWorkflow("adoption-status", actorRoleDocsRoot);
  assertIncludes(
    actorRoleAdoptionStatus.files["candidates/reconcile/adoption-status.md"],
    ["Suggested actor/role actions:", "role `role_manager` (high)"],
    "Actor/role adoption status guidance"
  );
  const actorAdoptRun = runWorkflow("reconcile", actorRoleDocsRoot, { adopt: "actors", write: true });
  assertIncludes(
    stableStringify(actorAdoptRun.summary.applied_items),
    ['"actor_author"', '"actor_user"'],
    "Actor adoption summary"
  );
  if (
    !actorAdoptRun.files["actors/actor-author.tg"] ||
    !actorAdoptRun.files["actors/actor-user.tg"]
  ) {
    throw new Error("Expected actor adoption to emit canonical actor files");
  }

  const issuesImportApp = runWorkflow("import-app", issuesPath);
  assertIncludes(
    stableStringify(issuesImportApp.summary.candidates),
    ['"entity_issue"', '"cap_close_issue"', '"/issues/{id}/close"', '"sveltekit_web"'],
    "Issues import-app summary"
  );

  const prismaDbImport = runWorkflow("import-app", prismaOpenApiPath, { from: "db" });
  assertIncludes(
    stableStringify(prismaDbImport.summary.candidates.db),
    ['"entity_task"', '"task_priority"', '"entity_user"', '"schema"'],
    "Prisma DB import summary"
  );
  if (prismaDbImport.summary.candidates.db.entities[0].provenance.length !== 1) {
    throw new Error("Expected Prisma DB import to keep a single preferred schema provenance");
  }

  const prismaApiImport = runWorkflow("import-app", prismaOpenApiPath, { from: "api" });
  assertIncludes(
    stableStringify(prismaApiImport.summary.candidates.api),
    ['"cap_create_task"', '"cap_update_task"', '"/tasks/{id}"', '"openapi"'],
    "Prisma API import summary"
  );
  if (prismaApiImport.summary.candidates.api.capabilities[0].provenance.length !== 1) {
    throw new Error("Expected API import to keep a single preferred OpenAPI provenance");
  }
  const prismaCreateTask = prismaApiImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_task");
  const prismaUpdateTask = prismaApiImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_update_task");
  if (!prismaCreateTask?.input_fields?.includes("priority") || !prismaCreateTask?.output_fields?.includes("priority")) {
    throw new Error("Expected OpenAPI import to extract request and response field hints");
  }
  if (!prismaUpdateTask?.path_params?.some((param) => param.name === "id")) {
    throw new Error("Expected OpenAPI import to extract path parameter hints");
  }

  const sqlDbImport = runWorkflow("import-app", sqlOpenApiPath, { from: "db" });
  assertIncludes(
    stableStringify(sqlDbImport.summary.candidates.db),
    ['"entity_task"', '"task_priority"', '"owner_id"', '"schema"'],
    "SQL DB import summary"
  );

  const sqlApiImport = runWorkflow("import-app", sqlOpenApiPath, { from: "api" });
  assertIncludes(
    stableStringify(sqlApiImport.summary.candidates.api),
    ['"cap_create_task"', '"cap_update_task"', '"/tasks/{id}"', '"openapi"'],
    "YAML API import summary"
  );

  const routeFallbackImport = runWorkflow("import-app", routeFallbackPath, { from: "api" });
  assertIncludes(
    stableStringify(routeFallbackImport.summary.candidates.api),
    ['"cap_list_tasks"', '"cap_create_task"', '"cap_update_task"', '"route_code"'],
    "Route fallback API import summary"
  );
  const routeFallbackList = routeFallbackImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_tasks");
  const routeFallbackUpdate = routeFallbackImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_update_task");
  if (!routeFallbackList || routeFallbackList.auth_hint !== "secured") {
    throw new Error("Expected route fallback import to detect auth middleware hints");
  }
  if (!routeFallbackList.query_params.some((param) => param.name === "status") || !routeFallbackList.query_params.some((param) => param.name === "ownerId")) {
    throw new Error("Expected route fallback import to detect query parameter hints");
  }
  if (!routeFallbackUpdate || !routeFallbackUpdate.path_params.some((param) => param.name === "id")) {
    throw new Error("Expected route fallback import to normalize path params");
  }

  const routeFallbackUiImport = runWorkflow("import-app", routeFallbackPath, { from: "ui" });
  assertIncludes(
    stableStringify(routeFallbackUiImport.summary.candidates.ui),
    ['"task_list"', '"task_create"', '"task_detail"', '"task_edit"', '"react_web"'],
    "Route-driven UI import summary"
  );
  const nextAppUiRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-next-app-ui-"));
  fs.mkdirSync(path.join(nextAppUiRoot, "app", "posts", "[id]"), { recursive: true });
  fs.mkdirSync(path.join(nextAppUiRoot, "app", "posts", "new"), { recursive: true });
  fs.mkdirSync(path.join(nextAppUiRoot, "app", "login"), { recursive: true });
  fs.writeFileSync(path.join(nextAppUiRoot, "app", "page.tsx"), "export default function Page() { return null; }\n");
  fs.writeFileSync(path.join(nextAppUiRoot, "app", "posts", "page.tsx"), "export default function PostsPage() { return null; }\n");
  fs.writeFileSync(path.join(nextAppUiRoot, "app", "posts", "[id]", "page.tsx"), "export default function PostPage() { return null; }\n");
  fs.writeFileSync(path.join(nextAppUiRoot, "app", "posts", "new", "page.tsx"), "export default function NewPostPage() { return null; }\n");
  fs.writeFileSync(path.join(nextAppUiRoot, "app", "login", "page.tsx"), "export default function LoginPage() { return null; }\n");
  const nextAppUiImport = runWorkflow("import-app", nextAppUiRoot, { from: "ui" });
  assertIncludes(
    stableStringify(nextAppUiImport.summary.candidates.ui),
    ['"home"', '"post_list"', '"post_detail"', '"post_create"', '"login"', '"next_app_router"'],
    "Next.js App Router UI import summary"
  );
  const nextApiRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-next-api-"));
  fs.mkdirSync(path.join(nextApiRoot, "app", "api", "posts"), { recursive: true });
  fs.writeFileSync(
    path.join(nextApiRoot, "app", "api", "posts", "route.ts"),
    `import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  return NextResponse.json({ posts: [], totalPages: page });
}
`
  );
  const nextApiImport = runWorkflow("import-app", nextApiRoot, { from: "api" });
  assertIncludes(
    stableStringify(nextApiImport.summary.candidates.api),
    ['"cap_list_posts"', '"/posts"', '"page"', '"posts"', '"totalPages"', '"route_code"'],
    "Next.js App Router API import summary"
  );
  const nextServerActionRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-next-actions-"));
  fs.mkdirSync(path.join(nextServerActionRoot, "app", "posts", "new"), { recursive: true });
  fs.mkdirSync(path.join(nextServerActionRoot, "app", "users", "new"), { recursive: true });
  fs.mkdirSync(path.join(nextServerActionRoot, "app", "login"), { recursive: true });
  fs.mkdirSync(path.join(nextServerActionRoot, "app", "register"), { recursive: true });
  fs.writeFileSync(
    path.join(nextServerActionRoot, "auth.ts"),
    `import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";

export const authOptions = {
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        const user = await prisma.user.findUnique({ where: { email: credentials?.email } });
        if (!user) {
          return await prisma.user.create({ data: { email: credentials?.email, password: "" } });
        }
        return user;
      }
    })
  ],
  pages: { signIn: "/login" }
};
`
  );
  fs.writeFileSync(
    path.join(nextServerActionRoot, "app", "posts", "new", "actions.ts"),
    `"use server";

export async function createPost(formData: FormData) {
  const title = formData.get("title");
  const content = formData.get("content");
  if (!title) throw new Error("missing");
}
`
  );
  fs.writeFileSync(
    path.join(nextServerActionRoot, "app", "users", "new", "page.tsx"),
    `export default function NewUser() {
  async function createUser(formData: FormData) {
    "use server";
    const name = formData.get("name");
    const email = formData.get("email");
    return { ok: Boolean(name && email) };
  }
  return null;
}
`
  );
  fs.writeFileSync(
    path.join(nextServerActionRoot, "app", "login", "page.tsx"),
    `import { signIn } from "next-auth/react";

export default function LoginPage() {
  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await signIn("credentials", { ...Object.fromEntries(formData), redirect: false });
  }
  return <form onSubmit={handleSubmit}><input name="email" /><input name="password" /></form>;
}
`
  );
  fs.writeFileSync(
    path.join(nextServerActionRoot, "app", "register", "page.tsx"),
    `import { signIn } from "next-auth/react";

export default function RegisterPage() {
  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await signIn("credentials", { ...Object.fromEntries(formData), redirect: false });
  }
  return <form onSubmit={handleSubmit}><input name="name" /><input name="email" /><input name="password" /></form>;
}
`
  );
  const nextServerActionImport = runWorkflow("import-app", nextServerActionRoot, { from: "api,workflows" });
  assertIncludes(
    stableStringify(nextServerActionImport.summary.candidates),
    ['"cap_create_post"', '"/posts/new"', '"title"', '"content"', '"cap_create_user"', '"/users/new"', '"cap_sign_in_user"', '"/login"', '"cap_register_user"', '"/register"', '"workflow_post"', '"workflow_user"'],
    "Next.js server action import summary"
  );
  const nextServerActionCreatePost = nextServerActionImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_post");
  if (!nextServerActionCreatePost || nextServerActionCreatePost.endpoint?.path !== "/posts/new") {
    throw new Error("Expected Next.js server action import to attach createPost to /posts/new");
  }
  const nextAuthSignIn = nextServerActionImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_sign_in_user");
  const nextAuthRegister = nextServerActionImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_register_user");
  if (!nextAuthSignIn || nextAuthSignIn.auth_hint !== "public" || !nextAuthSignIn.input_fields.includes("email") || !nextAuthSignIn.input_fields.includes("password")) {
    throw new Error("Expected NextAuth import to infer a public sign-in capability with login fields");
  }
  if (!nextAuthRegister || !nextAuthRegister.input_fields.includes("name") || !nextAuthRegister.input_fields.includes("email") || !nextAuthRegister.input_fields.includes("password")) {
    throw new Error("Expected NextAuth import to infer a register capability with register fields");
  }
  if (!stableStringify(nextServerActionImport.summary.candidates.workflows).includes('"authenticated"') || !stableStringify(nextServerActionImport.summary.candidates.workflows).includes('"registered"')) {
    throw new Error("Expected NextAuth import to enrich user workflows with auth states");
  }
  const brownfieldBootstrapRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-bootstrap-"));
  const brownfieldWorkspaceRoot = path.join(brownfieldBootstrapRoot, "workspace");
  fs.cpSync(routeFallbackPath, brownfieldWorkspaceRoot, { recursive: true });
  const bootstrapImportRun = childProcess.spawnSync(
    process.execPath,
    ["./src/cli.js", brownfieldWorkspaceRoot, "--workflow", "import-app", "--from", "ui", "--write"],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH || ""
      }
    }
  );
  if (bootstrapImportRun.status !== 0) {
    throw new Error(`Expected import-app to bootstrap a missing topogram root:\n${bootstrapImportRun.stderr || bootstrapImportRun.stdout}`);
  }
  if (!fs.existsSync(path.join(brownfieldWorkspaceRoot, "topogram", "candidates", "app", "ui", "candidates.json"))) {
    throw new Error("Expected write-mode import-app to create topogram/candidates output when topogram/ is missing");
  }

  const contentApprovalWorkflowImport = runWorkflow("import-app", contentApprovalPath, { from: "workflows" });
  assertIncludes(
    stableStringify(contentApprovalWorkflowImport.summary.candidates.workflows),
    ['"workflow_article"', '"cap_approve_article"', '"approved"', '"user"'],
    "Workflow import summary"
  );

  const mixedImport = runWorkflow("import-app", prismaOpenApiPath, { from: "db,api,ui,workflows,verification" });
  assertIncludes(
    stableStringify(mixedImport.summary),
    ['"db"', '"api"', '"ui"', '"workflows"', '"verification"', '"entity_task"', '"cap_create_task"'],
    "Mixed import summary"
  );

  const issuesImport = runWorkflow("import-app", issuesPath, { from: "db,api" });
  const issuesEntity = issuesImport.summary.candidates.db.entities.find((entity) => entity.id_hint === "entity_issue");
  if (!issuesEntity || issuesEntity.provenance.length !== 1 || !issuesEntity.provenance[0].includes("examples/generated/issues/apps/backend/prisma/schema.prisma")) {
    throw new Error("Expected Issues import to prefer the backend Prisma schema");
  }

  const todoImport = runWorkflow("import-app", todoPath, { from: "db,api" });
  const todoTask = todoImport.summary.candidates.db.entities.find((entity) => entity.id_hint === "entity_task");
  if (!todoTask || todoTask.provenance.length !== 1 || !todoTask.provenance[0].includes("examples/generated/todo/apps/backend/prisma/schema.prisma")) {
    throw new Error("Expected Todo import to prefer the backend Prisma schema");
  }
  const todoExportCapability = todoImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_export_tasks");
  if (!todoExportCapability || todoExportCapability.provenance.length !== 1 || !todoExportCapability.provenance[0].includes("examples/generated/todo/artifacts/openapi/openapi.json")) {
    throw new Error("Expected Todo API import to prefer the canonical OpenAPI artifact");
  }

  const supabaseExpressImport = runWorkflow("import-app", supabaseExpressTrialPath, { from: "db,api,ui,workflows" });
  const supabaseDbEntities = supabaseExpressImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  const supabaseApiCapabilities = supabaseExpressImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (!supabaseDbEntities.includes("entity_workspace") || !supabaseDbEntities.includes("entity_workspace-membership")) {
    throw new Error("Expected Supabase Express import to include Drizzle-backed workspace concepts");
  }
  if (!supabaseApiCapabilities.includes("cap_list_workspaces") || !supabaseApiCapabilities.includes("cap_create_workspace_membership")) {
    throw new Error("Expected Supabase Express import to include OpenAPI-derived workspace capabilities");
  }
  if (!supabaseExpressImport.summary.candidates.ui.stacks.includes("backend_only")) {
    throw new Error("Expected Supabase Express import to mark the repo as backend-only for UI import");
  }
  const supabaseWorkspaceCapability = supabaseExpressImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_workspace_membership");
  if (!supabaseWorkspaceCapability || supabaseWorkspaceCapability.entity_id !== "entity_workspace-membership") {
    throw new Error("Expected OpenAPI code import to map workspace member routes to the workspace-membership concept");
  }
  const loginCapability = supabaseExpressImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_sign_in_account");
  if (!loginCapability || !loginCapability.output_fields.includes("token") || !loginCapability.output_fields.includes("account")) {
    throw new Error("Expected OpenAPI code import to parse auth response fields from zod OpenAPI source");
  }
  const workspacesCapability = supabaseExpressImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_workspaces");
  if (!workspacesCapability || !workspacesCapability.output_fields.includes("workspaces")) {
    throw new Error("Expected OpenAPI code import to derive list response fields for workspace collections");
  }

  const trpcImport = runWorkflow("import-app", trpcTrialPath, { from: "db,api,ui,workflows" });
  const trpcCapabilities = trpcImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  const trpcScreens = trpcImport.summary.candidates.ui.screens.map((screen) => screen.id_hint);
  if (!trpcCapabilities.includes("cap_list_posts") || !trpcCapabilities.includes("cap_get_post") || !trpcCapabilities.includes("cap_create_post")) {
    throw new Error("Expected tRPC import to recover post list/get/create capabilities from router procedures");
  }
  if (!trpcScreens.includes("post_list") || !trpcScreens.includes("post_detail")) {
    throw new Error("Expected Next.js Pages Router import to recover post list/detail screens");
  }
  if (!trpcImport.summary.candidates.ui.stacks.includes("next_pages_router")) {
    throw new Error("Expected tRPC trial UI import to identify the Next.js Pages Router stack");
  }
  const trpcWorkflow = trpcImport.summary.candidates.workflows.workflows.find((workflow) => workflow.id_hint === "workflow_post");
  if (!trpcWorkflow) {
    throw new Error("Expected tRPC-derived API capabilities to feed workflow inference for post");
  }
  const trpcVerificationImport = runWorkflow("import-app", trpcTrialPath, { from: "verification" });
  const trpcVerificationSummary = stableStringify(trpcVerificationImport.summary.candidates.verification);
  assertIncludes(
    trpcVerificationSummary,
    ['"playwright"', '"vitest"', '"go to /"', '"add a post"', '"test-e2e"', '"test-unit"'],
    "tRPC verification import summary"
  );
  const trpcPlaywrightVerification = trpcVerificationImport.summary.candidates.verification.verifications.find(
    (entry) => entry.framework === "playwright"
  );
  if (!trpcPlaywrightVerification || !trpcPlaywrightVerification.related_capabilities.includes("cap_create_post")) {
    throw new Error("Expected verification import to relate Playwright evidence to post capabilities");
  }
  const trpcListPosts = trpcImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_posts");
  if (
    !trpcListPosts ||
    !trpcListPosts.input_fields.includes("limit") ||
    !trpcListPosts.input_fields.includes("cursor") ||
    !trpcListPosts.output_fields.includes("id") ||
    !trpcListPosts.output_fields.includes("title") ||
    !trpcListPosts.output_fields.includes("text")
  ) {
    throw new Error("Expected tRPC import to recover list input/output shape hints");
  }
  const trpcCreatePost = trpcImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_post");
  if (!trpcCreatePost || !trpcCreatePost.input_fields.includes("title") || !trpcCreatePost.input_fields.includes("text") || !trpcCreatePost.output_fields.includes("id") || !trpcCreatePost.output_fields.includes("title")) {
    throw new Error("Expected tRPC import to recover mutation input/output shape hints");
  }

  const fastifyImport = runWorkflow("import-app", fastifyTrialPath, { from: "db,api,ui,workflows" });
  const fastifyCapabilities = fastifyImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (!fastifyCapabilities.includes("cap_list_tasks") || !fastifyCapabilities.includes("cap_create_task") || !fastifyCapabilities.includes("cap_sign_in_account")) {
    throw new Error("Expected Fastify import to recover task CRUD and auth capabilities from route plugins");
  }
  if (!fastifyImport.summary.candidates.api.stacks.includes("fastify")) {
    throw new Error("Expected Fastify import to identify the Fastify API stack");
  }
  const fastifyListTasks = fastifyImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_tasks");
  if (
    !fastifyListTasks ||
    !fastifyListTasks.query_params.some((param) => param.name === "page") ||
    !fastifyListTasks.query_params.some((param) => param.name === "limit") ||
    !fastifyListTasks.output_fields.includes("total") ||
    !fastifyListTasks.output_fields.includes("tasks")
  ) {
    throw new Error("Expected Fastify import to recover query and response shape hints from TypeBox schemas");
  }
  const fastifyTaskWorkflow = fastifyImport.summary.candidates.workflows.workflows.find((workflow) => workflow.id_hint === "workflow_task");
  if (!fastifyTaskWorkflow) {
    throw new Error("Expected Fastify-derived API capabilities to feed workflow inference for task");
  }
  const fastifyTaskEntity = fastifyImport.summary.candidates.db.entities.find((entity) => entity.id_hint === "entity_task");
  if (!fastifyTaskEntity || fastifyTaskEntity.fields.some((field) => field.name === "FOREIGN")) {
    throw new Error("Expected SQL migration import to ignore table-level FOREIGN KEY constraints as entity fields");
  }

  const railsImport = runWorkflow("import-app", railsTrialPath, { from: "db,api,ui,workflows" });
  if (!railsImport.summary.candidates.db.entities.some((entity) => entity.id_hint === "entity_article")) {
    throw new Error("Expected Rails schema import to recover the article entity from db/schema.rb");
  }
  if (!railsImport.summary.candidates.db.entities.some((entity) => entity.id_hint === "entity_user")) {
    throw new Error("Expected Rails schema import to recover the user entity from db/schema.rb");
  }
  if (!railsImport.summary.candidates.db.relations.some((relation) => relation.from_entity === "entity_comment" && relation.to_entity === "entity_article")) {
    throw new Error("Expected Rails schema import to recover article/comment foreign keys");
  }
  if (!railsImport.summary.candidates.api.stacks.includes("rails")) {
    throw new Error("Expected Rails routes import to identify the rails API stack");
  }
  const railsCapabilityIds = railsImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !railsCapabilityIds.includes("cap_sign_in_account")
    || !railsCapabilityIds.includes("cap_list_articles")
    || !railsCapabilityIds.includes("cap_create_comment")
    || !railsCapabilityIds.includes("cap_follow_profile")
  ) {
    throw new Error("Expected Rails routes import to recover auth, articles, comments, and profile follow capabilities");
  }
  const railsArticleRoute = railsImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_get_article");
  if (!railsArticleRoute || !railsArticleRoute.path_params.some((param) => param.name === "slug")) {
    throw new Error("Expected Rails routes import to preserve custom resource params like article slug");
  }
  const railsSignIn = railsImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_sign_in_account");
  const railsCreateUser = railsImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_user");
  const railsFollowProfile = railsImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_follow_profile");
  if (!railsSignIn || railsSignIn.auth_hint !== "public" || !railsSignIn.input_fields.includes("email") || !railsSignIn.input_fields.includes("password") || !railsSignIn.output_fields.includes("token")) {
    throw new Error("Expected Rails controller enrichment to recover auth semantics for sign-in");
  }
  if (!railsCreateUser || !railsCreateUser.input_fields.includes("username") || !railsCreateUser.input_fields.includes("email") || !railsCreateUser.input_fields.includes("password") || railsCreateUser.target_state !== "registered") {
    throw new Error("Expected Rails controller enrichment to recover user creation fields and target state");
  }
  if (!railsFollowProfile || railsFollowProfile.auth_hint !== "secured" || railsFollowProfile.target_state !== "following") {
    throw new Error("Expected Rails controller enrichment to recover secured profile follow semantics");
  }
  const railsFollowerEntity = railsImport.summary.candidates.db.entities.find((entity) => entity.id_hint === "entity_follower");
  if (!railsFollowerEntity || !railsFollowerEntity.noise_candidate) {
    throw new Error("Expected Rails model enrichment to flag follower as implementation-noise linkage");
  }
  const railsWorkflowIds = railsImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (!railsWorkflowIds.includes("workflow_article") || !railsWorkflowIds.includes("workflow_user")) {
    throw new Error("Expected Rails-derived API capabilities to feed workflow inference for article and user");
  }
  const railsImportWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-rails-import-"));
  fs.cpSync(railsTrialPath, railsImportWorkspace, { recursive: true });
  const railsImportedWrite = runWorkflow("import-app", railsImportWorkspace, { from: "db,api,ui,workflows", write: true });
  writeGeneratedFiles(path.join(railsImportWorkspace, "topogram"), railsImportedWrite.files);
  const railsReconcile = runWorkflow("reconcile", railsImportWorkspace);
  const railsBundleSlugs = railsReconcile.summary.candidate_model_bundles.map((bundle) => bundle.slug);
  if (railsBundleSlugs.includes("articles-tag") || railsBundleSlugs.includes("articles-user") || railsBundleSlugs.includes("follower")) {
    throw new Error("Expected Rails reconcile to suppress join-table implementation-noise bundles");
  }
  assertIncludes(
    stableStringify(railsReconcile.summary.suppressed_noise_bundles || []),
    ['"slug": "articles-tag"', '"slug": "articles-user"', '"slug": "follower"'],
    "Rails suppressed noise bundles"
  );
  if (!["article", "comment", "user", "profile", "tag", "account"].includes(railsReconcile.summary.bundle_priorities[0]?.bundle)) {
    throw new Error("Expected Rails reconcile to prioritize a real domain bundle after suppression");
  }

  const djangoImport = runWorkflow("import-app", djangoTrialPath, { from: "db,api,ui,workflows" });
  const djangoEntityIds = djangoImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (
    !djangoEntityIds.includes("entity_article")
    || !djangoEntityIds.includes("entity_comment")
    || !djangoEntityIds.includes("entity_user")
    || !djangoEntityIds.includes("entity_profile")
    || !djangoEntityIds.includes("entity_tag")
  ) {
    throw new Error("Expected Django models import to recover the RealWorld article/comment/user/profile/tag entities");
  }
  if (djangoEntityIds.includes("entity_timestampedmodel")) {
    throw new Error("Expected Django models import to skip abstract base models like TimestampedModel");
  }
  if (!djangoImport.summary.candidates.db.relations.some((relation) => relation.from_entity === "entity_comment" && relation.to_entity === "entity_article")) {
    throw new Error("Expected Django models import to recover the comment/article relation");
  }
  if (!djangoImport.summary.candidates.api.stacks.includes("django")) {
    throw new Error("Expected Django routes import to identify the django API stack");
  }
  const djangoCapabilityIds = djangoImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !djangoCapabilityIds.includes("cap_list_articles")
    || !djangoCapabilityIds.includes("cap_create_article")
    || !djangoCapabilityIds.includes("cap_get_article")
    || !djangoCapabilityIds.includes("cap_update_article")
    || !djangoCapabilityIds.includes("cap_sign_in_account")
    || !djangoCapabilityIds.includes("cap_follow_profile")
    || !djangoCapabilityIds.includes("cap_create_comment")
  ) {
    throw new Error("Expected Django routes import to recover article CRUD, auth, profile follow, and comment creation capabilities");
  }
  const djangoListArticles = djangoImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_articles");
  if (
    !djangoListArticles
    || !djangoListArticles.query_params.some((param) => param.name === "author")
    || !djangoListArticles.query_params.some((param) => param.name === "tag")
    || !djangoListArticles.query_params.some((param) => param.name === "favorited")
    || !djangoListArticles.output_fields.includes("articles")
    || !djangoListArticles.output_fields.includes("articlesCount")
  ) {
    throw new Error("Expected Django REST enrichment to recover article list query params and wrapper output fields");
  }
  const djangoSignIn = djangoImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_sign_in_account");
  const djangoCreateUser = djangoImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_user");
  const djangoFollowProfile = djangoImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_follow_profile");
  if (!djangoSignIn || djangoSignIn.auth_hint !== "public" || !djangoSignIn.input_fields.includes("email") || !djangoSignIn.input_fields.includes("password") || djangoSignIn.target_state !== "authenticated") {
    throw new Error("Expected Django REST enrichment to recover sign-in auth semantics and input fields");
  }
  if (!djangoCreateUser || !djangoCreateUser.input_fields.includes("username") || !djangoCreateUser.input_fields.includes("email") || !djangoCreateUser.input_fields.includes("password") || djangoCreateUser.target_state !== "registered") {
    throw new Error("Expected Django REST enrichment to recover user registration fields and target state");
  }
  if (!djangoFollowProfile || djangoFollowProfile.auth_hint !== "secured" || djangoFollowProfile.target_state !== "following") {
    throw new Error("Expected Django REST enrichment to recover secured profile follow semantics");
  }
  const djangoWorkflowIds = djangoImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (
    !djangoWorkflowIds.includes("workflow_article")
    || !djangoWorkflowIds.includes("workflow_comment")
    || !djangoWorkflowIds.includes("workflow_user")
    || !djangoWorkflowIds.includes("workflow_profile")
    || !djangoWorkflowIds.includes("workflow_account")
  ) {
    throw new Error("Expected Django-derived API capabilities to feed workflow inference for core RealWorld concepts");
  }
  const djangoImportWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-django-import-"));
  fs.cpSync(djangoTrialPath, djangoImportWorkspace, { recursive: true });
  const djangoImportedWrite = runWorkflow("import-app", djangoImportWorkspace, { from: "db,api,ui,workflows", write: true });
  writeGeneratedFiles(path.join(djangoImportWorkspace, "topogram"), djangoImportedWrite.files);
  const djangoReconcile = runWorkflow("reconcile", djangoImportWorkspace);
  const djangoBundleSlugs = djangoReconcile.summary.candidate_model_bundles.map((bundle) => bundle.slug);
  if (
    !djangoBundleSlugs.includes("article")
    || !djangoBundleSlugs.includes("comment")
    || !djangoBundleSlugs.includes("user")
    || !djangoBundleSlugs.includes("profile")
    || !djangoBundleSlugs.includes("tag")
    || !djangoBundleSlugs.includes("account")
  ) {
    throw new Error("Expected Django reconcile to surface the core RealWorld domain bundles");
  }
  assertIncludes(
    stableStringify(djangoReconcile.summary.candidate_model_bundles),
    ['"slug": "article"', '"article_journey"'],
    "Django reconcile journey draft summary"
  );
  assertIncludes(
    djangoReconcile.files["candidates/reconcile/model/bundles/article/docs/journeys/article_journey.md"],
    [
      "kind: journey",
      "title: Article Creation, Detail, and Lifecycle Flow",
      "status: inferred",
      "review_required: true",
      "related_workflows:",
      "  - workflow_article",
      "cap_create_article",
      "Candidate journey inferred during reconcile",
      "## Recovered Signals",
      "Workflows: `workflow_article`",
      "## Promotion Notes",
      "Canonical destination: `docs/journeys/article_journey.md`.",
      "`reconcile adopt journeys --write`"
    ],
    "Django reconcile journey draft file"
  );
  assertIncludes(
    djangoReconcile.files["candidates/reconcile/model/bundles/account/docs/journeys/account_journey.md"],
    [
      "title: Account Sign-In and Session Flow",
      "cap_sign_in_account",
      "authenticated account state",
      "## Promotion Notes",
      "Canonical destination: `docs/journeys/account_journey.md`."
    ],
    "Django reconcile account journey draft file"
  );
  assertIncludes(
    djangoReconcile.files["candidates/reconcile/model/bundles/article/README.md"],
    [
      "## Journey Drafts",
      "`article_journey` (Article Creation, Detail, and Lifecycle Flow) -> `docs/journeys/article_journey.md`",
      "`reconcile adopt journeys --write`"
    ],
    "Django reconcile bundle journey promotion guidance"
  );
  const djangoJourneyAdoptApply = runWorkflow("reconcile", djangoImportWorkspace, { adopt: "journeys", write: true });
  assertIncludes(
    stableStringify(djangoJourneyAdoptApply.summary.written_canonical_files),
    ['"docs/journeys/article_journey.md"', '"docs/journeys/account_journey.md"', '"docs/journeys/comment_journey.md"'],
    "Django reconcile adopt journeys writes canonical journey docs"
  );
  assertIncludes(
    stableStringify(djangoJourneyAdoptApply.summary.promoted_canonical_items),
    [
      '"selector": "journeys"',
      '"bundle": "article"',
      '"item": "article_journey"',
      '"source_path": "candidates/reconcile/model/bundles/article/docs/journeys/article_journey.md"',
      '"canonical_rel_path": "docs/journeys/article_journey.md"'
    ],
    "Django reconcile adopt journeys promoted canonical item summary"
  );
  assertIncludes(
    djangoJourneyAdoptApply.files["candidates/reconcile/report.md"],
    [
      "## Promoted Canonical Items",
      "[article] `article_journey` `candidates/reconcile/model/bundles/article/docs/journeys/article_journey.md` -> `docs/journeys/article_journey.md`"
    ],
    "Django reconcile report promoted canonical items markdown"
  );
  assertIncludes(
    djangoJourneyAdoptApply.files["candidates/reconcile/adoption-status.md"],
    [
      "## Promoted Canonical Items",
      "[article] `candidates/reconcile/model/bundles/article/docs/journeys/article_journey.md` -> `docs/journeys/article_journey.md`"
    ],
    "Django adoption status promoted canonical items markdown"
  );
  assertExcludes(
    stableStringify(djangoJourneyAdoptApply.summary.written_canonical_files),
    ['"docs/workflows/workflow_article.md"', '"entities/entity-article.tg"', '"capabilities/cap-create-article.tg"'],
    "Django reconcile adopt journeys does not write non-journey artifacts"
  );
  if (!["article", "profile", "user", "comment", "tag", "account"].includes(djangoReconcile.summary.bundle_priorities[0]?.bundle)) {
    throw new Error("Expected Django reconcile to prioritize a real domain bundle");
  }

  const aspnetImport = runWorkflow("import-app", aspnetCoreTrialPath, { from: "db,api,ui,workflows" });
  const aspnetEntityIds = aspnetImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (
    !aspnetEntityIds.includes("entity_article")
    || !aspnetEntityIds.includes("entity_comment")
    || !aspnetEntityIds.includes("entity_user")
    || !aspnetEntityIds.includes("entity_tag")
  ) {
    throw new Error("Expected EF Core import to recover article/comment/user/tag entities from the ASP.NET Core RealWorld app");
  }
  const aspnetNoiseEntities = aspnetImport.summary.candidates.db.entities.filter((entity) => entity.noise_candidate).map((entity) => entity.id_hint);
  if (
    !aspnetNoiseEntities.includes("entity_articlefavorite")
    || !aspnetNoiseEntities.includes("entity_articletag")
    || !aspnetNoiseEntities.includes("entity_followedpeople")
  ) {
    throw new Error("Expected EF Core import to flag ASP.NET Core relationship-link entities as implementation noise");
  }
  if (!aspnetImport.summary.candidates.api.stacks.includes("aspnet_core")) {
    throw new Error("Expected ASP.NET Core import to identify the aspnet_core API stack");
  }
  const aspnetCapabilityIds = aspnetImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !aspnetCapabilityIds.includes("cap_list_articles")
    || !aspnetCapabilityIds.includes("cap_create_article")
    || !aspnetCapabilityIds.includes("cap_get_profile")
    || !aspnetCapabilityIds.includes("cap_sign_in_account")
    || !aspnetCapabilityIds.includes("cap_create_comment")
  ) {
    throw new Error("Expected ASP.NET Core controller import to recover article, profile, auth, and comment capabilities");
  }
  const aspnetListArticles = aspnetImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_articles");
  const aspnetSignIn = aspnetImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_sign_in_account");
  const aspnetCreateUser = aspnetImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_user");
  if (
    !aspnetListArticles
    || !aspnetListArticles.query_params.some((param) => param.name === "tag")
    || !aspnetListArticles.query_params.some((param) => param.name === "author")
    || !aspnetListArticles.query_params.some((param) => param.name === "limit")
    || !aspnetListArticles.output_fields.includes("articles")
    || !aspnetListArticles.output_fields.includes("articlesCount")
  ) {
    throw new Error("Expected ASP.NET Core import to recover article list query params and envelope fields");
  }
  if (!aspnetSignIn || aspnetSignIn.auth_hint !== "public" || !aspnetSignIn.input_fields.includes("email") || !aspnetSignIn.input_fields.includes("password") || !aspnetSignIn.output_fields.includes("user")) {
    throw new Error("Expected ASP.NET Core import to recover auth semantics for sign-in");
  }
  if (!aspnetCreateUser || !aspnetCreateUser.input_fields.includes("username") || !aspnetCreateUser.input_fields.includes("email") || !aspnetCreateUser.input_fields.includes("password")) {
    throw new Error("Expected ASP.NET Core import to recover user creation input fields");
  }
  const aspnetWorkflowIds = aspnetImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (
    !aspnetWorkflowIds.includes("workflow_article")
    || !aspnetWorkflowIds.includes("workflow_comment")
    || !aspnetWorkflowIds.includes("workflow_profile")
    || !aspnetWorkflowIds.includes("workflow_tag")
    || !aspnetWorkflowIds.includes("workflow_user")
    || !aspnetWorkflowIds.includes("workflow_account")
  ) {
    throw new Error("Expected ASP.NET Core import to feed workflow inference for the RealWorld domain concepts");
  }
  const aspnetImportWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-aspnet-import-"));
  fs.cpSync(aspnetCoreTrialPath, aspnetImportWorkspace, { recursive: true });
  fs.rmSync(path.join(aspnetImportWorkspace, "topogram", "docs", "journeys"), { recursive: true, force: true });
  const aspnetImportedWrite = runWorkflow("import-app", aspnetImportWorkspace, { from: "db,api,ui,workflows", write: true });
  writeGeneratedFiles(path.join(aspnetImportWorkspace, "topogram"), aspnetImportedWrite.files);
  const aspnetReconcile = runWorkflow("reconcile", aspnetImportWorkspace);
  const aspnetBundleSlugs = aspnetReconcile.summary.candidate_model_bundles.map((bundle) => bundle.slug);
  if (
    !aspnetBundleSlugs.includes("article")
    || !aspnetBundleSlugs.includes("comment")
    || !aspnetBundleSlugs.includes("profile")
    || !aspnetBundleSlugs.includes("tag")
    || !aspnetBundleSlugs.includes("user")
    || !aspnetBundleSlugs.includes("account")
  ) {
    throw new Error("Expected ASP.NET Core reconcile to surface the core RealWorld domain bundles");
  }
  assertIncludes(
    stableStringify(aspnetReconcile.summary.suppressed_noise_bundles || []),
    ['"slug": "articlefavorite"', '"slug": "articletag"', '"slug": "followedpeople"'],
    "ASP.NET Core suppressed noise bundles"
  );
  const aspnetJourneyAdoptApply = runWorkflow("reconcile", aspnetImportWorkspace, { adopt: "journeys", write: true });
  assertIncludes(
    stableStringify(aspnetJourneyAdoptApply.summary.promoted_canonical_items),
    [
      '"selector": "journeys"',
      '"bundle": "article"',
      '"canonical_rel_path": "docs/journeys/article_journey.md"',
      '"bundle": "account"',
      '"canonical_rel_path": "docs/journeys/account_journey.md"'
    ],
    "ASP.NET Core reconcile adopt journeys promoted canonical item summary"
  );
  assertIncludes(
    aspnetJourneyAdoptApply.files["candidates/reconcile/report.md"],
    [
      "## Promoted Canonical Items",
      "[article] `article_journey` `candidates/reconcile/model/bundles/article/docs/journeys/article_journey.md` -> `docs/journeys/article_journey.md`"
    ],
    "ASP.NET Core reconcile report promoted canonical items markdown"
  );
  if (!["article", "profile", "user", "comment", "tag", "account"].includes(aspnetReconcile.summary.bundle_priorities[0]?.bundle)) {
    throw new Error("Expected ASP.NET Core reconcile to prioritize a real domain bundle");
  }

  const androidImport = runWorkflow("import-app", pokedexComposeTrialPath, { from: "db,api,ui,workflows" });
  const androidEntityIds = androidImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (!androidEntityIds.includes("entity_pokemon") || !androidEntityIds.includes("entity_pokemon_info")) {
    throw new Error("Expected Android Room import to recover pokemon entities from pokedex-compose");
  }
  if (!androidImport.summary.candidates.api.stacks.includes("retrofit")) {
    throw new Error("Expected Android Retrofit import to identify the retrofit API stack");
  }
  if (!androidImport.summary.candidates.ui.stacks.includes("android_compose")) {
    throw new Error("Expected Android Compose import to identify the android_compose UI stack");
  }
  assertIncludes(
    stableStringify(androidImport.summary.candidates.ui.actions),
    ['"shell_kind": "topbar"'],
    "Android Compose UI semantic candidates"
  );
  const androidCapabilityIds = androidImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (!androidCapabilityIds.includes("cap_list_pokemons") || !androidCapabilityIds.includes("cap_get_pokemon")) {
    throw new Error("Expected Android Retrofit import to recover list/get pokemon capabilities");
  }
  const androidScreenIds = androidImport.summary.candidates.ui.screens.map((screen) => screen.id_hint);
  if (!androidScreenIds.includes("pokemon_list") || !androidScreenIds.includes("pokemon_detail") || !androidScreenIds.includes("settings")) {
    throw new Error("Expected Android Compose import to recover list/detail/settings screens");
  }
  const androidListPokemon = androidImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_pokemons");
  const androidGetPokemon = androidImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_get_pokemon");
  if (
    !androidListPokemon
    || !androidListPokemon.query_params.some((param) => param.name === "limit")
    || !androidListPokemon.query_params.some((param) => param.name === "offset")
  ) {
    throw new Error("Expected Android Retrofit import to recover query params for pokemon listing");
  }
  if (!androidGetPokemon || !androidGetPokemon.path_params.some((param) => param.name === "name")) {
    throw new Error("Expected Android Retrofit import to recover pokemon detail path params");
  }
  const androidWorkflowIds = androidImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (!androidWorkflowIds.includes("workflow_pokemon")) {
    throw new Error("Expected Android import to feed workflow inference for pokemon");
  }
  const androidImportWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-android-import-"));
  fs.cpSync(pokedexComposeTrialPath, androidImportWorkspace, { recursive: true });
  const androidImportedWrite = runWorkflow("import-app", androidImportWorkspace, { from: "db,api,ui,workflows", write: true });
  assertIncludes(
    stableStringify(Object.keys(androidImportedWrite.files).sort()),
    ['"candidates/app/ui/drafts/proj-ui-shared.tg"', '"candidates/app/ui/drafts/proj-ui-web.tg"', '"candidates/app/ui/drafts/README.md"'],
    "Android imported UI draft files"
  );
  assertIncludes(
    androidImportedWrite.files["candidates/app/ui/drafts/proj-ui-shared.tg"],
    ["ui_app_shell", "ui_screens", "ui_navigation"],
    "Android imported shared UI draft"
  );
  writeGeneratedFiles(path.join(androidImportWorkspace, "topogram"), androidImportedWrite.files);
  const androidReconcile = runWorkflow("reconcile", androidImportWorkspace);
  const androidBundleSlugs = androidReconcile.summary.candidate_model_bundles.map((bundle) => bundle.slug);
  if (!androidBundleSlugs.includes("pokemon")) {
    throw new Error("Expected Android reconcile to surface a pokemon bundle from pokedex-compose");
  }
  if (androidReconcile.summary.bundle_priorities[0]?.bundle !== "pokemon") {
    throw new Error("Expected Android reconcile to prioritize the pokemon bundle");
  }

  const iosImport = runWorkflow("import-app", swiftUiTrialPath, { from: "db,api,ui,workflows" });
  const iosEntityIds = iosImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (
    !iosEntityIds.includes("entity_country")
    || !iosEntityIds.includes("entity_country_detail")
    || !iosEntityIds.includes("entity_currency")
  ) {
    throw new Error("Expected SwiftData import to recover country, country_detail, and currency entities");
  }
  if (!iosImport.summary.candidates.api.stacks.includes("swift_webapi")) {
    throw new Error("Expected Swift web repository import to identify the swift_webapi stack");
  }
  if (!iosImport.summary.candidates.ui.stacks.includes("swiftui")) {
    throw new Error("Expected SwiftUI import to identify the swiftui UI stack");
  }
  assertIncludes(
    stableStringify(iosImport.summary.candidates.ui.actions),
    ['"shell_kind"', '"navigation_pattern": "stack_navigation"', '"presentation": "sheet"'],
    "SwiftUI semantic candidates"
  );
  const iosCapabilityIds = iosImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (!iosCapabilityIds.includes("cap_list_countries") || !iosCapabilityIds.includes("cap_get_country_details")) {
    throw new Error("Expected Swift web repository import to recover country list/detail capabilities");
  }
  const iosScreenIds = iosImport.summary.candidates.ui.screens.map((screen) => screen.id_hint);
  if (!iosScreenIds.includes("country_list") || !iosScreenIds.includes("country_detail") || !iosScreenIds.includes("country_flag_modal")) {
    throw new Error("Expected SwiftUI import to recover list/detail/modal country screens");
  }
  const iosWorkflowIds = iosImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (!iosWorkflowIds.includes("workflow_country") || !iosWorkflowIds.includes("workflow_country_details")) {
    throw new Error("Expected SwiftUI import to feed workflow inference for country concepts");
  }
  const iosImportWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-ios-import-"));
  fs.cpSync(swiftUiTrialPath, iosImportWorkspace, { recursive: true });
  const iosImportedWrite = runWorkflow("import-app", iosImportWorkspace, { from: "db,api,ui,workflows", write: true });
  assertIncludes(
    iosImportedWrite.files["candidates/app/ui/drafts/proj-ui-web.tg"],
    ["ui_routes", "ui_web", "present sheet"],
    "iOS imported web UI draft"
  );
  writeGeneratedFiles(path.join(iosImportWorkspace, "topogram"), iosImportedWrite.files);
  const iosReconcile = runWorkflow("reconcile", iosImportWorkspace);
  const iosBundleSlugs = iosReconcile.summary.candidate_model_bundles.map((bundle) => bundle.slug);
  if (!iosBundleSlugs.includes("country") || !iosBundleSlugs.includes("country-detail")) {
    throw new Error("Expected SwiftUI reconcile to surface country and country-detail bundles");
  }
  if (!iosReconcile.files["candidates/reconcile/adoption-status.md"]) {
    throw new Error("Expected reconcile to also emit adoption-status artifacts");
  }

  const uiKitImport = runWorkflow("import-app", uiKitTrialPath, { from: "db,api,ui,workflows" });
  if (!uiKitImport.summary.candidates.ui.stacks.includes("uikit")) {
    throw new Error("Expected UIKit import to identify the uikit UI stack");
  }
  const uiKitScreenIds = uiKitImport.summary.candidates.ui.screens.map((screen) => screen.id_hint);
  if (
    !uiKitScreenIds.includes("browser")
    || !uiKitScreenIds.includes("home")
    || !uiKitScreenIds.includes("setting")
    || !uiKitScreenIds.includes("tracking_protection")
  ) {
    throw new Error("Expected UIKit import to recover browser, home, settings, and tracking protection screens");
  }
  const uiKitActionIds = uiKitImport.summary.candidates.ui.actions.map((action) => action.id_hint);
  if (!uiKitActionIds.includes("uikit_stack_navigation")) {
    throw new Error("Expected UIKit import to recover stack navigation evidence");
  }
  const uiKitImportWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-uikit-import-"));
  fs.cpSync(uiKitTrialPath, uiKitImportWorkspace, { recursive: true });
  const uiKitImportedWrite = runWorkflow("import-app", uiKitImportWorkspace, { from: "db,api,ui,workflows", write: true });
  writeGeneratedFiles(path.join(uiKitImportWorkspace, "topogram"), uiKitImportedWrite.files);
  const uiKitReconcile = runWorkflow("reconcile", uiKitImportWorkspace);
  const uiKitBundleSlugs = uiKitReconcile.summary.candidate_model_bundles.map((bundle) => bundle.slug);
  if (!uiKitBundleSlugs.includes("surface-browser") || !uiKitBundleSlugs.includes("surface-settings")) {
    throw new Error("Expected UIKit reconcile to surface browser and settings bundles");
  }

  const blazorImport = runWorkflow("import-app", eShopOnWebTrialPath, { from: "db,api,ui,workflows" });
  if (!blazorImport.summary.candidates.ui.stacks.includes("blazor")) {
    throw new Error("Expected eShopOnWeb import to identify the blazor UI stack");
  }
  const blazorScreenIds = blazorImport.summary.candidates.ui.screens.map((screen) => screen.id_hint);
  if (
    !blazorScreenIds.includes("catalog_item_list")
    || !blazorScreenIds.includes("catalog_item_create")
    || !blazorScreenIds.includes("catalog_item_edit")
    || !blazorScreenIds.includes("catalog_item_delete")
    || !blazorScreenIds.includes("catalog_item_detail")
    || !blazorScreenIds.includes("account_logout")
  ) {
    throw new Error("Expected Blazor import to recover catalog CRUD and logout screens");
  }
  const blazorActionIds = blazorImport.summary.candidates.ui.actions.map((action) => action.id_hint);
  if (!blazorActionIds.includes("blazor_route_table") || !blazorActionIds.includes("catalog_item_list_cap_list_catalog_items")) {
    throw new Error("Expected Blazor import to recover routing and capability hint evidence");
  }
  const blazorImportWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-blazor-import-"));
  fs.cpSync(eShopOnWebTrialPath, blazorImportWorkspace, { recursive: true });
  const blazorImportedWrite = runWorkflow("import-app", blazorImportWorkspace, { from: "db,api,ui,workflows", write: true });
  writeGeneratedFiles(path.join(blazorImportWorkspace, "topogram"), blazorImportedWrite.files);
  const blazorReconcile = runWorkflow("reconcile", blazorImportWorkspace);
  const blazorBundleSlugs = blazorReconcile.summary.candidate_model_bundles.map((bundle) => bundle.slug);
  if (!blazorBundleSlugs.includes("catalog-item") || !blazorBundleSlugs.includes("surface-account")) {
    throw new Error("Expected Blazor reconcile to surface catalog-item and account bundles");
  }
  if (!blazorImport.summary.candidates.ui.stacks.includes("razor_pages")) {
    throw new Error("Expected eShopOnWeb import to identify the razor_pages UI stack");
  }
  const razorScreenIds = blazorImport.summary.candidates.ui.screens.map((screen) => screen.id_hint);
  if (
    !razorScreenIds.includes("basket")
    || !razorScreenIds.includes("basket_checkout")
    || !razorScreenIds.includes("order_list")
    || !razorScreenIds.includes("account_login")
    || !razorScreenIds.includes("catalog_item_admin")
  ) {
    throw new Error("Expected Razor Pages / MVC import to recover basket, order, account, and admin screens");
  }
  if (!blazorBundleSlugs.includes("basket") || !blazorBundleSlugs.includes("order")) {
    throw new Error("Expected Razor Pages / MVC reconcile to surface basket and order bundles");
  }

  const mauiImport = runWorkflow("import-app", mauiTodoRestTrialPath, { from: "db,api,ui,workflows" });
  const mauiEntityIds = mauiImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (!mauiEntityIds.includes("entity_todo-item")) {
    throw new Error("Expected MAUI/.NET model import to recover the todo item entity from TodoREST");
  }
  if (!mauiImport.summary.candidates.api.stacks.includes("aspnet_core")) {
    throw new Error("Expected TodoREST import to identify the aspnet_core API stack");
  }
  if (!mauiImport.summary.candidates.ui.stacks.includes("maui_xaml")) {
    throw new Error("Expected TodoREST import to identify the maui_xaml UI stack");
  }
  const mauiCapabilityIds = mauiImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !mauiCapabilityIds.includes("cap_list_todo_items")
    || !mauiCapabilityIds.includes("cap_create_todo_item")
    || !mauiCapabilityIds.includes("cap_update_todo_item")
    || !mauiCapabilityIds.includes("cap_delete_todo_item")
  ) {
    throw new Error("Expected TodoREST import to recover list/create/update/delete todo capabilities");
  }
  const mauiScreenIds = mauiImport.summary.candidates.ui.screens.map((screen) => screen.id_hint);
  if (!mauiScreenIds.includes("todo_item") || !mauiScreenIds.includes("todo_list")) {
    throw new Error("Expected TodoREST MAUI import to recover todo list and item screens");
  }
  const mauiWorkflowIds = mauiImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (!mauiWorkflowIds.includes("workflow_todo-item")) {
    throw new Error("Expected TodoREST import to feed workflow inference for todo items");
  }

  const springBootImport = runWorkflow("import-app", springBootRealworldTrialPath, { from: "db,api,ui,workflows" });
  const springBootEntityIds = springBootImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (!springBootEntityIds.includes("entity_article") || !springBootEntityIds.includes("entity_comment") || !springBootEntityIds.includes("entity_tag") || !springBootEntityIds.includes("entity_user")) {
    throw new Error("Expected Spring Boot RealWorld import to recover article/comment/tag/user entities");
  }
  const springBootCapabilityIds = springBootImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !springBootCapabilityIds.includes("cap_create_article")
    || !springBootCapabilityIds.includes("cap_favorite_article")
    || !springBootCapabilityIds.includes("cap_unfavorite_article")
    || !springBootCapabilityIds.includes("cap_create_comment")
    || !springBootCapabilityIds.includes("cap_follow_profile")
    || !springBootCapabilityIds.includes("cap_sign_in_account")
  ) {
    throw new Error("Expected Spring Boot RealWorld import to recover curated Spring MVC capability surfaces");
  }

  const cleanArchitectureImport = runWorkflow("import-app", cleanArchitectureDeliveryTrialPath, { from: "db,api,ui,workflows" });
  const cleanArchitectureEntityIds = cleanArchitectureImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (
    !cleanArchitectureEntityIds.includes("entity_customer")
    || !cleanArchitectureEntityIds.includes("entity_order")
    || !cleanArchitectureEntityIds.includes("entity_product")
    || !cleanArchitectureEntityIds.includes("entity_store")
    || !cleanArchitectureEntityIds.includes("entity_cousine")
  ) {
    throw new Error("Expected clean-architecture delivery import to recover customer/order/product/store/cousine entities");
  }
  const cleanArchitectureCapabilityIds = cleanArchitectureImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !cleanArchitectureCapabilityIds.includes("cap_create_order")
    || !cleanArchitectureCapabilityIds.includes("cap_pay_order")
    || !cleanArchitectureCapabilityIds.includes("cap_delivery_order")
    || !cleanArchitectureCapabilityIds.includes("cap_search_products")
    || !cleanArchitectureCapabilityIds.includes("cap_search_stores")
    || !cleanArchitectureCapabilityIds.includes("cap_sign_in_account")
  ) {
    throw new Error("Expected clean-architecture delivery import to recover order/search/auth capability surfaces");
  }

  const quarkusImport = runWorkflow("import-app", quarkusTrialPath, { from: "db,api,ui,workflows" });
  if (!quarkusImport.summary.candidates.api.stacks.includes("jaxrs")) {
    throw new Error("Expected Quarkus import to identify the jaxrs API stack");
  }
  const quarkusEntityIds = quarkusImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (
    !quarkusEntityIds.includes("entity_article")
    || !quarkusEntityIds.includes("entity_comment")
    || !quarkusEntityIds.includes("entity_tag")
    || !quarkusEntityIds.includes("entity_user")
  ) {
    throw new Error("Expected Quarkus import to recover article/comment/tag/user entities");
  }
  const quarkusCapabilityIds = quarkusImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !quarkusCapabilityIds.includes("cap_create_article")
    || !quarkusCapabilityIds.includes("cap_favorite_article")
    || !quarkusCapabilityIds.includes("cap_create_comment")
    || !quarkusCapabilityIds.includes("cap_follow_profile")
    || !quarkusCapabilityIds.includes("cap_list_tags")
    || !quarkusCapabilityIds.includes("cap_sign_in_account")
  ) {
    throw new Error("Expected Quarkus import to recover curated RealWorld capability surfaces");
  }

  const micronautImport = runWorkflow("import-app", micronautTrialPath, { from: "db,api,ui,workflows" });
  if (!micronautImport.summary.candidates.api.stacks.includes("micronaut")) {
    throw new Error("Expected Micronaut import to identify the micronaut API stack");
  }
  const micronautEntityIds = micronautImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (
    !micronautEntityIds.includes("entity_article")
    || !micronautEntityIds.includes("entity_comment")
    || !micronautEntityIds.includes("entity_tag")
    || !micronautEntityIds.includes("entity_user")
  ) {
    throw new Error("Expected Micronaut import to recover article/comment/tag/user entities");
  }
  const micronautCapabilityIds = micronautImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !micronautCapabilityIds.includes("cap_create_article")
    || !micronautCapabilityIds.includes("cap_feed_article")
    || !micronautCapabilityIds.includes("cap_create_comment")
    || !micronautCapabilityIds.includes("cap_follow_profile")
    || !micronautCapabilityIds.includes("cap_list_tags")
    || !micronautCapabilityIds.includes("cap_sign_in_account")
  ) {
    throw new Error("Expected Micronaut import to recover curated RealWorld capability surfaces");
  }

  const jakartaEeImport = runWorkflow("import-app", jakartaEeTrialPath, { from: "db,api,ui,workflows" });
  if (!jakartaEeImport.summary.candidates.api.stacks.includes("jaxrs")) {
    throw new Error("Expected Jakarta EE import to identify the jaxrs API stack");
  }
  const jakartaEeEntityIds = jakartaEeImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (!jakartaEeEntityIds.includes("entity_task")) {
    throw new Error("Expected Jakarta EE import to recover the task entity");
  }
  const jakartaEeCapabilityIds = jakartaEeImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !jakartaEeCapabilityIds.includes("cap_list_tasks")
    || !jakartaEeCapabilityIds.includes("cap_create_task")
    || !jakartaEeCapabilityIds.includes("cap_get_task")
    || !jakartaEeCapabilityIds.includes("cap_update_task")
    || !jakartaEeCapabilityIds.includes("cap_update_task_status")
    || !jakartaEeCapabilityIds.includes("cap_delete_task")
  ) {
    throw new Error("Expected Jakarta EE import to recover the full task CRUD and status capability surface");
  }

  assertConfirmedProofStatus(path.join(railsTrialPath, "topogram"), "Rails confirmed proof");
  assertConfirmedProofStatus(path.join(djangoTrialPath, "topogram"), "Django confirmed proof");
  assertConfirmedProofStatus(path.join(springTrialPath, "topogram"), "Spring confirmed proof");
  assertConfirmedProofStatus(path.join(springBootRealworldTrialPath, "topogram"), "Spring Boot RealWorld confirmed proof");
  assertConfirmedProofStatus(path.join(cleanArchitectureDeliveryTrialPath, "topogram"), "Java clean architecture confirmed proof");
  assertConfirmedProofStatus(path.join(quarkusTrialPath, "topogram"), "Quarkus confirmed proof");
  assertConfirmedProofStatus(path.join(micronautTrialPath, "topogram"), "Micronaut confirmed proof");
  assertConfirmedProofStatus(path.join(jakartaEeTrialPath, "topogram"), "Jakarta EE confirmed proof");
  assertConfirmedProofStatus(path.join(aspnetCoreTrialPath, "topogram"), "ASP.NET Core confirmed proof");
  assertConfirmedProofStatus(path.join(pokedexComposeTrialPath, "topogram"), "Android confirmed proof");
  assertConfirmedProofStatus(path.join(swiftUiTrialPath, "topogram"), "iOS confirmed proof");
  assertConfirmedProofStatus(path.join(mauiTodoRestTrialPath, "topogram"), "MAUI confirmed proof");
  assertConfirmedProofStatus(path.join(fastifyTrialPath, "topogram"), "Fastify confirmed proof");
  assertConfirmedProofStatus(path.join(flutterGoRestTrialPath, "topogram"), "Flutter confirmed proof");
  assertConfirmedProofStatus(path.join(reactNativeTrialPath, "topogram"), "React Native confirmed proof");
  assertConfirmedProofStatus(path.join(workspaceRoot, "..", "trials", "prisma-nextjs-auth-starter", "topogram"), "Prisma Next.js confirmed proof");
  assertConfirmedProofStatus(path.join(supabaseExpressTrialPath, "topogram"), "Supabase Express confirmed proof");
  assertConfirmedProofStatus(path.join(trpcTrialPath, "topogram"), "tRPC Next Prisma confirmed proof");
  assertConfirmedProofStatus(path.join(graphqlSdlTrialPath, "topogram"), "GraphQL SDL confirmed proof");
  assertConfirmedProofStatus(path.join(nexusGraphqlTrialPath, "topogram"), "GraphQL Nexus confirmed proof");
  assertConfirmedProofStatus(path.join(nestGraphqlTrialPath, "topogram"), "Nest GraphQL source-only confirmed proof");
  assertConfirmedProofStatus(path.join(nextGraphqlTrialPath, "topogram"), "Next.js GraphQL source-only confirmed proof");
  assertConfirmedProofStatus(path.join(nexusGraphqlTrialPath, "topogram"), "GraphQL Nexus source-only confirmed proof");

  const flutterImport = runWorkflow("import-app", flutterGoRestTrialPath, { from: "db,api,ui,workflows" });
  const flutterEntityIds = flutterImport.summary.candidates.db.entities.map((entity) => entity.id_hint);
  if (
    !flutterEntityIds.includes("entity_user")
    || !flutterEntityIds.includes("entity_post")
    || !flutterEntityIds.includes("entity_todo")
    || !flutterEntityIds.includes("entity_comment")
  ) {
    throw new Error("Expected Flutter entity import to recover user/post/todo/comment entities");
  }
  if (!flutterImport.summary.candidates.api.stacks.includes("flutter_dio")) {
    throw new Error("Expected Flutter Dio import to identify the flutter_dio API stack");
  }
  if (!flutterImport.summary.candidates.ui.stacks.includes("flutter_material")) {
    throw new Error("Expected Flutter screen import to identify the flutter_material UI stack");
  }
  const flutterCapabilityIds = flutterImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (
    !flutterCapabilityIds.includes("cap_list_users")
    || !flutterCapabilityIds.includes("cap_create_post")
    || !flutterCapabilityIds.includes("cap_update_todo")
    || !flutterCapabilityIds.includes("cap_delete_comment")
  ) {
    throw new Error("Expected Flutter Dio import to recover user/post/todo/comment CRUD capabilities");
  }
  const flutterScreenIds = flutterImport.summary.candidates.ui.screens.map((screen) => screen.id_hint);
  if (
    !flutterScreenIds.includes("user_list")
    || !flutterScreenIds.includes("post_list")
    || !flutterScreenIds.includes("post_detail")
    || !flutterScreenIds.includes("create_post")
    || !flutterScreenIds.includes("todo_list")
  ) {
    throw new Error("Expected Flutter screen import to recover the main user/post/todo screens");
  }
  const flutterWorkflowIds = flutterImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (
    !flutterWorkflowIds.includes("workflow_user")
    || !flutterWorkflowIds.includes("workflow_post")
    || !flutterWorkflowIds.includes("workflow_todo")
    || !flutterWorkflowIds.includes("workflow_comment")
  ) {
    throw new Error("Expected Flutter import to feed workflow inference for the core feature bundles");
  }
  const flutterImportWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-flutter-import-"));
  fs.cpSync(flutterGoRestTrialPath, flutterImportWorkspace, { recursive: true });
  const flutterImportedWrite = runWorkflow("import-app", flutterImportWorkspace, { from: "db,api,ui,workflows", write: true });
  writeGeneratedFiles(path.join(flutterImportWorkspace, "topogram"), flutterImportedWrite.files);
  const flutterReconcileWrite = runWorkflow("reconcile", flutterImportWorkspace);
  writeGeneratedFiles(path.join(flutterImportWorkspace, "topogram"), flutterReconcileWrite.files);
  let flutterAdopt = runWorkflow("reconcile", flutterImportWorkspace, { adopt: "bundle-review:todo", write: true });
  writeGeneratedFiles(path.join(flutterImportWorkspace, "topogram"), flutterAdopt.files);
  flutterAdopt = runWorkflow("reconcile", flutterImportWorkspace, { adopt: "bundle:todo", write: true });
  writeGeneratedFiles(path.join(flutterImportWorkspace, "topogram"), flutterAdopt.files);
  flutterAdopt = runWorkflow("reconcile", flutterImportWorkspace, { adopt: "from-plan", write: true });
  writeGeneratedFiles(path.join(flutterImportWorkspace, "topogram"), flutterAdopt.files);
  const flutterReconcileAfterAdopt = runWorkflow("reconcile", flutterImportWorkspace);
  const flutterTodoPriority = flutterReconcileAfterAdopt.summary.bundle_priorities.find((bundle) => bundle.bundle === "todo");
  if (!flutterTodoPriority || !flutterTodoPriority.is_complete || flutterTodoPriority.pending_items !== 0) {
    throw new Error("Expected Flutter reconcile to preserve applied todo adoption state after rebuilding the plan");
  }
  const flutterPlanPath = path.join(flutterImportWorkspace, "topogram", "candidates", "reconcile", "adoption-plan.json");
  writeGeneratedFiles(path.join(flutterImportWorkspace, "topogram"), flutterReconcileAfterAdopt.files);
  const flutterPlan = readJson(flutterPlanPath);
  const flutterEntityPaths = flutterPlan.items
    .filter((item) => item.kind === "entity" || item.kind === "enum")
    .map((item) => item.canonical_rel_path);
  if (flutterEntityPaths.includes("entities/post.tg") || flutterEntityPaths.includes("entities/todo.tg")) {
    throw new Error("Expected Flutter reconcile adoption plan to avoid legacy slug-based entity paths");
  }
  if (flutterEntityPaths.includes("enums/enum-enum-user-gender.tg")) {
    throw new Error("Expected Flutter reconcile adoption plan to normalize enum canonical paths");
  }

  const graphqlSdlImport = runWorkflow("import-app", graphqlSdlTrialPath, { from: "db,api,ui,workflows" });
  const graphqlCapabilities = graphqlSdlImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (!graphqlCapabilities.includes("cap_list_posts") || !graphqlCapabilities.includes("cap_get_post") || !graphqlCapabilities.includes("cap_register_user")) {
    throw new Error("Expected GraphQL SDL import to recover post query capabilities and user registration");
  }
  if (!graphqlSdlImport.summary.candidates.api.stacks.includes("graphql_sdl")) {
    throw new Error("Expected GraphQL SDL import to identify the GraphQL SDL stack");
  }
  const graphqlCreatePost = graphqlSdlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_post");
  const graphqlListPosts = graphqlSdlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_posts");
  const graphqlRegisterUser = graphqlSdlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_register_user");
  if (!graphqlCreatePost || !graphqlCreatePost.input_fields.includes("title") || !graphqlCreatePost.input_fields.includes("content")) {
    throw new Error("Expected GraphQL SDL import to flatten input object fields for mutations");
  }
  if (!graphqlListPosts || !graphqlListPosts.output_fields.includes("id") || !graphqlListPosts.output_fields.includes("title") || !graphqlListPosts.output_fields.includes("published")) {
    throw new Error("Expected GraphQL SDL import to recover output fields from SDL return types");
  }
  if (!graphqlRegisterUser || graphqlRegisterUser.target_state !== "registered") {
    throw new Error("Expected GraphQL SDL import to infer target state hints for registration mutations");
  }
  const graphqlWorkflowIds = graphqlSdlImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (!graphqlWorkflowIds.includes("workflow_post") || !graphqlWorkflowIds.includes("workflow_user")) {
    throw new Error("Expected GraphQL SDL capabilities to feed workflow inference for post and user");
  }

  const nestGraphqlSourceOnlyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-nest-graphql-source-only-"));
  fs.cpSync(nestGraphqlTrialPath, nestGraphqlSourceOnlyRoot, { recursive: true });
  fs.rmSync(path.join(nestGraphqlSourceOnlyRoot, "src", "schema.gql"), { force: true });
  const nestGraphqlImport = runWorkflow("import-app", nestGraphqlSourceOnlyRoot, { from: "db,api,ui,workflows" });
  const nestGraphqlCapabilities = nestGraphqlImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (!nestGraphqlCapabilities.includes("cap_list_posts") || !nestGraphqlCapabilities.includes("cap_get_post") || !nestGraphqlCapabilities.includes("cap_register_user")) {
    throw new Error("Expected GraphQL code-first import to recover post query capabilities and user registration from Nest resolvers");
  }
  if (!nestGraphqlImport.summary.candidates.api.stacks.includes("graphql_code_first")) {
    throw new Error("Expected source-only Nest GraphQL import to identify the graphql_code_first stack");
  }
  const nestCreatePost = nestGraphqlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_post");
  const nestListUsers = nestGraphqlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_users");
  if (!nestCreatePost || !nestCreatePost.input_fields.includes("title") || !nestCreatePost.input_fields.includes("content") || !nestCreatePost.input_fields.includes("authorEmail")) {
    throw new Error("Expected GraphQL code-first import to flatten Nest input types and scalar args");
  }
  if (!nestListUsers || !nestListUsers.output_fields.includes("email") || !nestListUsers.output_fields.includes("posts")) {
    throw new Error("Expected GraphQL code-first import to recover output fields from Nest object types");
  }
  const nestWorkflowIds = nestGraphqlImport.summary.candidates.workflows.workflows.map((workflow) => workflow.id_hint);
  if (!nestWorkflowIds.includes("workflow_post") || !nestWorkflowIds.includes("workflow_user")) {
    throw new Error("Expected GraphQL code-first import to feed workflow inference for post and user");
  }

  const nextGraphqlSourceOnlyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-next-graphql-source-only-"));
  fs.cpSync(nextGraphqlTrialPath, nextGraphqlSourceOnlyRoot, { recursive: true });
  fs.rmSync(path.join(nextGraphqlSourceOnlyRoot, "generated", "schema.graphql"), { force: true });
  const nextGraphqlImport = runWorkflow("import-app", nextGraphqlSourceOnlyRoot, { from: "db,api,ui,workflows" });
  const nextGraphqlCapabilities = nextGraphqlImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (!nextGraphqlCapabilities.includes("cap_list_posts") || !nextGraphqlCapabilities.includes("cap_get_post") || !nextGraphqlCapabilities.includes("cap_register_user")) {
    throw new Error("Expected source-only Pothos GraphQL import to recover post and user capabilities without generated SDL");
  }
  if (!nextGraphqlImport.summary.candidates.api.stacks.includes("graphql_code_first")) {
    throw new Error("Expected source-only Pothos import to identify the graphql_code_first stack");
  }
  const nextGraphqlCreatePost = nextGraphqlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_post");
  const nextGraphqlListPosts = nextGraphqlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_posts");
  if (!nextGraphqlCreatePost || !nextGraphqlCreatePost.input_fields.includes("title") || !nextGraphqlCreatePost.input_fields.includes("content") || !nextGraphqlCreatePost.input_fields.includes("authorEmail")) {
    throw new Error("Expected source-only Pothos import to recover mutation input fields");
  }
  if (!nextGraphqlListPosts || !nextGraphqlListPosts.output_fields.includes("id") || !nextGraphqlListPosts.output_fields.includes("title") || !nextGraphqlListPosts.output_fields.includes("published")) {
    throw new Error("Expected source-only Pothos import to recover object output fields");
  }

  const nexusGraphqlSourceOnlyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-nexus-graphql-source-only-"));
  fs.cpSync(nexusGraphqlTrialPath, nexusGraphqlSourceOnlyRoot, { recursive: true });
  fs.rmSync(path.join(nexusGraphqlSourceOnlyRoot, "schema.graphql"), { force: true });
  const nexusGraphqlImport = runWorkflow("import-app", nexusGraphqlSourceOnlyRoot, { from: "db,api,ui,workflows" });
  const nexusGraphqlCapabilities = nexusGraphqlImport.summary.candidates.api.capabilities.map((capability) => capability.id_hint);
  if (!nexusGraphqlCapabilities.includes("cap_list_posts") || !nexusGraphqlCapabilities.includes("cap_get_post") || !nexusGraphqlCapabilities.includes("cap_register_user")) {
    throw new Error("Expected source-only Nexus GraphQL import to recover post and user capabilities without generated SDL");
  }
  if (!nexusGraphqlImport.summary.candidates.api.stacks.includes("graphql_code_first")) {
    throw new Error("Expected source-only Nexus import to identify the graphql_code_first stack");
  }
  const nexusGraphqlCreatePost = nexusGraphqlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_create_post");
  const nexusGraphqlListPosts = nexusGraphqlImport.summary.candidates.api.capabilities.find((capability) => capability.id_hint === "cap_list_posts");
  if (!nexusGraphqlCreatePost || !nexusGraphqlCreatePost.input_fields.includes("title") || !nexusGraphqlCreatePost.input_fields.includes("content") || !nexusGraphqlCreatePost.input_fields.includes("authorEmail")) {
    throw new Error("Expected source-only Nexus import to recover mutation input fields");
  }
  if (!nexusGraphqlListPosts || !nexusGraphqlListPosts.output_fields.includes("id") || !nexusGraphqlListPosts.output_fields.includes("title") || !nexusGraphqlListPosts.output_fields.includes("published")) {
    throw new Error("Expected source-only Nexus import to recover object output fields");
  }

  const invalidImportTrackRun = runCli([prismaOpenApiPath, "--workflow", "import-app", "--from", "nope"]);
  if (invalidImportTrackRun.status === 0) {
    throw new Error("Expected import-app with an invalid --from track to fail");
  }
  assertIncludes(invalidImportTrackRun.stderr || invalidImportTrackRun.stdout, ["Unsupported import track"], "Invalid import track");

  const explicitImportAppRun = runCli(["import", "app", prismaOpenApiPath, "--from", "db,api"]);
  if (explicitImportAppRun.status !== 0) {
    throw new Error(`Expected explicit import app CLI to succeed:\n${explicitImportAppRun.stderr || explicitImportAppRun.stdout}`);
  }
  assertIncludes(explicitImportAppRun.stdout, ['"tracks"', '"entity_task"', '"cap_create_task"'], "Explicit import app CLI");

  const explicitImportDocsRun = runCli(["import", "docs", issuesPath]);
  if (explicitImportDocsRun.status !== 0) {
    throw new Error(`Expected explicit import docs CLI to succeed:\n${explicitImportDocsRun.stderr || explicitImportDocsRun.stdout}`);
  }
  assertIncludes(explicitImportDocsRun.stdout, ['"type": "scan_docs_report"'], "Explicit import docs CLI");

  const explicitReportGapsRun = runCli(["report", "gaps", incompleteImportTopogramPath]);
  if (explicitReportGapsRun.status !== 0) {
    throw new Error(`Expected explicit report gaps CLI to succeed:\n${explicitReportGapsRun.stderr || explicitReportGapsRun.stdout}`);
  }
  assertIncludes(explicitReportGapsRun.stdout, ['"type": "gap_report"'], "Explicit report gaps CLI");

  const invalidAdoptSelectorRun = runCli([incompleteImportTopogramPath, "--workflow", "reconcile", "--adopt", "nope"]);
  if (invalidAdoptSelectorRun.status === 0) {
    throw new Error("Expected reconcile with an invalid --adopt selector to fail");
  }
  assertIncludes(invalidAdoptSelectorRun.stderr || invalidAdoptSelectorRun.stdout, ["Unsupported adopt selector"], "Invalid adopt selector");

  const explicitReconcileRun = runCli(["reconcile", incompleteImportTopogramPath]);
  if (explicitReconcileRun.status !== 0) {
    throw new Error(`Expected explicit reconcile CLI to succeed:\n${explicitReconcileRun.stderr || explicitReconcileRun.stdout}`);
  }
  assertIncludes(explicitReconcileRun.stdout, ['"type": "reconcile_report"'], "Explicit reconcile CLI");

  const explicitAdoptionStatusRun = runCli(["adoption", "status", incompleteImportTopogramPath]);
  if (explicitAdoptionStatusRun.status !== 0) {
    throw new Error(`Expected explicit adoption status CLI to succeed:\n${explicitAdoptionStatusRun.stderr || explicitAdoptionStatusRun.stdout}`);
  }
  assertIncludes(explicitAdoptionStatusRun.stdout, ['"type": "adoption_status"'], "Explicit adoption status CLI");
  const authHintsUsageRun = runCli([]);
  if (authHintsUsageRun.status === 0) {
    throw new Error("Expected bare CLI invocation to print usage and fail");
  }
  assertIncludes(authHintsUsageRun.stdout, ["query auth-hints <path>"], "CLI usage auth-hints");
  assertIncludes(authHintsUsageRun.stdout, ["query auth-review-packet <path> --bundle <slug>"], "CLI usage auth-review-packet");
  assertIncludes(authHintsUsageRun.stdout, ["query single-agent-plan <path> --mode <id>"], "CLI usage single-agent-plan");
  assertIncludes(authHintsUsageRun.stdout, ["query multi-agent-plan <path> --mode import-adopt"], "CLI usage multi-agent-plan");
  assertIncludes(authHintsUsageRun.stdout, ["query work-packet <path> --mode import-adopt --lane <id>"], "CLI usage work-packet");
  assertIncludes(authHintsUsageRun.stdout, ["query lane-status <path> --mode import-adopt"], "CLI usage lane-status");
  assertIncludes(authHintsUsageRun.stdout, ["query handoff-status <path> --mode import-adopt"], "CLI usage handoff-status");
  const missingAuthHintsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-query-auth-hints-"));
  fs.cpSync(todoPath, path.join(missingAuthHintsRoot, "topogram"), { recursive: true });
  fs.rmSync(path.join(missingAuthHintsRoot, "topogram", "candidates", "reconcile"), { recursive: true, force: true });
  const missingAuthHintsRun = runCli(["query", "auth-hints", path.join(missingAuthHintsRoot, "topogram")]);
  if (missingAuthHintsRun.status === 0) {
    throw new Error("Expected query auth-hints without reconcile artifacts to fail");
  }
  assertIncludes(
    missingAuthHintsRun.stderr || missingAuthHintsRun.stdout,
    ["No reconcile auth-hint artifacts found", "Run 'node ./src/cli.js reconcile"],
    "Missing auth-hints CLI error"
  );
  const missingAuthReviewPacketRun = runCli(["query", "auth-review-packet", path.join(missingAuthHintsRoot, "topogram"), "--bundle", "article"]);
  if (missingAuthReviewPacketRun.status === 0) {
    throw new Error("Expected query auth-review-packet without reconcile artifacts to fail");
  }
  assertIncludes(
    missingAuthReviewPacketRun.stderr || missingAuthReviewPacketRun.stdout,
    ["No reconcile auth-review artifacts found", "Run 'node ./src/cli.js reconcile"],
    "Missing auth-review-packet CLI error"
  );
  const missingSingleAgentPlanRun = runCli(["query", "single-agent-plan", path.join(missingAuthHintsRoot, "topogram"), "--mode", "import-adopt"]);
  if (missingSingleAgentPlanRun.status !== 0) {
    throw new Error(`Expected query single-agent-plan without reconcile artifacts to succeed:\n${missingSingleAgentPlanRun.stderr || missingSingleAgentPlanRun.stdout}`);
  }
  assertIncludes(
    missingSingleAgentPlanRun.stdout,
    ['"type": "single_agent_plan"', '"mode": "import-adopt"', '"kind": "missing_plan"', '"plan_present": false'],
    "Single-agent plan missing reconcile guidance"
  );
  const missingMultiAgentPlanRun = runCli(["query", "multi-agent-plan", path.join(missingAuthHintsRoot, "topogram"), "--mode", "import-adopt"]);
  if (missingMultiAgentPlanRun.status === 0) {
    throw new Error("Expected query multi-agent-plan without reconcile artifacts to fail");
  }
  assertIncludes(
    missingMultiAgentPlanRun.stderr || missingMultiAgentPlanRun.stdout,
    ["No reconcile multi-agent artifacts found", "Run 'node ./src/cli.js reconcile"],
    "Missing multi-agent-plan CLI error"
  );
  const missingWorkPacketRun = runCli(["query", "work-packet", path.join(missingAuthHintsRoot, "topogram"), "--mode", "import-adopt", "--lane", "bundle_reviewer.task"]);
  if (missingWorkPacketRun.status === 0) {
    throw new Error("Expected query work-packet without reconcile artifacts to fail");
  }
  assertIncludes(
    missingWorkPacketRun.stderr || missingWorkPacketRun.stdout,
    ["No reconcile work-packet artifacts found", "Run 'node ./src/cli.js reconcile"],
    "Missing work-packet CLI error"
  );
  const missingLaneStatusRun = runCli(["query", "lane-status", path.join(missingAuthHintsRoot, "topogram"), "--mode", "import-adopt"]);
  if (missingLaneStatusRun.status === 0) {
    throw new Error("Expected query lane-status without reconcile artifacts to fail");
  }
  assertIncludes(
    missingLaneStatusRun.stderr || missingLaneStatusRun.stdout,
    ["No reconcile lane-status artifacts found", "Run 'node ./src/cli.js reconcile"],
    "Missing lane-status CLI error"
  );
  const missingHandoffStatusRun = runCli(["query", "handoff-status", path.join(missingAuthHintsRoot, "topogram"), "--mode", "import-adopt"]);
  if (missingHandoffStatusRun.status === 0) {
    throw new Error("Expected query handoff-status without reconcile artifacts to fail");
  }
  assertIncludes(
    missingHandoffStatusRun.stderr || missingHandoffStatusRun.stdout,
    ["No reconcile handoff-status artifacts found", "Run 'node ./src/cli.js reconcile"],
    "Missing handoff-status CLI error"
  );

  const incompleteImportReport = runWorkflow("report-gaps", incompleteImportTopogramPath);
  assertIncludes(
    stableStringify(incompleteImportReport.summary),
    ['"priority"', '"task_priority"', '"cap_update_task"', '"field_mismatches"', '"ui_vs_topogram"', '"workflows_vs_topogram"'],
    "Incomplete import gap report"
  );
  assertIncludes(
    stableStringify(incompleteImportReport.summary.api_vs_topogram.field_mismatches),
    ['"cap_create_task"', '"priority"'],
    "Incomplete import API field mismatch report"
  );

  const endpointMatchTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-import-endpoint-match-"));
  const endpointMatchExampleRoot = path.join(endpointMatchTempRoot, "topogram");
  fs.cpSync(incompleteImportTopogramPath, endpointMatchExampleRoot, { recursive: true });
  const endpointApiCandidatesPath = path.join(endpointMatchExampleRoot, "candidates", "app", "api");
  fs.mkdirSync(endpointApiCandidatesPath, { recursive: true });
  fs.writeFileSync(
    path.join(endpointApiCandidatesPath, "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "candidate_post_tasks",
          label: "POST /tasks",
          confidence: "high",
          source_kind: "openapi",
          source_of_truth: "imported",
          provenance: ["fixture#POST /tasks"],
          endpoint: {
            method: "POST",
            path: "/tasks"
          },
          input_fields: ["title", "priority"],
          output_fields: ["id", "title", "priority"],
          path_params: [],
          query_params: []
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  const endpointMatchedReport = runWorkflow("report-gaps", endpointMatchExampleRoot);
  if (endpointMatchedReport.summary.api_vs_topogram.capabilities_missing_in_topogram.includes("candidate_post_tasks")) {
    throw new Error("Expected API gap matching to reconcile imported endpoints by method/path when ids differ");
  }
  assertIncludes(
    stableStringify(endpointMatchedReport.summary.api_vs_topogram.field_mismatches),
    ['"cap_create_task"', '"candidate_post_tasks"', '"priority"'],
    "Endpoint-based API gap matching"
  );

  const issuesGenerateDocs = runWorkflow("generate-docs", issuesPath);
  if (!issuesGenerateDocs.files["glossary/issue.md"] || !issuesGenerateDocs.files["docs-index.json"]) {
    throw new Error("Expected generate-docs workflow to emit glossary docs and a docs index");
  }

  const todoGenerateJourneys = runWorkflow("generate-journeys", todoPath);
  assertIncludes(
    stableStringify(todoGenerateJourneys.summary.skipped_entities),
    ['"entity_id": "entity_task"', '"reason": "canonical_journey_exists"'],
    "Generate-journeys skips entity coverage with canonical journeys"
  );

  const issuesJourneyDraftWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generate-journeys-"));
  const issuesJourneyDraftRoot = path.join(issuesJourneyDraftWorkspace, "topogram");
  fs.cpSync(issuesPath, issuesJourneyDraftRoot, { recursive: true });
  fs.rmSync(path.join(issuesJourneyDraftRoot, "docs", "journeys"), { recursive: true, force: true });
  const issuesGenerateJourneys = runWorkflow("generate-journeys", issuesJourneyDraftRoot);
  if (
    !issuesGenerateJourneys.files["candidates/docs/journeys/issue-creation-and-discovery.md"] ||
    !issuesGenerateJourneys.files["candidates/docs/journeys/issue-update-and-lifecycle.md"]
  ) {
    throw new Error("Expected generate-journeys workflow to emit draft journey markdown for uncovered issue flows");
  }
  assertIncludes(
    issuesGenerateJourneys.files["candidates/docs/journeys/issue-creation-and-discovery.md"],
    [
      "kind: journey",
      "status: inferred",
      "review_required: true",
      "cap_create_issue",
      "cap_list_issues",
      "Issue"
    ],
    "Generated issue creation journey draft"
  );
  assertIncludes(
    issuesGenerateJourneys.files["candidates/docs/journeys/issue-update-and-lifecycle.md"],
    [
      "cap_update_issue",
      "cap_close_issue",
      "## Happy Path",
      "## Alternate Paths"
    ],
    "Generated issue lifecycle journey draft"
  );
  assertIncludes(
    issuesGenerateJourneys.files["candidates/docs/journeys/import-report.md"],
    ["# Journey Draft Report", "`issue_creation_and_discovery`", "`issue_update_and_lifecycle`"],
    "Journey draft report"
  );

  const issuesRefreshDocs = runWorkflow("refresh-docs", issuesPath);
  if (issuesRefreshDocs.summary.missing.length === 0) {
    throw new Error("Expected refresh-docs workflow to report missing canonical docs for Issues");
  }

  const issuesGapReport = runWorkflow("report-gaps", issuesPath);
  assertIncludes(
    stableStringify(issuesGapReport.summary),
    ['"board"', '"issue"', '"user"', '"cap_close_issue"'],
    "Issues report-gaps summary"
  );

  const actorRoleGapTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-gap-actors-roles-"));
  const actorRoleGapTopogramRoot = path.join(actorRoleGapTempRoot, "topogram");
  fs.cpSync(contentApprovalPath, actorRoleGapTopogramRoot, { recursive: true });
  fs.writeFileSync(
    path.join(actorRoleGapTopogramRoot, "docs", "journeys", "article-resubmission-after-review.md"),
    readText(path.join(actorRoleGapTopogramRoot, "docs", "journeys", "article-resubmission-after-review.md"))
      .replace(/related_actors:\n(?:  - .+\n)+/m, "")
      .replace(/related_roles:\n(?:  - .+\n)+/m, "")
      .replace(/related_capabilities:\n(?:  - .+\n)+/m, "")
      .replace(/related_rules:\n(?:  - .+\n)+/m, "")
      .replace(/related_workflows:\n(?:  - .+\n)+/m, "")
  );
  fs.writeFileSync(
    path.join(actorRoleGapTopogramRoot, "docs", "workflows", "article-review.md"),
    readText(path.join(actorRoleGapTopogramRoot, "docs", "workflows", "article-review.md"))
      .replace(/related_capabilities:\n(?:  - .+\n)+/m, "")
  );
  fs.writeFileSync(
    path.join(actorRoleGapTopogramRoot, "capabilities", "cap-update-article.tg"),
    readText(path.join(actorRoleGapTopogramRoot, "capabilities", "cap-update-article.tg"))
      .replace(/  roles \[role_author\]\n/m, "")
  );
  fs.mkdirSync(path.join(actorRoleGapTopogramRoot, "candidates", "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(actorRoleGapTopogramRoot, "candidates", "docs", "import-report.json"),
    `${stableStringify({
      type: "docs_import_report",
      candidate_docs: [
        {
          id: "article_resubmission_after_review",
          kind: "journey",
          confidence: "high",
          summary: "An author resubmits an article after review feedback with preserved revision context and a clearer recovery path.",
          success_outcome: "The author updates the article, sees the prior revision request, and returns the article to submitted review without losing context.",
          actors: ["author", "reviewer"],
          failure_signals: [
            "Requested revision feedback disappears before the author edits the article.",
            "Resubmission creates a duplicate article instead of returning the same article to review."
          ],
          change_review_notes: [
            "Review this journey when changing revision messaging, editorial state transitions, or author resubmission UX."
          ],
          related_entities: ["entity_article"],
          related_capabilities: ["cap_request_article_revision", "cap_update_article", "cap_get_article"],
          related_rules: ["rule_only_active_users_may_review_articles"],
          related_workflows: ["article_review"]
        },
        {
          id: "article_review",
          kind: "workflow",
          confidence: "high",
          summary: "Editorial review flow from draft to submitted, revision requested, approved, or rejected with revision context preserved.",
          related_entities: ["entity_article"],
          related_capabilities: [
            "cap_create_article",
            "cap_approve_article",
            "cap_reject_article",
            "cap_request_article_revision",
            "cap_update_article"
          ]
        }
      ],
      candidate_actors: [
        {
          id_hint: "actor_author",
          confidence: "medium",
          inference_summary: "phrases=2, participant_hits=1, permission_overlap=0",
          related_docs: ["article_resubmission_after_review", "article_review"],
          related_capabilities: ["cap_update_article"]
        },
        {
          id_hint: "actor_reviewer",
          confidence: "high",
          inference_summary: "phrases=1, participant_hits=1, permission_overlap=0",
          related_docs: ["article_resubmission_after_review", "article_review"],
          related_capabilities: ["cap_update_article"]
        }
      ],
      candidate_roles: [
        {
          id_hint: "role_author",
          confidence: "medium",
          inference_summary: "permission_hits=1, restrictive_hits=0, explicit_role_hits=0",
          related_docs: ["article_resubmission_after_review", "article_review"],
          related_capabilities: ["cap_update_article"]
        },
        {
          id_hint: "role_reviewer",
          confidence: "high",
          inference_summary: "permission_hits=2, restrictive_hits=1, explicit_role_hits=0",
          related_docs: ["article_resubmission_after_review", "article_review"],
          related_capabilities: ["cap_update_article"]
        }
      ]
    })}\n`
  );
  fs.mkdirSync(path.join(actorRoleGapTopogramRoot, "candidates", "app", "api"), { recursive: true });
  fs.writeFileSync(
    path.join(actorRoleGapTopogramRoot, "candidates", "app", "api", "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_update_article",
          label: "Update Article",
          confidence: "high",
          source_kind: "route_code",
          provenance: ["fixture#PATCH /articles/{id}"],
          endpoint: {
            method: "PATCH",
            path: "/articles/{id}"
          },
          auth_hint: "secured",
          input_fields: [],
          output_fields: [],
          path_params: [],
          query_params: []
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  const actorRoleGapReport = runWorkflow("report-gaps", actorRoleGapTopogramRoot);
  assertIncludes(
    stableStringify(actorRoleGapReport.summary.actors_roles_vs_topogram),
    [
      '"actors_missing_in_topogram"',
      '"actor_reviewer"',
      '"actor_gap_candidates"',
      '"confidence": "high"',
      '"roles_missing_in_topogram"',
      '"role_reviewer"',
      '"role_gap_candidates"',
      '"secured_capabilities_without_canonical_roles"',
      '"cap_update_article"',
      '"journey_docs_missing_actor_links"',
      '"article_resubmission_after_review"',
      '"journey_docs_missing_role_links"',
      '"workflow_docs_missing_actor_links"',
      '"article_review"',
      '"workflow_docs_missing_role_links"'
    ],
    "Actor/role gap report"
  );
  assertIncludes(
    actorRoleGapReport.files["candidates/reports/gap-report.md"],
    [
      "## Actors/Roles vs Topogram",
      "Imported actors missing in Topogram: 1",
      "Imported roles missing in Topogram: 1",
      "Secured capabilities without canonical roles: 1",
      "Journey docs missing actor links: 1",
      "Workflow docs missing role links: 1",
      "### Ranked Missing Actors",
      "`actor_reviewer` (high) phrases=1, participant_hits=1, permission_overlap=0",
      "### Ranked Missing Roles",
      "`role_reviewer` (high) permission_hits=2, restrictive_hits=1, explicit_role_hits=0"
    ],
    "Actor/role gap markdown report"
  );
  const actorRoleGapReconcile = runWorkflow("reconcile", actorRoleGapTopogramRoot);
  assertIncludes(
    stableStringify(actorRoleGapReconcile.summary.candidate_model_bundles),
    [
      '"doc_link_suggestions"',
      '"doc_drift_summaries"',
      '"doc_metadata_patches"',
      '"doc_id": "article_review"',
      '"doc_id": "article_resubmission_after_review"',
      '"patch_rel_path": "doc-link-patches/article_review.md"',
      '"patch_rel_path": "doc-metadata-patches/article_review.md"',
      '"patch_rel_path": "doc-metadata-patches/article_resubmission_after_review.md"',
      '"add_related_capabilities"',
      '"cap_update_article"',
      '"add_related_rules"',
      '"rule_only_active_users_may_review_articles"',
      '"add_related_workflows"',
      '"article_review"',
      '"add_related_actors"',
      '"actor_reviewer"',
      '"add_related_roles"',
      '"role_reviewer"',
      '"recommendation_type": "possible_canonical_drift"',
      '"field": "summary"',
      '"field": "success_outcome"',
      '"field": "failure_signals"',
      '"field": "change_review_notes"'
    ],
    "Actor/role reconcile doc link suggestions"
  );
  assertIncludes(
    stableStringify(actorRoleGapReconcile.summary.bundle_priorities),
    ['"recommended_doc_link_actions"', '"recommended_doc_drift_actions"', '"recommended_doc_metadata_patch_actions"', '"bundle": "article"', '"doc_id": "article_review"', '"doc_id": "article_resubmission_after_review"'],
    "Actor/role bundle doc link guidance"
  );
  assertIncludes(
    actorRoleGapReconcile.files["candidates/reconcile/report.md"],
    [
      "draft=`doc-link-patches/article_review.md`",
      "doc-link `article_review` add-actors=`actor_reviewer` add-roles=`role_reviewer`",
      "drift doc `article_resubmission_after_review` (possible_canonical_drift) fields=summary, success_outcome, actors, failure_signals, change_review_notes confidence=high",
      "metadata doc `article_resubmission_after_review` set-summary=yes set-success_outcome=yes add-actors=`reviewer` draft=`doc-metadata-patches/article_resubmission_after_review.md`",
      "metadata doc `article_review` set-summary=yes draft=`doc-metadata-patches/article_review.md`"
    ],
    "Actor/role reconcile markdown doc link guidance"
  );
  assertIncludes(
    actorRoleGapReconcile.files["candidates/reconcile/model/bundles/article/doc-link-patches/article_review.md"],
    ["Target doc: `article_review` (workflow)", "related_roles:", "  - role_reviewer", "related_capabilities:", "  - cap_update_article"],
    "Actor/role doc link patch file"
  );
  assertIncludes(
    actorRoleGapReconcile.files["candidates/reconcile/model/bundles/article/doc-link-patches/article_resubmission_after_review.md"],
    ["related_actors:", "  - actor_reviewer", "related_roles:", "  - role_reviewer", "related_capabilities:", "  - cap_update_article", "related_rules:", "  - rule_only_active_users_may_review_articles", "related_workflows:", "  - article_review"],
    "Generic doc link patch file"
  );
  assertIncludes(
    actorRoleGapReconcile.files["candidates/reconcile/model/bundles/article/doc-metadata-patches/article_resubmission_after_review.md"],
    ['summary: "An author resubmits an article after review feedback with preserved revision context and a clearer recovery path."', 'success_outcome: "The author updates the article, sees the prior revision request, and returns the article to submitted review without losing context."', "actors:", "  - reviewer"],
    "Journey metadata drift patch file"
  );
  assertIncludes(
    actorRoleGapReconcile.files["candidates/reconcile/model/bundles/article/doc-metadata-patches/article_review.md"],
    ['summary: "Editorial review flow from draft to submitted, revision requested, approved, or rejected with revision context preserved."'],
    "Workflow metadata drift patch file"
  );
  const actorRoleGapAdoptionStatus = runWorkflow("adoption-status", actorRoleGapTopogramRoot);
  assertIncludes(
    actorRoleGapAdoptionStatus.files["candidates/reconcile/adoption-status.md"],
    [
      "Suggested doc link updates:",
      "`article_review` add-actors=`actor_reviewer` add-roles=`role_reviewer`",
      "draft=`doc-link-patches/article_review.md`",
      "Suggested doc drift reviews:",
      "doc `article_resubmission_after_review` (possible_canonical_drift) fields=summary, success_outcome, actors, failure_signals, change_review_notes confidence=high",
      "Suggested doc metadata patches:",
      "doc `article_resubmission_after_review` set-summary=yes set-success_outcome=yes add-actors=`reviewer` draft=`doc-metadata-patches/article_resubmission_after_review.md`"
    ],
    "Actor/role adoption status doc link guidance"
  );
  const actorRoleGapDocsAdopt = runWorkflow("reconcile", actorRoleGapTopogramRoot, { adopt: "docs", write: true });
  assertIncludes(
    stableStringify(actorRoleGapDocsAdopt.summary.applied_items),
    ['"doc_link_patch:article_review"', '"doc_link_patch:article_resubmission_after_review"', '"doc_metadata_patch:article_review"', '"doc_metadata_patch:article_resubmission_after_review"'],
    "Actor/role doc link adoption summary"
  );
  assertIncludes(
    actorRoleGapDocsAdopt.files["docs/workflows/article-review.md"],
    ["summary: Editorial review flow from draft to submitted, revision requested, approved, or rejected with revision context preserved.", "related_capabilities:", "  - cap_update_article", "related_roles:", "  - role_reviewer"],
    "Actor/role workflow doc link adoption output"
  );
  assertIncludes(
    actorRoleGapDocsAdopt.files["docs/journeys/article-resubmission-after-review.md"],
    ["summary: An author resubmits an article after review feedback with preserved revision context and a clearer recovery path.", "success_outcome: The author updates the article, sees the prior revision request, and returns the article to submitted review without losing context.", "actors:", "  - author", "  - reviewer", "related_actors:", "  - actor_reviewer", "related_roles:", "  - role_reviewer", "related_capabilities:", "  - cap_update_article", "related_rules:", "  - rule_only_active_users_may_review_articles", "related_workflows:", "  - article_review"],
    "Actor/role journey doc link adoption output"
  );

  const reconcileTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-"));
  const reconcileExampleRoot = path.join(reconcileTempRoot, "issues");
  const reconcileTopogramRoot = path.join(reconcileExampleRoot, "topogram");
  fs.cpSync(issuesRoot, reconcileExampleRoot, { recursive: true });
  const reconcileScan = runWorkflow("scan-docs", reconcileTopogramRoot);
  writeGeneratedFiles(reconcileTopogramRoot, reconcileScan.files);
  const reconcileResult = runWorkflow("reconcile", reconcileTopogramRoot);
  if (reconcileResult.summary.promoted.length === 0) {
    throw new Error("Expected reconcile workflow to promote imported docs into canonical docs for a temp Issues workspace");
  }
  assertIncludes(
    stableStringify(reconcileResult.summary.promoted),
    ['"docs/glossary/board.md"', '"docs/workflows/review-workflow.md"'],
    "Issues reconcile summary"
  );
  if (reconcileResult.summary.candidate_model_files.length !== 0) {
    throw new Error("Expected reconcile workflow to skip candidate model files when canonical Topogram concepts already exist");
  }
  if (!reconcileResult.files["candidates/reconcile/adoption-plan.json"]) {
    throw new Error("Expected reconcile workflow to emit adoption-plan.json");
  }

  const incompleteReconcile = runWorkflow("reconcile", incompleteImportTopogramPath);
  assertIncludes(
    stableStringify(incompleteReconcile.summary.candidate_model_bundles),
    ['"slug": "task"', '"task_priority"', '"cap_update_task"', '"merge_into_existing_entity"', '"canonicalEntityTarget": "entity_task"', '"merge_capability_into_existing_entity"', '"promote_enum"', '"operator_summary"', '"primaryConcept": "entity_task"', '"whyThisBundle": "This bundle exists because'],
    "Incomplete reconcile candidate model bundle summary"
  );
  assertIncludes(
    stableStringify(incompleteReconcile.summary.candidate_model_files),
    ['"candidates/reconcile/model/bundles/task/README.md"', '"candidates/reconcile/model/bundles/task/enums/task_priority.tg"', '"candidates/reconcile/model/bundles/task/capabilities/cap_update_task.tg"'],
    "Incomplete reconcile candidate model summary"
  );
  if (!incompleteReconcile.files["candidates/reconcile/model/bundles/task/enums/task_priority.tg"]?.includes("# imported provenance:")) {
    throw new Error("Expected candidate reconcile files to include provenance comments");
  }
  if (!incompleteReconcile.files["candidates/reconcile/model/bundles/task/README.md"]?.includes("Task Candidate Bundle")) {
    throw new Error("Expected reconcile workflow to emit candidate bundle readmes");
  }
  if (!incompleteReconcile.files["candidates/reconcile/model/bundles/task/README.md"]?.includes("Canonical entity target: `entity_task`")) {
    throw new Error("Expected candidate bundle readmes to include merge hints");
  }
  if (!incompleteReconcile.files["candidates/reconcile/model/bundles/task/README.md"]?.includes("## Operator Summary")) {
    throw new Error("Expected candidate bundle readmes to include an operator summary");
  }
  if (!incompleteReconcile.files["candidates/reconcile/model/bundles/task/README.md"]?.includes("Primary concept: `entity_task`")) {
    throw new Error("Expected candidate bundle readmes to identify the primary concept");
  }
  if (!incompleteReconcile.files["candidates/reconcile/model/bundles/task/README.md"]?.includes("## Why This Bundle Exists")) {
    throw new Error("Expected candidate bundle readmes to explain why the bundle exists");
  }
  const authClaimRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-auth-claims-"));
  const authClaimWorkspaceRoot = path.join(authClaimRoot, "workspace");
  const authClaimTopogramRoot = path.join(authClaimWorkspaceRoot, "topogram");
  fs.mkdirSync(path.join(authClaimTopogramRoot, "candidates", "app", "api"), { recursive: true });
  fs.mkdirSync(path.join(authClaimTopogramRoot, "candidates", "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(authClaimTopogramRoot, "candidates", "app", "api", "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_approve_article",
          label: "Approve Article",
          confidence: "medium",
          source_kind: "route_code",
          source_of_truth: "imported",
          provenance: ["src/review/reviewer-guard.ts#approveArticle"],
          track: "api",
          endpoint: {
            method: "POST",
            path: "/articles/:id/approve"
          },
          input_fields: [],
          output_fields: [],
          auth_hint: "secured"
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  fs.writeFileSync(
    path.join(authClaimTopogramRoot, "candidates", "docs", "import-report.json"),
    `${stableStringify({
      candidate_docs: [],
      candidate_actors: [],
      candidate_roles: [
        {
          kind: "role",
          id_hint: "role_reviewer",
          label: "Reviewer",
          confidence: "medium",
          source_kind: "docs",
          source_of_truth: "imported",
          provenance: ["docs/review.md"],
          related_docs: [],
          related_capabilities: ["cap_approve_article"]
        }
      ]
    })}\n`
  );
  const authClaimReconcile = runWorkflow("reconcile", authClaimTopogramRoot);
  assertIncludes(
    authClaimReconcile.files["candidates/reconcile/model/bundles/article/README.md"],
    ["## Auth Claim Hints", "claim `reviewer` = `true`", "`cap_approve_article`", "Auth closure: high risk (adopted=0, deferred=0, unresolved=2)", "closure: unresolved", "why inferred:", "review next:", "## Auth Role Guidance", "role `role_reviewer` (medium)", "suggested follow-up: promote role"],
    "Bundle auth claim hint README"
  );
  assertIncludes(
    stableStringify(authClaimReconcile.summary.candidate_model_bundles),
    ['"auth_claim_hints"', '"auth_role_guidance"', '"role_id": "role_reviewer"', '"followup_action": "promote_role"', '"claim": "reviewer"', '"claim_value": "true"', '"closure_state": "unresolved"', '"cap_approve_article"', '"why_inferred"', '"review_guidance"'],
    "Bundle auth claim hint summary"
  );
  assertIncludes(
    authClaimReconcile.files["candidates/reconcile/report.md"],
    [
      "auth claims claim `reviewer` = `true`",
      "auth role guidance role `role_reviewer` (medium)",
      "auth closure high risk (adopted=0, deferred=0, unresolved=2)",
      "auth claim `reviewer` = `true` (medium) <- `cap_approve_article`",
      "closure unresolved",
      "role role `role_reviewer` (medium) <- `cap_approve_article`",
      "why inferred Review-oriented capability",
      "suggested follow-up promote role",
      "review next Confirm whether claim `reviewer` = `true`"
    ],
    "Reconcile report auth claim hints"
  );
  assertIncludes(
    authClaimReconcile.files["candidates/reconcile/report.md"],
    [
      "## Next Best Action",
      "- Auth review: Review 1 inferred claim hint(s) before promoting auth-sensitive items from this bundle.",
      "- Priority note: This bundle should be reviewed ahead of lower-risk bundles with similar adoption pressure.",
      "- Why inferred: Review-oriented capability",
      "- Review next: Confirm whether claim `reviewer` = `true`"
    ],
    "Reconcile next-action auth guidance"
  );
  assertIncludes(
    authClaimReconcile.files["candidates/reconcile/report.md"],
    [
      "## Bundle Priorities",
      "auth-closure=high_risk",
      "auth-priority=3"
    ],
    "Auth priority bundle ranking"
  );
  const authClaimAdoptionStatus = runWorkflow("adoption-status", authClaimTopogramRoot);
  assertIncludes(
    authClaimAdoptionStatus.files["candidates/reconcile/adoption-status.md"],
    [
      "## Next Best Action",
      "- Auth review: Review 1 inferred claim hint(s) before promoting auth-sensitive items from this bundle.",
      "- Closure: unresolved",
      "- Participant review: Review 1 auth-relevant role hint(s) before promoting auth-sensitive participant changes from this bundle.",
      "- Auth closure score: high risk (adopted=0, deferred=0, unresolved=2)",
      "- Priority note: This bundle should be reviewed ahead of lower-risk bundles with similar adoption pressure.",
      "- Why inferred: Review-oriented capability",
      "- Review next: Confirm whether claim `reviewer` = `true`",
      "- Suggested actor/role actions:",
      "role `role_reviewer` (medium) auth-relevant -> promote role"
    ],
    "Adoption-status auth guidance"
  );
  writeGeneratedFiles(authClaimTopogramRoot, authClaimReconcile.files);
  const authHintsQueryRun = runCli(["query", "auth-hints", authClaimTopogramRoot]);
  if (authHintsQueryRun.status !== 0) {
    throw new Error(`Expected query auth-hints to succeed:\n${authHintsQueryRun.stderr || authHintsQueryRun.stdout}`);
  }
  assertIncludes(
    authHintsQueryRun.stdout,
    [
      '"type": "auth_hints_query"',
      '"high_risk_bundles"',
      '"stale_high_risk_bundles": []',
      '"hint_type": "claim"',
      '"hint_label": "claim reviewer = true"',
      '"followup_action": "promote_role"',
      '"action": "promote_role_first"',
      '"action": "run_from_plan_write"'
    ],
    "Auth hints query first run"
  );
  const singleAgentImportRun = runCli(["query", "single-agent-plan", authClaimTopogramRoot, "--mode", "import-adopt"]);
  if (singleAgentImportRun.status !== 0) {
    throw new Error(`Expected query single-agent-plan import-adopt to succeed:\n${singleAgentImportRun.stderr || singleAgentImportRun.stdout}`);
  }
  assertIncludes(
    singleAgentImportRun.stdout,
    [
      '"type": "single_agent_plan"',
      '"mode": "import-adopt"',
      '"next_action"',
      '"kind": "review_staged"',
      '"review_boundaries"',
      '"proof_targets"',
      '"recommended_sequence"',
      '"primary_artifacts"'
    ],
    "Single-agent plan import-adopt"
  );
  const singleAgentMaintainedRun = runCli(["query", "single-agent-plan", contentApprovalPath, "--mode", "maintained-app-edit"]);
  if (singleAgentMaintainedRun.status !== 0) {
    throw new Error(`Expected query single-agent-plan maintained-app-edit to succeed:\n${singleAgentMaintainedRun.stderr || singleAgentMaintainedRun.stdout}`);
  }
  assertIncludes(
    singleAgentMaintainedRun.stdout,
    [
      '"type": "single_agent_plan"',
      '"mode": "maintained-app-edit"',
      '"proof_targets"',
      '"context-bundle.maintained-app.json"',
      '"run_proof_targets"'
    ],
    "Single-agent plan maintained-app-edit"
  );
  const multiAgentPlanRun = runCli(["query", "multi-agent-plan", authClaimTopogramRoot, "--mode", "import-adopt"]);
  if (multiAgentPlanRun.status !== 0) {
    throw new Error(`Expected query multi-agent-plan import-adopt to succeed:\n${multiAgentPlanRun.stderr || multiAgentPlanRun.stdout}`);
  }
  assertIncludes(
    multiAgentPlanRun.stdout,
    [
      '"type": "multi_agent_plan"',
      '"mode": "import-adopt"',
      '"source_single_agent_plan"',
      '"role": "bundle_reviewer"',
      '"role": "auth_reviewer"',
      '"role": "adoption_operator"',
      '"parallel_workstreams"',
      '"serialized_gates"',
      '"join_points"',
      '"handoff_packets"',
      '"action": "run_from_plan_write"'
    ],
    "Multi-agent plan import-adopt"
  );
  const workPacketRun = runCli(["query", "work-packet", authClaimTopogramRoot, "--mode", "import-adopt", "--lane", "auth_reviewer.article"]);
  if (workPacketRun.status !== 0) {
    throw new Error(`Expected query work-packet import-adopt to succeed:\n${workPacketRun.stderr || workPacketRun.stdout}`);
  }
  assertIncludes(
    workPacketRun.stdout,
    [
      '"type": "work_packet"',
      '"lane_id": "auth_reviewer.article"',
      '"role": "auth_reviewer"',
      '"published_handoff_packet"',
      '"packet_id": "handoff:auth-review.article"',
      '"recommended_steps"',
      '"action": "review_scoped_work"',
      '"action": "publish_handoff_packet"'
    ],
    "Work-packet query import-adopt"
  );
  const laneStatusRun = runCli(["query", "lane-status", authClaimTopogramRoot, "--mode", "import-adopt"]);
  if (laneStatusRun.status !== 0) {
    throw new Error(`Expected query lane-status import-adopt to succeed:\n${laneStatusRun.stderr || laneStatusRun.stdout}`);
  }
  assertIncludes(
    laneStatusRun.stdout,
    [
      '"type": "lane_status_query"',
      '"status_counts"',
      '"lane_id": "auth_reviewer.article"',
      '"lane_id": "adoption_operator"',
      '"status": "blocked"'
    ],
    "Lane-status query import-adopt"
  );
  const handoffStatusRun = runCli(["query", "handoff-status", authClaimTopogramRoot, "--mode", "import-adopt"]);
  if (handoffStatusRun.status !== 0) {
    throw new Error(`Expected query handoff-status import-adopt to succeed:\n${handoffStatusRun.stderr || handoffStatusRun.stdout}`);
  }
  assertIncludes(
    handoffStatusRun.stdout,
    [
      '"type": "handoff_status_query"',
      '"pending_packets"',
      '"packet_id": "handoff:auth-review.article"',
      '"status": "pending"'
    ],
    "Handoff-status query import-adopt"
  );
  const authReviewPacketRun = runCli(["query", "auth-review-packet", authClaimTopogramRoot, "--bundle", "article"]);
  if (authReviewPacketRun.status !== 0) {
    throw new Error(`Expected query auth-review-packet to succeed:\n${authReviewPacketRun.stderr || authReviewPacketRun.stdout}`);
  }
  assertIncludes(
    authReviewPacketRun.stdout,
    [
      '"type": "auth_review_packet_query"',
      '"bundle": "article"',
      '"next_review_selector": null',
      '"hint_type": "claim"',
      '"followup_action": "promote_role"',
      '"projection_patch_actions"',
      '"action": "promote_role_first"',
      '"action": "run_from_plan_write"'
    ],
    "Auth review packet first run"
  );
  const authClaimReconcileAgain = runWorkflow("reconcile", authClaimTopogramRoot);
  assertIncludes(
    authClaimReconcileAgain.files["candidates/reconcile/model/bundles/article/README.md"],
    [
      "Auth escalation: escalated (high-risk runs=2)"
    ],
    "Bundle auth claim aging README"
  );
  assertIncludes(
    authClaimReconcileAgain.files["candidates/reconcile/report.md"],
    [
      "auth escalation escalated (high-risk runs=2)",
      "Escalation note: This bundle has stayed unresolved and high risk across multiple reconcile runs.",
      "auth-aging=stale_high_risk",
      "high-risk-runs=2"
    ],
    "Reconcile report auth aging"
  );
  writeGeneratedFiles(authClaimTopogramRoot, authClaimReconcileAgain.files);
  const authHintsQueryRunAgain = runCli(["query", "auth-hints", authClaimTopogramRoot]);
  if (authHintsQueryRunAgain.status !== 0) {
    throw new Error(`Expected second query auth-hints to succeed:\n${authHintsQueryRunAgain.stderr || authHintsQueryRunAgain.stdout}`);
  }
  assertIncludes(
    authHintsQueryRunAgain.stdout,
    [
      '"stale_high_risk_bundles"',
      '"escalationLevel": "stale_high_risk"',
      '"action": "promote_role_first"',
      '"action": "run_from_plan_write"'
    ],
    "Auth hints query stale run"
  );
  const authReviewPacketRunAgain = runCli(["query", "auth-review-packet", authClaimTopogramRoot, "--bundle", "article"]);
  if (authReviewPacketRunAgain.status !== 0) {
    throw new Error(`Expected second query auth-review-packet to succeed:\n${authReviewPacketRunAgain.stderr || authReviewPacketRunAgain.stdout}`);
  }
  assertIncludes(
    authReviewPacketRunAgain.stdout,
    [
      '"auth_aging"',
      '"escalationLevel": "stale_high_risk"',
      '"unresolved_hints"',
      '"auth_role_followup"',
      '"action": "promote_role_first"'
    ],
    "Auth review packet stale run"
  );
  const authClaimAdoptionStatusAgain = runWorkflow("adoption-status", authClaimTopogramRoot);
  assertIncludes(
    authClaimAdoptionStatusAgain.files["candidates/reconcile/adoption-status.md"],
    [
      "- Auth escalation: escalated (high-risk runs=",
      "- Escalation note: This bundle has stayed unresolved and high risk across multiple reconcile runs."
    ],
    "Adoption-status auth aging"
  );
  const authClaimPreview = runWorkflow("reconcile", authClaimTopogramRoot, { adopt: "from-plan" });
  assertIncludes(
    authClaimPreview.files["candidates/reconcile/adoption-status.md"],
    [
      "## Preview Follow-Up Guidance",
      "role `role_reviewer`: promote role first"
    ],
    "Auth preview follow-up guidance"
  );
  const authPermissionRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-auth-permission-"));
  const authPermissionWorkspaceRoot = path.join(authPermissionRoot, "workspace");
  const authPermissionTopogramRoot = path.join(authPermissionWorkspaceRoot, "topogram");
  fs.mkdirSync(path.join(authPermissionTopogramRoot, "candidates", "app", "api"), { recursive: true });
  fs.mkdirSync(path.join(authPermissionTopogramRoot, "candidates", "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(authPermissionTopogramRoot, "candidates", "app", "api", "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_update_issue",
          label: "Update Issue",
          confidence: "medium",
          source_kind: "api",
          source_of_truth: "imported",
          provenance: ["src/issues/policy.ts#authorizeIssueUpdate"],
          endpoint: {
            method: "PATCH",
            path: "/issues/:id"
          },
          input_fields: [],
          output_fields: [],
          auth_hint: "secured"
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  fs.writeFileSync(
    path.join(authPermissionTopogramRoot, "candidates", "docs", "import-report.json"),
    `${stableStringify({
      candidate_docs: [
        {
          id: "issue-access",
          kind: "report",
          title: "Issue Access",
          provenance: ["docs/security.md"],
          body: "Issue update actions require issues.update permission."
        }
      ],
      candidate_actors: [],
      candidate_roles: []
    })}\n`
  );
  const authPermissionReconcile = runWorkflow("reconcile", authPermissionTopogramRoot);
  assertIncludes(
    authPermissionReconcile.files["candidates/reconcile/model/bundles/issue/README.md"],
    ["## Auth Permission Hints", "permission `issues.update`", "`cap_update_issue`", "closure: unresolved", "why inferred:", "review next:"],
    "Bundle auth permission hint README"
  );
  assertIncludes(
    stableStringify(authPermissionReconcile.summary.candidate_model_bundles),
    ['"auth_permission_hints"', '"permission": "issues.update"', '"cap_update_issue"', '"why_inferred"', '"review_guidance"'],
    "Bundle auth permission hint summary"
  );
  assertIncludes(
    authPermissionReconcile.files["candidates/reconcile/report.md"],
    [
      "permission hints permission `issues.update`",
      "permission permission `issues.update` (medium) <- `cap_update_issue`",
      "closure unresolved",
      "why inferred Secured capability naming and imported route evidence suggest",
      "review next Confirm whether permission `issues.update`"
    ],
    "Reconcile report auth permission hints"
  );
  assertIncludes(
    authPermissionReconcile.files["candidates/reconcile/report.md"],
    [
      "## Next Best Action",
      "- Permission review: Review 1 inferred permission hint(s) before promoting auth-sensitive items from this bundle.",
      "- Closure: unresolved",
      "- Why inferred: Secured capability naming and imported route evidence suggest",
      "- Review next: Confirm whether permission `issues.update`"
    ],
    "Reconcile next-action permission guidance"
  );
  const authPermissionAdoptionStatus = runWorkflow("adoption-status", authPermissionTopogramRoot);
  assertIncludes(
    authPermissionAdoptionStatus.files["candidates/reconcile/adoption-status.md"],
    [
      "## Next Best Action",
      "- Permission review: Review 1 inferred permission hint(s) before promoting auth-sensitive items from this bundle.",
      "- Closure: unresolved",
      "- Why inferred: Secured capability naming and imported route evidence suggest",
      "- Review next: Confirm whether permission `issues.update`"
    ],
    "Adoption-status permission guidance"
  );
  const authOwnershipRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-auth-ownership-"));
  const authOwnershipWorkspaceRoot = path.join(authOwnershipRoot, "workspace");
  const authOwnershipTopogramRoot = path.join(authOwnershipWorkspaceRoot, "topogram");
  fs.mkdirSync(path.join(authOwnershipTopogramRoot, "candidates", "app", "api"), { recursive: true });
  fs.mkdirSync(path.join(authOwnershipTopogramRoot, "candidates", "app", "db"), { recursive: true });
  fs.mkdirSync(path.join(authOwnershipTopogramRoot, "candidates", "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(authOwnershipTopogramRoot, "candidates", "app", "api", "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_get_issue",
          label: "Get Issue",
          confidence: "medium",
          source_kind: "api",
          source_of_truth: "imported",
          provenance: ["src/issues/controller.ts#getIssue"],
          endpoint: {
            method: "GET",
            path: "/issues/:id"
          },
          input_fields: [],
          output_fields: [],
          auth_hint: "secured"
        },
        {
          kind: "capability",
          id_hint: "cap_update_issue",
          label: "Update Issue",
          confidence: "medium",
          source_kind: "api",
          source_of_truth: "imported",
          provenance: ["src/issues/controller.ts#updateIssue"],
          endpoint: {
            method: "PATCH",
            path: "/issues/:id"
          },
          input_fields: [],
          output_fields: [],
          auth_hint: "secured"
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  fs.writeFileSync(
    path.join(authOwnershipTopogramRoot, "candidates", "app", "db", "candidates.json"),
    `${stableStringify({
      entities: [
        {
          kind: "entity",
          id_hint: "entity_issue",
          label: "Issue",
          confidence: "high",
          source_kind: "schema",
          source_of_truth: "imported",
          provenance: ["db/schema.sql"],
          fields: [
            { name: "id", field_type: "uuid", required: true, primary_key: true },
            { name: "title", field_type: "string", required: true },
            { name: "assignee_id", field_type: "uuid", required: false }
          ]
        }
      ],
      enums: [],
      relations: []
    })}\n`
  );
  fs.writeFileSync(
    path.join(authOwnershipTopogramRoot, "candidates", "docs", "import-report.json"),
    `${stableStringify({
      candidate_docs: [],
      candidate_actors: [],
      candidate_roles: []
    })}\n`
  );
  const authOwnershipReconcile = runWorkflow("reconcile", authOwnershipTopogramRoot);
  assertIncludes(
    authOwnershipReconcile.files["candidates/reconcile/model/bundles/issue/README.md"],
    ["## Auth Ownership Hints", "ownership `owner_or_admin` field `assignee_id`", "`cap_get_issue`, `cap_update_issue`", "closure: unresolved", "why inferred:", "review next:"],
    "Bundle auth ownership hint README"
  );
  assertIncludes(
    stableStringify(authOwnershipReconcile.summary.candidate_model_bundles),
    ['"auth_ownership_hints"', '"ownership": "owner_or_admin"', '"ownership_field": "assignee_id"', '"cap_get_issue"', '"cap_update_issue"'],
    "Bundle auth ownership hint summary"
  );
  assertIncludes(
    authOwnershipReconcile.files["candidates/reconcile/report.md"],
    [
      "ownership hints ownership `owner_or_admin` field `assignee_id`",
      "ownership ownership `owner_or_admin` field `assignee_id` (medium) <- `cap_get_issue`, `cap_update_issue`",
      "closure unresolved",
      "why inferred Assignment-style field naming suggests",
      "review next Confirm whether field `assignee_id` should drive `owner_or_admin` access"
    ],
    "Reconcile report auth ownership hints"
  );
  assertIncludes(
    authOwnershipReconcile.files["candidates/reconcile/report.md"],
    [
      "## Next Best Action",
      "- Ownership review: Review 1 inferred ownership hint(s) before promoting auth-sensitive items from this bundle.",
      "- Closure: unresolved",
      "- Why inferred: Assignment-style field naming suggests",
      "- Review next: Confirm whether field `assignee_id` should drive `owner_or_admin` access"
    ],
    "Reconcile next-action ownership guidance"
  );
  const authOwnershipProjectionRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-ownership-projection-"));
  const authOwnershipProjectionWorkspaceRoot = path.join(authOwnershipProjectionRoot, "workspace");
  const authOwnershipProjectionTopogramRoot = path.join(authOwnershipProjectionWorkspaceRoot, "topogram");
  fs.cpSync(path.join(importFixturesRoot, "incomplete-topogram"), authOwnershipProjectionWorkspaceRoot, { recursive: true });
  fs.mkdirSync(path.join(authOwnershipProjectionTopogramRoot, "projections"), { recursive: true });
  fs.writeFileSync(
    path.join(authOwnershipProjectionTopogramRoot, "projections", "proj-api.tg"),
    `projection proj_api {
  name "API"
  description "Minimal API projection for ownership patch tests"
  platform dotnet
  realizes [cap_create_task]
  outputs [endpoints]

  http {
    cap_create_task method POST path /tasks success 201 auth user request body
  }

  status active
}
`
  );
  fs.mkdirSync(path.join(authOwnershipProjectionTopogramRoot, "candidates", "app", "api"), { recursive: true });
  fs.mkdirSync(path.join(authOwnershipProjectionTopogramRoot, "candidates", "app", "db"), { recursive: true });
  fs.mkdirSync(path.join(authOwnershipProjectionTopogramRoot, "candidates", "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(authOwnershipProjectionTopogramRoot, "candidates", "app", "api", "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_get_task",
          label: "Get Task",
          confidence: "medium",
          source_kind: "api",
          source_of_truth: "imported",
          provenance: ["src/tasks/controller.ts#getTask"],
          endpoint: {
            method: "GET",
            path: "/tasks/:id"
          },
          input_fields: [],
          output_fields: [],
          auth_hint: "secured"
        },
        {
          kind: "capability",
          id_hint: "cap_update_task",
          label: "Update Task",
          confidence: "medium",
          source_kind: "api",
          source_of_truth: "imported",
          provenance: ["src/tasks/controller.ts#updateTask"],
          endpoint: {
            method: "PATCH",
            path: "/tasks/:id"
          },
          input_fields: [],
          output_fields: [],
          auth_hint: "secured"
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  fs.writeFileSync(
    path.join(authOwnershipProjectionTopogramRoot, "candidates", "app", "db", "candidates.json"),
    `${stableStringify({
      entities: [
        {
          kind: "entity",
          id_hint: "entity_task",
          label: "Task",
          confidence: "high",
          source_kind: "schema",
          source_of_truth: "imported",
          provenance: ["db/schema.sql"],
          fields: [
            { name: "id", field_type: "uuid", required: true, primary_key: true },
            { name: "title", field_type: "string", required: true },
            { name: "assignee_id", field_type: "uuid", required: false }
          ]
        }
      ],
      enums: [],
      relations: []
    })}\n`
  );
  fs.writeFileSync(
    path.join(authOwnershipProjectionTopogramRoot, "candidates", "docs", "import-report.json"),
    `${stableStringify({
      candidate_docs: [],
      candidate_actors: [],
      candidate_roles: []
    })}\n`
  );
  const authOwnershipProjectionReconcile = runWorkflow("reconcile", authOwnershipProjectionTopogramRoot);
  assertIncludes(
    authOwnershipProjectionReconcile.files["candidates/reconcile/model/bundles/task/projection-patches/proj_api.md"],
    [
      "## Inferred Ownership Rules",
      "ownership `owner_or_admin` field `assignee_id`",
      "`cap_get_task`, `cap_update_task`"
    ],
    "Projection ownership patch candidate"
  );
  assertIncludes(
    authOwnershipProjectionReconcile.files["candidates/reconcile/adoption-plan.json"],
    [
      '"item": "projection_ownership_patch:proj_api:assignee_id"',
      '"suggested_action": "apply_projection_ownership_patch"',
      '"ownership": "owner_or_admin"',
      '"ownership_field": "assignee_id"',
      '"canonical_rel_path": "projections/proj-api.tg"'
    ],
    "Projection ownership patch adoption item"
  );
  writeGeneratedFiles(authOwnershipProjectionTopogramRoot, authOwnershipProjectionReconcile.files);
  const authOwnershipProjectionReviewed = runWorkflow("reconcile", authOwnershipProjectionTopogramRoot, { adopt: "projection-review:proj_api", write: true });
  writeGeneratedFiles(authOwnershipProjectionTopogramRoot, authOwnershipProjectionReviewed.files);
  assertIncludes(
    authOwnershipProjectionReviewed.files["candidates/reconcile/report.md"],
    [
      "auth closure",
      "ownership ownership `owner_or_admin` field `assignee_id` (medium) <- `cap_get_task`, `cap_update_task`",
      "closure deferred"
    ],
    "Deferred ownership hint closure"
  );
  const authOwnershipProjectionFromPlan = runWorkflow("reconcile", authOwnershipProjectionTopogramRoot, { adopt: "from-plan", write: true });
  assertIncludes(
    authOwnershipProjectionFromPlan.files["projections/proj-api.tg"],
    [
      "realizes [",
      "cap_get_task",
      "cap_update_task",
      "http_authz {",
      "cap_get_task ownership owner_or_admin ownership_field assignee_id",
      "cap_update_task ownership owner_or_admin ownership_field assignee_id"
    ],
    "Projection ownership patch application"
  );
  assertIncludes(
    authOwnershipProjectionFromPlan.files["candidates/reconcile/report.md"],
    [
      "auth closure",
      "ownership ownership `owner_or_admin` field `assignee_id` (medium) <- `cap_get_task`, `cap_update_task`",
      "closure adopted"
    ],
    "Adopted ownership hint closure"
  );
  const authPermissionProjectionRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-permission-projection-"));
  const authPermissionProjectionWorkspaceRoot = path.join(authPermissionProjectionRoot, "workspace");
  const authPermissionProjectionTopogramRoot = path.join(authPermissionProjectionWorkspaceRoot, "topogram");
  fs.cpSync(path.join(importFixturesRoot, "incomplete-topogram"), authPermissionProjectionWorkspaceRoot, { recursive: true });
  fs.mkdirSync(path.join(authPermissionProjectionTopogramRoot, "projections"), { recursive: true });
  fs.writeFileSync(
    path.join(authPermissionProjectionTopogramRoot, "projections", "proj-api.tg"),
    `projection proj_api {
  name "API"
  description "Minimal API projection for permission patch tests"
  platform dotnet
  realizes [cap_create_task]
  outputs [endpoints]

  http {
    cap_create_task method POST path /tasks success 201 auth user request body
  }

  status active
}
`
  );
  fs.mkdirSync(path.join(authPermissionProjectionTopogramRoot, "candidates", "app", "api"), { recursive: true });
  fs.mkdirSync(path.join(authPermissionProjectionTopogramRoot, "candidates", "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(authPermissionProjectionTopogramRoot, "candidates", "app", "api", "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_update_task",
          label: "Update Task",
          confidence: "medium",
          source_kind: "api",
          source_of_truth: "imported",
          provenance: ["src/tasks/policy.ts#authorizeTaskUpdate"],
          endpoint: {
            method: "PATCH",
            path: "/tasks/:id"
          },
          input_fields: [],
          output_fields: [],
          auth_hint: "secured"
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  fs.writeFileSync(
    path.join(authPermissionProjectionTopogramRoot, "candidates", "docs", "import-report.json"),
    `${stableStringify({
      candidate_docs: [
        {
          id: "task-access",
          kind: "report",
          title: "Task Access",
          provenance: ["docs/security.md"],
          body: "Task update actions require tasks.update permission."
        }
      ],
      candidate_actors: [],
      candidate_roles: []
    })}\n`
  );
  const authPermissionProjectionReconcile = runWorkflow("reconcile", authPermissionProjectionTopogramRoot);
  assertIncludes(
    authPermissionProjectionReconcile.files["candidates/reconcile/model/bundles/task/projection-patches/proj_api.md"],
    [
      "## Inferred Permission Rules",
      "permission `tasks.update`",
      "`http_authz`",
      "`cap_update_task`"
    ],
    "Projection permission patch candidate"
  );
  assertIncludes(
    authPermissionProjectionReconcile.files["candidates/reconcile/adoption-plan.json"],
    [
      '"item": "projection_permission_patch:proj_api:http_authz:tasks.update"',
      '"suggested_action": "apply_projection_permission_patch"',
      '"permission": "tasks.update"',
      '"canonical_rel_path": "projections/proj-api.tg"',
      '"status": "needs_projection_review"'
    ],
    "Projection permission patch adoption item"
  );
  writeGeneratedFiles(authPermissionProjectionTopogramRoot, authPermissionProjectionReconcile.files);
  const authPermissionProjectionReviewed = runWorkflow("reconcile", authPermissionProjectionTopogramRoot, { adopt: "projection-review:proj_api", write: true });
  writeGeneratedFiles(authPermissionProjectionTopogramRoot, authPermissionProjectionReviewed.files);
  assertIncludes(
    authPermissionProjectionReviewed.files["candidates/reconcile/report.md"],
    [
      "auth closure",
      "permission permission `tasks.update` (medium) <- `cap_update_task`",
      "closure deferred"
    ],
    "Deferred permission hint closure"
  );
  const authPermissionProjectionFromPlan = runWorkflow("reconcile", authPermissionProjectionTopogramRoot, { adopt: "from-plan", write: true });
  assertIncludes(
    authPermissionProjectionFromPlan.files["projections/proj-api.tg"],
    [
      "realizes [",
      "cap_update_task",
      "http_authz {",
      "cap_update_task permission tasks.update"
    ],
    "Projection permission patch application"
  );
  assertIncludes(
    authPermissionProjectionFromPlan.files["candidates/reconcile/report.md"],
    [
      "auth closure",
      "permission permission `tasks.update` (medium) <- `cap_update_task`",
      "closure adopted"
    ],
    "Adopted permission hint closure"
  );
  const authProjectionRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-auth-projection-"));
  const authProjectionWorkspaceRoot = path.join(authProjectionRoot, "workspace");
  const authProjectionTopogramRoot = path.join(authProjectionWorkspaceRoot, "topogram");
  fs.cpSync(path.join(importFixturesRoot, "incomplete-topogram"), authProjectionWorkspaceRoot, { recursive: true });
  fs.mkdirSync(path.join(authProjectionTopogramRoot, "projections"), { recursive: true });
  fs.writeFileSync(
    path.join(authProjectionTopogramRoot, "projections", "proj-api.tg"),
    `projection proj_api {
  name "API"
  description "Minimal API projection for auth patch tests"
  platform dotnet
  realizes [cap_create_task]
  outputs [endpoints]

  http {
    cap_create_task method POST path /tasks success 201 auth user request body
  }

  status active
}
`
  );
  fs.mkdirSync(path.join(authProjectionTopogramRoot, "candidates", "app", "api"), { recursive: true });
  fs.mkdirSync(path.join(authProjectionTopogramRoot, "candidates", "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(authProjectionTopogramRoot, "candidates", "app", "api", "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_approve_task",
          label: "Approve Task",
          confidence: "medium",
          source_kind: "api",
          source_of_truth: "imported",
          provenance: ["src/review/reviewer-guard.ts#approveTask"],
          endpoint: {
            method: "POST",
            path: "/tasks/:id/approve"
          },
          input_fields: [],
          output_fields: [],
          auth_hint: "secured"
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  fs.writeFileSync(
    path.join(authProjectionTopogramRoot, "candidates", "docs", "import-report.json"),
    `${stableStringify({
      candidate_docs: [],
      candidate_actors: [],
      candidate_roles: [
        {
          kind: "role",
          id_hint: "role_reviewer",
          label: "Reviewer",
          confidence: "medium",
          source_kind: "docs",
          source_of_truth: "imported",
          provenance: ["docs/review.md"],
          related_docs: [],
          related_capabilities: ["cap_approve_task"]
        }
      ]
    })}\n`
  );
  const authProjectionReconcile = runWorkflow("reconcile", authProjectionTopogramRoot);
  assertIncludes(
    authProjectionReconcile.files["candidates/reconcile/model/bundles/task/projection-patches/proj_api.md"],
    [
      "## Inferred Auth Claim Rules",
      "claim `reviewer` = `true`",
      "`http_authz`",
      "`cap_approve_task`"
    ],
    "Projection auth patch candidate"
  );
  assertIncludes(
    authProjectionReconcile.files["candidates/reconcile/adoption-plan.json"],
    [
      '"item": "projection_auth_patch:proj_api:http_authz:reviewer"',
      '"suggested_action": "apply_projection_auth_patch"',
      '"canonical_rel_path": "projections/proj-api.tg"',
      '"status": "needs_projection_review"'
    ],
    "Projection auth patch adoption item"
  );
  writeGeneratedFiles(authProjectionTopogramRoot, authProjectionReconcile.files);
  const authProjectionReviewed = runWorkflow("reconcile", authProjectionTopogramRoot, { adopt: "projection-review:proj_api", write: true });
  writeGeneratedFiles(authProjectionTopogramRoot, authProjectionReviewed.files);
  assertIncludes(
    authProjectionReviewed.files["candidates/reconcile/report.md"],
    [
      "auth closure",
      "auth claim `reviewer` = `true` (medium) <- `cap_approve_task`",
      "closure deferred"
    ],
    "Deferred claim hint closure"
  );
  const authProjectionFromPlan = runWorkflow("reconcile", authProjectionTopogramRoot, { adopt: "from-plan", write: true });
  if (!authProjectionFromPlan.files["capabilities/cap-approve-task.tg"]) {
    throw new Error("Expected approved auth-gated capability adoption to proceed via from-plan");
  }
  assertIncludes(
    authProjectionFromPlan.files["projections/proj-api.tg"],
    [
      "realizes [",
      "cap_approve_task",
      "http_authz {",
      "cap_approve_task claim reviewer claim_value true"
    ],
    "Projection auth patch application"
  );
  assertIncludes(
    authProjectionFromPlan.files["candidates/reconcile/report.md"],
    [
      "auth closure",
      "auth claim `reviewer` = `true` (medium) <- `cap_approve_task`",
      "closure adopted"
    ],
    "Adopted claim hint closure"
  );
  if (!incompleteReconcile.files["candidates/reconcile/model/bundles/task/README.md"]?.includes("`merge_capability_into_existing_entity` `cap_update_task` -> `entity_task`")) {
    throw new Error("Expected candidate bundle readmes to include concrete adoption steps");
  }
  if (!incompleteReconcile.files["candidates/reconcile/model/bundles/task/capabilities/cap_update_task.tg"]?.includes("capability cap_update_task")) {
    throw new Error("Expected reconcile workflow to emit missing candidate capability Topogram files");
  }
  assertIncludes(
    incompleteReconcile.files["candidates/reconcile/adoption-plan.json"],
    ['"suggested_action": "promote_enum"', '"suggested_action": "merge_capability_into_existing_entity"', '"canonical_path": "topogram/enums/enum-task-priority.tg"'],
    "Reconcile adoption plan output"
  );

  const adoptEnumsPreview = runWorkflow("reconcile", incompleteImportTopogramPath, { adopt: "enums" });
  if (!adoptEnumsPreview.files["enums/enum-task-priority.tg"]) {
    throw new Error("Expected reconcile --adopt enums to emit canonical enum outputs");
  }
  if (adoptEnumsPreview.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected reconcile --adopt enums to avoid emitting capability outputs");
  }

  const adoptCapabilitiesPreview = runWorkflow("reconcile", incompleteImportTopogramPath, { adopt: "capabilities" });
  if (!adoptCapabilitiesPreview.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected reconcile --adopt capabilities to emit canonical capability outputs");
  }
  if (!adoptCapabilitiesPreview.files["shapes/shape-input-update-task.tg"] || !adoptCapabilitiesPreview.files["shapes/shape-output-update-task.tg"]) {
    throw new Error("Expected capability adoption to include dependent shapes");
  }

  const fromPlanRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-from-plan-"));
  const fromPlanFixtureRoot = path.join(importFixturesRoot, "incomplete-topogram");
  const fromPlanWorkspaceRoot = path.join(fromPlanRoot, "workspace");
  const fromPlanTopogramRoot = path.join(fromPlanWorkspaceRoot, "topogram");
  fs.cpSync(fromPlanFixtureRoot, fromPlanWorkspaceRoot, { recursive: true });
  const fromPlanPreview = runWorkflow("reconcile", fromPlanTopogramRoot);
  writeGeneratedFiles(fromPlanTopogramRoot, fromPlanPreview.files);
  const fromPlanPath = path.join(fromPlanTopogramRoot, "candidates", "reconcile", "adoption-plan.json");
  const fromPlanData = readJson(fromPlanPath);
  fromPlanData.items = fromPlanData.items.map((item) =>
    item.item === "task_priority" || item.item === "cap_update_task"
      ? { ...item, status: "approved" }
      : item
  );
  fs.writeFileSync(fromPlanPath, `${stableStringify(fromPlanData)}\n`);
  const fromPlanApply = runWorkflow("reconcile", fromPlanTopogramRoot, { adopt: "from-plan", write: true });
  if (!fromPlanApply.files["enums/enum-task-priority.tg"] || !fromPlanApply.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected reconcile --adopt from-plan to emit approved canonical outputs");
  }
  if (!fromPlanApply.files["shapes/shape-input-update-task.tg"]) {
    throw new Error("Expected from-plan capability adoption to include dependent shapes");
  }
  assertIncludes(
    fromPlanApply.files["candidates/reconcile/adoption-plan.json"],
    ['"item": "task_priority"', '"status": "applied"', '"item": "cap_update_task"', '"status": "applied"'],
    "From-plan adoption status update"
  );
  writeGeneratedFiles(fromPlanTopogramRoot, fromPlanApply.files);
  const staleCapabilityPath = path.join(fromPlanTopogramRoot, "capabilities", "cap-update-task.tg");
  fs.writeFileSync(
    staleCapabilityPath,
    `${readText(staleCapabilityPath).replace('description "Candidate capability imported from brownfield API evidence"', 'description "STALE CAPABILITY"')}`,
    "utf8"
  );
  const adoptCapabilitiesNoRefresh = runWorkflow("reconcile", fromPlanTopogramRoot, { adopt: "capabilities", write: true });
  if (adoptCapabilitiesNoRefresh.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected existing canonical capability files to remain untouched without refresh-adopted");
  }
  const adoptCapabilitiesWithRefresh = runWorkflow("reconcile", fromPlanTopogramRoot, { adopt: "capabilities", write: true, refreshAdopted: true });
  if (!adoptCapabilitiesWithRefresh.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected refresh-adopted capability adoption to rewrite existing machine-managed canonical files");
  }
  if (adoptCapabilitiesWithRefresh.files["capabilities/cap-update-task.tg"].includes("STALE CAPABILITY")) {
    throw new Error("Expected refresh-adopted capability adoption to restore fresh candidate contents");
  }
  assertIncludes(
    adoptCapabilitiesWithRefresh.files["candidates/reconcile/report.json"],
    ['"refreshed_canonical_files"', '"capabilities/cap-update-task.tg"'],
    "Refresh-adopted reconcile report"
  );

  const duplicateShapeReconcileRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-duplicate-shape-"));
  const duplicateShapeTopogramRoot = path.join(duplicateShapeReconcileRoot, "topogram");
  fs.cpSync(incompleteImportTopogramPath, duplicateShapeTopogramRoot, { recursive: true });
  const duplicateShapeApiPath = path.join(duplicateShapeTopogramRoot, "candidates", "app", "api");
  fs.mkdirSync(duplicateShapeApiPath, { recursive: true });
  fs.writeFileSync(
    path.join(duplicateShapeApiPath, "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_sync_task_title",
          label: "Sync Task Title",
          confidence: "high",
          source_kind: "route_code",
          source_of_truth: "imported",
          provenance: ["fixture#POST /tasks/title-sync"],
          endpoint: {
            method: "POST",
            path: "/tasks/title-sync"
          },
          input_fields: ["title"],
          output_fields: ["id", "title"],
          path_params: [],
          query_params: [],
          header_params: [],
          auth_hint: "secured"
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  const duplicateShapeReconcile = runWorkflow("reconcile", duplicateShapeTopogramRoot);
  assertIncludes(
    stableStringify(duplicateShapeReconcile.summary.candidate_model_bundles),
    ['"skip_duplicate_shape"', '"shape_input_sync_task_title"', '"shape_input_create_task"'],
    "Duplicate shape reconcile adoption plan"
  );
  const duplicateShapeAdopt = runWorkflow("reconcile", duplicateShapeTopogramRoot, { adopt: "shapes" });
  if (duplicateShapeAdopt.files["shapes/shape-input-sync-task-title.tg"]) {
    throw new Error("Expected duplicate shapes to be skipped during shape adoption");
  }

  const projectionImpactRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-projection-impact-"));
  const projectionImpactWorkspaceRoot = path.join(projectionImpactRoot, "workspace");
  const projectionImpactTopogramRoot = path.join(projectionImpactWorkspaceRoot, "topogram");
  fs.cpSync(path.join(importFixturesRoot, "incomplete-topogram"), projectionImpactWorkspaceRoot, { recursive: true });
  fs.mkdirSync(path.join(projectionImpactTopogramRoot, "projections"), { recursive: true });
  fs.writeFileSync(
    path.join(projectionImpactTopogramRoot, "projections", "proj-ui-shared.tg"),
    `projection proj_ui_shared {
  name "Task Shared UI"
  description "Minimal shared UI projection for projection impact tests"

  platform ui_shared
  realizes [cap_create_task]
  outputs [ui_contract]

  ui_screens {
    screen task_create kind form title "Create Task" input_shape shape_input_create_task submit cap_create_task success_navigate task_create
  }

  status active
}
`
  );
  fs.writeFileSync(
    path.join(projectionImpactTopogramRoot, "projections", "proj-api.tg"),
    `projection proj_api {
  name "API"
  description "Minimal API projection for projection impact tests"
  platform dotnet
  realizes [cap_create_task]
  outputs [endpoints]

  http {
    cap_create_task method POST path /tasks success 201 auth user request body
  }

  status active
}
`
  );
  fs.writeFileSync(
    path.join(projectionImpactTopogramRoot, "projections", "proj-ui-web.tg"),
    `projection proj_ui_web {
  name "Web UI"
  description "Minimal web UI projection for projection impact tests"
  platform ui_web
  realizes [proj_ui_shared, cap_create_task]
  outputs [ui_contract]

  ui_routes {
    screen task_create path /tasks/new
  }

  ui_web {
    screen task_create present page
  }

  generator_defaults {
    profile react
    language typescript
    styling css
  }

  status active
}
`
  );
  const projectionImpactReconcile = runWorkflow("reconcile", projectionImpactTopogramRoot);
  assertIncludes(
    stableStringify(projectionImpactReconcile.summary.candidate_model_bundles),
    ['"projection_impacts"', '"projection_patches"', '"proj_api"', '"proj_ui_web"', '"cap_update_task"'],
    "Projection impact reporting"
  );
  if (!projectionImpactReconcile.files["candidates/reconcile/model/bundles/task/projection-patches/proj_api.md"]) {
    throw new Error("Expected reconcile to emit candidate projection patch docs for API projections");
  }
  if (!projectionImpactReconcile.files["candidates/reconcile/model/bundles/task/projection-patches/proj_ui_web.md"]) {
    throw new Error("Expected reconcile to emit candidate projection patch docs for UI projections");
  }
  assertIncludes(
    projectionImpactReconcile.files["candidates/reconcile/model/bundles/task/projection-patches/proj_api.md"],
    ["# proj_api Patch Candidate", "## Missing Realizes", "`cap_update_task`", "## Missing HTTP Entries", "`cap_update_task` PATCH `/tasks/{id}`"],
    "Projection API patch candidate"
  );
  assertIncludes(
    projectionImpactReconcile.files["candidates/reconcile/adoption-plan.json"],
    ['"item": "cap_update_task"', '"item": "projection_patch:proj_api"', '"item": "projection_patch:proj_ui_web"', '"status": "needs_projection_review"', '"projection_impacts"', '"blocking_dependencies"', '"id": "projection_review:proj_api"', '"id": "projection_review:proj_ui_web"', '"projection_review_groups"', '"projection_id": "proj_api"', '"projection_id": "proj_ui_web"', '"suggested_action": "review_projection_patch"'],
    "Projection impacts in adoption plan"
  );
  assertIncludes(
    projectionImpactReconcile.files["candidates/reconcile/report.md"],
    ["## Projection Review Groups", "`proj_api` (api) <- `cap_update_task`, `projection_patch:proj_api`", "`proj_ui_web` (ui) <- `cap_update_task`, `projection_patch:proj_ui_web`", "## Projection Dependencies", "`cap_update_task` -> `proj_api`, `proj_ui_web`"],
    "Projection dependency reporting"
  );
  const projectionImpactAdoptCapabilities = runWorkflow("reconcile", projectionImpactTopogramRoot, { adopt: "capabilities" });
  if (projectionImpactAdoptCapabilities.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected projection-dependent capabilities to stay blocked during selector-based adoption");
  }
  assertIncludes(
    projectionImpactAdoptCapabilities.files["candidates/reconcile/report.md"],
    ["## Blocked Adoption Items", "`cap_update_task`"],
    "Blocked projection-dependent capability adoption"
  );
  const projectionReviewApi = runWorkflow("reconcile", projectionImpactTopogramRoot, { adopt: "projection-review:proj_api", write: true });
  if (projectionReviewApi.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected projection-review approval to avoid emitting canonical outputs directly");
  }
  assertIncludes(
    projectionReviewApi.files["candidates/reconcile/adoption-plan.json"],
    ['"approved_review_groups"', '"projection_review:proj_api"', '"item": "projection_patch:proj_api"', '"status": "approved"', '"item": "cap_update_task"', '"status": "needs_projection_review"'],
    "Projection review group approval state"
  );
  assertIncludes(
    projectionReviewApi.files["candidates/reconcile/report.md"],
    ["## Approved Review Groups", "`projection_review:proj_api`"],
    "Projection review group reporting"
  );
  const projectionImpactPlanPath = path.join(projectionImpactTopogramRoot, "candidates", "reconcile", "adoption-plan.json");
  writeGeneratedFiles(projectionImpactTopogramRoot, projectionImpactReconcile.files);
  writeGeneratedFiles(projectionImpactTopogramRoot, projectionReviewApi.files);
  const projectionReviewUi = runWorkflow("reconcile", projectionImpactTopogramRoot, { adopt: "projection-review:proj_ui_web", write: true });
  writeGeneratedFiles(projectionImpactTopogramRoot, projectionReviewUi.files);
  const projectionImpactPlanAfterReviews = readJson(projectionImpactPlanPath);
  const reviewedCapabilityItem = projectionImpactPlanAfterReviews.items.find((item) => item.item === "cap_update_task");
  if (reviewedCapabilityItem?.status !== "approved") {
    throw new Error("Expected capability item to become approved after all projection review groups were approved");
  }
  const projectionImpactPlan = readJson(projectionImpactPlanPath);
  projectionImpactPlan.items = projectionImpactPlan.items.map((item) =>
    item.item === "cap_update_task"
      ? { ...item, status: "approved" }
      : item
  );
  fs.writeFileSync(projectionImpactPlanPath, `${stableStringify(projectionImpactPlan)}\n`);
  const projectionImpactFromPlan = runWorkflow("reconcile", projectionImpactTopogramRoot, { adopt: "from-plan" });
  if (!projectionImpactFromPlan.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected explicitly approved projection-dependent capability adoption to proceed via from-plan");
  }
  if (!projectionImpactReconcile.files["candidates/reconcile/model/bundles/task/README.md"]?.includes("## Projection Impacts")) {
    throw new Error("Expected candidate bundle readmes to include projection impacts");
  }
  if (!projectionImpactReconcile.files["candidates/reconcile/model/bundles/task/README.md"]?.includes("## Projection Patch Candidates")) {
    throw new Error("Expected candidate bundle readmes to include projection patch candidates");
  }

  const uiAdoptRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-ui-adopt-"));
  const uiAdoptWorkspaceRoot = path.join(uiAdoptRoot, "workspace");
  const uiAdoptTopogramRoot = path.join(uiAdoptWorkspaceRoot, "topogram");
  fs.cpSync(path.join(importFixturesRoot, "incomplete-topogram"), uiAdoptWorkspaceRoot, { recursive: true });
  fs.mkdirSync(path.join(uiAdoptTopogramRoot, "projections"), { recursive: true });
  fs.writeFileSync(
    path.join(uiAdoptTopogramRoot, "projections", "proj-ui-shared.tg"),
    `projection proj_ui_shared {
  name "Task Shared UI"
  description "Minimal shared UI projection for UI review tests"

  platform ui_shared
  realizes [cap_create_task]
  outputs [ui_contract]

  ui_screens {
    screen task_create kind form title "Create Task" input_shape shape_input_create_task submit cap_create_task success_navigate task_create
  }

  status active
}
`
  );
  fs.writeFileSync(
    path.join(uiAdoptTopogramRoot, "projections", "proj-ui-web.tg"),
    `projection proj_ui_web {
  name "Web UI"
  description "Minimal web UI projection for UI review tests"
  platform ui_web
  realizes [proj_ui_shared, cap_create_task]
  outputs [ui_contract]

  ui_routes {
    screen task_create path /tasks/new
  }

  ui_web {
    screen task_create present page
  }

  generator_defaults {
    profile react
    language typescript
    styling css
  }

  status active
}
`
  );
  const uiCandidatesDir = path.join(uiAdoptTopogramRoot, "candidates", "app", "ui");
  fs.mkdirSync(uiCandidatesDir, { recursive: true });
  fs.writeFileSync(path.join(uiCandidatesDir, "candidates.json"), `${stableStringify(routeFallbackUiImport.summary.candidates.ui)}\n`);
  const uiAdoptPreview = runWorkflow("reconcile", uiAdoptTopogramRoot, { adopt: "ui" });
  if (uiAdoptPreview.files["docs/reports/ui-task_list.md"]) {
    throw new Error("Expected selector-based UI adoption to stay blocked pending UI review");
  }
  assertIncludes(
    uiAdoptPreview.files["candidates/reconcile/adoption-plan.json"],
    ['"status": "needs_ui_review"', '"ui_review_groups"', '"ui_review:proj_ui_web"'],
    "UI review grouping"
  );
  const uiReviewPreview = runWorkflow("reconcile", uiAdoptTopogramRoot);
  writeGeneratedFiles(uiAdoptTopogramRoot, uiReviewPreview.files);
  const uiReviewShared = runWorkflow("reconcile", uiAdoptTopogramRoot, { adopt: "ui-review:proj_ui_shared", write: true });
  writeGeneratedFiles(uiAdoptTopogramRoot, uiReviewShared.files);
  const uiReviewGroup = runWorkflow("reconcile", uiAdoptTopogramRoot, { adopt: "ui-review:proj_ui_web", write: true });
  assertIncludes(
    uiReviewGroup.files["candidates/reconcile/adoption-plan.json"],
    ['"approved_review_groups"', '"ui_review:proj_ui_shared"', '"ui_review:proj_ui_web"', '"item": "ui_task_list"', '"status": "approved"'],
    "UI review group approval state"
  );
  writeGeneratedFiles(uiAdoptTopogramRoot, uiReviewGroup.files);
  const uiFromPlan = runWorkflow("reconcile", uiAdoptTopogramRoot, { adopt: "from-plan" });
  if (!uiFromPlan.files["docs/reports/ui-task_list.md"]) {
    throw new Error("Expected approved UI review group to allow from-plan UI adoption");
  }

  const workflowAdoptRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-workflow-adopt-"));
  const workflowAdoptWorkspaceRoot = path.join(workflowAdoptRoot, "workspace");
  const workflowAdoptTopogramRoot = path.join(workflowAdoptWorkspaceRoot, "topogram");
  fs.cpSync(path.join(importFixturesRoot, "incomplete-topogram"), workflowAdoptWorkspaceRoot, { recursive: true });
  const workflowCandidatesDir = path.join(workflowAdoptTopogramRoot, "candidates", "app", "workflows");
  fs.mkdirSync(workflowCandidatesDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowCandidatesDir, "candidates.json"),
    `${stableStringify({
      workflows: [
        {
          kind: "workflow",
          id_hint: "workflow_task",
          label: "Task Workflow",
          confidence: "medium",
          source_kind: "generated_artifact",
          source_of_truth: "imported",
          provenance: ["fixture#workflow_task"],
          track: "workflows",
          entity_id: "entity_task",
          actor_hints: ["user"],
          related_capabilities: ["cap_create_task", "cap_update_task"]
        }
      ],
      workflow_states: [
        {
          kind: "workflow_state",
          id_hint: "workflow_task_open",
          label: "Open",
          confidence: "medium",
          source_kind: "schema",
          source_of_truth: "imported",
          provenance: ["fixture#open"],
          track: "workflows",
          workflow_id: "workflow_task",
          entity_id: "entity_task",
          state_id: "open"
        }
      ],
      workflow_transitions: [
        {
          kind: "workflow_transition",
          id_hint: "workflow_task_cap_update_task",
          label: "Update Task",
          confidence: "low",
          source_kind: "generated_artifact",
          source_of_truth: "imported",
          provenance: ["fixture#cap_update_task"],
          track: "workflows",
          workflow_id: "workflow_task",
          entity_id: "entity_task",
          capability_id: "cap_update_task",
          actor_hints: ["user"],
          to_state: "open"
        }
      ]
    })}\n`
  );
  const workflowAdoptPreview = runWorkflow("reconcile", workflowAdoptTopogramRoot, { adopt: "workflows" });
  if (workflowAdoptPreview.files["decisions/decision-task.tg"]) {
    throw new Error("Expected selector-based workflow adoption to stay blocked pending workflow review");
  }
  assertIncludes(
    workflowAdoptPreview.files["candidates/reconcile/adoption-plan.json"],
    ['"status": "needs_workflow_review"', '"workflow_review_groups"', '"workflow_review:task"'],
    "Workflow review grouping"
  );
  const workflowPlanPreview = runWorkflow("reconcile", workflowAdoptTopogramRoot);
  writeGeneratedFiles(workflowAdoptTopogramRoot, workflowPlanPreview.files);
  const workflowReviewGroup = runWorkflow("reconcile", workflowAdoptTopogramRoot, { adopt: "workflow-review:task", write: true });
  assertIncludes(
    workflowReviewGroup.files["candidates/reconcile/adoption-plan.json"],
    ['"approved_review_groups"', '"workflow_review:task"', '"item": "workflow_task"', '"status": "approved"'],
    "Workflow review group approval state"
  );
  writeGeneratedFiles(workflowAdoptTopogramRoot, workflowReviewGroup.files);
  const workflowFromApprovedGroup = runWorkflow("reconcile", workflowAdoptTopogramRoot, { adopt: "from-plan" });
  if (!workflowFromApprovedGroup.files["decisions/decision-task.tg"] || !workflowFromApprovedGroup.files["docs/workflows/workflow_task.md"]) {
    throw new Error("Expected approved workflow review group to allow from-plan workflow adoption");
  }
  const workflowPlanPath = path.join(workflowAdoptTopogramRoot, "candidates", "reconcile", "adoption-plan.json");
  const workflowPlan = readJson(workflowPlanPath);
  workflowPlan.items = workflowPlan.items.map((item) =>
    item.track === "workflows"
      ? { ...item, status: "approved" }
      : item
  );
  fs.writeFileSync(workflowPlanPath, `${stableStringify(workflowPlan)}\n`);
  const workflowAdoptFromPlan = runWorkflow("reconcile", workflowAdoptTopogramRoot, { adopt: "from-plan" });
  if (!workflowAdoptFromPlan.files["decisions/decision-task.tg"] || !workflowAdoptFromPlan.files["docs/workflows/workflow_task.md"]) {
    throw new Error("Expected approved workflow adoption to emit canonical decisions and workflow docs");
  }
  assertIncludes(
    workflowAdoptFromPlan.files["candidates/reconcile/report.md"],
    [
      "## Preview Canonical Changes",
      "- Creates:",
      "- Updates:",
      "## Remaining Risk After Preview"
    ],
    "Workflow adoption preview reporting"
  );
  assertIncludes(
    workflowAdoptFromPlan.files["candidates/reconcile/adoption-status.md"],
    [
      "## Preview Canonical Changes",
      "## Remaining Risk After Preview",
      "- Selector: `from-plan`",
      "- Write mode: no"
    ],
    "Workflow adoption preview status"
  );
  assertIncludes(
    stableStringify(workflowAdoptFromPlan.summary.promoted_canonical_items),
    [
      '"selector": "from-plan"',
      '"item": "dec_task"',
      '"canonical_rel_path": "decisions/decision-task.tg"',
      '"change_type": "create"',
      '"item": "workflow_task"',
      '"canonical_rel_path": "docs/workflows/workflow_task.md"'
    ],
    "Generic promoted canonical item summary for workflow adoption"
  );
  assertExcludes(
    stableStringify(workflowAdoptFromPlan.summary.promoted_canonical_items),
    ['"review_projection_patch"', '"projection_patch:"'],
    "Promoted canonical item summary excludes review-only adoption items"
  );

  const verificationAdoptRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-verification-adopt-"));
  const verificationAdoptWorkspaceRoot = path.join(verificationAdoptRoot, "workspace");
  const verificationAdoptTopogramRoot = path.join(verificationAdoptWorkspaceRoot, "topogram");
  fs.cpSync(path.join(importFixturesRoot, "incomplete-topogram"), verificationAdoptWorkspaceRoot, { recursive: true });
  const verificationCandidatesDir = path.join(verificationAdoptTopogramRoot, "candidates", "app", "verification");
  fs.mkdirSync(verificationCandidatesDir, { recursive: true });
  fs.writeFileSync(
    path.join(verificationCandidatesDir, "candidates.json"),
    `${stableStringify({
      verifications: [
        {
          kind: "verification",
          id_hint: "ver_create_task_runtime",
          label: "Create task runtime",
          confidence: "medium",
          source_kind: "test_suite",
          source_of_truth: "imported",
          provenance: ["fixture#ver_create_task_runtime"],
          track: "verification",
          framework: "playwright",
          method: "runtime",
          file_path: "playwright/create-task.test.ts",
          scenario_ids: ["verification_scenario_create_task_runtime"],
          related_capabilities: ["cap_create_task"]
        }
      ],
      scenarios: [
        {
          kind: "verification_scenario",
          id_hint: "verification_scenario_create_task_runtime",
          label: "create task runtime",
          confidence: "medium",
          source_kind: "test_suite",
          source_of_truth: "imported",
          provenance: ["fixture#scenario_create_task_runtime"],
          track: "verification",
          framework: "playwright",
          method: "runtime",
          file_path: "playwright/create-task.test.ts",
          verification_id: "ver_create_task_runtime",
          related_capabilities: ["cap_create_task"]
        }
      ],
      frameworks: ["playwright"],
      scripts: [{ name: "test-e2e", command: "playwright test", file: "package.json" }]
    })}\n`
  );
  const verificationReconcile = runWorkflow("reconcile", verificationAdoptTopogramRoot);
  if (!verificationReconcile.files["candidates/reconcile/model/bundles/task/verifications/ver_create_task_runtime.tg"]) {
    throw new Error("Expected reconcile to emit candidate verification files");
  }
  const verificationAdopt = runWorkflow("reconcile", verificationAdoptTopogramRoot, { adopt: "verification" });
  if (!verificationAdopt.files["verifications/ver-create-task-runtime.tg"]) {
    throw new Error("Expected verification selector adoption to emit canonical verification files");
  }
  const previewOnlyReconcile = runWorkflow("reconcile", verificationAdoptTopogramRoot);
  if ((previewOnlyReconcile.summary.promoted_canonical_items || []).length !== 0) {
    throw new Error("Expected preview-only reconcile to leave promoted canonical item summary empty");
  }
  if (previewOnlyReconcile.files["candidates/reconcile/report.md"].includes("## Promoted Canonical Items")) {
    throw new Error("Expected preview-only reconcile markdown to omit the promoted canonical items section");
  }
  if (previewOnlyReconcile.files["candidates/reconcile/adoption-status.md"].includes("## Promoted Canonical Items")) {
    throw new Error("Expected preview-only adoption status markdown to omit the promoted canonical items section");
  }
  assertIncludes(
    projectionImpactReconcile.files["candidates/reconcile/report.md"],
    [
      "## Bundle Blockers",
      "`task`: blocked=",
      "`projection_review:proj_api`",
      "`projection_review:proj_ui_web`",
      "## Next Best Action",
      "- Bundle: `task`",
      "- Selector: `bundle-review:task`",
      "## Bundle Priorities",
      "`task`: action=`bundle-review:task`",
      "## Candidate Model Bundles",
      "- `task`",
      "primary concept `entity_task`",
      "why This bundle exists because"
    ],
    "Bundle blocker reporting"
  );

  const bundleReviewRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-reconcile-bundle-review-"));
  const bundleReviewWorkspaceRoot = path.join(bundleReviewRoot, "workspace");
  const bundleReviewTopogramRoot = path.join(bundleReviewWorkspaceRoot, "topogram");
  fs.cpSync(path.join(importFixturesRoot, "incomplete-topogram"), bundleReviewWorkspaceRoot, { recursive: true });
  fs.mkdirSync(path.join(bundleReviewTopogramRoot, "projections"), { recursive: true });
  fs.writeFileSync(
    path.join(bundleReviewTopogramRoot, "projections", "proj-ui-shared.tg"),
    `projection proj_ui_shared {
  name "Task Shared UI"
  description "Minimal shared UI projection for bundle review tests"

  platform ui_shared
  realizes [cap_create_task]
  outputs [ui_contract]

  ui_screens {
    screen task_create kind form title "Create Task" input_shape shape_input_create_task submit cap_create_task success_navigate task_create
  }

  status active
}
`
  );
  fs.writeFileSync(
    path.join(bundleReviewTopogramRoot, "projections", "proj-api.tg"),
    `projection proj_api {
  name "API"
  description "Minimal API projection for bundle review tests"
  platform dotnet
  realizes [cap_create_task]
  outputs [endpoints]

  http {
    cap_create_task method POST path /tasks success 201 auth user request body
  }

  status active
}
`
  );
  fs.writeFileSync(
    path.join(bundleReviewTopogramRoot, "projections", "proj-ui-web.tg"),
    `projection proj_ui_web {
  name "Web UI"
  description "Minimal web UI projection for bundle review tests"
  platform ui_web
  realizes [proj_ui_shared, cap_create_task]
  outputs [ui_contract]

  ui_routes {
    screen task_create path /tasks/new
  }

  ui_web {
    screen task_create present page
  }

  generator_defaults {
    profile react
    language typescript
    styling css
  }

  status active
}
`
  );
  fs.mkdirSync(path.join(bundleReviewTopogramRoot, "candidates", "app", "api"), { recursive: true });
  fs.writeFileSync(
    path.join(bundleReviewTopogramRoot, "candidates", "app", "api", "candidates.json"),
    `${stableStringify({
      capabilities: [
        {
          kind: "capability",
          id_hint: "cap_update_task",
          label: "Update Task",
          confidence: "high",
          source_kind: "openapi",
          source_of_truth: "imported",
          provenance: ["fixture#PATCH /tasks/{id}"],
          endpoint: {
            method: "PATCH",
            path: "/tasks/{id}"
          },
          input_fields: ["title", "priority"],
          output_fields: ["id", "title", "priority"],
          path_params: [{ name: "id" }],
          query_params: [],
          header_params: [],
          auth_hint: "secured",
          track: "api"
        }
      ],
      routes: [],
      stacks: []
    })}\n`
  );
  fs.mkdirSync(path.join(bundleReviewTopogramRoot, "candidates", "app", "ui"), { recursive: true });
  fs.writeFileSync(path.join(bundleReviewTopogramRoot, "candidates", "app", "ui", "candidates.json"), `${stableStringify(routeFallbackUiImport.summary.candidates.ui)}\n`);
  fs.mkdirSync(path.join(bundleReviewTopogramRoot, "candidates", "app", "workflows"), { recursive: true });
  fs.writeFileSync(
    path.join(bundleReviewTopogramRoot, "candidates", "app", "workflows", "candidates.json"),
    `${stableStringify({
      workflows: [
        {
          kind: "workflow",
          id_hint: "workflow_task",
          label: "Task Workflow",
          confidence: "medium",
          source_kind: "generated_artifact",
          source_of_truth: "imported",
          provenance: ["fixture#workflow_task"],
          track: "workflows",
          entity_id: "entity_task",
          actor_hints: ["user"],
          related_capabilities: ["cap_create_task", "cap_update_task"]
        }
      ],
      workflow_states: [
        {
          kind: "workflow_state",
          id_hint: "workflow_task_open",
          label: "Open",
          confidence: "medium",
          source_kind: "schema",
          source_of_truth: "imported",
          provenance: ["fixture#open"],
          track: "workflows",
          workflow_id: "workflow_task",
          entity_id: "entity_task",
          state_id: "open"
        }
      ],
      workflow_transitions: [
        {
          kind: "workflow_transition",
          id_hint: "workflow_task_cap_update_task",
          label: "Update Task",
          confidence: "low",
          source_kind: "generated_artifact",
          source_of_truth: "imported",
          provenance: ["fixture#cap_update_task"],
          track: "workflows",
          workflow_id: "workflow_task",
          entity_id: "entity_task",
          capability_id: "cap_update_task",
          actor_hints: ["user"],
          to_state: "open"
        }
      ]
    })}\n`
  );
  const bundleReviewPreview = runWorkflow("reconcile", bundleReviewTopogramRoot);
  writeGeneratedFiles(bundleReviewTopogramRoot, bundleReviewPreview.files);
  assertIncludes(
    bundleReviewPreview.files["candidates/reconcile/report.md"],
    ["## Next Best Action", "- Bundle: `task`", "- Selector: `bundle-review:task`", "## Bundle Priorities", "`task`: action=`bundle-review:task`"],
    "Bundle priority reporting"
  );
  const adoptionStatus = runWorkflow("adoption-status", bundleReviewTopogramRoot);
  assertIncludes(
    stableStringify(adoptionStatus.summary),
    ['"type": "adoption_status"', '"next_bundle"', '"bundle": "task"', '"recommend_bundle_review_selector": "bundle-review:task"'],
    "Adoption status summary"
  );
  assertIncludes(
    adoptionStatus.files["candidates/reconcile/adoption-status.md"],
    ["# Adoption Status", "## Next Bundle", "`task`", "`bundle-review:task`"],
    "Adoption status markdown"
  );
  const bundleReviewApprovePreview = runWorkflow("reconcile", bundleReviewTopogramRoot, { adopt: "bundle-review:task" });
  assertIncludes(
    bundleReviewApprovePreview.files["candidates/reconcile/report.md"],
    [
      "- Selector: `bundle-review:task`",
      "## Remaining Risk After Preview",
      "## Next Best Action",
      "- Action: Adopt approved items now"
    ],
    "Bundle review preview reporting"
  );
  assertIncludes(
    bundleReviewApprovePreview.files["candidates/reconcile/adoption-plan.json"],
    ['"approved_review_groups"', '"workflow_review:task"', '"item": "cap_update_task"', '"status": "approved"'],
    "Bundle review preview approval state"
  );
  const bundleReviewApprove = runWorkflow("reconcile", bundleReviewTopogramRoot, { adopt: "bundle-review:task", write: true });
  assertIncludes(
    bundleReviewApprove.files["candidates/reconcile/adoption-plan.json"],
    ['"approved_review_groups"', '"item": "cap_update_task"', '"status": "approved"', '"item": "ui_task_list"', '"status": "approved"', '"item": "workflow_task"', '"status": "approved"'],
    "Bundle review approval state"
  );
  writeGeneratedFiles(bundleReviewTopogramRoot, bundleReviewApprove.files);
  const bundleReviewFromPlan = runWorkflow("reconcile", bundleReviewTopogramRoot, { adopt: "from-plan", write: true });
  if (!bundleReviewFromPlan.files["capabilities/cap-update-task.tg"]) {
    throw new Error("Expected bundle-review approval to unblock capability adoption via from-plan");
  }
  if (!bundleReviewFromPlan.files["docs/reports/ui-task_list.md"]) {
    throw new Error("Expected bundle-review approval to unblock UI doc adoption via from-plan");
  }
  if (!bundleReviewFromPlan.files["docs/workflows/workflow_task.md"] || !bundleReviewFromPlan.files["decisions/decision-task.tg"]) {
    throw new Error("Expected bundle-review approval to unblock workflow adoption via from-plan");
  }
  writeGeneratedFiles(bundleReviewTopogramRoot, bundleReviewFromPlan.files);
  const adoptionStatusAfterApply = runWorkflow("adoption-status", bundleReviewTopogramRoot);
  if (adoptionStatusAfterApply.summary.applied_item_count === 0) {
    throw new Error("Expected adoption-status to reflect persisted applied items after from-plan adoption");
  }

  const contentApprovalValidation = validateWorkspace(contentApprovalAst);
  if (!contentApprovalValidation.ok) {
    throw new Error(`Expected content-approval fixtures to validate cleanly:\n${formatValidationErrors(contentApprovalValidation)}`);
  }

  const contentApprovalScanDocs = runWorkflow("scan-docs", contentApprovalPath);
  assertIncludes(
    stableStringify(contentApprovalScanDocs.summary.candidate_docs),
    ['"id": "article"', '"id": "publication"', '"id": "request-article-revision"'],
    "Content-approval scan-docs summary"
  );

  const contentApprovalResolved = resolveWorkspace(contentApprovalAst);
  if (!contentApprovalResolved.ok) {
    throw new Error(`Expected content-approval fixtures to resolve cleanly:\n${formatValidationErrors(contentApprovalResolved.validation)}`);
  }
  assertDeepEqual(
    contentApprovalResolved.graph,
    readJson(path.join(contentApprovalExpectedDir, "content-approval.resolve.json")),
    "Resolved content-approval semantic graph"
  );

  const contentApprovalDocs = generateWorkspace(contentApprovalAst, { target: "docs" });
  if (!contentApprovalDocs.ok) {
    throw new Error(`Expected content-approval docs generation to succeed:\n${formatValidationErrors(contentApprovalDocs.validation)}`);
  }
  if (
    normalizeText(contentApprovalDocs.artifact) !==
    normalizeText(readText(path.join(contentApprovalExpectedDir, "content-approval.docs.md")))
  ) {
    throw new Error("Generated content-approval docs did not match expected output");
  }

  const contentApprovalVerificationChecklist = generateWorkspace(contentApprovalAst, { target: "verification-checklist" });
  if (!contentApprovalVerificationChecklist.ok) {
    throw new Error(`Expected content-approval verification-checklist generation to succeed:\n${formatValidationErrors(contentApprovalVerificationChecklist.validation)}`);
  }
  if (
    normalizeText(contentApprovalVerificationChecklist.artifact) !==
    normalizeText(readText(path.join(contentApprovalExpectedDir, "verification-checklist.md")))
  ) {
    throw new Error("Generated content-approval verification checklist did not match expected output");
  }

  const contentApprovalDocsIndex = generateWorkspace(contentApprovalAst, { target: "docs-index" });
  if (!contentApprovalDocsIndex.ok) {
    throw new Error(`Expected content-approval docs-index generation to succeed:\n${formatValidationErrors(contentApprovalDocsIndex.validation)}`);
  }
  assertDeepEqual(
    contentApprovalDocsIndex.artifact,
    readJson(path.join(contentApprovalExpectedDir, "docs-index.json")),
    "Content-approval docs index"
  );

  const contentApprovalVerificationPlan = generateWorkspace(contentApprovalAst, { target: "verification-plan" });
  if (!contentApprovalVerificationPlan.ok) {
    throw new Error(`Expected content-approval verification-plan generation to succeed:\n${formatValidationErrors(contentApprovalVerificationPlan.validation)}`);
  }
  assertDeepEqual(
    contentApprovalVerificationPlan.artifact,
    readJson(path.join(contentApprovalExpectedDir, "verification-plan.json")),
    "Content-approval verification plan"
  );

  const contentApprovalUiWeb = generateWorkspace(contentApprovalAst, {
    target: "ui-web-contract",
    projectionId: "proj_ui_web"
  });
  if (!contentApprovalUiWeb.ok) {
    throw new Error(`Expected content-approval UI web contract generation to succeed:\n${formatValidationErrors(contentApprovalUiWeb.validation)}`);
  }
  assertDeepEqual(
    contentApprovalUiWeb.artifact,
    readJson(path.join(contentApprovalExpectedDir, "proj_ui_web.ui-web-contract.json")),
    "Content-approval UI web contract"
  );

  const contentApprovalDbSnapshot = generateWorkspace(contentApprovalAst, {
    target: "db-schema-snapshot",
    projectionId: "proj_db_sqlite"
  });
  if (!contentApprovalDbSnapshot.ok) {
    throw new Error(`Expected content-approval DB snapshot generation to succeed:\n${formatValidationErrors(contentApprovalDbSnapshot.validation)}`);
  }
  assertDeepEqual(
    contentApprovalDbSnapshot.artifact,
    readJson(path.join(contentApprovalExpectedDir, "proj_db_sqlite.db-schema-snapshot.json")),
    "Content-approval DB schema snapshot"
  );

  const contentApprovalDbSnapshotPostgres = generateWorkspace(contentApprovalAst, {
    target: "db-schema-snapshot",
    projectionId: "proj_db_postgres"
  });
  if (!contentApprovalDbSnapshotPostgres.ok) {
    throw new Error(`Expected content-approval Postgres DB snapshot generation to succeed:\n${formatValidationErrors(contentApprovalDbSnapshotPostgres.validation)}`);
  }
  assertDeepEqual(
    contentApprovalDbSnapshotPostgres.artifact,
    readJson(path.join(contentApprovalExpectedDir, "proj_db_postgres.db-schema-snapshot.json")),
    "Content-approval Postgres DB schema snapshot"
  );

  const contentApprovalNeedsRevisionPlan = generateWorkspace(contentApprovalAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: readJson(path.join(contentApprovalMigrationsDir, "proj_db_postgres.needs-revision-from.snapshot.json")),
    fromSnapshotPath: path.join(contentApprovalMigrationsDir, "proj_db_postgres.needs-revision-from.snapshot.json")
  });
  if (!contentApprovalNeedsRevisionPlan.ok) {
    throw new Error(`Expected content-approval needs-revision migration plan generation to succeed:\n${formatValidationErrors(contentApprovalNeedsRevisionPlan.validation)}`);
  }
  assertDeepEqual(
    contentApprovalNeedsRevisionPlan.artifact,
    readJson(path.join(contentApprovalExpectedDir, "proj_db_postgres.needs-revision.db-migration-plan.json")),
    "Content-approval needs-revision DB migration plan"
  );

  const contentApprovalNeedsRevisionSql = generateWorkspace(contentApprovalAst, {
    target: "sql-migration",
    projectionId: "proj_db_postgres",
    fromSnapshot: readJson(path.join(contentApprovalMigrationsDir, "proj_db_postgres.needs-revision-from.snapshot.json")),
    fromSnapshotPath: path.join(contentApprovalMigrationsDir, "proj_db_postgres.needs-revision-from.snapshot.json")
  });
  if (!contentApprovalNeedsRevisionSql.ok) {
    throw new Error(`Expected content-approval needs-revision SQL migration generation to succeed:\n${formatValidationErrors(contentApprovalNeedsRevisionSql.validation)}`);
  }
  if (
    normalizeText(contentApprovalNeedsRevisionSql.artifact) !==
    normalizeText(readText(path.join(contentApprovalExpectedDir, "proj_db_postgres.needs-revision.migration.sql")))
  ) {
    throw new Error("Generated content-approval needs-revision SQL migration did not match expected output");
  }

  const contentApprovalRuntimeCheckPlan = generateWorkspace(contentApprovalAst, { target: "runtime-check-plan" });
  if (!contentApprovalRuntimeCheckPlan.ok) {
    throw new Error(`Expected content-approval runtime-check plan generation to succeed:\n${formatValidationErrors(contentApprovalRuntimeCheckPlan.validation)}`);
  }
  assertDeepEqual(
    contentApprovalRuntimeCheckPlan.artifact,
    readJson(path.join(contentApprovalExpectedDir, "runtime-check-plan.json")),
    "Content-approval runtime-check plan"
  );

  const contentApprovalAppBundlePlan = generateWorkspace(contentApprovalAst, { target: "app-bundle-plan" });
  if (!contentApprovalAppBundlePlan.ok) {
    throw new Error(`Expected content-approval app-bundle plan generation to succeed:\n${formatValidationErrors(contentApprovalAppBundlePlan.validation)}`);
  }
  assertDeepEqual(
    contentApprovalAppBundlePlan.artifact,
    readJson(path.join(contentApprovalExpectedDir, "app-bundle-plan.json")),
    "Content-approval app-bundle plan"
  );

  const contentApprovalOpenApi = generateWorkspace(contentApprovalAst, { target: "openapi" });
  if (!contentApprovalOpenApi.ok) {
    throw new Error(`Expected content-approval OpenAPI generation to succeed:\n${formatValidationErrors(contentApprovalOpenApi.validation)}`);
  }
  assertDeepEqual(
    contentApprovalOpenApi.artifact,
    readJson(path.join(contentApprovalExpectedDir, "openapi.json")),
    "Content-approval OpenAPI document"
  );

  const contentApprovalBundleTargets = [
    ["hono-server", { target: "hono-server", projectionId: "proj_api" }],
    ["react-app", { target: "sveltekit-app", projectionId: "proj_ui_web" }],
    ["runtime-check-bundle", { target: "runtime-check-bundle" }],
    ["app-bundle", { target: "app-bundle" }]
  ];

  for (const [dirName, options] of contentApprovalBundleTargets) {
    const generatedBundle = generateWorkspace(contentApprovalAst, options);
    if (!generatedBundle.ok) {
      throw new Error(`Expected content-approval ${dirName} generation to succeed:\n${formatValidationErrors(generatedBundle.validation)}`);
    }
    const bundleDir = path.join(contentApprovalExpectedDir, dirName);
    for (const filePath of listRelativeFiles(bundleDir)) {
      if (normalizeText(generatedBundle.artifact[filePath]) !== normalizeText(readText(path.join(bundleDir, filePath)))) {
        throw new Error(`Generated content-approval ${dirName}/${filePath} did not match expected output`);
      }
    }
  }
  {
    const contentApprovalAppBundle = generateWorkspace(contentApprovalAst, { target: "app-bundle" });
    if (!contentApprovalAppBundle.ok) {
      throw new Error(`Expected content-approval app-bundle generation to succeed:\n${formatValidationErrors(contentApprovalAppBundle.validation)}`);
    }
    for (const filePath of listRelativeFiles(path.join(contentApprovalRoot, "apps", "local-stack", "runtime-check"))) {
      const generatedPath = `runtime-check/${filePath}`;
      if (
        normalizeText(contentApprovalAppBundle.artifact[generatedPath]) !==
        normalizeText(readText(path.join(contentApprovalRoot, "apps", "local-stack", "runtime-check", filePath)))
      ) {
        throw new Error(`Generated content-approval committed runtime-check/${filePath} did not match app-bundle output`);
      }
    }
  }

  const todoCreateApi = buildApiRealization(resolved.graph, { capabilityId: "cap_create_task" });
  if (todoCreateApi.endpoint.method !== "POST" || todoCreateApi.requestContract.transport.body.length === 0) {
    throw new Error("Expected ApiRealization to expose a transport-ready POST contract");
  }

  const contentApprovalDbRealization = buildDbRealization(contentApprovalResolved.graph, { projectionId: "proj_db_sqlite" });
  if (
    contentApprovalDbRealization.projection.platform !== "db_sqlite" ||
    !contentApprovalDbRealization.tables.some((table) => table.table === "articles")
  ) {
    throw new Error("Expected DbRealization to expose the content-approval SQLite tables");
  }

  const contentApprovalUiShared = buildUiSharedRealization(contentApprovalResolved.graph, { projectionId: "proj_ui_shared" });
  if (
    !contentApprovalUiShared.screens.some((screen) => screen.id === "article_detail") ||
    !contentApprovalUiShared.screens.some((screen) => screen.id === "article_create")
  ) {
    throw new Error("Expected UiSharedRealization to expose content-approval screens");
  }
  const contentApprovalWebParity = buildWebParityEvidence(
    contentApprovalResolved.graph,
    "proj_ui_web",
    "proj_ui_web_sveltekit"
  );
  if (!contentApprovalWebParity.semanticParity) {
    throw new Error("Expected React and SvelteKit Content Approval web realizations to preserve semantic UI-contract parity");
  }
  if (contentApprovalWebParity.leftProfile !== "react" || contentApprovalWebParity.rightProfile !== "sveltekit") {
    throw new Error("Expected Content Approval web realizations to preserve explicit generator profiles");
  }
  const contentApprovalBackendParity = buildBackendParityEvidence(contentApprovalResolved.graph, "proj_api");
  if (
    !contentApprovalBackendParity.sharedServerContract ||
    !contentApprovalBackendParity.honoTargetMarker ||
    !contentApprovalBackendParity.expressTargetMarker
  ) {
    throw new Error("Expected Content Approval backend targets to preserve shared server-contract semantics across Hono and Express realizations");
  }
  const todoWebParity = buildWebParityEvidence(
    resolved.graph,
    "proj_ui_web_react",
    "proj_ui_web"
  );
  if (!todoWebParity.semanticParity) {
    throw new Error("Expected React and SvelteKit Todo web realizations to preserve semantic UI-contract parity");
  }
  if (todoWebParity.leftProfile !== "react" || todoWebParity.rightProfile !== "sveltekit") {
    throw new Error("Expected Todo web realizations to preserve explicit generator profiles");
  }
  const todoBackendParity = buildBackendParityEvidence(resolved.graph, "proj_api");
  if (
    !todoBackendParity.sharedServerContract ||
    !todoBackendParity.honoTargetMarker ||
    !todoBackendParity.expressTargetMarker
  ) {
    throw new Error("Expected Todo backend targets to preserve shared server-contract semantics across Hono and Express realizations");
  }

  const issuesParity = buildIssuesParityEvidence(issuesResolved.graph);
  if (!issuesParity.web.semanticParity) {
    throw new Error("Expected React and SvelteKit Issues web realizations to preserve semantic UI-contract parity");
  }
  if (
    issuesParity.web.leftProfile !== "react" ||
    issuesParity.web.rightProfile !== "sveltekit"
  ) {
    throw new Error("Expected multi-frontend Issues realizations to preserve explicit generator profiles");
  }
  if (
    !issuesParity.runtime.sharedServerContract ||
    !issuesParity.runtime.honoTargetMarker ||
    !issuesParity.runtime.expressTargetMarker
  ) {
    throw new Error("Expected Issues backend targets to preserve shared server-contract semantics across Hono and Express realizations");
  }

  const contentApprovalBackendRealization = buildBackendRuntimeRealization(contentApprovalResolved.graph, {
    projectionId: "proj_api"
  });
  if (
    contentApprovalBackendRealization.dbProjection.id !== "proj_db_sqlite" ||
    !contentApprovalBackendRealization.lookupRoutes.some((route) => route.route === "/lookups/publications") ||
    contentApprovalBackendRealization.contract.routes.length < 6
  ) {
    throw new Error("Expected BackendRuntimeRealization to expose content-approval routes, lookups, and SQLite preference");
  }

  const invalidAst = parsePath(invalidPath);
  const invalidValidation = validateWorkspace(invalidAst);
  if (invalidValidation.ok || invalidValidation.errorCount !== 3) {
    throw new Error("Expected invalid fixtures to fail with 3 validation errors");
  }

  const invalidShapeAst = parsePath(invalidShapePath);
  const invalidShapeValidation = validateWorkspace(invalidShapeAst);
  if (invalidShapeValidation.ok) {
    throw new Error("Expected invalid shape-transform fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidShapeValidation),
    [
      "includes unknown field 'missing_field'",
      "renames unknown field 'missing_field'",
      "renames multiple fields to 'headline'",
      "overrides unknown field 'ghost'",
      "missing a default value",
      "unknown directive 'bogus'"
    ],
    "Shape-transform validation output"
  );

  const invalidExpressionAst = parsePath(invalidExpressionPath);
  const invalidExpressionValidation = validateWorkspace(invalidExpressionAst);
  if (invalidExpressionValidation.ok) {
    throw new Error("Expected invalid expression fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidExpressionValidation),
    [
      "must be '<field> requires <field> <op> <value>'",
      "must fully specify the implied clause",
      "must be '<field> length <op> <number>'",
      "Missing reference 'cap_missing'",
      "must include a comparison operator",
      "must not be empty"
    ],
    "Expression validation output"
  );

  const invalidHttpResponsesAst = parsePath(invalidHttpResponsesPath);
  const invalidHttpResponsesValidation = validateWorkspace(invalidHttpResponsesAst);
  if (invalidHttpResponsesValidation.ok) {
    throw new Error("Expected invalid http-responses fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidHttpResponsesValidation),
    [
      "must include 'item' for mode 'cursor'",
      "has invalid sort direction 'sideways'",
      "must use default <= max for 'limit'",
      "references unknown input field 'ghost' for cursor request_after",
      "references unknown input field 'missing_limit' for limit",
      "references unknown output field 'missing_out' for sort",
      "has invalid total included value 'maybe'"
    ],
    "HTTP response validation output"
  );

  const invalidHttpCacheAst = parsePath(invalidHttpCachePath);
  const invalidHttpCacheValidation = validateWorkspace(invalidHttpCacheAst);
  if (invalidHttpCacheValidation.ok) {
    throw new Error("Expected invalid http-cache fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidHttpCacheValidation),
    [
      "http_cache for 'cap_get_task' has invalid required value 'maybe'",
      "http_cache for 'cap_get_task' must use 304 for 'not_modified'",
      "http_cache references unknown output field 'ghost' on cap_get_task",
      "http_cache for 'cap_update_task' requires an HTTP GET realization, found 'PATCH'"
    ],
    "HTTP cache validation output"
  );

  const invalidHttpApiAst = parsePath(invalidHttpApiPath);
  const invalidHttpApiValidation = validateWorkspace(invalidHttpApiAst);
  if (invalidHttpApiValidation.ok) {
    throw new Error("Expected invalid http-api-semantics fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidHttpApiValidation),
    [
      "http_async for 'cap_export_tasks' must include 'status_capability'",
      "http_status references unknown output field 'ghost' for 'state_field' on cap_get_task_export_job",
      "http_status for 'cap_get_task_export_job' references missing download capability 'cap_missing_download'",
      "http_download for 'cap_download_task_export' must use a valid media type",
      "http_download for 'cap_download_task_export' has invalid disposition 'stream'",
      "http_authz for 'cap_export_tasks' has invalid ownership 'team'",
      "http_callbacks references unknown input field 'missing_callback' on cap_export_tasks",
      "http_callbacks for 'cap_export_tasks' has invalid method 'GET'",
      "http_callbacks for 'cap_export_tasks' references missing shape 'shape_missing'",
      "http_callbacks for 'cap_export_tasks' must use a 3-digit success status"
    ],
    "HTTP API semantics validation output"
  );

  const invalidUiAst = parsePath(invalidUiPath);
  const invalidUiValidation = validateWorkspace(invalidUiAst);
  if (invalidUiValidation.ok) {
    throw new Error("Expected invalid UI fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidUiValidation),
    [
      "ui_screens for 'bad_list' references missing capability 'cap_missing' for 'load'",
      "ui_screens for 'form_without_submit' kind 'form' requires 'submit'",
      "ui_collections references unknown screen 'missing_screen'",
      "ui_collections for 'bad_list' has invalid pagination 'drift'",
      "ui_collections for 'bad_list' has invalid sort direction 'sideways'",
      "ui_actions references missing capability 'cap_missing'",
      "ui_actions for 'bad_list' has invalid prominence 'giant'",
      "ui_visibility references missing capability 'cap_missing'",
      "ui_visibility for 'cap_missing' has invalid predicate 'team'"
    ],
    "UI validation output"
  );

  const invalidUiWebAst = parsePath(invalidUiWebPath);
  const invalidUiWebValidation = validateWorkspace(invalidUiWebAst);
  if (invalidUiWebValidation.ok) {
    throw new Error("Expected invalid UI web fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidUiWebValidation),
    [
      "ui_routes for 'stub_home' must use an absolute path",
      "ui_routes references unknown screen 'ghost_screen'",
      "ui_routes has duplicate path '/same'",
      "ui_web references unknown screen 'ghost_screen'",
      "ui_web references missing capability 'cap_missing'",
      "ui_web for action 'cap_missing' has invalid confirm mode 'popup'",
      "generator_defaults has unsupported profile 'angular'",
      "generator_defaults has unsupported language 'elm'",
      "generator_defaults has unsupported styling 'sass'"
    ],
    "UI web validation output"
  );

  const invalidDbAst = parsePath(invalidDbPath);
  const invalidDbValidation = validateWorkspace(invalidDbAst);
  if (invalidDbValidation.ok) {
    throw new Error("Expected invalid DB fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidDbValidation),
    [
      "db_tables references missing entity 'entity_missing'",
      "db_tables has duplicate table name 'dummies'",
      "db_columns references unknown field 'ghost' on entity_db_dummy",
      "db_keys for 'entity_db_dummy' has invalid key type 'shard'",
      "db_indexes for 'entity_db_dummy' must include a non-empty field list",
      "db_indexes for 'entity_db_dummy' has invalid index type 'gin'",
      "db_relations references unknown field 'ghost' on entity_db_dummy",
      "db_relations references missing target entity 'entity_missing'",
      "db_relations for 'entity_db_dummy' has invalid on_delete 'explode'",
      "db_lifecycle references unknown field 'ghost' on entity_db_dummy",
      "generator_defaults has unsupported profile 'mysql_sql'"
    ],
    "DB validation output"
  );

  const invalidDocsAst = parsePath(invalidDocsPath);
  const invalidDocsValidation = validateWorkspace(invalidDocsAst);
  if (invalidDocsValidation.ok) {
    throw new Error("Expected invalid docs fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidDocsValidation),
    [
      "Unsupported doc kind 'handbook'",
      "Unsupported doc status 'active'",
      "Doc metadata 'related_entities' must be a list",
      "Doc metadata 'review_required' must be a boolean"
    ],
    "Docs validation output"
  );

  const invalidActorRoleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-invalid-actor-role-"));
  writeGeneratedFiles(invalidActorRoleRoot, {
    "actors/actor-user.tg": `actor actor_user {
  name "User"
  description "Fixture actor"

  status active
}
`,
    "roles/role-reviewer.tg": `role role_reviewer {
  name "Reviewer"
  description "Fixture role"

  status active
}
`,
    "entities/entity-item.tg": `entity entity_item {
  name "Item"
  description "Fixture entity"

  fields {
    id uuid required
  }

  status active
}
`,
    "shapes/shape-input-item.tg": `shape shape_input_item {
  name "Item Input"
  description "Fixture input shape"

  fields {
    title string required
  }

  status active
}
`,
    "shapes/shape-output-item.tg": `shape shape_output_item {
  name "Item Output"
  description "Fixture output shape"

  fields {
    id uuid required
  }

  status active
}
`,
    "capabilities/cap-publish-item.tg": `capability cap_publish_item {
  name "Publish Item"
  description "Publishes an item"

  actors [actor_missing]
  roles [actor_user]
  updates [entity_item]
  input [shape_input_item]
  output [shape_output_item]

  status active
}
`,
    "rules/rule-reviewer-access.tg": `rule rule_reviewer_access {
  name "Reviewer Access"
  description "Only reviewers may review"

  applies_to [cap_publish_item]
  actors [role_reviewer]
  roles [role_missing]
  status active
}
`
  });
  const invalidActorRoleAst = parsePath(invalidActorRoleRoot);
  const invalidActorRoleValidation = validateWorkspace(invalidActorRoleAst);
  if (invalidActorRoleValidation.ok) {
    throw new Error("Expected invalid actor/role fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidActorRoleValidation),
    [
      "Missing reference 'actor_missing' in field 'actors'",
      "Field 'roles' on capability cap_publish_item must reference role, found actor 'actor_user'",
      "Field 'actors' on rule rule_reviewer_access must reference actor, found role 'role_reviewer'",
      "Missing reference 'role_missing' in field 'roles'"
    ],
    "Actor/role validation output"
  );

  const invalidActorRoleDocsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-invalid-actor-role-docs-"));
  writeGeneratedFiles(invalidActorRoleDocsRoot, {
    "actors/actor-author.tg": `actor actor_author {
  name "Author"
  description "Fixture actor"

  status active
}
`,
    "roles/role-author.tg": `role role_author {
  name "Author"
  description "Fixture role"

  status active
}
`,
    "entities/entity-article.tg": `entity entity_article {
  name "Article"
  description "Fixture article"

  fields {
    id uuid required
  }

  status active
}
`,
    "capabilities/cap-update-article.tg": `capability cap_update_article {
  name "Update Article"
  description "Updates an article"

  actors [actor_author]
  roles [role_author]
  updates [entity_article]

  status active
}
`,
    "docs/workflows/article-flow.md": `---
id: article_flow
kind: workflow
title: Article Flow
status: canonical
related_entities:
  - entity_article
related_capabilities:
  - cap_update_article
---

Canonical workflow fixture.
`,
    "docs/journeys/article-edit.md": `---
id: article_edit
kind: journey
title: Article Edit
status: canonical
related_actors:
  - actor_missing
  - role_author
related_roles:
  - role_missing
  - actor_author
related_workflows:
  - article_flow
related_capabilities:
  - cap_update_article
---

Canonical journey fixture.
`
  });
  const invalidActorRoleDocsAst = parsePath(invalidActorRoleDocsRoot);
  const invalidActorRoleDocsValidation = validateWorkspace(invalidActorRoleDocsAst);
  if (invalidActorRoleDocsValidation.ok) {
    throw new Error("Expected invalid actor/role doc fixtures to fail validation");
  }
  assertIncludes(
    formatValidationErrors(invalidActorRoleDocsValidation),
    [
      "Doc 'article_edit' references missing actor 'actor_missing'",
      "Doc 'article_edit' references missing actor 'role_author'",
      "Doc 'article_edit' references missing role 'role_missing'",
      "Doc 'article_edit' references missing role 'actor_author'"
    ],
    "Actor/role doc validation output"
  );

  const generatedSqlitePrisma = generateWorkspace(todoAst, {
    target: "prisma-schema",
    projectionId: "proj_db_sqlite"
  });
  if (!generatedSqlitePrisma.ok) {
    throw new Error(`Expected SQLite Prisma generation to succeed:\n${formatValidationErrors(generatedSqlitePrisma.validation)}`);
  }
  if (
    !generatedSqlitePrisma.artifact.includes('provider = "sqlite"') ||
    !generatedSqlitePrisma.artifact.includes("model Task")
  ) {
    throw new Error("Expected SQLite Prisma generation to emit a runnable SQLite schema");
  }

  const unsupportedPlan = generateWorkspace(todoAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: readJson(path.join(migrationsDir, "proj_db_postgres.unsupported-from.snapshot.json")),
    fromSnapshotPath: path.join(migrationsDir, "proj_db_postgres.unsupported-from.snapshot.json")
  });
  if (!unsupportedPlan.ok) {
    throw new Error(`Expected unsupported migration plan generation to return a manual plan:\n${formatValidationErrors(unsupportedPlan.validation)}`);
  }
  if (unsupportedPlan.artifact.supported || unsupportedPlan.artifact.manual.length === 0) {
    throw new Error("Expected unsupported migration plan to require manual intervention");
  }
  assertIncludes(
    stableStringify(unsupportedPlan.artifact.manual),
    ["drop_column", "alter_column"],
    "Unsupported migration manual actions"
  );

  const contentApprovalEnumRemovalPlan = generateWorkspace(contentApprovalAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: {
      ...contentApprovalDbSnapshotPostgres.artifact,
      enums: (contentApprovalDbSnapshotPostgres.artifact.enums || []).map((entry) =>
        entry.id === "article_status"
          ? {
              ...entry,
              values: [...entry.values, "obsolete"]
            }
          : entry
      )
    },
    fromSnapshotPath: "content-approval.enum-removal.snapshot.json"
  });
  if (!contentApprovalEnumRemovalPlan.ok) {
    throw new Error(`Expected content-approval enum removal migration plan generation to return a manual plan:\n${formatValidationErrors(contentApprovalEnumRemovalPlan.validation)}`);
  }
  if (contentApprovalEnumRemovalPlan.artifact.supported) {
    throw new Error("Expected content-approval enum removal migration plan to require manual intervention");
  }
  assertIncludes(
    stableStringify(contentApprovalEnumRemovalPlan.artifact.manual),
    ["alter_enum", "article_status", "non-additive"],
    "Content-approval enum removal manual actions"
  );

  const contentApprovalEnumRenamePlan = generateWorkspace(contentApprovalAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: {
      ...contentApprovalDbSnapshotPostgres.artifact,
      enums: (contentApprovalDbSnapshotPostgres.artifact.enums || []).map((entry) =>
        entry.id === "article_status"
          ? {
              ...entry,
              values: ["draft", "submitted", "changes_requested", "approved", "rejected"]
            }
          : entry
      )
    },
    fromSnapshotPath: "content-approval.enum-rename.snapshot.json"
  });
  if (!contentApprovalEnumRenamePlan.ok) {
    throw new Error(`Expected content-approval enum rename migration plan generation to return a manual plan:\n${formatValidationErrors(contentApprovalEnumRenamePlan.validation)}`);
  }
  if (contentApprovalEnumRenamePlan.artifact.supported) {
    throw new Error("Expected content-approval enum rename migration plan to require manual intervention");
  }
  assertIncludes(
    stableStringify(contentApprovalEnumRenamePlan.artifact.manual),
    ["alter_enum", "article_status", "non-additive"],
    "Content-approval enum rename manual actions"
  );

  const contentApprovalEnumReorderPlan = generateWorkspace(contentApprovalAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: {
      ...contentApprovalDbSnapshotPostgres.artifact,
      enums: (contentApprovalDbSnapshotPostgres.artifact.enums || []).map((entry) =>
        entry.id === "article_status"
          ? {
              ...entry,
              values: ["draft", "submitted", "approved", "needs_revision", "rejected"]
            }
          : entry
      )
    },
    fromSnapshotPath: "content-approval.enum-reorder.snapshot.json"
  });
  if (!contentApprovalEnumReorderPlan.ok) {
    throw new Error(`Expected content-approval enum reorder migration plan generation to return a manual plan:\n${formatValidationErrors(contentApprovalEnumReorderPlan.validation)}`);
  }
  if (contentApprovalEnumReorderPlan.artifact.supported) {
    throw new Error("Expected content-approval enum reorder migration plan to require manual intervention");
  }
  assertIncludes(
    stableStringify(contentApprovalEnumReorderPlan.artifact.manual),
    ["alter_enum", "article_status", "non-additive"],
    "Content-approval enum reorder manual actions"
  );

  const todoProjectOwnerRetargetPlan = generateWorkspace(todoAst, {
    target: "db-migration-plan",
    projectionId: "proj_db_postgres",
    fromSnapshot: {
      ...generatedDbSnapshotPg.artifact,
      tables: (generatedDbSnapshotPg.artifact.tables || []).map((table) =>
        table.table === "projects"
          ? {
              ...table,
              relations: (table.relations || []).map((relation) =>
                relation.field === "owner_id"
                  ? {
                      ...relation,
                      target: {
                        id: "entity_project",
                        field: "id"
                      }
                    }
                  : relation
              )
            }
          : table
      )
    },
    fromSnapshotPath: "todo.project-owner-retarget.snapshot.json"
  });
  if (!todoProjectOwnerRetargetPlan.ok) {
    throw new Error(`Expected Todo project-owner retarget migration plan generation to return a manual plan:\n${formatValidationErrors(todoProjectOwnerRetargetPlan.validation)}`);
  }
  if (todoProjectOwnerRetargetPlan.artifact.supported) {
    throw new Error("Expected Todo project-owner retarget migration plan to require manual intervention");
  }
  assertIncludes(
    stableStringify(todoProjectOwnerRetargetPlan.artifact.manual),
    ["drop_foreign_key", "projects", "owner_id"],
    "Todo project-owner retarget manual actions"
  );
  assertIncludes(
    stableStringify(todoProjectOwnerRetargetPlan.artifact.operations),
    ["add_foreign_key", "projects", "owner_id", "entity_user"],
    "Todo project-owner retarget additive operations"
  );

  if (!generatedAdditiveMigrationPlan.artifact.supported || generatedAdditiveMigrationPlan.artifact.operations.length === 0) {
    throw new Error("Expected additive migration plan generation to stay supported and produce operations");
  }
  assertIncludes(
    stableStringify(generatedPriorityMigrationPlan.artifact.operations),
    ["create_enum", "task_priority", "add_column", "priority"],
    "Todo priority additive migration operations"
  );
  assertIncludes(
    stableStringify(contentApprovalNeedsRevisionPlan.artifact.operations),
    ["add_enum_value", "needs_revision", "approved", "add_column", "revision_requested_at"],
    "Content-approval enum expansion migration operations"
  );

  const sqliteLifecycleBundle = generateWorkspace(contentApprovalAst, {
    target: "db-lifecycle-bundle",
    projectionId: "proj_db_sqlite"
  });
  if (!sqliteLifecycleBundle.ok) {
    throw new Error(`Expected content-approval SQLite lifecycle bundle generation to succeed:\n${formatValidationErrors(sqliteLifecycleBundle.validation)}`);
  }
  assertIncludes(
    sqliteLifecycleBundle.artifact["scripts/db-common.sh"],
    [
      "infer_current_snapshot_from_live_tables",
      "reconcile_existing_database_snapshot",
      "examples/generated/content-approval/topogram"
    ],
    "SQLite lifecycle bundle"
  );

  const sqliteMigrationPlan = buildDbMigrationPlanRealization(contentApprovalResolved.graph, {
    projectionId: "proj_db_sqlite",
    fromSnapshot: readJson(path.join(migrationsDir, "empty.snapshot.json")),
    fromSnapshotPath: path.join(migrationsDir, "empty.snapshot.json")
  });
  if (!sqliteMigrationPlan.supported || sqliteMigrationPlan.operations.length === 0) {
    throw new Error("Expected SQLite migration-plan realization to remain supported from an empty snapshot");
  }

  const todoSqliteLifecycleBundle = generateWorkspace(todoAst, {
    target: "db-lifecycle-bundle",
    projectionId: "proj_db_sqlite"
  });
  if (!todoSqliteLifecycleBundle.ok) {
    throw new Error(`Expected Todo SQLite lifecycle bundle generation to succeed:\n${formatValidationErrors(todoSqliteLifecycleBundle.validation)}`);
  }

  const lifecycleTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-db-lifecycle-"));

  const todoLifecycleRoot = path.join(lifecycleTempRoot, "todo", "app", "db");
  writeLifecycleBundle(todoLifecycleRoot, todoSqliteLifecycleBundle.artifact);
  const todoLifecycleDatabase = path.join(lifecycleTempRoot, "todo", "var", "todo.sqlite");
  const todoPrioritySnapshotSqlite = deriveTodoPrioritySqliteSnapshot(todoAst);
  fs.mkdirSync(path.join(todoLifecycleRoot, "state"), { recursive: true });
  fs.writeFileSync(
    path.join(todoLifecycleRoot, "state", "current.snapshot.json"),
    `${JSON.stringify(todoPrioritySnapshotSqlite, null, 2)}\n`,
    "utf8"
  );
  applySqliteSchemaSnapshot(todoLifecycleDatabase, todoPrioritySnapshotSqlite);
  runShellScript(todoLifecycleRoot, "./scripts/db-migrate.sh", {
    DATABASE_URL: "file:./var/todo.sqlite",
    TOPOGRAM_REPO_ROOT: repoRoot,
    TOPOGRAM_INPUT_PATH: todoPath,
    TOPOGRAM_SKIP_RUNTIME_CLIENT_REFRESH: "1"
  });
  const todoPriorityPlanJson = readJson(path.join(todoLifecycleRoot, "state", "migration.plan.json"));
  assertIncludes(
    stableStringify(todoPriorityPlanJson.operations),
    ["create_enum", "task_priority", "add_column", "priority"],
    "Todo SQLite lifecycle migration plan"
  );
  const todoPriorityCurrentSnapshot = readJson(path.join(todoLifecycleRoot, "state", "current.snapshot.json"));
  if (!(todoPriorityCurrentSnapshot.enums || []).some((entry) => entry.id === "task_priority")) {
    throw new Error("Expected Todo SQLite lifecycle migration to persist the task_priority enum in current.snapshot.json");
  }
  const todoPriorityColumns = querySqlite(todoLifecycleDatabase, "pragma table_info(tasks);");
  assertIncludes(
    todoPriorityColumns,
    ["priority", "medium"],
    "Todo SQLite lifecycle migrated tasks table"
  );

  const contentApprovalLifecycleRoot = path.join(lifecycleTempRoot, "content-approval", "app", "db");
  writeLifecycleBundle(contentApprovalLifecycleRoot, sqliteLifecycleBundle.artifact);
  const contentApprovalLifecycleDatabase = path.join(lifecycleTempRoot, "content-approval", "var", "content-approval.sqlite");
  const contentApprovalNeedsRevisionSqliteSnapshot = deriveContentApprovalNeedsRevisionSqliteSnapshot(contentApprovalAst);
  fs.mkdirSync(path.join(contentApprovalLifecycleRoot, "state"), { recursive: true });
  fs.writeFileSync(
    path.join(contentApprovalLifecycleRoot, "state", "current.snapshot.json"),
    `${JSON.stringify(contentApprovalNeedsRevisionSqliteSnapshot, null, 2)}\n`,
    "utf8"
  );
  applySqliteSchemaSnapshot(contentApprovalLifecycleDatabase, contentApprovalNeedsRevisionSqliteSnapshot);
  runShellScript(contentApprovalLifecycleRoot, "./scripts/db-migrate.sh", {
    DATABASE_URL: "file:./var/content-approval.sqlite",
    TOPOGRAM_REPO_ROOT: repoRoot,
    TOPOGRAM_INPUT_PATH: contentApprovalPath,
    TOPOGRAM_SKIP_RUNTIME_CLIENT_REFRESH: "1"
  });
  const contentApprovalLifecyclePlanJson = readJson(path.join(contentApprovalLifecycleRoot, "state", "migration.plan.json"));
  assertIncludes(
    stableStringify(contentApprovalLifecyclePlanJson.operations),
    ["add_enum_value", "needs_revision", "add_column", "revision_requested_at"],
    "Content-approval SQLite lifecycle migration plan"
  );
  const contentApprovalLifecycleSnapshot = readJson(path.join(contentApprovalLifecycleRoot, "state", "current.snapshot.json"));
  const articleStatusEnum = (contentApprovalLifecycleSnapshot.enums || []).find((entry) => entry.id === "article_status");
  if (!articleStatusEnum || !articleStatusEnum.values.includes("needs_revision")) {
    throw new Error("Expected content-approval SQLite lifecycle migration to persist needs_revision in current.snapshot.json");
  }
  const contentApprovalArticleColumns = querySqlite(contentApprovalLifecycleDatabase, "pragma table_info(articles);");
  assertIncludes(
    contentApprovalArticleColumns,
    ["revision_requested_at"],
    "Content-approval SQLite lifecycle migrated articles table"
  );

  const contentApprovalBootstrapRoot = path.join(lifecycleTempRoot, "content-approval-bootstrap", "app", "db");
  writeLifecycleBundle(contentApprovalBootstrapRoot, sqliteLifecycleBundle.artifact);
  const contentApprovalBootstrapDatabase = path.join(lifecycleTempRoot, "content-approval-bootstrap", "var", "content-approval.sqlite");
  runShellScript(contentApprovalBootstrapRoot, "./scripts/db-bootstrap-or-migrate.sh", {
    DATABASE_URL: "file:./var/content-approval.sqlite",
    TOPOGRAM_REPO_ROOT: repoRoot,
    TOPOGRAM_INPUT_PATH: contentApprovalPath,
    TOPOGRAM_SKIP_RUNTIME_CLIENT_REFRESH: "1"
  });
  if (!fs.existsSync(path.join(contentApprovalBootstrapRoot, "state", "current.snapshot.json"))) {
    throw new Error("Expected content-approval SQLite bootstrap to persist a current.snapshot.json file");
  }
  const bootstrapTables = querySqlite(contentApprovalBootstrapDatabase, "select json_group_array(name) from (select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name);");
  assertIncludes(
    bootstrapTables,
    ['"articles"', '"publications"', '"users"'],
    "Content-approval SQLite bootstrap tables"
  );

  const contentApprovalUnsupportedLifecycleRoot = path.join(lifecycleTempRoot, "content-approval-unsupported", "app", "db");
  writeLifecycleBundle(contentApprovalUnsupportedLifecycleRoot, sqliteLifecycleBundle.artifact);
  const contentApprovalUnsupportedDatabase = path.join(lifecycleTempRoot, "content-approval-unsupported", "var", "content-approval.sqlite");
  const contentApprovalUnsafeSnapshot = {
    ...contentApprovalDbSnapshot.artifact,
    enums: (contentApprovalDbSnapshot.artifact.enums || []).map((entry) =>
      entry.id === "article_status"
        ? {
            ...entry,
            values: ["draft", "submitted", "approved", "needs_revision", "rejected"]
          }
        : entry
    )
  };
  fs.mkdirSync(path.join(contentApprovalUnsupportedLifecycleRoot, "state"), { recursive: true });
  fs.writeFileSync(
    path.join(contentApprovalUnsupportedLifecycleRoot, "state", "current.snapshot.json"),
    `${JSON.stringify(contentApprovalUnsafeSnapshot, null, 2)}\n`,
    "utf8"
  );
  applySqliteSchemaSnapshot(contentApprovalUnsupportedDatabase, contentApprovalUnsafeSnapshot);
  const unsupportedLifecycleRun = runShellScriptExpectFailure(contentApprovalUnsupportedLifecycleRoot, "./scripts/db-migrate.sh", {
    DATABASE_URL: "file:./var/content-approval.sqlite",
    TOPOGRAM_REPO_ROOT: repoRoot,
    TOPOGRAM_INPUT_PATH: contentApprovalPath,
    TOPOGRAM_SKIP_RUNTIME_CLIENT_REFRESH: "1"
  });
  assertIncludes(
    `${unsupportedLifecycleRun.stderr}\n${unsupportedLifecycleRun.stdout}`,
    ["Manual migration required", "alter_enum"],
    "Content-approval SQLite unsupported lifecycle migration output"
  );
  const unsupportedLifecyclePlan = readJson(path.join(contentApprovalUnsupportedLifecycleRoot, "state", "migration.plan.json"));
  if (unsupportedLifecyclePlan.supported) {
    throw new Error("Expected content-approval unsupported SQLite lifecycle migration plan to require manual intervention");
  }
  if (fs.existsSync(path.join(contentApprovalUnsupportedLifecycleRoot, "state", "migration.sql"))) {
    throw new Error("Expected unsupported SQLite lifecycle migration to stop before writing migration.sql");
  }

  const todoUnsupportedRelationLifecycleRoot = path.join(lifecycleTempRoot, "todo-unsupported-relation", "app", "db");
  writeLifecycleBundle(todoUnsupportedRelationLifecycleRoot, todoSqliteLifecycleBundle.artifact);
  const todoUnsupportedRelationDatabase = path.join(lifecycleTempRoot, "todo-unsupported-relation", "var", "todo.sqlite");
  const todoUnsafeRelationSnapshot = {
    ...generatedDbSnapshotSqlite.artifact,
    tables: (generatedDbSnapshotSqlite.artifact.tables || []).map((table) =>
      table.table === "projects"
        ? {
            ...table,
            relations: (table.relations || []).map((relation) =>
              relation.field === "owner_id"
                ? {
                    ...relation,
                    target: {
                      id: "entity_project",
                      field: "id"
                    }
                  }
                : relation
            )
          }
        : table
    )
  };
  fs.mkdirSync(path.join(todoUnsupportedRelationLifecycleRoot, "state"), { recursive: true });
  fs.writeFileSync(
    path.join(todoUnsupportedRelationLifecycleRoot, "state", "current.snapshot.json"),
    `${JSON.stringify(todoUnsafeRelationSnapshot, null, 2)}\n`,
    "utf8"
  );
  applySqliteSchemaSnapshot(todoUnsupportedRelationDatabase, todoUnsafeRelationSnapshot);
  const todoUnsupportedRelationRun = runShellScriptExpectFailure(todoUnsupportedRelationLifecycleRoot, "./scripts/db-migrate.sh", {
    DATABASE_URL: "file:./var/todo.sqlite",
    TOPOGRAM_REPO_ROOT: repoRoot,
    TOPOGRAM_INPUT_PATH: todoPath,
    TOPOGRAM_SKIP_RUNTIME_CLIENT_REFRESH: "1"
  });
  assertIncludes(
    `${todoUnsupportedRelationRun.stderr}\n${todoUnsupportedRelationRun.stdout}`,
    ["Manual migration required", "drop_foreign_key", "owner_id"],
    "Todo SQLite unsupported relation migration output"
  );
  const todoUnsupportedRelationPlan = readJson(path.join(todoUnsupportedRelationLifecycleRoot, "state", "migration.plan.json"));
  if (todoUnsupportedRelationPlan.supported) {
    throw new Error("Expected Todo unsupported relation SQLite lifecycle migration plan to require manual intervention");
  }
  assertIncludes(
    stableStringify(todoUnsupportedRelationPlan.manual),
    ["drop_foreign_key", "projects", "owner_id"],
    "Todo SQLite unsupported relation manual plan"
  );
  assertIncludes(
    stableStringify(todoUnsupportedRelationPlan.operations),
    ["add_foreign_key", "projects", "owner_id", "entity_user"],
    "Todo SQLite unsupported relation additive plan"
  );
  if (fs.existsSync(path.join(todoUnsupportedRelationLifecycleRoot, "state", "migration.sql"))) {
    throw new Error("Expected Todo unsupported relation SQLite lifecycle migration to stop before writing migration.sql");
  }

  const surveyFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-ui-survey-"));
  writeSurveyFixture(surveyFixtureRoot, {
    version: 2,
    repos: [
      {
        id: "web-fixture",
        category: "fixtures",
        platform_family: "web",
        ui_runtime: "web_app",
        clone_strategy: "shallow_filtered",
        survey_priority: "core",
        repo: "fixtures/web-fixture",
        path: "web/web-fixture"
      },
      {
        id: "android-fixture",
        category: "fixtures",
        platform_family: "android",
        ui_runtime: "jetpack_compose",
        clone_strategy: "shallow_filtered",
        survey_priority: "core",
        repo: "fixtures/android-fixture",
        path: "android/android-fixture"
      },
      {
        id: "ios-fixture",
        category: "fixtures",
        platform_family: "ios",
        ui_runtime: "swiftui",
        clone_strategy: "shallow_filtered",
        survey_priority: "core",
        repo: "fixtures/ios-fixture",
        path: "ios/ios-fixture"
      },
      {
        id: "desktop-fixture",
        category: "fixtures",
        platform_family: "desktop",
        ui_runtime: "electron",
        clone_strategy: "shallow_filtered",
        survey_priority: "core",
        repo: "fixtures/desktop-fixture",
        path: "desktop/desktop-fixture"
      },
      {
        id: "missing-fixture",
        category: "fixtures",
        platform_family: "android",
        ui_runtime: "xml_views",
        clone_strategy: "shallow_filtered",
        survey_priority: "extended",
        repo: "fixtures/missing-fixture",
        path: "android/missing-fixture"
      }
    ]
  });
  writeGeneratedFiles(surveyFixtureRoot, {
    "web/web-fixture/package.json": "{\n  \"name\": \"web-fixture\"\n}\n",
    "web/web-fixture/src/App.tsx": `
      export default function App() {
        return (
          <aside className="sidebar">
            <div className="breadcrumb">Projects</div>
            <table />
            <div className="modal">Open</div>
          </aside>
        );
      }
    `,
    "android/android-fixture/app/src/main/java/dev/example/MainScreen.kt": `
      import androidx.compose.material3.Scaffold
      import androidx.compose.material3.NavigationBar
      import androidx.compose.material3.ModalBottomSheet
      import androidx.compose.material3.FloatingActionButton
      import androidx.compose.material3.SearchBar
      import androidx.compose.material.pullrefresh.pullRefresh
      import androidx.navigation.compose.NavHost
      import androidx.compose.foundation.lazy.LazyColumn

      @Composable
      fun MainScreen() {
        Scaffold(
          bottomBar = { NavigationBar { } },
          floatingActionButton = { FloatingActionButton(onClick = {}) { } }
        ) {
          ModalBottomSheet(onDismissRequest = {}) {
            SearchBar(query = "", onQueryChange = {}, onSearch = {}) {}
            LazyColumn {}
          }
          val state = pullRefresh(true, {})
          NavHost(navController = navController, startDestination = "home") {}
        }
      }
    `,
    "ios/ios-fixture/App/MainView.swift": `
      import SwiftUI

      struct MainView: View {
        var body: some View {
          NavigationStack {
            TabView {
              List {
                Text("Item")
              }
              .tabItem { Text("Home") }
            }
            .toolbar {
              ToolbarItem(placement: .primaryAction) {
                Button("Open") {}
              }
            }
            .sheet(isPresented: .constant(false)) {
              Form {
                Text("Sheet")
              }
            }
            .searchable(text: .constant(""))
            .refreshable {}
          }
        }
      }
    `,
    "desktop/desktop-fixture/package.json": "{\n  \"name\": \"desktop-fixture\",\n  \"dependencies\": {\n    \"electron\": \"1.0.0\"\n  }\n}\n",
    "desktop/desktop-fixture/src/main.tsx": `
      import { Menu, BrowserWindow } from "electron";
      import SplitPane from "react-split-pane";
      import { DataGrid } from "react-data-grid";

      Menu.buildFromTemplate([]);
      const commandPalette = "command palette";
      const inspector = "Inspector";
      const windowRef = new BrowserWindow();

      export function Workspace() {
        return (
          <SplitPane>
            <aside>Sidebar</aside>
            <DataGrid columns={[]} rows={[]} />
            <div>{commandPalette}{inspector}{windowRef ? "open" : "closed"}</div>
          </SplitPane>
        );
      }
    `
  });
  const surveyFixtureResults = analyzeSurveyAtRoot(surveyFixtureRoot);
  if (surveyFixtureResults.findings.stats.corpus_repo_count !== 5) {
    throw new Error("Expected UI survey fixture to report five repos in the corpus");
  }
  if (surveyFixtureResults.findings.stats.analyzed_repo_count !== 4) {
    throw new Error("Expected UI survey fixture to analyze four present repos");
  }
  if (surveyFixtureResults.findings.stats.missing_repo_count !== 1) {
    throw new Error("Expected UI survey fixture to record one missing repo");
  }
  if (surveyFixtureResults.findings.by_platform.android.repo_count !== 1) {
    throw new Error("Expected UI survey fixture to analyze one Android repo");
  }
  assertIncludes(
    stableStringify(surveyFixtureResults.findings.by_platform.android.features),
    ['"bottom_sheet"', '"fab"', '"list"', '"pull_to_refresh"', '"search"'],
    "Android survey fixture features"
  );
  assertIncludes(
    stableStringify(surveyFixtureResults.findings.by_platform.android.navigation_patterns),
    ['"bottom_tabs"', '"stack_navigation"'],
    "Android survey fixture navigation patterns"
  );
  if (surveyFixtureResults.findings.by_platform.ios.repo_count !== 1) {
    throw new Error("Expected UI survey fixture to analyze one iOS repo");
  }
  assertIncludes(
    stableStringify(surveyFixtureResults.findings.by_platform.ios.navigation_patterns),
    ['"bottom_tabs"', '"stack_navigation"'],
    "iOS survey fixture navigation patterns"
  );
  assertIncludes(
    stableStringify(surveyFixtureResults.findings.by_platform.ios.features),
    ['"form"', '"list"', '"pull_to_refresh"', '"search"', '"sheet"', '"table"', '"toolbar"'],
    "iOS survey fixture features"
  );
  if (surveyFixtureResults.findings.by_platform.desktop.repo_count !== 1) {
    throw new Error("Expected UI survey fixture to analyze one desktop repo");
  }
  assertIncludes(
    stableStringify(surveyFixtureResults.findings.by_platform.desktop.features),
    ['"command_palette"', '"data_grid"', '"inspector_pane"', '"menu_bar"', '"multi_window"', '"resizable_split"'],
    "Desktop survey fixture features"
  );
  if (surveyFixtureResults.findings.by_platform.web.repo_count !== 1) {
    throw new Error("Expected UI survey fixture to analyze one web repo");
  }
  assertIncludes(
    stableStringify(surveyFixtureResults.findings.by_platform.web.features),
    ['"modal"', '"table"'],
    "Web survey fixture features"
  );
  assertIncludes(
    surveyFixtureResults.summary,
    ["Corpus repos: 5", "Present and analyzed repos: 4", "Missing or deferred repos: 1"],
    "UI survey summary"
  );
  assertIncludes(
    surveyFixtureResults.masterReport,
    ["## Cross-Platform Comparison", "## Repo Appendix", "missing_or_deferred"],
    "UI survey master report"
  );
  if (!Array.isArray(surveyFixtureResults.findings.coverage_matrix) || surveyFixtureResults.findings.coverage_matrix.length === 0) {
    throw new Error("Expected UI survey fixture to include a non-empty coverage matrix");
  }
  assertIncludes(
    surveyFixtureResults.coverageReport,
    ["# Topogram UI Coverage", "| Pattern | Source | Surveyed | DSL | Import | Draft | Web Render | Proof |"],
    "UI survey coverage report"
  );

  if (process.env.TOPOGRAM_SKIP_PRODUCT_APP_TESTS !== "1") {
    const productAppRoot = path.join(repoRoot, "examples", "maintained", "proof-app");
    runNodeScript(productAppRoot, "scripts/compile-check.mjs");
    runNodeScript(productAppRoot, "scripts/smoke.mjs");
    runNodeScript(productAppRoot, "scripts/runtime-check.mjs");
  }

  console.log("All tests passed.");
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
