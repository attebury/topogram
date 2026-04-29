# Topogram

Topogram is being narrowed around one complete workflow: author a Topogram, generate a runnable app, and verify it.

## First Use

Use Node 20+.

To run the disposable generated-app smoke test:

```bash
cd topogram
npm install
npm run smoke:test-app
npm run cli:check
```

This writes a generated starter to `.tmp/smoke-test-app`.

To create your own starter:

```bash
cd topogram
npm install
npm run new -- ./my-topogram-app
cd ./my-topogram-app
npm install
npm run explain
npm run check
npm run generate
npm run verify
```

Create generated projects outside `engine/`. The engine is source and test code; generated app workspaces should live beside it, for example `./my-topogram-app`.

For local runtime verification, run:

```bash
npm run bootstrap
npm run dev
npm run app:smoke
npm run app:runtime-check
```

## Repo Layout

- `engine/` - Topogram engine, CLI, tests, and fixtures
- `engine/templates/` - starter Topogram workspaces for `topogram new`
- `engine/tests/fixtures/` - engine-owned regression workspaces and expected outputs
- `demos/generated/todo-demo-app/` - temporary in-repo generated app demo mirror until the private demo repo takes over consumer verification
- `docs/` - terse first-use docs

## Engine

The engine package publishes privately as `@attebury/topogram` and exposes the `topogram` bin:

```bash
npm run new -- ./my-app
cd ./my-app
npm run check
npm run generate
```

Publishing is manual through the `Publish CLI Package` GitHub Actions workflow.

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
