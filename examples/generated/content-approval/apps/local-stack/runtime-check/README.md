# Content Approval Runtime Check Bundle

This bundle gives you richer staged runtime verification for the generated stack.

Use it when you want more than a quick smoke test. It goes beyond the lightweight smoke bundle by checking environment readiness, API health, DB-backed seeded data, and deeper API behavior.

## Stages

- `environment`: required env, browser-visible reviewer actions, web readiness, API health, API readiness, and DB-backed seeded article lookup
- `api`: article creation, review submission, request-revision, claim-gated approval, rejection, lookup endpoints, and negative cases

## Usage

1. Copy `.env.example` to `.env` if needed
2. Run `bash ./scripts/check.sh`
3. Inspect `state/runtime-check-report.json`

## Notes

- This example uses the generated bearer_jwt_hs256 auth profile so review claims travel through API and UI proof paths.
- Browser checks prove reviewer-only article actions are visible with the reviewer claim and hidden without it.
- Runtime checks verify a valid signed token without the reviewer claim is rejected with 403.
- Mutating checks create, update, request revision for, approve, and reject runtime-check articles.
- Runtime checks also verify the generated publication and reviewer lookup endpoints.
- Later stages are skipped if environment readiness fails.
- The generated server exposes both `/health` and `/ready`.
- Use the smoke bundle for a faster minimal confidence check.
- Use this runtime-check bundle for richer staged verification and JSON reporting.

## Canonical Verification

- Sources: `ver_article_review_flow`
- Scenarios: create article in draft, request revision for submitted article, resubmit article after revision requested, reject approval without precondition, approve submitted article, reject submitted article
