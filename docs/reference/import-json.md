# Import JSON

Use `--json` for agent and script automation.

Important fields:

- `workspaceRoot`: canonical path to the project-owned workspace folder,
  normally `topo/`.
- `projectRoot`: target project root.
- `candidateCounts`: number of imported candidate artifacts by surface,
  including fields such as `apiCapabilities`, `apiRoutes`, `uiWidgets`,
  `cliCommands`, and `cliSurfaces`.
- `writtenFiles`: files written by import or adoption.
- `nextCommands`: recommended follow-up commands.
- `receipt`: adoption receipt when an adoption command writes.

Current command payloads:

- `topogram import <source> --out <target> --json`
- `topogram import check --json`
- `topogram import diff --json`
- `topogram import refresh --json`
- `topogram import plan --json`
- `topogram import adopt --list --json`
- `topogram import adopt <selector> --json`
- `topogram import status --json`
- `topogram import history --json`

Review payloads:

- `topogram import plan --json` returns `bundles`, `summary`,
  `workspaceRoot`, and a `nextCommand`.
- `topogram import adopt --list --json` returns exact `selectors` such as
  `bundle:task` or `bundle:cli` and broad selectors such as `widgets`, `ui`,
  `cli`, `capabilities`, and `from-plan`.
- `topogram import adopt <selector> --dry-run --json` returns
  `promotedCanonicalItems`, `promotedCanonicalItemCount`, `writtenFiles`, and
  `write: false`.
- `topogram import history --verify --json` returns `verification` in
  audit-only mode. Adopted Topogram files are project-owned, so local edits do
  not invalidate import evidence.

Focused agent review:

```bash
topogram query import-plan ./topo --json
```

This query is read-only and gives agents staged items, maintained-boundary
risk, write scope, review requirements, and verification targets.

Agents should use `workspaceRoot`, not older compatibility fields, when deciding
where project-owned Topogram files live.
