# Testing

Tests must prove consumer or agent value.

Weak tests check marker strings or file existence. Strong tests cross the next
meaningful boundary: validation, normalized contracts, import/adoption,
generated output compile, runtime smoke, or an explicit unsupported diagnostic.

## Engine

```bash
npm test
```

## Repo gates

```bash
bash ./scripts/verify-engine.sh
bash ./scripts/verify-cli-package.sh
```

## Generated app smoke

```bash
npm run smoke:test-app
```

`smoke:test-app` writes `.tmp/smoke-test-app` and must run the generated
starter's verification surface after generation.

## Docs

Documented command shapes should execute in tests or be clearly marked as
environment-dependent.
