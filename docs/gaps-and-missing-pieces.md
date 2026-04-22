# Gaps And Missing Pieces

This note captures the major underdefined areas still missing from Topogram's current roadmap and planning set.

The goal is not to expand alpha scope blindly. The goal is to make it easier to distinguish:

- alpha-critical gaps
- post-alpha critical gaps
- longer-term research areas

## Alpha-critical gaps

These are the most important missing pieces if the goal is a disciplined invite-led alpha.

### 1. Success metrics

Topogram has strong proof language, but it still lacks a compact measurement model for alpha.

Important missing questions:

- how will we know whether the evaluator story is working?
- how will we know whether brownfield proof is improving?
- how will we know whether maintained-app guidance is actually legible?

Examples of metrics that should eventually exist:

- time to first useful evaluator understanding
- demo completion rate without off-script rescue
- number of stale or confusing demo artifacts found during rehearsal
- brownfield import quality by repo type
- ratio of safe vs review-required vs manual-decision adoption items

### 2. Maintained-app boundary contract

The philosophy is clear, and most of the operator-facing seam model is now in place.

Important missing questions:

- how should brownfield proposal surfaces infer candidate maintained seam mappings?
- how should those candidate mappings be reviewed without turning them into canonical truth too early?
- how should import/adopt expose seam-aware maintained risk directly from those reviewed candidates?

This is one of the most important trust surfaces in the product.

### 3. Design-partner and feedback loop

The basic invite-led alpha audience and contact path now exist, but the feedback loop is still underdefined.

What is now in place:

- a one-sentence fit in [README.md](/Users/attebury/Documents/topogram/README.md)
- a design-partner profile in [design-partner-profile.md](/Users/attebury/Documents/topogram/docs/design-partner-profile.md)
- a lightweight contact path in [invite-led-alpha.md](/Users/attebury/Documents/topogram/docs/invite-led-alpha.md)

Important missing questions:

- how will design partners be selected?
- how will feedback be captured and normalized?
- how will anecdote be separated from proof-backed improvement?
- what issues count as launch blockers vs post-alpha backlog?

### 4. Launch checklist with ownership

There is now a compact alpha closeout checklist, but not yet an owner-based operational launch tracker.

What is now in place:

- a compact closeout list in [alpha-ready-checklist.md](/Users/attebury/Documents/topogram/docs/alpha-ready-checklist.md)

Important missing questions:

- what exact items must be done before the alpha is considered ready?
- who owns each item?
- what is blocked, in progress, or done?
- what can slip safely?

## Post-alpha critical gaps

These are not required to start alpha, but they matter to the next trust-building stage.

### 5. Shared-package trust and governance model

The security note establishes the right concerns, but the governance mechanics are still open.

Important missing questions:

- what should trusted provenance mean?
- how should authenticity be represented?
- who can approve imported package changes?
- how should semantic revocation or rollback work?
- what policy hooks should teams have by default?

### 6. Package/import user flow

The roadmap describes package capabilities well, but the consuming-team experience is still under-specified.

Important missing questions:

- how does a team discover a shared Topogram?
- how do they inspect exports, proof, and compatibility?
- how do they preview semantic impact?
- how do they map or customize imported surfaces?
- how do they refresh safely later?

This needs to become a real user journey, not only a capability list.

### 7. Independent trust anchors

Topogram is already honest that some verification remains self-referential.

The next-stage gap is a more concrete plan for increasing independent trust.

Important missing questions:

- what independent verification layers come next?
- what should be generator-owned vs independently validated?
- how should browser-visible verification evolve?
- what external or cross-tool trust anchors are realistic?

### 8. Domain expansion strategy

The roadmap says Topogram should validate beyond Todo, but the proof strategy for new domains is still broad.

Important missing questions:

- which domains best pressure the model?
- which domains are strategically valuable, not just available?
- what counts as genuinely new proof vs repetition?

## Longer-term research gaps

These are important, but they should remain explicitly non-blocking for alpha.

### 9. Terminology stabilization

The language is improving, especially with `ui_patterns`, but the broader glossary is still not fully locked.

Important terms that likely need eventual stabilization:

- canonical
- candidate
- adopted
- maintained
- review-required
- package
- import
- mapping
- customization
- proof
- realization

### 10. Semantic diff severity and review classes

Topogram already has some review language, but the future package/import model will likely need a stronger change-severity system.

Important missing questions:

- what kinds of semantic change should escalate review automatically?
- what counts as additive vs conflicting vs risky?
- how should imported auth, workflow, and rule changes be classified?

### 11. Export-safe sharing boundaries

The security note highlights information leakage risk, but the future export model remains open.

Important missing questions:

- what parts of a Topogram should be exportable by default?
- what should stay local-only?
- how should a package manifest express sharing boundaries?

### 12. Recommendation system scope

The `ui_patterns` direction creates a good home for recommendations, but there is still an open scope question.

Important missing questions:

- how much recommendation logic belongs in canonical Topogram?
- what should remain implementation-side?
- how should recommendations interact with imports and local policy?

## Priority order

If these gaps are addressed in priority order, the strongest sequence is:

1. success metrics
2. maintained-app boundary contract, especially brownfield seam inference
3. launch checklist with ownership
4. design-partner and feedback loop
5. shared-package trust and governance model
6. package/import user flow
7. independent trust anchors
8. domain expansion strategy

## Working rule

When a new idea appears, first classify it:

- does it unblock alpha?
- does it strengthen the next trust-building target after alpha?
- or is it still research?

If that classification is unclear, the idea is probably not yet ready to become roadmap-critical.
