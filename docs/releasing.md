# Releasing Topogram CLI

The CLI package is `@attebury/topogram`. Releases are manual and publish to GitHub Packages.

## Prepare

From the repo root:

```bash
npm run release:prepare -- 0.2.4
npm run release:check
npm run check
npm run cli:check
```

`release:prepare` updates `engine/package.json` and `engine/package-lock.json`.
Commit those files with the release-support changes that should ship.

## Publish

Use the GitHub Actions workflow `Publish CLI Package`.

- `version` is optional. If supplied, it must match `engine/package.json`.
- `dist_tag` defaults to `latest`.
- `create_tag` defaults to `true` and creates `topogram-v<version>` after publish.

The workflow verifies the engine and packed CLI before publishing. It does not mutate the package version in CI.

## After Publish

Confirm the `Installed CLI First Use` workflow passes. It installs the published
CLI and creates `hello-web` through the private catalog, so the `topogram` repo
must have Read access under the starter package's Manage Actions access
settings.

Update package consumers, starting with `topogram-demo-todo`, to the published version and rerun their verification.
