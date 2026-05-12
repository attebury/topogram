# Brownfield Import

Use this workflow when an app already exists and you want reviewable Topogram
candidates.

Import does not mutate the source app.

## 1. Import to a separate workspace

```bash
topogram import ./existing-app --out ./imported-topogram
cd ./imported-topogram
```

Limit tracks when useful:

```bash
topogram import ./existing-app --out ./imported-topogram --from db,api,ui
topogram import ./existing-cli --out ./imported-topogram --from cli
```

Supported tracks are `db`, `api`, `ui`, `cli`, `workflows`, and
`verification`.

## 2. Review import health

```bash
topogram import check
topogram import diff
topogram import plan
topogram import adopt --list
topogram query import-plan ./topo --json
```

Import writes:

- `topo/candidates/app/**` for raw candidates;
- `topo/candidates/reconcile/**` for proposal bundles;
- `topogram.project.json` with maintained ownership;
- `.topogram-import.json` with source hashes from import time.

Important JSON fields:

- `workspaceRoot`: the project-owned workspace folder, normally `topo/`;
- `candidateCounts`: counts by import surface such as `apiCapabilities`,
  `dbMaintainedSeams`, `uiFlows`, `uiWidgets`, `cliCommands`, and
  `cliSurfaces`;
- `nextCommands`: the next review commands Topogram recommends.

Imported Topogram files are project-owned after creation. Edit candidates and
canonical files freely, but do not hand-edit import provenance or adoption
receipts.

DB imports may also emit maintained migration seam candidates under
`topo/candidates/app/db/candidates.json` as `maintained_seams`. These are
review-only proposals inferred from Prisma, Drizzle, or SQL schema/migration
evidence. They are carried into `topogram import plan` as a `database` review
bundle, but import does not edit `topogram.project.json`, schema files, or
migration files for you.

UI imports may emit non-resource flow candidates under
`topo/candidates/app/ui/candidates.json` as `flows`. These are conservative,
review-only hints for auth, onboarding/wizard, settings/preferences,
dashboard/reporting, search/filter, and bulk-review routes. They include route
evidence, confidence, missing decisions, and proposed `ui_contract` additions.
Import plan carries them as UI review packets; adoption writes only reviewed
reports/docs when you explicitly adopt the related selector.

Import classifies evidence by source type. Runtime source and parser/config
files can create primary candidates. Docs, tests, fixtures, and generated
output can support review evidence, but they should not create high-confidence
API/UI/CLI candidates by themselves.

## 3. Adopt deliberately

Preview first:

```bash
topogram import adopt bundle:task --dry-run
topogram import adopt widgets --dry-run
topogram import adopt bundle:cli --dry-run
topogram import adopt cli --dry-run
```

Write only after review:

```bash
topogram import adopt bundle:task --write
topogram import adopt widgets --write
topogram import adopt bundle:cli --write
topogram import adopt cli --write
```

`bundle:task` is common for API/UI imports. `widgets` promotes only widget
candidate files and their related event shapes. `bundle:cli` and `cli` are
common for CLI imports.

For DB seam candidates, review `bundle:database` and manually copy the proposed
runtime migration block into `topogram.project.json` only after confirming the
tool, schema path, migration path, snapshot path, and `apply: "never"` policy.
The DB seam packet includes the proposed `topology.runtimes[...].migration`
target and manual next steps; treat those as instructions, not automation.

Adoption appends receipts to `.topogram-import-adoptions.jsonl`. Use history to
audit them:

```bash
topogram import status
topogram import history --verify
```

## 4. Refresh when source changes

```bash
topogram import diff
topogram import refresh . --from ../existing-app --dry-run
topogram import refresh . --from ../existing-app
topogram import check
```

Refresh rewrites only candidate/reconcile artifacts and source provenance. It
does not overwrite adopted canonical `topo/**` files.

## 5. Choose the next operating mode

- Generate a new stack from the adopted Topogram.
- Treat the app as maintained and use Topogram to emit contracts, reports, and
  migration proposals while humans or agents edit app code directly.

## Existing app plus an existing Topogram

If you already have a Topogram you want to use inside an existing app, do not
use brownfield import first. Initialize the app as maintained, then copy or
merge the reviewed `topo/` files:

```bash
cd ./existing-app
topogram init .
topogram check --json
```

`topogram init` creates maintained ownership for `.`. After that, copy the pure
Topogram workspace into `topo/`, review `topogram.project.json`, run
`topogram check`, and use `topogram emit` for contracts, reports, and migration
proposals. Topogram should not overwrite maintained app source.
