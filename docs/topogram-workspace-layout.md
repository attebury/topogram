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
`topogram-template.json`, `topogram/`, `topogram.project.json`, and optional
trusted `implementation/` code. See `docs/template-authoring.md`.

Use `topogram template list` for a quick stack/surface summary and
`topogram catalog show <id>` to inspect catalog aliases and their recommended
commands.

## Generated Workspace

```text
my-topogram-app/topogram/
```

This is the editable Topogram model used for a generated app workflow.

```text
my-topogram-app/topogram.project.json
```

This project config declares the generated app output, API/web/database topology, ports, and generator bindings. New workspaces should prefer `topogram.project.json`; `topogram.implementation.json` is only a temporary compatibility adapter.

From a generated project root, `topogram check` reads `./topogram` and reports the resolved topology. `topogram generate` regenerates the configured generated app output at `./app`.

## Generated Output

```text
my-topogram-app/app/
```

This output is generated. Prefer regenerating it instead of hand-editing it.

Generated app bundles use component directories:

```text
apps/services/<api-id>/
apps/web/<web-id>/
apps/db/<db-id>/
apps/native/<native-id>/
```

The private `topogram-demo-todo` repo mirrors this layout and owns generated demo verification as a package consumer.
