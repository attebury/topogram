# Sample Workspace Runtime Check Bundle

This bundle gives you richer staged runtime verification for the generated stack.

Use it when you want more than a quick smoke test. It goes beyond the lightweight smoke bundle by checking environment readiness, API health, DB-backed seeded data, and deeper API behavior.

## Stages

- `environment`: required env, web readiness, API health, API readiness, and DB-backed seeded item lookup
- `api`: core item happy paths, export/job flows, generated lookup endpoints, and important negative cases

## Usage

1. Copy `.env.example` to `.env` if needed
2. Run `bash ./scripts/check.sh`
3. Inspect `state/runtime-check-report.json`

## Notes

- Mutating checks create, update, complete, and archive a runtime-check item.
- Export checks submit a item export job, verify job status, and verify the download endpoint.
- Runtime checks also verify the generated collection and member lookup endpoints.
- Later stages are skipped if environment readiness fails.
- The generated server exposes both `/health` and `/ready`.
- Use the smoke bundle for a faster minimal confidence check.
- Use this runtime-check bundle for richer staged verification and JSON reporting.

## Canonical Verification

- Sources: `ver_create_item_policy`, `ver_item_runtime_flow`
- Scenarios: create item in active collection, reject item in archived collection, reject assignment to inactive member, create item runtime, get created item runtime, list items runtime, update item runtime, complete item runtime, delete item runtime, export items runtime, get item export job runtime, download item export runtime
