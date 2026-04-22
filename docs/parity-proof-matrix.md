# Parity Proof Matrix

This is the compact inventory for Topogram's current parity proofs.

It answers four questions quickly:

1. which domain is being used?
2. which semantic seam is being compared?
3. which targets are involved?
4. what is still only partially proven?

## Current Proven Parity

| Domain | Seam | Targets | Proof Surface | Status |
| --- | --- | --- | --- | --- |
| `issues` | UI contract parity | React `proj_ui_web` and SvelteKit `proj_ui_web_sveltekit` | [multi-target-proof-issues.md](/Users/attebury/Documents/topogram/docs/multi-target-proof-issues.md), [issues-parity-evaluator-path.md](/Users/attebury/Documents/topogram/docs/issues-parity-evaluator-path.md) | Proven now |
| `issues` | Backend runtime parity | Hono `hono-server` and Express `express-server` | [multi-runtime-proof-issues.md](/Users/attebury/Documents/topogram/docs/multi-runtime-proof-issues.md), [issues-parity-evaluator-path.md](/Users/attebury/Documents/topogram/docs/issues-parity-evaluator-path.md) | Proven now |
| `content-approval` | UI contract parity | React `proj_ui_web` and SvelteKit `proj_ui_web_sveltekit` | [multi-target-proof-content-approval.md](/Users/attebury/Documents/topogram/docs/multi-target-proof-content-approval.md) | Proven now |
| `content-approval` | Backend runtime parity | Hono `hono-server` and Express `express-server` | [multi-runtime-proof-content-approval.md](/Users/attebury/Documents/topogram/docs/multi-runtime-proof-content-approval.md) | Proven now |
| `todo` | UI contract parity | React `proj_ui_web_react` and SvelteKit `proj_ui_web` | [multi-target-proof-todo.md](/Users/attebury/Documents/topogram/docs/multi-target-proof-todo.md) | Proven now |
| `todo` | Backend runtime parity | Hono `hono-server` and Express `express-server` | [multi-runtime-proof-todo.md](/Users/attebury/Documents/topogram/docs/multi-runtime-proof-todo.md) | Proven now |

## What Is Still Only Partially Proven

These proofs are meaningful, but they do not yet justify a broad parity claim across the whole system.

Still only partially proven:

- parity across more backend/runtime targets than the current Hono and Express pair
- parity across more frontend targets than the current React and SvelteKit proofs
- parity for every workflow shape or auth combination
- independence beyond the generated contract seams and generated regression suite

## Best Current Evaluator Path

For the fastest parity review:

1. start with [parity-evaluator-path.md](/Users/attebury/Documents/topogram/docs/parity-evaluator-path.md)
2. use [issues-parity-evaluator-path.md](/Users/attebury/Documents/topogram/docs/issues-parity-evaluator-path.md) as the deepest single-domain walkthrough
3. read [multi-target-proof-content-approval.md](/Users/attebury/Documents/topogram/docs/multi-target-proof-content-approval.md)
4. read [multi-runtime-proof-content-approval.md](/Users/attebury/Documents/topogram/docs/multi-runtime-proof-content-approval.md)
5. read [multi-target-proof-todo.md](/Users/attebury/Documents/topogram/docs/multi-target-proof-todo.md)
6. read [multi-runtime-proof-todo.md](/Users/attebury/Documents/topogram/docs/multi-runtime-proof-todo.md)

That gives the evaluator one compact repo-level parity path plus the per-domain notes showing repeatability across all three domains.

## Clearest Next Gap

The clearest next trust-building step after this matrix is:

- one more parity proof in a different seam, target pair, or domain shape beyond the current React/SvelteKit and Hono/Express coverage

The repo now has:

- web parity across three domains
- backend parity across three domains

The next step should deepen diversity rather than just raise the count.
