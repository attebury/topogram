import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { validateProjectConfig } from "../../src/project-config.js";
import {
  GENERATOR_MANIFESTS,
  validateGeneratorManifest,
  validateGeneratorRegistry
} from "../../src/generator/registry.js";
import { getBundledGeneratorAdapter } from "../../src/generator/adapters.js";
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writePackageBackedGenerator(root, manifestOverrides = {}) {
  const packageName = manifestOverrides.package || "@scope/topogram-generator-smoke-web";
  const packageRoot = path.join(root, "node_modules", ...packageName.split("/"));
  fs.mkdirSync(packageRoot, { recursive: true });
  const manifest = {
    id: "@scope/smoke-web",
    version: "1",
    surface: "web",
    projectionPlatforms: ["ui_web"],
    inputs: ["ui-web-contract"],
    outputs: ["web-app"],
    stack: {
      runtime: "browser",
      framework: "smoke",
      language: "javascript"
    },
    capabilities: {
      routes: true
    },
    source: "package",
    package: packageName,
    ...manifestOverrides
  };
  writeJson(path.join(packageRoot, "topogram-generator.json"), manifest);
  writeJson(path.join(packageRoot, "package.json"), {
    name: packageName,
    version: "0.1.0",
    main: "index.cjs",
    exports: {
      ".": "./index.cjs",
      "./topogram-generator.json": "./topogram-generator.json"
    }
  });
  fs.writeFileSync(path.join(packageRoot, "index.cjs"), "exports.manifest = require('./topogram-generator.json'); exports.generate = () => ({ files: {} });\n", "utf8");
  return { packageName, packageRoot, manifest };
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

test("bundled generator manifests are valid and have adapters", () => {
  const registry = validateGeneratorRegistry();
  assert.equal(registry.ok, true, registry.errors.join("\n"));

  for (const manifest of GENERATOR_MANIFESTS) {
    assert.equal(manifest.source, "bundled");
    assert.equal(["api", "web", "database", "native"].includes(manifest.surface), true);
    assert.equal(Array.isArray(manifest.inputs), true);
    assert.equal(Array.isArray(manifest.outputs), true);
    assert.equal(typeof manifest.stack, "object");
    assert.equal(typeof manifest.capabilities, "object");
    if (!manifest.planned) {
      assert.equal(getBundledGeneratorAdapter(manifest.id)?.manifest.id, manifest.id);
    }
  }
});

test("generator manifest validation rejects malformed manifests", () => {
  const result = validateGeneratorManifest({
    id: "topogram/bad",
    version: "",
    surface: "web",
    projectionPlatforms: [],
    inputs: "ui-web-contract",
    outputs: [],
    stack: null,
    capabilities: [],
    source: "package"
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /version/);
  assert.match(result.errors.join("\n"), /projectionPlatforms/);
  assert.match(result.errors.join("\n"), /inputs/);
  assert.match(result.errors.join("\n"), /stack/);
  assert.match(result.errors.join("\n"), /capabilities/);
  assert.match(result.errors.join("\n"), /package source/);
});

test("topogram generator check validates package-backed generators by package and path", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-check-"));
  writeJson(path.join(root, "package.json"), { private: true });
  const { packageName, packageRoot } = writePackageBackedGenerator(root);

  const byPackage = runCli(["generator", "check", packageName, "--json"], { cwd: root });
  assert.equal(byPackage.status, 0, byPackage.stderr || byPackage.stdout);
  const packagePayload = JSON.parse(byPackage.stdout);
  assert.equal(packagePayload.ok, true);
  assert.equal(packagePayload.source, "package");
  assert.equal(packagePayload.packageName, packageName);
  assert.equal(packagePayload.manifest.id, "@scope/smoke-web");
  assert.equal(packagePayload.checks.some((check) => check.name === "smoke-generate" && check.ok), true);

  const byPath = runCli(["generator", "check", packageRoot, "--json"], { cwd: root });
  assert.equal(byPath.status, 0, byPath.stderr || byPath.stdout);
  const pathPayload = JSON.parse(byPath.stdout);
  assert.equal(pathPayload.ok, true);
  assert.equal(pathPayload.source, "path");
  assert.equal(pathPayload.packageRoot, packageRoot);

  const human = runCli(["generator", "check", packageRoot], { cwd: root });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Generator check passed/);
  assert.match(human.stdout, /Smoke output:/);
});

test("topogram generator check rejects invalid adapter exports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-check-invalid-"));
  writeJson(path.join(root, "package.json"), { private: true });
  const { packageName, packageRoot } = writePackageBackedGenerator(root);
  fs.writeFileSync(path.join(packageRoot, "index.cjs"), "exports.manifest = require('./topogram-generator.json');\n", "utf8");

  const checked = runCli(["generator", "check", packageName, "--json"], { cwd: root });
  assert.notEqual(checked.status, 0, checked.stdout);
  const payload = JSON.parse(checked.stdout);
  assert.equal(payload.ok, false);
  assert.match(payload.errors.join("\n"), /generate\(context\)/);
});

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
  assert.match(human.stdout, /Project topology:/);
  assert.match(human.stdout, /app_api: api proj_api via topogram\/hono@1 \(port 3000\) -> database app_postgres/);
  assert.match(human.stdout, /app_sveltekit calls_api app_api/);

  const json = runCli(["check", fixtureRoot, "--json"]);
  assert.equal(json.status, 0, json.stderr || json.stdout);
  const payload = JSON.parse(json.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.project.valid, true);
  assert.equal(payload.project.topology.components.length, 3);
  assert.deepEqual(payload.project.resolvedTopology.outputs, [
    {
      name: "app",
      path: "./app",
      ownership: "generated"
    }
  ]);
  assert.deepEqual(payload.project.resolvedTopology.components.map((component) => ({
    id: component.id,
    type: component.type,
    projection: component.projection,
    generator: component.generator,
    port: component.port,
    references: component.references
  })), [
    {
      id: "app_api",
      type: "api",
      projection: "proj_api",
      generator: { id: "topogram/hono", version: "1" },
      port: 3000,
      references: { api: null, database: "app_postgres" }
    },
    {
      id: "app_postgres",
      type: "database",
      projection: "proj_db_postgres",
      generator: { id: "topogram/postgres", version: "1" },
      port: 5432,
      references: { api: null, database: null }
    },
    {
      id: "app_sveltekit",
      type: "web",
      projection: "proj_ui_web",
      generator: { id: "topogram/sveltekit", version: "1" },
      port: 5173,
      references: { api: "app_api", database: null }
    }
  ]);
  assert.deepEqual(payload.project.resolvedTopology.edges, [
    {
      from: "app_api",
      to: "app_postgres",
      type: "uses_database"
    },
    {
      from: "app_sveltekit",
      to: "app_api",
      type: "calls_api"
    }
  ]);
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

test("project config validation allows optional api database and web api references", () => {
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  delete config.topology.components[0].database;
  delete config.topology.components[1].api;

  const result = validateProjectConfig(config, graph);

  assert.equal(result.ok, true);
});

test("project config validation catches incompatible and planned generators", () => {
  const graph = appBasicGraph();
  const incompatible = appBasicProjectConfig();
  incompatible.topology.components[0].generator.id = "topogram/sveltekit";
  const planned = appBasicProjectConfig();
  planned.topology.components[1].generator.id = "topogram/android-compose";
  const unsupported = appBasicProjectConfig();
  unsupported.topology.components[0].generator.version = "999";

  const incompatibleResult = validateProjectConfig(incompatible, graph);
  const plannedResult = validateProjectConfig(planned, graph);
  const unsupportedResult = validateProjectConfig(unsupported, graph);

  assert.equal(incompatibleResult.ok, false);
  assert.match(incompatibleResult.errors.map((error) => error.message).join("\n"), /incompatible/);
  assert.equal(plannedResult.ok, false);
  assert.match(plannedResult.errors.map((error) => error.message).join("\n"), /planned generator/);
  assert.equal(unsupportedResult.ok, false);
  assert.match(unsupportedResult.errors.map((error) => error.message).join("\n"), /unsupported; expected '1'/);
});

test("project config validation resolves installed package-backed generator manifests", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-generator-"));
  const { packageName } = writePackageBackedGenerator(root);
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  const webComponent = config.topology.components.find((component) => component.id === "app_sveltekit");
  webComponent.generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };

  const result = validateProjectConfig(config, graph, { configDir: root });

  assert.equal(result.ok, true, result.errors.map((error) => error.message).join("\n"));
});

test("project config validation rejects missing and mismatched package-backed generators", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-generator-invalid-"));
  const { packageName } = writePackageBackedGenerator(root, { id: "@scope/other-web" });
  const graph = appBasicGraph();
  const missing = appBasicProjectConfig();
  const missingWeb = missing.topology.components.find((component) => component.id === "app_sveltekit");
  missingWeb.generator = {
    id: "@scope/missing-web",
    version: "1",
    package: "@scope/topogram-generator-missing"
  };
  const mismatched = appBasicProjectConfig();
  const mismatchedWeb = mismatched.topology.components.find((component) => component.id === "app_sveltekit");
  mismatchedWeb.generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };

  const missingResult = validateProjectConfig(missing, graph, { configDir: root });
  const mismatchedResult = validateProjectConfig(mismatched, graph, { configDir: root });

  assert.equal(missingResult.ok, false);
  assert.match(missingResult.errors.map((error) => error.message).join("\n"), /could not be resolved/);
  assert.equal(mismatchedResult.ok, false);
  assert.match(mismatchedResult.errors.map((error) => error.message).join("\n"), /does not match binding/);
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
