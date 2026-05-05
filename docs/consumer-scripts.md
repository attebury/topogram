# Consumer Script Contract

Topogram consumer repositories can expose a small set of npm scripts so
`topogram package update-cli` can update `@topogram/cli` and run useful local
proof before a commit is pushed.

## Script meanings

- `cli:surface`: verifies the expected CLI command surface for the consumer.
- `doctor`: verifies local CLI/package/catalog setup diagnostics.
- `catalog:show`: verifies catalog entry display for a relevant consumer entry.
- `catalog:template-show`: verifies catalog template display when applicable.
- `check`: basic local validation. This should be fast and narrower than package
  or generated-output smoke.
- `pack:check`: package or tarball consumer smoke. Use this when the repo ships a
  reusable package, generator, template, starter, or pure Topogram package.
- `verify`: strongest repo-level consumer proof. Use this only when it is
  meaningfully broader than `pack:check`, such as a generated demo compile or
  runtime workflow.

## Selection Rules

`topogram package update-cli` runs informational scripts independently when they
exist:

- `cli:surface`
- `doctor`
- `catalog:show`
- `catalog:template-show`

Verification scripts are mutually exclusive. The strongest available proof wins:

1. `verify`
2. `pack:check`
3. `check`

When a stronger verification script is selected, weaker scripts are skipped with
a coverage reason such as `check (covered by pack:check)`.

Do not add `verify` as a plain alias for `pack:check`. That makes update output
less meaningful. Add `verify` only when it proves something broader than package
packing.
