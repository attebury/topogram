import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { generateWorkspace } from "../../src/generator.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const contentApprovalTopogramPath = path.join(repoRoot, "examples", "generated", "content-approval", "topogram");

test("context digest produces stable workspace and per-surface files", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-digest"
  });

  assert.equal(result.ok, true);
  assert.ok(result.artifact["workspace.context-digest.json"]);
  assert.ok(result.artifact["capabilities/cap_request_article_revision.context-digest.json"]);
  assert.ok(result.artifact["workflows/article_review.context-digest.json"]);
  assert.ok(result.artifact["journeys/article_resubmission_after_review.context-digest.json"]);

  const workspaceDigest = result.artifact["workspace.context-digest.json"];
  assert.deepEqual(workspaceDigest.inventory.workflows, ["article_review"]);
  assert.match(JSON.stringify(workspaceDigest.pointers.capabilities), /cap_request_article_revision/);
});
