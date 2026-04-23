import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { buildIssuesParityEvidence } from "../../src/proofs/issues-parity.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const issuesPath = path.join(repoRoot, "examples", "generated", "issues", "topogram");

test("issues parity proof keeps web and runtime seams aligned", () => {
  const ast = parsePath(issuesPath);
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const evidence = buildIssuesParityEvidence(resolved.graph);

  assert.equal(evidence.web.leftProfile, "react");
  assert.equal(evidence.web.rightProfile, "sveltekit");
  assert.equal(evidence.web.semanticParity, true);
  assert.equal(evidence.runtime.sharedServerContract, true);
  assert.equal(evidence.runtime.honoTargetMarker, true);
  assert.equal(evidence.runtime.expressTargetMarker, true);
});
