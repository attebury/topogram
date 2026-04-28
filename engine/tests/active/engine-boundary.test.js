import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const testsRoot = path.join(repoRoot, "engine", "tests");
const forbiddenDemoPath = ["demos", "generated"].join("/");

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
    if (contents.includes(forbiddenDemoPath)) {
      offenders.push(relative);
    }
  }

  assert.deepEqual(offenders, []);
});
