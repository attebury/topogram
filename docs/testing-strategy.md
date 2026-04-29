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

Engine tests must not import or reference `demos/generated/**`. The generated Todo app is a temporary demo-level verification target, not an engine dependency.

## CLI Package

Run the private CLI package smoke test from the repo root:

```bash
npm run cli:check
```

This packs `@attebury/topogram`, installs it into a disposable consumer project, creates a starter with the installed `topogram` binary, then checks and generates the starter.

## Generated Todo Demo

Run the compile check:

```bash
cd ../demos/generated/todo-demo-app
npm install
npm run check
npm run generate
npm run verify
```

Long term, this check should move to the private todo-demo repo and consume `@attebury/topogram` from GitHub Packages.

Run the smoke path when runtime services and local database state are available:

```bash
npm run bootstrap
npm run dev
npm run app:smoke
npm run app:runtime-check
```
