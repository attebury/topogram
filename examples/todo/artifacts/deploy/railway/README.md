# Todo Deployment Stack

This bundle packages deployment helpers for the generated Todo runtime.

- `server/`: generated Hono + Prisma server scaffold
- `web/`: generated SvelteKit web scaffold
- platform deployment files for `railway`
- a Vercel config for the web app

## Railway Server Deploy

- Review `railway.json`
- Set environment variables in Railway
- Deploy with `railway up`

## Web Deploy

- Review `web/vercel.json`
- Set `PUBLIC_TOPOGRAM_API_BASE_URL`
- Deploy with `vercel deploy`

## Database Migrations

- Run `npm run db:migrate` against the target database before or during deploy
- The generated server bundle includes Prisma schema and DB lifecycle scripts for greenfield or brownfield environments
