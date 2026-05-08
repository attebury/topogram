import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const testsRoot = path.join(repoRoot, "engine", "tests");
const activeTestsRoot = path.join(testsRoot, "active");
const fixturesRoot = path.join(testsRoot, "fixtures");
const appBasicRoots = [
  path.join(fixturesRoot, "workspaces", "app-basic"),
  path.join(fixturesRoot, "expected", "app-basic")
];
const nativeGeneratorRoot = path.join(repoRoot, "engine", "src", "generator", "surfaces", "native");
const productNameLower = ["to", "do"].join("");
const productNameTitle = ["To", "do"].join("");
const generatedWorkflowBoundaryFile = path.join(activeTestsRoot, "generated-app-workflow.test.js");
const forbiddenDemoReferences = [
  ["demos", "generated"].join("/"),
  [productNameLower, "demo", "app"].join("-")
];
const forbiddenFixtureReferences = [
  "TODO_",
  productNameTitle,
  ["topogram", productNameLower].join("_"),
  ["topogram", productNameLower].join("-")
];
const forbiddenAppBasicProductArtifacts = [
  "taskList",
  "taskDetail",
  "taskCreate",
  "taskEdit",
  "taskExports",
  "taskListLookups",
  "taskCreateLookups",
  "taskEditLookups",
  "task-list",
  "task-meta",
  "cap_list_tasks",
  "cap_create_task",
  "cap_update_task",
  "cap_delete_task",
  "cap_complete_task",
  "entity_task",
  "entity_project",
  "entity_user",
  "/tasks",
  "/projects",
  "/users",
  "tasks/",
  "projects/",
  "users/",
  "TOPOGRAM_DEMO_TASK_ID",
  "PUBLIC_TOPOGRAM_DEMO_TASK_ID",
  "TOPOGRAM_DEMO_PROJECT_ID",
  "PUBLIC_TOPOGRAM_DEMO_PROJECT_ID"
];
const forbiddenNativeGeneratorProductArtifacts = [
  [productNameTitle, "SwiftUIApp"].join(""),
  [productNameTitle, "APIClient"].join(""),
  [productNameTitle, "UiContract"].join(""),
  "PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN",
  "cap_complete_task",
  "cap_export_tasks",
  "cap_update_task",
  "cap_get_task",
  "task_list",
  "task_detail",
  "task_create",
  "task_exports"
];
const externalProductReferences = [
  productNameLower,
  productNameTitle,
  ["topogram", "template", productNameLower].join("-"),
  ["topogram", "demo", productNameLower].join("-"),
  ["topogram", productNameLower].join("-"),
  ["@topogram", ["template", productNameLower].join("-")].join("/")
];
const generatedWorkflowDirectProductReferences = [
  JSON.stringify(productNameLower),
  ["topogram", "template", productNameLower].join("-"),
  ["topogram", "demo", productNameLower].join("-"),
  ["@topogram", ["template", productNameLower].join("-")].join("/")
];
const removedGenerateArtifactReferences = ["--generate"];
const removedGenerateArtifactAllowedFiles = new Set([
  "engine/src/cli.js",
  "engine/tests/active/dsl-migration-diagnostics.test.js",
  "engine/tests/active/engine-boundary.test.js",
  "engine/tests/active/generated-app-workflow.test.js"
]);
const staleDslVocabulary = [
  "component-behavior",
  "component_conformance",
  "component_behavior",
  "component_ui_",
  "proj_ui_web",
  "proj_ui_shared",
  "topogram/components",
  "data-topogram-component",
  "component_usages",
  "rendered_component_usages",
  "componentContract",
  "component_ids",
  "changed_component",
  "graph.byKind.component",
  "uiComponents",
  "ui-web-contract",
  "topology.components",
  "topology.widgets",
  "ui_shared",
  "ui_web",
  "ui_ios",
  "ui_android",
  "ui_components",
  "ui_routes",
  "ui_design",
  "ui_screens",
  "ui_screen_regions",
  "ui_navigation",
  "ui_app_shell",
  "ui_collections",
  "ui_actions",
  "ui_visibility",
  "ui_lookups",
  "http_errors",
  "http_fields",
  "http_responses",
  "http_preconditions",
  "http_idempotency",
  "http_cache",
  "http_delete",
  "http_async",
  "http_status",
  "http_download",
  "http_authz",
  "http_callbacks",
  "db_tables",
  "db_columns",
  "db_keys",
  "db_indexes",
  "db_relations",
  "db_postgres",
  "db_sqlite",
  "projectionPlatforms",
  "componentSupport"
];
const staleDslVocabularyAllowedFiles = new Set([
  "docs/components.md",
  "engine/src/cli.js",
  "engine/src/generator/registry.js",
  "engine/src/project-config.js",
  "engine/src/validator/index.js"
]);
const legacyRuntimeAliasReferences = [
  "context.component",
  "apiComponent",
  "databaseComponent",
  "apiComponents",
  "webComponents",
  "dbComponents"
];
const legacyRuntimeAliasAllowedFiles = new Set([
  "engine/src/generator/adapters.js",
  "engine/src/generator/runtime/shared.js",
  "engine/tests/active/engine-boundary.test.js",
  "engine/tests/active/project-config.test.js"
]);

function visitFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const next = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...visitFiles(next));
    } else {
      files.push(next);
    }
  }
  return files;
}

test("engine tests do not reference generated demo workspaces", () => {
  const offenders = [];
  for (const file of visitFiles(testsRoot)) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (forbiddenDemoReferences.some((reference) => contents.includes(reference))) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("engine fixtures do not carry product-specific vocabulary", () => {
  const offenders = [];
  for (const file of visitFiles(fixturesRoot)) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (forbiddenFixtureReferences.some((reference) => contents.includes(reference))) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("app-basic stays neutral instead of reintroducing old product artifacts", () => {
  const offenders = [];
  for (const root of appBasicRoots) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      const contents = fs.readFileSync(file, "utf8");
      const references = forbiddenAppBasicProductArtifacts.filter((reference) => contents.includes(reference));
      if (references.length > 0) {
        offenders.push({ file: relative, references });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("native generator templates stay neutral instead of reintroducing product behavior", () => {
  const offenders = [];
  for (const file of visitFiles(nativeGeneratorRoot)) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    const references = forbiddenNativeGeneratorProductArtifacts.filter((reference) => contents.includes(reference));
    if (references.length > 0) {
      offenders.push({ file: relative, references });
    }
  }

  assert.deepEqual(offenders, []);
});

test("active engine tests keep product-specific references in the named boundary file", () => {
  const offenders = [];
  for (const file of visitFiles(activeTestsRoot)) {
    if (file === generatedWorkflowBoundaryFile) continue;
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const contents = fs.readFileSync(file, "utf8");
    if (externalProductReferences.some((reference) => contents.includes(reference))) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});

test("generated workflow keeps direct product literals near named constants", () => {
  const contents = fs.readFileSync(generatedWorkflowBoundaryFile, "utf8");
  const boundaryIndex = contents.indexOf("function createPureTopogramPackage");
  assert.notEqual(boundaryIndex, -1);
  const tail = contents.slice(boundaryIndex);
  const offenders = generatedWorkflowDirectProductReferences.filter((reference) => tail.includes(reference));

  assert.deepEqual(offenders, []);
});

test("old public DSL vocabulary only appears in migration guidance", () => {
  const offenders = [];
  for (const root of [path.join(repoRoot, "docs"), path.join(repoRoot, "engine", "src"), path.join(repoRoot, "scripts")]) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      if (staleDslVocabularyAllowedFiles.has(relative)) continue;
      const contents = fs.readFileSync(file, "utf8");
      const references = staleDslVocabulary.filter((reference) => contents.includes(reference));
      if (references.length > 0) {
        offenders.push({ file: relative, references });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("removed generate artifact flag only appears in migration guidance", () => {
  const offenders = [];
  for (const root of [path.join(repoRoot, "docs"), path.join(repoRoot, "engine", "src"), path.join(repoRoot, "engine", "tests", "active"), path.join(repoRoot, "scripts")]) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      if (removedGenerateArtifactAllowedFiles.has(relative)) continue;
      const contents = fs.readFileSync(file, "utf8");
      const references = removedGenerateArtifactReferences.filter((reference) => contents.includes(reference));
      if (references.length > 0) {
        offenders.push({ file: relative, references });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("legacy generator runtime aliases stay isolated to adapter compatibility", () => {
  const offenders = [];
  for (const root of [path.join(repoRoot, "engine", "src"), path.join(repoRoot, "engine", "tests", "active")]) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      if (legacyRuntimeAliasAllowedFiles.has(relative)) continue;
      const contents = fs.readFileSync(file, "utf8");
      const references = legacyRuntimeAliasReferences.filter((reference) => contents.includes(reference));
      if (references.length > 0) {
        offenders.push({ file: relative, references });
      }
    }
  }

  assert.deepEqual(offenders, []);
});
