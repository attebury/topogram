# Topogram

Topogram is being narrowed around one complete workflow: author a Topogram, generate a runnable app, and verify it.

## First Use

Use Node 20+.

```bash
cd demos/generated/todo-demo-app
npm install
npm run check
npm run generate
npm run verify
```

For local runtime verification, run:

```bash
npm run bootstrap
npm run dev
npm run app:smoke
npm run app:runtime-check
```

## Repo Layout

- `engine/` - Topogram engine, CLI, tests, and fixtures
- `engine/tests/fixtures/` - engine-owned regression workspaces and expected outputs
- `demos/generated/todo-demo-app/` - canonical generated app demo
- `docs/` - terse first-use docs

## Engine

The engine is private and local to this repo, but it exposes the `topogram` bin for local demo consumption:

```bash
topogram check ./topogram
topogram generate ./topogram --out ./app
```

No global install or published npm package is assumed yet.

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
