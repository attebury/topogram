# Bearer Demo Launch Checklist

This is a local readiness boundary for `bearer_demo`.

It exists to answer one question clearly: what still blocks us from treating this demo/local auth profile as launch-ready?

## Current State

What is already true:

- generated Hono backends can enforce bearer token auth for secured routes
- generated web clients attach `PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN` on secured requests
- generated runtime bundles can prove both `401` and `403` behavior
- the `issues` example now passes a real local end-to-end runtime-check with auth enabled

What is not true yet:

- `bearer_demo` is not a production auth system
- the current profile is a generated proof surface, not a launch surface

## Launch Blockers

These are the concrete gaps that still block launch:

- no login or logout flow
- no token issuance flow
- no refresh or revocation behavior
- no cookie or server-session profile
- no JWT or signed-claims verification
- no external identity provider integration
- no secure secret storage or rotation story
- no production-grade credential transport policy beyond static bearer token env wiring
- generated browser tokens are public demo credentials, not secrets
- ownership enforcement still depends on field-name heuristics
- only one generated auth profile is proven end to end
- no production deployment proof for auth-enabled generated stacks
- no explicit operational guidance for auth failures, incident response, or credential rollover

## Minimum Next Slices Before Launch

These are the smallest slices that would move us from proof toward launch readiness:

1. Add a real identity boundary.
   This could be signed JWT verification or a generated session/cookie profile, but it must replace the single static env token as the trust boundary.

2. Replace heuristic ownership with explicit resource ownership mapping.
   Launch behavior should not depend on guessing owner fields from names alone.

3. Add credential lifecycle support.
   We need issuance, rotation, expiration, and revocation behavior, not only a fixed token in env.

4. Add a second auth implementation profile.
   A launch path should not depend on only one demo-oriented profile being proven.

5. Prove deployment behavior with auth enabled.
   Local runtime proof is useful, but launch needs at least one deployment-grade verification path.

## Suggested Order

If we continue the auth track, the most sensible order is:

1. signed-token or session-backed identity profile
2. explicit ownership mapping in generated auth
3. deployment proof for an auth-enabled generated stack
4. operational guidance and rotation procedures

## Non-Goals For The Current Profile

We should continue treating these as out of scope for `bearer_demo` itself:

- turning `bearer_demo` into the production profile
- adding a full user/account product around it
- treating static env tokens as acceptable launch auth
