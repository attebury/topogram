# Roadmap

## Public Alpha Launch

Topogram's first public launch should be an invite-led public alpha for technical early adopters. The launch should center on human and agent collaboration around durable product and architecture models, then use brownfield import and existing-app edits as supporting proof points rather than the primary story.

### Launch narrative

- public alpha, not broad production-ready release
- invite-led, with clear design-partner and early-adopter framing
- primary audience: technical early adopters and devtools builders
- primary story: model-centered human/agent collaboration that drives contracts, apps, and verification
- supporting proof points: brownfield import/reconcile and safe edits to hand-maintained apps

### Launch workstreams

- rewrite the public README and add launch-oriented docs
- define one canonical quickstart and one canonical demo path
- publish a public proof-points and limits page grounded in current examples and verification
- keep launch claims disciplined around auth, deployment, and production readiness
- foreground controlled software evolution as the first wedge, with brownfield recovery and existing-app evolution as the primary proof-backed entry points
- keep the alpha metrics set defined, but defer instrumentation and the recurring measurement loop until the evaluator path and seam-aware demo path are stable enough to measure consistently
- define good-fit design partners as teams comfortable with early infrastructure, technical builders working with agents, and teams interested in domain/workflow modeling, codegen, brownfield recovery, or controlled app evolution
- provide a clear invite/contact path for interested users

### Launch gate

- README and docs tell one coherent public story
- one demo has been rehearsed end to end
- proof-points and limits page is published
- invite/contact path is live
- CI is green on the existing fast and deeper verification workflows

This alpha launch should not claim production auth readiness or general production hardening. Those remain part of the deeper product roadmap below.
The broader generality claim should also stay narrow until the next trust-building proof target lands: one multi-target example that proves the same domain can run cleanly across more than one web/runtime combination.

## After v0.1

Priority candidates for the next phase:

1. Runtime hardening
- verify the generated app bundle against a documented runnable environment
- add richer runtime checks beyond compile and smoke verification
- add cross-platform browser verification for generated web apps, likely via Playwright-backed runtime-check bundles rather than per-example handwritten tests
- start narrow with browser-visible text, hidden-text, click, fill, submit, and URL assertions
- re-implement the current local Safari-backed `issues` and `todo` visibility proofs on the cross-platform path before expanding into richer UI flows
- keep browser verification generator-owned so it stays part of the artifact story, not just example-specific test drift

2. Auth implementation profiles
- move from auth semantics to generated auth integration hooks and examples

3. Richer business logic hooks
- allow structured generated extension points without forking the whole scaffold
- continue making Topograms more agent-legible as durable intent, while keeping the engine as the canonical realization and verification path

4. Additional UI targets
- iOS, Android, desktop, and other platform realizations on top of shared UI semantics
- before broadening targets further, consider adding a semantic `ui_patterns` layer between UI contracts and target renderers; see [../docs/ui-patterns-plan.md](../docs/ui-patterns-plan.md)

5. More persistence/runtime options
- deepen Drizzle parity
- add stronger deployment/runtime packaging

6. Broader reference domains
- validate the model on domains beyond Todo

7. Shareable Topogram packages
- explore git-backed Topogram packages as reusable semantic modules, not only whole apps
- define a package manifest with `recommended exports` for likely reusable surfaces and `requirements` for dependent entities, enums, shapes, and other needed model pieces
- support first-class `import topogram` flows so consuming teams can inspect any open Topogram before adoption instead of merging blindly
- generalize this into a provider integration model where providers can publish package exports, runtime or deploy profiles, and connector modules through one candidate-first, metadata-first manifest model; see [../docs/provider-integration-plan.md](../docs/provider-integration-plan.md)
- evolve toward a registry model where:
  - humans discover and evaluate packages through a readable site such as `topograms.dev`
  - agents query the same package metadata through an MCP server
  - both surfaces share one underlying package, provenance, proof, and compatibility model
- keep the consuming team in control of reuse decisions:
  - recommended exports should guide import, not force it
  - imported surfaces should land as candidates first
  - consuming teams should be able to accept, map, customize, stage, or reject imported surfaces
- allow selective adoption and mapping:
  - direct adopt or customize behavior for reusable capabilities, rules, workflows, docs, and verifications
  - accept, map, customize, stage, or reject behavior for entities and other dependent model surfaces
- preserve provenance and version metadata so imported semantics can be refreshed safely over time
- use hosted metadata and MCP queries to make team-local policy enforcement easier, not to replace local review boundaries or CI gates
- start with git transport and selective local adoption, not a full registry

8. Token efficiency and context serving
- make Topogram better at serving the smallest correct slice of intent for a given task, rather than forcing agents to reload whole workspaces
- generate compact machine digests for domains, workflows, capabilities, projections, and maintained-app boundaries alongside fuller human-readable docs
- add semantic diffs and change-impact digests so agents can work from deltas instead of re-reading the full system after every change
- support scoped retrieval by capability, workflow, entity, projection, or maintained-app surface, including dependency-closure views for each requested slice
- emit task-oriented context bundles such as UI, API, DB, maintained-app, brownfield-import, and package-import views
- separate human-facing docs from agent-facing structured artifacts where the latter can reduce ambiguity and token waste
- measure context size explicitly so Topogram can compare raw-repo context against Topogram-served digests and bundles over time

9. Long-lived knowledge surfaces
- promote canonical `journey` docs under `topogram/docs/journeys/` as the next user-goal-first reference artifact
- keep the durable core intentionally small around journeys, glossary, workflows, rules, decisions, and reports
- continue researching optional or transient artifacts such as use-cases, change-impact notes, assumptions, and migration risk tracking before promoting any of them
- explore whether journeys should eventually adopt a hybrid structure:
  - keep Markdown as the primary human-readable narrative surface
  - add a stronger structured metadata layer, either embedded or `.tg`-backed, when journeys need deeper validation, semantic diffing, or generator-visible behavior
- avoid rushing journeys into pure `.tg` until there is clear pressure for machine-owned structure beyond the current narrative-and-linking role

10. Human/agent collaboration model
- make the collaboration layers explicit:
  - humans own durable intent and final approval boundaries
  - agents work from scoped context, candidate imports, adoption plans, and generated digests rather than mutating canonical surfaces blindly
  - the engine remains the canonical realization and proof path for contracts, generated apps, verification, diffs, and context bundles
  - maintained application code remains human-owned by default, with agents allowed to propose and edit it only inside explicit maintained-app boundaries
- define a clearer file and folder model that distinguishes:
  - canonical human-authored Topogram surfaces
  - candidate and draft surfaces proposed by imports, reconcile, or agents
  - generated engine-owned artifacts and proof outputs
  - maintained human-owned application code that may consume generated artifacts but is not generator-owned
- keep the default workflow as `propose -> review -> adopt` for agent-assisted model changes, import reuse, and maintained-app boundary updates
- make human review boundaries explicit wherever local meaning changes:
  - entities and relations
  - workflows and journeys
  - projections
  - maintained-app seams
  - maintained code ownership and hand-maintained behavior
  - imported package mappings and customization decisions

11. Alpha metrics instrumentation
- turn the defined alpha metrics into a lightweight recurring measurement loop once the demo path and proof spine are stable enough to measure consistently
- start with manual operator capture around evaluator sessions, demo runs, seam-aware maintained proof, and staged import/adopt demos
- add only low-overhead repo-backed checks first, such as proof freshness and deterministic fixture/demo health

11. Agent operating ergonomics
- add explicit agent task modes such as:
  - modeling
  - maintained-app edit
  - import/adopt
  - diff review
  - verification
- keep the workflow grammar machine-readable and Topogram-defined, then layer provider/team workflow presets on top of it rather than making tool-specific adapters the primary integration contract
- add machine-readable write-scope contracts so agents can tell:
  - what files are safe to edit
  - what files are generator-owned
  - what files are human-owned and review-required
  - what files are out of bounds
- add verification targeting so agents can ask for the smallest correct proof/check set for the current change instead of rerunning the whole workspace blindly
- keep these surfaces advisory and explainable first, then decide later whether any of them should become enforceable policy hooks
- expose the same operating model through local artifacts first, then future MCP/query tools
