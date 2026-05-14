---
id: adversarial_residual_extractor_sdlc_audit
kind: report
title: Adversarial Residual Extractor SDLC Audit
status: published
source_of_truth: code-derived
confidence: high
date: 2026-05-14
related_capabilities:
  - cap_import_brownfield_app
  - cap_manage_sdlc_records
  - cap_query_context
related_pitches:
  - pitch_brownfield_import_maturity
  - pitch_cli_adversarial_hardening_followup
related_tasks:
  - task_adversarial_residual_extractor_sdlc_audit
---

# Adversarial Residual Extractor SDLC Audit

This audit reviewed the residual risks called out after the extractor hardening
train: extractor completeness, Drizzle config-resolved schemas, runtime
template paths versus fixture templates, command-owned SDLC state, and whether
the review outcomes are tied back to current brownfield and hardening pitches.

## Reproducible Checklist

Run these commands from the repository root:

```bash
rg -n "findImportFiles\\(" engine/src/import/extractors engine/src/import/enrichers engine/src/import/core
rg -n "findPrimaryImportFiles|isPrimaryImportSource" engine/src/import/extractors engine/src/import/enrichers
rg -n "configuredSchemaFiles|classifyImportSourcePath" engine/src/import engine/tests/active/import-fixtures.test.js
rg -n "command-owned|topogram-sdlc-history|plan step" AGENTS.md CONTRIBUTING.md docs engine/tests/active/stateful-actions.test.js
node --test engine/tests/active/import-fixtures.test.js engine/tests/active/stateful-actions.test.js engine/tests/active/engine-boundary.test.js
node engine/src/cli.js check . --json
node engine/src/cli.js sdlc check --strict
node engine/src/cli.js sdlc prep commit . --json
```

## Findings

### 1. Primary Source Filtering Is Mostly Centralized

Outcome: pass with one follow-up bug.

Evidence:

- `engine/src/import/core/shared/files.js` owns
  `classifyImportSourcePath`, `isPrimaryImportSource`,
  `findImportFiles(..., { primaryOnly: true })`, and
  `findPrimaryImportFiles`.
- Candidate-producing DB/API/UI/CLI extractors now use
  `findPrimaryImportFiles`.
- The only direct extractor use of `findImportFiles` is
  `engine/src/import/extractors/verification/generic.js`, where broad scanning
  is intentional because verification evidence comes from package scripts,
  config files, and test infrastructure rather than app runtime semantics.

Residual bug:

- `bug_openapi_code_extractor_self_filtered` is open. The
  `api.openapi-code` extractor looks for `src/docs/openapi.ts`, but that path
  is classified as `docs` and filtered out before extraction. This is a real
  precision/recall boundary issue, not a paper-test issue.

Recommendation:

- Fix the OpenAPI-code case with a narrow parser-config/source exception or a
  renamed search path, then add a negative docs-noise fixture proving arbitrary
  README/docs snippets still cannot create API candidates.
- Add a future boundary ratchet if package-backed extractors drift: candidate
  extractors should either use core primary-source helpers or be explicitly
  allowlisted with a documented reason.

### 2. Runtime Template Paths Are No Longer Treated As Fixtures

Outcome: pass.

Evidence:

- `classifyImportSourcePath` only treats root-level template fixture names such
  as `template/`, `templates/`, `swiftui-templates/`, or
  `swiftui_templates/` as fixtures.
- `engine/tests/active/import-fixtures.test.js` asserts that
  `src/templates/email.ts`, `src/templateRenderer.ts`, and
  `src/routes/templates.ts` are `runtime_source`.
- The same test asserts `swiftui-templates/runtime/GhostView.swift` is a
  fixture and therefore not returned by `findPrimaryImportFiles`.

Disposition:

- No new work required.

### 3. Drizzle Config-Resolved Schemas Use The Same Primary Filter

Outcome: pass.

Evidence:

- `engine/src/import/extractors/db/drizzle.js` checks
  `isPrimaryImportSource(context.paths, absoluteSchemaPath)` before accepting
  a schema path resolved from `drizzle.config.*`.
- Conventional Drizzle schema discovery also uses `findPrimaryImportFiles`.

Disposition:

- No new work required.

### 4. Command-Owned SDLC State Is Tested And Documented

Outcome: pass.

Evidence:

- `engine/tests/active/stateful-actions.test.js` covers direct edits to SDLC
  statement status, plan step state, `.topogram-sdlc-history.json` sidecar
  shape, archive JSONL schema, and documentation coverage for command-owned
  state.
- `AGENTS.md`, `CONTRIBUTING.md`, `docs/sdlc.md`,
  `docs/agent-first-run.md`, `docs/import.md`, `docs/template-authoring.md`,
  and `docs/releasing.md` name command-owned surfaces and commands.

Disposition:

- No new work required.

### 5. Pitch Linkage Is Current

Outcome: pass.

Brownfield import maturity:

- The pass reinforces `pitch_brownfield_import_maturity`: import/extract must
  stay precision-first, review-only, and avoid creating canonical meaning from
  weak docs/test/generated evidence.

CLI adversarial hardening follow-up:

- The pass reinforces `pitch_cli_adversarial_hardening_followup`: residual
  audits should leave dated notes, prove fixes with active tests, and file real
  bugs instead of papering over defects.

## Closeout State

Closed by evidence:

- Runtime paths containing `template` are primary source when they are runtime
  app paths.
- Root/package template fixture paths are not primary source.
- Drizzle config-resolved schemas cannot bypass primary-source filtering.
- SDLC status/history/plan step state remains command-owned.

Reopened:

- `bug_openapi_code_extractor_self_filtered`.

No source-app mutation, canonical adoption, or extractor behavior change was
made by this audit.
