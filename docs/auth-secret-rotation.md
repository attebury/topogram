# Bearer JWT HS256 Secret Rotation

This is the verification-side rotation procedure for `bearer_jwt_hs256`.

It answers one question: how do you replace `TOPOGRAM_AUTH_JWT_SECRET` without forcing every signed-in user to re-authenticate?

## Scope

- This document covers **verification key rotation** for the generated server.
- Topogram does not yet issue tokens, so this rotation procedure is what an operator runs when their upstream issuer rotates the signing key. Topogram simply needs to keep accepting the old key long enough for outstanding tokens to expire.
- Asymmetric (RS256/ES256), revocation, and refresh-token lifecycle are still out of scope. See [auth-profile-bearer-jwt-hs256-launch-checklist.md](./auth-profile-bearer-jwt-hs256-launch-checklist.md).

## Environment Variables

- `TOPOGRAM_AUTH_JWT_SECRET` — single-secret shorthand. Used when `TOPOGRAM_AUTH_JWT_SECRETS` is unset or empty.
- `TOPOGRAM_AUTH_JWT_SECRETS` — comma-separated list of HS256 secrets. When set and non-empty, the generated server verifies every incoming JWT against each entry in order and accepts the token if any one matches. Singular `TOPOGRAM_AUTH_JWT_SECRET` is ignored when the plural is set.

Whitespace around commas is trimmed. Empty entries are dropped. If both vars are unset or empty, the server returns `500 missing_auth_jwt_secret` for any protected route.

## Rotation Procedure

The procedure assumes you already have an old secret `K_old` in production and a new secret `K_new` you want to switch to. Total user-visible downtime: zero. Total rollover window: as long as the longest live token's lifetime.

1. **Add `K_new` to the verifier list.** Set `TOPOGRAM_AUTH_JWT_SECRETS=K_old,K_new` and redeploy. The server now accepts tokens signed by either secret. No client impact. Existing tokens still verify against `K_old`.
2. **Switch issuance to `K_new`.** Tell your upstream issuer (whatever signs JWTs) to start signing with `K_new`. From this moment forward, all newly issued tokens are signed with `K_new` and verified against the same. Tokens still in flight, signed with `K_old`, continue to verify because `K_old` is still in the list.
3. **Wait until every `K_old` token has expired.** This is the longest natural lifetime of any token signed with `K_old` (typically `exp - now` at the time of step 2). For one-hour tokens this is one hour. For long-lived tokens, this can be longer. Operationally: do not skip ahead.
4. **Remove `K_old` from the verifier list.** Set `TOPOGRAM_AUTH_JWT_SECRETS=K_new` and redeploy. `K_old` is now dead. Any token still signed with it returns `401 invalid_bearer_signature`.

If the rotation is happening because `K_old` was *leaked*, step 3 should be replaced with "force-expire all `K_old` tokens at the issuer." For Topogram alpha, that means setting a short `exp` on new tokens and accepting the brief sign-out window for any user holding a leaked-key token.

## Storage Guidance Per Deployment Target

The exact mechanism depends on your deployment provider, but the contract is the same: `TOPOGRAM_AUTH_JWT_SECRETS` is a comma-separated list of secrets, supplied to the runtime as one environment variable.

- **Local `.env` file.** Use `TOPOGRAM_AUTH_JWT_SECRETS=primary,secondary`. Do not commit. The fixture `.env.example` files shipped with the generated examples (e.g. `examples/generated/issues/apps/local-stack/.env.example`) demonstrate the format.
- **Railway / Fly / Render-style env vars.** Set `TOPOGRAM_AUTH_JWT_SECRETS` to the comma-separated list directly in the provider UI or CLI. Treat the value as a single secret string.
- **Docker / Kubernetes.** Mount via secret resource. Avoid baking the value into images. Avoid splitting across multiple env vars; the verifier reads only `TOPOGRAM_AUTH_JWT_SECRETS` (plural) and `TOPOGRAM_AUTH_JWT_SECRET` (singular).
- **CI.** Use the secret store provided by the CI system. Never echo the value in build logs.

If your platform's env-var handling cannot represent commas reliably, that is a platform limitation, not a Topogram limitation. Consider base64-wrapping each secret externally and decoding at deployment-config time before assigning to `TOPOGRAM_AUTH_JWT_SECRETS`.

## Runtime Proof

The `issues` example proves rotation end-to-end:

- `TOPOGRAM_AUTH_JWT_SECRETS=topogram-issues-jwt-secret,topogram-issues-jwt-secret-secondary` is set in `.env.example`.
- `TOPOGRAM_AUTH_TOKEN` is signed with the primary secret.
- `TOPOGRAM_AUTH_TOKEN_ROTATING` is signed with the secondary secret.
- Runtime check `list_issues_rotating_token` calls the protected list endpoint with the rotating token and asserts a 200 response — i.e. the secondary key successfully verifies a real request.

See [examples/generated/issues/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json](../examples/generated/issues/topogram/tests/fixtures/expected/runtime-check-bundle/runtime-check-plan.json) for the canonical plan.

## What This Does Not Cover

- Asymmetric keys. HS256 is symmetric; both signer and verifier hold the same secret. RS256/ES256 split the key into a private signing key and a public verification key, and the rotation story is different. See the launch checklist.
- Revocation. A successfully signed, unexpired token will verify even if you "logged the user out" upstream. Token revocation requires either short token lifetimes plus refresh, or a deny-list. Topogram alpha provides neither.
- Token issuance. Topogram does not issue tokens. The signer side of rotation (steps 2 in the procedure) lives in whatever upstream system actually mints JWTs.

## See Also

- [Bearer JWT HS256 Auth Profile](./auth-profile-bearer-jwt-hs256.md)
- [Bearer JWT HS256 Launch Checklist](./auth-profile-bearer-jwt-hs256-launch-checklist.md)
- [Auth Alpha Complete](./auth-alpha-complete.md)
