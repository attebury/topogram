import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parsePath } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { loadProjectConfig, validateProjectConfig } from "../../src/project-config.js";
import {
  GENERATOR_MANIFESTS,
  validateGeneratorManifest,
  validateGeneratorRegistry
} from "../../src/generator/registry.js";
import {
  generateWithRuntimeGenerator,
  getBundledGeneratorAdapter
} from "../../src/generator/adapters.js";
import { generateEnvironmentPlan } from "../../src/generator/runtime/environment.js";
import { resolveRuntimeTopology } from "../../src/generator/runtime/shared.js";
import { resolveWorkspaceContext } from "../../src/workspace-paths.js";
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writePackageBackedGenerator(root, manifestOverrides = {}) {
  const packageName = manifestOverrides.package || "@scope/topogram-generator-smoke-web";
  const packageRoot = path.join(root, "node_modules", ...packageName.split("/"));
  fs.mkdirSync(packageRoot, { recursive: true });
  const manifest = {
    id: "@scope/smoke-web",
    version: "1",
    surface: "web",
    projectionTypes: ["web_surface"],
    runtimeKinds: ["web_surface"],
    inputs: ["ui-surface-contract"],
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

function writeGeneratorPolicy(root, policy) {
  writeJson(path.join(root, "topogram.generator-policy.json"), {
    version: "0.1",
    allowedPackageScopes: ["@topogram"],
    allowedPackages: [],
    pinnedVersions: {},
    ...policy
  });
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
    projectionTypes: [],
    inputs: "ui-surface-contract",
    outputs: [],
    stack: null,
    capabilities: [],
    widgetSupport: {
      patterns: "resource_table",
      behaviors: [1],
      unsupported: "ignore"
    },
    source: "package"
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /version/);
  assert.match(result.errors.join("\n"), /projectionTypes/);
  assert.match(result.errors.join("\n"), /inputs/);
  assert.match(result.errors.join("\n"), /stack/);
  assert.match(result.errors.join("\n"), /capabilities/);
  assert.match(result.errors.join("\n"), /widgetSupport\.patterns/);
  assert.match(result.errors.join("\n"), /widgetSupport\.behaviors/);
  assert.match(result.errors.join("\n"), /widgetSupport\.unsupported/);
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
  assert.equal(packagePayload.executesPackageCode, true);
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
  assert.match(human.stdout, /Executes package code: yes \(loads adapter and runs smoke generate\)/);
  assert.match(human.stdout, /Smoke output:/);
});

test("topogram generator list and show describe bundled and installed package generators", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-discovery-"));
  const { packageName } = writePackageBackedGenerator(root, {
    id: "@topogram/generator-smoke-web",
    package: "@topogram/generator-smoke-web"
  });
  writeJson(path.join(root, "package.json"), {
    private: true,
    devDependencies: {
      [packageName]: "0.1.0"
    }
  });

  const list = runCli(["generator", "list", "--json"], { cwd: root });
  assert.equal(list.status, 0, list.stderr || list.stdout);
  const listPayload = JSON.parse(list.stdout);
  assert.equal(listPayload.ok, true);
  assert.equal(listPayload.generators.some((generator) => generator.id === "topogram/react" && generator.source === "bundled"), true);
  const packageGenerator = listPayload.generators.find((generator) => generator.id === "@topogram/generator-smoke-web");
  assert.equal(packageGenerator.package, packageName);
  assert.equal(packageGenerator.installed, true);
  assert.equal(packageGenerator.loadsAdapter, false);
  assert.equal(packageGenerator.executesPackageCode, false);
  assert.equal(packageGenerator.surface, "web");

  const bundledShow = runCli(["generator", "show", "topogram/react", "--json"], { cwd: root });
  assert.equal(bundledShow.status, 0, bundledShow.stderr || bundledShow.stdout);
  const bundledPayload = JSON.parse(bundledShow.stdout);
  assert.equal(bundledPayload.ok, true);
  assert.equal(bundledPayload.generator.id, "topogram/react");
  assert.equal(bundledPayload.exampleTopologyBinding.kind, "web_surface");
  assert.equal(bundledPayload.exampleTopologyBinding.generator.id, "topogram/react");

  const packageShow = runCli(["generator", "show", packageName, "--json"], { cwd: root });
  assert.equal(packageShow.status, 0, packageShow.stderr || packageShow.stdout);
  const packagePayload = JSON.parse(packageShow.stdout);
  assert.equal(packagePayload.ok, true);
  assert.equal(packagePayload.generator.id, "@topogram/generator-smoke-web");
  assert.equal(packagePayload.generator.package, packageName);
  assert.equal(packagePayload.generator.loadsAdapter, false);
  assert.equal(packagePayload.generator.executesPackageCode, false);
  assert.equal(packagePayload.generator.installCommand, `npm install -D ${packageName}`);
  assert.equal(packagePayload.exampleTopologyBinding.generator.package, packageName);

  const humanList = runCli(["generator", "list"], { cwd: root });
  assert.equal(humanList.status, 0, humanList.stderr || humanList.stdout);
  assert.match(humanList.stdout, /package-backed: 1; installed:/);
  assert.match(humanList.stdout, /Source: package/);
  assert.match(humanList.stdout, /Adapter loaded: no/);
  assert.match(humanList.stdout, /Executes package code: no/);
  assert.match(humanList.stdout, /Installed: yes/);
  assert.match(humanList.stdout, new RegExp(`Install: npm install -D ${packageName.replace("/", "\\/")}`));

  const human = runCli(["generator", "show", "topogram/react"], { cwd: root });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Generator: topogram\/react@1/);
  assert.match(human.stdout, /Example topology binding:/);

  const humanPackage = runCli(["generator", "show", packageName], { cwd: root });
  assert.equal(humanPackage.status, 0, humanPackage.stderr || humanPackage.stdout);
  assert.match(humanPackage.stdout, /Generator: @topogram\/generator-smoke-web@1/);
  assert.match(humanPackage.stdout, /Source: package/);
  assert.match(humanPackage.stdout, /Adapter loaded: no/);
  assert.match(humanPackage.stdout, /Executes package code: no/);
  assert.match(humanPackage.stdout, /Installed: yes/);
  assert.match(humanPackage.stdout, new RegExp(`Install: npm install -D ${packageName.replace("/", "\\/")}`));
  assert.match(humanPackage.stdout, /Example topology binding:/);
});

test("topogram generator list and show report missing package install commands", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-missing-discovery-"));
  const packageName = "@scope/topogram-generator-missing";
  writeJson(path.join(root, "package.json"), {
    private: true,
    devDependencies: {
      [packageName]: "0.1.0"
    }
  });

  const list = runCli(["generator", "list"], { cwd: root });
  assert.notEqual(list.status, 0);
  assert.match(list.stdout, /@scope\/topogram-generator-missing/);
  assert.match(list.stdout, /Installed: no/);
  assert.match(list.stdout, /Install: npm install -D @scope\/topogram-generator-missing/);

  const show = runCli(["generator", "show", packageName], { cwd: root });
  assert.notEqual(show.status, 0);
  assert.match(show.stdout, /Generator not found/);
  assert.match(show.stdout, /npm install -D @scope\/topogram-generator-missing/);
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

test("topogram generator check rejects generated paths outside the package output root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-check-path-escape-"));
  writeJson(path.join(root, "package.json"), { private: true });
  const { packageName, packageRoot } = writePackageBackedGenerator(root);
  fs.writeFileSync(
    path.join(packageRoot, "index.cjs"),
    "exports.manifest = require('./topogram-generator.json'); exports.generate = () => ({ files: { '../escape.txt': 'unsafe\\n' } });\n",
    "utf8"
  );

  const checked = runCli(["generator", "check", packageName, "--json"], { cwd: root });
  assert.notEqual(checked.status, 0, checked.stdout);
  const payload = JSON.parse(checked.stdout);
  assert.equal(payload.ok, false);
  assert.match(payload.errors.join("\n"), /generated file paths must be non-empty relative paths/);
});

function copyFixtureTopogram() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-project-"));
  const topogramRoot = path.join(root, "topo");
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
  const loadedProjectConfig = loadProjectConfig(fixtureRoot);
  assert.equal(loadedProjectConfig?.config.topology.components, undefined);
  assert.equal(loadedProjectConfig?.config.topology.runtimes.some((runtime) => (
    Object.hasOwn(runtime, "type") ||
    Object.hasOwn(runtime, "api") ||
    Object.hasOwn(runtime, "database")
  )), false);

  const human = runCli(["check", fixtureRoot]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Topogram check passed/);
  assert.match(human.stdout, /Project topology:/);
  assert.match(human.stdout, /app_api: api_service proj_api via topogram\/hono@1 \(port 3000\) -> uses_database app_postgres/);
  assert.match(human.stdout, /app_sveltekit calls_api app_api/);

  const json = runCli(["check", fixtureRoot, "--json"]);
  assert.equal(json.status, 0, json.stderr || json.stdout);
  const payload = JSON.parse(json.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.project.valid, true);
  assert.equal(payload.project.topology.runtimes.length, 3);
  assert.deepEqual(payload.project.resolvedTopology.outputs, [
    {
      name: "app",
      path: "./app",
      ownership: "generated"
    }
  ]);
  assert.deepEqual(payload.project.resolvedTopology.runtimes.map((runtime) => ({
    id: runtime.id,
    kind: runtime.kind,
    projection: runtime.projection,
    generator: runtime.generator,
    port: runtime.port,
    references: runtime.references
  })), [
    {
      id: "app_api",
      kind: "api_service",
      projection: "proj_api",
      generator: { id: "topogram/hono", version: "1" },
      port: 3000,
      references: { uses_api: null, uses_database: "app_postgres" }
    },
    {
      id: "app_postgres",
      kind: "database",
      projection: "proj_db_postgres",
      generator: { id: "topogram/postgres", version: "1" },
      port: 5432,
      references: { uses_api: null, uses_database: null }
    },
    {
      id: "app_sveltekit",
      kind: "web_surface",
      projection: "proj_web_surface",
      generator: { id: "topogram/sveltekit", version: "1" },
      port: 5173,
      references: { uses_api: "app_api", uses_database: null }
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

test("project config validation catches invalid workspace paths", () => {
  const graph = appBasicGraph();
  const absolute = appBasicProjectConfig();
  absolute.workspace = "/tmp/topo";
  const escaping = appBasicProjectConfig();
  escaping.workspace = "../topo";
  const empty = appBasicProjectConfig();
  empty.workspace = "";
  const unsupported = appBasicProjectConfig();
  unsupported.workspaces = ["./topo"];

  const messages = [
    ...validateProjectConfig(absolute, graph).errors,
    ...validateProjectConfig(escaping, graph).errors,
    ...validateProjectConfig(empty, graph).errors,
    ...validateProjectConfig(unsupported, graph).errors
  ].map((error) => error.message).join("\n");

  assert.match(messages, /workspace must be relative to the project root/);
  assert.match(messages, /workspace must not escape the project root/);
  assert.match(messages, /workspace must be a non-empty relative path/);
  assert.match(messages, /workspaces\[\] is not supported yet/);
});

test("workspace resolution keeps explicit nested topo projects inside repo checkouts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-nested-workspace-"));
  const nestedProject = path.join(root, "fixtures", "sample");
  const nestedTopo = path.join(nestedProject, "topo");
  fs.mkdirSync(nestedTopo, { recursive: true });
  writeJson(path.join(root, "topogram.project.json"), {
    version: "0.1",
    workspace: "./topo",
    outputs: {
      app: {
        path: ".",
        ownership: "maintained"
      }
    },
    topology: {
      runtimes: []
    }
  });
  fs.writeFileSync(path.join(nestedTopo, "domain.tg"), [
    "domain dom_nested {",
    "  name \"Nested\"",
    "  description \"Nested workspace\"",
    "  status active",
    "}",
    ""
  ].join("\n"));

  try {
    const resolved = resolveWorkspaceContext(nestedProject);
    assert.equal(resolved.projectRoot, nestedProject);
    assert.equal(resolved.topoRoot, nestedTopo);
    assert.equal(resolved.configPath, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("project config validation catches unknown generators, duplicate ports, and missing refs", () => {
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  config.topology.runtimes[0].generator.id = "topogram/missing";
  config.topology.runtimes[1].port = config.topology.runtimes[0].port;
  config.topology.runtimes[1].uses_api = "missing_api";

  const result = validateProjectConfig(config, graph);

  assert.equal(result.ok, false);
  assert.match(result.errors.map((error) => error.message).join("\n"), /unknown generator/);
  assert.match(result.errors.map((error) => error.message).join("\n"), /Port 3000/);
  assert.match(result.errors.map((error) => error.message).join("\n"), /missing api runtime/);
});

test("project config validation allows optional api database and web api references", () => {
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  delete config.topology.runtimes[0].uses_database;
  delete config.topology.runtimes[1].uses_api;

  const result = validateProjectConfig(config, graph);

  assert.equal(result.ok, true);
});

test("project config validation catches incompatible and planned generators", () => {
  const graph = appBasicGraph();
  const incompatible = appBasicProjectConfig();
  incompatible.topology.runtimes[0].generator.id = "topogram/sveltekit";
  const planned = appBasicProjectConfig();
  planned.topology.runtimes[1].generator.id = "topogram/android-compose";
  const unsupported = appBasicProjectConfig();
  unsupported.topology.runtimes[0].generator.version = "999";

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
  writeGeneratorPolicy(root, { allowedPackageScopes: ["@scope"] });
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  const webRuntime = config.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit");
  webRuntime.generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };

  const result = validateProjectConfig(config, graph, { configDir: root });

  assert.equal(result.ok, true, result.errors.map((error) => error.message).join("\n"));
});

test("project config validation enforces package-backed generator policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-policy-"));
  const { packageName } = writePackageBackedGenerator(root);
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  const webRuntime = config.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit");
  webRuntime.generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };

  const defaultResult = validateProjectConfig(config, graph, { configDir: root });
  assert.equal(defaultResult.ok, false);
  assert.match(defaultResult.errors.map((error) => error.message).join("\n"), /not allowed by topogram\.generator-policy\.json/);
  assert.match(defaultResult.errors.map((error) => error.message).join("\n"), /topogram generator policy pin @scope\/topogram-generator-smoke-web@1/);

  writeGeneratorPolicy(root, { allowedPackageScopes: ["@scope"] });
  const allowedResult = validateProjectConfig(config, graph, { configDir: root });
  assert.equal(allowedResult.ok, true, allowedResult.errors.map((error) => error.message).join("\n"));

  writeGeneratorPolicy(root, { allowedPackageScopes: ["@scope"], pinnedVersions: { [packageName]: "2" } });
  const pinnedResult = validateProjectConfig(config, graph, { configDir: root });
  assert.equal(pinnedResult.ok, false);
  assert.match(pinnedResult.errors.map((error) => error.message).join("\n"), /pins '@scope\/topogram-generator-smoke-web' to '2'/);
});

test("package-backed adapter resolution enforces generator policy before package import", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-policy-before-import-"));
  const { packageName, packageRoot } = writePackageBackedGenerator(root);
  const markerPath = path.join(root, "adapter-import-side-effect.txt");
  fs.writeFileSync(
    path.join(packageRoot, "index.cjs"),
    `require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "loaded\\n", "utf8");
exports.manifest = require("./topogram-generator.json");
exports.generate = () => ({ files: { "index.html": "<h1>loaded</h1>\\n" }, diagnostics: [] });
`,
    "utf8"
  );
  const context = {
    graph: {},
    projection: { id: "proj_web_surface", type: "web_surface" },
    runtime: {
      id: "app_web",
      kind: "web_surface",
      projection: "proj_web_surface",
      generator: {
        id: "@scope/smoke-web",
        version: "1",
        package: packageName
      }
    },
    topology: null,
    implementation: null,
    contracts: {
      uiWeb: {
        projection: { id: "proj_web_surface", type: "web_surface" },
        screens: []
      }
    },
    options: { configDir: root }
  };

  assert.throws(
    () => generateWithRuntimeGenerator(context),
    /not allowed by topogram\.generator-policy\.json/
  );
  assert.equal(fs.existsSync(markerPath), false, "denied package adapter must not be imported");

  writeGeneratorPolicy(root, { allowedPackages: [packageName] });
  const result = generateWithRuntimeGenerator(context);
  assert.equal(result.files["index.html"], "<h1>loaded</h1>\n");
  assert.equal(fs.existsSync(markerPath), true, "allowed package adapter should import and run");
});

test("runtime topology exposes canonical runtime relationships with legacy aliases", () => {
  const topology = resolveRuntimeTopology(appBasicGraph(), {
    projectConfig: appBasicProjectConfig(),
    implementation: APP_BASIC_IMPLEMENTATION
  });

  assert.equal(topology.apiRuntimes.length, 1);
  assert.equal(topology.webRuntimes.length, 1);
  assert.equal(topology.dbRuntimes.length, 1);
  assert.equal(topology.apiComponents, topology.apiRuntimes);
  assert.equal(topology.webComponents, topology.webRuntimes);
  assert.equal(topology.dbComponents, topology.dbRuntimes);
  assert.equal(topology.primaryApi.databaseRuntime.id, "app_postgres");
  assert.equal(topology.primaryApi.databaseComponent, topology.primaryApi.databaseRuntime);
  assert.equal(topology.primaryWeb.apiRuntime.id, "app_api");
  assert.equal(topology.primaryWeb.apiComponent, topology.primaryWeb.apiRuntime);
});

test("package-backed adapters receive canonical runtime links and compatibility aliases", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-runtime-context-"));
  const { packageName, packageRoot } = writePackageBackedGenerator(root);
  const capturePath = path.join(root, "adapter-runtime-context.json");
  fs.writeFileSync(
    path.join(packageRoot, "index.cjs"),
    `exports.manifest = require("./topogram-generator.json");
exports.generate = (context) => {
  require("node:fs").writeFileSync(${JSON.stringify(capturePath)}, JSON.stringify({
    runtimeId: context.runtime.id,
    apiRuntime: context.runtime.apiRuntime && context.runtime.apiRuntime.id,
    apiComponent: context.runtime.apiComponent && context.runtime.apiComponent.id
  }, null, 2));
  return { files: { "index.html": "<h1>runtime</h1>\\n" }, diagnostics: [] };
};
`,
    "utf8"
  );
  writeGeneratorPolicy(root, { allowedPackages: [packageName] });
  const result = generateWithRuntimeGenerator({
    graph: {},
    projection: { id: "proj_web_surface", type: "web_surface" },
    runtime: {
      id: "app_web",
      kind: "web_surface",
      projection: "proj_web_surface",
      apiComponent: { id: "app_api", kind: "api_service" },
      generator: {
        id: "@scope/smoke-web",
        version: "1",
        package: packageName
      }
    },
    topology: null,
    implementation: null,
    contracts: { uiSurface: { projection: { id: "proj_web_surface", type: "web_surface" }, screens: [] } },
    options: { configDir: root }
  });

  assert.equal(result.files["index.html"], "<h1>runtime</h1>\n");
  assert.deepEqual(readJson(capturePath), {
    runtimeId: "app_web",
    apiRuntime: "app_api",
    apiComponent: "app_api"
  });
});

test("project config validation rejects missing and mismatched package-backed generators", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-generator-invalid-"));
  const { packageName } = writePackageBackedGenerator(root, { id: "@scope/other-web" });
  const graph = appBasicGraph();
  const missing = appBasicProjectConfig();
  const missingRuntime = missing.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit");
  missingRuntime.generator = {
    id: "@scope/missing-web",
    version: "1",
    package: "@scope/topogram-generator-missing"
  };
  const mismatched = appBasicProjectConfig();
  const mismatchedRuntime = mismatched.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit");
  mismatchedRuntime.generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };

  const missingResult = validateProjectConfig(missing, graph, { configDir: root });
  const mismatchedResult = validateProjectConfig(mismatched, graph, { configDir: root });

  assert.equal(missingResult.ok, false);
  assert.match(missingResult.errors.map((error) => error.message).join("\n"), /could not be resolved/);
  assert.match(missingResult.errors.map((error) => error.message).join("\n"), /npm install -D @scope\/topogram-generator-missing/);
  assert.equal(mismatchedResult.ok, false);
  assert.match(mismatchedResult.errors.map((error) => error.message).join("\n"), /does not match binding/);
});

test("topogram check reports install command for missing package-backed generator", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-generator-check-missing-"));
  const projectRoot = path.join(root, "workspace");
  fs.cpSync(fixtureRoot, projectRoot, { recursive: true });
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const config = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  const webRuntime = config.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit");
  webRuntime.generator = {
    id: "@scope/missing-web",
    version: "1",
    package: "@scope/topogram-generator-missing"
  };
  writeJson(projectConfigPath, config);
  writeGeneratorPolicy(projectRoot, { allowedPackageScopes: ["@scope"] });

  const human = runCli(["check", "."], { cwd: projectRoot });
  assert.notEqual(human.status, 0);
  assert.match(human.stderr, /Runtime 'app_sveltekit'/);
  assert.match(human.stderr, /npm install -D @scope\/topogram-generator-missing/);

  const json = runCli(["check", ".", "--json"], { cwd: projectRoot });
  assert.notEqual(json.status, 0);
  const payload = JSON.parse(json.stdout);
  assert.equal(payload.ok, false);
  assert.equal(
    payload.errors.some((error) => /npm install -D @scope\/topogram-generator-missing/.test(error.message)),
    true
  );
});

test("topogram generator policy commands explain defaults, blocked packages, and pins", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-policy-cli-"));
  const projectRoot = path.join(root, "workspace");
  fs.cpSync(fixtureRoot, projectRoot, { recursive: true });
  const { packageName } = writePackageBackedGenerator(projectRoot);
  writeJson(path.join(projectRoot, "package.json"), {
    private: true,
    devDependencies: {
      [packageName]: "0.1.0"
    }
  });
  writeJson(path.join(projectRoot, "package-lock.json"), {
    name: "policy-smoke",
    lockfileVersion: 3,
    packages: {
      "": {
        devDependencies: {
          [packageName]: "0.1.0"
        }
      },
      [`node_modules/${packageName}`]: {
        version: "0.1.0",
        resolved: `https://registry.npmjs.org/${packageName}/-/${packageName.split("/").pop()}-0.1.0.tgz`
      }
    }
  });
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const config = readJson(projectConfigPath);
  const webRuntime = config.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit");
  webRuntime.generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };
  writeJson(projectConfigPath, config);
  fs.rmSync(path.join(projectRoot, "topogram.generator-policy.json"), { force: true });

  const defaultDenied = runCli(["generator", "policy", "check", "--json"], { cwd: projectRoot });
  assert.notEqual(defaultDenied.status, 0, defaultDenied.stdout);
  const defaultDeniedPayload = JSON.parse(defaultDenied.stdout);
  assert.equal(defaultDeniedPayload.exists, false);
  assert.equal(defaultDeniedPayload.defaulted, true);
  assert.equal(defaultDeniedPayload.diagnostics.some((diagnostic) => diagnostic.code === "generator_policy_missing" && diagnostic.severity === "warning"), true);
  assert.equal(defaultDeniedPayload.diagnostics.some((diagnostic) => diagnostic.code === "generator_package_denied"), true);
  assert.equal(defaultDeniedPayload.diagnostics.some((diagnostic) => diagnostic.packageVersion === "0.1.0"), true);
  assert.equal(defaultDeniedPayload.bindings[0].packageInfo.installedVersion, "0.1.0");
  assert.equal(defaultDeniedPayload.bindings[0].packageInfo.dependencyField, "devDependencies");
  assert.equal(defaultDeniedPayload.bindings[0].packageInfo.dependencySpec, "0.1.0");
  assert.equal(defaultDeniedPayload.bindings[0].packageInfo.lockfileVersion, "0.1.0");

  const statusDenied = runCli(["generator", "policy", "status", "--json"], { cwd: projectRoot });
  assert.notEqual(statusDenied.status, 0, statusDenied.stdout);
  const statusDeniedPayload = JSON.parse(statusDenied.stdout);
  assert.equal(statusDeniedPayload.summary.packageBackedGenerators, 1);
  assert.equal(statusDeniedPayload.summary.denied, 1);
  assert.equal(statusDeniedPayload.bindings[0].allowed, false);
  assert.equal(statusDeniedPayload.bindings[0].packageInfo.installedVersion, "0.1.0");

  const humanStatus = runCli(["generator", "policy", "status"], { cwd: projectRoot });
  assert.notEqual(humanStatus.status, 0, humanStatus.stdout);
  assert.match(humanStatus.stdout, /Generator policy status: denied/);
  assert.match(humanStatus.stdout, /npm package: 0\.1\.0/);
  assert.match(humanStatus.stdout, /dependency: devDependencies 0\.1\.0/);

  const humanDenied = runCli(["generator", "policy", "explain"], { cwd: projectRoot });
  assert.notEqual(humanDenied.status, 0, humanDenied.stdout);
  assert.match(humanDenied.stdout, /Generator policy: denied/);
  assert.match(humanDenied.stdout, /FAIL Allowed package/);
  assert.match(humanDenied.stdout, /topogram generator policy pin @scope\/topogram-generator-smoke-web@1/);

  const init = runCli(["generator", "policy", "init", "--json"], { cwd: projectRoot });
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const initPayload = JSON.parse(init.stdout);
  assert.deepEqual(initPayload.policy.allowedPackageScopes, ["@topogram"]);

  const stillDenied = runCli(["generator", "policy", "check", "--json"], { cwd: projectRoot });
  assert.notEqual(stillDenied.status, 0, stillDenied.stdout);
  assert.equal(
    JSON.parse(stillDenied.stdout).diagnostics.some((diagnostic) => diagnostic.code === "generator_package_denied"),
    true
  );

  const pinMismatch = runCli(["generator", "policy", "pin", `${packageName}@2`, "--json"], { cwd: projectRoot });
  assert.equal(pinMismatch.status, 0, pinMismatch.stderr || pinMismatch.stdout);
  const pinMismatchPayload = JSON.parse(pinMismatch.stdout);
  assert.deepEqual(pinMismatchPayload.policy.allowedPackageScopes, ["@topogram"]);
  assert.equal(pinMismatchPayload.policy.allowedPackages.includes(packageName), true);
  const mismatchCheck = runCli(["check", ".", "--json"], { cwd: projectRoot });
  assert.notEqual(mismatchCheck.status, 0, mismatchCheck.stdout);
  const mismatchPayload = JSON.parse(mismatchCheck.stdout);
  assert.equal(mismatchPayload.errors.some((error) => /pins '@scope\/topogram-generator-smoke-web' to '2'/.test(error.message)), true);

  const pinCurrent = runCli(["generator", "policy", "pin", "--json"], { cwd: projectRoot });
  assert.equal(pinCurrent.status, 0, pinCurrent.stderr || pinCurrent.stdout);
  const currentPayload = JSON.parse(pinCurrent.stdout);
  assert.equal(currentPayload.pinned.some((pin) => pin.packageName === packageName && pin.version === "1"), true);
  assert.deepEqual(currentPayload.policy.allowedPackageScopes, ["@topogram"]);
  assert.equal(currentPayload.policy.allowedPackages.includes(packageName), true);
  const finalCheck = runCli(["check", "."], { cwd: projectRoot });
  assert.equal(finalCheck.status, 0, finalCheck.stderr || finalCheck.stdout);

  const siblingConfig = readJson(projectConfigPath);
  siblingConfig.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit").generator = {
    id: "@scope/other-web",
    version: "1",
    package: "@scope/topogram-generator-other-web"
  };
  writeJson(projectConfigPath, siblingConfig);
  const siblingPolicyCheck = runCli(["generator", "policy", "check", "--json"], { cwd: projectRoot });
  assert.notEqual(siblingPolicyCheck.status, 0, siblingPolicyCheck.stdout);
  const siblingPolicyPayload = JSON.parse(siblingPolicyCheck.stdout);
  assert.equal(
    siblingPolicyPayload.diagnostics.some((diagnostic) =>
      diagnostic.code === "generator_package_denied" &&
      diagnostic.packageName === "@scope/topogram-generator-other-web"
    ),
    true
  );
});

test("topogram generator policy status reports non-npm lockfiles without pretending versions are inspected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-policy-pnpm-"));
  const projectRoot = path.join(root, "workspace");
  fs.cpSync(fixtureRoot, projectRoot, { recursive: true });
  const { packageName } = writePackageBackedGenerator(projectRoot);
  writeJson(path.join(projectRoot, "package.json"), {
    private: true,
    devDependencies: {
      [packageName]: "0.1.0"
    }
  });
  fs.writeFileSync(path.join(projectRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  writeGeneratorPolicy(projectRoot, { allowedPackageScopes: ["@scope"] });
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const config = readJson(projectConfigPath);
  config.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit").generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };
  writeJson(projectConfigPath, config);

  const status = runCli(["generator", "policy", "status", "--json"], { cwd: projectRoot });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.bindings[0].packageInfo.lockfileKind, "pnpm");
  assert.equal(payload.bindings[0].packageInfo.lockfileVersion, null);
  assert.match(payload.bindings[0].packageInfo.lockfilePath, /pnpm-lock\.yaml$/);
  assert.match(payload.bindings[0].packageInfo.lockfileNote, /package versions are not inspected/);

  const human = runCli(["generator", "policy", "status"], { cwd: projectRoot });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /lockfile: pnpm-lock\.yaml \(version not inspected\)/);
});

test("missing generator policy defaults allow installed @topogram package generators", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-policy-default-"));
  const projectRoot = path.join(root, "workspace");
  fs.cpSync(fixtureRoot, projectRoot, { recursive: true });
  const { packageName } = writePackageBackedGenerator(projectRoot, {
    id: "@topogram/generator-smoke-web",
    package: "@topogram/generator-smoke-web"
  });
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const config = readJson(projectConfigPath);
  const webRuntime = config.topology.runtimes.find((runtime) => runtime.id === "app_sveltekit");
  webRuntime.generator = {
    id: "@topogram/generator-smoke-web",
    version: "1",
    package: packageName
  };
  writeJson(projectConfigPath, config);
  fs.rmSync(path.join(projectRoot, "topogram.generator-policy.json"), { force: true });

  const check = runCli(["check", ".", "--json"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const policyCheck = runCli(["generator", "policy", "check", "--json"], { cwd: projectRoot });
  assert.equal(policyCheck.status, 0, policyCheck.stderr || policyCheck.stdout);
  const policyPayload = JSON.parse(policyCheck.stdout);
  assert.equal(policyPayload.defaulted, true);
  assert.equal(policyPayload.diagnostics.some((diagnostic) => diagnostic.code === "generator_policy_missing" && diagnostic.severity === "warning"), true);
});

test("malformed generator policy blocks project checks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-policy-invalid-"));
  const projectRoot = path.join(root, "workspace");
  fs.cpSync(fixtureRoot, projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "topogram.generator-policy.json"), "{", "utf8");

  const policyCheck = runCli(["generator", "policy", "check", "--json"], { cwd: projectRoot });
  assert.notEqual(policyCheck.status, 0, policyCheck.stdout);
  const policyPayload = JSON.parse(policyCheck.stdout);
  assert.equal(policyPayload.diagnostics.some((diagnostic) => diagnostic.code === "generator_policy_invalid"), true);

  const check = runCli(["check", ".", "--json"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.errors.some((error) => /topogram\.generator-policy\.json/.test(error.message)), true);
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

test("environment plans support multiple api services and database lifecycle runtimes", () => {
  const graph = appBasicGraph();
  const config = appBasicProjectConfig();
  config.topology.runtimes.push(
    {
      id: "internal_api",
      kind: "api_service",
      projection: "proj_api",
      generator: { id: "topogram/express", version: "1" },
      port: 3001,
      uses_database: "audit_db"
    },
    {
      id: "audit_db",
      kind: "database",
      projection: "proj_db_sqlite",
      generator: { id: "topogram/sqlite", version: "1" },
      port: null
    }
  );

  const plan = generateEnvironmentPlan(graph, {
    implementation: APP_BASIC_IMPLEMENTATION,
    projectConfig: config
  });

  assert.deepEqual(plan.runtimes.apis.map((entry) => entry.id), ["app_api", "internal_api"]);
  assert.deepEqual(plan.runtimes.databases.map((entry) => entry.id), ["app_postgres", "audit_db"]);
  assert.equal(plan.runtimes.apis[1].port, 3001);
  assert.equal(plan.runtimes.databases[1].dir, "db/audit_db");
});
