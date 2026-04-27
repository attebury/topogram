# Parity Proof Matrix

## Canonical UI projection IDs

Shipped UI surfaces use a **family `__` stack** pattern so ids stay parallel across browsers and native clients:

| Layer | Pattern | Examples |
| --- | --- | --- |
| Shared semantics (no routes) | `proj_ui_shared` | Screens and capabilities only |
| Web | `proj_ui_web__{stack}` | `proj_ui_web__sveltekit`, `proj_ui_web__react` |
| Native (future) | `proj_ui_native__{platform}` | `proj_ui_native__ios`, `proj_ui_native__android` |

The delimiter is **double underscore** (`__`): **family** before it, **stack or platform** after. Use **`native`** (not `mobile`) for the non-web family so names stay valid for desktop-native targets later.

---

This is the compact inventory for Topogram's current parity proofs.

It answers four questions quickly:

1. which domain is being used?
2. which semantic seam is being compared?
3. which targets are involved?
4. what is still only partially proven?

## Current Proven Parity

| Domain | Seam | Targets | Proof Surface | Status |
| --- | --- | --- | --- | --- |
| `issues` | UI contract parity | React `proj_ui_web__react` and SvelteKit `proj_ui_web__sveltekit` | [multi-target-proof-issues.md](./multi-target-proof-issues.md), [issues-parity-evaluator-path.md](./issues-parity-evaluator-path.md) | Proven now |
| `issues` | Backend runtime parity | Hono `hono-server` and Express `express-server` | [multi-runtime-proof-issues.md](./multi-runtime-proof-issues.md), [issues-parity-evaluator-path.md](./issues-parity-evaluator-path.md) | Proven now |
| `content-approval` | UI contract parity | React `proj_ui_web__react` and SvelteKit `proj_ui_web__sveltekit` | [multi-target-proof-content-approval.md](./multi-target-proof-content-approval.md) | Proven now |
| `content-approval` | Backend runtime parity | Hono `hono-server` and Express `express-server` | [multi-runtime-proof-content-approval.md](./multi-runtime-proof-content-approval.md) | Proven now |
| `todo` | UI contract parity | React `proj_ui_web__react` and SvelteKit `proj_ui_web__sveltekit` | [multi-target-proof-todo.md](./multi-target-proof-todo.md) | Proven now |
| `todo` | Backend runtime parity | Hono `hono-server` and Express `express-server` | [multi-runtime-proof-todo.md](./multi-runtime-proof-todo.md) | Proven now |

## What Is Still Only Partially Proven

These proofs are meaningful, but they do not yet justify a broad parity claim across the whole system.

Still only partially proven:

- parity across more backend/runtime targets than the current Hono and Express pair
- parity across more frontend targets than the current React and SvelteKit proofs
- parity for every workflow shape or auth combination
- independence beyond the generated contract seams and generated regression suite

## Best Current Evaluator Path

For the fastest parity review:

1. start with [parity-evaluator-path.md](./parity-evaluator-path.md)
2. use [issues-parity-evaluator-path.md](./issues-parity-evaluator-path.md) as the deepest single-domain walkthrough
3. read [multi-target-proof-content-approval.md](./multi-target-proof-content-approval.md)
4. read [multi-runtime-proof-content-approval.md](./multi-runtime-proof-content-approval.md)
5. read [multi-target-proof-todo.md](./multi-target-proof-todo.md)
6. read [multi-runtime-proof-todo.md](./multi-runtime-proof-todo.md)

That gives the evaluator one compact repo-level parity path plus the per-domain notes showing repeatability across all three domains.

## Clearest Next Gap

The clearest next trust-building step after this matrix is:

- one more parity proof in a different seam, target pair, or domain shape beyond the current React/SvelteKit and Hono/Express coverage

The repo now has:

- web parity across three domains
- backend parity across three domains

The next step should deepen diversity rather than just raise the count.
