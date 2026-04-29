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

The built-in starter is a neutral Hello-resource app with one API, one SvelteKit
web surface, and one Postgres database projection. Executable templates record
local trust in `.topogram-template-trust.json`; refresh it with
`topogram trust template` after reviewing copied or edited `implementation/`
code. The same command records the `.topogram-template-files.json` baseline used
by template update apply. Use `topogram template status` for the lifecycle summary, then
`topogram trust status` and `topogram trust diff` to inspect changed files
before refreshing trust.

Plan or apply a template update:

```bash
topogram template update --plan
topogram template update --plan --template @attebury/topogram-template-todo@0.1.1
topogram template update --plan --json
topogram template update --apply
```

The update plan compares template-owned files in the current project with the
candidate template and reports added, changed, and current-only files.
`--apply` writes only reviewed added/changed template-owned files, records a new
`.topogram-template-files.json` baseline, skips deletes, and refuses to
overwrite files that changed since the last trusted template-owned baseline.

Validate a reusable template pack:

```bash
topogram template check ./my-template
topogram template check @attebury/topogram-template-todo@0.1.1 --json
```

Template checks create a temporary starter, run `topogram check` behavior,
verify executable-template trust metadata, and verify a no-write update plan.
Failures include structured diagnostics with a code, severity, path when known,
and a suggested fix when Topogram can infer one.

To create a starter from a shared template pack:

```bash
topogram new ./todo-demo --template @attebury/topogram-template-todo
```

Create generated projects outside `engine/`. The engine is source and test code; generated app workspaces should live beside it, for example `./my-topogram-app`.

For local runtime verification, run:

```bash
npm run bootstrap
npm run dev
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

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
