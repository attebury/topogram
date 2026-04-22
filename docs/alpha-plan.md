# Alpha Plan

This document is the operating plan for Topogram's invite-led public alpha.

It sits between the broad product roadmap and day-to-day implementation work. The goal is to keep the alpha scope small, honest, and executable.

## Alpha objective

Ship an invite-led public alpha that proves Topogram's first credible job:

- controlled software evolution for humans and agents

The alpha should show that Topogram can:

- model durable software intent
- generate contracts and runnable artifacts from that intent
- recover structure from existing systems through brownfield import and reconcile
- guide changes in hand-maintained code with explicit safe, review-required, and no-go boundaries

The alpha should not try to prove that Topogram is already a general-purpose, production-ready software platform.

## Canonical alpha story

The canonical story for alpha is:

- Topogram helps humans and agents evolve software safely by keeping intent, generated outputs, and verification aligned.

The canonical evaluator path should remain:

1. state the wedge from [README.md](../README.md)
2. show maintained-app evolution proof in [product/app/proof/edit-existing-app.md](../product/app/proof/edit-existing-app.md)
3. show one safe, one guarded, and one no-go change
4. show brownfield breadth through [confirmed-proof-matrix.md](./confirmed-proof-matrix.md)
5. close on [proof-points-and-limits.md](./proof-points-and-limits.md)

The alpha is not primarily a "generate an app from scratch" story, even though generated examples remain an important proof surface.

## Alpha must-haves

These are the things that should be complete before treating the alpha as externally ready.

### 1. Launch story and evaluator path

- README and launch-facing docs tell one coherent story
- one canonical evaluator path exists and matches the live demo
- one canonical demo path has been rehearsed end to end
- proof points and limits are published and consistent with all public-facing language

Current closeout reference:

- [alpha-ready-checklist.md](./alpha-ready-checklist.md)
- [alpha-launch-and-repo-shaping-plan.md](./alpha-launch-and-repo-shaping-plan.md)

### 2. Proof-backed product wedge

- maintained-app proof is easy to understand and easy to navigate
- the safe / guarded / no-go boundary story is crisp
- brownfield proof breadth is easy to inspect
- generated examples remain healthy enough to support the “shared intent -> contracts -> artifacts -> proof” story

### 3. Verification confidence

- CI is green on the current fast and deeper verification paths
- local verification commands are stable and documented
- the current proof boundary around generated verification vs independent trust anchors is explicit

### 4. Scope discipline

- public claims stay narrow around controlled software evolution
- auth claims stay explicitly alpha-complete at the signed-token boundary, not production-ready
- deployment and runtime hardening claims stay explicitly limited
- generality claims stay narrow and evidence-backed

### 5. Invite-led operating readiness

- good-fit design partner profile is clearly described
- invite or contact path is live
- the team can answer “who is this for right now?” in one sentence
- the deferred alpha measurement loop remains explicitly tracked for the first post-story-lock follow-on

Current working references:

- [design-partner-profile.md](./design-partner-profile.md)
- [invite-led-alpha.md](./invite-led-alpha.md)
- [alpha-launch-tracker.md](./alpha-launch-tracker.md)

## Can slip without blocking alpha

These are valuable, but they should not block the invite-led alpha if the canonical story is already strong.

- richer browser verification beyond the current compile, smoke, and runtime-check stack
- deeper auth implementation profiles
- broader deployment packaging
- alpha metrics instrumentation and recurring measurement review before the evaluator path is stable enough to measure consistently
- additional UI targets beyond current web-centered proofs
- `ui_patterns` implementation work
- broader Topogram package reuse flows
- major context-serving and token-efficiency improvements beyond the current context targets

## Explicitly deferred from alpha

These should remain out of scope for alpha messaging and should not silently become launch commitments.

- production-grade auth readiness
- broad deployment hardening claims
- full generality across domain shapes
- symmetric multi-target proof across multiple runtimes for the same domain
- fully independent verification beyond the current proof stack
- first-class framework-level UI component modeling in canonical `.tg`
- registry-scale Topogram package ecosystem work

## Active workstreams

Topogram should be managed against five active alpha workstreams.

### 1. Launch narrative and docs

Purpose:

- make the public story coherent, short, and evidence-backed

Primary outputs:

- launch-ready README
- proof points and limits page
- evaluator path
- skeptical evaluator guide
- invite/contact path

Definition of done:

- a new evaluator can understand the wedge and proof boundary in one pass without extra explanation

### 2. Maintained-app proof and change-boundary story

Purpose:

- prove that Topogram can guide real changes in hand-maintained code, not only generate reference apps
- make the maintained boundary legible through explicit seams and output-scoped seams, not only files

Primary outputs:

- maintained-app proof stories
- explicit safe / guarded / no-go examples
- maintained-app review materials
- seam-aware maintained-boundary and maintained-operator query docs

Definition of done:

- this is the strongest part of the live demo, not a side note
- evaluators can see which seam moved, which output owns it, and which verification set goes with it

### 3. Brownfield proof and adoption flow

Purpose:

- prove that Topogram can recover structure from real systems and selectively promote it into canonical Topogram surfaces

Primary outputs:

- confirmed proof matrix
- import/reconcile/adopt docs
- stable candidate and review flow

Definition of done:

- the brownfield story feels like a repeatable workflow, not a research demo

### 4. Verification and trust surface

Purpose:

- keep the proof story credible and reproducible

Primary outputs:

- green CI on required checks
- stable verification scripts
- documented testing strategy
- explicit explanation of current independent vs self-generated trust layers

Definition of done:

- evaluators can see what is tested, what is generated, and what remains incomplete

Near-term follow-on after the story and demo path are stable:

- start a lightweight alpha measurement loop once the evaluator path is stable enough to measure consistently

### 5. Product shaping after alpha

Purpose:

- keep the post-alpha backlog visible without letting it destabilize alpha scope

Primary tracked themes:

- runtime hardening
- auth implementation profiles
- business logic extension hooks
- `ui_patterns`
- more persistence/runtime options
- broader domains
- shareable Topogram packages
- context serving and token efficiency
- alpha metrics instrumentation and the recurring measurement loop

Definition of done:

- promising next-step work is documented and prioritized, but clearly separated from alpha commitments

## Immediate next milestone

The immediate next milestone should be:

- lock the alpha story, demo path, and public claim boundary

That means the next project-management focus should be:

1. tighten README and launch-facing docs
2. confirm the exact demo path and evidence sequence
3. make sure proof links and scripts are clean and reliable
4. ensure the invite-led alpha positioning is explicit everywhere
5. separate alpha-closeout work from parked post-alpha shaping work before first remote push

## Next trust-building target after alpha

After alpha, the clearest next trust-building target should be:

- one multi-target example proving the same domain cleanly across more than one web/runtime combination

That is the most direct next answer to the critique that Topogram is still too example-shaped or too tied to one realization path.

## Working rule

When prioritization is unclear, prefer work that strengthens one of these alpha questions:

- can humans and agents share one durable source of software intent?
- can Topogram guide real change in maintained code?
- can Topogram recover and reconcile structure from real existing systems?
- can it prove enough to be trusted within its stated boundary?

If a task does not strengthen one of those answers, it likely belongs in the post-alpha backlog rather than the alpha critical path.
