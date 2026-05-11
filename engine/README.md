# Topogram CLI Package

This directory is the npm package for `@topogram/cli`. It exposes the
`topogram` executable.

The repo root owns product docs. Start with:

- [README](../README.md)
- [Docs map](../docs/README.md)
- [CLI Reference](../docs/reference/cli.md)
- [Engine Development](../docs/maintainers/engine-development.md)

## Package shape

```json
{
  "name": "@topogram/cli",
  "bin": {
    "topogram": "src/cli.js"
  }
}
```

## Local development

From the repo root:

```bash
npm install
npm test
bash ./scripts/verify-engine.sh
bash ./scripts/verify-cli-package.sh
```

From `engine/`:

```bash
npm test
npm run fixture:check
npm run fixture:generate
```

## What belongs here

- parser, validator, resolver;
- CLI command dispatch;
- import, reconcile, and adoption workflows;
- context/query/agent packets;
- generator dispatch and bundled fallback adapters;
- engine fixtures and active tests.

Generated projects should live outside `engine/`.
