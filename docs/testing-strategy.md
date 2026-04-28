# Testing Strategy

Keep the test surface small while Topogram is being rebuilt around generated demos.

## Engine

Run the engine test suite from `engine/`:

```bash
npm test
```

Engine regression fixtures belong under:

```text
engine/tests/fixtures/
```

## Generated Todo Demo

Run the compile check:

```bash
cd ../examples/generated/todo/apps/local-stack
npm run compile
```

Run the smoke path when runtime services and local database state are available:

```bash
bash ./scripts/verify-generated-example.sh todo compile-smoke
```

Run the fuller path when runtime-check services are available:

```bash
bash ./scripts/verify-generated-example.sh todo full
```

## What To Keep Out

Do not make brownfield import, maintained-app proof, parity matrices, or launch planning part of the default first-use path. Those can come back later after the generated-app workflow is clean.
