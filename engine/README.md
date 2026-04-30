# Topogram Engine

This folder contains the Topogram implementation: parser, validator, resolver, generators, runtime bundle emitters, and CLI.

The active product workflow is authoring-to-generated-app. Engine development should stay separate from user-facing demos.

## Package Shape

The engine is the publishable private CLI package:

```json
{
  "name": "@attebury/topogram",
  "bin": {
    "topogram": "./src/cli.js"
  }
}
```

This lets source checkouts and private-package consumers call:

```bash
topogram create ../my-app
topogram check
topogram generate
topogram catalog list
topogram catalog show todo
topogram catalog check topograms.catalog.json
topogram catalog copy hello ../hello-topogram
topogram package update-cli 0.2.38
topogram source status ../hello-topogram
topogram template list
topogram template show todo
topogram template status
topogram template policy check
topogram template policy pin @scope/template@0.2.0
topogram template check ../my-template
topogram template update --plan
topogram trust template
```

Publishing is manual through the repo-level `Publish CLI Package` workflow. Create generated projects outside `engine/`; this directory is source and test code.

From the repo root, prefer:

```bash
npm run smoke:test-app
npm run cli:check
npm run new -- ./my-topogram-app
```

## Layout

- `src/` - engine source
- `templates/` - built-in starter templates for `topogram new`
- `tests/active/` - retained active engine tests
- `tests/fixtures/workspaces/` - engine-owned Topogram workspaces
- `tests/fixtures/expected/` - engine-owned golden outputs
- `tests/fixtures/invalid/` - invalid model cases

The generated Todo demo and Todo starter template live outside this repo in `topogram-demo-todo` and `topogram-template-todo`.

## Active Fixture

The current generated-app regression fixture is:

```text
tests/fixtures/workspaces/app-basic/
tests/fixtures/expected/app-basic/
```

It is a fixture, not a user example.

## Commands

Run the engine gate:

```bash
npm run check
```

Create a starter project from the default built-in `hello-web` template:

```bash
npm run new -- ../my-topogram-app
```

Choose another built-in starter with the template commands:

```bash
topogram template list
topogram template show web-api
topogram new ../web-api-demo --template web-api
```

Create a starter project from a shared template package:

```bash
topogram new ../todo-demo --template @attebury/topogram-template-todo
topogram new ../todo-demo --template todo
```

Catalog aliases resolve through the private catalog index at
`github:attebury/topograms/topograms.catalog.json`. The catalog is package
backed; executable starter content still lives in template packages. Use
`topogram catalog show <id>` to inspect an entry and get the correct `new` or
`copy` command for that kind. Use `topogram template show <id>` when the entry
is known to be a starter template and you want the direct `topogram new` flow.
Pure
topogram catalog entries can be copied for editing with
`topogram catalog copy <id> <target>`. Copied topogram projects record
`.topogram-source.json`; inspect local drift from that import baseline with
`topogram source status <target>`. This metadata is provenance only and does not
block local edits.

Do not create generated projects under `engine/`. The CLI refuses paths inside the engine directory.

Template pack authoring and trust policy are documented in `../docs/template-authoring.md`.
Catalog layout and private access are documented in `../docs/catalog.md`.
Projects created from executable templates include `.topogram-template-trust.json`;
regenerate it with `topogram trust template` after reviewing copied
`implementation/` code. Use `topogram template status` for the lifecycle
summary, then `topogram trust status` and `topogram trust diff` to inspect
changed files before refreshing trust.

Projects also include `topogram.template-policy.json`, the allow policy used by
template update and template check commands. It can restrict candidate template
sources, template ids, package scopes, executable-template behavior, and pinned
template versions:

```bash
topogram template policy check
topogram template policy explain
topogram template policy init
topogram template policy pin @scope/template@0.2.0
```

Use `topogram template policy explain` for a rule-by-rule view of the current
project template, package scope, catalog provenance, executable implementation
setting, and pinned version state.

Use `topogram template status --latest` and `topogram template update --latest`
only for package-backed templates when an explicit registry lookup is desired.
Plain status and update commands do not query the registry.

Use `topogram template update --status [--template <spec>]` to inspect current
template adoption state with baseline and conflict analysis. Use
`topogram template update --recommend [--template <spec>]` for a concise
human/agent next-step summary before applying, adopting, or deleting files. Use
`topogram template update --plan [--template <spec>]` to compare the current
project with a candidate template without writing files. Use
`topogram template update --check [--template <spec>]` as the no-write CI guard;
it exits nonzero when the project is not aligned with the recorded or supplied
template. Any update mode can write a machine-readable review report with
`--out <path>`. After review, `topogram template update --apply [--template
<spec>]` writes added/changed template-owned files, records a new
`.topogram-template-files.json` baseline, skips deletes, and refuses local
conflicts. Existing projects can run `topogram trust template` after review to
record the first template-owned file baseline. JSON output includes structured
diagnostics with codes, paths, suggested fixes, and workflow steps.

Single-file adoption actions are explicit and baseline-aware:
`--accept-current <file>` records the current file as the trusted baseline,
`--accept-candidate <file>` applies one candidate file after baseline checks,
and `--delete-current <file>` deletes one current-only file only when it still
matches the trusted baseline.

Template authors can run `topogram template check <template-spec-or-path>` to
validate manifest/layout, temporary starter creation, starter checks, trust
metadata, and no-write update planning. The JSON form reports structured
diagnostics with codes, paths, and suggested fixes for authoring feedback.

Run the same gate directly:

```bash
npm test
```

Run only the active fixture validity check:

```bash
npm run fixture:check
```

Inspect the active fixture topology as JSON:

```bash
npm run fixture:check:json
```

Generate the active fixture app bundle:

```bash
npm run fixture:generate
```

Run the app-generation workflow test:

```bash
node --test ./tests/active/generated-app-workflow.test.js
```

Validate or generate through the public CLI shape:

```bash
node ./src/cli.js check ./tests/fixtures/workspaces/app-basic
node ./src/cli.js generate ./tests/fixtures/workspaces/app-basic --out /tmp/topogram-app
```
