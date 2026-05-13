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

`smoke:fresh-npmjs` installs the published CLI from npmjs, checks the public
catalog, installs first-party extractor packages, runs package-backed
extract/adopt review on a small brownfield source, then copies and compiles a
catalog starter. It is the public-package smoke, not a local fixture test.

`release:roll-consumers` prints per-consumer progress to stderr while it updates,
checks, commits, pushes, and optionally watches CI. If a rollout is interrupted,
rerun the same command; the report includes recovery state for consumers that are
already pinned, already pushed, or still need attention. Omit `--watch` when you
want to push consumer commits and verify later with `npm run release:status:strict`;
use `--no-watch` when you want that choice to be explicit in command logs.

`docs/release-matrix.md` is generated release evidence, not first-run product
documentation.
