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
```

Import writes:

- `topo/candidates/app/**` for raw candidates;
- `topo/candidates/reconcile/**` for proposal bundles;
- `topogram.project.json` with maintained ownership;
- `.topogram-import.json` with source hashes from import time.

Imported Topogram files are project-owned after creation. Edit candidates and
canonical files freely, but do not hand-edit import provenance or adoption
receipts.

## 3. Adopt deliberately

Preview first:

```bash
topogram import adopt bundle:task --dry-run
topogram import adopt widgets --dry-run
```

Write only after review:

```bash
topogram import adopt bundle:task --write
topogram import adopt widgets --write
```

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
