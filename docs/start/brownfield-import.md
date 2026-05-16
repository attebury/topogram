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

## Choose extractor packs before extraction

Topogram has two extractor sources:

- bundled extractors ship inside `@topogram/cli` and are always available;
- package-backed extractors are npm packages you install and opt into for a
  specific brownfield source.

Use bundled extractors for a first broad pass. Use `topogram extractor
recommend <source>` when you want Topogram to inspect local evidence and suggest
which first-party packages are worth installing before extraction:

```bash
topogram extractor recommend ./existing-app --from db,api,ui,cli
```

Recommendation is read-only: it does not load extractor adapter code, install
packages, write candidates, or mutate the source app. It only reports likely
bundled and package-backed extractors, evidence, and the next install, pin,
check, and extract commands.

Use package-backed extractor packs when you deliberately want extra
framework-specific discovery beyond the bundled pass. Package-backed extractors
are execution dependencies, not templates: they run only during `topogram
extract`, return review-only candidates, and do not own adoption.

Current first-party package-backed extractors:

| Source evidence | Extractor package | npm version on the current CLI line | Track | Use it for |
| --- | --- | --- | --- | --- |
| Node package CLI code | `@topogram/extractor-node-cli` | `0.1.0` | `cli` | Commands, options, effects, and `cli_surface` candidates |
| React Router route trees | `@topogram/extractor-react-router` | `0.1.1` | `ui` | Screens, routes, non-resource flows, widgets, and UI stack evidence |
| Prisma schema and migrations | `@topogram/extractor-prisma-db` | `0.1.0` | `db` | Entity, enum, relation, index, and maintained DB seam candidates |
| Express routers and route modules | `@topogram/extractor-express-api` | `0.1.0` | `api` | Route, capability, parameter, auth, and stack evidence |
| Drizzle config, schema modules, migrations | `@topogram/extractor-drizzle-db` | `0.1.0` | `db` | Table, relation, index, and maintained DB seam candidates |

The policy pin uses the extractor manifest version, currently `@1`, not the npm
package version. Install the npm package version you want, then pin the manifest
identity that Topogram is allowed to execute.

`topogram extractor list`, `show`, `check`, and `policy status` report the
version split explicitly:

- manifest version: the adapter contract version pinned by policy, for example `1`;
- package version: the npm package version installed in your project, for example `0.1.1`;
- compatible CLI range: the `@topogram/cli` range declared by the package or inferred for first-party packages;
- policy pin state: whether the reviewed manifest version is pinned, unpinned, mismatched, blocked, or missing.

```bash
topogram extractor list
topogram extractor recommend ./existing-app --from db,api,ui,cli
topogram extractor show @topogram/extractor-prisma-db
topogram extractor check @topogram/extractor-prisma-db
topogram extractor policy init
topogram extractor policy pin @topogram/extractor-node-cli@1
topogram extractor policy pin @topogram/extractor-react-router@1
topogram extractor policy pin @topogram/extractor-prisma-db@1
topogram extractor policy pin @topogram/extractor-express-api@1
topogram extractor policy pin @topogram/extractor-drizzle-db@1
```

Install the packages you plan to execute. Topogram never installs extractor
packages during extraction:

```bash
npm install -D @topogram/extractor-node-cli
npm install -D @topogram/extractor-react-router
npm install -D @topogram/extractor-prisma-db
npm install -D @topogram/extractor-express-api
npm install -D @topogram/extractor-drizzle-db
```

`topogram extractor check <package>` loads the manifest and adapter, validates
the package shape, and runs a minimal smoke extraction against a synthetic
fixture. It proves the package boundary is executable; it does not prove that
the package understands your application. The real proof is the extract/adopt
review loop below.

Extractor command safety is intentionally staged:

| Command | Loads package code? | Purpose |
| --- | --- | --- |
| `topogram extractor list` | No | Discover bundled and first-party package extractors by track. |
| `topogram extractor show <package>` | No | Read purpose, install command, policy pin, and extract command. |
| `topogram extractor recommend <source>` | No | Inspect source evidence and suggest extractor packages plus next commands. |
| `topogram extractor policy ...` | No | Allow and pin reviewed extractor manifest versions. |
| `topogram extractor check <package>` | Yes | Smoke-test the adapter boundary against a synthetic fixture. |
| `topogram extract ... --extractor <package>` | Yes | Read brownfield source and write review-only candidates. |
| `topogram extract plan` / `topogram adopt --list` | No | Review package provenance, candidate counts, bundles, selectors, and safety notes. |
| `topogram adopt <selector> --dry-run` | No | Preview canonical `topo/**` writes. |
| `topogram adopt <selector> --write` | No | Write only reviewed canonical records. |

Then run extraction with the selected pack:

```bash
topogram extract ./existing-cli --out ./imported-topogram --from cli --extractor @topogram/extractor-node-cli
topogram extract ./react-router-app --out ./imported-topogram --from ui --extractor @topogram/extractor-react-router
topogram extract ./prisma-app --out ./imported-topogram --from db --extractor @topogram/extractor-prisma-db
topogram extract ./express-api --out ./imported-topogram --from api --extractor @topogram/extractor-express-api
topogram extract ./drizzle-app --out ./imported-topogram --from db --extractor @topogram/extractor-drizzle-db
```

Extractor packs return review-only candidates, findings, diagnostics, and
evidence. Topogram core still owns candidate persistence, provenance,
reconcile, adoption, and canonical `topo/**` writes. Extractors must not mutate
the source app, install packages, or perform network access. `topogram
extractor list` shows first-party packages even when they are not installed so
agents can select the right package, install it, pin it in policy, then run
extraction deliberately.

## 2. Review extraction health

```bash
topogram extract check
topogram extract diff
topogram extract plan
topogram adopt --list
topogram query extract-plan ./topo --json
topogram query single-agent-plan ./topo --mode extract-adopt --json
topogram query multi-agent-plan ./topo --mode extract-adopt --json
topogram query work-packet ./topo --mode extract-adopt --lane adoption_operator --json
```

Agent rule: use the query packets before reading raw candidate JSON. The raw
files are useful when you need evidence details, but `extract-plan`,
`single-agent-plan`, and `work-packet` summarize extractor provenance, safety
notes, candidate counts, and the next review command in a smaller context.

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
- `extraction_context`: agent query packet context with extraction provenance,
  package-backed extractor summaries, candidate counts, safety notes, and next
  review commands;
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
topogram init . --adopt-sdlc
topogram check --json
```

`topogram init` creates maintained ownership for `.`. After that, copy the pure
Topogram workspace into `topo/`, review `topogram.project.json`, run
`topogram check`, and use `topogram emit` for contracts, reports, and migration
proposals. `--adopt-sdlc` opts the repo into enforced SDLC linkage and scaffolds `topo/sdlc/`. Topogram
should not overwrite maintained app source.
