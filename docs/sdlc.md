# SDLC kinds in Topogram

Topogram's six SDLC kinds turn the workspace into the system of record for
shape-the-work activity (pitches), commitments (requirements + acceptance
criteria), execution (tasks), defects (bugs), and rendered guidance
(documents). They sit alongside the existing spec kinds (capability,
entity, rule, projection, …) and reference them through dedicated fields.

## Kinds

| Kind | Identifier prefix | Storage | Status sequence |
|---|---|---|---|
| `pitch` | `pitch_` | `.tg` | draft → shaped → submitted → approved \| rejected |
| `requirement` | `req_` | `.tg` | draft → in-review → approved → superseded |
| `acceptance_criterion` | `ac_` | `.tg` | draft → approved → superseded |
| `task` | `task_` | `.tg` | unclaimed → claimed → in-progress → done (\| blocked) |
| `bug` | `bug_` | `.tg` | open → in-progress → fixed → verified \| wont-fix |
| `document` | `doc_` | markdown frontmatter | draft → review → published → archived |

For per-status legal transitions, see [lifecycles.md](lifecycles.md).

## Folder layout

```
topogram/
  pitches/{slug}.tg
  requirements/{slug}.tg
  acceptance_criteria/{slug}.tg
  tasks/{slug}.tg
  bugs/{slug}.tg
  docs/{kind}/{slug}.md            # markdown documents
  _archive/{kind}s-{year}.jsonl    # year-bucketed archives for terminal-status artifacts
  .topogram-sdlc-history.json      # append-only transition history sidecar
```

The folder split is convention only — the parser flattens everything via
`collectTopogramFiles`. The `_archive/` folder is special: the resolver
bridge loads it at workspace-parse time so frozen entries participate in
cross-references and the traceability matrix without showing up in the
default board.

## Cross-reference fields

```text
pitch.affects                 → capability/entity/rule/projection/component/orchestration/operation
pitch.decisions               → decision
requirement.pitch             → pitch (single)
requirement.affects           → same set as pitch.affects
requirement.introduces_rules  → rule
requirement.respects_rules    → rule
requirement.supersedes        → requirement
acceptance_criterion.requirement → requirement (single)
task.satisfies                → requirement | acceptance_criterion
task.acceptance_refs          → acceptance_criterion
task.blocks / task.blocked_by → task (reciprocal)
task.introduces_decisions     → decision
task.affects                  → same set as pitch.affects
bug.affects                   → same set as pitch.affects
bug.violates                  → rule
bug.surfaces_rule             → rule (the rule the bug uncovered, vs. one it violates)
bug.fixed_in                  → task
bug.fixed_in_verification     → verification
verification.requirement_refs → requirement
verification.acceptance_refs  → acceptance_criterion
verification.fixes_bugs       → bug
decision.pitch                → pitch (single)
decision.supersedes           → decision
rule.from_requirement         → requirement (single)
```

The resolver builds reverse arrays (`affectedByPitches`, `tasks`,
`acceptanceCriteria`, `verifiedBy`, …) so consumers don't re-walk the
graph. See `engine/src/resolver/enrich/` for the per-kind enrichment.

## Slices

Each SDLC kind has its own context slice:

```bash
topogram query slice topogram/ --pitch pitch_audit_logging
topogram query slice topogram/ --requirement req_audit_persistence
topogram query slice topogram/ --acceptance ac_audit_log_visible
topogram query slice topogram/ --task task_implement_audit_writer
topogram query slice topogram/ --bug bug_audit_drops_silently
topogram query slice topogram/ --document doc_audit_runbook
```

A slice returns the focus artifact, its dependencies, related summaries,
verification targets, write scope, and review boundary — enough for an
agent to start work without re-querying.

## State transitions

```bash
topogram sdlc transition task_implement_audit_writer in-progress --actor agent-7
topogram sdlc transition task_implement_audit_writer done --note "PR merged"
```

Each transition:
1. Validates the legal-transitions map for that kind
2. Runs the per-kind Definition of Done check (errors block; warnings
   advise)
3. Surgically rewrites the `status` field in the source `.tg` file
   (formatting and adjacent fields untouched)
4. Appends to `.topogram-sdlc-history.json`

`--dry-run` prints the planned mutation without writing.

## Agent-loop pattern

The canonical agent loop:

```bash
topogram sdlc explain task_X --json
# consume next_action.kind ∈ {transition | work | wait | review | none}
# do the work
topogram sdlc transition task_X <next> --actor agent-7
topogram sdlc check
```

`sdlc explain --brief --json` is the stable, scriptable surface — its
output shape (`{ id, status, next_action }`) is locked. The verbose form
adds DoD details, history, and drift indicators.

## Archive flow

Terminal-status `task` (done), `bug` (verified|wont-fix), `pitch`
(rejected), and `document` (archived) artifacts are archive-eligible.

```bash
topogram sdlc archive --status verified,wont-fix
topogram sdlc unarchive bug_old_regression
topogram sdlc compact topogram/_archive/tasks-2025.jsonl
```

Archived entries live as JSONL records under `topogram/_archive/`. They
are auto-loaded by the resolver bridge so traceability and release notes
still see them, but they are filtered out of the default board.

## Release flow

```bash
topogram release topogram/ --app-version 1.13.0 --since-tag forge/maui/v1.12.0
```

A release is one atomic operation:
1. Assemble release notes from approved pitches + done tasks + verified
   bugs in the window
2. Stamp `app_version: 1.13.0` on documents missing or older
3. Archive eligible terminal-status artifacts (writes JSONL, removes from
   active `.tg` files)

`--dry-run` prints the planned mutations only.

## Brownfield onramp

```bash
topogram sdlc adopt
```

Creates the SDLC folder skeleton and runs a pressure scan. **No
backfilling** — historical artifacts stay where they are; you start
authoring forward.

## Cross-references

- [lifecycles.md](lifecycles.md) — per-kind state diagrams and DoD rules
- [grammar.md](grammar.md) — formal kind table and `domain` field section
- [domains.md](domains.md) — domain authoring (Phase 1 pre-requisite)
- [topogram-workspace-layout.md](topogram-workspace-layout.md) — folder
  conventions
