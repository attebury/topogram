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
topogram template list
topogram new --list-templates
topogram new ./my-app --template hello-web
topogram catalog list
topogram catalog show <id>
topogram catalog copy <id> <target>
```

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
```

## Widgets

```bash
topogram widget check ./topo --projection proj_web_surface
topogram widget behavior ./topo --projection proj_web_surface --json
topogram emit ui-widget-contract ./topo --widget widget_data_grid --json
```

## Brownfield import

```bash
topogram import ./existing-app --out ./imported-topogram
topogram import check ./imported-topogram
topogram import plan ./imported-topogram
topogram import adopt --list ./imported-topogram
topogram import adopt <selector> ./imported-topogram --dry-run
topogram import adopt <selector> ./imported-topogram --write
topogram import status ./imported-topogram
topogram import history ./imported-topogram --verify
```

## Policies and trust

```bash
topogram trust status
topogram trust diff
topogram trust template
topogram template policy check
topogram generator list
topogram generator policy check
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
machine-readable. Omit `--watch` to push consumer commits without waiting for CI,
then run `topogram release status --strict`.
