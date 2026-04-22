# Visual Explanation Path

This page collects the first doc-native visual package for Topogram's alpha story.

It is optimized for skeptical evaluators. The goal is not brand polish. The goal is to make the current wedge, proof surfaces, and claim boundary easier to understand quickly.

For the polished launch-facing variants of the three highest-value diagrams, see:

- [docs/assets/launch-graphics/hero-wedge.svg](/Users/attebury/Documents/topogram/docs/assets/launch-graphics/hero-wedge.svg)
- [docs/assets/launch-graphics/change-boundary.svg](/Users/attebury/Documents/topogram/docs/assets/launch-graphics/change-boundary.svg)
- [docs/assets/launch-graphics/brownfield-reconcile-flow.svg](/Users/attebury/Documents/topogram/docs/assets/launch-graphics/brownfield-reconcile-flow.svg)
- [visual-style-notes.md](/Users/attebury/Documents/topogram/docs/visual-style-notes.md)

## 1. Hero Wedge

```mermaid
flowchart LR
  A["Durable intent<br/>entities, workflows, rules"] --> B["Generated outputs<br/>contracts, runtimes, artifacts"]
  B --> C["Verification<br/>compile, smoke, runtime-check"]
  C --> D["Safer change in real software<br/>structured, explainable, provable"]
  D --> E["Controlled software evolution<br/>for humans and agents"]
```

Primary home:
- [README.md](/Users/attebury/Documents/topogram/README.md)

## 2. Human / Agent / Engine Boundary

```mermaid
flowchart LR
  subgraph H["Humans"]
    H1["Own durable intent"]
    H2["Approve adoption decisions"]
    H3["Keep final product judgment"]
  end
  subgraph A["Agents"]
    A1["Gather scoped context"]
    A2["Propose changes"]
    A3["Prepare review material"]
  end
  subgraph E["Engine"]
    E1["Realize contracts"]
    E2["Generate artifacts and apps"]
    E3["Attach verification and proof"]
  end
  H --> A
  A --> E
  E --> H
```

Primary home:
- [README.md](/Users/attebury/Documents/topogram/README.md)

## 3. Safe / Guarded / No-Go Boundary

```mermaid
flowchart LR
  S["Safe<br/>Issue ownership visibility<br/>Mirror emitted behavior directly"] --> G["Guarded<br/>Content Approval workflow decision<br/>Human judgment still owns UX treatment"]
  G --> N["No-go<br/>Unsupported or drifting maintained surface<br/>Stop clearly instead of over-automating"]
```

Primary homes:
- [docs/evaluator-path.md](/Users/attebury/Documents/topogram/docs/evaluator-path.md)
- [product/app/proof/edit-existing-app.md](/Users/attebury/Documents/topogram/product/app/proof/edit-existing-app.md)

## 4. Brownfield Reconcile Flow

```mermaid
flowchart LR
  I["Import<br/>app and docs evidence"] --> R["Reconcile<br/>candidate bundles and review surfaces"]
  R --> G{"Review gate<br/>approve bundle and projection groups"}
  G --> A["Adopt<br/>selective canonical promotion"]
  A --> C["Canonical Topogram<br/>durable model surfaces"]
  R -.-> J["Journey drafts<br/>review-required"]
  R -.-> H["Auth hints<br/>permission, claim, ownership"]
```

Primary home:
- [docs/brownfield-import-roadmap.md](/Users/attebury/Documents/topogram/docs/brownfield-import-roadmap.md)

## 5. Proof Surface Map

```mermaid
flowchart LR
  G["Generated examples<br/>shared intent to contracts and apps"] --> M["Maintained-app proof<br/>safe, guarded, no-go boundaries"]
  G --> B["Brownfield proof<br/>import, reconcile, adopt"]
  G --> P["Parity proof<br/>repeatability across targets"]
  P --> C["Contract audit<br/>human-auditable emitted seams"]
  M --> L["Proof points and limits<br/>current public claim boundary"]
  B --> L
  C --> L
```

Primary homes:
- [docs/evaluator-path.md](/Users/attebury/Documents/topogram/docs/evaluator-path.md)
- [docs/proof-points-and-limits.md](/Users/attebury/Documents/topogram/docs/proof-points-and-limits.md)

## 6. Parity Proof Matrix

```mermaid
flowchart TB
  subgraph Domains["Parity matrix"]
    I["issues<br/>web parity<br/>backend parity<br/>auditor path"]
    C["content-approval<br/>web parity<br/>backend parity"]
    T["todo<br/>web parity<br/>backend parity"]
  end
```

Primary home:
- [docs/proof-points-and-limits.md](/Users/attebury/Documents/topogram/docs/proof-points-and-limits.md)

## 7. Alpha Boundary

```mermaid
flowchart LR
  P["Proven now<br/>maintained-app proof<br/>brownfield proof<br/>parity and contract audit<br/>alpha auth boundary"] --> Q["Partially proven<br/>broader domain generality<br/>more target diversity<br/>independent trust beyond generated checks"]
  Q --> R["Not claimed yet<br/>production auth<br/>broad deployment hardening<br/>universal domain coverage<br/>unlimited automation"]
```

Primary home:
- [docs/proof-points-and-limits.md](/Users/attebury/Documents/topogram/docs/proof-points-and-limits.md)
