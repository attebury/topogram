# Shared Topogram Security Plan

This note captures the main security concerns and operating principles for sharing and importing Topograms, especially once Topogram supports reusable package-style import flows.

## Summary

Shared Topograms should be treated as untrusted semantic imports by default.

They are not only code-adjacent assets. They can carry reusable product meaning:

- entities
- workflows
- rules
- auth assumptions
- UI semantics
- verification expectations

That makes them closer to a semantic supply chain than a normal library dependency.

The default security model should be:

- inspect
- stage
- map
- customize
- adopt selectively

not:

- trust
- import
- merge directly into canonical meaning

## Main risk categories

### 1. Semantic supply-chain risk

A shared Topogram can encode unsafe or misleading meaning even when it contains no executable code.

Examples:

- overly broad auth assumptions
- incorrect workflow semantics
- dangerous data relationships
- misleading `recommended` defaults
- UI guidance that pushes a consuming workspace toward the wrong behavior

This is a different kind of risk from code injection. It is a meaning and policy risk.

### 2. Provenance and authenticity risk

A consuming team needs to know:

- who published the package
- what exact version they are inspecting
- whether the package was changed since last review
- whether proof artifacts correspond to that exact version

Without provenance, shared Topograms become vulnerable to dependency-confusion-style trust failures.

### 3. Over-adoption risk

A package may be well-intentioned but too invasive if it is adopted too broadly.

The key failure mode is:

- importing a package
- accepting large semantic surfaces wholesale
- accidentally promoting foreign product meaning into local canonical surfaces

This is especially risky for:

- auth modeling
- workflows
- rules
- visibility and ownership semantics
- maintained-app boundaries

### 4. Agent trust amplification

Agents may over-trust a shared Topogram as if it were already approved just because it looks structured and machine-readable.

That can improperly influence:

- recommendations
- mapping suggestions
- code generation
- maintained-app edits
- import decisions

The system should prevent “agent can read it” from meaning “workspace has trusted it.”

### 5. Sensitive information leakage

Not every Topogram should be shareable as-is.

A shared package may unintentionally expose:

- internal workflow details
- role and auth models
- entity structure
- operational assumptions
- roadmap or decision context

That means exportable Topogram packages should support explicit sharing boundaries instead of assuming the whole workspace is safe to publish.

## Recommended security model

### 1. Default untrusted import

Imported Topograms should always land in candidate space first.

They should never become canonical source of truth by default.

That is already consistent with Topogram's current `propose -> review -> adopt` direction.

### 2. Selective adoption, never blind adoption

A consuming workspace should be able to:

- accept
- map
- customize
- stage
- reject

for each imported surface or bundle.

Whole-package blind adoption should not be the default or recommended path.

### 3. Strong provenance metadata

Each imported package or surface should preserve:

- source repo or registry identity
- package name
- version or tag
- commit or immutable source revision
- import timestamp
- source path within the package

This provenance should remain attached through refresh and re-adoption flows.

### 4. Diff-first refresh

Refreshing a previously imported Topogram should require semantic diffs before re-adoption.

The consuming team should be able to answer:

- what changed
- what local concepts would be affected
- whether the change is additive, conflicting, or risky

Refresh should not silently rewrite canonical surfaces.

### 5. Export controls and recommended exports

Shareable Topograms should support explicit export boundaries.

The package manifest should eventually distinguish between:

- recommended exports
- required dependencies
- local-only surfaces
- review-sensitive surfaces

This prevents accidental exposure and helps the consuming team inspect a package without inheriting the entire source workspace.

### 6. Proof binding

If a package claims proof or verification, that proof should be tied to the exact version being shared.

A consuming team should not have to guess whether:

- the proof matches the current package contents
- the proof came from an earlier revision
- the proof covered only a subset of exported semantics

### 7. Local policy gates

Hosted metadata, MCP lookups, or registry tooling should help local policy enforcement, not replace it.

A consuming workspace should be able to declare policies such as:

- allow import of entities and workflows, but not auth rules
- allow package suggestions, but not direct canonical adoption
- allow UI semantics, but require manual review for maintained-app boundaries

### 8. Review-class escalation for sensitive surfaces

Some imported surfaces should always default to a stronger review class.

At minimum:

- auth rules
- permission and claim semantics
- ownership behavior
- workflows
- rules
- maintained-app seams
- imported package mappings and customization decisions

These should remain explicitly human-reviewed even if lower-risk surfaces can be adopted more easily.

## Implications for shared Topogram packages

The package-sharing roadmap should assume that Topogram packages are a governed semantic supply chain.

That means:

- packages are discoverable and inspectable
- imports land as candidates first
- adoption remains local and selective
- provenance is preserved
- refresh is diff-driven
- proof is version-bound

The package system should optimize for safe reuse of meaning, not only convenient transfer of files.

## Implications for `ui_patterns`

If `ui_patterns` become shareable, the same rules should apply.

Imported `ui_patterns` should transfer:

- semantic composition
- recommendation metadata
- target refinements

but not force adoption of framework-specific implementation components.

This helps prevent imported UI guidance from becoming an implicit trusted implementation dependency.

## Near-term recommendations

Before building shareable Topogram import flows broadly, prioritize:

- provenance metadata design
- export boundary design
- review-class defaults for imported surfaces
- semantic diff support for package refresh
- policy hooks for local import restrictions

## Working rule

Treat shared Topograms as reusable meaning with security implications, not as harmless documentation bundles.

If the system cannot answer:

- where this meaning came from
- what changed
- what local meaning it would affect
- who approved it

then the package should not be treated as trusted or directly adoptable.
