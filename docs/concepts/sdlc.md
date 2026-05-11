# SDLC

Topogram can make project work traceable inside `topo/`.

Projects opt in with `topogram.sdlc-policy.json`. Missing policy means SDLC
commands still work, but `topogram sdlc gate` reports `not_adopted` unless
`--require-adopted` is passed.

## Records

Recommended layout:

```text
topo/sdlc/
  pitches/
  requirements/
  acceptance_criteria/
  tasks/
  plans/
  bugs/
  decisions/
  _archive/
```

Use one record per file for SDLC kinds. Plans may contain multiple nested step
definitions.

## Normal loop

```bash
topogram sdlc policy explain --json
topogram sdlc explain <task-id> --json
topogram query slice ./topo --task <task-id> --json
topogram sdlc prep commit . --base origin/main --head HEAD --json
topogram sdlc gate . --base origin/main --head HEAD --require-adopted --json
```

Done tasks require `satisfies`, `acceptance_refs`, and `verification_refs`.

## Command-owned state

Humans and agents may edit declarative `.tg` text directly. Use commands for
stateful mutations:

- `topogram sdlc transition`
- `topogram sdlc plan step ... --write`
- `topogram sdlc archive`
- `topogram trust ...`
- `topogram import ...`
- `topogram generate`
- `topogram emit --write`
- `topogram release ...`
