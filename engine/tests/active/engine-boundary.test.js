import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const testsRoot = path.join(repoRoot, "engine", "tests");
const appBasicFixtureRoots = [
  path.join(testsRoot, "fixtures", "workspaces", "app-basic"),
  path.join(testsRoot, "fixtures", "expected", "app-basic")
];
const forbiddenDemoReferences = [
  ["demos", "generated"].join("/"),
  ["todo", "demo", "app"].join("-")
];
const forbiddenAppBasicReferences = [
  "TODO_",
  "Todo",
  "topogram_todo",
  "topogram-todo"
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

test("app-basic fixtures do not carry Todo-specific vocabulary", () => {
  const offenders = [];
  for (const root of appBasicFixtureRoots) {
    for (const file of visitFiles(root)) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
      const contents = fs.readFileSync(file, "utf8");
      if (forbiddenAppBasicReferences.some((reference) => contents.includes(reference))) {
        offenders.push(relative);
      }
    }
  }

  assert.deepEqual(offenders, []);
});
