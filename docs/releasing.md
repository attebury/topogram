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
- The repository must define `NPM_TOKEN` as an npmjs granular token with publish
  access for `@topogram/cli` and bypass-2FA enabled for CI publishing.

The workflow verifies the engine and packed CLI before publishing. It does not mutate the package version in CI.

## After Publish

Confirm the `Installed CLI First Use` workflow passes. It installs the published
CLI and creates `hello-web` through the public catalog.

For deeper public-path release evidence, run the manual fresh npmjs smoke. It
installs the published CLI in a disposable external consumer project, resolves a
starter through the public catalog, checks/generates the starter, and compiles
the generated app:

```bash
npm run smoke:fresh-npmjs
```

You can also run the manual GitHub Actions workflow `Fresh npmjs Smoke`. This
live-service smoke depends on npmjs and the public catalog, so it is intentionally
not part of fast push verification.

Check the release and first-party consumer pins:

```bash
npm run release:status
```

The status output includes a `consumerPins` summary for first-party repos with
`topogram-cli.version`: generator packages, `topogram-starters`,
`topogram-template-todo`, `topogram-demo-todo`, and `topogram-hello`. Patch CLI
releases can roll through those pins without republishing generator, starter,
template, or pure Topogram packages. Only publish new package versions when
their payload, implementation, package metadata, trust policy,
catalog-facing metadata, or conformance requirements changed.

Update package consumers, starting with `topogram-demo-todo`, to the published
version and rerun their verification. Consumer repos that include
`topogram-cli.version` can be rolled as a batch from the Topogram source repo:

```bash
npm run release:roll-consumers -- 0.3.46
```

Use `--latest` after npmjs reports the new package version:

```bash
npm run release:roll-consumers -- --latest
```

The rollout command updates every known first-party consumer repo, runs each
consumer's available checks, commits the pin change, pushes `main`, and prints
the latest expected workflow URL for each repo. It refuses dirty consumer
worktrees so unrelated local edits do not get swept into release commits.

For one-off consumer work, run the lower-level command inside that repo:

```bash
topogram package update-cli --latest
```

If npm package inspection is unavailable, `topogram package update-cli` stops
before mutating consumer manifests. Fix npm registry access, rerun the update,
and let the command run the consumer verification scripts.
The consumer script contract is documented in
[Consumer Script Contract](./consumer-scripts.md).

`topogram release status` checks npmjs package visibility. If npm registry
inspection is unavailable, release status reports a warning; strict mode treats
an unverifiable latest package version as release-blocking.

Use `topogram setup package-auth` when a local or CI environment needs package
read setup guidance for private packages.

After the package is published, the release tag exists, all first-party consumer
pins have been rolled, and their verification workflows have passed on the
rolled commits, run the strict release gate:

```bash
npm run release:status:strict
```

You can also run the manual GitHub Actions workflow `Release Status`. It checks
out `topogram` plus the first-party consumer repos and runs the same strict
gate. Strict mode verifies npmjs latest, the local and remote release tag,
consumer pins, and the latest expected GitHub Actions workflow for each
consumer repo. If the default workflow token cannot read one of those
repositories or its Actions runs, add a `TOPOGRAM_RELEASE_STATUS_TOKEN`
repository secret with read access.
