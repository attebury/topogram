# Generate vs Emit

Topogram uses two verbs for two different jobs.

## Generate

`generate` writes app or runtime output.

```bash
topogram generate
topogram generate ./topo --out ./app
topogram generate app ./topo --out ./app
```

Default input is `./topo`. Default output is `./app`.

Use this when you want generator packages to write web, API, database, or native
runtime files.

## Emit

`emit` prints or writes named artifacts.

```bash
topogram emit ui-widget-contract ./topo --json
topogram emit widget-conformance-report ./topo --projection proj_web_surface --json
topogram emit db-schema-snapshot ./topo --projection proj_db --json
topogram emit sql-migration ./topo --projection proj_db --from-snapshot ./state/current.json
```

`emit` prints to stdout by default. It writes files only with `--write`:

```bash
topogram emit ui-widget-contract ./topo --write --out-dir ./contracts
```

Use this for contracts, reports, snapshots, migration plans, and agent packets.
