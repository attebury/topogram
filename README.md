# Topogram

Topogram is being narrowed around one complete workflow: author a Topogram, generate a runnable app, and verify it.

## First Use

Use Node 20+.

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
npm run new -- ./my-topogram-app
cd ./my-topogram-app
npm install
npm run explain
npm run check
npm run generate
npm run verify
```

The default built-in starter is `hello-web`: a small vanilla HTML/CSS/JS app
with two pages and one workflow doc. Other built-ins cover `hello-api`,
`hello-db`, `web-api`, and `web-api-db`; inspect them with `topogram template
list`.

Executable templates such as `web-api` and `web-api-db` record local trust in
`.topogram-template-trust.json`; refresh it with `topogram trust template` after
reviewing copied or edited `implementation/` code. The same command records the
`.topogram-template-files.json` baseline used by template update apply. Use
`topogram template status` for the lifecycle summary, then `topogram trust
status` and `topogram trust diff` to inspect changed files before refreshing
trust.

Inspect, plan, or apply a template update:

```bash
topogram catalog list
topogram catalog show todo
topogram catalog show hello
topogram catalog check topograms.catalog.json
topogram catalog copy hello ./hello-topogram
topogram source status ./hello-topogram
topogram template list
topogram template status --latest
topogram template policy check
topogram template policy init
topogram template policy pin @attebury/topogram-template-todo@0.1.2
topogram template update --status
topogram template update --recommend
topogram template update --recommend --latest
topogram template update --plan
topogram template update --check
topogram template update --plan --template @attebury/topogram-template-todo@0.1.2
topogram template update --plan --json
topogram template update --status --out .topogram/template-update-report.json
topogram template update --apply
topogram template update --accept-current topogram/entities/entity-greeting.tg
topogram template update --accept-candidate topogram/entities/entity-greeting.tg --template ./next-template
topogram template update --delete-current topogram/entities/old-resource.tg --template ./next-template
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

`topogram.template-policy.json` is the project-owned template allow policy.
New starters create one automatically. Use `topogram template policy check` in
projects and CI to verify the current template metadata against allowed sources,
template ids, package scopes, executable-template policy, and optional pinned
versions. Use `topogram template policy init` to create or refresh the policy
from the current `topogram.project.json`.
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
topogram template check @attebury/topogram-template-todo@0.1.2 --json
```

Template checks create a temporary starter, run `topogram check` behavior,
verify executable-template trust metadata, and verify a no-write update plan.
Failures include structured diagnostics with a code, severity, path when known,
and a suggested fix when Topogram can infer one.

To create a starter from a shared template pack:

```bash
topogram new ./todo-demo --template @attebury/topogram-template-todo
topogram new ./todo-demo --template todo
```

The second form resolves `todo` through the private catalog at
`github:attebury/topograms/topograms.catalog.json`. The catalog is an index:
templates and reusable topograms are still installed from versioned packages.
Use `topogram catalog show <id>` to see what an entry is and which command to
run next.
Use `topogram catalog copy <id> <target>` for pure topogram entries that should
be copied into a workspace for editing. Copied topograms include
`.topogram-source.json`; run `topogram source status <target>` to compare the
current files to the import baseline. This is provenance only: local edits are
allowed. See [Catalog](./docs/catalog.md).

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

## Repo Layout

- `engine/` - Topogram engine, CLI, tests, and fixtures
- `engine/templates/` - minimal built-in starter template for `topogram new`
- `engine/tests/fixtures/` - engine-owned regression workspaces and expected outputs
- `docs/` - terse first-use docs

## Engine

The engine package publishes privately as `@attebury/topogram` and exposes the `topogram` bin:

```bash
npm run new -- ./my-app
cd ./my-app
npm run check
npm run generate
```

Publishing is manual through the `Publish CLI Package` GitHub Actions workflow.
Before publishing, run `npm run release:prepare -- <version>` and commit the
updated `engine/package.json` and `engine/package-lock.json`. See
[Releasing](./docs/releasing.md).

The generated Todo demo now lives in the private `topogram-demo-todo` repo and consumes the published `@attebury/topogram` package.
The Todo starter source lives in the private `topogram-template-todo` repo and publishes as `@attebury/topogram-template-todo`.
See [Template Authoring](./docs/template-authoring.md) for pack layout, private package setup, and trust policy.
See [Catalog](./docs/catalog.md) for private catalog layout and commands.

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
