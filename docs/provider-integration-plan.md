# Provider Integration Plan

This note captures how Topogram should become easy for provider teams such as Chainguard, AWS, Supabase, or similar platforms to integrate with safely and generically.

## Summary

Topogram should optimize first for `provider teams shipping integrations`, while keeping the consuming-team workflow explicit and governed.

The right generalization is not to special-case cloud vendors. It is to define one reusable provider model with three layers:

- `provider package contract`
- `provider runtime or ops profile contract`
- `provider connector contract`

This allows providers to participate in Topogram as both:

- semantic module publishers
- platform connector publishers

without turning provider integrations into direct canonical mutations or generator forks.

## Core direction

Topogram should treat a provider as a named integration source that can publish any combination of:

- reusable semantic packages
- auth, runtime, deploy, or ops profiles
- import extractors and enrichers
- generator target refinements
- verification defaults and policy guidance
- provider-specific docs and recommendations

The main integration rule should be:

- providers `refine` existing Topogram surfaces
- they do not silently replace Topogram core semantics

That means:

- provider packages export reusable meaning
- provider profiles refine runtime, auth, deploy, and ops outputs
- provider connectors produce evidence, plans, and generated artifacts at the edges

## Recommended provider model

### 1. Provider package contract

This is the shareable semantic/module side.

A provider package should be able to export:

- reusable Topogram bundles
- auth and runtime profiles
- policy templates
- verification templates
- `ui_patterns` recommendations where relevant
- adoption and review guidance

This contract should inherit the existing package/import rules:

- candidate-first import
- selective adopt, map, customize, stage, or reject
- provenance and version binding
- diff-first refresh
- local policy gates

### 2. Provider runtime and ops profile contract

This is the generated environment and deployment side.

Providers should be able to publish reusable profiles such as:

- `deploy_profile`
- `runtime_profile`
- `ops_profile`
- `auth_profile`

These profiles should refine existing Topogram outputs such as:

- deployment plans
- environment plans
- runtime bundles
- auth hooks
- CI and smoke/runtime checks

The key rule is:

- profiles refine realization and ops outputs
- they do not redefine canonical domain meaning

### 3. Provider connector contract

This is the edge-integration side.

Providers should be able to publish connector modules for:

- brownfield extraction
- deployment and env bundle generation
- generator target refinements
- verification recipe generation
- future MCP or catalog metadata

This should align with the current import and generator architecture:

- framework- or provider-specific logic at the edges
- shared candidate model in the middle
- shared reconcile and adoption flow downstream

## Provider manifest direction

Topogram should eventually define a provider manifest that can be inspected before any provider surface is adopted.

Recommended sections:

- `provider`
- `compatibility`
- `exports`
- `connectors`
- `requirements`
- `review_defaults`
- `verification_defaults`
- `trust`

This manifest should describe:

- who published the provider integration
- what it exports
- what it expects from the consuming workspace
- which surfaces are review-sensitive
- which verification defaults come with it
- what proof and provenance bind to that version

## Trust and governance

Provider integrations should follow the same trust model as shared Topograms.

That means:

- imported provider surfaces land in candidate space first
- provenance is preserved
- refresh is diff-first
- adoption stays selective and local
- policy gates can block sensitive provider surfaces
- auth, deployment, ownership, maintained-boundary, and environment assumptions default to stronger review classes

Provider integrations should look official and inspectable, not implicitly trusted.

## Consuming-team workflow

The intended consuming-team path should be:

1. discover provider manifest or package
2. inspect provenance, compatibility, exports, and proof
3. import into candidate space
4. review provider surfaces by category
5. adopt, map, or customize selected surfaces
6. generate or refine outputs where appropriate
7. run provider-recommended verification
8. refresh later through diff-first re-import

This should work the same way whether the provider is:

- a cloud platform
- a security platform
- an internal platform team
- a runtime or deployment provider

## Initial supported provider surfaces

For the first implementation pass, keep the surface narrow and compatible with the current roadmap.

Prioritize:

- auth profiles
- runtime profiles
- deployment and env plans
- verification templates
- brownfield import connectors
- generator target refinements
- shareable semantic packages

Do not start with:

- live registry automation
- provider-owned canonical domain modeling
- direct production deployment claims
- provider-specific agent execution policy

## Phased rollout

### Phase 1

- define provider manifest and metadata shape
- classify provider packages, profiles, and connectors
- document candidate-first import behavior for provider integrations

### Phase 2

- add provider connector registration
- add generator and deploy/runtime refinement hooks
- add provider verification routing
- prove one provider-style example path in repo docs

### Phase 3

- add catalog or registry discovery
- add MCP-facing provider metadata lookup
- expand compatibility and proof browsing

This should follow the repo's current rule:

- local artifacts first
- hosted discovery later

## Working rule

Treat providers as generalized publishers and refiners, not as privileged replacements for Topogram core semantics.

The integration verbs should be:

- export
- recommend
- refine
- map
- customize
- verify

Avoid making provider integrations behave like:

- hidden generator forks
- whole-workspace overlays
- silent canonical mutation
