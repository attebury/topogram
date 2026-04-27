# Auth Alpha Complete

This is the canonical claim for Topogram auth in the current alpha.

Topogram is alpha-complete for modeled auth semantics with signed bearer tokens. It is not production-auth complete.

## Definition

Auth is alpha-complete when all five statements are true:

- Topogram has one primary signed-token auth profile.
- The model can express the three current policy shapes: `permission`, `ownership`, and `claim`.
- Generated backends, generated UI visibility, and runtime checks prove those shapes.
- Brownfield review surfaces can recover and stage the same auth shapes for human adoption.
- The docs state the production boundary plainly and do not imply more than the proof shows.

## Criteria And Evidence

- **Primary signed-token profile**
  - Scope: `bearer_jwt_hs256` is the primary alpha auth profile.
  - Evidence: [auth-profile-bearer-jwt-hs256.md](./auth-profile-bearer-jwt-hs256.md).
  - Status: complete for alpha. The profile verifies HS256 JWT signatures, extracts claims, rejects missing, malformed, invalid-signature, expired, untrusted-issuer, and untrusted-audience bearer tokens, and fails closed when a protected route has no configured auth profile. Issuer and audience checks activate when `TOPOGRAM_AUTH_JWT_ISSUER` and `TOPOGRAM_AUTH_JWT_AUDIENCE` are set.

- **Modeled policy shapes**
  - Scope: `permission`, `ownership`, and `claim`.
  - Evidence: [auth-modeling.md](./auth-modeling.md).
  - Status: complete for alpha. `ownership` uses explicit `ownership_field` mappings for the primary JWT proof path; heuristic ownership lookup remains a `bearer_demo` convenience only.

- **Generated proof loop**
  - Scope: generated backend enforcement, generated UI visibility, and runtime checks for the three policy shapes.
  - Evidence: [examples/generated/issues](../examples/generated/issues) proves `permission` and `ownership`; [examples/generated/content-approval](../examples/generated/content-approval) proves `claim`.
  - Runtime evidence: [issues runtime-check plan](../examples/generated/issues/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json) and [content-approval runtime-check plan](../examples/generated/content-approval/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json).
  - Status: complete for alpha. The issues runtime-check plan includes `401` missing-token, invalid-signature, expired-token, invalid-issuer, and invalid-audience cases plus `403` ownership denial. The content-approval runtime-check plan includes `403` for a valid token without the required reviewer claim.

- **Brownfield auth review loop**
  - Scope: imported systems can surface auth-sensitive hints, review packets, and adoption steps before canonical promotion.
  - Evidence: [agent-query-contract.md](./agent-query-contract.md), especially `query auth-hints` and `query auth-review-packet`; [brownfield-import-roadmap.md](./brownfield-import-roadmap.md).
  - Status: complete for alpha. The query payloads aggregate `auth_permission_hints`, `auth_ownership_hints`, and `auth_claim_hints`, then separate unresolved, deferred, and adopted hints for human review. This is a review/adoption loop, not silent production migration.

- **Explicit non-production boundary**
  - Scope: the alpha claim stops at modeled semantics and generated proof.
  - Evidence: this document, [auth-profile-bearer-jwt-hs256-launch-checklist.md](./auth-profile-bearer-jwt-hs256-launch-checklist.md), [proof-points-and-limits.md](./proof-points-and-limits.md).
  - Status: complete for alpha. Production auth readiness, external identity providers, cookie/session auth, refresh, revocation, key rotation, deployment operations, audit logging, and incident response remain outside the current claim.

## How To Re-Audit

Use these checks when reviewing the alpha auth claim:

- Run `node --test engine/tests/narrow/auth-alpha-complete.test.js`.
- Inspect [examples/generated/issues/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json](../examples/generated/issues/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json) for `list_issues_unauthorized`, `list_issues_invalid_signature`, `list_issues_expired_token`, `list_issues_invalid_issuer`, `list_issues_invalid_audience`, and `get_forbidden_issue`.
- Inspect [examples/generated/content-approval/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json](../examples/generated/content-approval/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json) for `approve_without_reviewer_claim`.
- Confirm generated server helpers keep heuristic ownership fallback out of `bearer_jwt_hs256`.
- Read [auth-profile-bearer-jwt-hs256-launch-checklist.md](./auth-profile-bearer-jwt-hs256-launch-checklist.md) before making any production auth claim.

## Out Of Scope

Topogram does not yet claim:

- production auth readiness
- cookie or session auth
- external identity provider integration
- asymmetric JWT verification
- token issuance, refresh, rotation, or revocation lifecycle
- secure secret storage guidance across deployment providers
- rate limiting, audit logging, or auth incident response
- enterprise auth breadth

Those are future production-readiness targets, not hidden alpha assumptions.
