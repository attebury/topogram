# Todo Local Runtime Stack

This bundle packages the generated Todo runtime into one local environment:

- `server/`: generated Hono + Prisma server scaffold
- `web/`: generated SvelteKit web scaffold
- `db/`: generated DB lifecycle bundle
- `docker-compose.yml`: local Postgres container

## Quick Start

1. Copy `.env.example` to `.env` if you want to customize defaults
2. Start Postgres:
   - `./scripts/docker-db.sh`
3. Bootstrap or migrate the database:
   - `./scripts/bootstrap-db.sh`
4. Start the stack:
   - `./scripts/stack-dev.sh`

## Demo Seed Data

- Bootstrap seeds a demo user, project, and task by default
- Set `TOPOGRAM_SEED_DEMO=false` to skip demo seeding
- Default seeded IDs come from `.env.example`

## Alternative Docker Workflow

- Start only the database: `./scripts/docker-db.sh`
- Start the database, server, and web app in containers: `./scripts/docker-stack.sh`


## Notes

- The generated server expects Postgres plus Prisma.
- The generated web app talks to `PUBLIC_TOPOGRAM_API_BASE_URL`.
- If `.env` is missing, generated scripts fall back to `.env.example`.
- The DB lifecycle scripts remain the source of truth for greenfield bootstrap and brownfield migration.
