import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parsePath } from "../../src/parser.js";
import { formatValidationErrors, validateWorkspace } from "../../src/validator.js";
import { formatProjectConfigErrors, validateProjectConfig } from "../../src/project-config.js";
import { validateGeneratorManifest } from "../../src/generator/registry.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(engineRoot, "..");
const cliPath = path.join(engineRoot, "src", "cli.js");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "app-basic");
const migrationFixtureRoot = path.join(engineRoot, "tests", "fixtures", "migration");
const oldDslRoot = path.join(migrationFixtureRoot, "old-dsl-vocabulary");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateOldDslFixture(fileName) {
  const fixturePath = path.join(oldDslRoot, fileName);
  const validation = validateWorkspace(parsePath(fixturePath));
  assert.equal(validation.ok, false, `${fileName} should fail validation`);
  return {
    formatted: formatValidationErrors(validation),
    messages: validation.errors.map((error) => error.message).join("\n")
  };
}

function assertRenameDiagnostic(text, { oldName, newName, example, fileName = null }) {
  assert.match(text, new RegExp(escapeRegExp(oldName)), `${oldName} should be named`);
  assert.match(text, new RegExp(escapeRegExp(newName)), `${newName} should be named`);
  assert.match(text, /Example fix:/, "diagnostic should include an example fix");
  assert.match(text, new RegExp(escapeRegExp(example)), `example should include ${example}`);
  if (fileName) {
    assert.match(text, new RegExp(`${escapeRegExp(fileName)}(?::\\d+:\\d+)?`), "diagnostic should include a file path or location");
  }
}

function runCli(args) {
  return childProcess.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
}

test("old statement and projection vocabulary fails with actionable migration diagnostics", () => {
  const component = validateOldDslFixture("component-kind.tg");
  assertRenameDiagnostic(component.formatted, {
    oldName: "component",
    newName: "widget",
    example: "widget widget_data_grid",
    fileName: "component-kind.tg"
  });

  const platform = validateOldDslFixture("projection-platform-field.tg");
  assertRenameDiagnostic(platform.formatted, {
    oldName: "platform",
    newName: "type",
    example: "type web_surface",
    fileName: "projection-platform-field.tg"
  });
});

test("old projection type values fail with target projection type examples", () => {
  const cases = [
    ["projection-type-ui-shared.tg", "ui_shared", "ui_contract"],
    ["projection-type-ui-web.tg", "ui_web", "web_surface"],
    ["projection-type-ui-ios.tg", "ui_ios", "ios_surface"],
    ["projection-type-ui-android.tg", "ui_android", "android_surface"],
    ["projection-type-dotnet.tg", "dotnet", "api_contract"],
    ["projection-type-api.tg", "api", "api_contract"],
    ["projection-type-backend.tg", "backend", "api_contract"],
    ["projection-type-db-postgres.tg", "db_postgres", "db_contract"],
    ["projection-type-db-sqlite.tg", "db_sqlite", "db_contract"]
  ];

  for (const [fileName, oldName, newName] of cases) {
    const result = validateOldDslFixture(fileName);
    assertRenameDiagnostic(result.formatted, {
      oldName,
      newName,
      example: `type ${newName}`,
      fileName
    });
  }
});

test("old UI/API/DB block names fail with canonical block examples", () => {
  const fieldCases = [
    ["ui-fields.tg", "ui_screens", "screens", "screens {"],
    ["ui-fields.tg", "ui_screen_regions", "screen_regions", "screen_regions {"],
    ["ui-fields.tg", "ui_navigation", "navigation", "navigation {"],
    ["ui-fields.tg", "ui_app_shell", "app_shell", "app_shell {"],
    ["ui-fields.tg", "ui_collections", "collection_views", "collection_views {"],
    ["ui-fields.tg", "ui_actions", "screen_actions", "screen_actions {"],
    ["ui-fields.tg", "ui_visibility", "visibility_rules", "visibility_rules {"],
    ["ui-fields.tg", "ui_lookups", "field_lookups", "field_lookups {"],
    ["ui-fields.tg", "ui_components", "widget_bindings", "widget_bindings {"],
    ["ui-fields.tg", "ui_routes", "screen_routes", "screen_routes {"],
    ["ui-fields.tg", "ui_design", "design_tokens", "design_tokens {"],
    ["api-fields.tg", "http", "endpoints", "endpoints {"],
    ["api-fields.tg", "http_errors", "error_responses", "error_responses {"],
    ["api-fields.tg", "http_fields", "wire_fields", "wire_fields {"],
    ["api-fields.tg", "http_responses", "responses", "responses {"],
    ["api-fields.tg", "http_preconditions", "preconditions", "preconditions {"],
    ["api-fields.tg", "http_idempotency", "idempotency", "idempotency {"],
    ["api-fields.tg", "http_cache", "cache", "cache {"],
    ["api-fields.tg", "http_delete", "delete_semantics", "delete_semantics {"],
    ["api-fields.tg", "http_async", "async_jobs", "async_jobs {"],
    ["api-fields.tg", "http_status", "async_status", "async_status {"],
    ["api-fields.tg", "http_download", "downloads", "downloads {"],
    ["api-fields.tg", "http_authz", "authorization", "authorization {"],
    ["api-fields.tg", "http_callbacks", "callbacks", "callbacks {"],
    ["db-fields.tg", "db_tables", "tables", "tables {"],
    ["db-fields.tg", "db_columns", "columns", "columns {"],
    ["db-fields.tg", "db_keys", "keys", "keys {"],
    ["db-fields.tg", "db_indexes", "indexes", "indexes {"],
    ["db-fields.tg", "db_relations", "relations", "relations {"],
    ["db-fields.tg", "db_lifecycle", "lifecycle", "lifecycle {"]
  ];
  const cache = new Map();

  for (const [fileName, oldName, newName, example] of fieldCases) {
    if (!cache.has(fileName)) {
      cache.set(fileName, validateOldDslFixture(fileName).formatted);
    }
    assertRenameDiagnostic(cache.get(fileName), {
      oldName,
      newName,
      example,
      fileName
    });
  }
});

test("old project topology names fail with runtime rename examples", () => {
  const projectConfigPath = path.join(migrationFixtureRoot, "old-project-config", "topogram.project.json");
  const fixtureResult = validateProjectConfig(readJson(projectConfigPath));
  assert.equal(fixtureResult.ok, false);
  const fixtureErrors = formatProjectConfigErrors(fixtureResult, projectConfigPath);
  assertRenameDiagnostic(fixtureErrors, {
    oldName: "topology.components",
    newName: "topology.runtimes",
    example: `"topology": { "runtimes": [] }`,
    fileName: "topogram.project.json"
  });

  const runtimeResult = validateProjectConfig({
    version: "0.1",
    outputs: {
      app: {
        path: "./app",
        ownership: "generated"
      }
    },
    topology: {
      runtimes: [
        {
          id: "app_web",
          kind: "web_surface",
          type: "web",
          projection: "proj_web_surface",
          api: "app_api",
          database: "app_db",
          generator: {
            id: "topogram/react",
            version: "1"
          }
        }
      ]
    }
  });
  assert.equal(runtimeResult.ok, false);
  const runtimeErrors = formatProjectConfigErrors(runtimeResult, "topogram.project.json");
  assertRenameDiagnostic(runtimeErrors, {
    oldName: "type",
    newName: "kind",
    example: `"kind": "api_service"`
  });
  assertRenameDiagnostic(runtimeErrors, {
    oldName: "api",
    newName: "uses_api",
    example: `"uses_api": "app_api"`
  });
  assertRenameDiagnostic(runtimeErrors, {
    oldName: "database",
    newName: "uses_database",
    example: `"uses_database": "app_db"`
  });
});

test("old generator manifest names fail with manifest rename examples", () => {
  const manifestPath = path.join(migrationFixtureRoot, "old-generator-manifest", "topogram-generator.json");
  const result = validateGeneratorManifest(readJson(manifestPath));
  assert.equal(result.ok, false);
  const errors = result.errors.join("\n");

  assertRenameDiagnostic(errors, {
    oldName: "targetKind",
    newName: "runtimeKinds",
    example: `"runtimeKinds": ["web_surface"]`
  });
  assertRenameDiagnostic(errors, {
    oldName: "projectionPlatforms",
    newName: "projectionTypes",
    example: `"projectionTypes": ["web_surface"]`
  });
  assertRenameDiagnostic(errors, {
    oldName: "componentSupport",
    newName: "widgetSupport",
    example: `"widgetSupport": { "patterns": ["resource_table"] }`
  });
});

test("documented widget command examples execute against the canonical fixture", () => {
  const docs = fs.readFileSync(path.join(repoRoot, "docs", "widgets.md"), "utf8");
  const documentedShapes = [
    "topogram generate ./topogram --generate ui-widget-contract --widget widget_data_grid",
    "topogram generate ./topogram --generate widget-conformance-report --projection proj_web_surface --json",
    "topogram widget check ./topogram --projection proj_web_surface",
    "topogram widget behavior ./topogram --projection proj_web_surface --widget widget_data_grid --json",
    "topogram query widget-behavior ./topogram --projection proj_web_surface --widget widget_data_grid --json",
    "topogram query slice ./topogram --widget widget_data_grid"
  ];
  for (const command of documentedShapes) {
    assert.equal(docs.includes(command), true, `docs/widgets.md should include ${command}`);
  }

  const commands = [
    ["generate", fixtureRoot, "--generate", "ui-widget-contract", "--widget", "widget_data_grid", "--json"],
    ["generate", fixtureRoot, "--generate", "widget-conformance-report", "--projection", "proj_web_surface", "--json"],
    ["widget", "check", fixtureRoot, "--projection", "proj_web_surface"],
    ["widget", "behavior", fixtureRoot, "--projection", "proj_web_surface", "--widget", "widget_data_grid", "--json"],
    ["query", "widget-behavior", fixtureRoot, "--projection", "proj_web_surface", "--widget", "widget_data_grid", "--json"],
    ["query", "slice", fixtureRoot, "--widget", "widget_data_grid", "--json"]
  ];

  for (const args of commands) {
    const result = runCli(args);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test("old component CLI names fail with rename guidance", () => {
  const cases = [
    {
      args: ["component", "check", fixtureRoot],
      expected: "Command 'topogram component' was renamed to 'topogram widget'."
    },
    {
      args: ["generate", fixtureRoot, "--generate", "ui-widget-contract", "--component", "widget_data_grid", "--json"],
      expected: "CLI flag '--component' was renamed to '--widget'."
    },
    {
      args: ["generate", fixtureRoot, "--generate", "ui-component-contract", "--widget", "widget_data_grid", "--json"],
      expected: "Generator target 'ui-component-contract' was renamed to 'ui-widget-contract'."
    },
    {
      args: ["generate", fixtureRoot, "--generate", "component-conformance-report", "--projection", "proj_web_surface", "--json"],
      expected: "Generator target 'component-conformance-report' was renamed to 'widget-conformance-report'."
    },
    {
      args: ["generate", fixtureRoot, "--generate", "component-behavior-report", "--widget", "widget_data_grid", "--json"],
      expected: "Generator target 'component-behavior-report' was renamed to 'widget-behavior-report'."
    }
  ];

  for (const testCase of cases) {
    const result = runCli(testCase.args);
    assert.notEqual(result.status, 0, `${testCase.args.join(" ")} should fail`);
    assert.match(result.stderr, new RegExp(escapeRegExp(testCase.expected)));
  }
});
