import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const engineRoot = path.join(repoRoot, "engine");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "app-basic");
const invalidFixtureRoot = path.join(engineRoot, "tests", "fixtures", "invalid", "missing-reference");
const executableTemplateRoot = path.join(engineRoot, "tests", "fixtures", "templates", "web-api-db");
const importFixtureRoot = path.join(engineRoot, "tests", "fixtures", "import");

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [path.join(engineRoot, "src", "cli.js"), ...args], {
    cwd: options.cwd || engineRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {}),
      PATH: options.env?.PATH || process.env.PATH || ""
    }
  });
}

test("agent brief returns stable JSON and does not write an app", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-agent-brief-"));
  const result = runCli(["agent", "brief", fixtureRoot, "--json"], { cwd });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.type, "agent_brief");
  assert.equal(payload.version, "1");
  assert.equal(payload.project.root, "<repo>");
  assert.equal(payload.template.includesExecutableImplementation, true);
  assert.ok(payload.read_order.some((item) => item.path === "topogram.project.json"));
  assert.ok(payload.first_commands.some((item) => item.command === "npm run agent:brief"));
  assert.ok(payload.edit_boundaries.output_boundaries.some((output) => output.path === "./app" && output.ownership === "generated"));
  assert.ok(payload.topology.runtimes.some((runtime) => runtime.id === "app_sveltekit" && runtime.kind === "web_surface"));
  assert.ok(payload.warnings.some((warning) => /Generated-owned outputs/.test(warning)));
  assert.equal(fs.existsSync(path.join(cwd, "app")), false);
  assert.equal(fs.existsSync(path.join(fixtureRoot, "app")), false);
});

test("agent brief human output includes operational sections", () => {
  const result = runCli(["agent", "brief", fixtureRoot]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Topogram agent brief/);
  assert.match(result.stdout, /Read order:/);
  assert.match(result.stdout, /First commands:/);
  assert.match(result.stdout, /Edit boundaries:/);
  assert.match(result.stdout, /Topology:/);
  assert.match(result.stdout, /Verification gates:/);
  assert.match(result.stdout, /Machine-readable source: topogram agent brief --json/);
});

test("agent brief fails invalid Topogram paths with validation diagnostics", () => {
  const result = runCli(["agent", "brief", invalidFixtureRoot, "--json"]);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /Missing reference 'entity_missing'/);
  assert.equal(result.stdout, "");
});

test("agent brief reports executable template trust without importing implementation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-agent-template-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["copy", executableTemplateRoot, projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.writeFileSync(
    path.join(projectRoot, "implementation", "index.js"),
    "throw new Error('agent brief imported implementation unexpectedly');\n",
    "utf8"
  );

  const result = runCli(["agent", "brief", "--json"], { cwd: projectRoot });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.type, "agent_brief");
  assert.equal(payload.template.id, "topogram/web-api-db");
  assert.equal(payload.template.includesExecutableImplementation, true);
  assert.equal(payload.trust.requiresTrust, true);
  assert.equal(payload.trust.ok, false);
  assert.ok(payload.warnings.some((warning) => /implementation\/ exists/.test(warning)));
  assert.ok(payload.warnings.some((warning) => /\.topogram-template-trust\.json/.test(warning)));
});

test("agent brief gives JSON-first extract guidance with workspaceRoot", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-agent-import-"));
  const projectRoot = path.join(root, "imported");
  const importResult = runCli([
    "extract",
    path.join(importFixtureRoot, "route-fallback"),
    "--out",
    projectRoot,
    "--from",
    "api,ui",
    "--json"
  ]);
  assert.equal(importResult.status, 0, importResult.stderr || importResult.stdout);

  const result = runCli(["agent", "brief", projectRoot, "--json"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.type, "agent_brief");
  assert.match(payload.extract.workspaceRoot, /^<workspace>$|^<repo>\/topo$|^<external>\/topo$/);
  assert.ok(payload.first_commands.some((item) => item.command === "topogram extract check . --json"));
  assert.ok(payload.first_commands.some((item) => item.command === "topogram extract status . --json"));
  const importWorkflow = payload.workflows.find((workflow) => workflow.id === "brownfield-extract");
  assert.ok(importWorkflow);
  assert.deepEqual(importWorkflow.commands, [
    "topogram extract check . --json",
    "topogram extract plan . --json",
    "topogram adopt --list . --json",
    "topogram extract status . --json",
    "topogram extract history . --verify --json"
  ]);
  assert.match(importWorkflow.rule, /workspaceRoot/);

  const human = runCli(["agent", "brief", projectRoot]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /\.topogram-extract\.json/);
  assert.match(human.stdout, /Workspace root: .*\/topo/);
  assert.match(human.stdout, /JSON extract commands expose workspaceRoot/);
});

test("agent help documents the briefing command", () => {
  const result = runCli(["agent", "--help"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: topogram agent brief \[path\] \[--json\]/);
  assert.match(result.stdout, /does not write files/);
});
