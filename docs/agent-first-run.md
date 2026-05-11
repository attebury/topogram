# Agent First Run

Agents should start from the project briefing and focused query packets, not by
reading the whole repository or the whole graph.

## First command

```bash
topogram agent brief --json
```

Generated projects expose the same command as:

```bash
npm run --silent agent:brief
```

`agent brief` is read-only. It validates the Topogram and project config but
does not generate apps, write files, load generator adapters, or execute
template implementation code.

## Read order

1. `AGENTS.md`
2. `README.md`
3. `topogram.project.json`
4. `topogram.sdlc-policy.json`, when present
5. `topogram.template-policy.json`, when present
6. `topogram.generator-policy.json`, when present
7. `.topogram-template-trust.json`, when executable implementation exists
8. `.topogram-import.json`, when the project came from brownfield import
9. Focused `topogram query ... --json` output

## First command sequence

```bash
topogram agent brief --json
topogram query list --json
topogram query show <name> --json
topogram sdlc explain <task-id> --json
topogram query slice ./topo --task <task-id> --json
topogram check --json
```

For implementation planning:

```bash
topogram query single-agent-plan . --mode modeling --capability <capability-id> --json
```

Before commit in an SDLC-adopted project:

```bash
topogram sdlc prep commit . --base origin/main --head HEAD --json
topogram sdlc gate . --base origin/main --head HEAD --require-adopted --json
```

## Edit boundaries

Safe default source edits:

- `topo/**`
- `topogram.project.json`
- policy files after review
- `implementation/**` only after reviewing trust state

Generated-owned outputs such as `app/**` are replaceable. Do not make durable
edits there unless the output ownership is maintained.

## UI and widgets

For UI work, inspect widget and surface packets:

```bash
topogram widget check ./topo --projection proj_web_surface
topogram widget behavior ./topo --projection proj_web_surface --json
topogram emit ui-widget-contract ./topo --json
```

`ui_contract` owns semantic UI. Concrete web/native surfaces inherit it and own
routes and surface hints.

## Brownfield import

When `.topogram-import.json` exists:

```bash
topogram import check . --json
topogram import plan . --json
topogram import adopt --list . --json
topogram import status . --json
topogram import history . --verify --json
```

Use `workspaceRoot` from import JSON as the canonical project-owned workspace
path.

## Command-owned state

Use commands for stateful workflow mutations:

- `topogram sdlc transition`
- `topogram sdlc plan step ... --write`
- `topogram sdlc archive`
- `topogram trust ...`
- `topogram import ...`
- `topogram generate`
- `topogram emit --write`
- `topogram release ...`

Declarative `.tg` source may be edited directly. Status history, provenance,
trust hashes, generated sentinels, archives, and release evidence should not be
hand-edited to make checks pass.
