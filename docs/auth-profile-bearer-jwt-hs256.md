# Bearer JWT HS256 Auth Profile

`bearer_jwt_hs256` is the primary generated auth profile for Topogram's alpha auth proof surface.

Use it when you want the strongest current generated auth story:

- signed bearer token verification
- claim extraction
- permission enforcement
- ownership enforcement
- generated UI visibility that follows the same modeled auth rules
- runtime checks that prove both `401` and `403` behavior

## Current Environment Surface

- `TOPOGRAM_AUTH_PROFILE=bearer_jwt_hs256`
- `TOPOGRAM_AUTH_JWT_SECRET` (single-secret shorthand; ignored when `TOPOGRAM_AUTH_JWT_SECRETS` is set)
- `TOPOGRAM_AUTH_JWT_SECRETS` (comma-separated list of HS256 secrets; verifier accepts a token signed by any entry — see [auth-secret-rotation.md](./auth-secret-rotation.md))
- `TOPOGRAM_AUTH_JWT_ISSUER` (optional; when set, tokens whose `iss` claim does not match are rejected with `invalid_bearer_issuer`)
- `TOPOGRAM_AUTH_JWT_AUDIENCE` (optional; when set, tokens whose `aud` claim does not match are rejected with `invalid_bearer_audience`)
- `TOPOGRAM_AUTH_TOKEN`
- `PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN`

Examples may also expose proof-specific tokens such as:

- `TOPOGRAM_AUTH_TOKEN_EXPIRED`
- `TOPOGRAM_AUTH_TOKEN_INVALID`
- `TOPOGRAM_AUTH_TOKEN_NO_REVIEWER`
- `TOPOGRAM_AUTH_TOKEN_WRONG_ISSUER`
- `TOPOGRAM_AUTH_TOKEN_WRONG_AUDIENCE`
- `TOPOGRAM_AUTH_TOKEN_ROTATING` (signed with the secondary entry in `TOPOGRAM_AUTH_JWT_SECRETS`)

`PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN` is a browser-visible demo token for generated examples. It is not a secret, and it is not a production auth boundary.

For the canonical alpha-complete auth claim, see [Auth Alpha Complete](./auth-alpha-complete.md). For the production-readiness boundary of this profile, see [Bearer JWT HS256 Launch Checklist](./auth-profile-bearer-jwt-hs256-launch-checklist.md).

## What It Proves Today

The current alpha auth proof loop uses signed JWTs to prove:

- `401` for missing bearer tokens
- `401` for invalid signatures or malformed tokens
- `401` for expired tokens
- `401` for tokens whose issuer or audience does not match the configured value
- `200` for tokens signed with any active rotation key listed in `TOPOGRAM_AUTH_JWT_SECRETS`
- `403` for authenticated identities that still fail a modeled auth rule
- generated claim-aware authorization and UI visibility

## Current Example Proof Matrix

- `permission`: [examples/generated/issues](../examples/generated/issues)
  Issues proves permission-gated create/read/update/close behavior with signed tokens, plus `401` invalid-signature and expired-token failures.
- `ownership`: [examples/generated/issues](../examples/generated/issues)
  Issues proves owner-or-admin behavior and `403` forbidden access against a seeded issue owned by another user.
- `claim`: [examples/generated/content-approval](../examples/generated/content-approval)
  Content Approval proves reviewer-claim enforcement through both backend authorization and generated UI visibility, including `403` when a valid token lacks the reviewer claim.

## Alpha Boundary

This is the current Topogram auth claim for alpha:

- modeled auth semantics across `permission`, `ownership`, and `claim`
- generated backend enforcement
- generated UI visibility
- brownfield auth review and adoption guidance
- explicit production-readiness limits

It is not yet a claim of:

- production auth readiness
- cookie or session auth
- external identity provider integration
- refresh, rotation, or revocation lifecycle
- incident-ready auth operations

## Relationship To `bearer_demo`

[`bearer_demo`](./auth-profile-bearer-demo.md) remains supported as a local/demo auth profile.

Use it when you want a lighter-weight local proof surface. Do not treat it as the primary alpha auth story.
