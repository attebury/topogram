# Topogram

Topogram is being narrowed around one complete workflow: author a Topogram, generate a runnable app, and verify it.

## First Use

Use Node 20+.

### First-Use Prerequisites

For a private-package consumer project, configure GitHub Packages access and
install the CLI as a project dependency:

```bash
export NODE_AUTH_TOKEN=<github-token-with-package-read>
npm config set @attebury:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken "$NODE_AUTH_TOKEN"
npm install --save-dev @attebury/topogram
npx topogram doctor
```

Catalog aliases such as `hello-web`, `web-api-db`, and `todo` are resolved
through the `attebury/topograms` catalog. Local runs can provide catalog access
with `GITHUB_TOKEN`, `GH_TOKEN`, or `gh auth login`; package installs still need
`NODE_AUTH_TOKEN` when reading private GitHub Packages.

`TOPOGRAM_CATALOG_SOURCE=none` intentionally disables catalog discovery. In
that mode, `topogram template list` shows no shared starters and
`topogram new ./my-app` cannot resolve the default `hello-web` alias. Pass
`--catalog <source>`, or use `--template` with a local template path or full
package spec.

Choose your starting point:

```bash
# Catalog template alias, installs a versioned template package.
npx topogram template list
npx topogram new ./hello-web --template hello-web
cd ./hello-web
NODE_AUTH_TOKEN="$NODE_AUTH_TOKEN" npm install
npm run check
npm run generate

# Pure Topogram source copy, for editing before generation.
npx topogram catalog show hello
npx topogram catalog copy hello ./hello-topogram
cd ./hello-topogram
npx topogram source status --local
npx topogram check
```

For executable templates, review the copied `implementation/` directory before
generation, then use:

```bash
cd ./my-app
npm run template:policy:explain
npm run trust:status
npm run check
npm run generate
```

For source checkout development, use the repo scripts below.

To run the disposable generated-app smoke test:

```bash
cd topogram
npm install
npm run smoke:test-app
npm run cli:check
```

This writes a generated starter to `.tmp/smoke-test-app`.

To create your own starter:

```bash
cd topogram
npm install
npm run new -- ./my-topogram-app --template ./engine/tests/fixtures/templates/hello-web
cd ./my-topogram-app
npm install
npm run explain
npm run doctor
npm run check
npm run generate
topogram generate ./topogram --generate ui-component-contract
npm run verify
```

The default starter alias is `hello-web`: a small vanilla HTML/CSS/JS app with
two pages and one workflow doc. Starter content is package-backed and resolved
through the catalog. Use `topogram template list` or the friendlier
`topogram new --list-templates` alias for a quick starter summary, and
`topogram catalog show <id>` to inspect catalog aliases:

```bash
topogram template list
topogram new --list-templates
topogram catalog show todo
topogram new ./todo-demo --template todo
```

| Template | Stack | Use When |
| --- | --- | --- |
| `hello-web` | Vanilla HTML/CSS/JS | You want the smallest generated web app. |
| `hello-api` | Hono | You want API topology without web or database surfaces. |
| `hello-db` | SQLite | You want database lifecycle output only. |
| `web-api` | React + Express | You want a web/API starter without a database. |
| `web-api-db` | SvelteKit + Hono + Postgres | You want the heavier full-stack starter. |

The JSON form is intended for agents and setup scripts:

```bash
topogram new --list-templates --json
topogram query list --json
```

Each template item includes `surfaces`, `generators`, `stack`,
`includesExecutableImplementation`, and `recommendedCommand` so tools can pick a
starter without scraping human output.
Use `topogram query list` to discover focused agent packets such as
`component-behavior`, `change-plan`, `review-packet`, and
`resolved-workflow-context`.

The package-backed starter templates in `topogram-starters` are the canonical
shared starter examples and are surfaced through the `attebury/topograms`
catalog. Generated projects include a project `.npmrc` that reads
`${NODE_AUTH_TOKEN}`, so run `npm install` with a token that can read GitHub
Packages when the CLI dependency comes from `@attebury/topogram`.

Executable templates such as `web-api` and `web-api-db` record local trust in
`.topogram-template-trust.json`; refresh it with `topogram trust template` after
reviewing copied or edited `implementation/` code. The same command records the
`.topogram-template-files.json` baseline used by template update apply. Use
`topogram template explain` for the plain-language lifecycle summary,
`topogram template status` for compact trust metadata, then `topogram trust
status` and `topogram trust diff` to inspect changed files before refreshing
trust.
Those `.topogram-template-*` files are consumer project metadata, not template
source files. `topogram trust template` refuses to write them in a template
source repo unless `--force` is provided.

Inspect, plan, or apply a template update:

```bash
topogram catalog list
topogram catalog show todo
topogram doctor
topogram catalog doctor
topogram catalog show hello
topogram catalog check topograms.catalog.json
topogram catalog copy hello ./hello-topogram
topogram source status ./hello-topogram --local
topogram template list
topogram template explain
topogram template status --latest
topogram template policy check
topogram template policy init
topogram template policy pin @attebury/topogram-template-todo@0.1.6
topogram template update --status
topogram template update --recommend
topogram template update --recommend --latest
topogram template update --plan
topogram template update --check
topogram template update --plan --template @attebury/topogram-template-todo@0.1.6
topogram template update --plan --json
topogram template update --status --out .topogram/template-update-report.json
topogram template update --apply
topogram template update --accept-current topogram/entities/entity-greeting.tg
topogram template update --accept-candidate topogram/entities/entity-greeting.tg --template ./next-template
topogram template update --delete-current topogram/entities/old-resource.tg --template ./next-template
topogram template detach
topogram template detach --dry-run --json
```

The update plan compares template-owned files in the current project with the
candidate template and reports added, changed, and current-only files. `--status`
adds baseline/conflict analysis for the current adoption state without writing.
`--check` is the no-write CI guard: it exits nonzero when the project is not
aligned with the recorded or supplied template. `--out` writes the same
machine-readable review report emitted by JSON mode. `--apply` writes only
reviewed added/changed template-owned files, records a new
`.topogram-template-files.json` baseline, skips deletes, and refuses to
overwrite files that changed since the last trusted template-owned baseline.
Human output summarizes no-op, applied, skipped, and conflict counts; JSON output
includes structured diagnostics with codes, paths, suggested fixes, and workflow
steps. If the baseline is missing, review the current template-owned files and
run `topogram trust template`.

Use `topogram template detach` when a maintained app should stop tracking the
starter template. Detach removes the `template` block from `topogram.project.json`
and removes `.topogram-template-files.json`. It preserves
`.topogram-template-trust.json` when executable `implementation/` config remains,
so generation still requires trusted local implementation content. Pass
`--remove-policy` when the project should also remove `topogram.template-policy.json`.
After detach, the project owns its files; Topogram no longer tries to match the
starter template, and template update commands are no longer the edit path.

`topogram.template-policy.json` is the project-owned template allow policy.
New starters create one automatically. Use `topogram template policy check` in
projects and CI to verify the current template metadata against allowed sources,
template ids, package scopes, executable-template policy, and optional pinned
versions. Use `topogram template policy explain` when a human or agent needs to
see each rule, the actual template/package values, catalog provenance, and the
next command to fix a denial. Use `topogram template policy init` to create or
refresh the policy from the current `topogram.project.json`.
After reviewing a candidate template, use `topogram template policy pin
<template-id@version>` to record the reviewed exact version without hand-editing
the policy file.

`topogram template update --recommend` is the human handoff view for upgrades.
It summarizes current/candidate versions, conflicts, delete reviews, and the
next command to run before you apply or adopt files.
Use `topogram template status --latest` or `topogram template update --latest`
only when you want an explicit package registry lookup; normal status remains
local and deterministic.

For single-file adoption, use `--accept-current` when a local edit is
intentional and should become the new trusted baseline, `--accept-candidate`
when one candidate file should replace the current file after baseline checks,
and `--delete-current` when the candidate removed a file and the current file
still matches the trusted baseline.

Validate a reusable template pack:

```bash
topogram template check ./my-template
topogram template check @attebury/topogram-template-todo@0.1.6 --json
```

Template checks create a temporary starter, run `topogram check` behavior,
verify executable-template trust metadata, and verify a no-write update plan.
Failures include structured diagnostics with a code, severity, path when known,
and a suggested fix when Topogram can infer one.

To create a starter from a shared template pack:

```bash
topogram new ./todo-demo --template @attebury/topogram-template-todo
topogram new ./todo-demo --template todo
topogram new ./hello-web --template hello-web
```

The catalog alias forms resolve through the private catalog at
`github:attebury/topograms/topograms.catalog.json`. The catalog is an index:
templates and reusable topograms are still installed from versioned packages.
Use `topogram catalog show <id>` to see what an entry is and which command to
run next. Use `topogram template list` when you only need a quick starter
summary.
Use `topogram catalog copy <id> <target>` for pure topogram entries that should
be copied into a workspace for editing. Copied topograms include
`.topogram-source.json`; run `topogram source status <target> --local` to compare the
current files to the import baseline. This is provenance only: local edits are
allowed, and it does not block `topogram check` or `topogram generate`.
Template-created projects also report whether their template baseline still
matches or has diverged into local project-owned changes:
Use `--local` for the normal offline-safe workflow. Use `--remote` when you want
to check package registry status.

```bash
topogram catalog show hello
topogram catalog copy hello ./hello-topogram
cd ./hello-topogram
topogram source status --local
topogram source status --remote
topogram check
topogram generate
```

See [Catalog](./docs/catalog.md).

Private catalog and template package failures are normalized into actionable
messages for missing auth, missing package access, missing package/version, and
catalog source 404s. For private package consumers, configure `.npmrc` with the
GitHub Packages registry and run with `NODE_AUTH_TOKEN` when npm needs package
read access.

Use `topogram version` to audit the installed CLI package, version, executable
path, and Node runtime. Use `topogram doctor` when setup is unclear. It checks
Node.js, npm, GitHub Packages registry configuration, `NODE_AUTH_TOKEN`,
Topogram CLI package access, catalog reachability, GitHub token or `gh auth`
readiness for private GitHub catalog sources, and npm package access for each
catalog entry:

```bash
topogram version
topogram version --json
topogram doctor
topogram doctor --json
topogram doctor --catalog ./topograms.catalog.json
```

Clean-machine private template flow:

```bash
export NODE_AUTH_TOKEN=<github-token-with-package-read>
npm config set @attebury:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken "$NODE_AUTH_TOKEN"
npm install --global @attebury/topogram
gh auth login
topogram doctor
topogram template list
topogram catalog show todo
topogram new ./todo-demo --template todo
cd ./todo-demo
npm install
npm run check
npm run generate
npm run verify
```

If `topogram new --template todo` fails before npm runs, fix catalog access:
set `GITHUB_TOKEN` or `GH_TOKEN`, or authenticate `gh`. If it resolves the
catalog alias but npm fails, fix GitHub Packages access and `NODE_AUTH_TOKEN`.

Consumer repos can update their CLI dependency with:

```bash
NODE_AUTH_TOKEN=<github-token-with-package-read> topogram package update-cli --latest
```

The command resolves the latest published CLI package, updates
`@attebury/topogram`, refreshes stale lockfile tarball metadata when needed,
updates `topogram-cli.version` when the consumer repo has that convention file,
then runs available checks when dependencies were installed or already current:
`cli:surface`, `doctor`, `catalog:show`, `catalog:template-show`, and `check`.
If npm auth is missing and the command falls back to direct file updates through
the GitHub Packages API, it skips local checks until `npm install`, `npm ci`, or
CI refreshes `node_modules`.

Create generated projects outside `engine/`. The engine is source and test code; generated app workspaces should live beside it, for example `./my-topogram-app`.

For local runtime verification, run:

```bash
npm run bootstrap
npm run dev
```

Then, from another terminal while the app is still running:

```bash
npm run app:smoke
npm run app:runtime-check
```

For a self-contained local runtime pass that starts and stops the generated stack:

```bash
npm run app:runtime
```

## Repo Layout

- `engine/` - Topogram engine, CLI, tests, and fixtures
- `engine/tests/fixtures/` - engine-owned regression workspaces and expected outputs
- `engine/tests/fixtures/templates/` - engine-owned local template fixtures for tests
- `docs/` - terse first-use docs, grammar reference, and component contract guide

## Engine

The engine package publishes privately as `@attebury/topogram` and exposes the `topogram` bin:

```bash
npm run new -- ./my-app --template ./engine/tests/fixtures/templates/hello-web
cd ./my-app
npm run doctor
npm run check
npm run generate
```

Publishing is manual through the `Publish CLI Package` GitHub Actions workflow.
Before publishing, run `npm run release:prepare -- <version>` and commit the
updated `engine/package.json` and `engine/package-lock.json`. See
[Releasing](./docs/releasing.md).

This repo owns the CLI package, engine validation, catalog mechanics, and test
fixtures. Starter product behavior lives outside the engine: shared starter
packages live in `topogram-starters`, the generated Todo demo lives in
`topogram-demo-todo`, and the Todo starter source lives in
`topogram-template-todo`.
See [Template Authoring](./docs/template-authoring.md) for pack layout, private package setup, and trust policy.
See [Catalog](./docs/catalog.md) for private catalog layout and commands.

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
