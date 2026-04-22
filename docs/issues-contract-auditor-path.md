# Issues Contract Auditor Path

This is the shortest independent review path for the current `issues` parity seams.

It is narrower than the full parity proof path. Its job is not to prove every generator claim. Its job is to answer one simpler reviewer question:

- do the emitted `issues` contract seams differ semantically, or not?

## What It Reads

The auditor reads emitted files on disk:

- UI seam:
  [examples/issues/topogram/tests/fixtures/expected/proj_ui_web.ui-web-contract.json](../examples/issues/topogram/tests/fixtures/expected/proj_ui_web.ui-web-contract.json)
  and
  [examples/issues/topogram/tests/fixtures/expected/proj_ui_web_sveltekit.ui-web-contract.json](../examples/issues/topogram/tests/fixtures/expected/proj_ui_web_sveltekit.ui-web-contract.json)
- Backend seam:
  [examples/issues/topogram/tests/fixtures/expected/hono-server/src/lib/topogram/server-contract.ts](../examples/issues/topogram/tests/fixtures/expected/hono-server/src/lib/topogram/server-contract.ts)
  and
  [examples/issues/topogram/tests/fixtures/expected/express-server/src/lib/topogram/server-contract.ts](../examples/issues/topogram/tests/fixtures/expected/express-server/src/lib/topogram/server-contract.ts)

## What To Run

```bash
bash ./scripts/audit-issues-contract-diff.sh
```

The output is compact JSON. It tells you:

- whether the emitted UI contracts differ semantically
- whether the emitted server-contract modules differ semantically
- which screen or route keys would need human attention if they drifted

## What It Proves

- a reviewer can inspect emitted `issues` seams directly from disk
- the current `issues` parity claim is not only buried inside the full engine suite
- semantic parity is being checked at the contract level, not by comparing generated app source text line by line

## What It Does Not Prove

- full independence from the generator
- parity across all domains
- parity across all target pairs
- production readiness of any generated runtime
