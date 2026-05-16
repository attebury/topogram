# CLI Reference

Run `topogram help <command>` for command-specific help. This page gives the
current command map.

## Setup and health

```bash
topogram version
topogram doctor
topogram setup package-auth
topogram setup catalog-auth
```

## Project creation

```bash
topogram init
topogram init . --adopt-sdlc
topogram init ./existing-app --json
topogram template list
topogram copy --list
topogram copy hello-web ./my-app
topogram catalog list
topogram catalog show <id>
topogram copy <id> <target>
```

Use `topogram init` first for existing or maintained repos. Use `topogram copy`
when you want to copy a starter template and generate an app/runtime bundle.

Remote catalog and GitHub reads are size-limited before parsing. Override the
default only when you have reviewed the source. These can be set in the
environment or in `topogram.config.json` under `limits`.

- `TOPOGRAM_REMOTE_FETCH_MAX_BYTES`
- `TOPOGRAM_CATALOG_FETCH_MAX_BYTES`
- `TOPOGRAM_GITHUB_FETCH_MAX_BYTES`

## Validation and output

```bash
topogram check
topogram generate
topogram generate ./topo --out ./app
topogram emit <target> ./topo --json
topogram emit <target> ./topo --write --out-dir ./artifacts
topogram emit glossary ./topo --write --out-dir docs/concepts
topogram emit glossary ./topo --check docs/concepts/glossary.md
```

## Agent and query

```bash
topogram agent brief --json
topogram query list --json
topogram query show <name> --json
topogram query slice ./topo --task <task-id> --json
topogram query slice ./topo --journey journey_greenfield_start_from_template --json
topogram query sdlc-backlog ./topo --json
topogram query sdlc-available ./topo --json
topogram query sdlc-claimed ./topo --actor actor_coding_agent --json
topogram query sdlc-blockers ./topo --task <task-id> --json
topogram query sdlc-proof-gaps ./topo --task <task-id> --json
topogram query sdlc-metrics ./topo --json
topogram query sdlc-stale-work ./topo --json
```

## SDLC

```bash
topogram sdlc policy explain --json
topogram sdlc start <task-id> . --actor actor_coding_agent --json
topogram sdlc start <task-id> . --actor actor_coding_agent --write --json
topogram sdlc complete <task-id> . --verification <verification-id> --actor actor_coding_agent --write
topogram sdlc prep commit . --base origin/main --head HEAD --json
topogram sdlc gate . --base origin/main --head HEAD --require-adopted --json
```

`sdlc start` is read-only by default. It returns the implementation packet for a
task; `--write` claims and starts the task through command-owned history.

## Widgets

```bash
topogram widget check ./topo --projection proj_web_surface
topogram widget behavior ./topo --projection proj_web_surface --json
topogram emit ui-widget-contract ./topo --widget widget_data_grid --json
topogram emit glossary ./topo --json
```

## Brownfield extract/adopt

```bash
topogram extract ./existing-app --out ./imported-topogram
topogram extract ./existing-cli --out ./imported-topogram --from cli --extractor @topogram/extractor-node-cli
topogram extract ./react-router-app --out ./imported-topogram --from ui --extractor @topogram/extractor-react-router
topogram extract ./prisma-app --out ./imported-topogram --from db --extractor @topogram/extractor-prisma-db
topogram extract ./express-api --out ./imported-topogram --from api --extractor @topogram/extractor-express-api
topogram extract ./drizzle-app --out ./imported-topogram --from db --extractor @topogram/extractor-drizzle-db
topogram extractor list
topogram extractor show @topogram/extractor-prisma-db
topogram extractor show topogram/ui-extractors
topogram extractor check @topogram/extractor-prisma-db
topogram extractor check ./extractor-package
topogram extractor scaffold ./extractor-package --track cli --package @scope/extractor-package
topogram extractor policy init
topogram extractor policy pin @topogram/extractor-prisma-db@1
topogram extractor policy check
topogram extract check ./imported-topogram
topogram extract plan ./imported-topogram
topogram adopt --list ./imported-topogram
topogram query extract-plan ./imported-topogram/topo --json
topogram query single-agent-plan ./imported-topogram/topo --mode extract-adopt --json
topogram query multi-agent-plan ./imported-topogram/topo --mode extract-adopt --json
topogram query work-packet ./imported-topogram/topo --mode extract-adopt --lane adoption_operator --json
topogram adopt <selector> ./imported-topogram --dry-run
topogram adopt <selector> ./imported-topogram --write
topogram extract status ./imported-topogram
topogram extract history ./imported-topogram --verify
```

Extractor command safety: `extractor list`, `extractor show`, and
`extractor policy` do not load package adapter code. `extractor check` and
`extract --extractor` do load package adapter code. Extractor packages write
review-only candidates; `adopt --dry-run` should precede any canonical `--write`.
Extractor package output distinguishes manifest version, npm package version,
compatible CLI range, and policy pin state so humans and agents can choose the
exact install or pin command before execution.

## Policies and trust

```bash
topogram trust status
topogram trust diff
topogram trust template
topogram template policy check
topogram generator list
topogram generator policy check
topogram extractor list
topogram extractor policy check
topogram sdlc policy explain
```

## Maintainers

```bash
topogram release status
topogram release status --strict
topogram release roll-consumers --latest
topogram package update-cli --latest
```

`topogram release roll-consumers --latest --watch` is the maintainer command for
rolling first-party consumers after a CLI publish. Human output includes a
recovery summary, and progress is printed to stderr so JSON output stays
machine-readable. Use `--no-watch` to push consumer commits without waiting for
CI, then run `topogram release status --strict`.

`topogram release status --strict` requires the current checkout to match the
current package version's remote release tag. If new commits have landed after
the latest `topogram-v*` tag, strict mode fails until a new patch release is
cut or the checkout is moved back to the released commit.

`topogram release status --strict` also checks public proof repositories in a
separate proof-consumer section. Those repos are not rolled by
`roll-consumers`; they are tutorial/product proof repos, so release status
checks their configured proof baseline, `proof:audit` and `verify` scripts, and
Proof Verification workflow state separately from package rollout consumers.
Proof repos do not need to move on every patch release; refresh them when a
workflow meaning changes, a breaking change lands, or a proof would teach stale
behavior.
