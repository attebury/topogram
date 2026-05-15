---
id: proof_demo_program
kind: report
title: Proof Demo Program
status: canonical
---

# Proof Demo Program

Topogram proof repos should demonstrate working product workflows, not just
describe them. Each proof step should be visible as a branch or tag and should
include a README note with the step purpose, commands, verification result, and
agent-facing artifacts worth inspecting.

Canonical journey: `journey_proof_demo_program`.

## Proof Repos

- `attebury/topogram-proof-content-approval`
  ([GitHub](https://github.com/attebury/topogram-proof-content-approval)):
  generated-first proof path.
- `attebury/topogram-proof-content-approval-brownfield`
  ([GitHub](https://github.com/attebury/topogram-proof-content-approval-brownfield)):
  real-ish brownfield app path for extract/adopt and maintained development
  proof.

## Completed Checkpoints

Generated/maintained proof:

- `proof-01-generated-baseline`: copy starter, generate app, verify compile.
- `proof-02-content-approval-domain`: replace starter domain with content
  approval Topogram and regenerate.
- `proof-03-review-workflow-ui`: add widgets, bindings, behavior, and UI
  contract artifacts.
- `proof-04-generated-db-migration`: emit generated DB snapshot/migration
  artifacts while output is still generated-owned.
- `proof-05-graduate-maintained`: switch `app/` to maintained ownership and
  prove generation refuses to overwrite it.
- `proof-06-maintained-feature`: add maintained bulk review behavior from
  Topogram packets without regeneration.
- `proof-07-maintained-db-migration`: emit migration proposals and manually
  adapt maintained DB files.

Brownfield proof:

- `proof-01-brownfield-baseline`: real-ish React Router, Express, Prisma app
  with no `topo/`.
- `proof-02-extract-candidates`: package-backed Prisma, Express, and React
  Router extraction into review-only candidates.
- `proof-03-adopt-spec`: adopt/curate candidates into canonical `topo/` and
  enable SDLC.
- `proof-04-feature-from-topo`: add maintained bulk approve behavior from
  Topogram context.
- `proof-05-refresh-drift`: introduce source drift and capture refresh/diff
  artifacts without silent adoption.
- `proof-06-recreate-other-stack`: generate SvelteKit/Hono/Postgres into
  `recreated-app/` beside maintained source.
- `proof-07-parity-proof`: compare maintained and generated stacks through
  contracts, packets, and verification summaries.

## Proof Rules

- Prefer one repo per coherent story, not one repo per command.
- Branches and tags should name the step number and workflow.
- SDLC is used in proof repos to show the habit, but ordinary users do not have
  to adopt SDLC unless they want enforcement.
- Verification must compile, run, or check consumer-visible behavior; string and
  file-existence checks are not enough for proof claims.

## Notes

- SDLC is intentionally used inside the proof repos as a recommended operating
  habit. It is not required for ordinary Topogram users.
- The brownfield proof keeps extraction output review-only and treats canonical
  `topo/` as curated after adoption.
- The cross-stack proof currently proves contract/compile parity, not full live
  runtime equivalence or pixel parity.
