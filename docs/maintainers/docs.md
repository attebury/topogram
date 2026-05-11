# Documentation Maintenance

Current docs must describe current CLI and engine behavior. Historical context
belongs in `topogram-project`.

## Rules

- Start from current code, CLI help, generated project output, and the dogfood
  `topo/` model.
- Keep first-use docs short and audience-oriented.
- Separate user workflows from authoring and maintainer workflows.
- Preserve old doc paths as redirects only when code/tests still reference
  them.
- Do not reintroduce stale command names or old DSL vocabulary.
- Run docs checks after editing public docs.

## Check

```bash
npm run docs:check
```

The check validates local markdown links, verifies the greenfield first-run
commands against a generated starter project, checks key command families
against `topogram --help`, and rejects known stale command names.
