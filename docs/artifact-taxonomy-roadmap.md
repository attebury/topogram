# Artifact Taxonomy Roadmap

## Current Recommendation

Topogram already carries several long-lived requirement and design artifacts, even though they are not framed explicitly in traditional product-development language.

The durable core today is:

- glossary docs
- workflow docs
- rules
- decisions
- reports

The next artifact to promote is `journey`.

Canonical journeys should live under `topogram/docs/journeys/*.md` and act as the user-goal-first entrypoint for both humans and agents evaluating change impact.

This promotion guidance also depends on a clear workspace split:

- canonical surfaces under `topogram/**`
- candidate and draft surfaces under `candidates/**`
- generated realization and proof surfaces under `artifacts/**` and `apps/**`

Without that split, it becomes much harder to tell whether a journey, workflow, or report is durable source of truth, a proposal, or just a generated reference.

## Why Promote Journeys

Journeys fill a gap that existing workflow docs do not cover cleanly.

- workflows describe system and business state transitions
- journeys describe what the user is trying to accomplish end-to-end

That distinction matters for upgrade and maintenance work. A smaller team or an agent can often diagnose what to change faster by starting from the broken user goal, then following links into workflows, rules, capabilities, decisions, and glossary terms.

## Durable Core vs Optional Inputs

The current bias is to keep the long-lived core small.

Keep as long-lived canonical Topogram surfaces:

- journeys
- glossary
- workflows
- rules
- decisions

Keep as analytical or generated support surfaces:

- reports

Keep under evaluation or treat as transient by default:

- use-cases
- change-impact notes
- assumptions logs
- migration risk notes

Keep outside the canonical core unless promoted into stronger forms:

- pitch decks
- concept memos
- PRDs
- wireframes
- mockups
- raw research synthesis
- roadmap and prioritization artifacts

## Promotion Guidance

When a planning or discovery artifact proves durable, promote the stable parts into canonical Topogram surfaces instead of preserving the whole original document forever.

Examples:

- a stable term becomes a glossary doc
- a durable tradeoff becomes a decision
- a repeated user-facing flow becomes a journey
- an enduring system behavior becomes a workflow or rule

Artifacts that only serve one change, migration, or planning cycle should be archived or deleted once their useful content has been promoted.

That keeps the human/agent collaboration model clean:

- humans approve durable artifacts
- agents can propose or infer candidate artifacts
- the engine can regenerate analytical and proof artifacts freely
