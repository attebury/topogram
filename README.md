# Topogram

Topogram turns a small model in `topogram/` into runnable app artifacts.

The current product surface is intentionally narrow:

1. edit a Topogram
2. validate it
3. generate the app
4. run compile, smoke, or runtime checks
5. iterate

Brownfield import, maintained-app work, parity proofs, and launch planning are deferred.

## First Use

Use Node 20+.

```bash
cd engine
npm test
```

Then compile the generated Todo demo:

```bash
cd ../examples/generated/todo/apps/local-stack
npm run compile
```

For the local service smoke path, run `bash ./scripts/verify-generated-example.sh todo compile-smoke` from the repo root after your local database is in the expected state.

The demo source lives in:

- `examples/generated/todo/topogram/` - editable Topogram
- `examples/generated/todo/artifacts/` - generated artifacts
- `examples/generated/todo/apps/` - generated runnable app output

## Docs

- [docs/README.md](./docs/README.md) - short docs index
- [docs/overview.md](./docs/overview.md) - first-use overview
- [docs/testing-strategy.md](./docs/testing-strategy.md) - demo and engine checks
- [docs/topogram-workspace-layout.md](./docs/topogram-workspace-layout.md) - folder ownership

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
