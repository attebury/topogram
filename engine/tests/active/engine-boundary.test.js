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
