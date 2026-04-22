# Invite-Led Alpha Launch And Repository Shaping Plan

This note captures how Topogram should prepare for its first remote-facing invite-led alpha.

The immediate job is not to broaden the product. The immediate job is to publish a small, deliberate alpha that reads clearly in both the repository and the public story.

## Alpha launch objective

Ship a first remote-facing invite-led alpha that proves Topogram's current wedge:

- controlled software evolution for humans and agents

The public alpha should let a new evaluator understand, in one pass:

- the wedge
- one maintained-app proof
- brownfield breadth
- the current proof boundary and limits

## Canonical launch artifact set

These are the launch-critical surfaces that should stay coherent together:

- [README.md](../README.md)
- [evaluator-path.md](./evaluator-path.md)
- [proof-points-and-limits.md](./proof-points-and-limits.md)
- [alpha-ready-checklist.md](./alpha-ready-checklist.md)
- [alpha-launch-tracker.md](./alpha-launch-tracker.md)
- maintained proof package under [product/app/proof](../product/app/proof)
- brownfield proof inventory through [confirmed-proof-matrix.md](./confirmed-proof-matrix.md)

Launch-ready means:

- the evaluator path matches the actual live demo
- proof docs do not overclaim
- one maintained query sequence and one deterministic import/adopt rehearsal path still run as written

## Repository shaping before first push

Before first remote push, keep the repository split into three categories.

### 1. Alpha branch content

Keep only:

- public story and evaluator docs
- maintained-boundary and seam-aware proof surfaces
- brownfield proof surfaces already inside the alpha narrative
- verification scripts and artifacts needed to rehearse the current demo
- engine changes that directly support the current alpha proof path

### 2. Parked post-alpha shaping work

Keep off the launch branch:

- Graphify integration notes and repo-understanding expansions
- Agentic Stack integration notes
- provider or platform expansion beyond current proof needs
- version-context and metadata hardening not required by current alpha-facing outputs
- broader UI flow recovery and extra brownfield breadth unless they fix a current demo failure

Recommended handling:

- keep this work on separate local branches
- keep only a small roadmap or docs trail on the launch branch
- do not let alpha-facing docs imply these are current commitments

### 3. Ongoing post-push policy

After the first remote push:

- `alpha/*` branches are for launch-closeout work only
- `post-alpha/*` branches are for shaping work
- no change that broadens claims lands without checking:
  - [README.md](../README.md)
  - [proof-points-and-limits.md](./proof-points-and-limits.md)
  - [alpha-ready-checklist.md](./alpha-ready-checklist.md)

Every future change should be classified as:

- `alpha-critical`
- `can-slip`
- `post-alpha only`

## Pre-push commit history cleanup

Before the first remote push, rewrite local history into a short public-facing sequence.

Target shape:

1. repo hygiene and generated-artifact cleanup
2. seam-aware maintained proof for alpha
3. brownfield import and reconcile trust hardening
4. agent operating model and workflow preset foundation
5. alpha docs, evaluator path, proof boundary, and launch tracker
6. optional final polish for wording or verification freshness

Cleanup rules:

- squash exploratory iterations into thematic commits
- fold docs-only follow-ups into the feature or proof commit they explain
- drop superseded wording and dead-end scaffolding before push
- keep commit messages product-legible
- avoid publishing exploratory local churn if it can still be rewritten safely

Recommended commit-message style:

- `Establish seam-aware maintained proof for alpha`
- `Harden brownfield import review against speculative seam inference`
- `Add workflow preset guidance for agent operating model`
- `Lock invite-led alpha story and evaluator path`

## Current blocker to history rewrite

The history rewrite should happen only after the current working tree is sorted into:

- keep for alpha
- park before push
- revert from launch branch

Do not rewrite the local commit sequence while the working tree still mixes alpha-closeout work with parked post-alpha shaping changes.

## Verification before first push

Before first remote push, verify:

- evaluator path still matches the actual demo sequence
- maintained query sequence still runs exactly as documented
- deterministic import/adopt fixture still produces a non-empty staged proposal demo
- proof docs do not overclaim beyond the current maintained, brownfield, and auth boundary
- the launch branch contains no accidental post-alpha shaping work
- the rewritten commit history reads top-to-bottom as one coherent alpha story
