# Topogram

Topogram is being reset around one complete workflow: author a Topogram, generate a runnable app, and verify it.

The active path is intentionally smaller than earlier repo material. Import, maintained-app, brownfield, and `topogram-demo` proof work remains in history and deferred docs, but it is not part of the current quickstart.

## Start Here

The canonical demo is [demos/generated/todo-demo-app](./demos/generated/todo-demo-app).

```bash
cd demos/generated/todo-demo-app
npm install
npm run topogram:validate
npm run topogram:generate
npm run app:bootstrap
npm run app:dev
```

In another terminal, run the generated checks:

```bash
cd demos/generated/todo-demo-app
npm run app:compile
npm run app:smoke
npm run app:runtime-check
```

The normal loop is:

1. Edit `topogram/`.
2. Run `npm run topogram:validate`.
3. Run `npm run topogram:generate`.
4. Run the app and the relevant generated checks.

## Repo Layout

- [engine](./engine): Topogram parser, resolver, validator, generators, CLI, and engine tests
- [engine/tests/fixtures](./engine/tests/fixtures): engine-owned regression workspaces and expected outputs
- [demos/generated/todo-demo-app](./demos/generated/todo-demo-app): user-facing generated app demo
- [docs](./docs): quickstart, layout, testing, and deferred proof notes
- [examples](./examples): legacy transition material retained while the repo is reshaped

Fixtures are for engine development. Demos are for users and product workflow proof.

## Engine CLI Shape

The engine is now package-shaped for local consumption by demos:

```bash
topogram validate ./topogram
topogram generate app ./topogram --out ./app
```

The package is still private and local to this repo. The demo consumes it through a file dependency instead of assuming a published npm package or global install.

## Current Scope

Active:

- generated app workflow from authored Topogram
- local app bundle generation
- generated compile, smoke, and runtime-check verification
- engine fixtures separated from runnable demos

Deferred:

- import/adopt workflows
- maintained-app evolution proofs
- brownfield proof operations
- `topogram-demo` as an active product dependency
- global install and npm publishing

## Development

For engine work:

```bash
cd engine
npm test
```

For the product workflow demo:

```bash
cd demos/generated/todo-demo-app
npm install
npm run topogram:validate
npm run topogram:generate
npm run app:compile
```

The old `examples/**` tree is retained as transition material. New generated-app work should prefer `demos/generated/<domain>-demo-app` for user-facing demos and `engine/tests/fixtures/**` for engine regression inputs.
