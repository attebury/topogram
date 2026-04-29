# Topogram

Topogram is being narrowed around one complete workflow: author a Topogram, generate a runnable app, and verify it.

## First Use

Use Node 20+.

To run the disposable demo:

```bash
cd topogram
npm install
npm run demo
```

This writes a generated starter to `.tmp/demo-app`.

To create your own starter:

```bash
cd topogram
npm install
npm run new -- ./my-topogram-app
cd ./my-topogram-app
npm install
npm run status
npm run build
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
- `demos/generated/todo-demo-app/` - canonical generated app demo
- `docs/` - terse first-use docs

## Engine

The engine is private and local to this repo, but it exposes the `topogram` bin for local demo consumption:

```bash
npm run new -- ./my-app
cd ./my-app
npm run status
npm run build
```

No global install or published npm package is assumed yet.

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
