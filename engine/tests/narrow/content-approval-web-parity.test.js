import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { buildWebParityEvidence } from "../../src/proofs/web-parity.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const contentApprovalPath = path.join(repoRoot, "examples", "generated", "content-approval", "topogram");

test("content approval web parity keeps react and sveltekit seams aligned", () => {
  const ast = parsePath(contentApprovalPath);
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const evidence = buildWebParityEvidence(resolved.graph, "proj_ui_web__react", "proj_ui_web__sveltekit");

  assert.equal(evidence.leftProfile, "react");
  assert.equal(evidence.rightProfile, "sveltekit");
  assert.equal(evidence.semanticParity, true);
});
