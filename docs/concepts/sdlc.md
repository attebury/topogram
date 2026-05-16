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
topogram query sdlc-backlog ./topo --json
topogram query sdlc-available ./topo --json
topogram sdlc start <task-id> . --actor actor_coding_agent --json
topogram sdlc start <task-id> . --actor actor_coding_agent --write --json
topogram query sdlc-proof-gaps ./topo --task <task-id> --json
topogram query sdlc-metrics ./topo --json
topogram query sdlc-stale-work ./topo --json
topogram sdlc prep commit . --base origin/main --head HEAD --json
topogram sdlc gate . --base origin/main --head HEAD --require-adopted --json
```

The default `sdlc start` call is read-only. It returns the task, linked
requirement, acceptance criteria, decisions, rules, blockers, plans, query
commands, write-scope hints, and verification targets. Add `--write` only after
reviewing that packet; the command then owns the legal transition from
`unclaimed` or same-actor `claimed` work to `in-progress`.

## Chain Of Proof

Use the smallest SDLC record that tells the truth:

- `pitch`: why a backlog theme matters.
- `requirement`: durable behavior the project commits to.
- `acceptance_criterion`: observable proof. Approved criteria use
  `Given ... when ... then ...` wording.
- `task`: one implementation-sized slice.
- `verification`: proof command, test, check, or CI gate.
- `decision`: durable choice.
- `bug`: violation of an accepted rule, requirement, or verified expectation.
- `plan`: optional nested execution notes for a task.

Done tasks require valid `satisfies` refs to requirements, approved
`acceptance_refs`, and valid `verification_refs`.

Finite requirements stay `approved` until done tasks prove them, then they can
transition to `satisfied`. Durable operating commitments can transition to
`ongoing`; ongoing requirements must link to at least one rule or verification
and are intentionally omitted from available-work and closeout queues.

Use `topogram query sdlc-backlog ./topo --json` for backlog grooming. It shows
draft/shaped/submitted pitches, draft or in-review requirements, draft journeys,
and draft plans. Covered pitches, satisfied requirements, ongoing requirements,
and completed work are intentionally omitted. A pitch can transition to
`covered` when linked requirements or decisions already handled the problem.

Before completing work:

```bash
topogram query sdlc-proof-gaps ./topo --task <task-id> --json
topogram sdlc complete <task-id> . --verification <verification-id> --actor actor_coding_agent --write
```

Use `topogram query sdlc-claimed ./topo --actor <actor-id> --json` to see work
already claimed by an actor. Use `topogram query sdlc-blockers ./topo --task
<task-id> --json` when a task cannot start or complete.

Use `topogram query sdlc-metrics ./topo --json` for counts, WIP, stale work,
closeout candidates, proof gaps, ongoing requirements, and transition-duration
statistics derived from `.topogram-sdlc-history.json`. Use
`topogram query sdlc-stale-work ./topo --json` for the focused stale/WIP policy
view. Projects can optionally add `wipLimits` and `staleWork` thresholds to
`topogram.sdlc-policy.json`; advisory policies warn, enforced policies can fail
protected-change gates unless an allowed exemption is supplied.

## Command-owned state

Humans and agents may edit declarative `.tg` text directly. Use commands for
stateful mutations:

- `topogram sdlc transition`
- `topogram sdlc plan step ... --write`
- `topogram sdlc archive`
- `topogram trust ...`
- `topogram extract ...`
- `topogram generate`
- `topogram emit --write`
- `topogram release ...`
