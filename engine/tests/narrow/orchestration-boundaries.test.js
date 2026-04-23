import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parsePath } from "../../src/parser.js";
import { generateWorkspace } from "../../src/generator/index.js";
import { buildLocalMaintainedBoundaryArtifact } from "../../src/generator/context/shared.js";
import { runWorkflow } from "../../src/workflows.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const todoTopogramPath = path.join(repoRoot, "examples", "generated", "todo", "topogram");
const issuesTopogramPath = path.join(repoRoot, "examples", "generated", "issues", "topogram");
const supabaseTrialPath = path.join(repoRoot, "trials", "supabase-express-api");
const eShopOnWebTrialPath = path.join(repoRoot, "trials", "eShopOnWeb");

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
    projectionId: "proj_ui_web"
  });
  assert.equal(issuesReactBundle.ok, true);
  assert.match(issuesReactBundle.artifact["src/lib/api/client.ts"], /Authorization/);
  assert.match(issuesReactBundle.artifact["src/lib/auth/visibility.ts"], /canShowAction/);
});

test("reconcile emits a live maintained seam candidate for the Supabase profile proof and keeps eShop free of speculative candidates", () => {
  const supabaseWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-supabase-reconcile-"));
  const supabaseTempRoot = path.join(supabaseWorkspaceRoot, "supabase-express-api");
  fs.cpSync(supabaseTrialPath, supabaseTempRoot, { recursive: true });
  const supabaseBoundaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-supabase-boundary-"));
  const supabaseBoundaryTempRoot = path.join(supabaseBoundaryRoot, "supabase-express-api");
  fs.cpSync(supabaseTrialPath, supabaseBoundaryTempRoot, { recursive: true });

  const eShopWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-eshop-reconcile-"));
  const eShopTempRoot = path.join(eShopWorkspaceRoot, "eShopOnWeb");
  fs.cpSync(eShopOnWebTrialPath, eShopTempRoot, { recursive: true });

  const supabaseMaintainedBoundary = buildLocalMaintainedBoundaryArtifact(supabaseBoundaryTempRoot);
  const supabaseReconcile = runWorkflow("reconcile", supabaseTempRoot);
  const eShopReconcile = runWorkflow("reconcile", eShopTempRoot);
  const supabaseAgentPlan = JSON.parse(supabaseReconcile.files["candidates/reconcile/adoption-plan.agent.json"]);
  const eShopAgentPlan = JSON.parse(eShopReconcile.files["candidates/reconcile/adoption-plan.agent.json"]);
  const supabaseProfileSurface = supabaseAgentPlan.imported_proposal_surfaces.find((surface) => surface.id === "profile:capability:cap_update_profile");

  assert.ok(supabaseMaintainedBoundary);
  assert.equal(supabaseMaintainedBoundary.outputs[0].root_paths[0], "src/**");
  assert.ok(supabaseProfileSurface);
  assert.equal(supabaseProfileSurface.maintained_seam_candidates.length, 1);
  assert.equal(supabaseProfileSurface.maintained_seam_candidates[0].seam_id, "seam_workspace_profile_route_update_handling");
  assert.match(supabaseProfileSurface.maintained_seam_candidates[0].match_reasons.join(" "), /semantic overlap/);
  assert.match(supabaseProfileSurface.maintained_seam_candidates[0].match_reasons.join(" "), /path token corroboration|proposal\/seam kind alignment/);
  assert.equal(
    eShopAgentPlan.imported_proposal_surfaces.every((surface) => (surface.maintained_seam_candidates || []).length === 0),
    true
  );
  assert.match(
    supabaseReconcile.files["candidates/reconcile/report.md"],
    /- `profile`[\s\S]*candidate maintained seam mappings profile:capability:cap_update_profile: `seam_workspace_profile_route_update_handling`/
  );
  assert.match(supabaseReconcile.files["candidates/reconcile/report.md"], /profile:capability:cap_update_profile: `seam_workspace_profile_route_update_handling`/);
  assert.match(eShopReconcile.files["candidates/reconcile/report.md"], /candidate maintained seam mappings _none_/);
});
