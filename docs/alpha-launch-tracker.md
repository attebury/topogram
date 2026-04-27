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
| README and wedge language stay aligned with the alpha claim boundary | `story_owner` | `ready` | yes | no | The public wedge now stays consistent across README, alpha overview, proof limits, and alpha plan: controlled software evolution for humans and agents, with maintained-app plus brownfield recovery/review as the strongest present proof and imported breadth delegated to `topogram-demo` | [README.md](../README.md), [alpha-overview.md](./alpha-overview.md), [proof-points-and-limits.md](./proof-points-and-limits.md), [alpha-plan.md](./alpha-plan.md) |
| Canonical evaluator path matches the live demo path | `story_owner` | `ready` | yes | no | The canonical path now distinguishes the maintained proof gate from the query-backed generated-workspace seam inspection and uses the verified command sequence end to end | [evaluator-path.md](./evaluator-path.md), [demo-path-confirmation-plan.md](./demo-path-confirmation-plan.md) |
| Alpha-facing branches and docs stay claim-disciplined | `story_owner` | `ready` | yes | no | The current rule is present-tense: keep post-alpha shaping work visibly separate from alpha commitments, and check README, proof limits, alpha-ready checklist, and alpha launch tracker before landing any branch that changes public alpha claims | [alpha-launch-and-repo-shaping-plan.md](./alpha-launch-and-repo-shaping-plan.md), [alpha-plan.md](./alpha-plan.md), [development-decisions.md](./development-decisions.md) |
| Maintained-app proof package is the strongest demo stop | `proof_owner` | `ready` | yes | no | Safe, guarded, and no-go stories remain easy to navigate, and the proof package now states the maintained gate plus the generated-workspace query companion explicitly | [examples/maintained/proof-app/proof/edit-existing-app.md](../examples/maintained/proof-app/proof/edit-existing-app.md), [skeptical-evaluator.md](./skeptical-evaluator.md) |
| Seam-aware maintained query sequence still works exactly as documented | `proof_owner` | `ready` | yes | no | `verify-product-app.sh`, `maintained-boundary`, `maintained-drift`, `maintained-conformance`, and `seam-check` now match the documented maintained-proof operator path | [alpha-ready-checklist.md](./alpha-ready-checklist.md), [evaluator-path.md](./evaluator-path.md) |
<<<<<<< HEAD
| Brownfield breadth is inspectable and the import/adopt rehearsal path is stable | `brownfield_owner` | `ready` | yes | no | The local rehearsal path is now locked to `run-brownfield-rehearsal.sh`, `verify-brownfield-rehearsal.sh`, and `verify-agent-planning.sh`, while imported breadth stays delegated to `topogram-demo` | [confirmed-proof-matrix.md](./confirmed-proof-matrix.md), [agent-planning-evaluator-path.md](./agent-planning-evaluator-path.md), [brownfield-import-roadmap.md](./brownfield-import-roadmap.md) |
| Verification story is reproducible and proof limits stay explicit | `verification_owner` | `ready` | yes | no | Top-level verification entrypoints are current, imported-proof freshness drift is actionable, and alpha-facing proof claims are gated on current imported proof status | [testing-strategy.md](./testing-strategy.md), [proof-points-and-limits.md](./proof-points-and-limits.md), [topogram-demo-ops.md](./topogram-demo-ops.md) |
| Auth story remains alpha-complete and narrowly claimed | `story_owner` | `ready` | yes | no | Signed bearer JWT is the alpha auth boundary; avoid production-ready drift | [auth-evaluator-path.md](./auth-evaluator-path.md), [auth-profile-bearer-jwt-hs256.md](./auth-profile-bearer-jwt-hs256.md), [bearer-demo-launch-checklist.md](./bearer-demo-launch-checklist.md) |
| Invite/contact path is live and the right fit is stated consistently | `alpha_ops_owner` | `ready` | yes | no | Keep the lightweight invite path usable and preserve the one-sentence fit | [invite-led-alpha.md](./invite-led-alpha.md), [design-partner-profile.md](./design-partner-profile.md) |
| Design-partner selection and feedback normalization are explicit enough for alpha operations | `alpha_ops_owner` | `ready` | yes | no | Public fit/contact docs stay concise, while tracked operator docs now define triage buckets, scoring, blocker labels, next-step labels, first-call handling, and post-conversation capture on a shared vocabulary | [design-partner-profile.md](./design-partner-profile.md), [invite-led-alpha.md](./invite-led-alpha.md), [alpha-interest-triage-rubric.md](./alpha-interest-triage-rubric.md), [partner-feedback-template.md](./partner-feedback-template.md), [alpha-first-call-guide.md](./alpha-first-call-guide.md) |
| Alpha session logging and weekly measurement loop | `alpha_ops_owner` | `can_slip` | no | yes | Start only after the demo path and proof spine stop changing week to week | [alpha-plan.md](./alpha-plan.md), [alpha-ready-checklist.md](./alpha-ready-checklist.md) |
| Additional parity diversity beyond React/SvelteKit and Hono/Express | `verification_owner` | `can_slip` | no | yes | Good next trust-building work, but not required to start the invite-led alpha | [parity-proof-matrix.md](./parity-proof-matrix.md), [proof-points-and-limits.md](./proof-points-and-limits.md) |
| `ui_patterns`, provider integrations, and broader package reuse flows | `brownfield_owner` | `can_slip` | no | yes | Keep visible as post-alpha shaping work, not launch commitments | [alpha-plan.md](./alpha-plan.md), [alpha-launch-and-repo-shaping-plan.md](./alpha-launch-and-repo-shaping-plan.md) |

## Current Launch Readout

The current docs suggest this alpha launch posture:

| Area | Readout |
| --- | --- |
| Story and claim boundary | ready and consistent across the public alpha surfaces |
| Maintained-app demo stop | strong, but should stay rehearsed and query-backed |
| Brownfield proof | ready for alpha with a stable local rehearsal path in `topogram` and active imported breadth in `topogram-demo` |
| Verification and trust language | ready for alpha while the imported-proof freshness loop stays green |
| Invite/contact readiness | present now |
| Ops tracking and feedback loop | ready for alpha with tracked triage and normalized feedback capture |
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
