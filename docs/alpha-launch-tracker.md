# Alpha Launch Tracker

This note turns the compact [alpha-ready-checklist.md](./alpha-ready-checklist.md) into an owner-based operating tracker for the invite-led alpha.

It should answer four practical questions:

1. what still needs explicit owner attention?
2. who is responsible for each launch-facing area?
3. what is currently blocked, in progress, or ready?
4. what can slip without changing the alpha claim?

This is intentionally lightweight.
It is not a project-management system.
It is the smallest launch board that makes alpha closeout legible.

## Status Vocabulary

Use these statuses:

- `ready`
- `in_progress`
- `blocked`
- `not_started`
- `can_slip`

## Owner Roles

Use role owners first, even if one person currently fills several roles.

| Owner role | Scope |
| --- | --- |
| `story_owner` | Public wedge, README, evaluator path, proof narrative consistency |
| `proof_owner` | Maintained-app proof package, boundary stories, proof navigation |
| `brownfield_owner` | Confirmed proof matrix, import/adopt rehearsal path, brownfield docs |
| `verification_owner` | Verification scripts, testing story, proof freshness, demo command health |
| `alpha_ops_owner` | Invite flow, design-partner handling, launch readiness, follow-up loop |

## Launch Board

| Item | Owner | Status | Launch-critical | Can slip | Current expectation | Main refs |
| --- | --- | --- | --- | --- | --- | --- |
| README and wedge language stay aligned with the alpha claim boundary | `story_owner` | `in_progress` | yes | no | Keep the public story short, coherent, and consistent with proof limits | [README.md](../README.md), [alpha-plan.md](./alpha-plan.md), [proof-points-and-limits.md](./proof-points-and-limits.md) |
| Canonical evaluator path matches the live demo path | `story_owner` | `in_progress` | yes | no | Rehearse the exact sequence in [evaluator-path.md](./evaluator-path.md) and keep links and command order clean | [evaluator-path.md](./evaluator-path.md), [demo-path-confirmation-plan.md](./demo-path-confirmation-plan.md) |
| Launch branch contains only alpha-critical work and a deliberate pre-push history shape | `story_owner` | `in_progress` | yes | no | Separate parked post-alpha shaping work before first push, then rewrite local history into a small intentional alpha-era sequence | [alpha-launch-and-repo-shaping-plan.md](./alpha-launch-and-repo-shaping-plan.md), [alpha-plan.md](./alpha-plan.md) |
| Maintained-app proof package is the strongest demo stop | `proof_owner` | `in_progress` | yes | no | Safe, guarded, and no-go stories remain easy to navigate and seam-aware | [examples/maintained/proof-app/proof/edit-existing-app.md](../examples/maintained/proof-app/proof/edit-existing-app.md), [skeptical-evaluator.md](./skeptical-evaluator.md) |
| Seam-aware maintained query sequence still works exactly as documented | `proof_owner` | `in_progress` | yes | no | `maintained-boundary`, `maintained-drift`, and `seam-check` stay demoable on the canonical maintained example | [alpha-ready-checklist.md](./alpha-ready-checklist.md), [evaluator-path.md](./evaluator-path.md) |
| Brownfield breadth is inspectable and the import/adopt rehearsal path is stable | `brownfield_owner` | `in_progress` | yes | no | Confirm the proof matrix plus one deterministic staged import-plan demo path | [confirmed-proof-matrix.md](./confirmed-proof-matrix.md), [agent-planning-evaluator-path.md](./agent-planning-evaluator-path.md), [brownfield-import-roadmap.md](./brownfield-import-roadmap.md) |
| Verification story is reproducible and proof limits stay explicit | `verification_owner` | `in_progress` | yes | no | Keep top-level verification entrypoints current and preserve the honest generated-vs-independent trust boundary | [testing-strategy.md](./testing-strategy.md), [proof-points-and-limits.md](./proof-points-and-limits.md) |
| Auth story remains alpha-complete and narrowly claimed | `story_owner` | `ready` | yes | no | Signed bearer JWT is the alpha auth boundary; avoid production-ready drift | [auth-evaluator-path.md](./auth-evaluator-path.md), [auth-profile-bearer-jwt-hs256.md](./auth-profile-bearer-jwt-hs256.md), [bearer-demo-launch-checklist.md](./bearer-demo-launch-checklist.md) |
| Invite/contact path is live and the right fit is stated consistently | `alpha_ops_owner` | `ready` | yes | no | Keep the lightweight invite path usable and preserve the one-sentence fit | [invite-led-alpha.md](./invite-led-alpha.md), [design-partner-profile.md](./design-partner-profile.md) |
| Design-partner selection and feedback normalization are explicit enough for alpha operations | `alpha_ops_owner` | `not_started` | yes | no | Add a lightweight rule for who to invite, how to capture sessions, and what counts as a blocker | [design-partner-profile.md](./design-partner-profile.md), [invite-led-alpha.md](./invite-led-alpha.md) |
| Alpha session logging and weekly measurement loop | `alpha_ops_owner` | `can_slip` | no | yes | Start only after the demo path and proof spine stop changing week to week | [alpha-plan.md](./alpha-plan.md), [alpha-ready-checklist.md](./alpha-ready-checklist.md) |
| Additional parity diversity beyond React/SvelteKit and Hono/Express | `verification_owner` | `can_slip` | no | yes | Good next trust-building work, but not required to start the invite-led alpha | [parity-proof-matrix.md](./parity-proof-matrix.md), [proof-points-and-limits.md](./proof-points-and-limits.md) |
| `ui_patterns`, provider integrations, and broader package reuse flows | `brownfield_owner` | `can_slip` | no | yes | Keep visible as post-alpha shaping work, not launch commitments | [alpha-plan.md](./alpha-plan.md), [alpha-launch-and-repo-shaping-plan.md](./alpha-launch-and-repo-shaping-plan.md) |

## Current Launch Readout

The current docs suggest this alpha launch posture:

| Area | Readout |
| --- | --- |
| Story and claim boundary | close, but still needs active owner review |
| Maintained-app demo stop | strong, but should stay rehearsed and query-backed |
| Brownfield proof | strong enough for alpha, but still needs stable rehearsal |
| Verification and trust language | strong enough for alpha if kept honest and fresh |
| Invite/contact readiness | present now |
| Ops tracking and feedback loop | still under-specified |
| Metrics instrumentation | explicitly deferred |

## Suggested Operating Rhythm

Before treating alpha as externally ready, the owners should be able to answer in one pass:

- what is still launch-critical and not yet `ready`?
- what is blocked?
- what is drifting from the canonical evaluator/demo path?
- what is intentionally deferred and should not quietly become a launch promise?

The tracker is healthy when:

- every launch-critical row has one owner
- every launch-critical row is either `ready` or has one concrete blocker
- every non-critical row that is deferred is explicitly marked `can_slip`
- the tracker stays consistent with [alpha-plan.md](./alpha-plan.md) and [alpha-ready-checklist.md](./alpha-ready-checklist.md)
