import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { generateWorkspace } from "../../src/generator.js";
import { renderServerHelpers } from "../../src/generator/apps/backend/runtime-helpers.js";
import { validateWorkspace } from "../../src/validator.js";
import { generateRuntimeCheckPlan } from "../../src/generator/runtime/runtime-check.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const issuesTopogramPath = path.join(repoRoot, "examples", "generated", "issues", "topogram");
const contentApprovalTopogramPath = path.join(repoRoot, "examples", "generated", "content-approval", "topogram");

function issuesGraph() {
  const parsed = parsePath(issuesTopogramPath);
  const resolved = resolveWorkspace(parsed);
  assert.equal(resolved.ok, true);
  return resolved.graph;
}

function contentApprovalGraph() {
  const parsed = parsePath(contentApprovalTopogramPath);
  const resolved = resolveWorkspace(parsed);
  assert.equal(resolved.ok, true);
  return resolved.graph;
}

function writeWorkspace(root, files) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents, "utf8");
  }
}

function claimAuthWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-claim-auth-"));
  writeWorkspace(root, {
    "entities/entity-account.tg": `entity entity_account {
  name "Account"
  description "Account record"
  fields {
    id uuid required
    owner_id uuid required
    name string required
    tenant string required
  }
  status active
}
`,
    "shapes/shape-output-account-detail.tg": `shape shape_output_account_detail {
  name "Account Detail"
  description "Account detail view"
  fields {
    id uuid required
    owner_id uuid required
    name string required
    tenant string required
  }
  status active
}
`,
    "capabilities/cap-get-account.tg": `capability cap_get_account {
  name "Get Account"
  description "Load one account"
  reads [entity_account]
  output [shape_output_account_detail]
  status active
}
`,
    "capabilities/cap-update-account.tg": `capability cap_update_account {
  name "Update Account"
  description "Update one account"
  reads [entity_account]
  updates [entity_account]
  input [shape_output_account_detail]
  output [shape_output_account_detail]
  status active
}
`,
    "projections/proj-api.tg": `projection proj_api {
  name "API"
  description "Claim-aware API projection"
  platform dotnet
  realizes [cap_get_account, cap_update_account]
  outputs [endpoints]

  http {
    cap_get_account method GET path /accounts/:id success 200 auth user request none
    cap_update_account method PATCH path /accounts/:id success 200 auth user request body
  }

  http_authz {
    cap_get_account claim tenant claim_value internal permission accounts.read
    cap_update_account claim tenant claim_value internal ownership owner ownership_field owner_id permission accounts.write
  }

  status active
}
`,
    "projections/proj-ui-shared.tg": `projection proj_ui_shared {
  name "Account UI"
  description "Claim-aware UI projection"
  platform ui_shared
  realizes [cap_get_account, cap_update_account]
  outputs [ui_contract]

  ui_screens {
    screen account_detail kind detail title "Account" load cap_get_account view_shape shape_output_account_detail primary_action cap_update_account
  }

  ui_visibility {
    action cap_update_account visible_if claim tenant claim_value internal
  }

  status active
}
`
  });
  return root;
}

test("generated auth helper keeps bearer demo and JWT contracts stable", () => {
  const helpers = renderServerHelpers();

  assert.match(helpers, /export interface AuthorizationContext/);
  assert.match(helpers, /bearer_demo/);
  assert.match(helpers, /bearer_jwt_hs256/);
  assert.match(helpers, /TOPOGRAM_AUTH_JWT_SECRET/);
  assert.match(helpers, /missing_bearer_token/);
  assert.match(helpers, /missing_auth_profile/);
  assert.match(helpers, /unsupported_auth_profile/);
  assert.match(helpers, /missing_auth_demo_token/);
  assert.match(helpers, /invalid_bearer_signature/);
  assert.match(helpers, /expired_bearer_token/);
  assert.match(helpers, /forbidden/);
  assert.match(helpers, /Internal server error/);
  assert.doesNotMatch(helpers, /error instanceof Error \? error\.message/);
  assert.match(helpers, /claims: Record<string, unknown>/);
  assert.match(helpers, /TOPOGRAM_AUTH_CLAIMS/);
  assert.match(helpers, /function hasClaim/);
  assert.match(helpers, /contentDisposition/);
  assert.match(helpers, /ownershipField\?: string \| null/);
  assert.match(helpers, /owner_id", "assignee_id", "author_id", "user_id", "created_by_user_id/);
  assert.match(helpers, /allowHeuristicOwnership/);
  assert.match(helpers, /authorizeWithPrincipal\(envPrincipal\.principal, authz, authorizationContext, \{ allowHeuristicOwnership: true \}\)/);
  assert.match(helpers, /authorizeWithPrincipal\(principal, authz, authorizationContext\)/);
  assert.doesNotMatch(helpers, /authorizeWithPrincipal\(principal, authz, authorizationContext, \{ allowHeuristicOwnership: true \}\)/);
});

test("claim-aware auth rules resolve into API and UI contracts", () => {
  const workspace = claimAuthWorkspace();
  const parsed = parsePath(workspace);
  const validated = validateWorkspace(parsed);
  assert.equal(validated.ok, true);

  const resolved = resolveWorkspace(parsed);
  assert.equal(resolved.ok, true);

  const apiContract = generateWorkspace(parsed, {
    target: "api-contract-graph",
    capabilityId: "cap_update_account"
  });
  assert.equal(apiContract.ok, true);
  assert.deepEqual(apiContract.artifact.endpoint.authz, [
    {
      role: null,
      permission: "accounts.write",
      claim: "tenant",
      claimValue: "internal",
      ownership: "owner",
      ownershipField: "owner_id"
    }
  ]);

  const uiBundle = generateWorkspace(parsed, {
    target: "ui-contract-debug",
    projectionId: "proj_ui_shared"
  });
  assert.equal(uiBundle.ok, true);
  assert.match(uiBundle.artifact, /visible_if claim `tenant` claim_value `internal`/);
});

test("claim_value directives require claim auth predicates", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-claim-auth-invalid-"));
  writeWorkspace(workspace, {
    "entities/entity-account.tg": `entity entity_account {
  name "Account"
  description "Account"
  fields {
    id uuid required
  }
  status active
}
`,
    "capabilities/cap-get-account.tg": `capability cap_get_account {
  name "Get Account"
  description "Get account"
  reads [entity_account]
  status active
}
`,
    "projections/proj-api.tg": `projection proj_api {
  name "API"
  description "Invalid claim directives"
  platform dotnet
  realizes [cap_get_account]
  outputs [endpoints]

  http {
    cap_get_account method GET path /accounts/:id success 200 auth user request none
  }

  http_authz {
    cap_get_account claim_value internal
  }

  status active
}
`,
    "projections/proj-ui-shared.tg": `projection proj_ui_shared {
  name "UI"
  description "Invalid claim visibility"
  platform ui_shared
  realizes [cap_get_account]
  outputs [ui_contract]

  ui_screens {
    screen account_detail kind detail title "Account" load cap_get_account
  }

  ui_visibility {
    action cap_get_account visible_if permission accounts.read claim_value internal
  }

  status active
}
`
  });

  const validated = validateWorkspace(parsePath(workspace));
  assert.equal(validated.ok, false);
  const messages = validated.errors.map((error) => error.message).join("\n");
  assert.match(messages, /cannot declare claim_value without claim/);
});

test("issues contract carries explicit ownership field mapping", () => {
  const generated = generateWorkspace(parsePath(issuesTopogramPath), {
    target: "api-contract-graph",
    capabilityId: "cap_get_issue"
  });
  assert.equal(generated.ok, true);

  assert.deepEqual(generated.artifact.endpoint.authz, [
    {
      role: null,
      permission: null,
      claim: null,
      claimValue: null,
      ownership: "owner_or_admin",
      ownershipField: "assignee_id"
    }
  ]);
});

test("issues runtime-check plan keeps JWT auth proofs stable", () => {
  const plan = generateRuntimeCheckPlan(issuesGraph());
  const environmentChecks = plan.stages.find((stage) => stage.id === "environment")?.checks || [];
  const apiChecks = plan.stages.find((stage) => stage.id === "api")?.checks || [];

  assert.deepEqual(
    environmentChecks
      .filter((check) =>
        check.id === "web_issue_detail_owner_edit_visible" ||
        check.id === "web_issue_detail_non_owner_edit_hidden"
      )
      .map((check) => [check.id, check.kind, check.expectText, check.expectNotText || null]),
    [
      ["web_issue_detail_owner_edit_visible", "web_browser_contract", "Edit Issue", null],
      ["web_issue_detail_non_owner_edit_hidden", "web_browser_contract", "Back to Issues", "Edit Issue"]
    ]
  );

  assert.deepEqual(
    apiChecks
      .filter((check) =>
        check.id === "list_issues_unauthorized" ||
        check.id === "list_issues_invalid_signature" ||
        check.id === "list_issues_expired_token" ||
        check.id === "get_forbidden_issue"
      )
      .map((check) => [check.id, check.expectStatus, check.expectErrorCode]),
    [
      ["list_issues_unauthorized", 401, "missing_bearer_token"],
      ["list_issues_invalid_signature", 401, "invalid_bearer_signature"],
      ["list_issues_expired_token", 401, "expired_bearer_token"],
      ["get_forbidden_issue", 403, "forbidden"]
    ]
  );
});

test("content approval review actions keep claim-gated auth proofs stable", () => {
  const apiContract = generateWorkspace(parsePath(contentApprovalTopogramPath), {
    target: "api-contract-graph",
    capabilityId: "cap_approve_article"
  });
  assert.equal(apiContract.ok, true);
  assert.deepEqual(apiContract.artifact.endpoint.authz, [
    {
      role: null,
      permission: "articles.approve",
      claim: "reviewer",
      claimValue: "true",
      ownership: null,
      ownershipField: null
    }
  ]);

  const uiBundle = generateWorkspace(parsePath(contentApprovalTopogramPath), {
    target: "ui-web-contract",
    projectionId: "proj_ui_web__react"
  });
  assert.equal(uiBundle.ok, true);
  const articleDetail = uiBundle.artifact.screens.find((screen) => screen.id === "article_detail");
  assert.ok(articleDetail);
  assert.ok(
    articleDetail.visibility.some(
      (entry) =>
        entry.capability?.id === "cap_approve_article" &&
        entry.predicate === "claim" &&
        entry.value === "reviewer" &&
        entry.claimValue === "true"
    )
  );

  const plan = generateRuntimeCheckPlan(contentApprovalGraph());
  const environmentChecks = plan.stages.find((stage) => stage.id === "environment")?.checks || [];
  const apiChecks = plan.stages.find((stage) => stage.id === "api")?.checks || [];
  assert.ok(environmentChecks.some((check) => check.id === "web_article_detail_reviewer_actions_visible"));
  assert.ok(environmentChecks.some((check) => check.id === "web_article_detail_reviewer_actions_hidden"));
  assert.ok(apiChecks.some((check) => check.id === "approve_without_reviewer_claim"));
});

test("issues generated web clients keep bearer token injection stable", () => {
  const reactBundle = generateWorkspace(parsePath(issuesTopogramPath), {
    target: "sveltekit-app",
    projectionId: "proj_ui_web__react"
  });
  assert.equal(reactBundle.ok, true);

  const svelteBundle = generateWorkspace(parsePath(issuesTopogramPath), {
    target: "sveltekit-app",
    projectionId: "proj_ui_web__sveltekit"
  });
  assert.equal(svelteBundle.ok, true);

  assert.match(reactBundle.artifact["src/lib/api/client.ts"], /headers\.set\("Authorization", "Bearer " \+ authToken\(\)\)/);
  assert.match(reactBundle.artifact["src/lib/api/client.ts"], /PUBLIC_TOPOGRAM_AUTH_TOKEN/);
  assert.doesNotMatch(reactBundle.artifact["src/lib/api/client.ts"], /PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN/);
  assert.match(reactBundle.artifact["src/lib/api/lookups.ts"], /function authToken\(\)/);
  assert.match(reactBundle.artifact["src/lib/api/lookups.ts"], /PUBLIC_TOPOGRAM_AUTH_TOKEN/);
  assert.match(reactBundle.artifact["src/lib/api/lookups.ts"], /headers\.set\("Authorization", "Bearer " \+ authToken\(\)\)/);

  assert.match(svelteBundle.artifact["src/lib/api/client.ts"], /headers\.set\("Authorization", "Bearer " \+ authToken\(\)\)/);
  assert.match(svelteBundle.artifact["src/lib/api/client.ts"], /PUBLIC_TOPOGRAM_AUTH_TOKEN/);
  assert.match(svelteBundle.artifact["src/lib/api/lookups.ts"], /headers\.set\("Authorization", "Bearer " \+ authToken\(\)\)/);
});

test("generated backend CORS and authorization wiring fail closed", () => {
  const honoBundle = generateWorkspace(parsePath(issuesTopogramPath), {
    target: "hono-server",
    projectionId: "proj_api"
  });
  assert.equal(honoBundle.ok, true);

  const app = honoBundle.artifact["src/lib/server/app.ts"];
  assert.match(app, /TOPOGRAM_CORS_ORIGINS/);
  assert.match(app, /origin: corsOrigin/);
  assert.match(app, /authorization_handler_missing/);
  assert.match(app, /await deps\.authorize\(/);
  assert.doesNotMatch(app, /origin: "\*"/);
  assert.doesNotMatch(app, /deps\.authorize\?\./);
});

test("generated UI contracts and pages carry explicit ownership visibility", () => {
  const issuesReactBundle = generateWorkspace(parsePath(issuesTopogramPath), {
    target: "sveltekit-app",
    projectionId: "proj_ui_web__react"
  });
  assert.equal(issuesReactBundle.ok, true);
  assert.match(issuesReactBundle.artifact["src/lib/topogram/ui-web-contract.json"], /"ownershipField": "assignee_id"/);
  assert.match(issuesReactBundle.artifact["src/pages/IssueDetailPage.tsx"], /canShowAction/);
  assert.match(issuesReactBundle.artifact["src/pages/IssueDetailPage.tsx"], /topogram_auth_user_id/);
  assert.match(issuesReactBundle.artifact["src/lib/auth/visibility.ts"], /ownerIdFromResource/);

  const todoTopogramPath = path.join(repoRoot, "examples", "generated", "todo", "topogram");
  const todoSvelteBundle = generateWorkspace(parsePath(todoTopogramPath), {
    target: "sveltekit-app",
    projectionId: "proj_ui_web__sveltekit"
  });
  assert.equal(todoSvelteBundle.ok, true);
  assert.match(todoSvelteBundle.artifact["src/lib/topogram/ui-web-contract.json"], /"ownershipField": "owner_id"/);
  assert.match(todoSvelteBundle.artifact["src/routes/tasks/[id]/+page.svelte"], /canShowAction/);
  assert.match(todoSvelteBundle.artifact["src/lib/auth/visibility.ts"], /PUBLIC_TOPOGRAM_AUTH_USER_ID/);
});
