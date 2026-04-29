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
engine/templates/
```

Templates are copied by `topogram new`. They are product starters, not regression fixtures.

## Generated Demo

```text
demos/generated/todo-demo-app/topogram/
```

This is the editable Todo model used for the generated app workflow.

```text
demos/generated/todo-demo-app/topogram.project.json
```

This project config declares the generated app output, API/web/database topology, ports, and generator bindings. New workspaces should prefer `topogram.project.json`; `topogram.implementation.json` is only a temporary compatibility adapter.

## Generated Output

```text
demos/generated/todo-demo-app/app/
```

This output is generated. Prefer regenerating it instead of hand-editing it.

Generated app bundles use component directories:

```text
apps/services/<api-id>/
apps/web/<web-id>/
apps/db/<db-id>/
apps/native/<native-id>/
```
