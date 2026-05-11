# Engine Development

Read [AGENTS.md](../../AGENTS.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md)
first.

This repo owns:

- CLI and command dispatch;
- parser, validator, resolver;
- import, reconcile, and adoption workflows;
- contracts and query packets;
- generator dispatch and bundled fallback adapters;
- engine fixtures and tests;
- the dogfood `topo/` workspace.

Non-trivial protected changes should reference an SDLC item in `topo/` or carry
an explicit exemption.

## Local checks

```bash
npm test
bash ./scripts/verify-engine.sh
bash ./scripts/verify-cli-package.sh
```

Use focused tests first, then broader gates.

Do not add demo/product coupling to engine tests. Fixtures should prove engine
behavior with neutral vocabulary.
