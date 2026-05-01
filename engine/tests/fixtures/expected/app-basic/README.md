# Topogram Todo App Bundle

This is the polished generated app bundle for Topogram v0.1.

It includes:
- `apps/services/<api-id>/`: generated API service scaffolds
- `apps/web/<web-id>/`: generated web scaffolds
- `apps/db/<db-id>/`: generated DB lifecycle bundles
- `apps/native/<native-id>/`: generated native app scaffolds
- `deploy/`: deployment packaging
- `compile/`: generated compile verification
- `smoke/`: minimal runtime confidence check
- `runtime-check/`: richer staged runtime verification with JSON reporting

## Start Here

1. Copy `.env.example` to `.env` if you want to customize defaults
2. Bootstrap the app:
   - `bash scripts/bootstrap.sh`
   - this provisions or migrates the database and seeds demo data by default
3. Run the app:
   - `bash scripts/dev.sh`
4. Compile-check it:
   - `bash scripts/compile-check.sh`
5. Run self-contained local runtime verification:
   - `bash scripts/runtime.sh`

Or, with the app still running, run richer staged runtime checks in another terminal:
   - `bash scripts/runtime-check.sh`
Then run the lightweight smoke check:
   - `bash scripts/smoke.sh`

## Golden Path

For the default generated bundle:

1. Use the `local_process` environment profile
2. Run `bash scripts/bootstrap.sh`
3. Run `bash scripts/dev.sh`
4. Open the web app at `http://localhost:5173/tasks`
5. Confirm the seeded "Demo Project" and "Seeded Demo Task" flow through the stack
6. Run `bash scripts/compile-check.sh`
7. Run `bash scripts/runtime.sh`

## Deployment

- Validate deploy configuration:
  - `bash scripts/deploy-check.sh`
- Then use the generated deployment bundle under `deploy/`

## Notes

- The default generated app profile is `local_process`
- The default generated deployment profile is `fly_io`
- Demo data is seeded during bootstrap unless `TOPOGRAM_SEED_DEMO=false`
- If `.env` is missing, generated scripts fall back to `.env.example`
- You can regenerate other environment or deployment profiles from the Topogram source project
- The generated server exposes `GET /health` for liveness and `GET /ready` for DB-backed readiness
- `compile/` is self-contained and does not require the app to be running
- `smoke/` and `runtime-check/` are probes against a running local stack
- `scripts/runtime.sh` starts the local stack, waits for readiness, runs the probes, and stops the stack
