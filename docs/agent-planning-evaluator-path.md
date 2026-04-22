# Agent Planning Evaluator Path

This is the shortest evaluator-facing path for Topogram's current planning surface.

The claim boundary is intentionally narrow:

- Topogram now has an explicit default single-agent operating plan
- Topogram can decompose brownfield `import-adopt` work into an optional multi-agent coordination plan
- Topogram can emit one bounded work packet per lane for external agent systems
- Topogram does not yet claim a live scheduler, hosted orchestration, or authoritative agent-to-agent messaging fabric

## What To Verify

The planning stack should read in this order:

1. `query next-action`
2. `query single-agent-plan`
3. `query multi-agent-plan --mode import-adopt`
4. `query work-packet --mode import-adopt --lane <id>`
5. `query lane-status --mode import-adopt`
6. `query handoff-status --mode import-adopt`

That progression should answer four different questions cleanly:

- what should I do now?
- how should one agent carry this through?
- how can that plan be split safely?
- what exactly should one worker own?
- which lanes are still blocked or ready?
- which handoffs are still pending?

## Fast Local Path

Use an import-adopt fixture with staged reconcile artifacts:

```bash
node ./engine/scripts/build-adoption-plan-fixture.mjs ./engine/tests/fixtures/import/incomplete-topogram/topogram --scenario projection-impact --json
```

If you want the shortest one-command local walkthrough, run:

```bash
bash ./scripts/run-brownfield-rehearsal.sh
```

That will build the staged fixture, print the staged workspace root, and run the canonical brownfield review loop.

If you want to inspect the steps manually, start from:

```bash
node ./engine/src/cli.js query import-plan ./engine/tests/fixtures/import/incomplete-topogram/topogram
node ./engine/src/cli.js query review-packet ./engine/tests/fixtures/import/incomplete-topogram/topogram --mode import-adopt
node ./engine/src/cli.js query proceed-decision ./engine/tests/fixtures/import/incomplete-topogram/topogram --mode import-adopt
```

For this fixture, the important operator takeaway is:

- `review-packet` should stay sourced from `import-plan`
- `proceed-decision` should stay conservative and stop on the maintained no-go seams already in scope

Then inspect the planning surfaces:

```bash
node ./engine/src/cli.js query next-action ./engine/tests/fixtures/import/incomplete-topogram/topogram --mode import-adopt
node ./engine/src/cli.js query single-agent-plan ./engine/tests/fixtures/import/incomplete-topogram/topogram --mode import-adopt
node ./engine/src/cli.js query multi-agent-plan ./engine/tests/fixtures/import/incomplete-topogram/topogram --mode import-adopt
node ./engine/src/cli.js query work-packet ./engine/tests/fixtures/import/incomplete-topogram/topogram --mode import-adopt --lane bundle_reviewer.task
node ./engine/src/cli.js query lane-status ./engine/tests/fixtures/import/incomplete-topogram/topogram --mode import-adopt
node ./engine/src/cli.js query handoff-status ./engine/tests/fixtures/import/incomplete-topogram/topogram --mode import-adopt
```

For the shortest evaluator-facing verification path, run:

```bash
bash ./scripts/verify-agent-planning.sh
bash ./scripts/verify-brownfield-rehearsal.sh
```

## What The Planning Surface Proves

### Single-agent plan

This is the default operating loop.

It should unify:

- next action
- write scope
- review boundaries
- proof targets
- blocking conditions
- primary artifacts

### Multi-agent plan

This is the optional decomposition of the same baseline for `import-adopt`.

It should make these coordination rules explicit:

- review work may run in parallel only when owned targets do not overlap
- canonical adoption stays serialized
- proof runs after merged canonical state exists
- structured handoff packets matter more than freeform agent chat

### Work packet

This is the bounded assignment surface for one lane.

It should make it obvious:

- what the worker may read
- what the worker may touch
- what it owns
- what blocks it
- what proof expectations exist
- which handoff packet it must publish

### Lane and handoff status

These are the operator-visibility surfaces.

They should make it obvious:

- which lanes are blocked, ready, or complete
- whether adoption is still waiting on review lanes
- which handoff packets are still pending
- whether proof is ready to run yet

## Alpha Boundary

Planning is alpha-complete when framed as:

- artifact-backed guidance
- explicit review boundaries
- explicit serialized adoption and proof gates
- bounded worker assignments for external agent systems

Planning is not yet a claim about:

- a hosted multi-agent runtime
- a built-in scheduler
- autonomous merge resolution
- authoritative freeform agent messaging
