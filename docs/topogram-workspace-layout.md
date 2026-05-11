# Topogram Workspace Layout

Use folder names to tell what owns a file.

## Engine

```text
engine/
```

The engine parses, validates, resolves, generates, and tests Topograms.

## Engine Fixtures

```text
engine/tests/fixtures/
```

Fixtures are for engine regression confidence. They are not user-facing demos.

## Starter Templates

```text
topogram-starters/packages/
```

Templates are copied by `topogram new`. Product starter templates live outside
the engine in package repos such as `topogram-starters` and
`topogram-template-todo`. The engine keeps only local template fixtures under
`engine/tests/fixtures/templates/` for regression tests. Template packs use
`topogram-template.json`, `topo/`, `topogram.project.json`, and optional
trusted `implementation/` code. See `docs/template-authoring.md`.

Use `topogram template list` for a quick stack/surface summary and
`topogram catalog show <id>` to inspect catalog aliases and their recommended
commands.

## Generated Workspace

```text
my-topogram-app/topo/
```

This is the editable Topogram model used for a generated app workflow.

```text
my-topogram-app/topogram.project.json
```

This project config declares the generated app output, API/web/database topology, ports, and generator bindings. New workspaces should prefer `topogram.project.json`; `topogram.implementation.json` is only a temporary compatibility adapter.

From a generated project root, `topogram check` reads `./topo` and reports the resolved topology. `topogram generate` regenerates the configured generated app output at `./app`.

## Generated Output

```text
my-topogram-app/app/
```

This output is generated. Prefer regenerating it instead of hand-editing it.

Generated app bundles use runtime directories:

```text
apps/services/<api-id>/
apps/web/<web-id>/
apps/db/<db-id>/
apps/native/<native-id>/
```

The `topogram-demo-todo` repo mirrors this layout and owns generated demo verification as a package consumer.

## Domain organization

Larger workspaces benefit from organizing `.tg` files by business domain
(order fulfillment, billing, support, reporting, etc.). The engine treats
folders as a human convention only — `parsePath()` flattens everything
into one graph — but the recommended layout helps new contributors find
the slice they care about and feeds tools like `git blame` and
`CODEOWNERS`:

```text
topo/
  domains/
    dom-order-fulfillment.tg
    dom-billing.tg
    dom-support.tg
  order-fulfillment/
    capabilities/
    entities/
    rules/
    verifications/
    projections/
  billing/
    ...
  shared/                      # cross-cutting (party, address, audit)
    entities/
    terms/
    decisions/
```

`domain` statements are first-class graph members; the optional `domain`
field on workhorse kinds (`capability`, `entity`, `rule`, etc.) makes
the slicing explicit. See [Domains](./domains.md) for the full guide.

## Generated domain pages

```text
topo/docs-generated/domains/
  dom-order-fulfillment.md
  dom-billing.md
  ...
```

The `domain-page` generator emits a markdown summary per domain
(members, in/out-of-scope, per-platform coverage table).

## SDLC layout

Phase 2 introduces SDLC kinds (`pitch`, `requirement`,
`acceptance_criterion`, `task`, `plan`, `bug`, `document`). Projects that
adopt SDLC should group SDLC records under `topo/sdlc/` by default. This is a
human and agent convention, not a parser rule; custom layouts remain valid.

```text
topo/
  sdlc/
    pitches/{slug}.tg
    requirements/{slug}.tg
    acceptance_criteria/{slug}.tg
    tasks/{slug}.tg
    plans/{slug}.tg
    bugs/{slug}.tg
    decisions/{slug}.tg
    _archive/
      tasks-2026.jsonl           # year-bucketed JSONL archives
      plans-2026.jsonl
      bugs-2026.jsonl
      pitches-2026.jsonl
    .topogram-sdlc-history.json  # append-only transition history sidecar
  docs/                          # markdown documents (with frontmatter)
    user-guide/
    api/
    architecture/
    operations/
    getting-started/
    reference/
    development/
```

The `sdlc/_archive/` folder is special: the resolver bridge auto-loads JSONL
files at workspace-parse time so frozen entries participate in
cross-references and the traceability matrix without showing up in the
default board. Use `topogram sdlc unarchive <id>` to restore one.

The history sidecar is the source of truth for status transitions —
`topogram sdlc check` cross-references it against current `.tg` status
to detect drift (artifacts edited outside the CLI). See
[SDLC](./sdlc.md) and [Lifecycles](./lifecycles.md) for the full guide.
