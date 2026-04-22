# Brownfield Trial: Prisma Next.js Auth Starter

## Trial Target

Repository:

- `trials/prisma-nextjs-auth-starter`

Why this trial matters:

- real app, not a curated example
- Prisma DB source
- Next.js App Router UI
- Next.js route and server-action API evidence
- auth flows

## What Worked

### DB import

- Prisma import produced clean `user` and `post` entities
- relation inference worked for `post.author -> user`

### UI import

- App Router page discovery worked
- screens, routes, and actions were inferred for:
  - `post_list`
  - `post_detail`
  - `post_create`
  - `user_create`
  - `login`
  - `register`
  - `setup`
  - `home`

### API import

- Next.js `app/api` route import worked
- server-action import worked
- NextAuth-style login/register inference worked

### Workflow import

- `workflow_post`
- `workflow_user`

### Reconcile / adoption

- reconcile produced meaningful `post` and `user` bundles
- selective adoption produced canonical user/auth artifacts in the trial Topogram

## Main Gaps Exposed

### Concept typing

Some non-resource surfaces still need better typing:

- `home`
- `login`
- `register`
- `setup`

These should behave like flow/app surfaces, not pseudo-entities.

### Docs noise

Generic README scanning still pulls in too many infrastructure terms in some repos.

### Generalization

The Next.js trial is strong, but more brownfield repos are needed to validate:

- API fallback quality
- non-Next UI stacks
- non-Prisma DB sources
- auth and workflow inference outside this specific pattern

## Why This Trial Was Valuable

It proved the overall brownfield loop is real:

- import
- docs scan
- gap reporting
- reconcile
- adoption status
- selective canonical adoption

The remaining problems are now mostly extractor-quality and concept-typing problems, not architecture problems.

## Recommended Next Trials

- backend-heavy TypeScript app with Express or Fastify
- Drizzle-based app
- tRPC app
- GraphQL app
- non-Next UI stack such as React Router or Remix
