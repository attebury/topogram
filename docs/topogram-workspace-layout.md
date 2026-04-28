# Topogram Workspace Layout

Use the folder names to tell what owns a file.

## Engine

```text
engine/
```

The engine parses, validates, resolves, generates, and tests Topograms.

## Demo Topogram

```text
examples/generated/todo/topogram/
```

This is the editable Todo model used for the generated demo workflow.

## Generated Output

```text
examples/generated/todo/artifacts/
examples/generated/todo/apps/
```

These files are generated. Prefer regenerating them instead of hand-editing them.

## Engine Fixtures

```text
engine/tests/fixtures/
```

Use fixtures for engine regression confidence. Use the Todo demo for the user-facing workflow proof.
