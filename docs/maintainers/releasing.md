# Releasing

The CLI package is `@topogram/cli` and publishes to npmjs.

## Prepare

```bash
npm run release:prepare -- <version>
npm run release:check
npm run check
npm run cli:check
```

Commit the version changes before publishing.

## Publish

Use the manual GitHub Actions workflow `Publish CLI Package`.

The repo must define `NPM_TOKEN` with publish access for `@topogram/cli`.

## After publish

```bash
npm run smoke:fresh-npmjs
npm run release:status
npm run release:roll-consumers -- --latest --watch
npm run release:status:strict
npm run release:status:strict -- --write-report ./docs/release-matrix.md
```

`docs/release-matrix.md` is generated release evidence, not first-run product
documentation.
