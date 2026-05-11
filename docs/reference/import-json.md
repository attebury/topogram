# Import JSON

Use `--json` for agent and script automation.

Important fields:

- `workspaceRoot`: canonical path to the project-owned workspace folder,
  normally `topo/`.
- `projectRoot`: target project root.
- `candidateCounts`: number of imported candidate artifacts.
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

Agents should use `workspaceRoot`, not older compatibility fields, when deciding
where project-owned Topogram files live.
