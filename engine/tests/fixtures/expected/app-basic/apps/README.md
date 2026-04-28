# Todo Local Runtime Stack

This bundle packages the generated runtime into one local environment:

- `services/<api-id>/`: generated API service scaffolds
- `web/<web-id>/`: generated SvelteKit web scaffolds
- `db/<db-id>/`: generated DB lifecycle bundles
- local-process Postgres orchestration (no Docker files generated)

## Quick Start

1. Copy `.env.example` to `.env` if you want to customize defaults
2. Start the database:
   - use your local Postgres service
3. Bootstrap or migrate the database:
   - `./scripts/bootstrap-db.sh`
4. Start the stack:
   - `./scripts/stack-dev.sh`

## Demo Seed Data

- Bootstrap seeds demo data by default
- Set `TOPOGRAM_SEED_DEMO=false` to skip demo seeding
- Default seeded IDs come from `.env.example`

## Local Process Notes

- Install Node.js and npm locally before using this bundle.
- Make sure the Postgres server is already running before `./scripts/bootstrap-db.sh`.
- `DATABASE_URL` and `DATABASE_ADMIN_URL` should point at your local or managed Postgres instance.


## Notes

- The generated server expects Postgres plus Prisma.
- The generated web app talks to `PUBLIC_TOPOGRAM_API_BASE_URL`.
- If `.env` is missing, generated scripts fall back to `.env.example`.
- The DB lifecycle scripts remain the source of truth for greenfield bootstrap and brownfield migration.
