# Agent First Run

Topogram projects should be easy for a new human or agent to enter without
reading the whole graph. Start with the project briefing, then use focused query
packets for the specific work.

## Command

```bash
topogram agent brief
topogram agent brief --json
```

`topogram agent brief` defaults to `./topogram`. It validates the Topogram and
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
4. `topogram.template-policy.json`
5. `topogram.generator-policy.json`
6. `.topogram-template-trust.json`, when executable implementation exists
7. `.topogram-import.json`, when the project came from brownfield import
8. Focused `topogram query ...` output

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

- `topogram/**`
- `topogram.project.json`
- policy files after review
- `implementation/**` only after reviewing trust state

Generated-owned outputs such as `app/**` are replaceable. Agents should not make
lasting edits there unless the output ownership has been changed to maintained.

## File Organization

Small projects can keep the starter layout. Larger projects should organize
source by convention:

```text
topogram/domains/<domain>/
topogram/shared/
topogram/domains/<domain>/actors
topogram/domains/<domain>/entities
topogram/domains/<domain>/shapes
topogram/domains/<domain>/capabilities
topogram/domains/<domain>/rules
topogram/domains/<domain>/workflows
topogram/domains/<domain>/widgets
topogram/domains/<domain>/projections
topogram/domains/<domain>/verifications
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
topogram import check .
topogram import plan .
topogram import adopt --list .
topogram import status .
topogram import history . --verify
```

Imported Topogram files are project-owned after adoption. Source hashes record
the brownfield evidence trusted at import time.
