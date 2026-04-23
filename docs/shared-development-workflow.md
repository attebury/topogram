# Shared Development Workflow

This note defines the working agreement for day-to-day development in Topogram.

It is intentionally aimed at the current maintainer plus Codex. It is not yet a broad contributor policy.

The goal is moderate discipline:

- keep `main` demoable
- keep branch scope clear
- keep proof and launch-story work from getting mixed with shaping work
- keep durable local operator memory in a local-only `.ops/` handbook

## Summary

Default posture:

- work in small, squashable task branches
- keep `main` as the best public-ready line
- treat engine, canonical meaning, generated outputs, maintained code, and launch-facing docs as different risk classes
- use `.ops/` for durable local-only operator notes, branch handoffs, and launch triage
- use stricter gates only when work changes public claims, canonical semantics, or proof surfaces

## Branch Classes

Use only these branch classes by default:

- `main`
  - the cleanest public-ready line
  - no direct exploratory work
- `codex/<task>`
  - the default branch type for one bounded implementation or investigation
  - should squash cleanly into one coherent change
- `alpha/<topic>`
  - reserved for launch-critical public-story, proof, or closeout work
  - use when the branch directly affects current external positioning
- `post-alpha/<topic>`
  - for shaping work, exploration, broader bets, or work that should not quietly expand the current launch bar

Do not create a branch just because an idea is interesting.
Create a branch when the work has a bounded outcome and may produce commits.

## Stay Or Split

Stay on the current branch when:

- the task is the same outcome already in flight
- the write scope is still in the same subsystem and launch classification
- the result would still squash into the same branch summary

Cut a new branch when:

- the goal changes
- the launch classification changes
- the risk class changes from low-risk docs or notes into engine, proof, generator, or maintained-app work
- the work becomes exploratory and may be parked
- you want the option to drop or shelve the work cleanly

Blunt rule:

- if the branch cannot be named in one sentence, the work is too mixed

## One Branch, One Outcome

One branch may touch many files, but it should represent one coherent outcome such as:

- one proof improvement
- one workflow/operator improvement
- one engine capability
- one brownfield rehearsal improvement
- one launch-story cleanup

Avoid mixing:

- alpha-story cleanup with post-alpha shaping
- engine behavior changes with unrelated docs cleanup
- public claim changes with speculative product expansion
- proof hardening with random backlog gardening

## Commit And Merge Style

Default to:

- a few working commits locally
- one coherent squash before merge or push

Commit messages should read like product intent, not terminal history.

Preferred branch outcomes:

- `Harden brownfield rehearsal for deterministic demo`
- `Tighten maintained proof guidance for cross-surface drift`
- `Lock shared workflow rules and operator handbook`

Do not preserve messy exploratory commit chains unless the intermediate steps matter historically.

## Risk-Based Gates

### Low-risk work

Examples:

- local-only operator notes in `.ops/`
- wording cleanup that does not change claims
- planning notes that are not source of truth

Rules:

- can stay lightweight
- no special branch needed if already on the correct task branch
- no full verification required

### Medium-risk work

Examples:

- docs that shape operator behavior
- maintained proof docs
- workflow guidance
- brownfield rehearsal docs or scripts

Rules:

- use a task branch
- run the smallest relevant verification path
- check that docs still match live commands

### High-risk work

Examples:

- engine semantics
- canonical Topogram meaning
- generated artifact expectations
- maintained proof behavior
- public claim boundary
- anything touching launch story in `README.md` or proof-limit docs

Rules:

- always use a dedicated branch
- do not mix with unrelated cleanup
- run targeted verification before considering merge
- explicitly check:
  - `README.md`
  - `docs/proof-points-and-limits.md`
  - current launch tracker and launch plan docs

## Daily Loop

For most tasks, follow this order:

1. classify the task as `alpha-critical`, `can-slip`, or `post-alpha`
2. confirm the write scope:
   - engine
   - canonical example
   - generated outputs
   - maintained app
   - tracked docs
   - local-only ops notes
3. decide whether to stay on the branch or cut a new one
4. do the work
5. run the smallest correct proof or check set
6. decide disposition:
   - merge soon
   - keep iterating
   - park

## Parking Rule

If work is useful but not ready:

- keep it on its branch
- write a short handoff note under `.ops/branches/<branch-name>.md`

Each handoff note should state:

- intent
- current state
- blockers
- next recommended step
- whether the branch is still worth reviving

Do not leave mystery branches around.

## Public-Branch Hygiene

Before merging anything that affects external understanding, ask:

- does this sharpen the wedge or blur it?
- does this narrow the path or broaden promises?
- does this make the live proof easier to run?
- does this belong to the current launch bar?

If not, it belongs on `post-alpha/*`, not the active launch path.

## Local-Only `.ops/` Handbook

Use `.ops/` as durable local-only operator memory.

Recommended structure:

- `.ops/README.md`
- `.ops/workflow-rules.md`
- `.ops/branches/`
- `.ops/launch-notes/`
- `.ops/parking-lot.md`

Use it for:

- branch handoff notes
- launch rehearsal notes
- operator checklists
- "next session" memory
- private triage and parking-lot items

Do not leave these only in `.ops/`:

- public claim boundaries
- canonical workflow rules for users
- source-of-truth product decisions
- anything another collaborator would need in origin to work correctly

If it affects the public repo or shared semantics, it must graduate into tracked docs.

## Acceptance Signals

The workflow is working when:

- a new task can be classified in under two minutes
- it is obvious whether to stay on the branch or cut a new one
- parked branches always have a local handoff note
- `main` stays cleaner than the working branches
- alpha-critical changes do not quietly ship with post-alpha ideas attached
- most finished branches squash into one clear merge unit
- we can explain why a branch exists and whether it should still live

## Defaults

- workflow strictness is moderate, not policy-heavy
- merge style is squash-by-branch by default
- the existing branch taxonomy is worth formalizing, not replacing
- `.ops/` is the durable local-only operator folder
- this workflow currently governs maintainer plus Codex collaboration, not the full external contributor model
