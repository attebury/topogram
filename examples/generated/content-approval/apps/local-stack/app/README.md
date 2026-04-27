# Content Approval Local Runtime Stack

This bundle packages the generated runtime into one local environment:

- `server/`: generated Hono + Prisma server scaffold
- `web/`: generated SvelteKit web scaffold
- `db/`: generated DB lifecycle bundle
- local SQLite file orchestration (no Docker files generated)

## Quick Start

1. Copy `.env.example` to `.env` if you want to customize defaults
2. Start the database:
   - no separate DB service is required
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
- SQLite is file-backed for this bundle; no separate DB server is required.


## Notes

- The generated server expects SQLite plus Prisma.
- The generated web app talks to `PUBLIC_TOPOGRAM_API_BASE_URL`.
- If `.env` is missing, generated scripts fall back to `.env.example`.
- The DB lifecycle scripts remain the source of truth for greenfield bootstrap and brownfield migration.
