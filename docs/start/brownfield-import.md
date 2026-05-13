# Brownfield Extract/Adopt

Use this workflow when an app already exists and you want reviewable Topogram
candidates.

Extract does not mutate the source app.

## 1. Extract to a separate workspace

```bash
topogram extract ./existing-app --out ./imported-topogram
cd ./imported-topogram
```

Limit tracks when useful:

```bash
topogram extract ./existing-app --out ./imported-topogram --from db,api,ui
topogram extract ./existing-cli --out ./imported-topogram --from cli
```

Supported tracks are `db`, `api`, `ui`, `cli`, `workflows`, and
`verification`.

Use package-backed extractor packs only when you deliberately want extra
framework-specific discovery beyond the bundled extractors:

```bash
topogram extractor list
topogram extractor check ./my-extractor-pack
topogram extractor policy init
topogram extractor policy pin @topogram/extractor-node-cli@1
topogram extractor policy pin @topogram/extractor-react-router@1
topogram extract ./existing-cli --out ./imported-topogram --from cli --extractor @topogram/extractor-node-cli
topogram extract ./react-router-app --out ./imported-topogram --from ui --extractor @topogram/extractor-react-router
```

Extractor packs run only during `topogram extract`. They return review-only
candidates, findings, diagnostics, and evidence. Topogram core still owns
candidate persistence, provenance, reconcile, adoption, and canonical `topo/**`
writes. Extractors must not mutate the source app, install packages, or perform
network access.

## 2. Review extraction health

```bash
topogram extract check
topogram extract diff
topogram extract plan
topogram adopt --list
topogram query extract-plan ./topo --json
```

Extract writes:

- `topo/candidates/app/**` for raw candidates;
- `topo/candidates/reconcile/**` for proposal bundles;
- `topogram.project.json` with maintained ownership;
- `.topogram-extract.json` with source hashes from extraction time.

Important JSON fields:

- `workspaceRoot`: the project-owned workspace folder, normally `topo/`;
- `candidateCounts`: counts by extracted surface such as `apiCapabilities`,
  `dbMaintainedSeams`, `uiFlows`, `uiWidgets`, `cliCommands`, and
  `cliSurfaces`;
- `nextCommands`: the next review commands Topogram recommends.

Extracted Topogram files are project-owned after creation. Edit candidates and
canonical files freely, but do not hand-edit extraction provenance or adoption
receipts.

DB extraction may also emit maintained migration seam candidates under
`topo/candidates/app/db/candidates.json` as `maintained_seams`. These are
review-only proposals inferred from Prisma, Drizzle, or SQL schema/migration
evidence. They are carried into `topogram extract plan` as a `database` review
bundle, but extraction does not edit `topogram.project.json`, schema files, or
migration files for you.

UI extraction may emit non-resource flow candidates under
`topo/candidates/app/ui/candidates.json` as `flows`. These are conservative,
review-only hints for auth, onboarding/wizard, settings/preferences,
dashboard/reporting, search/filter, and bulk-review routes. They include route
evidence, confidence, missing decisions, and proposed `ui_contract` additions.
Extract plan carries them as UI review packets; adoption writes only reviewed
reports/docs when you explicitly adopt the related selector.

Extract classifies evidence by source type. Runtime source and parser/config
files can create primary candidates. Docs, tests, fixtures, and generated
output can support review evidence, but they should not create high-confidence
API/UI/CLI candidates by themselves.

## 3. Adopt deliberately

Preview first:

```bash
topogram adopt bundle:task --dry-run
topogram adopt widgets --dry-run
topogram adopt bundle:cli --dry-run
topogram adopt cli --dry-run
```

Write only after review:

```bash
topogram adopt bundle:task --write
topogram adopt widgets --write
topogram adopt bundle:cli --write
topogram adopt cli --write
```

`bundle:task` is common for API/UI extraction. `widgets` promotes only widget
candidate files and their related event shapes. `bundle:cli` and `cli` are
common for CLI imports.

For DB seam candidates, review `bundle:database` and manually copy the proposed
runtime migration block into `topogram.project.json` only after confirming the
tool, schema path, migration path, snapshot path, and `apply: "never"` policy.
The DB seam packet includes the proposed `topology.runtimes[...].migration`
target and manual next steps; treat those as instructions, not automation.

Adoption appends receipts to `.topogram-adoptions.jsonl`. Use history to
audit them:

```bash
topogram extract status
topogram extract history --verify
```

## 4. Refresh when source changes

```bash
topogram extract diff
topogram extract refresh . --from ../existing-app --dry-run
topogram extract refresh . --from ../existing-app
topogram extract check
```

Refresh rewrites only candidate/reconcile artifacts and source provenance. It
does not overwrite adopted canonical `topo/**` files.

## 5. Choose the next operating mode

- Generate a new stack from the adopted Topogram.
- Treat the app as maintained and use Topogram to emit contracts, reports, and
  migration proposals while humans or agents edit app code directly.

## Existing app plus an existing Topogram

If you already have a Topogram you want to use inside an existing app, do not
use brownfield extract/adopt first. Initialize the app as maintained, then copy or
merge the reviewed `topo/` files:

```bash
cd ./existing-app
topogram init . --with-sdlc
topogram check --json
```

`topogram init` creates maintained ownership for `.`. After that, copy the pure
Topogram workspace into `topo/`, review `topogram.project.json`, run
`topogram check`, and use `topogram emit` for contracts, reports, and migration
proposals. `--with-sdlc` opts the repo into enforced SDLC linkage. Topogram
should not overwrite maintained app source.
