# Extract/Adopt JSON

Use `--json` for agent and script automation.

Important fields:

- `workspaceRoot`: canonical path to the project-owned workspace folder,
  normally `topo/`.
- `projectRoot`: target project root.
- `candidateCounts`: number of extracted candidate artifacts by surface,
  including fields such as `apiCapabilities`, `apiRoutes`,
  `dbMaintainedSeams`, `uiFlows`, `uiWidgets`, `cliCommands`, and
  `cliSurfaces`.
- `writtenFiles`: files written by extraction or adoption.
- `nextCommands`: recommended follow-up commands.
- `receipt`: adoption receipt when an adoption command writes.
- `extraction_context`: focused query context for `.topogram-extract.json`,
  package-backed extractor provenance, candidate counts, safety notes, and next
  review commands.

Current command payloads:

- `topogram extract <source> --out <target> --json`
- `topogram extract check --json`
- `topogram extract diff --json`
- `topogram extract refresh --json`
- `topogram extract plan --json`
- `topogram adopt --list --json`
- `topogram adopt <selector> --json`
- `topogram extract status --json`
- `topogram extract history --json`

Review payloads:

- `topogram extract plan --json` returns `bundles`, `summary`,
  `workspaceRoot`, and a `nextCommand`.
- Maintained DB migration seam proposals appear as `dbMaintainedSeams` in
  extract counts, `candidates.db.maintained_seams` in raw candidate files, and a
  review-only `database` bundle in plan output.
- Non-resource UI flow proposals appear as `uiFlows` in extract counts,
  `candidates.ui.flows` in raw candidate files, and review-only UI items in
  plan/adoption output. They are proposals for shared `ui_contract` additions,
  not automatic canonical writes.
- Evidence records can include source type context. Runtime source and
  parser/config files are primary; docs, tests, fixtures, and generated output
  should not create high-confidence primary candidates by themselves.
- `topogram adopt --list --json` returns exact `selectors` such as
  `bundle:task` or `bundle:cli` and broad selectors such as `widgets`, `ui`,
  `cli`, `capabilities`, and `from-plan`.
- `topogram adopt <selector> --dry-run --json` returns
  `promotedCanonicalItems`, `promotedCanonicalItemCount`, `writtenFiles`, and
  `write: false`.
- `topogram extract history --verify --json` returns `verification` in
  audit-only mode. Adopted Topogram files are project-owned, so local edits do
  not invalidate extraction evidence.

Focused agent review:

```bash
topogram query extract-plan ./topo --json
topogram query single-agent-plan ./topo --mode extract-adopt --json
topogram query multi-agent-plan ./topo --mode extract-adopt --json
topogram query work-packet ./topo --mode extract-adopt --lane adoption_operator --json
```

These queries are read-only and give agents staged items, extractor provenance,
maintained-boundary risk, write scope, review requirements, lane ownership, and
verification targets.

Agents should use `workspaceRoot`, not older compatibility fields, when deciding
where project-owned Topogram files live.
