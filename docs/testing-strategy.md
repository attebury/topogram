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
cd ../demos/generated/todo-demo-app
npm install
npm run topogram:validate
npm run topogram:generate
npm run app:compile
```

Run the smoke path when runtime services and local database state are available:

```bash
npm run app:bootstrap
npm run app:dev
npm run app:smoke
npm run app:runtime-check
```

## What To Keep Out

Do not make brownfield import, maintained-app proof, parity matrices, or launch planning part of the default first-use path. Those can come back later after the generated-app workflow is clean.
