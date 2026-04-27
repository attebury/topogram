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
- `TOPOGRAM_AUTH_JWT_SECRET`
- `TOPOGRAM_AUTH_TOKEN`
- `PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN`

Examples may also expose proof-specific tokens such as:

- `TOPOGRAM_AUTH_TOKEN_EXPIRED`
- `TOPOGRAM_AUTH_TOKEN_INVALID`
- `TOPOGRAM_AUTH_TOKEN_NO_REVIEWER`

`PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN` is a browser-visible demo token for generated examples. It is not a secret, and it is not a production auth boundary.

## What It Proves Today

The current alpha auth proof loop uses signed JWTs to prove:

- `401` for missing bearer tokens
- `401` for invalid signatures or malformed tokens
- `401` for expired tokens
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

It is not yet a claim of:

- production auth readiness
- cookie or session auth
- external identity provider integration
- refresh, rotation, or revocation lifecycle
- incident-ready auth operations

## Relationship To `bearer_demo`

[`bearer_demo`](./auth-profile-bearer-demo.md) remains supported as a local/demo auth profile.

Use it when you want a lighter-weight local proof surface. Do not treat it as the primary alpha auth story.
