import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { generateWorkspace } from "../../src/generator.js";
import { parsePath } from "../../src/parser.js";
import { loadImplementationProvider } from "../../src/example-implementation.js";
import { writeTemplateTrustRecord } from "../../src/template-trust/record.js";
import { repoRootFromCliModuleUrl } from "../../src/cli/output-safety.js";
import { replaceKnownPathSubstrings } from "../../src/public-paths.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const engineRoot = path.join(repoRoot, "engine");
const cliPath = path.join(engineRoot, "src", "cli.js");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "app-basic");

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd || engineRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
}

function copyFixtureTopogram() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-review-"));
  const topogramRoot = path.join(root, "topo");
  fs.cpSync(fixtureRoot, topogramRoot, { recursive: true });
  rewriteCopiedImplementationImports(topogramRoot);
  const projectConfigPath = path.join(topogramRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  projectConfig.implementation = {
    id: "app-basic-fixture",
    module: "./implementation/index.js",
    export: "APP_BASIC_IMPLEMENTATION"
  };
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");
  writeTemplateTrustRecord(topogramRoot, projectConfig);
  return { root, topogramRoot };
}

function rewriteCopiedImplementationImports(topogramRoot) {
  const rendererPath = path.join(topogramRoot, "implementation", "web", "renderers.js");
  const replacements = new Map([
    [
      "../../../../../../src/generator/surfaces/web/sveltekit-actions.js",
      pathToFileURL(path.join(engineRoot, "src", "generator", "surfaces", "web", "sveltekit-actions.js")).href
    ],
    [
      "../../../../../../src/generator/surfaces/web/sveltekit-widgets.js",
      pathToFileURL(path.join(engineRoot, "src", "generator", "surfaces", "web", "sveltekit-widgets.js")).href
    ]
  ]);
  let text = fs.readFileSync(rendererPath, "utf8");
  for (const [from, to] of replacements) {
    text = text.replaceAll(from, to);
  }
  fs.writeFileSync(rendererPath, text, "utf8");
}

function expectRefusedOutput(args, markerPath, options = {}) {
  const result = runCli(args, options);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /Refusing to replace/);
  assert.equal(fs.readFileSync(markerPath, "utf8"), "keep\n");
}

function assertNoMachineLocalPaths(text, label) {
  assert.doesNotMatch(text, /\/Users\//, label);
  assert.doesNotMatch(text, /\/home\//, label);
  assert.doesNotMatch(text, /\/private\/tmp\//, label);
  assert.doesNotMatch(text, /\/var\/folders\//, label);
  assert.doesNotMatch(text, /\/tmp\/topogram-/i, label);
  assert.doesNotMatch(text, /[A-Za-z]:\\Users\\/i, label);
}

test("validate normalizes a demo root to its topo child", () => {
  const { root } = copyFixtureTopogram();
  fs.writeFileSync(path.join(root, "invalid-root.tg"), "this is not a topogram statement\n", "utf8");

  const result = runCli(["validate", root]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated \d+ file\(s\)/);
});

test("generate app normalizes a demo root and writes a sentinel", () => {
  const { root } = copyFixtureTopogram();
  const outDir = path.join(root, "app");

  const result = runCli(["generate", "app", root, "--out", outDir]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(outDir, ".topogram-generated.json")), true);
});

test("CLI repo root resolution handles encoded module file URLs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram root #"));
  const fakeCliModule = path.join(root, "engine", "src", "cli", "output-safety.js");
  const moduleUrl = pathToFileURL(fakeCliModule).href;

  assert.equal(repoRootFromCliModuleUrl(moduleUrl), path.resolve(root));
});

test("public path replacement only matches whole path segments", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-review-"));
  const context = {
    projectRoot: root,
    workspaceRoot: path.join(root, "topo")
  };

  assert.equal(
    replaceKnownPathSubstrings(path.join(root, "topogram.project.json"), context),
    "<repo>/topogram.project.json"
  );
  assert.equal(
    replaceKnownPathSubstrings(path.join(root, "topo", "widgets", "example.tg"), context),
    "<workspace>/widgets/example.tg"
  );
});

test("app generation requires an explicit implementation provider", () => {
  const { topogramRoot } = copyFixtureTopogram();
  fs.rmSync(path.join(topogramRoot, "topogram.project.json"), { force: true });
  fs.rmSync(path.join(topogramRoot, "implementation"), { recursive: true, force: true });

  const result = runCli(["generate", "app", topogramRoot, "--out", path.join(path.dirname(topogramRoot), "app")]);

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /requires an explicit implementation provider/);
});

test("configured fixture provider loads without importing demos", async () => {
  const provider = await loadImplementationProvider(fixtureRoot);

  assert.equal(provider.exampleId, "app-basic-fixture");
  assert.equal(provider.runtime.reference.appBundle.name, "Topogram Sample Workspace App Bundle");
});

test("implementation providers outside implementation root are refused without import", async () => {
  const { root, topogramRoot } = copyFixtureTopogram();
  const markerPath = path.join(root, "outside-provider-imported.txt");
  const outsideDir = path.join(topogramRoot, "other");
  fs.mkdirSync(outsideDir, { recursive: true });
  fs.writeFileSync(
    path.join(outsideDir, "index.js"),
    [
      "import fs from 'node:fs';",
      `fs.writeFileSync(${JSON.stringify(markerPath)}, 'imported\\n', 'utf8');`,
      "export const APP_BASIC_IMPLEMENTATION = { exampleId: 'outside' };"
    ].join("\n"),
    "utf8"
  );
  fs.rmSync(path.join(topogramRoot, ".topogram-template-trust.json"), { force: true });
  const projectConfigPath = path.join(topogramRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  delete projectConfig.template;
  projectConfig.implementation.module = "./other/index.js";
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");

  await assert.rejects(
    () => loadImplementationProvider(topogramRoot),
    /must be under implementation\//
  );
  assert.equal(fs.existsSync(markerPath), false);
});

test("generateWorkspace does not use an app-basic provider implicitly", () => {
  const parsed = parsePath(fixtureRoot);

  assert.throws(
    () => generateWorkspace(parsed, { target: "app-bundle" }),
    /requires an explicit implementation provider/
  );
});

test("unsafe output directories are refused before deletion", () => {
  const { root, topogramRoot } = copyFixtureTopogram();
  const marker = path.join(root, "marker.txt");
  fs.writeFileSync(marker, "keep\n", "utf8");

  expectRefusedOutput(["generate", "app", root, "--out", "."], marker, { cwd: root });
  expectRefusedOutput(["generate", "app", root, "--out", repoRoot], marker);
  expectRefusedOutput(["generate", "app", root, "--out", os.homedir()], marker);
  expectRefusedOutput(["generate", "app", root, "--out", topogramRoot], marker);
  expectRefusedOutput(["generate", "app", root, "--out", root], marker);
});

test("non-empty output without sentinel is refused and left intact", () => {
  const { root } = copyFixtureTopogram();
  const outDir = path.join(root, "app");
  fs.mkdirSync(outDir);
  const marker = path.join(outDir, "existing.txt");
  fs.writeFileSync(marker, "keep\n", "utf8");

  expectRefusedOutput(["generate", "app", root, "--out", outDir], marker);
});

test("generated contracts do not contain machine-local paths", () => {
  const { root } = copyFixtureTopogram();
  const outDir = path.join(root, "app");
  const result = runCli(["generate", "app", root, "--out", outDir]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(next);
      } else {
        files.push(next);
      }
    }
  };
  visit(outDir);

  for (const file of files) {
    const contents = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(contents, /\/Users\//, file);
    assert.doesNotMatch(contents, /graphRoot/, file);
    assert.doesNotMatch(contents, /engine\/src\/cli\.js/, file);
  }
});

test("public JSON outputs use portable paths", () => {
  const { root, topogramRoot } = copyFixtureTopogram();
  const outputs = [];

  for (const [label, args, options] of [
    ["check", ["check", root, "--json"], {}],
    ["check human", ["check", root], {}],
    ["agent brief", ["agent", "brief", root, "--json"], {}],
    ["widget check", ["widget", "check", topogramRoot, "--json"], {}],
    ["emit widget report", ["emit", "widget-conformance-report", topogramRoot, "--json"], {}],
    ["generator policy status human", ["generator", "policy", "status", topogramRoot], {}],
    ["generator list", ["generator", "list", "--json"], { cwd: root }],
    ["extractor list", ["extractor", "list", "--json"], { cwd: root }],
    ["template explain json", ["template", "explain", topogramRoot, "--json"], {}],
    ["template explain human", ["template", "explain", topogramRoot], {}],
    ["template detach json", ["template", "detach", topogramRoot, "--dry-run", "--json"], {}],
    ["template detach human", ["template", "detach", topogramRoot, "--dry-run"], {}]
  ]) {
    const result = runCli(args, options);
    assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    outputs.push([label, result.stdout]);
  }

  const generatedApp = path.join(root, "generated-app");
  const generateApp = runCli(["generate", "app", root, "--out", generatedApp]);
  assert.equal(generateApp.status, 0, `generate app\nstdout:\n${generateApp.stdout}\nstderr:\n${generateApp.stderr}`);
  outputs.push(["generate app human", generateApp.stdout]);

  const copyTarget = path.join(root, "copied-template");
  const copyTemplate = runCli(["copy", path.join(engineRoot, "tests", "fixtures", "templates", "hello-web"), copyTarget], { cwd: root });
  assert.equal(copyTemplate.status, 0, `copy template\nstdout:\n${copyTemplate.stdout}\nstderr:\n${copyTemplate.stderr}`);
  outputs.push(["copy template human", copyTemplate.stdout]);

  const extractSource = path.join(engineRoot, "tests", "fixtures", "import", "route-fallback");
  const extractTarget = path.join(root, "extracted");
  const extract = runCli(["extract", extractSource, "--out", extractTarget, "--from", "api,ui", "--json"]);
  assert.equal(extract.status, 0, extract.stderr || extract.stdout);
  outputs.push(["extract", extract.stdout]);

  const plan = runCli(["extract", "plan", extractTarget, "--json"]);
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  outputs.push(["extract plan", plan.stdout]);

  const adoptList = runCli(["adopt", "--list", extractTarget, "--json"]);
  assert.equal(adoptList.status, 0, adoptList.stderr || adoptList.stdout);
  outputs.push(["adopt list", adoptList.stdout]);

  for (const [label, output] of outputs) {
    assertNoMachineLocalPaths(output, label);
    assert.match(output, /<repo>|<workspace>|<external>|topo\//, label);
  }
});
