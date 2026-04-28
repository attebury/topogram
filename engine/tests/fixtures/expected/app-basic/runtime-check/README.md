# Todo Runtime Check Bundle

This bundle gives you richer staged runtime verification for the generated stack.

Use it when you want more than a quick smoke test. It goes beyond the lightweight smoke bundle by checking environment readiness, API health, DB-backed seeded data, and deeper API behavior.

## Stages

- `environment`: required env, web readiness, API health, API readiness, and DB-backed seeded task lookup
- `api`: core task happy paths, export/job flows, generated lookup endpoints, and important negative cases

## Usage

1. Copy `.env.example` to `.env` if needed
2. Run `bash ./scripts/check.sh`
3. Inspect `state/runtime-check-report.json`

## Notes

- Mutating checks create, update, complete, and archive a runtime-check task.
- Export checks submit a task export job, verify job status, and verify the download endpoint.
- Runtime checks also verify the generated project and user lookup endpoints.
- Later stages are skipped if environment readiness fails.
- The generated server exposes both `/health` and `/ready`.
- Use the smoke bundle for a faster minimal confidence check.
- Use this runtime-check bundle for richer staged verification and JSON reporting.

## Canonical Verification

- Sources: `ver_create_task_policy`, `ver_task_runtime_flow`
- Scenarios: create task in active project, reject task in archived project, reject assignment to inactive user, create task runtime, get created task runtime, list tasks runtime, update task runtime, complete task runtime, delete task runtime, export tasks runtime, get task export job runtime, download task export runtime
