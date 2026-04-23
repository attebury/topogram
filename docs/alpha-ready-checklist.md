# Alpha-Ready Checklist

This is the compact closeout checklist for Topogram's current invite-led alpha.

It is not a roadmap. It is the shortest answer to:

- what is done enough to support the alpha claim?
- what is explicitly outside scope?

## Core Story

- [x] README states the wedge as controlled software evolution for humans and agents
- [x] [evaluator-path.md](./evaluator-path.md) is the canonical evaluator flow
- [x] [proof-points-and-limits.md](./proof-points-and-limits.md) is the public claim boundary
- [x] [skeptical-evaluator.md](./skeptical-evaluator.md) answers the strongest fair objections

## Proof Surfaces

- [x] maintained-app proof is present and easy to navigate through [examples/maintained/proof-app/proof/edit-existing-app.md](../examples/maintained/proof-app/proof/edit-existing-app.md)
- [x] safe, guarded, and no-go change stories are explicitly documented
- [x] maintained-app proof now names the governed seam, output, emitted dependencies, and review class for the primary safe / guarded / no-go stories
- [x] brownfield breadth is visible in [confirmed-proof-matrix.md](./confirmed-proof-matrix.md)
- [x] generated example proof remains visible through `todo`, `issues`, and `content-approval`

## Verification

- [x] top-level verification entrypoints are documented in [README.md](../README.md)
- [x] verification strategy is documented in [testing-strategy.md](./testing-strategy.md)
- [x] the repo explains the current trust boundary between generated verification and independent trust anchors
- [x] seam-aware maintained queries are documented and demoable through `maintained-boundary`, `maintained-drift`, `maintained-conformance`, and `seam-check`
- [x] one deterministic import/adopt fixture path exists for base and non-empty staged proposal demos through [build-adoption-plan-fixture.mjs](../engine/scripts/build-adoption-plan-fixture.mjs)

Current closeout command set:

- `node ./engine/src/cli.js query maintained-boundary ./examples/generated/content-approval/topogram`
- `node ./engine/src/cli.js query maintained-drift ./examples/generated/content-approval/topogram --from-topogram ./examples/generated/todo/topogram`
- `node ./engine/src/cli.js query seam-check ./examples/generated/content-approval/topogram --from-topogram ./examples/generated/todo/topogram`
- `node ./engine/scripts/build-adoption-plan-fixture.mjs ./engine/tests/fixtures/import/incomplete-topogram/topogram --scenario projection-impact --json`
- `node ./engine/src/cli.js query import-plan <staged_topogram_root>`

Alpha closeout expectation:

- the maintained query sequence still runs exactly as written
- the import/adopt fixture path still produces a non-empty staged proposal demo
- the operator can explain governed seam evidence versus lightweight implementation corroboration without overclaiming deeper maintained-code understanding

## Auth

- [x] signed JWT is the primary alpha auth profile in [auth-profile-bearer-jwt-hs256.md](./auth-profile-bearer-jwt-hs256.md)
- [x] the modeled auth surface is explicit in [auth-modeling.md](./auth-modeling.md)
- [x] auth has a dedicated evaluator path in [auth-evaluator-path.md](./auth-evaluator-path.md)
- [x] auth remains explicitly non-production in [proof-points-and-limits.md](./proof-points-and-limits.md)

## Invite-Led Readiness

- [x] one-sentence fit is stated in [README.md](../README.md)
- [x] design-partner profile is documented in [design-partner-profile.md](./design-partner-profile.md)
- [x] invite/contact path is documented in [invite-led-alpha.md](./invite-led-alpha.md)

## Explicitly Out Of Scope

- [x] production auth readiness
- [x] session or cookie auth
- [x] identity-provider integration
- [x] broad deployment hardening claims
- [x] full domain generality claims
- [x] unlimited maintained-app automation claims

## After Alpha

The first concrete post-alpha trust-building proof is now:

- [multi-target-proof-issues.md](./multi-target-proof-issues.md)
- [parity-proof-matrix.md](./parity-proof-matrix.md)

The clearest next trust-building target after that remains:

- one more backend/runtime parity proof in a second domain
