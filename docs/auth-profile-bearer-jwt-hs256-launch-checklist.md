# Bearer JWT HS256 Launch Checklist

This is the launch-readiness boundary for `bearer_jwt_hs256`.

It answers one question: what blocks the primary alpha auth profile from being called production-ready?

## Current State

What is already true:

- generated Hono and Express backends can verify HS256 signed bearer tokens
- generated backends reject missing tokens, malformed tokens, invalid signatures, and expired tokens with `401`
- generated backends reject authenticated principals that fail modeled auth rules with `403`
- generated backends enforce `permission`, explicit `ownership_field`, and `claim` rules from `.tg`
- generated web clients attach the browser-visible demo token for local proof flows
- generated UI visibility can follow the same modeled auth rules as the backend
- runtime-check bundles prove `401` and `403` behavior in the `issues` and `content-approval` examples

What is not true yet:

- `bearer_jwt_hs256` is not a production auth system
- Topogram does not issue tokens
- Topogram does not manage refresh, revocation, key rotation, audit logging, rate limiting, or identity-provider integration
- browser-visible demo tokens are still demo credentials, not production trust boundaries

## Alpha-Complete Criteria

`bearer_jwt_hs256` supports the current auth alpha claim when used with the generated proof loop:

- one primary signed-token profile
- modeled `permission`, `ownership`, and `claim` semantics
- generated backend enforcement
- generated UI visibility
- runtime checks for both authentication failures (`401`) and authorization failures (`403`)

For the canonical claim, see [auth-alpha-complete.md](./auth-alpha-complete.md).

## Launch Blockers

These are the concrete gaps that still block production launch claims:

- no token issuance flow
- no login or logout flow
- no refresh-token lifecycle
- no token revocation behavior
- no key rotation procedure
- no issuer or audience validation
- no asymmetric-key profile such as RS256 or ES256
- no external identity provider integration
- no deployment-provider guidance for secret storage
- no rate limiting or abuse controls around protected routes
- no auth audit log or incident response playbook
- no production deployment proof for an auth-enabled generated stack

## Minimum Next Slices Toward Production

The smallest useful order is:

1. Add issuer and audience validation to the JWT profile.
2. Add key rotation guidance and a secret-storage policy per deployment target.
3. Add an asymmetric JWT profile for external IdP integration.
4. Add revocation or short-lived-token guidance.
5. Add an auth-enabled deployment proof with generated runtime checks.
6. Add operational guidance for auth failures, audit logging, and credential rollover.

## Non-Goals For This Profile

Do not turn `bearer_jwt_hs256` into a full identity product.

Out of scope for this profile:

- user registration
- password storage
- OAuth flows
- hosted identity management
- enterprise SSO
- treating `PUBLIC_TOPOGRAM_DEMO_AUTH_TOKEN` as a secret

The right production path is likely a separate provider-backed or asymmetric-key profile, not expanding HS256 until it pretends to be a full auth platform.
