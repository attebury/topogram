# Generic Chainguard Provider Example

This is an illustrative example of what a generic Chainguard provider integration could look like in Topogram.

It is intentionally not treated as a live engine feature yet. The goal is to make the provider model concrete enough that humans and agents can reason about it.

## What this provider would do

A Chainguard integration would usually help with:

- hardened runtime defaults
- container and image guidance
- stronger verification expectations around runtime packaging
- policy guidance for secure deployment assumptions

It would not own:

- canonical domain meaning
- workflow semantics
- entity modeling
- local review boundaries

## Example package shape

```text
chainguard-provider/
  provider.yaml
  docs/
    overview.md
    adoption-guidance.md
  profiles/
    runtime-profile-chainguard-hardened.yaml
    deploy-profile-chainguard-container.yaml
  verification/
    verification-defaults.yaml
  connectors/
    import-container-policy.md
    refine-hardened-runtime.md
```

## Example provider manifest

```yaml
provider:
  id: chainguard_generic
  display_name: Chainguard Generic
  kind: security_platform
  publisher: chainguard
  version: 0.1.0

compatibility:
  topogram_engine: ">=0.1.0"
  supported_projection_kinds:
    - api
    - db
  supported_output_kinds:
    - maintained_runtime
    - backend_adapter
    - generated_runtime

exports:
  workflow_presets:
    - id: provider_preset_chainguard_runtime_hardening
      kind: provider_workflow_preset
      path: workflow-presets/provider-preset-chainguard-runtime-hardened.json
      applies_to:
        task_classes:
          - import-adopt
        integration_categories:
          - provider_adoption
  profiles:
    - id: runtime_profile_chainguard_hardened
      kind: runtime_profile
      path: profiles/runtime-profile-chainguard-hardened.yaml
    - id: deploy_profile_chainguard_container
      kind: deploy_profile
      path: profiles/deploy-profile-chainguard-container.yaml
  verification_defaults:
    - id: verification_defaults_chainguard
      path: verification/verification-defaults.yaml
  docs:
    - docs/overview.md
    - docs/adoption-guidance.md

connectors:
  import:
    - id: import_container_policy
      kind: runtime_import_connector
      path: connectors/import-container-policy.md
  refinements:
    - id: refine_hardened_runtime
      kind: runtime_refinement
      path: connectors/refine-hardened-runtime.md

requirements:
  expected_surfaces:
    - runtime_bundles
    - deployment_plans
    - verification_targets
  optional_surfaces:
    - environment_plan
    - maintained_boundary

review_defaults:
  runtime_profiles: review_required
  deployment_assumptions: manual_decision
  security_policy_assumptions: manual_decision
  canonical_model_changes: no_go

verification_defaults:
  generated_checks:
    - compile-check
    - runtime-check
  runtime_checks:
    - hardened-image-validation
    - runtime-package-audit

trust:
  import_mode: candidate_first
  refresh_mode: diff_first
  proof_binding: version_bound
```

## Example runtime profile

This is the kind of profile the consuming team might review and adopt selectively.

```yaml
id: runtime_profile_chainguard_hardened
kind: runtime_profile
label: Chainguard Hardened Runtime

refines:
  - runtime_bundle
  - deployment_plan
  - verification_targets

recommendations:
  packaging:
    image_family: hardened_minimal
    base_runtime: locked_down

  verification_routing:
    compile:
      required: true
    runtime:
      required: true
    hardened_runtime_checks:
      required: true

review_sensitive_surfaces:
  - image trust assumptions
  - runtime hardening expectations
  - deployment compatibility assumptions
```

## Example verification defaults

```yaml
id: verification_defaults_chainguard

recommended_checks:
  generated_runtime:
    generated_checks:
      - compile-check
      - runtime-check
      - hardened-image-validation

  maintained_runtime:
    generated_checks:
      - compile-check
      - runtime-check
    maintained_app_checks:
      - product/app/scripts/compile-check.mjs
      - product/app/scripts/runtime-check.mjs

  deploy_review:
    generated_checks:
      - runtime-package-audit
```

## Example connector behavior

The Chainguard connector side would not rewrite Topogram semantics.

It would do narrow things like:

- detect existing container/runtime policy evidence
- normalize it into candidate runtime or deployment evidence
- suggest hardened-runtime refinements for generated outputs
- add security-oriented verification guidance

Plain-English version:

- import connector:
  “look at our current container/runtime setup and turn it into reviewable Topogram evidence”
- refinement connector:
  “take the runtime and deployment outputs Topogram already knows about and show how a hardened Chainguard-style setup would refine them”

## Example team workflow

Here is how a normal team would use this:

1. discover the `chainguard_generic` provider manifest
2. import it into candidate space
3. review:
   - hardened runtime profile
   - hardened deploy profile
   - verification defaults
4. decide locally:
   - `accept` the verification defaults
   - `customize` deployment assumptions
   - `stage` stricter policy refinements until later
5. generate/refine outputs
6. run the Chainguard-aligned checks
7. refresh later with a diff-first re-import

## What this would mean in noob terms

If TeamCity is “help me run this in CI,” then Chainguard is:

- “help me make the runtime and deploy side safer”

So the provider is not deciding what your product does.
It is giving Topogram a reusable secure-runtime layer that your team can inspect, adopt, and refine locally.
