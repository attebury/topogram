# Known-Good Release Matrix

This matrix records the npmjs and GitHub Actions state verified on
2026-05-06 after the component realization and Todo template release train.
Treat it as a dated release audit, not a floating compatibility promise.

## Core

| Package or Repo | Version or Commit | Verification |
| --- | --- | --- |
| `@topogram/cli` | `0.3.45` | `attebury/topogram` Fresh npmjs Smoke and Installed CLI First Use passed on `main` |
| `attebury/topograms` catalog | `6189159` | Catalog Verification passed; `todo` resolves to `@topogram/template-todo@0.1.31` |
| `topogram-demo-todo` | `80a127b` | Demo Verification passed from default catalog creation through runtime |

## Starters

| Catalog ID | Package | Version | Stack |
| --- | --- | --- | --- |
| `hello-web` | `@topogram/starter-hello-web` | `0.1.9` | Vanilla HTML/CSS/JS |
| `hello-api` | `@topogram/starter-hello-api` | `0.1.9` | Hono |
| `hello-db` | `@topogram/starter-hello-db` | `0.1.9` | SQLite |
| `web-api` | `@topogram/starter-web-api` | `0.1.9` | React + Express |
| `web-api-db` | `@topogram/starter-web-api-db` | `0.1.9` | SvelteKit + Hono + Postgres |
| `todo` | `@topogram/template-todo` | `0.1.31` | SvelteKit + Hono + Postgres |
| `hello` | `@topogram/topogram-hello` | `0.1.1` | Pure Topogram package |

## Generators

| Generator Package | Version | Surface |
| --- | --- | --- |
| `@topogram/generator-vanilla-web` | `0.1.2` | web |
| `@topogram/generator-react-web` | `0.1.5` | web |
| `@topogram/generator-sveltekit-web` | `0.1.15` | web |
| `@topogram/generator-hono-api` | `0.2.7` | api |
| `@topogram/generator-express-api` | `0.1.3` | api |
| `@topogram/generator-sqlite-db` | `0.1.2` | database |
| `@topogram/generator-postgres-db` | `0.1.6` | database |
| `@topogram/generator-swiftui-native` | `0.1.2` | native |

All generator repos reported passing `Generator Verification` on `main` for the
versions above before this matrix was recorded.

## Consumer Proofs

The external Todo demo is the canonical end-to-end consumer proof for the
current catalog-backed workflow:

```bash
topogram new ./todo-demo --template todo
cd ./todo-demo
npm install
npm run check
npm run generate
npm run app:components
npm run verify
npm run app:runtime
```

The demo CI also verifies `topogram new` from the default public catalog and
from the repo-local catalog fixture. That prevents local fixtures from masking
a broken published catalog alias.
