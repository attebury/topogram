# Development Decisions

This document is the working decision log for Topogram's own in-flight product, modeling, and artifact-taxonomy choices.

Use this file during development when a choice is important enough to record, but not yet stable enough to promote into canonical `topogram/decisions/*.tg`.

Promotion guidance:

- keep the note here while the choice is still being explored
- promote especially durable and reusable choices into canonical Topogram decisions once they stabilize
- archive or remove notes that were only useful during a temporary design phase

## 2026-04-18 - Promote journeys as the next long-lived knowledge artifact

Status: active development direction

Topogram already contains several durable requirement and design style artifacts:

- glossary docs
- workflow docs
- rules
- decisions
- reports

The strongest missing long-lived artifact is `journey`.

Journeys should be treated as user-goal-first reference docs that help humans and agents understand what a user is trying to accomplish before drilling into workflows, rules, capabilities, and decisions.

Initial implementation guidance:

- keep journeys docs-first and metadata-driven
- place them under `topogram/docs/journeys/*.md`
- require them to link to canonical Topogram concepts instead of duplicating lower-level detail

## 2026-04-18 - Keep the artifact core intentionally small

Status: active development direction

Topogram should not absorb every common pitch, requirements, and design artifact into the canonical core.

Current bias:

- keep journeys, glossary, workflows, rules, and decisions as the durable knowledge graph
- keep reports as analytical support surfaces
- treat use-cases, assumptions, change-impact notes, and migration risk notes as optional or transient until they prove durable across repeated use
- keep PRDs, pitch docs, wireframes, mockups, and raw research notes outside the canonical core unless they are promoted into stronger artifacts

## 2026-04-22 - Keep the agent workflow model machine-readable and core-defined

Status: active development direction

Topogram should keep its current workflow and planning model as the canonical machine-readable workflow core.

That includes:

- task modes
- write scope
- review boundaries
- maintained boundaries
- verification targets
- `next-action`
- `single-agent-plan`
- `multi-agent-plan`
- `work-packet`

This workflow core should be the main integration contract for external agent systems such as Cursor, Codex, or future MCP clients.

Topogram should not compete with external tools on:

- hosted orchestration runtimes
- schedulers
- freeform agent messaging
- tool-specific chat UX

Instead:

- providers may publish additive workflow presets
- teams may publish local workflow presets
- Topogram should resolve those presets onto the core workflow model
- tool-specific shims should remain optional convenience layers only if direct machine-readable consumption proves insufficient

This keeps one shared workflow vocabulary across humans, agents, providers, and tools while preserving local team control.

## 2026-04-22 - Treat Topogram as a software-intent operating model, not a repo description system

Status: active development direction

Topogram should not describe itself as an exhaustive repository description system.

The stronger and more accurate framing is:

- Topogram produces a machine-readable operating model of the software system
- it does not try to describe the repository exhaustively

This distinction matters because Topogram's generated machine-readable artifacts are centered on:

- canonical versus candidate versus maintained state
- boundaries and seams
- what may change
- what requires review
- what verification is expected
- what workflow should apply

They are not primarily trying to provide:

- a complete inventory of repository contents
- a full graph of all file relationships
- a general multimodal map of every document, diagram, and artifact in the repo

Reusable positioning lines:

- Topogram does not try to describe the repository exhaustively; it produces a machine-readable operating model of the software system so humans and agents can change it safely.
- Topogram is not a repo description system; it is a software-intent operating model.
- Topogram models what the software means and how it may change, not everything that exists in the repo.
- The output is not "here is the whole repo"; it is "here is the governed context for working in this software system."
- Graph-style tools describe repository structure; Topogram describes actionable software meaning, boundaries, and proof expectations.

## 2026-04-22 - Publish a deliberate alpha history and keep post-alpha shaping off the launch branch

Status: active development direction

Before the first remote-facing alpha push, Topogram should aggressively clean local history.

The public branch should read as a deliberate alpha narrative, not as exploratory local churn.

That means:

- rewrite local history into a small number of thematic alpha-era commits
- fold docs-only follow-ups into the feature or proof commit they explain
- keep post-alpha shaping work on separate local branches until it is intentionally promoted

After the first remote push:

- stop casual history rewriting on the public alpha branch
- use branch discipline instead:
  - `alpha/*` for launch-closeout work
  - `post-alpha/*` for shaping work

No change that broadens alpha claims should land without checking:

- `README.md`
- `docs/proof-points-and-limits.md`
- `docs/alpha-ready-checklist.md`
