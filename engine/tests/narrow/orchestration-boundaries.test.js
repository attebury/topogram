import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { buildAgentAdoptionPlan } from "../../src/adoption/plan.js";
import { generateWorkspace } from "../../src/generator/index.js";
import { runWorkflow } from "../../src/workflows.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const todoTopogramPath = path.join(repoRoot, "examples", "generated", "todo", "topogram");
const issuesTopogramPath = path.join(repoRoot, "examples", "generated", "issues", "topogram");

function loadJsonFixture(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

test("generate-journeys workflow still orchestrates through the extracted journey draft builder", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-workflow-journeys-"));
  const tempTopogramRoot = path.join(workspaceRoot, "topogram");
  fs.cpSync(issuesTopogramPath, tempTopogramRoot, { recursive: true });
  fs.rmSync(path.join(tempTopogramRoot, "docs", "journeys"), { recursive: true, force: true });

  const result = runWorkflow("generate-journeys", tempTopogramRoot);
  assert.ok(result.summary.generated_draft_count >= 2);
  assert.ok(result.files["candidates/docs/journeys/issue-creation-and-discovery.md"]);
  assert.ok(result.files["candidates/docs/journeys/issue-update-and-lifecycle.md"]);
});

test("runtime and web generator entrypoints keep stable shared-wrapper outputs", () => {
  const todoBundle = generateWorkspace(parsePath(todoTopogramPath), {
    target: "app-bundle"
  });
  assert.equal(todoBundle.ok, true);
  assert.match(todoBundle.artifact["scripts/bootstrap.sh"], /\(cd "\$ROOT_DIR\/app" && bash \.\/scripts\/bootstrap-db\.sh\)/);
  assert.match(todoBundle.artifact["scripts/runtime-check.sh"], /\(cd "\$ROOT_DIR\/runtime-check" && bash \.\/scripts\/check\.sh\)/);
  assert.match(todoBundle.artifact["scripts/deploy-check.sh"], /\(cd "\$ROOT_DIR\/deploy" && bash \.\/scripts\/deploy-check\.sh\)/);

  const issuesReactBundle = generateWorkspace(parsePath(issuesTopogramPath), {
    target: "sveltekit-app",
    projectionId: "proj_ui_web__sveltekit"
  });
  assert.equal(issuesReactBundle.ok, true);
  assert.match(issuesReactBundle.artifact["src/lib/api/client.ts"], /Authorization/);
  assert.match(issuesReactBundle.artifact["src/lib/auth/visibility.ts"], /canShowAction/);
});

test("real-trial-derived maintained seam fixtures stay conservative without requiring live trial repos", () => {
  const supabaseFixture = loadJsonFixture("../fixtures/import/maintained-seam-candidates/supabase-clear-match.json");
  const eShopFixture = loadJsonFixture("../fixtures/import/maintained-seam-candidates/eshop-ui-ambiguous.json");
  const supabaseAgentPlan = buildAgentAdoptionPlan(
    supabaseFixture.adoption_plan,
    supabaseFixture.maintained_boundary
  );
  const eShopAgentPlan = buildAgentAdoptionPlan(
    eShopFixture.adoption_plan,
    eShopFixture.maintained_boundary
  );
  const supabaseProfileSurface = supabaseAgentPlan.imported_proposal_surfaces.find((surface) => surface.id === "profile:capability:cap_update_profile");

  assert.ok(supabaseProfileSurface);
  assert.equal(supabaseProfileSurface.maintained_seam_candidates.length, 1);
  assert.equal(supabaseProfileSurface.maintained_seam_candidates[0].seam_id, "seam_workspace_profile_route");
  assert.match(supabaseProfileSurface.maintained_seam_candidates[0].match_reasons.join(" "), /semantic overlap/);
  assert.match(
    supabaseProfileSurface.maintained_seam_candidates[0].match_reasons.join(" "),
    /path token corroboration|proposal\/seam kind alignment|output path corroboration/
  );
  assert.equal(
    eShopAgentPlan.imported_proposal_surfaces.every((surface) => (surface.maintained_seam_candidates || []).length === 0),
    true
  );
});
