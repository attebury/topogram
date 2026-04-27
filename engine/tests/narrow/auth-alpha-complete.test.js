import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { renderServerHelpers } from "../../src/generator/apps/backend/runtime-helpers.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function allChecks(plan) {
  return (plan.stages || []).flatMap((stage) => stage.checks || []);
}

function findCheck(plan, id) {
  return allChecks(plan).find((check) => check.id === id);
}

function assertNegativeCheck(plan, id, expected) {
  const check = findCheck(plan, id);
  assert.ok(check, `expected runtime-check plan to include ${id}`);
  assert.equal(check.kind, "api_negative");
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(check[key], value, `${id} ${key}`);
  }
}

test("auth alpha-complete claim has structural runtime proof coverage", () => {
  const issuesPlan = readJson("examples/generated/issues/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json");
  const contentApprovalPlan = readJson("examples/generated/content-approval/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json");

  assert.deepEqual(
    issuesPlan.env.required.filter((name) => name.startsWith("TOPOGRAM_AUTH_")),
    ["TOPOGRAM_AUTH_PROFILE", "TOPOGRAM_AUTH_JWT_SECRET", "TOPOGRAM_AUTH_TOKEN"]
  );
  assert.deepEqual(
    contentApprovalPlan.env.required.filter((name) => name.startsWith("TOPOGRAM_AUTH_")),
    ["TOPOGRAM_AUTH_PROFILE", "TOPOGRAM_AUTH_JWT_SECRET", "TOPOGRAM_AUTH_TOKEN", "TOPOGRAM_AUTH_TOKEN_NO_REVIEWER"]
  );

  assertNegativeCheck(issuesPlan, "list_issues_unauthorized", {
    capabilityId: "cap_list_issues",
    expectStatus: 401,
    expectErrorCode: "missing_bearer_token"
  });
  assertNegativeCheck(issuesPlan, "list_issues_invalid_signature", {
    capabilityId: "cap_list_issues",
    expectStatus: 401,
    expectErrorCode: "invalid_bearer_signature"
  });
  assertNegativeCheck(issuesPlan, "list_issues_expired_token", {
    capabilityId: "cap_list_issues",
    expectStatus: 401,
    expectErrorCode: "expired_bearer_token"
  });
  assertNegativeCheck(issuesPlan, "get_forbidden_issue", {
    capabilityId: "cap_get_issue",
    expectStatus: 403,
    expectErrorCode: "forbidden"
  });
  assertNegativeCheck(contentApprovalPlan, "approve_without_reviewer_claim", {
    capabilityId: "cap_approve_article",
    expectStatus: 403,
    expectErrorCode: "forbidden"
  });
});

test("auth alpha-complete docs point at the proof fixtures they claim", () => {
  const doc = readText("docs/auth-alpha-complete.md");

  for (const required of [
    "permission",
    "ownership",
    "claim",
    "../examples/generated/issues/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json",
    "../examples/generated/content-approval/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json",
    "auth-profile-bearer-jwt-hs256-launch-checklist.md"
  ]) {
    assert.match(doc, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("generated JWT helper does not use heuristic ownership fallback", () => {
  const helpers = renderServerHelpers();

  assert.match(helpers, /allowHeuristicOwnership/);
  assert.match(helpers, /authorizeWithPrincipal\(envPrincipal\.principal, authz, authorizationContext, \{ allowHeuristicOwnership: true \}\)/);
  assert.match(helpers, /authorizeWithPrincipal\(principal, authz, authorizationContext\)/);
  assert.doesNotMatch(helpers, /authorizeWithPrincipal\(principal, authz, authorizationContext, \{ allowHeuristicOwnership: true \}\)/);
});

test("example runtime references declare the JWT auth profile", () => {
  const issuesReference = readText("examples/generated/issues/implementation/runtime/reference.js");
  const contentApprovalReference = readText("examples/generated/content-approval/implementation/runtime/reference.js");

  assert.match(issuesReference, /TOPOGRAM_AUTH_PROFILE=bearer_jwt_hs256/);
  assert.match(contentApprovalReference, /TOPOGRAM_AUTH_PROFILE=bearer_jwt_hs256/);
});
