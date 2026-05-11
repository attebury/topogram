# Project Config

`topogram.project.json` declares how a project uses a `topo/` workspace.

Minimal shape:

```json
{
  "version": "1",
  "workspace": "./topo",
  "outputs": [
    {
      "id": "app",
      "path": "./app",
      "ownership": "generated"
    }
  ],
  "topology": {
    "runtimes": []
  }
}
```

## Workspace

`workspace` defaults to `./topo`. It must be relative and cannot escape the
project root. Package fixtures may use `"."`.

## Outputs

Outputs are either:

- `generated`: Topogram may replace the output when the generated sentinel is
  present.
- `maintained`: Topogram never overwrites it; emit contracts/reports instead.

## Runtimes

Runtime kinds:

- `web_surface`
- `api_service`
- `database`
- `ios_surface`
- `android_surface`

References:

- `uses_api` links web/native surfaces to an API runtime.
- `uses_database` links API services to a database runtime.

Each runtime can bind a package-backed or bundled generator.

## Database Migrations

Database runtimes can declare an optional `migration` strategy. This makes the
database ownership boundary explicit without changing the stack-neutral
`db_contract`.

Generated database runtime:

```json
{
  "id": "main_db",
  "kind": "database",
  "projection": "proj_db",
  "generator": {
    "id": "@topogram/generator-postgres-db",
    "version": "1",
    "package": "@topogram/generator-postgres-db"
  },
  "migration": {
    "ownership": "generated",
    "tool": "sql",
    "statePath": "app/db/main_db/state",
    "apply": "script"
  }
}
```

Maintained Prisma runtime:

```json
{
  "id": "main_db",
  "kind": "database",
  "projection": "proj_db",
  "generator": {
    "id": "@topogram/generator-postgres-db",
    "version": "1",
    "package": "@topogram/generator-postgres-db"
  },
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

Rules:

- `ownership` is `generated` or `maintained`.
- `tool` is `sql`, `prisma`, or `drizzle`.
- generated migrations require `statePath` and `apply: "script"`.
- maintained migrations require `snapshotPath` and `apply: "never"`.
- maintained Prisma and Drizzle workflows require `schemaPath` and
  `migrationsPath`.
- maintained SQL workflows require `migrationsPath`.
- paths are project-relative and cannot escape the project root.

In maintained mode, Topogram emits snapshots, plans, SQL proposals, and
Prisma/Drizzle schema proposals. The maintained app owns its schema files,
migration directory, and migration runner.
