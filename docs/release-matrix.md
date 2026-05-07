# Known-Good Release Matrix

This matrix records the npmjs and GitHub Actions state verified on
2026-05-07 after the watched consumer-rollout release train.
Treat it as a dated release audit, not a floating compatibility promise.

## Core

| Package or Repo | Version or Commit | Verification |
| --- | --- | --- |
| `@topogram/cli` | `0.3.52` | Local package smoke passed and npmjs publish verified |
| `attebury/topograms` catalog | pending | Local catalog check passed; `todo` resolves to `@topogram/template-todo@0.1.34` |
| `topogram-demo-todo` | `1cfc817` | Demo Verification passed from default catalog creation through runtime |

## Starters

| Catalog ID | Package | Version | Stack |
| --- | --- | --- | --- |
| `hello-web` | `@topogram/starter-hello-web` | `0.1.11` | Vanilla HTML/CSS/JS |
| `hello-api` | `@topogram/starter-hello-api` | `0.1.11` | Hono |
| `hello-db` | `@topogram/starter-hello-db` | `0.1.11` | SQLite |
| `web-api` | `@topogram/starter-web-api` | `0.1.11` | React + Express |
| `web-api-db` | `@topogram/starter-web-api-db` | `0.1.11` | SvelteKit + Hono + Postgres |
| `todo` | `@topogram/template-todo` | `0.1.34` | SvelteKit + Hono + Postgres |
| `hello` | `@topogram/topogram-hello` | `0.1.2` | Pure Topogram package |

## Generators

| Generator Package | Version | Surface |
| --- | --- | --- |
| `@topogram/generator-vanilla-web` | `0.1.4` | web |
| `@topogram/generator-react-web` | `0.1.7` | web |
| `@topogram/generator-sveltekit-web` | `0.1.17` | web |
| `@topogram/generator-hono-api` | `0.2.8` | api |
| `@topogram/generator-express-api` | `0.1.4` | api |
| `@topogram/generator-sqlite-db` | `0.1.3` | database |
| `@topogram/generator-postgres-db` | `0.1.7` | database |
| `@topogram/generator-swiftui-native` | `0.1.3` | native |

All generator repos passed local package checks against `@topogram/cli@0.3.52`
before publishing their npmjs patch versions.

## Consumer Proofs

The external Todo demo is the canonical end-to-end consumer proof for the
current catalog-backed workflow:

```bash
topogram new ./todo-demo --template todo
cd ./todo-demo
npm install
npm run check
npm run generate
npm run app:compile
npm run verify
npm run app:runtime
```

The demo CI also verifies `topogram new` from the default public catalog and
from the repo-local catalog fixture. That prevents local fixtures from masking
a broken published catalog alias.
