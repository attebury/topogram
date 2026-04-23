import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { generateWorkspace } from "../../src/generator.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const contentApprovalTopogramPath = path.join(repoRoot, "examples", "generated", "content-approval", "topogram");

function writeWorkspace(root, files) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents, "utf8");
  }
}

function baselineWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-context-diff-"));
  writeWorkspace(root, {
    "entities/entity-task.tg": `entity entity_task {
  name "Task"
  description "Task"
  fields {
    id uuid required
    title string required
  }
  status active
}
`,
    "shapes/shape-input-create-task.tg": `shape shape_input_create_task {
  name "Create Task Input"
  description "Create"
  fields {
    title string required
  }
  status active
}
`,
    "shapes/shape-output-task-detail.tg": `shape shape_output_task_detail {
  name "Task Detail"
  description "Detail"
  fields {
    id uuid required
    title string required
  }
  status active
}
`,
    "capabilities/cap-create-task.tg": `capability cap_create_task {
  name "Create Task"
  description "Create one task"
  creates [entity_task]
  input [shape_input_create_task]
  output [shape_output_task_detail]
  status active
}
`,
    "verifications/ver-create-task.tg": `verification ver_create_task {
  name "Create Task Verification"
  description "Checks task creation"
  validates [cap_create_task]
  method runtime
  scenarios [create_task]
  status active
}
`
  });
  return root;
}

test("context diff classifies additive, removed, and modified semantic changes", () => {
  const baselinePath = baselineWorkspace();
  const parsed = parsePath(contentApprovalTopogramPath);
  const result = generateWorkspace(parsed, {
    target: "context-diff",
    fromTopogramPath: baselinePath
  });

  assert.equal(result.ok, true);
  assert.match(JSON.stringify(result.artifact.capabilities), /additive/);
  assert.match(JSON.stringify(result.artifact.entities), /removed/);
  assert.match(JSON.stringify(result.artifact.verifications), /removed|additive|modified/);
  assert.ok(Array.isArray(result.artifact.workflows));
  assert.ok(Array.isArray(result.artifact.journeys));
  assert.ok(Array.isArray(result.artifact.affected_generated_surfaces.projections));
  assert.ok(Array.isArray(result.artifact.affected_verifications));
  assert.ok(Array.isArray(result.artifact.review_boundary_changes));
  assert.ok(Array.isArray(result.artifact.affected_maintained_surfaces.outputs));
  assert.ok(result.artifact.affected_maintained_surfaces.affected_seams.every((seam) => seam.output_id));
});
