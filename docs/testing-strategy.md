# Testing Strategy

Keep the test surface small while Topogram is rebuilt around engine-owned fixtures and generated demos.

## Engine

Run the engine test suite from `engine/`:

```bash
npm test
```

Engine regression fixtures belong under:

```text
engine/tests/fixtures/
```

Engine tests must not import or reference `demos/generated/**`. The generated Todo app is a demo-level verification target, not an engine dependency.

## Generated Todo Demo

Run the compile check:

```bash
cd ../demos/generated/todo-demo-app
npm install
npm run topogram:check
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
