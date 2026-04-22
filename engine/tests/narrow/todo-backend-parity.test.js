import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { buildBackendParityEvidence } from "../../src/proofs/backend-parity.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const todoPath = path.join(repoRoot, "examples", "todo", "topogram");

test("todo backend parity keeps hono and express seams aligned", () => {
  const ast = parsePath(todoPath);
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const evidence = buildBackendParityEvidence(resolved.graph, "proj_api");

  assert.equal(evidence.sharedServerContract, true);
  assert.equal(evidence.honoTargetMarker, true);
  assert.equal(evidence.expressTargetMarker, true);
});
