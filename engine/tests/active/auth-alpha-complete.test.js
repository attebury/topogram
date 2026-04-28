import test from "node:test";
import assert from "node:assert/strict";

import { renderServerHelpers } from "../../src/generator/apps/backend/runtime-helpers.js";

test("generated JWT helper does not use heuristic ownership fallback", () => {
  const helpers = renderServerHelpers();

  assert.match(helpers, /allowHeuristicOwnership/);
  assert.match(helpers, /authorizeWithPrincipal\(envPrincipal\.principal, authz, authorizationContext, \{ allowHeuristicOwnership: true \}\)/);
  assert.match(helpers, /authorizeWithPrincipal\(principal, authz, authorizationContext\)/);
  assert.doesNotMatch(helpers, /authorizeWithPrincipal\(principal, authz, authorizationContext, \{ allowHeuristicOwnership: true \}\)/);
});

test("generated JWT helper validates issuer and audience when configured", () => {
  const helpers = renderServerHelpers();

  assert.match(helpers, /TOPOGRAM_AUTH_JWT_ISSUER/);
  assert.match(helpers, /TOPOGRAM_AUTH_JWT_AUDIENCE/);
  assert.match(helpers, /invalid_bearer_issuer/);
  assert.match(helpers, /invalid_bearer_audience/);
  assert.match(helpers, /Bearer token issuer is not trusted/);
  assert.match(helpers, /Bearer token audience does not match/);
});

test("generated JWT helper accepts multiple rotation secrets", () => {
  const helpers = renderServerHelpers();

  assert.match(helpers, /TOPOGRAM_AUTH_JWT_SECRETS/);
  assert.match(helpers, /readHs256Secrets/);
  assert.match(helpers, /for \(const candidate of secrets\)/);
  assert.doesNotMatch(helpers, /function readHs256Secret\(\)/);
});
