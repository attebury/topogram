# Dev.to Draft: Looking For A Small Number Of Design Partners

**Proposed title**

Looking for a few design partners for Topogram

**Optional subtitle**

Topogram is an early spec-and-proof layer for teams using coding agents to evolve real software.

**Suggested tags**

- `ai`
- `developer-tools`
- `architecture`
- `opensource`

## Draft

I’m looking for a small number of design partners to review an early project called **Topogram**.

Topogram is aimed at a specific problem:

> how do humans and coding agents evolve real software without letting intent, generated outputs, and verification drift apart?

The core idea is simple:

- keep durable software intent explicit
- generate contracts and runnable artifacts from that intent
- keep verification attached to the same source of truth
- make it clearer what should stay generated, what should stay hand-maintained, and what should stop for human review

This is not a “prompt to product” tool and it is not a production-ready platform.

The current wedge is narrower:

- brownfield recovery and reconcile/adopt workflows
- maintained-app change guidance
- proof-oriented generated artifacts and verification
- explicit safe, guarded, and no-go boundaries for agent-assisted change

The repo already has working proof surfaces for:

- generated examples across multiple domains
- brownfield recovery on real stacks
- a maintained proof app that shows how Topogram can guide edits to existing code
- explicit single-agent and bounded multi-agent planning surfaces

If that problem space is familiar, I’d love a limited round of review from people across a real software team, especially:

- developers and technical leads already using coding agents on real systems
- product designers and UX people who care about where agent assistance should stop and human judgment should stay in the loop
- product owners who feel the cost when workflow intent, implementation, and review drift apart
- teams working on brownfield systems rather than only greenfield demos
- people who are opinionated about contracts, architecture, workflow semantics, and review boundaries

Good fit:

- cross-functional software teams comfortable with early infrastructure
- people willing to react to a real repo, proof docs, and evaluator path
- teams with one contained workflow or subsystem they’d use to pressure-test this
- teams where engineering, design, and product all have a stake in how changes are proposed, reviewed, and verified

Bad fit:

- teams looking for a no-code builder
- teams expecting production-ready auth or deployment hardening today
- teams wanting a generic agent runtime or orchestration platform

If you want to take a look, the best starting points are:

- [README](https://github.com/attebury/topogram/blob/main/README.md)
- [Evaluator Path](https://github.com/attebury/topogram/blob/main/docs/evaluator-path.md)
- [Proof Points And Limits](https://github.com/attebury/topogram/blob/main/docs/proof-points-and-limits.md)
- [Invite-Led Alpha](https://github.com/attebury/topogram/blob/main/docs/invite-led-alpha.md)

If you’re interested, the current lightweight path is:

- open a GitHub issue: [attebury/topogram/issues](https://github.com/attebury/topogram/issues)
- use the title prefix `alpha interest:`
- include:
  - what kind of codebase or system you’re working on
  - whether the main pressure is brownfield recovery, maintained-app evolution, or proof/verification
  - where coding agents are helping today, and where they’re drifting

What I’m looking for right now is not broad attention. I’m looking for a few sharp conversations with teams who actually feel this problem from different angles: engineering, design, UX, and product.

If that’s you, I’d really appreciate the review.

## Shorter Variant

I’m looking for a few design partners to review **Topogram**, an early spec-and-proof layer for teams using coding agents to evolve real software.

The problem it’s aimed at is keeping **intent, generated outputs, and verification aligned** as humans and agents change a system together.

Current focus:

- brownfield recovery
- maintained-app change guidance
- proof-oriented generated artifacts
- explicit safe / guarded / no-go change boundaries

This is **not** a prompt-to-product tool, not a hosted agent runtime, and not a production-ready platform.

If your team is already using coding agents on real codebases and you care about architecture, contracts, UX decisions, workflow semantics, and review boundaries, I’d love feedback from across the team: engineering, design, UX, and product.

Start here:

- [README](https://github.com/attebury/topogram/blob/main/README.md)
- [Evaluator Path](https://github.com/attebury/topogram/blob/main/docs/evaluator-path.md)
- [Proof Points And Limits](https://github.com/attebury/topogram/blob/main/docs/proof-points-and-limits.md)

If interested, open a GitHub issue with the prefix `alpha interest:`.
