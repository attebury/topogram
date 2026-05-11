# Agent First Run

Topogram projects should be easy for a new human or agent to enter without
reading the whole graph. Start with the project briefing, then use focused query
packets for the specific work.

## Command

```bash
topogram agent brief
topogram agent brief --json
```

`topogram agent brief` defaults to `./topo`. It validates the Topogram and
project config, but it does not write files, generate apps, load generator
adapters, or execute template implementation.

Generated projects include:

```bash
npm run agent:brief
```

That script runs `topogram agent brief --json`. The direct command is the
canonical machine-readable source; use `npm run --silent agent:brief` when a
tool needs pure JSON stdout through npm.

## Read Order

1. `AGENTS.md`
2. `README.md`
3. `topogram.project.json`
4. `topogram.sdlc-policy.json`, when present
5. `topogram.template-policy.json`
6. `topogram.generator-policy.json`
7. `.topogram-template-trust.json`, when executable implementation exists
8. `.topogram-import.json`, when the project came from brownfield import
9. Focused `topogram query ...` output

Agents should not read the entire graph by default. Use `topogram query list
--json`, then `topogram query show <name> --json`, and then the focused packet
for the task.

## First Commands

```bash
npm run agent:brief
npm run doctor
npm run source:status
npm run template:explain
npm run generator:policy:check
topogram sdlc policy explain --json
topogram sdlc gate . --require-adopted --json
topogram sdlc explain <task-or-bug-id> --json
npm run check
npm run query:list
npm run query:show -- widget-behavior
```

Executable-template projects also require:

```bash
npm run trust:status
npm run trust:diff
```

Do not refresh trust until `implementation/` has been reviewed.

## Edit Boundaries

Safe default edits:

- `topo/**`
- `topogram.project.json`
- `topogram.sdlc-policy.json`
- policy files after review
- `implementation/**` only after reviewing trust state

Generated-owned outputs such as `app/**` are replaceable. Agents should not make
lasting edits there unless the output ownership has been changed to maintained.

## SDLC Adoption

Projects opt into enforceable SDLC with `topogram.sdlc-policy.json`.
Missing policy means `topogram sdlc gate` reports `not_adopted` and exits
successfully unless `--require-adopted` is passed. Adopted projects can run in
`advisory` mode to report gaps, or `enforced` mode to fail protected changes
that lack a valid SDLC item, a `topo/**` SDLC record change, or an allowed
exemption.

For implementation work, agents should start with:

```bash
topogram agent brief --json
topogram query list --json
topogram sdlc explain <task-id> --json
topogram query slice ./topo --task <task-id> --json
topogram query single-agent-plan . --mode modeling --capability <cap-id> --json
topogram sdlc prep commit . --base origin/main --head HEAD --json
```

If `sdlc explain` returns linked plans, inspect the active plan before
editing. Plan text and step definitions are declarative source; step
status changes should use `topogram sdlc plan step ... --write` so the
history sidecar can detect drift.

The same rule applies to other stateful workflow surfaces: use
`topogram sdlc transition`, `topogram sdlc archive`, `topogram trust ...`,
`topogram import ...`, `topogram generate`, `topogram emit --write`, and
release commands instead of hand-editing history, archives, trust records,
provenance, generated sentinels, or rollout evidence.

## File Organization

Small projects can keep the starter layout. Larger projects should organize
source by convention:

```text
topo/domains/<domain>/
topo/shared/
topo/domains/<domain>/actors
topo/domains/<domain>/entities
topo/domains/<domain>/shapes
topo/domains/<domain>/capabilities
topo/domains/<domain>/rules
topo/domains/<domain>/workflows
topo/domains/<domain>/widgets
topo/domains/<domain>/projections
topo/domains/<domain>/verifications
```

The parser still flattens statements into one graph. Folders are for humans and
agents.

## UI And Widgets

`ui_contract` owns screens, screen regions, widget bindings, behavior,
visibility, and semantic design tokens. Concrete web/iOS/Android surfaces
realize that contract.

After UI edits, run:

```bash
topogram widget check --json
topogram widget behavior --json
topogram emit ui-widget-contract --json
```

## Brownfield Import

If `.topogram-import.json` exists, run:

```bash
topogram import check . --json
topogram import plan . --json
topogram import adopt --list . --json
topogram import status . --json
topogram import history . --verify --json
```

Import JSON payloads expose `workspaceRoot`. Agents should use that field as
the canonical project-owned workspace path instead of inferring folder names or
reading compatibility fields.

Imported Topogram files are project-owned after adoption. Source hashes record
the brownfield evidence trusted at import time.
