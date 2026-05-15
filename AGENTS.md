# Topogram Engineering Laws

This file is the repo-local agent briefing for working on Topogram itself. Product and roadmap decisions live in `topogram-project`; this repo owns the CLI, parser, validator, extract/adopt workflow, contracts, generator dispatch, fixtures, and tests.

## Read First

1. `README.md`
2. `docs/README.md`
3. `docs/agent-first-run.md`
4. `docs/concepts/topogram-model.md`
5. `docs/widgets.md`
6. `docs/maintainers/testing.md`
7. `docs/maintainers/releasing.md`
8. `topogram-project/project/program/operating-laws.md` and `topogram-project/project/program/hardening-plan.md`

## Laws

- Specs are the source of truth. Do not hardcode generated output behavior around a demo, fixture product, framework quirk, or test convenience.
- Enforced SDLC is the repo working habit. Non-trivial protected changes must start from or reference a `pitch`, `requirement`, `task`, or `bug` in `topo/`; PRs must cite the item or give an explicit allowed exemption.
- Agents should inspect available SDLC work and start tasks through the CLI: `topogram query sdlc-available ./topo --json`, then `topogram sdlc start <task-id> . --actor <actor-id> --json`, then `--write` after reviewing the packet.
- Adopted SDLC records default to `topo/sdlc/**`. The parser remains folder-agnostic, but agents should look there first for pitches, requirements, acceptance criteria, tasks, bugs, plans, decisions, archives, and history.
- Tests must prove consumer value. A test that only checks for a string or file exists is not enough when generated output can be installed, compiled, checked, or run.
- Code must be maintainable and security-focused over years. Write as though someone will maintain this app for 10 years while only touching it occasionally: keep modules organized, behavior discoverable, tests meaningful, seams easy to verify, and unsafe inputs, trust boundaries, credentials, and generated output escaping explicit.
- Docs must execute. Any documented command shape needs regression coverage or a clear reason it cannot be executed.
- Generated and maintained ownership are different. Generated outputs can be replaced only through the generated-output sentinel; maintained paths are never overwritten.
- Stateful workflow mutations are command-owned. Edit declarative `topo/**/*.tg` source directly when needed, but use Topogram commands for SDLC status/history, plan step progress, archives, template trust, provenance, generated sentinels, release state, and rollout state.
- Public artifacts must be portable. JSON output, reports, contracts, agent packets, extraction/adoption output, generator/extractor diagnostics, SDLC packets, and proof artifacts must not expose local usernames, home directories, temp roots, CI workspace paths, or absolute source paths.
- Template implementation is executable code. Do not trust, refresh, or execute it without explicit trust checks and reviewable hashes.
- Generator packages own stack realization. Topogram core owns contracts, topology/runtimes, validation, trust, catalog/template lifecycle, and output ownership.
- UI intent is semantic. Topogram models contracts, surfaces, widgets, screen routes, behavior, and design tokens, not framework trees or raw CSS.
- Boundary tests are laws in code. If a hardening rule matters, add a boundary or regression test so it cannot silently regress.
- Keep large rewrites behind pins. Add focused behavioral tests before splitting `cli.js`, `workflows.js`, or shared helpers.
- Never bypass npm, GitHub, or filesystem safety for convenience. Unsafe package specs, implicit local `.npmrc`, token leakage, symlinks, and unescaped generated HTML are bugs.
- Treat filesystem JSON snapshots as untrusted input. `topogram emit --from-snapshot` must reject unsafe keys and malformed DB snapshot shapes before migration planning or SQL generation.
- Remote catalog and GitHub payloads are bounded. Keep `TOPOGRAM_REMOTE_FETCH_MAX_BYTES`, `TOPOGRAM_CATALOG_FETCH_MAX_BYTES`, and `TOPOGRAM_GITHUB_FETCH_MAX_BYTES` fail-fast and covered by tests.

## Safe Edit Boundaries

- Core source: `engine/src/**`
- Engine tests and fixtures: `engine/tests/**`
- Repo scripts: `scripts/**`
- Public docs: `README.md`, `docs/**`, `CONTRIBUTING.md`, `AGENTS.md`
- Topogram workspace and policy: `topo/**`, `topogram.project.json`, `topogram.sdlc-policy.json`

Within `topo/**`, status and audit state is still command-owned. Use `topogram sdlc transition`, `topogram sdlc plan step ... --write`, `topogram sdlc archive`, trust commands, extract/adopt commands, and release commands instead of hand-editing `.topogram-*` sidecars or archive JSONL.

Avoid touching external consumer repos from this workspace unless the user explicitly asks. When a change requires project-management docs, update `topogram-project` separately and mention it in the final status.

## Verification

Use the narrowest meaningful test first, then the repo gate:

```bash
node ./engine/src/cli.js sdlc prep commit . --base origin/main --head HEAD
node ./engine/src/cli.js sdlc gate . --require-adopted
node ./engine/src/cli.js query sdlc-proof-gaps ./topo --task <task-id> --json
node --test engine/tests/active/<focused-test>.test.js
bash ./scripts/verify-engine.sh
bash ./scripts/verify-cli-package.sh
```

For generated app or generator behavior, compile/check the generated output. Do not accept file-existence checks as proof.
