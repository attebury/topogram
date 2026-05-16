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
8. `.topogram-extract.json`, when the project came from brownfield extract/adopt
9. Focused `topogram query ... --json` output

## First command sequence

```bash
topogram agent brief --json
topogram query list --json
topogram query show <name> --json
topogram check --json
```

If the project has adopted SDLC and the work is tied to a task or bug, add:

```bash
topogram query sdlc-backlog ./topo --json
topogram query sdlc-available ./topo --json
topogram sdlc explain <task-id> --json
topogram sdlc start <task-id> . --actor <actor-id> --json
topogram sdlc start <task-id> . --actor <actor-id> --write --json
topogram query slice ./topo --task <task-id> --json
topogram query sdlc-proof-gaps ./topo --task <task-id> --json
```

The first `sdlc start` command is read-only and returns the task-start packet.
Use `--write` only after reviewing blockers, ownership, decisions, rules,
plans, and verification targets in that packet.

For journey-oriented workflow context:

```bash
topogram query slice ./topo --journey journey_greenfield_start_from_template --json
```

For implementation planning:

```bash
topogram query single-agent-plan . --mode modeling --capability <capability-id> --json
```

Before commit in an SDLC-adopted project:

```bash
topogram query sdlc-proof-gaps ./topo --task <task-id> --json
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

## Generated project first-run commands

Generated projects usually expose these local scripts:

```bash
npm run agent:brief
npm run doctor
npm run source:status
npm run template:explain
npm run generator:policy:check
npm run check
npm run generate
npm run verify
```

## UI and widgets

For UI work, inspect widget and surface packets:

```bash
topogram widget check ./topo --projection proj_web_surface
topogram widget behavior ./topo --projection proj_web_surface --json
topogram emit ui-widget-contract ./topo --json
```

`ui_contract` owns semantic UI. Concrete web/native surfaces inherit it and own
routes and surface hints.

## Brownfield extract/adopt

Before running a package-backed extractor, identify and check the package:

```bash
topogram extractor list
topogram extractor show @topogram/extractor-react-router
npm install -D @topogram/extractor-react-router
topogram extractor policy init
topogram extractor policy pin @topogram/extractor-react-router@1
topogram extractor check @topogram/extractor-react-router
```

The policy pin uses the extractor manifest version, not the npm package
version. `topogram extractor list`, `show`, `check`, and `policy status` report
manifest version, installed package version, compatible CLI range, and policy
pin state before package-backed execution. `topogram extractor check` proves the
package boundary can load and run a minimal smoke extraction; it does not prove
that the package understood the target app. That proof comes from extract/adopt
review packets.

When `.topogram-extract.json` exists:

```bash
topogram extract check . --json
topogram extract diff . --json
topogram extract plan . --json
topogram adopt --list . --json
topogram query extract-plan ./topo --json
topogram query single-agent-plan ./topo --mode extract-adopt --json
topogram query multi-agent-plan ./topo --mode extract-adopt --json
topogram query work-packet ./topo --mode extract-adopt --lane adoption_operator --json
topogram extract status . --json
topogram extract history . --verify --json
```

Use `workspaceRoot` from import JSON as the canonical project-owned workspace
path.

In extract/adopt mode, query packets include `extraction_context` when
`.topogram-extract.json` is present. That context tells an agent which
package-backed extractors ran, how many candidates they produced, where the
trusted extraction record lives, and which review/adoption commands are safe to
run next. Treat extractor output as evidence until `topogram adopt ... --write`
promotes reviewed candidates.

Use query packets before raw `topo/candidates/**` files unless you need the
evidence details for a specific candidate.

## Command-owned state

Use commands for stateful workflow mutations:

- `topogram sdlc transition`
- `topogram sdlc plan step ... --write`
- `topogram sdlc archive`
- `topogram trust ...`
- `topogram extract ...`
- `topogram generate`
- `topogram emit --write`
- `topogram release ...`

Declarative `.tg` source may be edited directly. Status history, provenance,
trust hashes, generated sentinels, archives, and release evidence should not be
hand-edited to make checks pass.
