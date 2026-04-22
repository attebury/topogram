# Bearer Demo Auth Profile

`bearer_demo` is a local/demo generated auth profile.

It exists to give Topogram a lightweight local auth surface without pretending to be the primary alpha auth story.

For the main signed-token auth proof surface, see [Bearer JWT HS256 Auth Profile](./auth-profile-bearer-jwt-hs256.md).

## What It Supports

- bearer token parsing from the `Authorization` header
- one env-backed primary principal
- permission checks through `TOPOGRAM_AUTH_PERMISSIONS`
- role checks through `TOPOGRAM_AUTH_ROLES`
- ownership checks when the generated route can load the target resource before the handler runs
- optional admin bypass through `TOPOGRAM_AUTH_ADMIN`
- automatic bearer header attachment from generated web clients when `PUBLIC_TOPOGRAM_AUTH_TOKEN` is present
- generated smoke and runtime-check bundles that can exercise secured routes with the configured token

## Current Environment Surface

- `TOPOGRAM_AUTH_PROFILE=bearer_demo`
- `TOPOGRAM_AUTH_TOKEN`
- `TOPOGRAM_AUTH_USER_ID`
- `TOPOGRAM_AUTH_PERMISSIONS`
- `TOPOGRAM_AUTH_ROLES`
- `TOPOGRAM_AUTH_ADMIN`
- `PUBLIC_TOPOGRAM_AUTH_TOKEN`

Generated local examples commonly also set `TOPOGRAM_DEMO_USER_ID` so seeded data and the auth principal stay aligned.

## Ownership Behavior

When a route uses ownership authorization, the generated Hono server passes route input and a lazy resource loader into the auth helper before the repository handler runs.

The current owner lookup is heuristic-based. It checks these fields in order:

- `owner_id`
- `assignee_id`
- `author_id`
- `user_id`
- `created_by_user_id`

If no owner-like field exists, ownership enforcement cannot succeed for that route.

## What It Does Not Support

- login or logout flows
- token issuance, refresh, or revocation
- cookie or server-session auth
- external identity providers
- persistent principal storage
- production-grade secret handling or claims verification

## Verification Expectations

`bearer_demo` can still be useful for lightweight local verification, but it is no longer the main auth proof boundary.

When you do use it, generated verification bundles should still prove both:

- `401` when a secured route receives no bearer token
- `403` when a request is authenticated but still fails its authorization rule

Use `bearer_demo` when you want a simple local principal model. Use `bearer_jwt_hs256` when you want the primary alpha auth proof path with signed-token verification and claim-aware enforcement.
