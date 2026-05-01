# Releasing Topogram CLI

The CLI package is `@attebury/topogram`. Releases are manual and publish to GitHub Packages.
Run `topogram help release` for the CLI release-status command surface.

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

Check the release and known consumer pins:

```bash
npm run release:status
```

The status output includes a `consumerPins` summary for the known package
consumers: `topogram-starters`, `topogram-template-todo`, and
`topogram-demo-todo`. Patch CLI releases can roll through those
`topogram-cli.version` pins without republishing starter or template packages.
Only publish new starter/template package versions when their payload,
implementation, package metadata, trust policy, catalog-facing metadata, or
conformance requirements changed.

Update package consumers, starting with `topogram-demo-todo`, to the published
version and rerun their verification. Consumer repos that include
`topogram-cli.version` can use:

```bash
NODE_AUTH_TOKEN=<github-token-with-package-read> topogram package update-cli --latest
```

If local npm auth is unavailable, `topogram package update-cli` can confirm the
requested CLI version through the GitHub Packages API via `gh api` and update
the consumer manifests directly. That fallback is only for rollout bookkeeping:
`npm install` and `npm ci` still need GitHub Packages auth for private package
downloads.

Use `topogram setup package-auth` when a local or CI environment needs package
read setup guidance.

After the package is published, the release tag exists, and known consumer pins
have been rolled, run the strict release gate:

```bash
npm run release:status:strict
```

You can also run the manual GitHub Actions workflow `Release Status`. It checks
out `topogram` plus the known consumer repos and runs the same strict gate. If a
consumer repo is private and the default workflow token cannot read it, add a
`TOPOGRAM_RELEASE_STATUS_TOKEN` repository secret with read access to those
repos.
