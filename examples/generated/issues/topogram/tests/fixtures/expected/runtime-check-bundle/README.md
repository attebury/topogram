# Issues Runtime Check Bundle

This bundle gives you richer staged runtime verification for the generated stack.

Use it when you want more than a quick smoke test. It goes beyond the lightweight smoke bundle by checking environment readiness, API health, DB-backed seeded data, and deeper API behavior.

## Stages

- `environment`: required env, web readiness, browser-visible issue detail actions, API health, API readiness, and DB-backed seeded issue lookup
- `api`: core issue happy paths, generated lookup endpoints, and important negative cases

## Usage

1. Copy `.env.example` to `.env` if needed
2. Run `bash ./scripts/check.sh`
3. Inspect `state/runtime-check-report.json`

## Notes

- This example uses the generated bearer_jwt_hs256 auth profile for secured API checks.
- Browser checks drive the live React/Vite detail page through Safari to prove visible and hidden issue actions.
- The forbidden-path proof uses a seeded issue that belongs to a different user.
- Runtime checks also verify invalid-signature, expired-token, untrusted-issuer, and untrusted-audience failures.
- Runtime checks also verify a token signed with a secondary rotation key when TOPOGRAM_AUTH_JWT_SECRETS lists multiple keys.
- Mutating checks create, update, and close a runtime-check issue.
- Runtime checks also verify the generated board and user lookup endpoints.
- Later stages are skipped if environment readiness fails.
- The generated server exposes both `/health` and `/ready`.
- Use the smoke bundle for a faster minimal confidence check.
- Use this runtime-check bundle for richer staged verification and JSON reporting.

