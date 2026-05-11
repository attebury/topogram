# Topogram Engineering Laws

This file is the repo-local agent briefing for working on Topogram itself. Product and roadmap decisions live in `topogram-project`; this repo owns the CLI, parser, validator, import/adoption workflow, contracts, generator dispatch, fixtures, and tests.

## Read First

1. `README.md`
2. `docs/README.md`
3. `docs/agent-first-run.md`
4. `docs/generator-packs.md`
5. `docs/widgets.md`
6. `docs/testing-strategy.md`
7. `docs/releasing.md`
8. `topogram-project/project/program/operating-laws.md` and `topogram-project/project/program/hardening-plan.md`

## Laws

- Specs are the source of truth. Do not hardcode generated output behavior around a demo, fixture product, framework quirk, or test convenience.
- Tests must prove consumer value. A test that only checks for a string or file exists is not enough when generated output can be installed, compiled, checked, or run.
- Code must be maintainable over years. Write as though someone will maintain this app for 10 years while only touching it occasionally: keep modules organized, behavior discoverable, tests meaningful, and seams easy to verify.
- Docs must execute. Any documented command shape needs regression coverage or a clear reason it cannot be executed.
- Generated and maintained ownership are different. Generated outputs can be replaced only through the generated-output sentinel; maintained paths are never overwritten.
- Template implementation is executable code. Do not trust, refresh, or execute it without explicit trust checks and reviewable hashes.
- Generator packages own stack realization. Topogram core owns contracts, topology/runtimes, validation, trust, catalog/template lifecycle, and output ownership.
- UI intent is semantic. Topogram models contracts, surfaces, widgets, screen routes, behavior, and design tokens, not framework trees or raw CSS.
- Boundary tests are laws in code. If a hardening rule matters, add a boundary or regression test so it cannot silently regress.
- Keep large rewrites behind pins. Add focused behavioral tests before splitting `cli.js`, `workflows.js`, or shared helpers.
- Never bypass npm, GitHub, or filesystem safety for convenience. Unsafe package specs, implicit local `.npmrc`, token leakage, symlinks, and unescaped generated HTML are bugs.

## Safe Edit Boundaries

- Core source: `engine/src/**`
- Engine tests and fixtures: `engine/tests/**`
- Repo scripts: `scripts/**`
- Public docs: `README.md`, `docs/**`, `CONTRIBUTING.md`, `AGENTS.md`

Avoid touching external consumer repos from this workspace unless the user explicitly asks. When a change requires project-management docs, update `topogram-project` separately and mention it in the final status.

## Verification

Use the narrowest meaningful test first, then the repo gate:

```bash
node --test engine/tests/active/<focused-test>.test.js
bash ./scripts/verify-engine.sh
bash ./scripts/verify-cli-package.sh
```

For generated app or generator behavior, compile/check the generated output. Do not accept file-existence checks as proof.
