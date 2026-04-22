# Generic TeamCity Provider Example

This is an illustrative example of what a generic TeamCity provider integration could look like in Topogram.

It is intentionally not treated as a live engine feature yet. The goal is to make the provider model concrete enough that humans and agents can reason about it.

## What this provider would do

A TeamCity integration would usually help with:

- CI pipeline structure
- verification routing
- build and deploy orchestration
- import of existing TeamCity settings as brownfield evidence

It would not own:

- canonical domain meaning
- workflow semantics
- entity modeling
- local review boundaries

## Example package shape

```text
teamcity-provider/
  provider.yaml
  docs/
    overview.md
    adoption-guidance.md
  profiles/
    ops-profile-teamcity-ci.yaml
    deploy-profile-teamcity-pipeline.yaml
  verification/
    verification-defaults.yaml
  connectors/
    import-teamcity-settings.md
    refine-teamcity-builds.md
```

## Example provider manifest

```yaml
provider:
  id: teamcity_generic
  display_name: TeamCity Generic
  kind: deployment_provider
  publisher: jetbrains
  version: 0.1.0

compatibility:
  topogram_engine: ">=0.1.0"
  supported_projection_kinds:
    - api
    - ui
    - db
  supported_output_kinds:
    - maintained_runtime
    - backend_adapter
    - web_app

exports:
  workflow_presets:
    - id: provider_preset_teamcity_ci
      kind: provider_workflow_preset
      path: workflow-presets/provider-preset-teamcity-ci.json
      applies_to:
        task_classes:
          - import-adopt
        integration_categories:
          - provider_adoption
  profiles:
    - id: ops_profile_teamcity_ci
      kind: ops_profile
      path: profiles/ops-profile-teamcity-ci.yaml
    - id: deploy_profile_teamcity_pipeline
      kind: deploy_profile
      path: profiles/deploy-profile-teamcity-pipeline.yaml
  verification_defaults:
    - id: verification_defaults_teamcity
      path: verification/verification-defaults.yaml
  docs:
    - docs/overview.md
    - docs/adoption-guidance.md

connectors:
  import:
    - id: import_teamcity_settings
      kind: ci_import_connector
      path: connectors/import-teamcity-settings.md
  refinements:
    - id: refine_teamcity_builds
      kind: ci_refinement
      path: connectors/refine-teamcity-builds.md

requirements:
  expected_surfaces:
    - verification_targets
    - deployment_plans
    - runtime_checks
  optional_surfaces:
    - maintained_boundary
    - ui_patterns

review_defaults:
  profiles: review_required
  deployment_assumptions: manual_decision
  environment_expectations: review_required
  canonical_model_changes: no_go

verification_defaults:
  generated_checks:
    - compile-check
    - runtime-check
  ci_checks:
    - teamcity-config-validation
    - teamcity-build-chain-preview

trust:
  import_mode: candidate_first
  refresh_mode: diff_first
  proof_binding: version_bound
```

## Example ops profile

This is the kind of profile the consuming team might review and adopt selectively.

```yaml
id: ops_profile_teamcity_ci
kind: ops_profile
label: TeamCity CI Orchestration

refines:
  - verification_targets
  - deployment_plan
  - environment_plan

recommendations:
  verification_routing:
    compile:
      build_type: app_compile
    runtime:
      build_type: app_runtime_checks
    maintained:
      build_type: maintained_app_checks
    import_adopt:
      build_type: provider_import_review

  artifact_flow:
    publish:
      - app_bundle
      - verification_report
    promote_after:
      - compile-check
      - runtime-check

review_sensitive_surfaces:
  - deployment assumptions
  - secret and environment conventions
  - maintained-boundary-affecting verification gates
```

## Example verification defaults

```yaml
id: verification_defaults_teamcity

recommended_checks:
  maintained_runtime:
    generated_checks:
      - compile-check
      - runtime-check
    maintained_app_checks:
      - product/app/scripts/compile-check.mjs
      - product/app/scripts/smoke.mjs
      - product/app/scripts/runtime-check.mjs

  backend_adapter:
    generated_checks:
      - compile-check

  import_adopt:
    generated_checks:
      - reconcile-review

teamcity_routing:
  compile-check: app_compile
  runtime-check: app_runtime_checks
  reconcile-review: import_review
```

## Example connector behavior

The TeamCity connector side would not rewrite Topogram semantics.

It would do narrow things like:

- detect existing TeamCity settings in a repo
- normalize them into candidate deployment or verification evidence
- suggest TeamCity-oriented refinement patches for generated CI outputs
- provide TeamCity-specific verification routing guidance

Plain-English version:

- import connector:
  “look at our existing TeamCity config and turn it into reviewable Topogram candidate evidence”
- refinement connector:
  “take the verification and deployment outputs Topogram already knows about and show how TeamCity should orchestrate them”

## Example team workflow

Here is how a normal team would use this:

1. discover the `teamcity_generic` provider manifest
2. import it into candidate space
3. review:
   - TeamCity CI profile
   - TeamCity verification defaults
   - TeamCity import/refinement connectors
4. decide locally:
   - `accept` the verification defaults
   - `customize` the deployment pipeline profile
   - `stage` TeamCity import connectors until later
5. generate/refine outputs
6. run the recommended TeamCity-aligned checks
7. refresh later with a diff-first re-import

## What this would mean in noob terms

If AWS is “help me run this on AWS” and Chainguard is “help me harden this runtime,” then TeamCity is:

- “help me run Topogram’s checks and delivery flow inside TeamCity”

So the provider is not telling Topogram what your app means.
It is telling Topogram how a TeamCity-shaped CI and delivery setup could wrap around the outputs Topogram already knows how to produce.
