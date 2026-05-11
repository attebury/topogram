---
id: db_migration_ownership_model
kind: report
title: Database Migration Ownership Model
status: published
source_of_truth: code-derived
confidence: medium
related_capabilities:
  - cap_validate_workspace
  - cap_generate_app_outputs
  - cap_emit_artifacts
---

# Database Migration Ownership Model

This report started `task_model_db_migration_ownership` and now records the
implemented ownership model for generated and maintained database migration
workflows.

## Current Behavior

Current DB generation is contract-first:

1. `db_contract` defines tables, columns, keys, indexes, relations, and
   lifecycle intent.
2. Topogram can emit `db-schema-snapshot`, `db-migration-plan`,
   `sql-migration`, `prisma-schema`, `drizzle-schema`, `db-lifecycle-plan`,
   and `db-lifecycle-bundle`.
3. Generated lifecycle bundles contain scripts for status, bootstrap, migrate,
   and bootstrap-or-migrate.
4. Migration planning is intentionally conservative. Additive changes can be
   represented as operations. Drops, type changes, foreign-key changes, and
   other destructive or ambiguous changes require manual intervention.

The product model is ownership, not just the diff algorithm. Generated
databases and maintained databases have different write and apply rules.

## Implemented Ownership Split

Topogram treats database migration work as one of two modes.

### Generated DB Runtime

Generated-owned database runtimes may receive replaceable lifecycle output.
Topogram may write files under the generated DB runtime directory, including
state files, SQL migrations, Prisma/Drizzle support files, and lifecycle
scripts.

Behavior:

- `topogram generate` writes the DB lifecycle bundle.
- generated scripts may apply supported additive SQL migrations.
- unsupported or destructive changes stop with manual migration required.
- the generated state snapshot records what the live/generated DB is expected
  to match.

### Maintained DB Runtime

Maintained database runtimes should never have application migration files
overwritten by Topogram. Topogram should emit proposals only.

Behavior:

- `topogram emit db-schema-snapshot` writes or prints desired state.
- `topogram emit db-migration-plan` compares current and desired snapshots.
- `topogram emit sql-migration` emits a SQL proposal.
- `topogram emit prisma-schema` emits a Prisma schema proposal.
- `topogram emit drizzle-schema` emits a Drizzle schema proposal.
- humans or agents adapt accepted proposals into the maintained app's own
  migration system.

## Runtime Configuration Shape

Database runtime migration strategy lives on the database runtime in
`topogram.project.json`:

```json
{
  "id": "main_db",
  "kind": "database",
  "projection": "proj_db",
  "migration": {
    "ownership": "maintained",
    "tool": "prisma",
    "schemaPath": "apps/api/prisma/schema.prisma",
    "migrationsPath": "apps/api/prisma/migrations",
    "snapshotPath": "topo/state/db/main_db/current.snapshot.json",
    "apply": "never"
  }
}
```

Generated DB runtimes can use the same shape with generated ownership:

```json
{
  "migration": {
    "ownership": "generated",
    "tool": "sql",
    "statePath": "app/db/main_db/state",
    "apply": "script"
  }
}
```

## Tool-Specific Expectations

Prisma:

- Topogram emits `schema.prisma` and SQL proposals.
- Maintained apps own `prisma/schema.prisma` and `prisma/migrations/**`.
- Generated apps may use bundled Prisma support files and generated lifecycle
  scripts.

Drizzle:

- Topogram emits `schema.ts` and SQL proposals.
- Maintained apps own Drizzle schema modules and Drizzle Kit migrations.
- Generated apps may use bundled Drizzle support files when the generator
  supports them.

Straight SQL:

- Topogram emits SQL migration proposals.
- Maintained apps own their migration directory and runner.
- Generated apps may apply supported generated SQL through lifecycle scripts.

## Follow-Up Implementation Tasks

Completed:

- `migration` validation exists for database topology runtimes.
- `topogram check` reports migration ownership in resolved topology.
- generated DB lifecycle output reads the runtime migration strategy.
- maintained-mode docs and command examples are covered in
  `docs/start/database-migrations.md`.
- regression coverage pins generated DB lifecycle writes versus maintained DB
  proposal emission.

Remaining follow-up work:

- Brownfield import should infer maintained database seam candidates with
  precision-first evidence.
- Maintained migration proposals should become easier to compare against the
  app's current Prisma, Drizzle, or SQL migration state.
