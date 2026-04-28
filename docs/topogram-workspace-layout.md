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

## Generated Demo

```text
demos/generated/todo-demo-app/topogram/
```

This is the editable Todo model used for the generated app workflow.

## Generated Output

```text
demos/generated/todo-demo-app/app/
```

This output is generated. Prefer regenerating it instead of hand-editing it.

## Deferred Material

Legacy `examples/` code has moved to `topogram-project/project/topogram/deferred-code/examples/`.
