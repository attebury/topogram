import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { generateCompileCheckPlan } from "../../src/generator/runtime/compile-check.js";
import { generateRuntimeSmokeBundle, generateRuntimeSmokePlan } from "../../src/generator/runtime/smoke.js";
import { APP_BASIC_IMPLEMENTATION } from "../fixtures/workspaces/app-basic/implementation/index.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const appBasicTopogramPath = path.join(repoRoot, "engine", "tests", "fixtures", "workspaces", "app-basic");

function appBasicGraph() {
  const parsed = parsePath(appBasicTopogramPath);
  const resolved = resolveWorkspace(parsed);
  assert.equal(resolved.ok, true);
  return resolved.graph;
}

test("runtime smoke bundle exposes stable script and README contracts", () => {
  const bundle = generateRuntimeSmokeBundle(appBasicGraph(), { implementation: APP_BASIC_IMPLEMENTATION });

  assert.match(bundle["scripts/smoke.sh"], /node "\$SCRIPT_DIR\/smoke\.mjs"/);
  assert.match(bundle["README.md"], /## Canonical Verification/);
  assert.match(bundle["README.md"], /`ver_runtime_smoke`/);
  assert.match(bundle[".env.example"], /TOPOGRAM_API_BASE_URL=http:\/\/localhost:3000/);
  assert.match(bundle[".env.example"], /TOPOGRAM_WEB_BASE_URL=http:\/\/localhost:5173/);
});

test("runtime smoke and compile plans keep required check contracts stable", () => {
  const graph = appBasicGraph();
  const options = { implementation: APP_BASIC_IMPLEMENTATION };
  const smokePlan = generateRuntimeSmokePlan(graph, options);
  const compilePlan = generateCompileCheckPlan(graph, options);

  assert.equal(smokePlan.env.apiBase, "TOPOGRAM_API_BASE_URL");
  assert.equal(smokePlan.env.webBase, "TOPOGRAM_WEB_BASE_URL");
  assert.deepEqual(
    smokePlan.checks.map((check) => check.id),
    ["web_tasks_page", "create_task", "get_task", "list_tasks"]
  );

  assert.deepEqual(
    compilePlan.checks.map((check) => check.id),
    ["server_typecheck", "web_typecheck", "web_build"]
  );
});
