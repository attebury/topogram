# Testing Strategy

Keep the test surface small while Topogram is rebuilt around engine-owned fixtures and package-consumer demos.

## Engine

Run the engine test suite from `engine/`:

```bash
npm test
```

Engine regression fixtures belong under:

```text
engine/tests/fixtures/
```

Engine tests must not import or reference generated demo workspaces. Generated apps are consumer verification targets, not engine dependencies.

## CLI Package

Run the private CLI package smoke test from the repo root:

```bash
npm run cli:check
```

This packs `@attebury/topogram`, installs it into a disposable consumer project, creates a starter with the installed `topogram` binary, then checks and generates the starter.
It also packs and consumes a local template tarball so template-package behavior stays covered without depending on the Todo demo.

## Generated Todo Demo Consumer

The generated Todo demo lives in the private `topogram-demo-todo` repo. It consumes `@attebury/topogram` from GitHub Packages and owns the package-consumer workflow:

```bash
cd ../topogram-demo-todo
npm install
npm run check
npm run generate
npm run verify
```

Its normal GitHub Actions demo gate owns the generated Todo app compile and
runtime proof. Engine CI should keep validating engine fixtures and CLI package
behavior, not Todo-specific app semantics.

Run the smoke path when runtime services and local database state are available:

```bash
npm run bootstrap
npm run dev
```

Then, from another terminal while the app is still running:

```bash
npm run app:smoke
npm run app:runtime-check
```

Use the self-contained local runtime command when you want the generated stack
started and stopped for the probe:

```bash
npm run app:runtime
```
