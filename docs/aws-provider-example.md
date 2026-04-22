# Generic AWS Provider Example

This is an illustrative example of what a generic AWS provider integration could look like in Topogram.

It is intentionally not treated as a live engine feature yet. The goal is to make the provider model concrete enough that humans and agents can reason about it.

## What this provider would do

An AWS integration would usually help with:

- deployment profile choices
- environment plan defaults
- runtime and infrastructure assumptions
- import of existing AWS or Terraform-style evidence

It would not own:

- canonical domain meaning
- workflow semantics
- entity modeling
- local review boundaries

## Example package shape

```text
aws-provider/
  provider.yaml
  docs/
    overview.md
    adoption-guidance.md
  profiles/
    deploy-profile-aws-ecs.yaml
    runtime-profile-aws-rds-postgres.yaml
    ops-profile-aws-observability.yaml
  verification/
    verification-defaults.yaml
  connectors/
    import-terraform-aws.md
    refine-aws-deployments.md
```

## Example provider manifest

```yaml
provider:
  id: aws_generic
  display_name: AWS Generic
  kind: cloud_platform
  publisher: aws
  version: 0.1.0

compatibility:
  topogram_engine: ">=0.1.0"
  supported_projection_kinds:
    - api
    - ui
    - db
  supported_output_kinds:
    - backend_adapter
    - web_app
    - maintained_runtime

exports:
  workflow_presets:
    - id: provider_preset_aws_deploy
      kind: provider_workflow_preset
      path: workflow-presets/provider-preset-aws-deploy.json
      applies_to:
        task_classes:
          - import-adopt
        integration_categories:
          - provider_adoption
  profiles:
    - id: deploy_profile_aws_ecs
      kind: deploy_profile
      path: profiles/deploy-profile-aws-ecs.yaml
    - id: runtime_profile_aws_rds_postgres
      kind: runtime_profile
      path: profiles/runtime-profile-aws-rds-postgres.yaml
    - id: ops_profile_aws_observability
      kind: ops_profile
      path: profiles/ops-profile-aws-observability.yaml
  verification_defaults:
    - id: verification_defaults_aws
      path: verification/verification-defaults.yaml
  docs:
    - docs/overview.md
    - docs/adoption-guidance.md

connectors:
  import:
    - id: import_terraform_aws
      kind: infra_import_connector
      path: connectors/import-terraform-aws.md
  refinements:
    - id: refine_aws_deployments
      kind: deployment_refinement
      path: connectors/refine-aws-deployments.md

requirements:
  expected_surfaces:
    - deployment_plans
    - environment_plans
    - runtime_bundles
    - verification_targets
  optional_surfaces:
    - maintained_boundary
    - package_import

review_defaults:
  deployment_profiles: review_required
  environment_expectations: review_required
  cloud_resource_assumptions: manual_decision
  canonical_model_changes: no_go

verification_defaults:
  generated_checks:
    - compile-check
    - runtime-check
  deployment_checks:
    - aws-deploy-plan-validation
    - aws-environment-preview

trust:
  import_mode: candidate_first
  refresh_mode: diff_first
  proof_binding: version_bound
```

## Example deploy profile

This is the kind of profile the consuming team might review and adopt selectively.

```yaml
id: deploy_profile_aws_ecs
kind: deploy_profile
label: AWS ECS Deployment

refines:
  - deployment_plan
  - environment_plan
  - verification_targets

recommendations:
  deployment_target:
    service_type: ecs
    runtime_style: managed_container

  verification_routing:
    compile:
      required: true
    runtime:
      required: true
    deploy_preview:
      required: true

review_sensitive_surfaces:
  - cloud resource assumptions
  - networking and environment conventions
  - deployment rollout expectations
```

## Example verification defaults

```yaml
id: verification_defaults_aws

recommended_checks:
  backend_adapter:
    generated_checks:
      - compile-check
      - runtime-check
      - aws-deploy-plan-validation

  web_app:
    generated_checks:
      - compile-check
      - aws-environment-preview

  maintained_runtime:
    generated_checks:
      - compile-check
      - runtime-check
    maintained_app_checks:
      - product/app/scripts/compile-check.mjs
      - product/app/scripts/runtime-check.mjs
```

## Example connector behavior

The AWS connector side would not rewrite Topogram semantics.

It would do narrow things like:

- detect existing AWS or Terraform deployment evidence
- normalize it into candidate deployment and env evidence
- suggest AWS-oriented deployment refinements for generated outputs
- add AWS-specific verification guidance

Plain-English version:

- import connector:
  “look at our existing AWS or Terraform setup and turn it into reviewable Topogram evidence”
- refinement connector:
  “take the deployment and environment outputs Topogram already knows about and show how an AWS-aligned setup would refine them”

## Example team workflow

Here is how a normal team would use this:

1. discover the `aws_generic` provider manifest
2. import it into candidate space
3. review:
   - ECS deploy profile
   - RDS runtime profile
   - observability profile
   - AWS verification defaults
4. decide locally:
   - `accept` the deploy profile
   - `map` the runtime profile to an existing DB projection
   - `customize` environment assumptions
5. generate/refine outputs
6. run the AWS-aligned checks
7. refresh later with a diff-first re-import

## What this would mean in noob terms

If Chainguard is “help me harden the runtime” and TeamCity is “help me run checks in CI,” then AWS is:

- “help me shape deployment and environment outputs so they fit AWS”

So the provider is not defining your product.
It is giving Topogram reusable AWS-shaped deployment and runtime guidance that your team can adopt selectively.
