# Proof Walkthrough

Topogram has two public proof repositories. They are tutorial-style product
stories, not fixtures. Use them when you want to see complete workflow evidence:
branches, tags, README notes, SDLC records, agent packets, emitted contracts,
and verification commands.

## Proof Repos

| Story | Repository | What It Proves |
| --- | --- | --- |
| Generated to maintained | [topogram-proof-content-approval-v2](https://github.com/attebury/topogram-proof-content-approval-v2) | Start from a generated app, iterate through Topogram, graduate output to maintained ownership, then use Topogram for maintained feature and DB migration guidance. |
| Brownfield extract/adopt | [topogram-proof-content-approval-brownfield-v2](https://github.com/attebury/topogram-proof-content-approval-brownfield-v2) | Start with a maintained app, extract candidates, adopt curated specs, implement a maintained feature, refresh drift, recreate another stack, and compare parity. |

Both repos expose a `Proof Verification` workflow, `npm run proof:audit`, and
`npm run verify`. They also use SDLC to show the recommended habit, but SDLC is
not required for ordinary Topogram users.

`topogram release status --strict` tracks these repos as `proofConsumers`, not
as normal package rollout consumers. A release is considered current when proof
repos meet the configured proof baseline, expose the audit/verify scripts, and
have green Proof Verification workflows. The current v2 proof baseline is
`@topogram/cli@0.3.92`. Proof repos do not need to be repinned for every CLI
patch; refresh them when a command workflow meaning changes, a breaking change
lands, or a proof artifact would teach stale behavior.

## How To Read A Proof

1. Open the repo and confirm the `Proof Verification` badge is green.
2. Read `proof/README.md` for the step map.
3. Check out a proof tag:

   ```bash
   git fetch --tags
   git checkout proof-03-review-workflow-ui
   cat proof/STEP.md
   npm install
   npm run verify
   ```

4. Inspect `proof/artifacts/` for the machine-readable proof.
5. Compare the current tag with the previous tag when you want to see exactly
   what changed.

## What Agents Should Read

The proof repos intentionally commit agent-facing artifacts. These are the files
an implementation agent would normally read instead of loading the whole repo:

- `agent-brief.json`: read order, edit boundaries, workflow commands, and trust
  or policy state.
- `*-task-slice.json`: focused SDLC/task context for one implementation slice.
- `*-single-agent-plan.json`: implementation plan for maintained app edits.
- `ui-surface-contract.json`, `ui-widget-contract.json`, and widget reports:
  UI contracts and conformance checks.
- DB snapshots, migration plans, and SQL migration artifacts: generated or
  maintained migration evidence.
- extract/adopt plans and receipts: brownfield candidate review and adoption
  proof.

## Story 1: Generated To Maintained

The generated proof walks through:

| Step | What To Notice |
| --- | --- |
| 01 generated baseline | `topogram copy` creates a starter and `topogram generate` owns app output. |
| 02 content approval domain | Editing `topo/` changes the generated app contract and output. |
| 03 review workflow UI | Widgets, screen bindings, behavior, and UI contracts become the development guide. |
| 04 generated DB migration | DB snapshots and SQL migration output are generated while app output is still generated-owned. |
| 05 graduate maintained | `topogram generate` refuses to overwrite maintained output. |
| 06 maintained feature | Agent/query packets guide direct maintained app edits. |
| 07 maintained DB migration | Topogram emits migration proposals; humans/agents adapt maintained DB files directly. |

## Story 2: Brownfield Extract/Adopt

The brownfield proof walks through:

| Step | What To Notice |
| --- | --- |
| 01 brownfield baseline | A working React/Express/Prisma app exists with no `topo/`. |
| 02 extract candidates | Package-backed extractors create review-only candidates and provenance. |
| 03 adopt spec | Curated candidates become canonical `topo/`; extraction output remains evidence. |
| 04 feature from topo | A maintained feature is implemented from Topogram context packets. |
| 05 refresh drift | Source/spec drift is detected and reviewed without silent adoption. |
| 06 recreate other stack | The adopted Topogram generates a SvelteKit/Hono/Postgres recreation beside maintained source. |
| 07 parity proof | Contracts and verification reports compare maintained and generated stacks. |

## Current Limits

The proofs show contract, compile, and workflow parity. They do not claim pixel
parity, full production deployment readiness, or exhaustive runtime equivalence.
When a proof cannot establish something, it should say so in the step result or
parity report.
