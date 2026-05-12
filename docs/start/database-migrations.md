# Database Migrations

Topogram treats database migration ownership as a runtime decision in
`topogram.project.json`. The `db_contract` describes desired tables, columns,
relations, indexes, and lifecycle intent. The database runtime decides whether
Topogram owns generated migration output or only emits proposals for a
maintained app.

## Generated Runtimes

Use generated ownership when the database lifecycle belongs to the generated app
bundle.

```json
{
  "id": "main_db",
  "kind": "database",
  "projection": "proj_db",
  "migration": {
    "ownership": "generated",
    "tool": "sql",
    "statePath": "app/db/main_db/state",
    "apply": "script"
  }
}
```

In generated mode:

- `topogram generate` can write DB lifecycle files into the generated app.
- lifecycle scripts may apply supported additive SQL migrations.
- destructive or ambiguous migration plans stop for manual review.
- generated state snapshots record what the generated database is expected to
  match.

## Maintained Runtimes

Use maintained ownership when a brownfield or hand-maintained app owns its
schema files, migrations, and migration runner.

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

In maintained mode, Topogram emits proposal artifacts only. It does not write to
the configured `schemaPath` or `migrationsPath`, and generated lifecycle scripts
do not apply migrations.

Typical commands:

```bash
topogram emit db-schema-snapshot --projection proj_db --json
topogram emit db-migration-plan --projection proj_db --from-snapshot ./topo/state/db/main_db/current.snapshot.json --json
topogram emit sql-migration --projection proj_db --from-snapshot ./topo/state/db/main_db/current.snapshot.json --write --out-dir ./db-proposals/sql
topogram emit prisma-schema --projection proj_db --write --out-dir ./db-proposals/prisma
topogram emit drizzle-schema --projection proj_db --write --out-dir ./db-proposals/drizzle
topogram emit db-lifecycle-bundle --projection proj_db --write --out-dir ./db-proposals/lifecycle
```

The review loop is:

1. Edit `topo/` and run `topogram check`.
2. Emit the desired snapshot, migration plan, and tool-specific proposal.
3. Review the proposal against the maintained app's current schema and
   migrations.
4. Adapt accepted changes into the app's Prisma, Drizzle, or SQL migration
   workflow.
5. Update the trusted snapshot after the app migration has been reviewed and
   applied.

## Imported Maintained DB Seams

Brownfield import can infer review-only migration seam candidates for Prisma,
Drizzle, and SQL projects:

```bash
topogram import ./existing-app --out ./imported-topogram --from db
cd ./imported-topogram
topogram import plan --json
```

Review:

- `candidateCounts.dbMaintainedSeams` in the import JSON output;
- `topo/candidates/app/db/candidates.json` under `maintained_seams`;
- `topo/candidates/app/db/report.md`;
- the `database` bundle in `topo/candidates/reconcile/**`.

Each candidate includes the inferred tool, schema path, migrations path,
snapshot path, confidence, evidence, missing decisions, and a
`proposed_runtime_migration` block plus manual next steps. Treat that block as
a proposal only. Import never patches `topogram.project.json` and never writes
to maintained Prisma, Drizzle, or SQL migration files.

When the candidate is correct, manually add a database runtime migration block
to `topogram.project.json` with `ownership: "maintained"` and `apply: "never"`.
If the candidate reports `missing_decisions`, resolve those first; for example,
a Prisma schema without a migrations directory should not be treated as a
complete migration seam.

The reviewed config target is the matching database runtime under
`topology.runtimes[].migration`, for example:

```json
{
  "id": "app_db",
  "kind": "database",
  "projection": "proj_db",
  "migration": {
    "ownership": "maintained",
    "tool": "prisma",
    "schemaPath": "prisma/schema.prisma",
    "migrationsPath": "prisma/migrations",
    "snapshotPath": "topo/state/db/app_db/current.snapshot.json",
    "apply": "never"
  }
}
```

## Tool Notes

SQL:

- Generated mode can apply supported SQL through generated lifecycle scripts.
- Maintained mode emits SQL proposals for the app's own runner.

Prisma:

- Topogram can emit a proposed `schema.prisma`.
- Maintained apps own `prisma/schema.prisma` and `prisma/migrations/**`.

Drizzle:

- Topogram can emit a proposed Drizzle schema module.
- Maintained apps own the Drizzle schema and Drizzle Kit migration directory.

See [Project Config](../reference/project-config.md#database-migrations) for
the validation rules.
