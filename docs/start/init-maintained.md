# Initialize Maintained Repo

Use this workflow when a repository already exists, when you want to dogfood
Topogram inside a maintained codebase, or when you want to start from an empty
`topo/` workspace instead of copying a starter template.

`topogram init` is intentionally small. It creates Topogram source and guidance
files, but it does not copy template content, install generator packages, or
write generated app code.

## 1. Initialize

```bash
npm install --save-dev @topogram/cli
npx topogram init . --adopt-sdlc
```

This writes:

- `topo/`
- `topogram.project.json`
- `README.md`, if missing
- `AGENTS.md`, if missing
- `topogram.sdlc-policy.json` and `topo/sdlc/**`, when `--adopt-sdlc` is used

The generated project config marks `.` as maintained ownership. That means
Topogram will not overwrite source files in the repo.

## 2. Inspect

```bash
topogram agent brief --json
topogram sdlc policy explain --json
topogram check --json
topogram query list --json
```

Agents should start from the brief, then use focused query packets instead of
reading the whole graph.

## 3. Add Topogram source

Edit `topo/**` to describe the project. For small projects, flat folders are
fine. For larger projects, use domain folders under `topo/` as a human and
agent convention; the parser still flattens all statements into one graph.

Use `topogram emit` to inspect contracts, reports, snapshots, and plans:

```bash
topogram emit <target> ./topo --json
```

Use `topogram generate` only after you deliberately configure generated-owned
outputs in `topogram.project.json`.

## 4. Before committing

```bash
topogram check . --json
topogram sdlc check --strict
topogram sdlc prep commit . --json
```

If SDLC is enforced, protected changes need an SDLC item, a `topo/sdlc/**`
record update, or an explicit allowed exemption.
