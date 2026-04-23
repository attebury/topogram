import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { buildWebParityEvidence } from "../../src/proofs/web-parity.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const todoPath = path.join(repoRoot, "examples", "generated", "todo", "topogram");

test("todo web parity keeps react and sveltekit seams aligned", () => {
  const ast = parsePath(todoPath);
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const evidence = buildWebParityEvidence(resolved.graph, "proj_ui_web_react", "proj_ui_web");

  assert.equal(evidence.leftProfile, "react");
  assert.equal(evidence.rightProfile, "sveltekit");
  assert.equal(evidence.semanticParity, true);
});
