import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { generateWorkspace } from "../../src/generator.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const contentApprovalTopogramPath = path.join(repoRoot, "examples", "generated", "content-approval", "topogram");
const todoTopogramPath = path.join(repoRoot, "examples", "generated", "todo", "topogram");

test("context report measures slices and bundles against resolved graph size", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-report"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.type, "context_report");
  assert.ok(result.artifact.raw_workspace.bytes > 0);
  assert.ok(result.artifact.resolved_graph.bytes > result.artifact.raw_workspace.bytes);
  assert.equal(result.artifact.slices.length, 4);
  assert.equal(result.artifact.bundles.length, 4);
  assert.ok(result.artifact.workspace_digest.digest_vs_resolved_percent > 0);
});

test("context report includes diff metrics when a baseline topogram is provided", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-report",
    fromTopogramPath: todoTopogramPath
  });

  assert.equal(result.ok, true);
  assert.ok(result.artifact.diff);
  assert.ok(result.artifact.diff.bytes > 0);
  assert.ok(result.artifact.diff.diff_vs_resolved_percent > 0);
});
