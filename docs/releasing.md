# Releasing Topogram CLI

The CLI package is `@topogram/cli`. Releases are manual and publish to npmjs.
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
CLI and creates `hello-web` through the public catalog.

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
topogram package update-cli --latest
```

If npm package inspection is unavailable, `topogram package update-cli` stops
before mutating consumer manifests. Fix npm registry access, rerun the update,
and let the command run the consumer verification scripts.

`topogram release status` checks npmjs package visibility. If npm registry
inspection is unavailable, release status reports a warning; strict mode treats
an unverifiable latest package version as release-blocking.

Use `topogram setup package-auth` when a local or CI environment needs package
read setup guidance for private packages.

After the package is published, the release tag exists, and known consumer pins
have been rolled, run the strict release gate:

```bash
npm run release:status:strict
```

You can also run the manual GitHub Actions workflow `Release Status`. It checks
out `topogram` plus the known consumer repos and runs the same strict gate. If
the default workflow token cannot read one of those repositories, add a
`TOPOGRAM_RELEASE_STATUS_TOKEN` repository secret with read access.
