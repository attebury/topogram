# Brownfield Import

Use brownfield import when you already have an app and want Topogram candidate
artifacts to review, edit, and adopt.

```bash
topogram import ./existing-app --out ./imported-topogram
cd ./imported-topogram
topogram import check
topogram import plan
topogram import adopt --list
topogram import adopt bundle:task --dry-run
topogram import adopt bundle:task --write
topogram import status
topogram check
```

`topogram import` does not modify the brownfield app. It creates a new
Topogram workspace containing:

- `topogram/candidates/app/**` raw extractor findings and candidates
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

Use the adoption commands to review and promote imported candidates into
canonical Topogram files:

```bash
topogram import plan ./imported-topogram
topogram import plan ./imported-topogram --json
topogram import adopt --list ./imported-topogram
topogram import adopt bundle:task ./imported-topogram --dry-run
topogram import adopt bundle:task ./imported-topogram --write
topogram import status ./imported-topogram
topogram import status ./imported-topogram --json
```

`topogram import plan` summarizes the reconcile proposal bundles and suggests
the next adoption command. `topogram import adopt` is preview-only by default;
it does not write canonical `topogram/**` files unless `--write` is passed.
Use `topogram import adopt --list` to discover valid bundle selectors.
`topogram import status` combines source provenance, normal Topogram validity,
and current adoption progress.

Adoption writes refuse to run when the original brownfield source evidence has
changed since import:

```bash
topogram import check ./imported-topogram
topogram import adopt bundle:task ./imported-topogram --write
```

If you reviewed the source drift and still want to promote the current
candidates, make the override explicit:

```bash
topogram import adopt bundle:task ./imported-topogram --write --force
```

Limit import scope with tracks when useful:

```bash
topogram import ./existing-app --out ./imported-topogram --from db,api,ui
```

Supported tracks are `db`, `api`, `ui`, `workflows`, and `verification`.
