# Fresh Install

This page moved to [Initialize Maintained Repo](./start/init-maintained.md) and
[Greenfield Generate](./start/greenfield-generate.md).

For an existing or maintained repo:

```bash
npm install --save-dev @topogram/cli
npx topogram init . --with-sdlc
topogram check --json
```

For a generated starter:

```bash
npm install --save-dev @topogram/cli
npx topogram doctor
npx topogram template list
npx topogram copy hello-web ./my-app
cd ./my-app
npm install
npm run check
npm run generate
npm --prefix app run compile
```

Use `topogram init .` instead of `topogram copy` when the repository already
exists and you want Topogram to track it as maintained source without copying a
template or generating app code. Add `--with-sdlc` when the repo should enforce
SDLC linkage from the first commit.
