# Brownfield Import

Use brownfield import when you already have an app and want Topogram candidate
artifacts to review, edit, and adopt.

```bash
topogram import ./existing-app --out ./imported-topogram
cd ./imported-topogram
topogram import check
topogram import diff
topogram import refresh . --from ../existing-app --dry-run
topogram import refresh . --from ../existing-app
topogram import plan
topogram import adopt --list
topogram import adopt bundle:task --dry-run
topogram import adopt bundle:task --write
topogram import status
topogram import history
topogram check
```

`topogram import` does not modify the brownfield app. It creates a new
Topogram workspace containing:

- `topogram/candidates/app/**` raw extractor findings and candidates
- `topogram/candidates/app/ui/drafts/components/**` review-only UI component
  candidates when reusable screen regions can be inferred
- `topogram/candidates/reconcile/**` reviewable proposal bundles
- `topogram.project.json` with maintained output ownership and no generated
  stack binding
- `.topogram-import.json` with hashes of the brownfield source files at import
  time

Imported Topogram artifacts are project-owned immediately. Editing candidate
`.tg` files, docs, or project config is expected and does not make the import
invalid. The import provenance file records what brownfield source evidence was
trusted at the moment of import.

Run `topogram import check` when you need to verify that provenance:

```bash
topogram import check ./imported-topogram
topogram import check ./imported-topogram --json
```

The check compares the original brownfield source file hashes and runs normal
Topogram validity checks for the imported workspace. If the brownfield source
changed after import, review the source changes and either rerun import into a
fresh workspace or manually update the imported Topogram artifacts.

Use `topogram import refresh` when the brownfield app changed and you want a
new candidate/reconcile plan without losing local Topogram edits:

```bash
topogram import diff ./imported-topogram
topogram import refresh ./imported-topogram --from ./existing-app
topogram import refresh ./imported-topogram --dry-run --json
topogram import refresh ./imported-topogram --json
```

Refresh rewrites only `topogram/candidates/app/**`,
`topogram/candidates/reconcile/**`, and `.topogram-import.json`. It does not
overwrite adopted or canonical `topogram/**` files. The refreshed provenance
hashes the source at the moment of refresh, so `topogram import check` returns
to clean after the new source evidence is accepted. `topogram import diff` and
`topogram import refresh --dry-run` preview the source diff, candidate count
deltas, adoption-plan deltas, and adopted-file receipt audit without writing.
After a write refresh, `.topogram-import.json` records `refreshedAt`, the
previous source status, and source diff counts for the accepted refresh.

Use the adoption commands to review and promote imported candidates into
canonical Topogram files:

```bash
topogram import plan ./imported-topogram
topogram import plan ./imported-topogram --json
topogram import adopt --list ./imported-topogram
topogram import adopt bundle:task ./imported-topogram --dry-run
topogram import adopt bundle:task ./imported-topogram --write
topogram import adopt components ./imported-topogram --dry-run
topogram import adopt components ./imported-topogram --write
topogram import status ./imported-topogram
topogram import status ./imported-topogram --json
topogram import history ./imported-topogram
topogram import history ./imported-topogram --json
topogram import history ./imported-topogram --verify
topogram import history ./imported-topogram --verify --json
```

`topogram import plan` summarizes the reconcile proposal bundles and suggests
the next adoption command. `topogram import adopt` is preview-only by default;
it does not write canonical `topogram/**` files unless `--write` is passed.
Use `topogram import adopt --list` to discover valid bundle selectors. The
`components` selector promotes reviewed component candidates into
`topogram/components/**`; broad bundle selectors also include component
candidate files when the bundle contains them.
`topogram import status` combines source provenance, normal Topogram validity,
and current adoption progress.

Every adoption write appends a receipt to `.topogram-import-adoptions.jsonl`.
Use `topogram import history` to inspect what selector was promoted, which
canonical files were written, whether the write was forced, and the brownfield
source provenance state at the time of the write.

Receipts also store hashes for written canonical files. Use
`topogram import history --verify` to audit whether those files still match the
adoption receipt, changed after adoption, were removed after adoption, or came
from an older unverifiable receipt. This verification is audit-only:
imported/adopted Topogram files are project-owned, and local edits remain valid.

UI import also drafts shared projection wiring when component candidates are
found. The files under `topogram/candidates/app/ui/drafts/**` are not canonical
Topogram until a human or agent reviews and adopts them. Component candidates
should be checked for props, behavior, events, regions, and patterns before
promotion; the generated `ui_components` bindings are starting evidence, not a
silent assertion that the imported app had a clean reusable component model.

Adoption writes refuse to run when the original brownfield source evidence has
changed since import:

```bash
topogram import check ./imported-topogram
topogram import adopt bundle:task ./imported-topogram --write
```

If you reviewed the source drift and still want to promote the current
candidates, make the override explicit and record a reason:

```bash
topogram import adopt bundle:task ./imported-topogram --write --force --reason "Reviewed source drift"
```

Limit import scope with tracks when useful:

```bash
topogram import ./existing-app --out ./imported-topogram --from db,api,ui
```

Supported tracks are `db`, `api`, `ui`, `workflows`, and `verification`.
