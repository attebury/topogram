---
id: engine_cli_import_evidence
kind: report
title: Engine CLI Import Evidence
status: draft
source_of_truth: code-derived
confidence: medium
related_capabilities:
  - cap_import_brownfield_app
  - cap_reconcile_import_candidates
  - cap_validate_workspace
---

# Engine CLI Import Evidence

The first dogfood import ran against the current Topogram engine worktree and wrote raw evidence to:

```bash
node engine/src/cli.js import . --out /private/tmp/topogram-engine-cli-import --from cli --json
```

The import succeeded and reported:

- Source files scanned: 1139
- CLI commands: 234
- CLI capabilities: 234
- CLI surfaces: 1
- Reconcile files: 243

Useful evidence:

- `package.json` and `engine/package.json` expose the package/script boundary.
- `engine/src/cli/**` exposes command families.
- `docs/**`, `AGENTS.md`, and `CONTRIBUTING.md` expose command examples, engineering laws, and required verification gates.
- The raw import produced a `proj_cli_surface` candidate with commands/options/effects/examples.

Importer limits observed:

- The generic CLI extractor is intentionally stack-agnostic, but it currently over-collects usage-like source strings.
- Many false positives came from parser, resolver, generated app fixtures, and test strings rather than public CLI help.
- The curated `topo/` promotes the command families and effects that are actually user-facing; raw candidate files are evidence, not source of truth.

Follow-up:

- `req_cli_import_precision_followup`
- `task_add_cli_import_track`
- `pitch_improve_cli_import_precision`
