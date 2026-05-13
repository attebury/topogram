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
topogram init . --with-sdlc
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

## Validation and output

```bash
topogram check
topogram generate
topogram generate ./topo --out ./app
topogram emit <target> ./topo --json
topogram emit <target> ./topo --write --out-dir ./artifacts
```

## Agent and query

```bash
topogram agent brief --json
topogram query list --json
topogram query show <name> --json
topogram query slice ./topo --task <task-id> --json
topogram query slice ./topo --journey journey_greenfield_start_from_template --json
```

## Widgets

```bash
topogram widget check ./topo --projection proj_web_surface
topogram widget behavior ./topo --projection proj_web_surface --json
topogram emit ui-widget-contract ./topo --widget widget_data_grid --json
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
topogram extractor check ./extractor-package
topogram extractor policy check
topogram extract check ./imported-topogram
topogram extract plan ./imported-topogram
topogram adopt --list ./imported-topogram
topogram adopt <selector> ./imported-topogram --dry-run
topogram adopt <selector> ./imported-topogram --write
topogram extract status ./imported-topogram
topogram extract history ./imported-topogram --verify
```

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
