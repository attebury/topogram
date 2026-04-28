# Topogram Todo Deployment Stack

This bundle packages deployment helpers for the generated runtime.

- `services/app_api/`: generated Hono + Prisma server scaffold
- `web/app_sveltekit/`: generated SvelteKit web scaffold
- platform deployment files for `fly_io`
- a Vercel config for the web app

## Fly.io Server Deploy

- Review `fly.toml`
- Set secrets with `fly secrets set DATABASE_URL=...`
- Deploy with `fly deploy`

## Web Deploy

- Review `web/app_sveltekit/vercel.json`
- Set `PUBLIC_TOPOGRAM_API_BASE_URL`
- Deploy with `vercel deploy`

## Database Migrations

- Run `npm run db:migrate` against the target database before or during deploy
- The generated server bundle includes Prisma schema and DB lifecycle scripts for greenfield or brownfield environments
