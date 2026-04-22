import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { generateWorkspace } from "../../src/generator.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const contentApprovalTopogramPath = path.join(repoRoot, "examples", "content-approval", "topogram");

test("context bundle api includes API-relevant surfaces only", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-bundle",
    taskId: "api"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.task, "api");
  assert.match(JSON.stringify(result.artifact.included_surfaces.capabilities), /cap_create_article/);
  assert.match(JSON.stringify(result.artifact.included_surfaces.projections), /proj_api/);
  assert.ok(Array.isArray(result.artifact.write_scope.safe_to_edit));
  assert.ok(Array.isArray(result.artifact.verification_targets.generated_checks));
});

test("context bundle maintained-app exposes explicit proof boundaries", () => {
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-bundle",
    taskId: "maintained-app"
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.task, "maintained-app");
  assert.equal(result.artifact.summary.accepted_change_count, 3);
  assert.equal(result.artifact.summary.no_go_count, 3);
  assert.match(JSON.stringify(result.artifact.review_boundaries), /maintained-contract-review/);
  assert.ok(Array.isArray(result.artifact.maintained_boundary.maintained_files_in_scope));
  assert.equal(result.artifact.maintained_boundary.version, 2);
  assert.ok(Array.isArray(result.artifact.maintained_boundary.outputs));
  assert.ok(result.artifact.maintained_boundary.outputs.length >= 3);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.outputs), /maintained_app/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.outputs), /output_examples_content_approval_web/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.outputs), /output_examples_content_approval_backend/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.outputs), /runtime-check/);
  assert.ok(Array.isArray(result.artifact.maintained_boundary.seams));
  assert.match(JSON.stringify(result.artifact.maintained_boundary.seams), /maintained_app/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.seams), /output_examples_content_approval_web/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.seams), /output_examples_content_approval_backend/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.seams), /seam_maintained_presenter_structure/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.seams), /seam_example_web_reference_composition/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary.seams), /seam_example_backend_reference_integration/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary), /product\/app\/src\/issues.js/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary), /examples\/content-approval\/implementation\/web\/reference.js/);
  assert.match(JSON.stringify(result.artifact.maintained_boundary), /examples\/content-approval\/implementation\/backend\/reference.js/);
  assert.ok(Array.isArray(result.artifact.write_scope.safe_to_edit));
  assert.match(JSON.stringify(result.artifact.verification_targets.maintained_app_checks), /runtime-check/);
});
