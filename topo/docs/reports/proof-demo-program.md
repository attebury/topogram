---
id: proof_demo_program
kind: report
title: Proof Demo Program
status: draft
---

# Proof Demo Program

Topogram proof repos should demonstrate working product workflows, not just
describe them. Each proof step should be visible as a branch or tag and should
include a README note with the step purpose, commands, verification result, and
agent-facing artifacts worth inspecting.

Canonical journey: `journey_proof_demo_program`.

## Initial Proof Repos

- `attebury/topogram-proof-content-approval`: generated-first proof path.
- `attebury/topogram-proof-content-approval-brownfield`: real-ish brownfield
  app path for extract/adopt and maintained development proof.

## Step Groups

- Generated-only: baseline, first feature iteration, second feature iteration.
- Maintained graduation: convert the generated app path to maintained ownership.
- Maintained DB migration: emit migration proposals and apply/adapt them in the
  maintained app.
- Brownfield extract/adopt: extract candidates, review packets, and adopt
  canonical topo records.
- Brownfield maintained feature: use Topogram packets to implement a new feature
  in existing code.
- Cross-stack recreation: use adopted specs to build or generate a comparable
  app in another stack.

## Proof Rules

- Prefer one repo per coherent story, not one repo per command.
- Branches and tags should name the step number and workflow.
- SDLC is used in proof repos to show the habit, but ordinary users do not have
  to adopt SDLC unless they want enforcement.
- Verification must compile, run, or check consumer-visible behavior; string and
  file-existence checks are not enough for proof claims.
