import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { validateProjectConfig } from "../../src/project-config.js";
import { generateEnvironmentPlan } from "../../src/generator/runtime/environment.js";
import { APP_BASIC_IMPLEMENTATION } from "../fixtures/workspaces/app-basic/implementation/index.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const engineRoot = path.join(repoRoot, "engine");
const cliPath = path.join(engineRoot, "src", "cli.js");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "app-basic");

function appBasicGraph() {
  const parsed = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(parsed);
  assert.equal(resolved.ok, true);
  return resolved.graph;
}

function appBasicProjectConfig() {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, "topogram.project.json"), "utf8"));
}

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-project-"));
  const topogramRoot = path.join(root, "topogram");
  fs.cpSync(fixtureRoot, topogramRoot, { recursive: true });
  const implementationModule = path
    .relative(fs.realpathSync(topogramRoot), path.join(fixtureRoot, "implementation", "index.js"))
    .replace(/\\/g, "/");
  const projectConfigPath = path.join(topogramRoot, "topogram.project.json");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  projectConfig.implementation.module = implementationModule;
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");
  return { root, topogramRoot };
}

test("topogram check reports a valid project config in human and JSON modes", () => {
  const human = runCli(["check", fixtureRoot]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Topogram check passed/);

  const json = runCli(["check", fixtureRoot, "--json"]);
  assert.equal(json.status, 0, json.stderr || json.stdout);
  const payload = JSON.parse(json.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.project.valid, true);
  assert.equal(payload.project.topology.components.length, 3);
});

test("topogram check supports legacy implementation compatibility fallback", () => {
  const { topogramRoot } = copyFixtureTopogram();
  fs.rmSync(path.join(topogramRoot, "topogram.project.json"), { force: true });
  fs.writeFileSync(
    path.join(topogramRoot, "topogram.implementation.json"),
    `${JSON.stringify({
      implementation_id: "app-basic-fixture",
      implementation_module: path
        .relative(fs.realpathSync(topogramRoot), path.join(fixtureRoot, "implementation", "index.js"))
        .replace(/\\/g, "/"),
      implementation_export: "APP_BASIC_IMPLEMENTATION"
    }, null, 2)}\n`,
    "utf8"
  );

  const result = runCli(["check", topogramRoot, "--json"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.project.compatibility, true);
});

test("project config validation catches unknown generators, duplicate ports, and missing refs", () => {
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  config.topology.components[0].generator.id = "topogram/missing";
  config.topology.components[1].port = config.topology.components[0].port;
  config.topology.components[1].api = "missing_api";

  const result = validateProjectConfig(config, graph);

  assert.equal(result.ok, false);
  assert.match(result.errors.map((error) => error.message).join("\n"), /unknown generator/);
  assert.match(result.errors.map((error) => error.message).join("\n"), /Port 3000/);
  assert.match(result.errors.map((error) => error.message).join("\n"), /missing api component/);
});

test("project config validation catches incompatible and planned generators", () => {
  const graph = appBasicGraph();
  const incompatible = appBasicProjectConfig();
  incompatible.topology.components[0].generator.id = "topogram/sveltekit";
  const planned = appBasicProjectConfig();
  planned.topology.components[1].generator.id = "topogram/android-compose";

  const incompatibleResult = validateProjectConfig(incompatible, graph);
  const plannedResult = validateProjectConfig(planned, graph);

  assert.equal(incompatibleResult.ok, false);
  assert.match(incompatibleResult.errors.map((error) => error.message).join("\n"), /incompatible/);
  assert.equal(plannedResult.ok, false);
  assert.match(plannedResult.errors.map((error) => error.message).join("\n"), /planned generator/);
});

test("maintained app outputs are refused for generated app writes", () => {
  const { root, topogramRoot } = copyFixtureTopogram();
  const projectConfigPath = path.join(topogramRoot, "topogram.project.json");
  const config = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  config.outputs.app.path = "../app";
  config.outputs.app.ownership = "maintained";
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const result = runCli(["generate", "app", topogramRoot, "--out", path.join(root, "app")]);

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /maintained output/);
  assert.equal(fs.existsSync(path.join(root, "app")), false);
});

test("topogram check flags generated outputs without generated ownership sentinel", () => {
  const { topogramRoot } = copyFixtureTopogram();
  const outputRoot = path.join(topogramRoot, "app");
  fs.mkdirSync(outputRoot);
  fs.writeFileSync(path.join(outputRoot, "package.json"), "{}\n", "utf8");

  const result = runCli(["check", topogramRoot]);

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /missing \.topogram-generated\.json/);
});

test("environment plans support multiple api services and database lifecycle components", () => {
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  config.topology.components.push(
    {
      id: "internal_api",
      type: "api",
      projection: "proj_api",
      generator: { id: "topogram/express", version: "1" },
      port: 3001,
      database: "audit_db"
    },
    {
      id: "audit_db",
      type: "database",
      projection: "proj_db_sqlite",
      generator: { id: "topogram/sqlite", version: "1" },
      port: null
    }
  );

  const plan = generateEnvironmentPlan(graph, {
    implementation: APP_BASIC_IMPLEMENTATION,
    projectConfig: config
  });

  assert.deepEqual(plan.components.apis.map((entry) => entry.id), ["app_api", "internal_api"]);
  assert.deepEqual(plan.components.databases.map((entry) => entry.id), ["app_postgres", "audit_db"]);
  assert.equal(plan.components.apis[1].port, 3001);
  assert.equal(plan.components.databases[1].dir, "db/audit_db");
});
