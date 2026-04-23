# Todo Runtime Smoke Bundle

This bundle gives you lightweight runtime verification for the generated stack.

Use it when you want a fast, minimal confidence check that the generated stack is basically up and responding.

## Usage

1. Set `TOPOGRAM_API_BASE_URL`
2. Set `TOPOGRAM_WEB_BASE_URL`
3. Run `bash ./scripts/smoke.sh`

The smoke test will:
- confirm the web UI responds on `/tasks`
- assume the generated demo seed data has been applied
- create a primary resource through the API
- fetch the created primary resource
- confirm the list endpoint responds

If you want staged readiness checks, richer API verification, and a machine-readable report, use the runtime-check bundle instead.

## Canonical Verification

- Sources: `ver_runtime_smoke`
- Scenarios: tasks page responds, create task smoke, get created task smoke, list tasks smoke
