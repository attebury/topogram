# SDLC kinds in Topogram

Topogram's SDLC kinds turn the workspace into the system of record for
shape-the-work activity (pitches), commitments (requirements + acceptance
criteria), execution (tasks), implementation sequencing (plans), defects
(bugs), and rendered guidance (documents). They sit alongside the
existing spec kinds (capability, entity, rule, projection, …) and
reference them through dedicated fields.

## Kinds

| Kind | Identifier prefix | Storage | Status sequence |
|---|---|---|---|
| `pitch` | `pitch_` | `.tg` | draft → shaped → submitted → approved \| rejected |
| `requirement` | `req_` | `.tg` | draft → in-review → approved → superseded |
| `acceptance_criterion` | `ac_` | `.tg` | draft → approved → superseded |
| `task` | `task_` | `.tg` | unclaimed → claimed → in-progress → done (\| blocked) |
| `plan` | `plan_` | `.tg` | draft → active → complete \| superseded |
| `bug` | `bug_` | `.tg` | open → in-progress → fixed → verified \| wont-fix |
| `document` | `doc_` | markdown frontmatter | draft → review → published → archived |

For per-status legal transitions, see [lifecycles.md](lifecycles.md).

## Folder layout

```
topo/
  pitches/{slug}.tg
  requirements/{slug}.tg
  acceptance_criteria/{slug}.tg
  tasks/{slug}.tg
  plans/{slug}.tg
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
pitch.affects                 → capability/entity/rule/projection/widget/orchestration/operation
pitch.decisions               → decision
requirement.pitch             → pitch (single)
requirement.affects           → same set as pitch.affects
requirement.introduces_rules  → rule
requirement.respects_rules    → rule
requirement.supersedes        → requirement
acceptance_criterion.requirement → requirement (single)
task.satisfies                → requirement | acceptance_criterion
task.acceptance_refs          → acceptance_criterion
task.verification_refs        → verification
task.blocks / task.blocked_by → task (reciprocal)
task.introduces_decisions     → decision
task.affects                  → same set as pitch.affects
plan.task                     → task (single)
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
topogram query slice topo/ --pitch pitch_audit_logging
topogram query slice topo/ --requirement req_audit_persistence
topogram query slice topo/ --acceptance ac_audit_log_visible
topogram query slice topo/ --task task_implement_audit_writer
topogram query slice topo/ --plan plan_implement_audit_writer
topogram query slice topo/ --bug bug_audit_drops_silently
topogram query slice topo/ --document doc_audit_runbook
```

A slice returns the focus artifact, its dependencies, related summaries,
verification targets, write scope, and review boundary — enough for an
agent to start work without re-querying.

## Plans and steps

Plans are optional support records for implementation sequencing,
approach notes, and retained lessons. A task or bug does not require a
plan unless a project policy adds that rule later.

```tg
plan plan_implement_audit_writer {
  name "Implement audit writer plan"
  description "Implementation sequence for audit writer work."
  task task_implement_audit_writer
  priority high
  notes "Record approach notes here."
  outcome "Record what worked, what did not, and what to repeat later."
  steps {
    step inspect_current_state status done description "Inspect current behavior."
    step implement_writer status in-progress description "Write the persistence path."
    step verify_runtime status pending description "Run runtime verification."
  }
  status active
}
```

Creating or editing plan text is declarative source work and may be done
directly in `.tg`. Step status changes are workflow state and should use
the CLI so history and drift detection remain useful:

```bash
topogram sdlc plan create task_implement_audit_writer audit_writer --write
topogram sdlc plan explain plan_implement_audit_writer --json
topogram sdlc plan step complete plan_implement_audit_writer implement_writer --actor agent-7 --write
```

Use nested steps for local sequencing. Promote a step to a real `task`
when it needs separate ownership, blocking, acceptance criteria, or
verification.

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

Done tasks require `satisfies`, `acceptance_refs`, and
`verification_refs`. Use the ergonomic helpers when closing work:

```bash
topogram sdlc link task_implement_audit_writer verification_audit_persists --write
topogram sdlc complete task_implement_audit_writer --verification verification_audit_persists --write
```

## Adoption policy and PR gate

Projects opt into SDLC enforcement with `topogram.sdlc-policy.json`.

```bash
topogram sdlc policy init
topogram sdlc policy check --json
topogram sdlc policy explain --json
```

Missing policy means `topogram sdlc gate` reports `not_adopted` and
exits successfully unless `--require-adopted` is passed. Adopted
projects in `advisory` mode report gaps without failing. Adopted
projects in `enforced` mode fail protected changes without a valid SDLC
item, a `topo/**` SDLC record change, or an allowed exemption.

```bash
topogram sdlc gate . --base origin/main --head HEAD --require-adopted --json
topogram sdlc gate . --sdlc-id task_implement_audit_writer --json
```

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

Terminal-status `task` (done), `plan` (complete|superseded), `bug`
(verified|wont-fix), `pitch` (rejected), and `document` (archived)
artifacts are archive-eligible.

```bash
topogram sdlc archive --status verified,wont-fix
topogram sdlc archive --id plan_implement_audit_writer
topogram sdlc unarchive bug_old_regression
topogram sdlc compact topo/_archive/tasks-2025.jsonl
```

Archived entries live as JSONL records under `topo/_archive/`. They
are auto-loaded by the resolver bridge so traceability and release notes
still see them, but they are filtered out of the default board.

## Release flow

```bash
topogram release topo/ --app-version 1.13.0 --since-tag forge/maui/v1.12.0
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
