# Content Approval Runtime Check Bundle

This bundle gives you richer staged runtime verification for the generated stack.

Use it when you want more than a quick smoke test. It goes beyond the lightweight smoke bundle by checking environment readiness, API health, DB-backed seeded data, and deeper API behavior.

## Stages

- `environment`: required env, web readiness, API health, API readiness, and DB-backed seeded article lookup
- `api`: article creation, review submission, approval, rejection, lookup endpoints, and negative cases

## Usage

1. Copy `.env.example` to `.env` if needed
2. Run `bash ./scripts/check.sh`
3. Inspect `state/runtime-check-report.json`

## Notes

- Mutating checks create, update, approve, and reject runtime-check articles.
- Runtime checks also verify the generated publication and reviewer lookup endpoints.
- Later stages are skipped if environment readiness fails.
- The generated server exposes both `/health` and `/ready`.
- Use the smoke bundle for a faster minimal confidence check.
- Use this runtime-check bundle for richer staged verification and JSON reporting.
