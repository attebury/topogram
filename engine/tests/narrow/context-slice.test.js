import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { generateWorkspace } from "../../src/generator.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const contentApprovalTopogramPath = path.join(repoRoot, "examples", "content-approval", "topogram");

function contentApprovalGraph() {
  const parsed = parsePath(contentApprovalTopogramPath);
  const resolved = resolveWorkspace(parsed);
  assert.equal(resolved.ok, true);
  return resolved.graph;
}

test("context slice returns scoped dependency closure for a capability", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-slice",
    capabilityId: "cap_request_article_revision"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.focus.kind, "capability");
  assert.equal(result.artifact.focus.id, "cap_request_article_revision");
  assert.deepEqual(result.artifact.depends_on.entities, ["entity_article"]);
  assert.deepEqual(result.artifact.depends_on.workflows, ["article_review"]);
  assert.match(JSON.stringify(result.artifact), /shape_input_request_article_revision/);
  assert.deepEqual(result.artifact.related.entities.map((entity) => entity.id), ["entity_article"]);
  assert.ok(Array.isArray(result.artifact.write_scope.safe_to_edit));
  assert.ok(Array.isArray(result.artifact.verification_targets.generated_checks));
});

test("context slice supports workflow and entity selectors", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const workflowSlice = generateWorkspace(parsed, {
    target: "context-slice",
    workflowId: "article_review"
  });
  const entitySlice = generateWorkspace(parsed, {
    target: "context-slice",
    entityId: "entity_article"
  });

  assert.equal(workflowSlice.ok, true);
  assert.equal(workflowSlice.artifact.focus.kind, "workflow");
  assert.match(JSON.stringify(workflowSlice.artifact.related.capabilities), /cap_request_article_revision/);

  assert.equal(entitySlice.ok, true);
  assert.equal(entitySlice.artifact.focus.kind, "entity");
  assert.match(JSON.stringify(entitySlice.artifact.related.capabilities), /cap_update_article/);
});
