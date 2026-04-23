# Content Approval SQLite DB Lifecycle

This bundle gives agents a repeatable database workflow for projection `proj_db_sqlite`.

## Modes

- Greenfield: run `./scripts/db-bootstrap-or-migrate.sh` with no current snapshot
- Brownfield: run `./scripts/db-bootstrap-or-migrate.sh` with `state/current.snapshot.json` already present

## Required Environment

- `DATABASE_URL`

## Optional Environment

- `TOPOGRAM_REPO_ROOT`
- `TOPOGRAM_INPUT_PATH`
- `TOPOGRAM_DB_STATE_DIR`

## Files

- Desired snapshot: `state/desired.snapshot.json`
- Current snapshot: `state/current.snapshot.json`
- Migration plan: `state/migration.plan.json`
- Migration SQL: `state/migration.sql`

## Commands

- `./scripts/db-status.sh`
- `./scripts/db-bootstrap.sh`
- `./scripts/db-migrate.sh`
- `./scripts/db-bootstrap-or-migrate.sh`
