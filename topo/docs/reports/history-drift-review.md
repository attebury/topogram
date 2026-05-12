---
id: history_drift_review
kind: report
title: History Drift Review
status: draft
source_of_truth: code-derived
confidence: medium
related_capabilities:
  - cap_manage_sdlc_records
  - cap_run_engine_gates
  - cap_query_context
---

# History Drift Review

This review compares the code-derived engine `topo/` workspace against durable
planning documents in `topogram-project`. The engine model was created first
from current repo evidence: source, tests, docs, scripts, workflows, package
manifests, CLI help, `AGENTS.md`, and `CONTRIBUTING.md`.

Historical docs reviewed:

- `project/program/operating-laws.md`
- `project/program/hardening-plan.md`
- `project/program/dsl-vocabulary-decisions.md`
- `project/program/ui-contract-maturity-roadmap.md`
- `project/program/catalog-semantics.md`
- `project/program/agent-query-surface.md`
- `project/program/source-health-workflow.md`
- `project/program/testing-law.md`
- `project/repos.md`
- `plans/topo_convention_rename_c5df8819.plan.md`

## Matched Current Engine Behavior

- **matched:** `topo/` is the canonical workspace folder. Current engine
  project config supports `workspace: "./topo"`, and the dogfood workspace
  validates from the repository root.
- **matched:** `topogram.project.json`, `.topogram-*`, CLI binary
  `topogram`, package scope `@topogram/*`, and generated app namespace
  `src/lib/topogram/*` remain brand surfaces rather than workspace-folder
  names.
- **matched:** The hardening plan's bounded completion bar is reflected in the
  current repo: `engine/src/cli.js` is a small binary shim,
  `engine/src/workflows.js` is dispatch-only, validator groups and workflow
  modules are split, and boundary tests enforce module-size and safety rules.
- **matched:** The coordinated DSL rename is current engine behavior:
  `projection.type`, `ui_contract`, `web_surface`, `ios_surface`,
  `api_contract`, `db_contract`, `widget`, `widget_bindings`,
  `screen_routes`, and `topology.runtimes` are the canonical terms.
- **matched:** `generate` and `emit` are split. App/runtime writes stay behind
  `topogram generate`; contracts, reports, snapshots, and migration artifacts
  use `topogram emit`.
- **matched:** `topogram agent brief` exists as the first-run agent entry point
  and can read the dogfood engine workspace.
- **matched:** Query packets are the intended focused-context surface. The
  current CLI exposes `topogram query list --json` and focused query families.
- **matched:** The testing law is represented in engine and repo laws:
  consumer proof, no paper tests, docs execution, external package proof, and
  fixture neutrality are enforceable review standards.
- **matched:** Catalog, starter, template, and generator ownership is split
  across package-backed repos. The engine owns CLI, validation, generation,
  import/adoption, and neutral fixtures, not product starter content.

## Contradicted By Current Code, Tests, Or Docs

- **contradicted:** `topogram-project` is described as authoritative for
  roadmap and durable engineering plans, but this dogfood workspace confirms it
  must not override current code-derived truth. Historical claims become
  requirements only after explicit drift review and promotion.
- **contradicted:** Catalog provenance docs still use some legacy wording around
  hashes for copied `topogram/` content. Current package ingress and workspace
  behavior are `topo/` only; `topogram/` survives only as a brand/config/generated
  namespace.
- **contradicted:** Some deferred/generated historical examples under
  `topogram-project/project/topogram/deferred-code/**` still show old generated
  lifecycle commands such as `--generate` and legacy workspace paths. Those are
  archived evidence, not current command truth.
- **contradicted:** The generic CLI import can find command-like evidence, but
  it is not precise enough to adopt the Topogram engine command surface
  unattended. The raw self-import over-collected source literals and tests as
  command candidates.
- **contradicted:** The dogfood workspace exposed that `topogram sdlc check`
  defaulted to the wrong root when run from a project root with configured
  workspace. The engine now routes that command through workspace resolution,
  and the bug is recorded as `bug_sdlc_check_ignored_configured_workspace`.

## Historical Goals Not Implemented Yet

- **not implemented:** Multi-workspace support remains deferred. The current
  engine supports one configured `workspace` path, defaulting to `./topo`.
- **not implemented:** Template trust signing, allowlists, and external trust
  enforcement are not implemented. Current trust behavior is policy and digest
  based for executable implementation content.
- **not implemented:** Android generation is reserved in DSL/runtime vocabulary
  but not implemented as a first-party generated app path.
- **not implemented:** Catalog `hello` naming is still an open product decision
  in history. The current engine can consume catalog entries, but this dogfood
  topo does not resolve that starter identity issue.
- **not implemented:** Coverage instrumentation and numeric coverage ratchets
  remain deferred. The current hardening proof relies on active behavior tests,
  package smoke, and boundary tests.
- **not implemented:** The CLI importer does not yet classify public command
  help versus incidental source strings well enough for broad self-import
  adoption.
- **not implemented:** UI/native parity across React, SvelteKit, and future
  native surfaces remains a product proof target, not a completed engine fact.

## Current Engine Behavior Missing From Old Project Docs

- **missing-from-history:** `cli_surface` is now a projection type with
  `commands`, `command_options`, `command_outputs`, `command_effects`, and
  `command_examples` blocks.
- **missing-from-history:** CLI import is a brownfield import track:
  `topogram extract <source> --from cli` emits reviewable CLI command, capability,
  and `cli_surface` candidates.
- **missing-from-history:** Explicit command effects are normalized as
  `read_only`, `writes_workspace`, `writes_app`, `network`, `package_install`,
  `git`, and `filesystem`.
- **missing-from-history:** The engine repo now has a maintained
  `topogram.project.json` and curated `topo/` workspace modeling the engine
  itself.
- **missing-from-history:** Workspace resolution now prefers an explicit nested
  project directory's direct `topo/` over an ancestor project config. This keeps
  fixture and nested package workspaces from being captured by the engine root.
- **missing-from-history:** `topogram sdlc check` now resolves the configured
  workspace from the project root rather than parsing the repository root.

## Ignored With Reason

- **ignored-with-reason:** Generated and deferred code snapshots inside
  `topogram-project/project/topogram/deferred-code/**` are not treated as
  current engine truth. They are useful historical evidence but conflict with
  current command vocabulary and workspace conventions.
- **ignored-with-reason:** Release baseline files for older package names and
  versions are not promoted into the engine topo. They are point-in-time release
  records, not durable engine requirements.
- **ignored-with-reason:** Product-specific Todo and content-approval examples
  are not promoted into engine rules. Engine fixtures must stay neutral; product
  semantics belong in product template/demo repos.

## Recommendations

- **promote:** Add `cli_surface` and CLI import decisions to
  `topogram-project` after this branch lands, using this report and the engine
  tests as current evidence.
- **promote:** Keep `topogram-project` as roadmap/program memory, but document
  the rule that current repo code/tests/docs establish the initial brownfield
  model and project history is reviewed afterward.
- **rewrite:** Update catalog provenance docs from legacy `topogram/` examples
  to `topo/` and clarify that copied-source hashes are audit evidence, not edit
  ownership.
- **rewrite:** Remove or clearly label deferred generated snapshots that show
  stale `--generate` artifact commands when they appear near active program
  docs.
- **promote:** Keep `req_cli_import_precision_followup` as a current
  requirement. The importer is useful as evidence capture, but precision must
  improve before large self-adoption.
- **promote:** Treat the dogfood workspace as maintained. `topogram generate`
  must not rewrite engine source; agents should use `topogram agent brief`,
  focused `query` packets, and SDLC records before editing.
- **ignore:** Do not backfill every historical idea into `topo/`. Only promote
  claims that match current behavior or are explicitly accepted as future
  requirements.
