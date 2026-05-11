import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const engineRoot = path.join(repoRoot, "engine");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "app-basic");
const expectedRoot = path.join(engineRoot, "tests", "fixtures", "expected", "app-basic");
const builtInTemplateRoot = path.join(engineRoot, "tests", "fixtures", "templates", "web-api-db");
const fixtureTemplatesRoot = path.join(engineRoot, "tests", "fixtures", "templates");
const npmCacheRoot = path.join(os.tmpdir(), "topogram-generated-app-workflow-npm-cache");
fs.mkdirSync(npmCacheRoot, { recursive: true });
const cliPackageVersion = JSON.parse(fs.readFileSync(path.join(engineRoot, "package.json"), "utf8")).version;
const externalTodoCatalogAlias = "todo";
const externalTodoTemplatePackageName = "@topogram/template-todo";
const externalTodoTemplateVersion = "0.1.6";
const firstPartyGeneratorRepos = [
  "topogram-generator-express-api",
  "topogram-generator-hono-api",
  "topogram-generator-postgres-db",
  "topogram-generator-react-web",
  "topogram-generator-sqlite-db",
  "topogram-generator-sveltekit-web",
  "topogram-generator-swiftui-native",
  "topogram-generator-vanilla-web"
];
const externalTodoConsumerRepos = ["topogram-template-todo", "topogram-demo-todo"];
const knownCliConsumerRepos = [
  ...firstPartyGeneratorRepos,
  "topogram-starters",
  ...externalTodoConsumerRepos,
  "topogram-hello",
  "topograms"
];
const packageUpdateCliCheckScripts = [
  "cli:surface",
  "doctor",
  "catalog:show",
  "catalog:template-show",
  "check",
  "pack:check",
  "verify"
];
const packageUpdateCliPreferredScripts = [
  "cli:surface",
  "doctor",
  "catalog:show",
  "catalog:template-show",
  "verify"
];

function externalTodoTemplatePackageSpec(version = externalTodoTemplateVersion) {
  return `${externalTodoTemplatePackageName}@${version}`;
}

function literalPattern(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

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

function runNpm(args, cwd, options = {}) {
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  return childProcess.spawnSync(npmBin, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {}),
      PATH: options.env?.PATH || process.env.PATH || ""
    }
  });
}

function writePackageJson(root, pkg) {
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\s+$/, "\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
  writePackageJson(packageRoot, {
    name: packageName,
    version: "0.1.0",
    main: "index.cjs",
    exports: {
      ".": "./index.cjs",
      "./topogram-generator.json": "./topogram-generator.json",
      "./package.json": "./package.json"
    }
  });
  fs.writeFileSync(path.join(packageRoot, "index.cjs"), `exports.manifest = require("./topogram-generator.json");
exports.generate = function generateSmokeWeb(context) {
  return {
    files: {
      "package.json": JSON.stringify({
        name: "package-backed-smoke-web",
        private: true,
        scripts: {
          compile: "node -e \\"console.log('compile')\\"",
          smoke: "node -e \\"console.log('smoke')\\"",
          "runtime-check": "node -e \\"console.log('runtime-check')\\"",
          runtime: "node -e \\"console.log('runtime')\\""
        }
      }, null, 2) + "\\n",
      "index.html": "<!doctype html><h1 data-generator=\\"" + context.manifest.id + "\\">Package generator smoke</h1>\\n",
      "contract.json": JSON.stringify({ projection: context.projection.id, screens: context.contracts.uiSurface.screens.length }, null, 2) + "\\n"
    },
    artifacts: {
      generator: context.manifest.id
    },
    diagnostics: []
  };
};
`, "utf8");
  return { packageName, packageRoot, manifest };
}

function writePackageBackedNativeGenerator(root, manifestOverrides = {}) {
  const packageName = manifestOverrides.package || "@scope/topogram-generator-smoke-native";
  const packageRoot = path.join(root, "node_modules", ...packageName.split("/"));
  fs.mkdirSync(packageRoot, { recursive: true });
  const manifest = {
    id: "@scope/smoke-native",
    version: "1",
    surface: "native",
    projectionTypes: ["ios_surface"],
    runtimeKinds: ["ios_surface"],
    inputs: ["ui-surface-contract", "api-contracts"],
    outputs: ["native-app"],
    stack: {
      platform: "ios",
      framework: "smoke",
      language: "swift"
    },
    capabilities: {
      routes: true
    },
    source: "package",
    package: packageName,
    ...manifestOverrides
  };
  writeJson(path.join(packageRoot, "topogram-generator.json"), manifest);
  writePackageJson(packageRoot, {
    name: packageName,
    version: "0.1.0",
    main: "index.cjs",
    exports: {
      ".": "./index.cjs",
      "./topogram-generator.json": "./topogram-generator.json",
      "./package.json": "./package.json"
    }
  });
  fs.writeFileSync(path.join(packageRoot, "index.cjs"), `exports.manifest = require("./topogram-generator.json");
exports.generate = function generateSmokeNative(context) {
  return {
    files: {
      "Package.swift": "// swift-tools-version: 5.9\\nimport PackageDescription\\nlet package = Package(name: \\"SmokeNative\\", targets: [.executableTarget(name: \\"SmokeNative\\")])\\n",
      "Sources/SmokeNative/main.swift": "print(\\"Smoke native\\")\\n",
      "Sources/SmokeNative/Resources/ui-surface-contract.json": JSON.stringify(context.contracts.uiSurface, null, 2) + "\\n",
      "Sources/SmokeNative/Resources/api-contracts.json": JSON.stringify(context.contracts.api, null, 2) + "\\n"
    },
    artifacts: {
      generator: context.manifest.id,
      apiContractCount: Object.keys(context.contracts.api || {}).length
    },
    diagnostics: []
  };
};
`, "utf8");
  return { packageName, packageRoot, manifest };
}

function copyBuiltInTemplate(root, name = "template") {
  const templateRoot = path.join(root, name);
  fs.cpSync(builtInTemplateRoot, templateRoot, { recursive: true });
  return templateRoot;
}

function copyAppBasicFixture(root, name = "app-basic") {
  const workspaceRoot = path.join(root, name);
  fs.cpSync(fixtureRoot, workspaceRoot, { recursive: true });
  const rendererPath = path.join(workspaceRoot, "implementation", "web", "renderers.js");
  fs.writeFileSync(
    rendererPath,
    fs.readFileSync(rendererPath, "utf8").replaceAll("../../../../../../src/", `${engineRoot}/src/`),
    "utf8"
  );
  return workspaceRoot;
}

test("topogram version reports package and runtime details", () => {
  const human = runCli(["version"]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, new RegExp(`Topogram CLI: @topogram/cli@${cliPackageVersion.replaceAll(".", "\\.")}`));
  assert.match(human.stdout, /Executable: /);
  assert.match(human.stdout, new RegExp(`Node: ${process.version.replaceAll(".", "\\.")}`));

  const json = runCli(["version", "--json"]);
  assert.equal(json.status, 0, json.stderr || json.stdout);
  const payload = JSON.parse(json.stdout);
  assert.equal(payload.packageName, "@topogram/cli");
  assert.equal(payload.version, cliPackageVersion);
  assert.equal(payload.executablePath, path.join(engineRoot, "src", "cli.js"));
  assert.equal(payload.nodeVersion, process.version);
});

function createCatalog(root, entries) {
  fs.mkdirSync(root, { recursive: true });
  const catalogPath = path.join(root, "topograms.catalog.json");
  writeJson(catalogPath, {
    version: "0.1",
    entries
  });
  return catalogPath;
}

function sampleTemplateCatalogEntry(overrides = {}) {
  return {
    id: "sample-template",
    kind: "template",
    package: "@scope/topogram-template-sample",
    defaultVersion: "0.1.0",
    description: "Sample starter",
    tags: ["sample", "template"],
    surfaces: ["web", "api", "database"],
    generators: ["topogram/sveltekit", "topogram/hono", "topogram/postgres"],
    stack: "SvelteKit + Hono + Postgres",
    trust: {
      scope: "@scope",
      includesExecutableImplementation: true,
      notes: "Test fixture package."
    },
    ...overrides
  };
}

test("generic catalog fixture helper stays product-neutral", () => {
  const entry = sampleTemplateCatalogEntry();
  const serialized = JSON.stringify(entry);
  assert.equal(entry.id, "sample-template");
  assert.equal(entry.package, "@scope/topogram-template-sample");
  assert.doesNotMatch(serialized, /topogram-template-todo|Todo starter|"todo"/);
});

test("external Todo fixture constants isolate intentional product coverage", () => {
  assert.equal(externalTodoCatalogAlias, "todo");
  assert.equal(externalTodoTemplatePackageName, "@topogram/template-todo");
  assert.equal(externalTodoTemplatePackageSpec(), "@topogram/template-todo@0.1.6");
  assert.deepEqual(externalTodoConsumerRepos, ["topogram-template-todo", "topogram-demo-todo"]);
});

function createPureTopogramPackage(root, name = "topogram-package", options = {}) {
  const packageRoot = path.join(root, name);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.cpSync(path.join(builtInTemplateRoot, "topo"), path.join(packageRoot, "topo"), { recursive: true });
  writeJson(path.join(packageRoot, "topogram.project.json"), {
    version: "0.1",
    outputs: {
      app: {
        path: "./app",
        ownership: "generated"
      }
    },
    topology: {
      widgets: []
    }
  });
  fs.writeFileSync(path.join(packageRoot, "README.md"), "# Test topogram package\n", "utf8");
  writePackageJson(packageRoot, {
    name: "@scope/topogram-hello",
    version: "0.1.0",
    private: true,
    files: ["topo", "topogram.project.json", "README.md"]
  });
  if (options.implementation) {
    fs.mkdirSync(path.join(packageRoot, "implementation"), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, "implementation", "index.js"), "export const unsafe = true;\n", "utf8");
  }
  return packageRoot;
}

function createFakeNpm(root) {
  const binDir = path.join(root, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const npmPath = path.join(binDir, "npm");
  fs.writeFileSync(npmPath, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write("10.0.0\\n");
  process.exit(0);
}
if (args[0] === "config" && args[1] === "get") {
  if (args[2] === "@topogram:registry") {
    process.stdout.write((process.env.FAKE_NPM_TOPOGRAM_REGISTRY || "undefined") + "\\n");
    process.exit(0);
  }
  process.stdout.write("undefined\\n");
  process.exit(0);
}
function packageNameFromSpec(spec) {
  if (spec.startsWith("@")) {
    const [scope, rest] = spec.split("/");
    const versionIndex = rest.indexOf("@");
    return path.join(scope, versionIndex >= 0 ? rest.slice(0, versionIndex) : rest);
  }
  const versionIndex = spec.indexOf("@");
  return versionIndex >= 0 ? spec.slice(0, versionIndex) : spec;
}
if (args[0] === "view") {
  const viewSpec = args.find((arg) => arg.startsWith("@") || /^[a-z0-9._-]+@/.test(arg) || arg.endsWith(".tgz")) || "";
  if (process.env.FAKE_NPM_VIEW_FAIL_SPEC && viewSpec.includes(process.env.FAKE_NPM_VIEW_FAIL_SPEC)) {
    process.stderr.write(process.env.FAKE_NPM_VIEW_FAIL_OUTPUT || "npm ERR! 403 Forbidden\\n");
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(process.env.FAKE_NPM_LATEST_VERSION || "0.2.0") + "\\n");
  process.exit(0);
}
if (args[0] === "install") {
  const prefixIndex = args.indexOf("--prefix");
  const spec = args.find((arg) => arg.startsWith("@") || arg.endsWith(".tgz")) || args[args.length - 1];
  if (prefixIndex < 0) {
    const packageName = packageNameFromSpec(spec).replace(/\\\\/g, "/");
    const versionMatch = spec.match(/@\\^?([^@/]+)$/);
    const version = versionMatch ? versionMatch[1] : "0.0.0";
    const packagePath = path.join(process.cwd(), "package.json");
    const pkg = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};
    pkg.devDependencies = { ...(pkg.devDependencies || {}), [packageName]: spec.startsWith(packageName + "@") ? spec.slice(packageName.length + 1) : spec };
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\\n");
    const lockPath = path.join(process.cwd(), "package-lock.json");
    fs.writeFileSync(lockPath, JSON.stringify({
      name: pkg.name || "consumer",
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": { name: pkg.name || "consumer", devDependencies: pkg.devDependencies },
        ["node_modules/" + packageName]: {
          version,
          dev: true,
          bin: { topogram: "src/cli.js" }
        }
      }
    }, null, 2) + "\\n");
    process.exit(0);
  }
  const prefix = args[prefixIndex + 1];
  const packageMap = process.env.FAKE_NPM_PACKAGES ? JSON.parse(process.env.FAKE_NPM_PACKAGES) : {};
  const source = packageMap[spec] ||
    packageMap[packageNameFromSpec(spec)] ||
    (spec.endsWith("@0.1.0") ? process.env.FAKE_TEMPLATE_INITIAL : process.env.FAKE_TEMPLATE_LATEST);
  if (!source) {
    process.stderr.write("No fake npm package source for " + spec + "\\n");
    process.exit(1);
  }
  const target = path.join(prefix, "node_modules", packageNameFromSpec(spec));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  process.exit(0);
}
if (args[0] === "run") {
  if (process.env.FAKE_NPM_RUN_LOG) {
    fs.appendFileSync(process.env.FAKE_NPM_RUN_LOG, args[1] + "\\n", "utf8");
  }
  if (process.env.FAKE_NPM_RUN_REAL === "1") {
    const childProcess = require("node:child_process");
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const script = pkg.scripts && pkg.scripts[args[1]];
    if (!script) {
      process.stderr.write("Missing script: " + args[1] + "\\n");
      process.exit(1);
    }
    const result = childProcess.spawnSync(script, {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      shell: true
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(typeof result.status === "number" ? result.status : 1);
  }
  process.stdout.write("ran " + args[1] + "\\n");
  process.exit(0);
}
process.stderr.write("Unexpected fake npm command: " + args.join(" ") + "\\n");
process.exit(1);
`, "utf8");
  fs.chmodSync(npmPath, 0o755);
  return binDir;
}

function createFailingCommand(root, name, stderr, status = 1) {
  const binDir = path.join(root, `bin-${name}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(binDir, { recursive: true });
  const commandPath = path.join(binDir, name);
  fs.writeFileSync(commandPath, `#!/usr/bin/env node
process.stderr.write(${JSON.stringify(stderr)});
process.exit(${status});
`, "utf8");
  fs.chmodSync(commandPath, 0o755);
  return binDir;
}

function createFakeGit(root, tag) {
  const binDir = path.join(root, `bin-git-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(binDir, { recursive: true });
  const commandPath = path.join(binDir, "git");
  fs.writeFileSync(commandPath, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const tag = ${JSON.stringify(tag)};
const statePath = ${JSON.stringify(path.join(root, "fake-git-state.json"))};
const logPath = ${JSON.stringify(path.join(root, "fake-git.log"))};
function readState() {
  return fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {};
}
function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\\n");
}
function log(command) {
  fs.appendFileSync(logPath, process.cwd() + " :: " + command + "\\n", "utf8");
}
if (args[0] === "tag" && args[1] === "--list") {
  if (args[2] === tag && process.env.FAKE_GIT_LOCAL_TAG !== "0") {
    process.stdout.write(tag + "\\n");
  }
  process.exit(0);
}
if (args[0] === "ls-remote" && args.includes("refs/tags/" + tag)) {
  if (process.env.FAKE_GIT_REMOTE_TAG === "0") {
    process.exit(2);
  }
  process.stdout.write("abc123\\trefs/tags/" + tag + "\\n");
  process.exit(0);
}
if (args[0] === "rev-parse" && args[1] === "HEAD") {
  process.stdout.write((process.env.FAKE_GIT_HEAD || "abc123") + "\\n");
  process.exit(0);
}
if (args[0] === "rev-list" && args[1] === "--count" && args[2] === "@{u}..HEAD") {
  process.stdout.write((process.env.FAKE_GIT_AHEAD || "0") + "\\n");
  process.exit(0);
}
if (args[0] === "status" && args[1] === "--porcelain") {
  process.stdout.write(process.env.FAKE_GIT_STATUS || "");
  process.exit(0);
}
if (args[0] === "add") {
  const state = readState();
  state.staged = process.env.FAKE_GIT_ADD_STAGES === "0" ? false : true;
  writeState(state);
  log(args.join(" "));
  process.exit(0);
}
if (args[0] === "diff" && args[1] === "--cached" && args[2] === "--quiet") {
  process.exit(readState().staged ? 1 : 0);
}
if (args[0] === "commit") {
  const state = readState();
  state.staged = false;
  state.committed = true;
  writeState(state);
  log(args.join(" "));
  process.stdout.write("[main " + (process.env.FAKE_GIT_HEAD || "abc123").slice(0, 7) + "] fake commit\\n");
  process.exit(0);
}
if (args[0] === "push") {
  log(args.join(" "));
  process.exit(0);
}
process.stderr.write("Unexpected fake git command: " + args.join(" ") + "\\n");
process.exit(1);
`, "utf8");
  fs.chmodSync(commandPath, 0o755);
  return binDir;
}

function createFakeGh(root, versions = []) {
  const binDir = path.join(root, `bin-gh-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(binDir, { recursive: true });
  const commandPath = path.join(binDir, "gh");
  fs.writeFileSync(commandPath, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const statePath = ${JSON.stringify(path.join(root, "fake-gh-state.json"))};
function readState() {
  return fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { runListCalls: 0 };
}
function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\\n");
}
if (args[0] === "run" && args[1] === "list") {
  const state = readState();
  const sequence = process.env.FAKE_GH_RUN_SEQUENCE ? JSON.parse(process.env.FAKE_GH_RUN_SEQUENCE) : null;
  const sequenceEntry = Array.isArray(sequence)
    ? sequence[Math.min(state.runListCalls || 0, sequence.length - 1)]
    : null;
  state.runListCalls = (state.runListCalls || 0) + 1;
  writeState(state);
  const workflowIndex = args.indexOf("--workflow");
  const workflowName = workflowIndex >= 0 ? args[workflowIndex + 1] : "Generator Verification";
  process.stdout.write(JSON.stringify([{
    databaseId: sequenceEntry?.databaseId || 12345,
    workflowName,
    status: sequenceEntry?.status || process.env.FAKE_GH_RUN_STATUS || "completed",
    conclusion: sequenceEntry?.conclusion || process.env.FAKE_GH_RUN_CONCLUSION || "success",
    headSha: sequenceEntry?.headSha || process.env.FAKE_GH_RUN_HEAD_SHA || process.env.FAKE_GIT_HEAD || "abc123",
    url: sequenceEntry?.url || "https://github.com/attebury/fake/actions/runs/12345"
  }]));
  process.exit(0);
}
if (args[0] === "run" && args[1] === "view") {
  const jobConclusion = process.env.FAKE_GH_JOB_CONCLUSION || "success";
  const jobStatus = process.env.FAKE_GH_JOB_STATUS || "completed";
  const jobs = process.env.FAKE_GH_JOBS
    ? JSON.parse(process.env.FAKE_GH_JOBS)
    : [
      "Validate catalog",
      "Smoke native starter",
      "Smoke starter alias (hello-web)",
      "Smoke starter alias (hello-api)",
      "Smoke starter alias (hello-db)",
      "Smoke starter alias (web-api)",
      "Smoke starter alias (web-api-db)"
    ].map((name, index) => ({
      databaseId: 2000 + index,
      name,
      status: jobStatus,
      conclusion: jobConclusion,
      url: "https://github.com/attebury/fake/actions/runs/12345/job/" + (2000 + index)
    }));
  process.stdout.write(JSON.stringify({ jobs }));
  process.exit(0);
}
if (args[0] === "api" && args.includes("/users/attebury/packages/npm/topogram/versions?per_page=30")) {
  process.stdout.write(${JSON.stringify(JSON.stringify(versions.map((version) => ({ name: version }))))});
  process.exit(0);
}
process.stderr.write("Unexpected fake gh command: " + args.join(" ") + "\\n");
process.exit(1);
`, "utf8");
  fs.chmodSync(commandPath, 0o755);
  return binDir;
}

function readJsonl(filePath) {
  return fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\n+/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
}

function writeKnownCliConsumerPins(root, version) {
  for (const consumer of knownCliConsumerRepos) {
    fs.mkdirSync(path.join(root, consumer), { recursive: true });
    fs.writeFileSync(path.join(root, consumer, "topogram-cli.version"), `${version}\n`, "utf8");
  }
}

test("public authoring-to-app commands check and generate app bundles", () => {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /topogram check \[path\]/);
  assert.match(help.stdout, /topogram generate \[path\]/);
  assert.match(help.stdout, new RegExp(`topogram new <path> \\[--template .*${externalTodoCatalogAlias}`));
  assert.match(help.stdout, /topogram release status/);
  assert.match(help.stdout, /topogram release roll-consumers --latest/);
  assert.match(help.stdout, /topogram setup package-auth/);
  assert.match(help.stdout, /topogram package update-cli <version\|--latest>/);
  assert.match(help.stdout, /topogram new \.\/my-app/);
  assert.match(help.stdout, literalPattern(`topogram new ./my-app --template ${externalTodoCatalogAlias}`));
  assert.match(help.stdout, /topogram widget check --projection proj_web_surface/);
  assert.match(help.stdout, /topogram widget behavior --projection proj_web_surface/);
  assert.match(help.stdout, /topogram query list/);
  assert.match(help.stdout, /topogram query widget-behavior \.\/topo --projection proj_web_surface --json/);
  assert.match(help.stdout, /topogram import \.\/existing-app --out \.\/imported-topogram/);
  assert.match(help.stdout, /topogram import check \.\/imported-topogram/);
  assert.match(help.stdout, /topogram import plan/);
  assert.match(help.stdout, /topogram import adopt/);
  assert.match(help.stdout, /topogram import adopt --list/);
  assert.match(help.stdout, /topogram import status/);
  assert.match(help.stdout, /topogram import history/);
  assert.match(help.stdout, /Fresh install:/);
  assert.match(help.stdout, /npm install --save-dev @topogram\/cli/);
  assert.match(help.stdout, /npx topogram doctor/);
  assert.match(help.stdout, /npx topogram template list/);
  assert.match(help.stdout, /npx topogram new \.\/my-app --template hello-web/);
  assert.match(help.stdout, /npm --prefix app run compile/);
  assert.match(help.stdout, /Template and catalog discovery:/);
  assert.match(help.stdout, literalPattern(`topogram catalog show ${externalTodoCatalogAlias}`));
  assert.match(help.stdout, /topogram source status/);
  assert.match(help.stdout, /topogram source status --remote/);
  assert.match(help.stdout, /topogram template list/);
  assert.match(help.stdout, /topogram template explain/);
  assert.doesNotMatch(help.stdout, literalPattern(`topogram template show ${externalTodoCatalogAlias}`));
  assert.match(help.stdout, /Default starter: hello-web/);
  assert.match(help.stdout, /topogram template status --latest/);
  assert.match(help.stdout, /topogram template policy explain/);
  assert.match(help.stdout, /topogram template check <template-spec-or-path>/);
  assert.doesNotMatch(help.stdout, /topogram create \.\/my-app/);
  assert.doesNotMatch(help.stdout, /topogram import app \.\/existing-app/);
  assert.doesNotMatch(help.stdout, /topogram build \[path\]/);
  assert.doesNotMatch(help.stdout, /query work-packet/);

  const fullHelp = runCli(["help", "all"]);
  assert.equal(fullHelp.status, 0, fullHelp.stderr || fullHelp.stdout);
  assert.match(fullHelp.stdout, /topogram create <path>/);
  assert.match(fullHelp.stdout, /topogram import app <path>/);
  assert.match(fullHelp.stdout, /query widget-behavior <path>/);
  assert.match(fullHelp.stdout, /query work-packet/);

  const generateHelp = runCli(["generate", "--help"]);
  assert.equal(generateHelp.status, 0, generateHelp.stderr || generateHelp.stdout);
  assert.match(generateHelp.stdout, /Usage: topogram generate \[path\] \[--out <path>\]/);
  assert.match(generateHelp.stdout, /Use `topogram emit <target>` for contracts/);
  assert.doesNotMatch(generateHelp.stdout, /topogram generate \[path\] --generate <target>/);
  assert.doesNotMatch(generateHelp.stdout, /Explicit --generate targets/);
  assert.doesNotMatch(generateHelp.stdout, /Common commands:/);

  const helpGenerate = runCli(["help", "generate"]);
  assert.equal(helpGenerate.status, 0, helpGenerate.stderr || helpGenerate.stdout);
  assert.equal(helpGenerate.stdout, generateHelp.stdout);

  const emitHelp = runCli(["emit", "--help"]);
  assert.equal(emitHelp.status, 0, emitHelp.stderr || emitHelp.stdout);
  assert.match(emitHelp.stdout, /Usage: topogram emit <target> \[path\] \[--json\]/);
  assert.match(emitHelp.stdout, /topogram emit ui-widget-contract --widget widget_data_grid --json/);
  assert.match(emitHelp.stdout, /topogram emit widget-conformance-report \.\/topo --projection proj_web_surface --json/);
  assert.match(emitHelp.stdout, /topogram emit widget-behavior-report \.\/topo --projection proj_web_surface --json/);

  const helpEmit = runCli(["help", "emit"]);
  assert.equal(helpEmit.status, 0, helpEmit.stderr || helpEmit.stdout);
  assert.equal(helpEmit.stdout, emitHelp.stdout);

  const componentHelp = runCli(["widget", "--help"]);
  assert.equal(componentHelp.status, 0, componentHelp.stderr || componentHelp.stdout);
  assert.match(componentHelp.stdout, /Usage: topogram widget check \[path\]/);
  assert.match(componentHelp.stdout, /topogram widget behavior \[path\]/);
  assert.match(componentHelp.stdout, /topogram widget check --projection proj_web_surface/);
  assert.match(componentHelp.stdout, /topogram widget behavior --projection proj_web_surface/);

  const newHelp = runCli(["new", "--help"]);
  assert.equal(newHelp.status, 0, newHelp.stderr || newHelp.stdout);
  assert.match(newHelp.stdout, /Usage: topogram new <path> \[--template <alias\|package\|path>\]/);
  assert.match(newHelp.stdout, /Fresh install flow:/);
  assert.match(newHelp.stdout, /npx topogram new \.\/my-app --template hello-web/);
  assert.match(newHelp.stdout, /npm --prefix app run compile/);
  assert.match(newHelp.stdout, /topogram new --list-templates/);
  assert.match(newHelp.stdout, /Default template: hello-web/);

  const templateHelp = runCli(["template", "--help"]);
  assert.equal(templateHelp.status, 0, templateHelp.stderr || templateHelp.stdout);
  assert.match(templateHelp.stdout, /Usage: topogram template list/);
  assert.match(templateHelp.stdout, /topogram template status \[path\] \[--latest\] \[--json\]/);
  assert.match(templateHelp.stdout, /topogram template policy check/);
  assert.doesNotMatch(templateHelp.stdout, /topogram template show/);

  const catalogHelp = runCli(["catalog", "--help"]);
  assert.equal(catalogHelp.status, 0, catalogHelp.stderr || catalogHelp.stdout);
  assert.match(catalogHelp.stdout, /Usage: topogram catalog list/);
  assert.match(catalogHelp.stdout, /topogram catalog copy hello \.\/hello-topogram/);

  const doctorHelp = runCli(["help", "doctor"]);
  assert.equal(doctorHelp.status, 0, doctorHelp.stderr || doctorHelp.stdout);
  assert.match(doctorHelp.stdout, /Usage: topogram doctor/);
  assert.match(doctorHelp.stdout, /Fresh install check:/);
  assert.match(doctorHelp.stdout, /npx topogram doctor/);
  assert.match(doctorHelp.stdout, /npx topogram new \.\/my-app --template hello-web/);
  assert.match(doctorHelp.stdout, /topogram setup package-auth/);
  assert.match(doctorHelp.stdout, /Use `catalog doctor` when you only want catalog/);

  const packageHelp = runCli(["package", "--help"]);
  assert.equal(packageHelp.status, 0, packageHelp.stderr || packageHelp.stdout);
  assert.match(packageHelp.stdout, /Usage: topogram package update-cli <version\|--latest>/);
  assert.match(packageHelp.stdout, /npmjs package inspection confirms the requested public CLI version/);
  assert.match(packageHelp.stdout, /Available consumer verification scripts run after install/);

  const releaseHelp = runCli(["release", "--help"]);
  assert.equal(releaseHelp.status, 0, releaseHelp.stderr || releaseHelp.stdout);
  assert.match(releaseHelp.stdout, /Usage: topogram release status/);
  assert.match(releaseHelp.stdout, /topogram release roll-consumers <version\|--latest>/);
  assert.match(releaseHelp.stdout, /npm run release:prepare -- <version>/);

  const sourceHelp = runCli(["source", "--help"]);
  assert.equal(sourceHelp.status, 0, sourceHelp.stderr || sourceHelp.stdout);
  assert.match(sourceHelp.stdout, /Usage: topogram source status/);
  assert.match(sourceHelp.stdout, /topogram source status --remote/);

  const importHelp = runCli(["import", "--help"]);
  assert.equal(importHelp.status, 0, importHelp.stderr || importHelp.stdout);
  assert.match(importHelp.stdout, /Usage: topogram import <app-path> --out <target>/);
  assert.match(importHelp.stdout, /topogram import refresh \[path\] \[--from <app-path>\] \[--dry-run\]/);
  assert.match(importHelp.stdout, /topogram import diff \[path\]/);
  assert.match(importHelp.stdout, /topogram import check \[path\]/);
  assert.match(importHelp.stdout, /topogram import plan \[path\]/);
  assert.match(importHelp.stdout, /topogram import adopt --list \[path\]/);
  assert.match(importHelp.stdout, /topogram import adopt <selector> \[path\]/);
  assert.match(importHelp.stdout, /--force/);
  assert.match(importHelp.stdout, /--reason <text>/);
  assert.match(importHelp.stdout, /topogram import status \[path\]/);
  assert.match(importHelp.stdout, /topogram import history \[path\] \[--verify\]/);
  assert.match(importHelp.stdout, /topogram import adopt --list \.\/imported-topogram/);
  assert.match(importHelp.stdout, /topogram import diff \.\/imported-topogram/);
  assert.match(importHelp.stdout, /topogram import refresh \.\/imported-topogram --from \.\/existing-app --dry-run/);
  assert.match(importHelp.stdout, /topogram import adopt bundle:task .* --dry-run/);
  assert.match(importHelp.stdout, /topogram import adopt bundle:task .* --write --force --reason/);
  assert.match(importHelp.stdout, /topogram import history \.\/imported-topogram --verify/);
  assert.match(importHelp.stdout, /\.topogram-import-adoptions\.jsonl/);
  assert.match(importHelp.stdout, /imported Topogram artifacts are project-owned/i);

  const setupHelp = runCli(["setup", "--help"]);
  assert.equal(setupHelp.status, 0, setupHelp.stderr || setupHelp.stdout);
  assert.match(setupHelp.stdout, /Usage: topogram setup package-auth\|catalog-auth/);

  const packageAuth = runCli(["setup", "package-auth"]);
  assert.equal(packageAuth.status, 0, packageAuth.stderr || packageAuth.stdout);
  assert.match(packageAuth.stdout, /npm install --save-dev @topogram\/cli/);
  assert.match(packageAuth.stdout, /Private template or generator packages/);

  const catalogAuth = runCli(["setup", "catalog-auth"]);
  assert.equal(catalogAuth.status, 0, catalogAuth.stderr || catalogAuth.stdout);
  assert.match(catalogAuth.stdout, /gh auth login/);
  assert.match(catalogAuth.stdout, /topogram catalog doctor/);

  const templateList = runCli(["template", "list", "--json"]);
  assert.equal(templateList.status, 0, templateList.stderr || templateList.stdout);
  const listPayload = JSON.parse(templateList.stdout);
  assert.equal(listPayload.templates.some((template) => template.source === "builtin"), false);

  const check = runCli(["check", fixtureRoot]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Topogram check passed/);

  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-app-basic-"));
  const generate = runCli(["generate", fixtureRoot, "--out", outputRoot]);
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  const generatedItemListPage = readText(path.join(outputRoot, "apps", "web", "app_sveltekit", "src", "routes", "items", "+page.svelte"));
  assert.match(generatedItemListPage, /data-topogram-widget="widget_data_grid"/);
  assert.match(generatedItemListPage, /class="widget-card widget-table"/);
  assert.equal(fs.existsSync(path.join(outputRoot, "apps", "web", "app_sveltekit", "src", "routes", "items", "board", "+page.svelte")), true);
  assert.equal(fs.existsSync(path.join(outputRoot, "apps", "web", "app_sveltekit", "src", "routes", "items", "calendar", "+page.svelte")), true);
  const generatedSvelteCss = readText(path.join(outputRoot, "apps", "web", "app_sveltekit", "src", "app.css"));
  assert.match(generatedSvelteCss, /--topogram-design-density: compact;/);
  assert.match(generatedSvelteCss, /--topogram-design-tone: operational;/);
  assert.match(generatedSvelteCss, /--topogram-design-color-primary: accent;/);
  assert.match(generatedSvelteCss, /--topogram-design-action-primary: prominent;/);
  assert.match(generatedSvelteCss, /--topogram-page-padding: 1\.5rem 1rem 3rem;/);
  const coverage = readJson(path.join(outputRoot, "apps", "web", "app_sveltekit", "src", "lib", "topogram", "generation-coverage.json"));
  assert.equal(coverage.type, "generation_coverage");
  assert.equal(coverage.summary.routed_screens, 15);
  assert.equal(coverage.summary.rendered_screens, 15);
  assert.equal(coverage.design_intent.status, "mapped");
  assert.equal(coverage.design_intent.tokens.density, "compact");
  assert.equal(coverage.design_intent.tokens.color_roles.primary, "accent");
  assert.deepEqual(coverage.screens.filter((screen) => screen.renderer === "generator").map((screen) => screen.id), ["item_board", "item_calendar"]);
  assert.equal(coverage.summary.implementation_screens, 13);
  assert.equal(coverage.summary.generator_screens, 2);
  assert.equal(coverage.summary.rendered_widget_usages, 1);
  assert.equal(coverage.screens.find((screen) => screen.id === "item_list").widget_usages[0].status, "rendered");
  assert.deepEqual(coverage.diagnostics, []);

  for (const relativePath of [
    ".topogram-generated.json",
    "README.md",
    "package.json",
    "app-bundle-plan.json",
    "scripts/bootstrap.sh",
    "scripts/compile-check.sh",
    "scripts/runtime.sh",
    "scripts/wait-for-stack.mjs",
    "scripts/runtime-check.sh"
  ]) {
    assert.equal(
      readText(path.join(outputRoot, relativePath)),
      readText(path.join(expectedRoot, relativePath)),
      `${relativePath} should match the app-basic fixture`
    );
  }

  const runtimePackageJson = readJson(path.join(outputRoot, "apps", "package.json"));
  assert.equal(runtimePackageJson.scripts["docker:db"], undefined);
  assert.equal(runtimePackageJson.scripts["docker:stack"], undefined);
  assert.equal(fs.existsSync(path.join(outputRoot, "apps", "scripts", "docker-db.sh")), false);
  assert.equal(fs.existsSync(path.join(outputRoot, "apps", "scripts", "docker-stack.sh")), false);

  const explicitAppOutputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-app-basic-explicit-"));
  const explicitAppGenerate = runCli(["generate", "app", fixtureRoot, "--out", explicitAppOutputRoot]);
  assert.equal(explicitAppGenerate.status, 0, explicitAppGenerate.stderr || explicitAppGenerate.stdout);
  assert.equal(fs.existsSync(path.join(explicitAppOutputRoot, "app-bundle-plan.json")), true);

  const statusAlias = runCli(["status", fixtureRoot]);
  assert.notEqual(statusAlias.status, 0, statusAlias.stdout);

  const buildAlias = runCli(["build", fixtureRoot, "--out", outputRoot]);
  assert.notEqual(buildAlias.status, 0, buildAlias.stdout);
});

test("sveltekit generator routes render projection widget_bindings for provider-unowned screens", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-widget-route-"));
  const workspaceRoot = copyAppBasicFixture(root);
  const projectionPath = path.join(workspaceRoot, "projections", "proj-ui-contract.tg");
  const componentPath = path.join(workspaceRoot, "widgets", "widget-data-grid.tg");
  fs.writeFileSync(
    componentPath,
    fs.readFileSync(componentPath, "utf8").replace(
      "  patterns [resource_table, data_grid_view]\n",
      "  patterns [resource_table, data_grid_view, board_view]\n"
    ),
    "utf8"
  );
  const source = fs.readFileSync(projectionPath, "utf8");
  fs.writeFileSync(
    projectionPath,
    source.replace(
      "    screen item_list region results widget widget_data_grid data rows from cap_list_items event row_select navigate item_detail\n",
      "    screen item_list region results widget widget_data_grid data rows from cap_list_items event row_select navigate item_detail\n" +
        "    screen item_board region results widget widget_data_grid data rows from cap_list_items event row_select navigate item_detail\n"
    ),
    "utf8"
  );

  const outputRoot = path.join(root, "app");
  const trust = runCli(["trust", "template"], { cwd: workspaceRoot });
  assert.equal(trust.status, 0, trust.stderr || trust.stdout);
  const generate = runCli(["generate", workspaceRoot, "--out", outputRoot]);
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  const boardPage = readText(path.join(outputRoot, "apps", "web", "app_sveltekit", "src", "routes", "items", "board", "+page.svelte"));
  assert.match(boardPage, /data-topogram-widget="widget_data_grid"/);
  assert.match(boardPage, /class="widget-card widget-board"/);
  assert.doesNotMatch(boardPage, /Sample rows/);
  const coverage = readJson(path.join(outputRoot, "apps", "web", "app_sveltekit", "src", "lib", "topogram", "generation-coverage.json"));
  const boardCoverage = coverage.screens.find((screen) => screen.id === "item_board");
  assert.equal(boardCoverage.renderer, "generator");
  assert.equal(boardCoverage.widget_usages[0].widget, "widget_data_grid");
  assert.equal(boardCoverage.widget_usages[0].status, "rendered");
  assert.equal(boardCoverage.widget_usages[0].rendered, true);
  assert.deepEqual(coverage.diagnostics, []);
});

test("topogram emit honors explicit artifact targets", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-emit-target-"));
  const selected = runCli([
    "emit",
    "ui-widget-contract",
    fixtureRoot,
    "--widget",
    "widget_data_grid",
    "--json"
  ], { cwd });
  assert.equal(selected.status, 0, selected.stderr || selected.stdout);
  const contract = JSON.parse(selected.stdout);
  assert.equal(contract.id, "widget_data_grid");
  assert.equal(contract.type, "ui_widget_contract");
  assert.equal(fs.existsSync(path.join(cwd, "app")), false, "explicit artifact generation must not write the app shortcut output");

  const defaultProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-emit-default-path-"));
  const defaultTopogramRoot = path.join(defaultProjectRoot, "topo");
  fs.mkdirSync(defaultTopogramRoot, { recursive: true });
  for (const entry of fs.readdirSync(fixtureRoot)) {
    const source = path.join(fixtureRoot, entry);
    const destination = ["topogram.project.json", "implementation", "README.md"].includes(entry)
      ? path.join(defaultProjectRoot, entry)
      : path.join(defaultTopogramRoot, entry);
    fs.cpSync(source, destination, { recursive: true });
  }
  const selectedDefaultPath = runCli([
    "emit",
    "ui-widget-contract",
    "--widget",
    "widget_data_grid",
    "--json"
  ], { cwd: defaultProjectRoot });
  assert.equal(selectedDefaultPath.status, 0, selectedDefaultPath.stderr || selectedDefaultPath.stdout);
  assert.equal(JSON.parse(selectedDefaultPath.stdout).id, "widget_data_grid");

  const conformance = runCli([
    "emit",
    "widget-conformance-report",
    fixtureRoot,
    "--projection",
    "proj_web_surface",
    "--widget",
    "widget_data_grid",
    "--json"
  ], { cwd });
  assert.equal(conformance.status, 0, conformance.stderr || conformance.stdout);
  const conformanceReport = JSON.parse(conformance.stdout);
  assert.equal(conformanceReport.type, "widget_conformance_report");
  assert.equal(conformanceReport.summary.total_usages, 1);
  assert.equal(conformanceReport.summary.errors, 0);
  assert.equal(conformanceReport.projection_usages[0].source_projection.id, "proj_ui_contract");
  assert.equal(fs.existsSync(path.join(cwd, "app")), false, "widget conformance generation must not write the app shortcut output");

  const outDir = path.join(cwd, "contracts");
  const written = runCli([
    "emit",
    "ui-widget-contract",
    fixtureRoot,
    "--write",
    "--out-dir",
    outDir
  ], { cwd });
  assert.equal(written.status, 0, written.stderr || written.stdout);
  assert.equal(readJson(path.join(outDir, ".topogram-generated.json")).target, "ui-widget-contract");
  assert.equal(readJson(path.join(outDir, "widget_data_grid.ui-widget-contract.json")).id, "widget_data_grid");
  assert.equal(fs.existsSync(path.join(outDir, "app-bundle-plan.json")), false);

  const reportOutDir = path.join(cwd, "reports");
  const writtenReport = runCli([
    "emit",
    "widget-conformance-report",
    fixtureRoot,
    "--projection",
    "proj_web_surface",
    "--write",
    "--out-dir",
    reportOutDir
  ], { cwd });
  assert.equal(writtenReport.status, 0, writtenReport.stderr || writtenReport.stdout);
  assert.equal(readJson(path.join(reportOutDir, ".topogram-generated.json")).target, "widget-conformance-report");
  assert.equal(readJson(path.join(reportOutDir, "proj_web_surface.widget-conformance-report.json")).summary.total_usages, 1);
});

test("maintained database migrations emit proposals without overwriting maintained app files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-maintained-db-proposals-"));
  const projectRoot = copyAppBasicFixture(root, "maintained-db");
  const configPath = path.join(projectRoot, "topogram.project.json");
  const config = readJson(configPath);
  const dbRuntime = config.topology.runtimes.find((runtime) => runtime.id === "app_postgres");
  assert.ok(dbRuntime);
  dbRuntime.migration = {
    ownership: "maintained",
    tool: "prisma",
    apply: "never",
    snapshotPath: "topo/state/db/app_postgres/current.snapshot.json",
    schemaPath: "apps/services/app_api/prisma/schema.prisma",
    migrationsPath: "apps/services/app_api/prisma/migrations"
  };
  writeJson(configPath, config);

  const maintainedSchemaPath = path.join(projectRoot, dbRuntime.migration.schemaPath);
  const maintainedMigrationPath = path.join(
    projectRoot,
    dbRuntime.migration.migrationsPath,
    "0001_existing",
    "migration.sql"
  );
  fs.mkdirSync(path.dirname(maintainedSchemaPath), { recursive: true });
  fs.mkdirSync(path.dirname(maintainedMigrationPath), { recursive: true });
  const originalSchema = "// maintained app schema\n";
  const originalMigration = "-- maintained app migration\n";
  fs.writeFileSync(maintainedSchemaPath, originalSchema, "utf8");
  fs.writeFileSync(maintainedMigrationPath, originalMigration, "utf8");

  const lifecycleOutDir = path.join(root, "db-proposals", "lifecycle");
  const lifecycle = runCli([
    "emit",
    "db-lifecycle-bundle",
    projectRoot,
    "--projection",
    "proj_db_postgres",
    "--write",
    "--out-dir",
    lifecycleOutDir
  ], { cwd: projectRoot });
  assert.equal(lifecycle.status, 0, lifecycle.stderr || lifecycle.stdout);
  assert.equal(readJson(path.join(lifecycleOutDir, ".topogram-generated.json")).target, "db-lifecycle-bundle");
  assert.match(readText(path.join(lifecycleOutDir, "README.md")), /Maintained proposal mode/);
  const migrateScript = readText(path.join(lifecycleOutDir, "scripts", "db-migrate.sh"));
  assert.match(migrateScript, /No migration was applied/);
  assert.doesNotMatch(migrateScript, /\bapply_sql\b/);

  const schemaOutDir = path.join(root, "db-proposals", "prisma");
  const schema = runCli([
    "emit",
    "prisma-schema",
    projectRoot,
    "--projection",
    "proj_db_postgres",
    "--write",
    "--out-dir",
    schemaOutDir
  ], { cwd: projectRoot });
  assert.equal(schema.status, 0, schema.stderr || schema.stdout);
  assert.match(readText(path.join(schemaOutDir, "schema.prisma")), /model Collection/);

  assert.equal(fs.readFileSync(maintainedSchemaPath, "utf8"), originalSchema);
  assert.equal(fs.readFileSync(maintainedMigrationPath, "utf8"), originalMigration);
  assert.equal(fs.existsSync(path.join(projectRoot, "app")), false);
});

test("removed generate --generate artifact form fails with emit guidance", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generate-deprecated-"));
  const selected = runCli([
    "generate",
    fixtureRoot,
    "--generate",
    "ui-widget-contract",
    "--widget",
    "widget_data_grid",
    "--json"
  ], { cwd });
  assert.notEqual(selected.status, 0, selected.stdout);
  assert.match(selected.stderr, /artifact flag '--generate' was removed/i);
  assert.match(selected.stderr, /topogram emit ui-widget-contract/);
  assert.equal(selected.stdout, "");
  assert.equal(fs.existsSync(path.join(cwd, "app")), false, "removed artifact form must not write the app shortcut output");

  const directLegacy = runCli([
    fixtureRoot,
    "--generate",
    "ui-widget-contract",
    "--widget",
    "widget_data_grid",
    "--json"
  ], { cwd });
  assert.notEqual(directLegacy.status, 0, directLegacy.stdout);
  assert.match(directLegacy.stderr, /artifact flag '--generate' was removed/i);
  assert.match(directLegacy.stderr, /topogram emit ui-widget-contract/);
});

test("topogram widget check reports conformance without writing app output", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-widget-check-"));
  const human = runCli([
    "widget",
    "check",
    fixtureRoot,
    "--projection",
    "proj_web_surface",
    "--widget",
    "widget_data_grid"
  ], { cwd });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Widget conformance passed\./);
  assert.match(human.stdout, /Usages: 1 total, 1 passed, 0 warning, 0 error/);
  assert.match(human.stdout, /Affected projections: proj_ui_contract, proj_web_surface/);
  assert.match(human.stdout, /Affected widgets: widget_data_grid/);
  assert.match(human.stdout, /Write scope:/);
  assert.equal(fs.existsSync(path.join(cwd, "app")), false, "widget check must not write the app shortcut output");

  const json = runCli([
    "widget",
    "check",
    fixtureRoot,
    "--projection",
    "proj_web_surface",
    "--json"
  ], { cwd });
  assert.equal(json.status, 0, json.stderr || json.stdout);
  const report = JSON.parse(json.stdout);
  assert.equal(report.type, "widget_conformance_report");
  assert.equal(report.filters.projection, "proj_web_surface");
  assert.equal(report.summary.total_usages, 1);
  assert.equal(report.summary.errors, 0);

  const missing = runCli([
    "widget",
    "check",
    fixtureRoot,
    "--widget",
    "widget_does_not_exist"
  ], { cwd });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /No widget found with id 'widget_does_not_exist'/);
});

test("topogram widget behavior reports behavior groups without writing app output", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-widget-behavior-"));
  const human = runCli([
    "widget",
    "behavior",
    fixtureRoot,
    "--projection",
    "proj_web_surface",
    "--widget",
    "widget_data_grid"
  ], { cwd });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Widget behavior report passed\./);
  assert.match(human.stdout, /Behaviors: 2 total, 2 realized, 0 partial, 0 declared/);
  assert.match(human.stdout, /Affected projections: proj_ui_contract, proj_web_surface/);
  assert.match(human.stdout, /Affected widgets: widget_data_grid/);
  assert.match(human.stdout, /Affected capabilities: cap_list_items/);
  assert.match(human.stdout, /Groups: 1 widget\(s\), 1 screen\(s\), 1 capability group\(s\), 2 effect group\(s\)/);
  assert.equal(fs.existsSync(path.join(cwd, "app")), false, "widget behavior must not write the app shortcut output");

  const json = runCli([
    "widget",
    "behavior",
    fixtureRoot,
    "--projection",
    "proj_web_surface",
    "--json"
  ], { cwd });
  assert.equal(json.status, 0, json.stderr || json.stdout);
  const report = JSON.parse(json.stdout);
  assert.equal(report.type, "widget_behavior_report");
  assert.equal(report.filters.projection, "proj_web_surface");
  assert.equal(report.summary.total_behaviors, 2);
  assert.deepEqual(report.summary.affected_capabilities, ["cap_list_items"]);
  assert.deepEqual(report.groups.widgets.map((group) => group.id), ["widget_data_grid"]);
  assert.deepEqual(report.groups.screens.map((group) => group.id), ["item_list"]);
  assert.deepEqual(report.groups.effects.map((group) => group.id), ["navigation", "none"]);

  const query = runCli([
    "query",
    "widget-behavior",
    fixtureRoot,
    "--projection",
    "proj_web_surface",
    "--widget",
    "widget_data_grid",
    "--json"
  ], { cwd });
  assert.equal(query.status, 0, query.stderr || query.stdout);
  const queryReport = JSON.parse(query.stdout);
  assert.equal(queryReport.type, "widget_behavior_report");
  assert.equal(queryReport.filters.projection, "proj_web_surface");
  assert.equal(queryReport.filters.widget, "widget_data_grid");
  assert.equal(queryReport.summary.total_behaviors, 2);
  assert.equal(fs.existsSync(path.join(cwd, "app")), false, "widget behavior query must not write app shortcut output");

  const reportOutDir = path.join(cwd, "behavior-reports");
  const written = runCli([
    "emit",
    "widget-behavior-report",
    fixtureRoot,
    "--projection",
    "proj_web_surface",
    "--write",
    "--out-dir",
    reportOutDir
  ], { cwd });
  assert.equal(written.status, 0, written.stderr || written.stdout);
  assert.equal(readJson(path.join(reportOutDir, ".topogram-generated.json")).target, "widget-behavior-report");
  assert.equal(readJson(path.join(reportOutDir, "proj_web_surface.widget-behavior-report.json")).summary.total_behaviors, 2);
  assert.equal(fs.existsSync(path.join(cwd, "app")), false, "widget behavior write must not write app shortcut output");
});

test("agent review packets recommend widget behavior reports for widget impacts", () => {
  const changePlan = runCli([
    "query",
    "change-plan",
    fixtureRoot,
    "--widget",
    "widget_data_grid"
  ]);
  assert.equal(changePlan.status, 0, changePlan.stderr || changePlan.stdout);
  const changePayload = JSON.parse(changePlan.stdout);
  assert.equal(changePayload.type, "change_plan_query");
  assert.equal(
    changePayload.generator_targets.some((target) =>
      target.target === "widget-behavior-report" &&
      target.widget_id === "widget_data_grid" &&
      target.projection_id === "proj_web_surface"
    ),
    true
  );
  assert.equal(
    changePayload.alignment_recommendations.some((recommendation) =>
      recommendation.action === "regenerate_projection_targets" &&
      recommendation.targets.includes("widget-behavior-report")
    ),
    true
  );

  const reviewPacket = runCli([
    "query",
    "review-packet",
    fixtureRoot,
    "--widget",
    "widget_data_grid"
  ]);
  assert.equal(reviewPacket.status, 0, reviewPacket.stderr || reviewPacket.stdout);
  const reviewPayload = JSON.parse(reviewPacket.stdout);
  assert.equal(reviewPayload.type, "review_packet_query");
  assert.equal(reviewPayload.source, "change-plan");
  assert.equal(
    reviewPayload.generator_targets.some((target) =>
      target.target === "widget-behavior-report" &&
      target.widget_id === "widget_data_grid" &&
      target.projection_id === "proj_web_surface"
    ),
    true
  );

  const workflowContext = runCli([
    "query",
    "resolved-workflow-context",
    fixtureRoot,
    "--mode",
    "modeling",
    "--widget",
    "widget_data_grid",
    "--json"
  ]);
  assert.equal(workflowContext.status, 0, workflowContext.stderr || workflowContext.stdout);
  const workflowPayload = JSON.parse(workflowContext.stdout);
  assert.equal(workflowPayload.type, "resolved_workflow_context_query");
  assert.equal(
    workflowPayload.artifact_load_order.includes("proj_web_surface.widget_data_grid.widget-behavior-report.json"),
    true
  );
  assert.equal(
    workflowPayload.recommended_artifact_queries.some((query) =>
      query.query === "widget-behavior" &&
      query.command === "topogram query widget-behavior ./topo --projection proj_web_surface --widget widget_data_grid --json"
    ),
    true
  );

  const singleAgentPlan = runCli([
    "query",
    "single-agent-plan",
    fixtureRoot,
    "--mode",
    "modeling",
    "--widget",
    "widget_data_grid",
    "--json"
  ]);
  assert.equal(singleAgentPlan.status, 0, singleAgentPlan.stderr || singleAgentPlan.stdout);
  const singleAgentPayload = JSON.parse(singleAgentPlan.stdout);
  assert.equal(singleAgentPayload.type, "single_agent_plan");
  assert.equal(
    singleAgentPayload.primary_artifacts.includes("proj_web_surface.widget_data_grid.widget-behavior-report.json"),
    true
  );
});

test("topogram catalog check validates catalog schema", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-check-"));
  const validCatalog = createCatalog(root, [
    sampleTemplateCatalogEntry(),
    sampleTemplateCatalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);

  const check = runCli(["catalog", "check", validCatalog, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.catalog.entries.length, 2);

  const duplicateCatalog = createCatalog(path.join(root, "duplicate"), [
    sampleTemplateCatalogEntry(),
    sampleTemplateCatalogEntry({ id: "sample-template", package: "@scope/topogram-template-other" })
  ]);
  const duplicate = runCli(["catalog", "check", duplicateCatalog, "--json"]);
  assert.notEqual(duplicate.status, 0, duplicate.stdout);
  assert.equal(JSON.parse(duplicate.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_duplicate_id"), true);

  const invalidKindCatalog = createCatalog(path.join(root, "invalid-kind"), [
    sampleTemplateCatalogEntry({ kind: "app" })
  ]);
  const invalidKind = runCli(["catalog", "check", invalidKindCatalog, "--json"]);
  assert.notEqual(invalidKind.status, 0, invalidKind.stdout);
  assert.equal(JSON.parse(invalidKind.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_invalid_kind"), true);

  const missingPackageCatalog = createCatalog(path.join(root, "missing-package"), [
    sampleTemplateCatalogEntry({ package: "" })
  ]);
  const missingPackage = runCli(["catalog", "check", missingPackageCatalog, "--json"]);
  assert.notEqual(missingPackage.status, 0, missingPackage.stdout);
  assert.equal(JSON.parse(missingPackage.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_entry_field_missing"), true);

  const executableTopogramCatalog = createCatalog(path.join(root, "executable-topogram"), [
    sampleTemplateCatalogEntry({
      id: "unsafe",
      kind: "topogram",
      package: "@scope/topogram-unsafe",
      trust: {
        scope: "@scope",
        includesExecutableImplementation: true
      }
    })
  ]);
  const executableTopogram = runCli(["catalog", "check", executableTopogramCatalog, "--json"]);
  assert.notEqual(executableTopogram.status, 0, executableTopogram.stdout);
  assert.equal(
    JSON.parse(executableTopogram.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_topogram_executable_not_supported"),
    true
  );

  const optionalMetadataCatalog = createCatalog(path.join(root, "optional-metadata"), [
    sampleTemplateCatalogEntry({
      surfaces: ["web", "spaceship"],
      generators: "topogram/hono",
      stack: ["Hono"]
    })
  ]);
  const optionalMetadata = runCli(["catalog", "check", optionalMetadataCatalog, "--json"]);
  assert.equal(optionalMetadata.status, 0, optionalMetadata.stderr || optionalMetadata.stdout);
  const optionalPayload = JSON.parse(optionalMetadata.stdout);
  assert.equal(optionalPayload.ok, true);
  assert.equal(optionalPayload.diagnostics.some((diagnostic) => diagnostic.code === "catalog_optional_surface_unknown"), true);
  assert.equal(optionalPayload.diagnostics.some((diagnostic) => diagnostic.code === "catalog_optional_generators_invalid"), true);
  assert.equal(optionalPayload.diagnostics.some((diagnostic) => diagnostic.code === "catalog_optional_stack_invalid"), true);
});

test("topogram catalog doctor reports catalog and package access", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-doctor-"));
  const fakeNpmBin = createFakeNpm(root);
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry(),
    sampleTemplateCatalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);
  const env = {
    FAKE_NPM_LATEST_VERSION: "0.1.0",
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const doctor = runCli(["catalog", "doctor", "--catalog", catalogPath, "--json"], { env });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const payload = JSON.parse(doctor.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.catalog.reachable, true);
  assert.equal(payload.catalog.entries, 2);
  assert.equal(payload.packages.length, 2);
  assert.equal(payload.packages.every((item) => item.ok), true);
  assert.equal(payload.packages[0].packageSpec, "@scope/topogram-template-sample@0.1.0");

  const human = runCli(["catalog", "doctor", "--catalog", catalogPath], { env });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Catalog doctor passed/);
  assert.match(human.stdout, /Catalog reachable: yes/);
  assert.match(human.stdout, /@scope\/topogram-template-sample@0\.1\.0 ok/);

  const denied = runCli(["catalog", "doctor", "--catalog", catalogPath, "--json"], {
    env: {
      ...env,
      FAKE_NPM_VIEW_FAIL_SPEC: "@scope/topogram-hello@0.1.0",
      FAKE_NPM_VIEW_FAIL_OUTPUT: "npm ERR! 403 Forbidden"
    }
  });
  assert.notEqual(denied.status, 0, denied.stdout);
  const deniedPayload = JSON.parse(denied.stdout);
  assert.equal(deniedPayload.ok, false);
  assert.equal(deniedPayload.packages.find((item) => item.id === "hello").diagnostics[0].code, "catalog_package_access_denied");
});

test("topogram doctor checks runtime, public package access, and catalog access", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-doctor-"));
  const fakeNpmBin = createFakeNpm(root);
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry()
  ]);
  const env = {
    FAKE_NPM_LATEST_VERSION: "0.1.0",
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const doctor = runCli(["doctor", "--catalog", catalogPath, "--json"], { env });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const payload = JSON.parse(doctor.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.node.ok, true);
  assert.equal(payload.npm.available, true);
  assert.equal(payload.packageRegistry.registryConfigured, true);
  assert.equal(payload.packageRegistry.packageAccess.ok, true);
  assert.equal(payload.catalog.ok, true);

  const human = runCli(["doctor", "--catalog", catalogPath], { env });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Topogram doctor passed/);
  assert.match(human.stdout, /npm registry: ok/);
  assert.match(human.stdout, new RegExp(`CLI package access: @topogram/cli@${cliPackageVersion.replaceAll(".", "\\.")} ok`));
  assert.match(human.stdout, /Catalog package access: ok/);
  assert.match(human.stdout, /Setup guidance:/);
  assert.match(human.stdout, /CLI package access:/);
  assert.match(human.stdout, /Catalog auth:/);
  assert.match(human.stdout, /Template package auth:/);
  assert.match(human.stdout, /Catalog disabled mode:/);

  const missingRegistry = runCli(["doctor", "--catalog", catalogPath, "--json"], {
    env: {
      ...env,
      FAKE_NPM_TOPOGRAM_REGISTRY: "https://npm.pkg.github.com"
    }
  });
  assert.notEqual(missingRegistry.status, 0, missingRegistry.stdout);
  const missingRegistryPayload = JSON.parse(missingRegistry.stdout);
  assert.equal(missingRegistryPayload.ok, false);
  assert.equal(
    missingRegistryPayload.diagnostics.some((diagnostic) => diagnostic.code === "package_registry_registry_not_configured"),
    true
  );
});

test("topogram catalog show describes template and topogram entries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-show-"));
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry(),
    sampleTemplateCatalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);

  const template = runCli(["catalog", "show", "sample-template", "--catalog", catalogPath, "--json"]);
  assert.equal(template.status, 0, template.stderr || template.stdout);
  const templatePayload = JSON.parse(template.stdout);
  assert.equal(templatePayload.ok, true);
  assert.equal(templatePayload.entry.kind, "template");
  assert.equal(templatePayload.entry.package, "@scope/topogram-template-sample");
  assert.equal(templatePayload.packageSpec, "@scope/topogram-template-sample@0.1.0");
  assert.equal(
    templatePayload.commands.primary,
    `topogram new ./my-app --template sample-template --catalog ${catalogPath}`
  );

  const topogram = runCli(["catalog", "show", "hello", "--catalog", catalogPath, "--json"]);
  assert.equal(topogram.status, 0, topogram.stderr || topogram.stdout);
  const topogramPayload = JSON.parse(topogram.stdout);
  assert.equal(topogramPayload.ok, true);
  assert.equal(topogramPayload.entry.kind, "topogram");
  assert.equal(topogramPayload.packageSpec, "@scope/topogram-hello@0.1.0");
  assert.equal(
    topogramPayload.commands.primary,
    `topogram catalog copy hello ./hello-topogram --catalog ${catalogPath}`
  );
  assert.deepEqual(topogramPayload.commands.followUp, [
    "cd ./hello-topogram",
    "topogram source status --local",
    "topogram check",
    "topogram generate"
  ]);

  const human = runCli(["catalog", "show", "hello", "--catalog", catalogPath]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Catalog entry: hello/);
  assert.match(human.stdout, /Kind: topogram/);
  assert.match(human.stdout, /Action: copies editable Topogram source/);
  assert.match(human.stdout, /Executable implementation: no \(topogram entries cannot include implementation\/ in v1\)/);
  assert.match(human.stdout, /Recommended command:/);
  assert.match(human.stdout, /topogram catalog copy hello \.\/hello-topogram/);
  assert.match(human.stdout, /cd \.\/hello-topogram/);
  assert.match(human.stdout, /topogram source status/);
  assert.match(human.stdout, /topogram check/);
  assert.match(human.stdout, /topogram generate/);
  assert.match(human.stdout, /\.topogram-source\.json will record copy provenance only/);

  const missing = runCli(["catalog", "show", "missing", "--catalog", catalogPath, "--json"]);
  assert.notEqual(missing.status, 0, missing.stdout);
  const missingPayload = JSON.parse(missing.stdout);
  assert.equal(missingPayload.ok, false);
  assert.equal(missingPayload.diagnostics[0].code, "catalog_entry_not_found");
});

test("topogram template list includes catalog template aliases", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-template-list-"));
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry({
      id: "hello-web",
      package: "@scope/topogram-starter-hello-web",
      defaultVersion: "0.1.0",
      description: "Vanilla web starter",
      tags: ["hello", "web"],
      surfaces: ["web"],
      generators: ["topogram/vanilla-web"],
      stack: "Vanilla HTML/CSS/JS",
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    }),
    sampleTemplateCatalogEntry(),
    sampleTemplateCatalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);

  const list = runCli(["template", "list", "--json", "--catalog", catalogPath]);
  assert.equal(list.status, 0, list.stderr || list.stdout);
  const payload = JSON.parse(list.stdout);
  assert.equal(payload.catalog.loaded, true);
  assert.equal(payload.templates.some((template) => template.source === "builtin"), false);
  const helloWebTemplate = payload.templates.find((template) => template.id === "hello-web");
  assert.ok(helloWebTemplate);
  assert.equal(helloWebTemplate.isDefault, true);
  assert.deepEqual(helloWebTemplate.surfaces, ["web"]);
  assert.deepEqual(helloWebTemplate.generators, ["topogram/vanilla-web"]);
  assert.equal(helloWebTemplate.stack, "Vanilla HTML/CSS/JS");
  assert.equal(helloWebTemplate.includesExecutableImplementation, false);
  assert.equal(
    helloWebTemplate.recommendedCommand,
    `topogram new ./my-app --template hello-web --catalog ${catalogPath}`
  );
  assert.equal(helloWebTemplate.commands.primary, helloWebTemplate.recommendedCommand);
  const sampleTemplate = payload.templates.find((template) => template.id === "sample-template");
  assert.ok(sampleTemplate);
  assert.equal(sampleTemplate.source, "catalog");
  assert.equal(sampleTemplate.package, "@scope/topogram-template-sample");
  assert.equal(sampleTemplate.isDefault, false);
  assert.deepEqual(sampleTemplate.surfaces, ["web", "api", "database"]);
  assert.deepEqual(sampleTemplate.generators, ["topogram/sveltekit", "topogram/hono", "topogram/postgres"]);
  assert.equal(sampleTemplate.stack, "SvelteKit + Hono + Postgres");
  assert.equal(sampleTemplate.includesExecutableImplementation, true);
  assert.equal(
    sampleTemplate.recommendedCommand,
    `topogram new ./my-app --template sample-template --catalog ${catalogPath}`
  );
  assert.equal(sampleTemplate.commands.primary, sampleTemplate.recommendedCommand);
  assert.equal(payload.templates.some((template) => template.id === "hello"), false);

  const aliasList = runCli(["new", "--list-templates", "--json", "--catalog", catalogPath]);
  assert.equal(aliasList.status, 0, aliasList.stderr || aliasList.stdout);
  const aliasPayload = JSON.parse(aliasList.stdout);
  assert.equal(aliasPayload.catalog.loaded, true);
  assert.equal(aliasPayload.templates.some((template) => template.id === "sample-template"), true);

  const listHuman = runCli(["template", "list", "--catalog", catalogPath]);
  assert.equal(listHuman.status, 0, listHuman.stderr || listHuman.stdout);
  assert.match(listHuman.stdout, /Template starters:/);
  assert.match(listHuman.stdout, /Catalog aliases resolve to versioned package installs/);
  assert.match(listHuman.stdout, /hello-web@0\.1\.0 \(default\)/);
  assert.match(listHuman.stdout, /sample-template@0\.1\.0/);
  assert.match(listHuman.stdout, /Source: catalog \| Surfaces: web, api, database \| Stack: SvelteKit \+ Hono \+ Postgres \| Executable implementation: yes/);
  assert.match(listHuman.stdout, /topogram new \.\/my-app --template sample-template/);

  const human = runCli(["catalog", "list", "--catalog", catalogPath]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Catalog entries:/);
  assert.match(human.stdout, /Template entries create starters with `topogram new`/);
  assert.match(human.stdout, /sample-template \(template\)/);
  assert.match(human.stdout, /Package: @scope\/topogram-template-sample@0\.1\.0/);
  assert.match(human.stdout, /Executable implementation: yes/);
  assert.match(human.stdout, /New: topogram new \.\/my-app --template sample-template/);
  assert.match(human.stdout, /hello \(topogram\)/);
  assert.match(human.stdout, /Copy: topogram catalog copy hello \.\/hello-topogram/);
});

test("topogram template show describes catalog templates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-show-"));
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry(),
    sampleTemplateCatalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);

  const template = runCli(["template", "show", "sample-template", "--catalog", catalogPath, "--json"]);
  assert.equal(template.status, 0, template.stderr || template.stdout);
  const templatePayload = JSON.parse(template.stdout);
  assert.equal(templatePayload.ok, true);
  assert.equal(templatePayload.source, "catalog");
  assert.equal(templatePayload.template.kind, "template");
  assert.equal(templatePayload.packageSpec, "@scope/topogram-template-sample@0.1.0");
  assert.deepEqual(templatePayload.decision.surfaces, ["web", "api", "database"]);
  assert.equal(templatePayload.decision.stack, "SvelteKit + Hono + Postgres");
  assert.deepEqual(templatePayload.decision.generators, ["topogram/sveltekit", "topogram/hono", "topogram/postgres"]);
  assert.equal(templatePayload.decision.executableImplementation, true);
  assert.match(templatePayload.decision.policyImpact, /Copies implementation\/ code/);
  assert.equal(
    templatePayload.commands.primary,
    `topogram new ./my-app --template sample-template --catalog ${catalogPath}`
  );

  const human = runCli(["template", "show", "sample-template", "--catalog", catalogPath]);
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Template: sample-template/);
  assert.match(human.stdout, /Source: catalog/);
  assert.match(human.stdout, /What it creates:/);
  assert.match(human.stdout, /Surfaces: web, api, database/);
  assert.match(human.stdout, /Stack: SvelteKit \+ Hono \+ Postgres/);
  assert.match(human.stdout, /Package: @scope\/topogram-template-sample@0\.1\.0/);
  assert.match(human.stdout, /Policy impact: Copies implementation\/ code/);
  assert.doesNotMatch(human.stdout, /Details:\nStack:/);
  assert.match(human.stdout, /Recommended command:/);
  assert.match(human.stdout, /topogram new \.\/my-app --template sample-template/);

  const nonTemplate = runCli(["template", "show", "hello", "--catalog", catalogPath, "--json"]);
  assert.notEqual(nonTemplate.status, 0, nonTemplate.stdout);
  assert.equal(JSON.parse(nonTemplate.stdout).diagnostics.some((diagnostic) => diagnostic.code === "catalog_entry_not_template"), true);
});

test("topogram new resolves catalog template aliases to package specs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-new-"));
  const templateRoot = copyBuiltInTemplate(root, "sample-template");
  const manifestPath = path.join(templateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.id = "@scope/topogram-template-sample";
  manifest.version = "0.1.0";
  writeJson(manifestPath, manifest);
  const catalogPath = createCatalog(root, [sampleTemplateCatalogEntry()]);
  const fakeNpmBin = createFakeNpm(root);
  const projectRoot = path.join(root, "starter");
  const env = {
    FAKE_NPM_PACKAGES: JSON.stringify({
      "@scope/topogram-template-sample@0.1.0": templateRoot
    }),
    FAKE_NPM_LATEST_VERSION: "0.1.0",
    TOPOGRAM_CLI_PACKAGE_SPEC: "@topogram/cli@0.2.57",
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const create = runCli(["new", projectRoot, "--template", "sample-template", "--catalog", catalogPath], { env });
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: @scope\/topogram-template-sample/);
  assert.match(create.stdout, /Source: package/);
  assert.match(create.stdout, /Source spec: @scope\/topogram-template-sample@0\.1\.0/);
  assert.match(create.stdout, /Catalog: sample-template from /);
  assert.match(create.stdout, /Package: @scope\/topogram-template-sample@0\.1\.0/);
  assert.match(create.stdout, /Executable implementation: yes/);
  assert.match(create.stdout, /Policy: topogram\.template-policy\.json/);
  assert.match(create.stdout, /Trust: \.topogram-template-trust\.json/);
  assert.match(create.stdout, /npm run doctor/);
  assert.match(create.stdout, /npm run agent:brief/);
  assert.match(create.stdout, /npm run source:status/);
  assert.match(create.stdout, /npm run template:policy:explain/);
  assert.match(create.stdout, /npm run generator:policy:status/);
  assert.match(create.stdout, /npm run trust:status/);
  const projectConfig = readJson(path.join(projectRoot, "topogram.project.json"));
  assert.equal(projectConfig.template.id, "@scope/topogram-template-sample");
  assert.equal(projectConfig.template.source, "package");
  assert.equal(projectConfig.template.requested, "sample-template");
  assert.equal(projectConfig.template.sourceSpec, "@scope/topogram-template-sample@0.1.0");
  assert.deepEqual(projectConfig.template.catalog, {
    id: "sample-template",
    source: catalogPath,
    package: "@scope/topogram-template-sample",
    version: "0.1.0",
    packageSpec: "@scope/topogram-template-sample@0.1.0",
    includesExecutableImplementation: true
  });
  assert.equal(fs.existsSync(path.join(projectRoot, ".npmrc")), false);
  assert.equal(projectConfig.template.includesExecutableImplementation, true);
  const fileManifest = readJson(path.join(projectRoot, ".topogram-template-files.json"));
  assert.equal(fileManifest.template.requested, "sample-template");
  assert.deepEqual(fileManifest.template.catalog, projectConfig.template.catalog);
  const trustRecord = readJson(path.join(projectRoot, ".topogram-template-trust.json"));
  assert.equal(trustRecord.template.requested, "sample-template");
  assert.deepEqual(trustRecord.template.catalog, projectConfig.template.catalog);

  const status = runCli(["template", "status", "--json"], { cwd: projectRoot });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.template.requested, "sample-template");
  assert.deepEqual(statusPayload.template.catalog, projectConfig.template.catalog);

  const humanStatus = runCli(["template", "status"], { cwd: projectRoot });
  assert.equal(humanStatus.status, 0, humanStatus.stderr || humanStatus.stdout);
  assert.match(humanStatus.stdout, /Requested: sample-template/);
  assert.match(humanStatus.stdout, /Catalog: sample-template from /);

  const sourceStatus = runCli(["source", "status", "--json"], { cwd: projectRoot, env });
  assert.equal(sourceStatus.status, 0, sourceStatus.stderr || sourceStatus.stdout);
  const sourcePayload = JSON.parse(sourceStatus.stdout);
  assert.equal(sourcePayload.exists, false);
  assert.equal(sourcePayload.project.catalog.id, "sample-template");
  assert.equal(sourcePayload.project.catalog.source, catalogPath);
  assert.equal(sourcePayload.project.catalog.includesExecutableImplementation, true);
  assert.equal(sourcePayload.project.template.id, "@scope/topogram-template-sample");
  assert.equal(sourcePayload.project.template.requested, "sample-template");
  assert.equal(sourcePayload.project.template.sourceSpec, "@scope/topogram-template-sample@0.1.0");
  assert.equal(sourcePayload.project.template.includesExecutableImplementation, true);
  assert.equal(sourcePayload.project.package.package, "@scope/topogram-template-sample");
  assert.equal(sourcePayload.project.package.currentVersion, "0.1.0");
  assert.equal(sourcePayload.project.package.latestVersion, "0.1.0");
  assert.equal(sourcePayload.project.package.current, true);
  assert.equal(sourcePayload.project.packageChecks.mode, "remote");
  assert.equal(sourcePayload.project.packageChecks.skipped, false);
  assert.equal(sourcePayload.project.trust.status, "trusted");
  assert.equal(sourcePayload.project.trust.content.trustedDigest, sourcePayload.project.trust.content.currentDigest);
  assert.equal(sourcePayload.project.templateOwnedBaseline, undefined);
  assert.equal(sourcePayload.project.templateBaseline.status, "clean");
  assert.equal(sourcePayload.project.templateBaseline.state, "matches-template");
  assert.equal(sourcePayload.project.templateBaseline.meaning, "matches-template-baseline");
  assert.equal(sourcePayload.project.templateBaseline.blocksCheck, false);
  assert.equal(sourcePayload.project.templateBaseline.blocksGenerate, false);
  assert.ok(sourcePayload.project.templateBaseline.trustedFiles > 0);

  const humanSourceStatus = runCli(["source", "status"], { cwd: projectRoot, env });
  assert.equal(humanSourceStatus.status, 0, humanSourceStatus.stderr || humanSourceStatus.stdout);
  assert.match(humanSourceStatus.stdout, /Topogram source status: no provenance/);
  assert.match(humanSourceStatus.stdout, /Package checks: remote\. Use --local to skip registry access\./);
  assert.match(humanSourceStatus.stdout, /Project catalog: sample-template from /);
  assert.match(humanSourceStatus.stdout, /Template: @scope\/topogram-template-sample@0\.1\.0/);
  assert.match(humanSourceStatus.stdout, /Executable implementation: yes/);
  assert.match(humanSourceStatus.stdout, /Implementation trust: trusted/);
  assert.match(humanSourceStatus.stdout, /Template baseline: matches-template/);
  assert.match(humanSourceStatus.stdout, /Template baseline meaning: matches-template-baseline/);

  const explicitRemoteSourceStatus = runCli(["source", "status", "--remote", "--json"], { cwd: projectRoot, env });
  assert.equal(explicitRemoteSourceStatus.status, 0, explicitRemoteSourceStatus.stderr || explicitRemoteSourceStatus.stdout);
  const explicitRemoteSourcePayload = JSON.parse(explicitRemoteSourceStatus.stdout);
  assert.equal(explicitRemoteSourcePayload.project.package.currentVersion, "0.1.0");
  assert.equal(explicitRemoteSourcePayload.project.packageChecks.mode, "remote");
  assert.equal(explicitRemoteSourcePayload.project.packageChecks.skipped, false);

  const localSourceStatus = runCli(["source", "status", "--local", "--json"], {
    cwd: projectRoot,
    env: { PATH: process.env.PATH || "" }
  });
  assert.equal(localSourceStatus.status, 0, localSourceStatus.stderr || localSourceStatus.stdout);
  const localSourcePayload = JSON.parse(localSourceStatus.stdout);
  assert.equal(localSourcePayload.project.package.packageSpec, "@scope/topogram-template-sample@0.1.0");
  assert.equal(localSourcePayload.project.package.checked, false);
  assert.equal(localSourcePayload.project.package.currentVersion, null);
  assert.equal(localSourcePayload.project.package.latestVersion, null);
  assert.equal(localSourcePayload.project.packageChecks.mode, "local");
  assert.equal(localSourcePayload.project.packageChecks.skipped, true);
  assert.equal(localSourcePayload.project.trust.status, "trusted");
  assert.equal(localSourcePayload.project.templateBaseline.status, "clean");
  assert.equal(
    localSourcePayload.project.package.diagnostics.some((diagnostic) => diagnostic.code === "catalog_package_check_failed"),
    false
  );
  const localHumanSourceStatus = runCli(["source", "status", "--local"], {
    cwd: projectRoot,
    env: { PATH: process.env.PATH || "" }
  });
  assert.equal(localHumanSourceStatus.status, 0, localHumanSourceStatus.stderr || localHumanSourceStatus.stdout);
  assert.match(localHumanSourceStatus.stdout, /Package checks: local\. Registry access skipped\./);
  assert.match(localHumanSourceStatus.stdout, /Template package: @scope\/topogram-template-sample@0\.1\.0 \(not checked, local mode\)/);
  assert.doesNotMatch(localHumanSourceStatus.stdout, /catalog_package_check_failed/);

  const doctor = runCli(["doctor", "--json"], { cwd: projectRoot, env });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const doctorPayload = JSON.parse(doctor.stdout);
  assert.equal(doctorPayload.catalog.source, catalogPath);
  assert.equal(doctorPayload.catalog.catalog.reachable, true);
  assert.equal(doctorPayload.catalog.packages.length, 1);
  assert.equal(doctorPayload.catalog.packages[0].packageSpec, "@scope/topogram-template-sample@0.1.0");
  assert.equal(doctorPayload.catalog.packages[0].ok, true);
  assert.equal(
    doctorPayload.diagnostics.some((diagnostic) => diagnostic.code === "catalog_check_skipped"),
    false
  );

  const humanDoctor = runCli(["doctor"], { cwd: projectRoot, env });
  assert.equal(humanDoctor.status, 0, humanDoctor.stderr || humanDoctor.stdout);
  assert.match(humanDoctor.stdout, /Project provenance: run `topogram source status --local`/);

  const updateCheck = runCli(["template", "update", "--check", "--json"], { cwd: projectRoot, env });
  assert.equal(updateCheck.status, 0, updateCheck.stderr || updateCheck.stdout);
  const updatePayload = JSON.parse(updateCheck.stdout);
  assert.deepEqual(updatePayload.summary, {
    added: 0,
    changed: 0,
    currentOnly: 0,
    unchanged: updatePayload.summary.unchanged
  });
  assert.equal(updatePayload.files.some((file) => file.path === "topogram.project.json" && file.kind === "changed"), false);
});

test("topogram new rejects catalog template executable trust mismatches", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-new-trust-mismatch-"));
  const templateRoot = path.join(fixtureTemplatesRoot, "hello-web");
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry({
      id: "hello-web",
      package: "@scope/topogram-starter-hello-web",
      defaultVersion: "0.1.0",
      trust: {
        scope: "@scope",
        includesExecutableImplementation: true
      }
    })
  ]);
  const fakeNpmBin = createFakeNpm(root);
  const projectRoot = path.join(root, "starter");
  const env = {
    FAKE_NPM_PACKAGES: JSON.stringify({
      "@scope/topogram-starter-hello-web@0.1.0": templateRoot
    }),
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const create = runCli(["new", projectRoot, "--template", "hello-web", "--catalog", catalogPath], { env });
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /Catalog entry 'hello-web' declares includesExecutableImplementation: true/);
  assert.match(create.stderr, /template package '@scope\/topogram-starter-hello-web@0\.1\.0' declares includesExecutableImplementation: false/);
  assert.equal(fs.existsSync(projectRoot), false);
});

test("catalog aliases resolve starter names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-starter-name-"));
  const templateRoot = copyBuiltInTemplate(root, "hello-web-template");
  const manifestPath = path.join(templateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.id = "@scope/topogram-starter-hello-web";
  manifest.version = "0.1.0";
  writeJson(manifestPath, manifest);
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry({
      id: "hello-web",
      package: "@scope/topogram-starter-hello-web",
      description: "Catalog hello web starter",
      surfaces: ["web"],
      generators: ["topogram/vanilla-web"],
      stack: "Vanilla HTML/CSS/JS",
      trust: {
        scope: "@scope",
        includesExecutableImplementation: true
      }
    })
  ]);
  const fakeNpmBin = createFakeNpm(root);
  const env = {
    FAKE_NPM_PACKAGES: JSON.stringify({
      "@scope/topogram-starter-hello-web@0.1.0": templateRoot
    }),
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const catalogProjectRoot = path.join(root, "catalog-starter");
  const catalogCreate = runCli(["new", catalogProjectRoot, "--template", "hello-web", "--catalog", catalogPath], { env });
  assert.equal(catalogCreate.status, 0, catalogCreate.stderr || catalogCreate.stdout);
  assert.match(catalogCreate.stdout, /Template: @scope\/topogram-starter-hello-web/);
  assert.match(catalogCreate.stdout, /Source: package/);
  assert.match(catalogCreate.stdout, /Catalog: hello-web from /);
  assert.equal(readJson(path.join(catalogProjectRoot, "topogram.project.json")).template.catalog.id, "hello-web");
});

test("topogram new explains external Todo catalog auth failures and neutral alias suggestions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-new-errors-"));
  const source = "github:attebury/topograms/topograms.catalog.json";
  const authGhBin = createFailingCommand(
    root,
    "gh",
    "gh: Requires authentication (HTTP 401)\n"
  );
  const auth = runCli(["new", path.join(root, "auth"), "--template", externalTodoCatalogAlias, "--catalog", source], {
    env: { PATH: `${authGhBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(auth.status, 0, auth.stdout);
  assert.match(auth.stderr, literalPattern(`Catalog template alias '${externalTodoCatalogAlias}' could not be resolved`));
  assert.match(auth.stderr, /Authentication is required to read private catalog/);
  assert.match(auth.stderr, /GITHUB_TOKEN or GH_TOKEN/);
  assert.match(auth.stderr, /registry-specific npm auth/);

  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry({
      id: "hello-web",
      package: "@scope/topogram-starter-hello-web",
      description: "Vanilla HTML/CSS/JS web starter",
      surfaces: ["web"],
      tags: ["hello", "web"]
    }),
    sampleTemplateCatalogEntry({
      id: "web-api",
      package: "@scope/topogram-starter-web-api",
      description: "React and Express starter",
      surfaces: ["web", "api"],
      stack: "React + Express",
      tags: ["react", "express", "web", "api"]
    }),
    sampleTemplateCatalogEntry({
      id: "web-api-db",
      package: "@scope/topogram-starter-web-api-db",
      description: "SvelteKit, Hono, and Postgres starter",
      surfaces: ["web", "api", "database"],
      stack: "SvelteKit + Hono + Postgres",
      tags: ["sveltekit", "hono", "postgres", "web", "api", "database"]
    })
  ]);
  const missing = runCli(["new", path.join(root, "missing"), "--template", "react", "--catalog", catalogPath]);
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stderr, /No template entry named 'react' was found in the catalog/);
  assert.match(missing.stderr, /Suggested templates: web-api, hello-web\./);
  assert.match(missing.stderr, /topogram template list/);
  assert.match(missing.stderr, literalPattern(externalTodoTemplatePackageSpec()));
});

test("package-backed external Todo template installs explain package auth failures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-auth-errors-"));
  const projectRoot = path.join(root, "starter");
  const fakeNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E401\nnpm error 401 Unauthorized - unauthenticated: User cannot be authenticated with the token provided.\n"
  );
  const create = runCli(["new", projectRoot, "--template", externalTodoTemplatePackageSpec()], {
    env: { PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, literalPattern(`Authentication is required to install template package '${externalTodoTemplatePackageSpec()}'`));
  assert.match(create.stderr, /configure npm auth for the package registry/);
  assert.match(create.stderr, /token with package read access/);
  assert.match(create.stderr, /topogram doctor/);

  const missingNpmBin = createFailingCommand(
    root,
    "npm",
    `npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/${externalTodoTemplatePackageName.replace("/", "%2f")} - not_found\n`
  );
  const missing = runCli(["new", path.join(root, "missing"), "--template", externalTodoTemplatePackageSpec("9.9.9")], {
    env: { PATH: `${missingNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stderr, /was not found, or the current token does not have access/);
  assert.match(missing.stderr, /Check the package name\/version/);
  assert.match(missing.stderr, /topogram doctor/);

  const forbiddenNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E403\nnpm error 403 Forbidden - permission denied\n"
  );
  const forbidden = runCli(["new", path.join(root, "forbidden"), "--template", externalTodoTemplatePackageSpec()], {
    env: { PATH: `${forbiddenNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(forbidden.status, 0, forbidden.stdout);
  assert.match(forbidden.stderr, /Package access was denied while installing template package/);
  assert.match(forbidden.stderr, /token with package read access/);
  assert.match(forbidden.stderr, /topogram doctor/);

  const integrityNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code EINTEGRITY\nnpm error integrity checksum failed\n"
  );
  const integrity = runCli(["new", path.join(root, "integrity"), "--template", externalTodoTemplatePackageSpec()], {
    env: { PATH: `${integrityNpmBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(integrity.status, 0, integrity.stdout);
  assert.match(integrity.stderr, /Package integrity failed while installing template package/);
  assert.match(integrity.stderr, /published registry tarball/);
});

test("restricted GitHub catalog failures explain auth and access setup", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-auth-errors-"));
  const source = "github:attebury/topograms/topograms.catalog.json";
  const authGhBin = createFailingCommand(
    root,
    "gh",
    "gh: Requires authentication (HTTP 401)\n"
  );
  const auth = runCli(["catalog", "list", "--catalog", source], {
    env: { PATH: `${authGhBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(auth.status, 0, auth.stdout);
  assert.match(auth.stderr, /Authentication is required to read private catalog/);
  assert.match(auth.stderr, /GITHUB_TOKEN or GH_TOKEN/);

  const missingGhBin = createFailingCommand(
    root,
    "gh",
    "gh: Not Found (HTTP 404)\n"
  );
  const missing = runCli(["catalog", "list", "--catalog", source], {
    env: { PATH: `${missingGhBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.match(missing.stderr, /Catalog source 'github:attebury\/topograms\/topograms\.catalog\.json' was not found/);
  assert.match(missing.stderr, /repository read access/);
});

test("topogram package update-cli updates consumer dependency and runs available checks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-update-cli-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  const scripts = {};
  for (const scriptName of packageUpdateCliCheckScripts) {
    scripts[scriptName] = "node -e true";
  }
  writePackageJson(projectRoot, {
    name: "consumer",
    private: true,
    scripts,
    devDependencies: {
      "@topogram/cli": "^0.2.32"
    }
  });
  writeJson(path.join(projectRoot, "package-lock.json"), {
    name: "consumer",
    lockfileVersion: 3,
    requires: true,
    packages: {}
  });
  const fakeNpmBin = createFakeNpm(root);
  const runLog = path.join(root, "npm-run.log");
  const update = runCli(["package", "update-cli", "0.2.37"], {
    cwd: projectRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.2.37",
      FAKE_NPM_RUN_LOG: runLog,
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(update.status, 0, update.stderr || update.stdout);
  assert.match(update.stdout, /Updated @topogram\/cli to \^0\.2\.37/);
  assert.match(update.stdout, literalPattern(`Checks run: ${packageUpdateCliPreferredScripts.join(", ")}`));
  assert.match(update.stdout, literalPattern("Checks skipped: pack:check (covered by verify), check (covered by verify)"));
  assert.equal(readJson(path.join(projectRoot, "package.json")).devDependencies["@topogram/cli"], "^0.2.37");
  assert.equal(readJson(path.join(projectRoot, "package-lock.json")).packages["node_modules/@topogram/cli"].version, "0.2.37");
  assert.deepEqual(fs.readFileSync(runLog, "utf8").trim().split("\n"), packageUpdateCliPreferredScripts);

  const packCheckRoot = path.join(root, "pack-check-consumer");
  fs.mkdirSync(packCheckRoot, { recursive: true });
  writePackageJson(packCheckRoot, {
    name: "pack-check-consumer",
    private: true,
    scripts: {
      doctor: "node -e true",
      check: "node -e true",
      "pack:check": "node -e true"
    },
    devDependencies: {
      "@topogram/cli": "^0.2.32"
    }
  });
  const packCheckRunLog = path.join(root, "pack-check-npm-run.log");
  const packCheckUpdate = runCli(["package", "update-cli", "0.2.37", "--json"], {
    cwd: packCheckRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.2.37",
      FAKE_NPM_RUN_LOG: packCheckRunLog,
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(packCheckUpdate.status, 0, packCheckUpdate.stderr || packCheckUpdate.stdout);
  const packCheckPayload = JSON.parse(packCheckUpdate.stdout);
  assert.deepEqual(packCheckPayload.scriptsRun, ["doctor", "pack:check"]);
  assert.deepEqual(packCheckPayload.skippedScripts, [
    "cli:surface",
    "catalog:show",
    "catalog:template-show",
    "verify",
    "check (covered by pack:check)"
  ]);
  assert.deepEqual(fs.readFileSync(packCheckRunLog, "utf8").trim().split("\n"), ["doctor", "pack:check"]);

  const realScriptsRoot = path.join(root, "real-scripts-consumer");
  fs.mkdirSync(path.join(realScriptsRoot, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(realScriptsRoot, "scripts", "record.cjs"),
    "const fs = require('node:fs'); fs.appendFileSync('./real-script-log.txt', process.argv[2] + '\\n');\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(realScriptsRoot, "scripts", "fail.cjs"),
    "process.stderr.write('covered script should not run\\n'); process.exit(42);\n",
    "utf8"
  );
  writePackageJson(realScriptsRoot, {
    name: "real-scripts-consumer",
    private: true,
    scripts: {
      doctor: "node ./scripts/record.cjs doctor",
      check: "node ./scripts/fail.cjs",
      "pack:check": "node ./scripts/record.cjs pack:check"
    },
    devDependencies: {
      "@topogram/cli": "^0.2.32"
    }
  });
  const realScriptsUpdate = runCli(["package", "update-cli", "0.2.37", "--json"], {
    cwd: realScriptsRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.2.37",
      FAKE_NPM_RUN_REAL: "1",
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(realScriptsUpdate.status, 0, realScriptsUpdate.stderr || realScriptsUpdate.stdout);
  const realScriptsPayload = JSON.parse(realScriptsUpdate.stdout);
  assert.deepEqual(realScriptsPayload.scriptsRun, ["doctor", "pack:check"]);
  assert.deepEqual(realScriptsPayload.skippedScripts, [
    "cli:surface",
    "catalog:show",
    "catalog:template-show",
    "verify",
    "check (covered by pack:check)"
  ]);
  assert.deepEqual(fs.readFileSync(path.join(realScriptsRoot, "real-script-log.txt"), "utf8").trim().split("\n"), [
    "doctor",
    "pack:check"
  ]);

  const minimalRoot = path.join(root, "minimal");
  fs.mkdirSync(minimalRoot, { recursive: true });
  writePackageJson(minimalRoot, { name: "minimal", private: true });
  const minimal = runCli(["package", "update-cli", "0.2.37", "--json"], {
    cwd: minimalRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.2.37",
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(minimal.status, 0, minimal.stderr || minimal.stdout);
  const minimalPayload = JSON.parse(minimal.stdout);
  assert.equal(minimalPayload.ok, true);
  assert.deepEqual(minimalPayload.scriptsRun, []);
  assert.deepEqual(minimalPayload.skippedScripts, [
    "cli:surface",
    "doctor",
    "catalog:show",
    "catalog:template-show",
    "verify",
    "pack:check",
    "check"
  ]);
});

test("topogram package update-cli refreshes stale CLI lockfile tarball metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-update-cli-lock-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, {
    name: "consumer",
    private: true,
    scripts: {
      "cli:surface": "node -e 'throw new Error(\"should not run without refreshed node_modules\")'"
    },
    devDependencies: {
      "@topogram/cli": "^0.2.37"
    }
  });
  writeJson(path.join(projectRoot, "package-lock.json"), {
    name: "consumer",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "consumer",
        devDependencies: {
          "@topogram/cli": "^0.2.37"
        }
      },
      "node_modules/@topogram/cli": {
        version: "0.2.37",
        resolved: "https://registry.npmjs.org/@topogram/cli/-/cli-0.2.37.tgz",
        integrity: "sha512-local-pack-integrity",
        dev: true,
        bin: {
          topogram: "src/cli.js"
        }
      }
    }
  });
  const fakeNpmBin = createFakeNpm(root);
  const update = runCli(["package", "update-cli", "0.2.37", "--json"], {
    cwd: projectRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.2.37",
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(update.status, 0, update.stderr || update.stdout);
  const payload = JSON.parse(update.stdout);
  assert.equal(payload.lockfileSanitized, true);
  const cliLockEntry = readJson(path.join(projectRoot, "package-lock.json")).packages["node_modules/@topogram/cli"];
  assert.equal(cliLockEntry.version, "0.2.37");
  assert.equal(Object.prototype.hasOwnProperty.call(cliLockEntry, "resolved"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(cliLockEntry, "integrity"), false);
});

test("topogram package update-cli --latest resolves latest and updates version convention", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-update-cli-latest-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, {
    name: "consumer",
    private: true,
    devDependencies: {
      "@topogram/cli": "^0.2.37"
    }
  });
  fs.writeFileSync(path.join(projectRoot, "topogram-cli.version"), "0.2.37\n", "utf8");
  const fakeNpmBin = createFakeNpm(root);
  const update = runCli(["package", "update-cli", "--latest", "--json"], {
    cwd: projectRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.2.38",
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(update.status, 0, update.stderr || update.stdout);
  const payload = JSON.parse(update.stdout);
  assert.equal(payload.requestedLatest, true);
  assert.equal(payload.requestedVersion, "0.2.38");
  assert.equal(payload.versionConventionUpdated, true);
  assert.equal(readJson(path.join(projectRoot, "package.json")).devDependencies["@topogram/cli"], "^0.2.38");
  assert.equal(fs.readFileSync(path.join(projectRoot, "topogram-cli.version"), "utf8"), "0.2.38\n");
});

test("topogram package update-cli fails when public npm package inspection fails", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-update-cli-npm-fail-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, {
    name: "consumer",
    private: true,
    devDependencies: {
      "@topogram/cli": "^0.2.37"
    }
  });
  const fakeNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E401\nnpm error 401 Unauthorized - GET https://registry.npmjs.org/@topogram%2fcli\n"
  );
  const update = runCli(["package", "update-cli", "0.2.38", "--json"], {
    cwd: projectRoot,
    env: {
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.notEqual(update.status, 0, update.stdout);
  assert.match(update.stderr, /Authentication is required to inspect @topogram\/cli@0\.2\.38/);
  assert.match(update.stderr, /registry-specific npm auth/);
});

test("topogram package update-cli --latest fails when latest npm lookup fails", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-update-cli-latest-gh-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, {
    name: "consumer",
    private: true,
    devDependencies: {
      "@topogram/cli": "^0.2.37"
    }
  });
  fs.writeFileSync(path.join(projectRoot, "topogram-cli.version"), "0.2.37\n", "utf8");
  const fakeNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E401\nnpm error 401 Unauthorized - GET https://registry.npmjs.org/@topogram%2fcli\n"
  );
  const update = runCli(["package", "update-cli", "--latest", "--json"], {
    cwd: projectRoot,
    env: {
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.notEqual(update.status, 0, update.stdout);
  assert.match(update.stderr, /Authentication is required to inspect @topogram\/cli@latest/);
  assert.match(update.stderr, /registry-specific npm auth/);
});

test("topogram doctor reports refreshable Topogram CLI lockfile metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-doctor-cli-lock-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, {
    name: "consumer",
    private: true,
    devDependencies: {
      "@topogram/cli": "^0.2.37"
    }
  });
  fs.writeFileSync(path.join(projectRoot, "topogram-cli.version"), "0.2.37\n", "utf8");
  writeJson(path.join(projectRoot, "package-lock.json"), {
    name: "consumer",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "consumer",
        devDependencies: {
          "@topogram/cli": "^0.2.37"
        }
      },
      "node_modules/@topogram/cli": {
        version: "0.2.37",
        resolved: "https://registry.npmjs.org/@topogram/cli/-/cli-0.2.36.tgz",
        integrity: "sha512-local-pack-integrity",
        dev: true
      }
    }
  });
  const fakeNpmBin = createFakeNpm(root);
  const doctor = runCli(["doctor", "--catalog", "none", "--json"], {
    cwd: projectRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: cliPackageVersion,
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const payload = JSON.parse(doctor.stdout);
  assert.equal(payload.lockfile.refreshRecommended, true);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "topogram_cli_lockfile_refresh_available"), true);
});

test("topogram doctor accepts current Topogram CLI lockfile metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-doctor-cli-lock-current-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, {
    name: "consumer",
    private: true,
    devDependencies: {
      "@topogram/cli": "^0.2.37"
    }
  });
  fs.writeFileSync(path.join(projectRoot, "topogram-cli.version"), "0.2.37\n", "utf8");
  writeJson(path.join(projectRoot, "package-lock.json"), {
    name: "consumer",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "consumer",
        devDependencies: {
          "@topogram/cli": "^0.2.37"
        }
      },
      "node_modules/@topogram/cli": {
        version: "0.2.37",
        resolved: "https://registry.npmjs.org/@topogram/cli/-/cli-0.2.37.tgz",
        integrity: "sha512-registry-integrity",
        dev: true
      }
    }
  });
  const fakeNpmBin = createFakeNpm(root);
  const doctor = runCli(["doctor", "--catalog", "none", "--json"], {
    cwd: projectRoot,
    env: {
      FAKE_NPM_LATEST_VERSION: cliPackageVersion,
      PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const payload = JSON.parse(doctor.stdout);
  assert.equal(payload.lockfile.refreshRecommended, false);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "topogram_cli_lockfile_refresh_available"), false);
});

test("topogram release status reports package, tag, and first-party consumer pin state", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-status-"));
  for (const consumer of knownCliConsumerRepos) {
    fs.mkdirSync(path.join(root, consumer), { recursive: true });
  }
  fs.writeFileSync(path.join(root, "topogram-starters", "topogram-cli.version"), `${cliPackageVersion}\n`, "utf8");
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, `topogram-v${cliPackageVersion}`);
  const status = runCli(["release", "status", "--json"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: cliPackageVersion,
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.localVersion, cliPackageVersion);
  assert.equal(payload.latestVersion, cliPackageVersion);
  assert.equal(payload.currentPublished, true);
  assert.equal(payload.git.local, true);
  assert.equal(payload.git.remote, true);
  assert.equal(payload.consumers.find((consumer) => consumer.name === "topogram-starters").matchesLocal, true);
  assert.equal(payload.consumerPins.known, knownCliConsumerRepos.length);
  assert.equal(payload.consumerPins.pinned, 1);
  assert.equal(payload.consumerPins.matching, 1);
  assert.equal(payload.consumerPins.differing, 0);
  assert.equal(payload.consumerPins.missing, knownCliConsumerRepos.length - 1);
  assert.equal(payload.consumerPins.allKnownPinned, false);
  assert.deepEqual(payload.consumerPins.matchingNames, ["topogram-starters"]);
  assert.deepEqual(payload.consumerPins.missingNames, knownCliConsumerRepos.filter((consumer) => consumer !== "topogram-starters"));

  const human = runCli(["release", "status"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: cliPackageVersion,
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, new RegExp(`Consumer pins: 1/${knownCliConsumerRepos.length} pinned, 1 matching, 0 differing, ${knownCliConsumerRepos.length - 1} missing`));
  assert.match(human.stdout, /topogram-starters: .* \(matches\)/);
  assert.match(human.stdout, literalPattern(`${firstPartyGeneratorRepos[0]}: missing (missing)`));
});

test("topogram release status warns when latest npm version cannot be checked", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-status-npm-unavailable-"));
  const fakeNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E401\nnpm error 401 Unauthorized - GET https://registry.npmjs.org/@topogram%2fcli\n"
  );
  const fakeGitBin = createFakeGit(root, `topogram-v${cliPackageVersion}`);
  const status = runCli(["release", "status", "--json"], {
    cwd: root,
    env: {
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.latestVersion, null);
  assert.equal(payload.currentPublished, null);
  assert.equal(
    payload.diagnostics.some((diagnostic) => diagnostic.code === "release_latest_unavailable"),
    true
  );

  const human = runCli(["release", "status"], {
    cwd: root,
    env: {
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Warning: Authentication is required to inspect @topogram\/cli@latest/);
});

test("topogram release status strict passes when package, tag, and consumers are current", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-status-strict-pass-"));
  writeKnownCliConsumerPins(root, cliPackageVersion);
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry({
      id: "sample-template",
      package: "@topogram/starter-sample",
      defaultVersion: "0.1.0",
      generators: ["@topogram/generator-react-web", "@topogram/generator-express-api"],
      stack: "React + Express"
    }),
    {
      id: "sample-topogram",
      kind: "topogram",
      package: "@topogram/topogram-sample",
      defaultVersion: "0.1.0",
      description: "Sample topogram",
      tags: ["sample"],
      trust: {
        scope: "@topogram",
        includesExecutableImplementation: false
      }
    }
  ]);
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, `topogram-v${cliPackageVersion}`);
  const fakeGhBin = createFakeGh(root);
  const strictEnv = {
    FAKE_NPM_LATEST_VERSION: cliPackageVersion,
    FAKE_GIT_HEAD: "abc123",
    TOPOGRAM_CATALOG_SOURCE: catalogPath,
    PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}`
  };
  const status = runCli(["release", "status", "--strict", "--json"], {
    cwd: root,
    env: strictEnv
  });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.strict, true);
  assert.equal(payload.ok, true);
  assert.equal(payload.currentPublished, true);
  assert.equal(payload.git.local, true);
  assert.equal(payload.git.remote, true);
  assert.equal(payload.consumerPins.allKnownPinned, true);
  assert.equal(payload.consumerCi.allCheckedAndPassing, true);
  assert.equal(payload.consumerCi.passing, knownCliConsumerRepos.length);
  assert.equal(payload.consumers.every((consumer) => consumer.ci?.run?.url), true);
  assert.deepEqual(payload.errors, []);

  const human = runCli(["release", "status", "--strict"], {
    cwd: root,
    env: strictEnv
  });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Strict: enabled/);
  assert.match(human.stdout, new RegExp(`Consumer CI: ${knownCliConsumerRepos.length}/${knownCliConsumerRepos.length} passing`));
  assert.match(human.stdout, /https:\/\/github\.com\/attebury\/fake\/actions\/runs\/12345/);

  const reportPath = path.join(root, "release-baseline.md");
  const report = runCli(["release", "status", "--strict", "--write-report", reportPath], {
    cwd: root,
    env: strictEnv
  });
  assert.equal(report.status, 0, report.stderr || report.stdout);
  const reportText = fs.readFileSync(reportPath, "utf8");
  assert.match(reportText, /^# Known-Good Release Matrix/m);
  assert.match(reportText, new RegExp(`\`@topogram/cli@${literalPattern(cliPackageVersion).source}\``));
  assert.match(reportText, new RegExp(`Consumer CI: ${knownCliConsumerRepos.length}/${knownCliConsumerRepos.length} passing`));
  assert.match(reportText, /## Catalog Entries/);
  assert.match(reportText, /\| `sample-template` \| template \| `@topogram\/starter-sample` \| `0\.1\.0` \| React \+ Express \|/);
  assert.match(reportText, /\| `sample-topogram` \| topogram \| `@topogram\/topogram-sample` \| `0\.1\.0` \| not declared \|/);
  assert.match(reportText, /## Generator Packages/);
  assert.match(reportText, /\| `@topogram\/generator-react-web` \| web \| sample-template \|/);
  assert.match(reportText, /\| `@topogram\/generator-express-api` \| api \| sample-template \|/);
  assert.match(reportText, /https:\/\/github\.com\/attebury\/fake\/actions\/runs\/12345/);

  const markdown = runCli(["release", "status", "--strict", "--markdown"], {
    cwd: root,
    env: strictEnv
  });
  assert.equal(markdown.status, 0, markdown.stderr || markdown.stdout);
  assert.match(markdown.stdout, /^# Known-Good Release Matrix/m);
});

test("GitHub token path uses REST for catalog and release checks without gh", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-github-rest-"));
  fs.mkdirSync(path.join(root, "topogram-starters"), { recursive: true });
  fs.writeFileSync(path.join(root, "topogram-starters", "topogram-cli.version"), `${cliPackageVersion}\n`, "utf8");
  writeJson(path.join(root, "topogram.config.json"), {
    release: {
      consumers: ["topogram-starters"],
      workflows: {
        "topogram-starters": "Starter Verification"
      }
    }
  });
  const catalog = {
    version: "0.1",
    entries: [
      sampleTemplateCatalogEntry({
        id: "hello-web",
        package: "@topogram/starter-hello-web",
        defaultVersion: "0.1.0",
        description: "Hello web starter",
        tags: ["hello", "web"]
      })
    ]
  };
  const fixtureRoot = path.join(root, "github-api-fixtures");
  const catalogFixturePath = path.join(fixtureRoot, "repos", "attebury", "topograms", "contents", "topograms.catalog.json.json");
  const runsFixturePath = path.join(fixtureRoot, "repos", "attebury", "topogram-starters", "actions", "runs.json");
  fs.mkdirSync(path.dirname(catalogFixturePath), { recursive: true });
  fs.mkdirSync(path.dirname(runsFixturePath), { recursive: true });
  writeJson(catalogFixturePath, {
    content: Buffer.from(JSON.stringify(catalog, null, 2) + "\n").toString("base64")
  });
  writeJson(runsFixturePath, {
    workflow_runs: [{
      id: 12345,
      name: "Starter Verification",
      status: "completed",
      conclusion: "success",
      head_sha: "abc123",
      html_url: "https://github.com/attebury/fake/actions/runs/12345"
    }]
  });
  const fixtureLog = path.join(root, "github-api-requests.jsonl");
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, `topogram-v${cliPackageVersion}`);
  const pathWithoutGh = `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${path.dirname(process.execPath)}`;
  const env = {
    FAKE_NPM_LATEST_VERSION: cliPackageVersion,
    GITHUB_TOKEN: "test-token",
    TOPOGRAM_GITHUB_API_FIXTURE_ROOT: fixtureRoot,
    TOPOGRAM_GITHUB_API_FIXTURE_LOG: fixtureLog,
    PATH: pathWithoutGh
  };

  const catalogList = runCli(["catalog", "list", "--catalog", "github:attebury/topograms/topograms.catalog.json", "--json"], {
    cwd: root,
    env
  });
  assert.equal(catalogList.status, 0, catalogList.stderr || catalogList.stdout);
  assert.equal(JSON.parse(catalogList.stdout).entries[0].id, "hello-web");

  const status = runCli(["release", "status", "--strict", "--json"], {
    cwd: root,
    env
  });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.consumerCi.passing, 1);
  assert.equal(payload.consumers[0].ci.run.workflowName, "Starter Verification");

  const apiRequests = readJsonl(fixtureLog);
  assert.equal(apiRequests.some((request) => request.path === "repos/attebury/topograms/contents/topograms.catalog.json"), true);
  assert.equal(apiRequests.some((request) => request.path === "repos/attebury/topogram-starters/actions/runs"), true);
  assert.deepEqual([...new Set(apiRequests.map((request) => request.tokenPresent))], [true]);
  assert.deepEqual([...new Set(apiRequests.map((request) => request.tokenWouldAttach))], [true]);
});

test("topogram release status strict accepts remote release tags without a local fetched tag", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-status-remote-tag-"));
  writeKnownCliConsumerPins(root, cliPackageVersion);
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, `topogram-v${cliPackageVersion}`);
  const fakeGhBin = createFakeGh(root);
  const status = runCli(["release", "status", "--strict", "--json"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: cliPackageVersion,
      FAKE_GIT_HEAD: "abc123",
      FAKE_GIT_LOCAL_TAG: "0",
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.git.local, false);
  assert.equal(payload.git.remote, true);
  assert.equal(payload.ok, true);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "release_local_tag_missing"), false);
});

test("topogram release status strict fails when first-party consumer pins are missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-status-strict-fail-"));
  for (const consumer of knownCliConsumerRepos) {
    fs.mkdirSync(path.join(root, consumer), { recursive: true });
  }
  fs.writeFileSync(path.join(root, "topogram-starters", "topogram-cli.version"), "0.0.1\n", "utf8");
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, "topogram-v0.0.1");
  const status = runCli(["release", "status", "--strict", "--json"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.0.1",
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(status.status, 1, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.strict, true);
  assert.equal(payload.ok, false);
  const codes = payload.diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes("release_latest_not_current"));
  assert.ok(codes.includes("release_local_tag_missing"));
  assert.ok(codes.includes("release_remote_tag_missing"));
  assert.ok(codes.includes("release_consumer_pins_not_current"));
  assert.ok(codes.includes("release_consumer_ci_not_current"));
});

test("topogram release status strict fails when consumer CI is not green on the checked-out commit", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-status-strict-ci-fail-"));
  writeKnownCliConsumerPins(root, cliPackageVersion);
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, `topogram-v${cliPackageVersion}`);
  const fakeGhBin = createFakeGh(root);
  const status = runCli(["release", "status", "--strict", "--json"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: cliPackageVersion,
      FAKE_GIT_HEAD: "abc123",
      FAKE_GH_RUN_CONCLUSION: "failure",
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(status.status, 1, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.consumerPins.allKnownPinned, true);
  assert.equal(payload.consumerCi.allCheckedAndPassing, false);
  assert.equal(payload.consumerCi.failing, knownCliConsumerRepos.length);
  const codes = payload.diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes("release_consumer_ci_not_successful"));
  assert.ok(codes.includes("release_consumer_ci_not_current"));
});

test("topogram release status strict fails when an expected consumer CI job is not green", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-status-strict-ci-job-fail-"));
  writeKnownCliConsumerPins(root, cliPackageVersion);
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, `topogram-v${cliPackageVersion}`);
  const fakeGhBin = createFakeGh(root);
  const status = runCli(["release", "status", "--strict", "--json"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: cliPackageVersion,
      FAKE_GIT_HEAD: "abc123",
      FAKE_GH_JOB_CONCLUSION: "failure",
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(status.status, 1, status.stderr || status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.consumerPins.allKnownPinned, true);
  assert.equal(payload.consumerCi.allCheckedAndPassing, false);
  const topograms = payload.consumers.find((consumer) => consumer.name === "topograms");
  assert.equal(topograms.ci.run.conclusion, "success");
  assert.equal(topograms.ci.run.jobs.length, 7);
  const codes = payload.diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes("release_consumer_ci_job_not_successful"));
  assert.ok(codes.includes("release_consumer_ci_not_current"));
});

test("topogram release roll-consumers updates, verifies, commits, pushes, and reports workflow URLs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-roll-consumers-"));
  for (const consumer of knownCliConsumerRepos) {
    const consumerRoot = path.join(root, consumer);
    fs.mkdirSync(consumerRoot, { recursive: true });
    fs.writeFileSync(path.join(consumerRoot, "topogram-cli.version"), "0.3.45\n", "utf8");
    writePackageJson(consumerRoot, {
      name: consumer,
      private: true,
      scripts: {
        "pack:check": "node -e true"
      },
      devDependencies: {
        "@topogram/cli": "^0.3.45"
      }
    });
    writeJson(path.join(consumerRoot, "package-lock.json"), {
      name: consumer,
      lockfileVersion: 3,
      requires: true,
      packages: {}
    });
  }
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, `topogram-v0.3.46`);
  const fakeGhBin = createFakeGh(root);
  const roll = runCli(["release", "roll-consumers", "0.3.46", "--json", "--watch"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.3.46",
      FAKE_GIT_HEAD: "def456",
      FAKE_GH_RUN_SEQUENCE: JSON.stringify([
        { headSha: "old123", status: "completed", conclusion: "success", databaseId: 11111 },
        { headSha: "def456", status: "in_progress", conclusion: "", databaseId: 22222 },
        { headSha: "def456", status: "completed", conclusion: "success", databaseId: 33333, url: "https://github.com/attebury/fake/actions/runs/33333" }
      ]),
      TOPOGRAM_RELEASE_WATCH_INTERVAL_MS: "1",
      TOPOGRAM_RELEASE_WATCH_TIMEOUT_MS: "5000",
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(roll.status, 0, roll.stderr || roll.stdout);
  const payload = JSON.parse(roll.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.watched, true);
  assert.equal(payload.requestedVersion, "0.3.46");
  assert.equal(payload.consumers.length, knownCliConsumerRepos.length);
  assert.equal(payload.consumers.every((consumer) => consumer.updated && consumer.committed && consumer.pushed), true);
  assert.equal(payload.consumers.every((consumer) => consumer.ci?.run?.url), true);
  assert.equal(payload.recovery.resumeCommand, "topogram release roll-consumers 0.3.46 --watch");
  assert.equal(payload.recovery.pushed.length, knownCliConsumerRepos.length);
  assert.equal(
    payload.diagnostics.some((diagnostic) => diagnostic.code === "release_consumer_ci_head_mismatch"),
    false
  );
  assert.equal(readText(path.join(root, externalTodoConsumerRepos[1], "topogram-cli.version")).trim(), "0.3.46");
  assert.equal(readJson(path.join(root, externalTodoConsumerRepos[1], "package.json")).devDependencies["@topogram/cli"], "^0.3.46");

  const human = runCli(["release", "roll-consumers", "0.3.46"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.3.46",
      FAKE_GIT_HEAD: "def456",
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Topogram consumer rollout completed/);
  assert.match(human.stdout, literalPattern(`${externalTodoConsumerRepos[1]}: pushed`));
  assert.match(human.stdout, /https:\/\/github\.com\/attebury\/fake\/actions\/runs\/12345/);
  assert.match(human.stdout, /Recovery:/);
  assert.match(human.stderr, /\[roll-consumers\].*updating @topogram\/cli to 0\.3\.46/);
  assert.match(human.stderr, /\[roll-consumers\].*pushing rollout commit/);
});

test("topogram release roll-consumers reports recovery state for already-current unpushed consumers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-roll-consumers-recovery-"));
  for (const consumer of knownCliConsumerRepos) {
    const consumerRoot = path.join(root, consumer);
    fs.mkdirSync(consumerRoot, { recursive: true });
    fs.writeFileSync(path.join(consumerRoot, "topogram-cli.version"), "0.3.46\n", "utf8");
    writePackageJson(consumerRoot, {
      name: consumer,
      private: true,
      scripts: {
        "pack:check": "node -e true"
      },
      devDependencies: {
        "@topogram/cli": "^0.3.46"
      }
    });
    writeJson(path.join(consumerRoot, "package-lock.json"), {
      name: consumer,
      lockfileVersion: 3,
      requires: true,
      packages: {}
    });
  }
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, `topogram-v0.3.46`);
  const fakeGhBin = createFakeGh(root);
  const roll = runCli(["release", "roll-consumers", "0.3.46", "--json", "--no-watch"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.3.46",
      FAKE_GIT_HEAD: "def456",
      FAKE_GIT_ADD_STAGES: "0",
      FAKE_GIT_AHEAD: "1",
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(roll.status, 0, roll.stderr || roll.stdout);
  const payload = JSON.parse(roll.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.consumers.every((consumer) => consumer.alreadyCurrent), true);
  assert.equal(payload.consumers.every((consumer) => consumer.recoveredPush && consumer.pushed), true);
  assert.equal(payload.recovery.alreadyCurrent.length, knownCliConsumerRepos.length);
  assert.equal(payload.recovery.recoveredPushes.length, knownCliConsumerRepos.length);
  assert.equal(payload.recovery.resumeCommand, "topogram release roll-consumers 0.3.46 --no-watch");
  assert.match(payload.recovery.watchGuidance, /release status --strict/);
});

test("topogram release roll-consumers rejects conflicting watch flags", () => {
  const roll = runCli(["release", "roll-consumers", "0.3.46", "--watch", "--no-watch"], {
    cwd: fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-roll-consumers-watch-conflict-"))
  });
  assert.equal(roll.status, 1, roll.stderr || roll.stdout);
  assert.match(roll.stderr, /Use either --watch or --no-watch/);
});

test("topogram release roll-consumers --watch fails when current consumer workflow fails", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-release-roll-consumers-watch-fail-"));
  for (const consumer of knownCliConsumerRepos) {
    const consumerRoot = path.join(root, consumer);
    fs.mkdirSync(consumerRoot, { recursive: true });
    fs.writeFileSync(path.join(consumerRoot, "topogram-cli.version"), "0.3.45\n", "utf8");
    writePackageJson(consumerRoot, {
      name: consumer,
      private: true,
      scripts: {
        "pack:check": "node -e true"
      },
      devDependencies: {
        "@topogram/cli": "^0.3.45"
      }
    });
    writeJson(path.join(consumerRoot, "package-lock.json"), {
      name: consumer,
      lockfileVersion: 3,
      requires: true,
      packages: {}
    });
  }
  const fakeNpmBin = createFakeNpm(root);
  const fakeGitBin = createFakeGit(root, "topogram-v0.3.46");
  const fakeGhBin = createFakeGh(root);
  const roll = runCli(["release", "roll-consumers", "0.3.46", "--json", "--watch"], {
    cwd: root,
    env: {
      FAKE_NPM_LATEST_VERSION: "0.3.46",
      FAKE_GIT_HEAD: "def456",
      FAKE_GH_RUN_CONCLUSION: "failure",
      TOPOGRAM_RELEASE_WATCH_INTERVAL_MS: "1",
      TOPOGRAM_RELEASE_WATCH_TIMEOUT_MS: "1000",
      PATH: `${fakeNpmBin}${path.delimiter}${fakeGitBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}`
    }
  });
  assert.equal(roll.status, 1, roll.stderr || roll.stdout);
  const payload = JSON.parse(roll.stdout);
  assert.equal(payload.watched, true);
  assert.equal(payload.ok, false);
  assert.equal(
    payload.diagnostics.some((diagnostic) => diagnostic.code === "release_consumer_ci_not_successful"),
    true
  );
});

test("topogram package update-cli explains private package auth failures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-update-cli-auth-"));
  const projectRoot = path.join(root, "consumer");
  fs.mkdirSync(projectRoot, { recursive: true });
  writePackageJson(projectRoot, { name: "consumer", private: true });
  const fakeNpmBin = createFailingCommand(
    root,
    "npm",
    "npm error code E401\nnpm error 401 Unauthorized - unauthenticated: User cannot be authenticated with the token provided.\n"
  );
  const fakeGhBin = createFailingCommand(root, "gh", "gh api failed\n");
  const update = runCli(["package", "update-cli", "0.2.37"], {
    cwd: projectRoot,
    env: { PATH: `${fakeNpmBin}${path.delimiter}${fakeGhBin}${path.delimiter}${process.env.PATH || ""}` }
  });
  assert.notEqual(update.status, 0, update.stdout);
  assert.match(update.stderr, /Authentication is required to inspect @topogram\/cli@0\.2\.37/);
  assert.match(update.stderr, /registry-specific npm auth/);
});

test("topogram catalog copy installs pure topogram packages and rejects implementation code", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-catalog-copy-"));
  const packageRoot = createPureTopogramPackage(root, "hello-topogram-package");
  const unsafePackageRoot = createPureTopogramPackage(root, "unsafe-topogram-package", { implementation: true });
  const missingTopogramPackageRoot = createPureTopogramPackage(root, "missing-topogram-package");
  fs.rmSync(path.join(missingTopogramPackageRoot, "topo"), { recursive: true });
  const legacyTopogramPackageRoot = createPureTopogramPackage(root, "legacy-topogram-package");
  fs.renameSync(path.join(legacyTopogramPackageRoot, "topo"), path.join(legacyTopogramPackageRoot, "topogram"));
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry(),
    sampleTemplateCatalogEntry({
      id: "hello",
      kind: "topogram",
      package: "@scope/topogram-hello",
      defaultVersion: "0.1.0",
      description: "Hello topogram",
      tags: ["hello"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    }),
    sampleTemplateCatalogEntry({
      id: "unsafe-package",
      kind: "topogram",
      package: "@scope/topogram-unsafe-package",
      defaultVersion: "0.1.0",
      description: "Unsafe topogram package",
      tags: ["unsafe"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    }),
    sampleTemplateCatalogEntry({
      id: "missing-topogram",
      kind: "topogram",
      package: "@scope/topogram-missing-topogram",
      defaultVersion: "0.1.0",
      description: "Missing topogram package",
      tags: ["unsafe"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    }),
    sampleTemplateCatalogEntry({
      id: "legacy-topogram",
      kind: "topogram",
      package: "@scope/topogram-legacy-topogram",
      defaultVersion: "0.1.0",
      description: "Legacy topogram package",
      tags: ["legacy"],
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      }
    })
  ]);
  const fakeNpmBin = createFakeNpm(root);
  const env = {
    FAKE_NPM_PACKAGES: JSON.stringify({
      "@scope/topogram-hello@0.1.0": packageRoot,
      "@scope/topogram-unsafe-package@0.1.0": unsafePackageRoot,
      "@scope/topogram-missing-topogram@0.1.0": missingTopogramPackageRoot,
      "@scope/topogram-legacy-topogram@0.1.0": legacyTopogramPackageRoot
    }),
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const targetRoot = path.join(root, "copied");
  const humanTargetRoot = path.join(root, "copied-human");
  const humanCopy = runCli(["catalog", "copy", "hello", humanTargetRoot, "--catalog", catalogPath], { env });
  assert.equal(humanCopy.status, 0, humanCopy.stderr || humanCopy.stdout);
  assert.match(humanCopy.stdout, /Copied catalog topogram 'hello'/);
  assert.match(humanCopy.stdout, /Package: @scope\/topogram-hello@0\.1\.0/);
  assert.match(humanCopy.stdout, /Source provenance: .*\.topogram-source\.json/);
  assert.match(humanCopy.stdout, /Files: \d+/);
  assert.match(humanCopy.stdout, /\.topogram-source\.json records catalog-copy provenance only\. Local edits are allowed\./);
  assert.match(humanCopy.stdout, /Next steps:/);
  assert.match(humanCopy.stdout, /topogram source status/);
  assert.match(humanCopy.stdout, /topogram check/);
  assert.match(humanCopy.stdout, /topogram generate/);
  assert.equal(fs.existsSync(path.join(humanTargetRoot, ".topogram-source.json")), true);

  const humanSourceStatus = runCli(["source", "status"], { cwd: humanTargetRoot });
  assert.equal(humanSourceStatus.status, 0, humanSourceStatus.stderr || humanSourceStatus.stdout);
  assert.match(humanSourceStatus.stdout, /Topogram source status: clean/);
  assert.match(humanSourceStatus.stdout, /Catalog: hello from /);
  assert.match(humanSourceStatus.stdout, /Package: @scope\/topogram-hello@0\.1\.0/);
  assert.match(humanSourceStatus.stdout, /Changed: 0/);
  assert.match(humanSourceStatus.stdout, /\.topogram-source\.json records catalog-copy provenance only\. Local edits are allowed\./);
  assert.match(humanSourceStatus.stdout, /Template baseline drift does not block `topogram check` or `topogram generate`\./);
  assert.match(humanSourceStatus.stdout, /Implementation trust is separate and can block check\/generate when review is required\./);
  assert.match(humanSourceStatus.stdout, /Next: run `topogram check` or `topogram generate`\./);

  const copy = runCli(["catalog", "copy", "hello", targetRoot, "--catalog", catalogPath, "--json"], { env });
  assert.equal(copy.status, 0, copy.stderr || copy.stdout);
  const payload = JSON.parse(copy.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.packageSpec, "@scope/topogram-hello@0.1.0");
  assert.equal(fs.existsSync(path.join(targetRoot, "topo")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, "README.md")), true);
  assert.equal(fs.existsSync(path.join(targetRoot, ".topogram-source.json")), true);
  assert.equal(payload.files.some((file) => file === "topogram.project.json"), true);
  assert.equal(payload.provenancePath, path.join(targetRoot, ".topogram-source.json"));

  const sourceRecord = readJson(path.join(targetRoot, ".topogram-source.json"));
  assert.equal(sourceRecord.kind, "topogram");
  assert.equal(sourceRecord.catalog.id, "hello");
  assert.equal(sourceRecord.catalog.source, catalogPath);
  assert.equal(sourceRecord.package.name, "@scope/topogram-hello");
  assert.equal(sourceRecord.package.version, "0.1.0");
  assert.equal(sourceRecord.package.spec, "@scope/topogram-hello@0.1.0");
  assert.equal(sourceRecord.trust.includesExecutableImplementation, false);
  assert.ok(sourceRecord.files.some((file) => file.path === "topogram.project.json" && /^[a-f0-9]{64}$/.test(file.sha256)));

  const cleanStatus = runCli(["source", "status", "--json"], { cwd: targetRoot });
  assert.equal(cleanStatus.status, 0, cleanStatus.stderr || cleanStatus.stdout);
  const cleanPayload = JSON.parse(cleanStatus.stdout);
  assert.equal(cleanPayload.exists, true);
  assert.equal(cleanPayload.status, "clean");
  assert.deepEqual(cleanPayload.content.changed, []);
  assert.deepEqual(cleanPayload.content.added, []);
  assert.deepEqual(cleanPayload.content.removed, []);

  fs.appendFileSync(path.join(targetRoot, "topo", "entities", "entity-greeting.tg"), "\n# local edit\n", "utf8");
  fs.writeFileSync(path.join(targetRoot, "topo", "entities", "entity-local-note.tg"), "# local note\n", "utf8");
  fs.rmSync(path.join(targetRoot, "README.md"));
  const changedStatus = runCli(["source", "status", "--json"], { cwd: targetRoot });
  assert.equal(changedStatus.status, 0, changedStatus.stderr || changedStatus.stdout);
  const changedPayload = JSON.parse(changedStatus.stdout);
  assert.equal(changedPayload.status, "changed");
  assert.deepEqual(changedPayload.content.changed, ["topo/entities/entity-greeting.tg"]);
  assert.deepEqual(changedPayload.content.added, ["topo/entities/entity-local-note.tg"]);
  assert.deepEqual(changedPayload.content.removed, ["README.md"]);

  const changedHumanStatus = runCli(["source", "status"], { cwd: targetRoot });
  assert.equal(changedHumanStatus.status, 0, changedHumanStatus.stderr || changedHumanStatus.stdout);
  assert.match(changedHumanStatus.stdout, /Topogram source status: changed/);
  assert.match(changedHumanStatus.stdout, /Changed: 1/);
  assert.match(changedHumanStatus.stdout, /Added: 1/);
  assert.match(changedHumanStatus.stdout, /Removed: 1/);
  assert.match(changedHumanStatus.stdout, /Next: review the listed files, then run `topogram check` and `topogram generate` when ready\./);

  const missingStatus = runCli(["source", "status", path.join(root, "no-provenance"), "--json"]);
  assert.equal(missingStatus.status, 0, missingStatus.stderr || missingStatus.stdout);
  const missingPayload = JSON.parse(missingStatus.stdout);
  assert.equal(missingPayload.exists, false);
  assert.equal(missingPayload.status, "missing");
  assert.match(missingPayload.diagnostics[0].message, /\.topogram-source\.json was not found/);

  const missingHumanStatus = runCli(["source", "status", path.join(root, "no-provenance")]);
  assert.equal(missingHumanStatus.status, 0, missingHumanStatus.stderr || missingHumanStatus.stdout);
  assert.match(missingHumanStatus.stdout, /Topogram source status: no provenance/);
  assert.match(missingHumanStatus.stdout, /\.topogram-source\.json was not found/);
  assert.match(missingHumanStatus.stdout, /Next: use `topogram catalog copy <id> <target>`/);

  const unsafeTarget = path.join(root, "unsafe-copy");
  const unsafe = runCli(["catalog", "copy", "unsafe-package", unsafeTarget, "--catalog", catalogPath], { env });
  assert.notEqual(unsafe.status, 0, unsafe.stdout);
  assert.match(unsafe.stderr, /contains implementation\/, which is not allowed/);

  const templateCopy = runCli(["catalog", "copy", "sample-template", path.join(root, "template-copy"), "--catalog", catalogPath], { env });
  assert.notEqual(templateCopy.status, 0, templateCopy.stdout);
  assert.match(templateCopy.stderr, /Catalog topogram entry 'sample-template' was not found/);

  const missingTopogramCopy = runCli(["catalog", "copy", "missing-topogram", path.join(root, "missing-topogram-copy"), "--catalog", catalogPath], { env });
  assert.notEqual(missingTopogramCopy.status, 0, missingTopogramCopy.stdout);
  assert.match(missingTopogramCopy.stderr, /is missing topo\//);

  const legacyTopogramCopy = runCli(["catalog", "copy", "legacy-topogram", path.join(root, "legacy-topogram-copy"), "--catalog", catalogPath], { env });
  assert.notEqual(legacyTopogramCopy.status, 0, legacyTopogramCopy.stdout);
  assert.match(legacyTopogramCopy.stderr, /is missing topo\//);
  assert.equal(fs.existsSync(path.join(root, "legacy-topogram-copy", "topo")), false);
  assert.equal(fs.existsSync(path.join(root, "legacy-topogram-copy", "topogram")), false);
});

test("public commands default to project workspace and app paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-defaults-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["create", projectRoot, "--template", path.join(fixtureTemplatesRoot, "hello-web")]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Topogram check passed/);

  const inspect = runCli(["check", "--json"], { cwd: projectRoot });
  assert.equal(inspect.status, 0, inspect.stderr || inspect.stdout);
  assert.equal(JSON.parse(inspect.stdout).project.resolvedTopology.runtimes.length, 1);

  const install = runNpm(["install"], projectRoot);
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
});

test("topogram new defaults to the catalog hello-web starter", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-new-default-"));
  const fakeNpmBin = createFakeNpm(root);
  const templateRoot = path.join(fixtureTemplatesRoot, "hello-web");
  const catalogPath = createCatalog(root, [
    sampleTemplateCatalogEntry({
      id: "hello-web",
      package: "@scope/topogram-starter-hello-web",
      defaultVersion: "0.1.0",
      trust: {
        scope: "@scope",
        includesExecutableImplementation: false
      },
      surfaces: ["web"],
      generators: ["topogram/vanilla-web"],
      stack: "Vanilla HTML/CSS/JS"
    })
  ]);
  const env = {
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`,
    FAKE_NPM_PACKAGES: JSON.stringify({
      "@scope/topogram-starter-hello-web@0.1.0": templateRoot
    })
  };
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--catalog", catalogPath], { env });
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: topogram\/hello-web/);
  assert.match(create.stdout, /Source: package/);
  assert.match(create.stdout, /Catalog: hello-web from /);
  assert.match(create.stdout, /Executable implementation: no/);
  assert.match(create.stdout, /Policy: topogram\.template-policy\.json/);
  assert.match(create.stdout, /Template files: \.topogram-template-files\.json/);
  assert.doesNotMatch(create.stdout, /Trust: \.topogram-template-trust\.json/);
  assert.match(create.stdout, /npm run doctor/);
  assert.match(create.stdout, /npm run source:status/);
  assert.doesNotMatch(create.stdout, /npm run template:policy:explain/);
  assert.doesNotMatch(create.stdout, /npm run trust:status/);
  assert.equal(create.stderr, "");
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "topo", "docs", "workflows", "workflow-hello.md")), true);

  const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "topogram.project.json"), "utf8"));
  assert.equal(projectConfig.template.id, "topogram/hello-web");
  assert.equal(projectConfig.template.requested, "hello-web");
  assert.equal(projectConfig.template.source, "package");
  assert.equal(projectConfig.template.catalog.id, "hello-web");
  assert.equal(projectConfig.template.includesExecutableImplementation, false);
  assert.equal(projectConfig.topology.runtimes[0].generator.id, "topogram/vanilla-web");

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "web", "app_web", "index.html")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "web", "app_web", "workflow.html")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "services")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "db")), false);
});

test("fixture starter templates generate the expected surface layout", () => {
  const cases = [
    {
      template: "hello-web",
      present: ["app/apps/web/app_web/index.html", "app/apps/web/app_web/workflow.html"],
      absent: ["app/apps/services", "app/apps/db"]
    },
    {
      template: "hello-api",
      present: ["app/apps/services/app_api"],
      absent: ["app/apps/web", "app/apps/db", "app/apps/services/app_api/prisma"]
    },
    {
      template: "hello-db",
      present: ["app/apps/db/app_sqlite"],
      absent: ["app/apps/web", "app/apps/services"]
    },
    {
      template: "web-api",
      present: ["app/apps/services/app_api", "app/apps/web/app_react"],
      absent: ["app/apps/db", "app/apps/services/app_api/prisma"]
    },
    {
      template: "web-api-db",
      present: ["app/apps/services/app_api", "app/apps/web/app_sveltekit", "app/apps/db/app_postgres"],
      absent: []
    }
  ];

  for (const item of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `topogram-${item.template}-`));
    const projectRoot = path.join(root, "starter");
    const create = runCli(["new", projectRoot, "--template", path.join(fixtureTemplatesRoot, item.template)]);
    assert.equal(create.status, 0, create.stderr || create.stdout);
    const generate = runCli(["generate"], { cwd: projectRoot });
    assert.equal(generate.status, 0, `${item.template}\n${generate.stderr || generate.stdout}`);
    for (const relativePath of item.present) {
      assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), true, `${item.template} expected ${relativePath}`);
    }
    for (const relativePath of item.absent) {
      assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), false, `${item.template} did not expect ${relativePath}`);
    }
    if (item.template === "hello-web") {
      const homePage = readText(path.join(projectRoot, "app", "apps", "web", "app_web", "index.html"));
      const workflowPage = readText(path.join(projectRoot, "app", "apps", "web", "app_web", "workflow.html"));
      assert.match(homePage, /Hello Web/);
      assert.match(homePage, /href="\.\/workflow\.html"/);
      assert.match(workflowPage, /Hello Workflow/);
      assert.match(workflowPage, /href="\.\/index\.html"/);
      const styles = readText(path.join(projectRoot, "app", "apps", "web", "app_web", "styles.css"));
      assert.match(styles, /--topogram-design-tone: editorial;/);
      assert.match(styles, /--topogram-design-radius-scale: small;/);
      const coverage = readJson(path.join(projectRoot, "app", "apps", "web", "app_web", "topogram", "generation-coverage.json"));
      assert.equal(coverage.type, "generation_coverage");
      assert.equal(coverage.generator, "topogram/vanilla-web");
      assert.equal(coverage.design_intent.status, "mapped");
      assert.equal(coverage.design_intent.tokens.tone, "editorial");
      assert.deepEqual(coverage.diagnostics, []);
    }
    if (item.template === "hello-api") {
      const indexTs = readText(path.join(projectRoot, "app", "apps", "services", "app_api", "src", "index.ts"));
      assert.match(indexTs, /new Hono\(\)/);
      assert.match(indexTs, /app\.get\("\/hello"/);
      assert.match(indexTs, /capability: "cap_get_hello"/);
      assert.doesNotMatch(indexTs, /capability: "undefined"/);
    }
    if (item.template === "hello-db") {
      const schema = readText(path.join(projectRoot, "app", "apps", "db", "app_sqlite", "prisma", "schema.prisma"));
      assert.match(schema, /provider = "sqlite"/);
      assert.match(schema, /model Greeting/);
      assert.match(schema, /@@map\("greetings"\)/);
      assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "db", "app_sqlite", "scripts", "db-migrate.sh")), true);
    }
    if (item.template === "web-api") {
      const indexTs = readText(path.join(projectRoot, "app", "apps", "services", "app_api", "src", "index.ts"));
      assert.match(indexTs, /import express from "express"/);
      assert.match(indexTs, /app\.post\("\/greetings"/);
      assert.match(indexTs, /capability: "cap_create_greeting"/);
      assert.match(indexTs, /capability: "cap_list_greetings"/);
      assert.doesNotMatch(indexTs, /capability: "undefined"/);
      const listPage = readText(path.join(projectRoot, "app", "apps", "web", "app_react", "src", "pages", "GreetingListPage.tsx"));
      assert.match(listPage, /data-topogram-widget="widget_greeting_table"/);
      assert.match(listPage, /className="widget-card widget-table"/);
      const coverage = readJson(path.join(projectRoot, "app", "apps", "web", "app_react", "src", "lib", "topogram", "generation-coverage.json"));
      assert.equal(coverage.type, "generation_coverage");
      assert.equal(coverage.generator, "topogram/react");
      assert.equal(coverage.summary.routed_screens, 3);
      assert.equal(coverage.summary.rendered_screens, 3);
      assert.equal(coverage.summary.generator_screens, 3);
      assert.equal(coverage.summary.rendered_widget_usages, 1);
      assert.equal(coverage.screens.find((screen) => screen.id === "greeting_list").widget_usages[0].status, "rendered");
      assert.equal(coverage.design_intent.status, "mapped");
      assert.equal(coverage.design_intent.tokens.density, "compact");
      const styles = readText(path.join(projectRoot, "app", "apps", "web", "app_react", "src", "app.css"));
      assert.match(styles, /--topogram-design-density: compact;/);
      assert.match(styles, /--topogram-design-color-danger: critical;/);
      assert.deepEqual(coverage.diagnostics, []);
    }
    if (item.template === "web-api-db") {
      const serverContract = readText(path.join(projectRoot, "app", "apps", "services", "app_api", "src", "lib", "topogram", "server-contract.ts"));
      assert.match(serverContract, /"capabilityId": "cap_create_greeting"/);
      assert.match(serverContract, /"capabilityId": "cap_list_greetings"/);
      const schema = readText(path.join(projectRoot, "app", "apps", "db", "app_postgres", "prisma", "schema.prisma"));
      assert.match(schema, /provider = "postgresql"/);
      assert.match(schema, /model Greeting/);
      const coverage = readJson(path.join(projectRoot, "app", "apps", "web", "app_sveltekit", "src", "lib", "topogram", "generation-coverage.json"));
      assert.equal(coverage.type, "generation_coverage");
      assert.equal(coverage.generator, "topogram/sveltekit");
      assert.equal(coverage.summary.routed_screens, 3);
      assert.equal(coverage.summary.rendered_screens, 3);
      assert.equal(coverage.design_intent.status, "mapped");
      assert.equal(coverage.design_intent.tokens.action_roles.destructive, "danger");
      const styles = readText(path.join(projectRoot, "app", "apps", "web", "app_sveltekit", "src", "app.css"));
      assert.match(styles, /--topogram-design-action-destructive: danger;/);
      assert.match(styles, /--topogram-design-accessibility-focus: visible;/);
      assert.deepEqual(coverage.diagnostics, []);
    }
  }
});

test("multiple web runtime scripts keep secondary topology ports when WEB_PORT is set", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-multi-web-ports-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", path.join(fixtureTemplatesRoot, "web-api")]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const configPath = path.join(projectRoot, "topogram.project.json");
  const config = readJson(configPath);
  const primaryWeb = config.topology.runtimes.find((runtime) => runtime.id === "app_react");
  config.topology.runtimes.push({
    ...primaryWeb,
    id: "app_react_secondary",
    port: 5174
  });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  const primaryScript = readText(path.join(projectRoot, "app", "apps", "scripts", "web", "app_react-dev.sh"));
  const secondaryScript = readText(path.join(projectRoot, "app", "apps", "scripts", "web", "app_react_secondary-dev.sh"));
  const guardScript = readText(path.join(projectRoot, "app", "apps", "scripts", "guard-ports.mjs"));
  assert.match(primaryScript, /guard-ports\.mjs" web app_react/);
  assert.match(secondaryScript, /guard-ports\.mjs" web app_react_secondary/);
  assert.match(primaryScript, /\$\{APP_REACT_PORT:-\$\{WEB_PORT:-5173\}\}/);
  assert.match(secondaryScript, /\$\{APP_REACT_SECONDARY_PORT:-5174\}/);
  assert.doesNotMatch(secondaryScript, /WEB_PORT:-5174/);
  assert.match(guardScript, /const targetId = process\.argv\[3\] \|\| "";/);
  assert.match(guardScript, /if \(targetId && entry\.id !== targetId\)/);
  assert.match(guardScript, /"id": "app_react"[\s\S]*"fallbackEnv": "WEB_PORT"/);
  assert.match(guardScript, /"id": "app_react_secondary"[\s\S]*"fallbackEnv": null/);
});

test("package-backed generators can be checked and used by app generation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-backed-generator-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", path.join(fixtureTemplatesRoot, "hello-web")]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const { packageName } = writePackageBackedGenerator(projectRoot);
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = readJson(projectConfigPath);
  projectConfig.topology.runtimes[0].generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };
  writeJson(projectConfigPath, projectConfig);
  writeJson(path.join(projectRoot, "topogram.generator-policy.json"), {
    version: "0.1",
    allowedPackageScopes: ["@scope"],
    allowedPackages: [],
    pinnedVersions: {}
  });

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  assert.equal(
    readText(path.join(projectRoot, "app", "apps", "web", "app_web", "index.html")),
    "<!doctype html><h1 data-generator=\"@scope/smoke-web\">Package generator smoke</h1>\n"
  );
  const contract = readJson(path.join(projectRoot, "app", "apps", "web", "app_web", "contract.json"));
  assert.equal(contract.projection, "proj_web_surface");
  assert.equal(contract.screens, 2);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
});

test("package-backed native generators are used by app generation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-backed-native-generator-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", path.join(fixtureTemplatesRoot, "web-api")]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const { packageName } = writePackageBackedNativeGenerator(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, "topo", "projections", "proj-ios-surface.tg"),
    `projection proj_ios_surface {
  name "Starter iOS Surface"
  description "Package-backed native realization for the shared starter UI"

  type ios_surface
  realizes [
    proj_ui_contract,
    cap_list_greetings
  ]
  outputs [ui_contract, native_app]

  screen_routes {
    screen greeting_list path /greetings
  }

  status active
}
`,
    "utf8"
  );
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = readJson(projectConfigPath);
  projectConfig.topology.runtimes.push({
    id: "app_ios",
    projection: "proj_ios_surface",
    generator: {
      id: "@scope/smoke-native",
      version: "1",
      package: packageName
    },
    kind: "ios_surface",
    uses_api: "app_api"
  });
  writeJson(projectConfigPath, projectConfig);
  writeJson(path.join(projectRoot, "topogram.generator-policy.json"), {
    version: "0.1",
    allowedPackageScopes: ["@scope"],
    allowedPackages: [],
    pinnedVersions: {}
  });

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  const nativeRoot = path.join(projectRoot, "app", "apps", "native", "app_ios");
  assert.equal(fs.existsSync(path.join(nativeRoot, "Package.swift")), true);
  const uiContract = readJson(path.join(nativeRoot, "Sources", "SmokeNative", "Resources", "ui-surface-contract.json"));
  const apiContracts = readJson(path.join(nativeRoot, "Sources", "SmokeNative", "Resources", "api-contracts.json"));
  assert.equal(uiContract.projection.id, "proj_ios_surface");
  assert.equal(uiContract.screens.length, 3);
  assert.equal(Object.keys(apiContracts).length > 0, true);
  const compilePlan = readJson(path.join(projectRoot, "app", "compile", "compile-check-plan.json"));
  assert.deepEqual(
    compilePlan.checks.filter((entry) => entry.id === "native_swift_build").map((entry) => entry.cwd),
    ["native/app_ios"]
  );
});

test("package-backed app generation refuses packages blocked by generator policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-package-backed-generator-denied-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", path.join(fixtureTemplatesRoot, "hello-web")]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const { packageName, packageRoot } = writePackageBackedGenerator(projectRoot);
  const markerPath = path.join(root, "adapter-import-side-effect.txt");
  fs.writeFileSync(
    path.join(packageRoot, "index.cjs"),
    `require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "loaded\\n", "utf8");
exports.manifest = require("./topogram-generator.json");
exports.generate = () => ({ files: { "index.html": "<h1>loaded</h1>\\n" }, diagnostics: [] });
`,
    "utf8"
  );
  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = readJson(projectConfigPath);
  projectConfig.topology.runtimes[0].generator = {
    id: "@scope/smoke-web",
    version: "1",
    package: packageName
  };
  writeJson(projectConfigPath, projectConfig);

  const generate = runCli(["generate"], { cwd: projectRoot });

  assert.notEqual(generate.status, 0, generate.stdout);
  assert.match(generate.stderr, /not allowed by topogram\.generator-policy\.json/);
  assert.match(generate.stderr, /topogram generator policy pin @scope\/topogram-generator-smoke-web@1/);
  assert.equal(fs.existsSync(markerPath), false, "denied package adapter must not be imported");
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), false);
});

test("topogram new creates an executable web-api-db starter project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-new-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created Topogram project/);
  assert.match(create.stdout, /npm run doctor/);
  assert.match(create.stdout, /npm run source:status/);
  assert.match(create.stdout, /npm run template:explain/);
  assert.match(create.stdout, /npm run check/);
  assert.match(create.stdout, /npm run generate/);

  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts.explain, "node ./scripts/explain.mjs");
  assert.equal(pkg.scripts.doctor, "topogram doctor");
  assert.equal(pkg.scripts["agent:brief"], "topogram agent brief --json");
  assert.equal(pkg.scripts["source:status"], "topogram source status --local");
  assert.equal(pkg.scripts["source:status:remote"], "topogram source status --remote");
  assert.equal(pkg.scripts.check, "topogram check");
  assert.equal(pkg.scripts["check:json"], "topogram check --json");
  assert.equal(pkg.scripts.generate, "topogram generate");
  assert.equal(pkg.scripts.status, undefined);
  assert.equal(pkg.scripts.inspect, undefined);
  assert.equal(pkg.scripts.build, undefined);
  assert.equal(pkg.devDependencies["@topogram/cli"].startsWith("file:"), true);
  assert.equal(pkg.devDependencies.topogram, undefined);
  assert.equal(fs.existsSync(path.join(projectRoot, ".npmrc")), false);
  assert.equal(pkg.scripts["template:status"], "topogram template status");
  assert.equal(pkg.scripts["template:explain"], "topogram template explain");
  assert.equal(pkg.scripts["template:detach"], "topogram template detach");
  assert.equal(pkg.scripts["template:detach:dry-run"], "topogram template detach --dry-run");
  assert.equal(pkg.scripts["template:check"], undefined);
  assert.equal(pkg.scripts["template:policy:check"], "topogram template policy check");
  assert.equal(pkg.scripts["template:policy:explain"], "topogram template policy explain");
  assert.equal(pkg.scripts["generator:policy:status"], "topogram generator policy status");
  assert.equal(pkg.scripts["generator:policy:check"], "topogram generator policy check");
  assert.equal(pkg.scripts["generator:policy:explain"], "topogram generator policy explain");
  assert.equal(pkg.scripts["template:update:status"], "topogram template update --status");
  assert.equal(pkg.scripts["template:update:recommend"], "topogram template update --recommend");
  assert.equal(pkg.scripts["template:update:plan"], "topogram template update --plan");
  assert.equal(pkg.scripts["template:update:check"], "topogram template update --check");
  assert.equal(pkg.scripts["template:update:apply"], "topogram template update --apply");
  assert.equal(pkg.scripts["trust:status"], "topogram trust status");
  assert.equal(pkg.scripts["trust:diff"], "topogram trust diff");
  assert.equal(pkg.scripts["app:compile"], "npm --prefix ./app run compile");
  assert.equal(pkg.scripts["app:smoke"], "npm --prefix ./app run smoke");
  assert.equal(pkg.scripts["app:runtime-check"], "npm --prefix ./app run runtime-check");
  assert.equal(pkg.scripts["app:check"], "npm run app:compile");
  assert.equal(pkg.scripts["app:probe"], "npm run app:smoke && npm run app:runtime-check");
  assert.equal(pkg.scripts["app:runtime"], "npm --prefix ./app run runtime");

  const doctor = runCli(["doctor", "--json"], { cwd: projectRoot });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  const doctorPayload = JSON.parse(doctor.stdout);
  assert.equal(doctorPayload.packageRegistry.required, false);
  assert.equal(doctorPayload.packageRegistry.packageAccess.ok, true);
  assert.equal(doctorPayload.catalog.ok, true);

  assert.match(create.stderr, /copied implementation\/ code/);
  assert.match(create.stdout, /Executable implementation: yes/);
  assert.match(create.stdout, /Policy: topogram\.template-policy\.json/);
  assert.match(create.stdout, /Trust: \.topogram-template-trust\.json/);
  assert.match(create.stdout, /npm run source:status/);
  assert.match(create.stdout, /npm run template:policy:explain/);
  assert.match(create.stdout, /npm run trust:status/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topo", "entities", "entity-greeting.tg")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topo", "entities", "entity-task.tg")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-files.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.template-policy.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.generator-policy.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "AGENTS.md")), true);
  const agentsGuide = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
  assert.match(agentsGuide, /npm run agent:brief/);
  assert.match(agentsGuide, /topogram query/);
  assert.match(agentsGuide, /topogram import check \. --json/);
  assert.match(agentsGuide, /workspaceRoot/);
  assert.match(agentsGuide, /Do not make lasting edits under generated-owned `app\/\*\*`/);
  assert.doesNotMatch(agentsGuide, /edit generated `app\/\*\*`/i);
  const generatorPolicy = readJson(path.join(projectRoot, "topogram.generator-policy.json"));
  assert.deepEqual(generatorPolicy.allowedPackageScopes, ["@topogram"]);
  assert.deepEqual(generatorPolicy.allowedPackages, []);
  assert.deepEqual(generatorPolicy.pinnedVersions, {});
  assert.equal(fs.existsSync(path.join(projectRoot, "scripts", "explain.mjs")), true);
  const templateExplain = runCli(["template", "explain", "--json"], { cwd: projectRoot });
  assert.equal(templateExplain.status, 0, templateExplain.stderr || templateExplain.stdout);
  const templateExplainPayload = JSON.parse(templateExplain.stdout);
  assert.equal(templateExplainPayload.attached, true);
  assert.equal(templateExplainPayload.ownership, "template-attached");
  assert.equal(templateExplainPayload.template.id, "topogram/web-api-db");
  assert.equal(templateExplainPayload.baseline.state, "matches-template");
  assert.equal(templateExplainPayload.commands.detachDryRun, "topogram template detach --dry-run");
  assert.equal(templateExplainPayload.commands.detach, "topogram template detach");
  const humanTemplateExplain = runCli(["template", "explain"], { cwd: projectRoot });
  assert.equal(humanTemplateExplain.status, 0, humanTemplateExplain.stderr || humanTemplateExplain.stdout);
  assert.match(humanTemplateExplain.stdout, /Template lifecycle: attached/);
  assert.match(humanTemplateExplain.stdout, /Ownership: template-attached/);
  assert.match(humanTemplateExplain.stdout, /topogram template detach --dry-run/);
  const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
  assert.match(readme, /Template: `topogram\/web-api-db@/);
  assert.match(readme, /Executable implementation: `yes`/);
  assert.match(readme, /npm run doctor/);
  assert.match(readme, /npm run agent:brief/);
  assert.match(readme, /npm run source:status/);
  assert.match(readme, /npm run template:explain/);
  assert.match(readme, /npm run generator:policy:status/);
  assert.match(readme, /npm run template:policy:explain/);
  assert.match(readme, /npm run trust:status/);
  const explainScript = fs.readFileSync(path.join(projectRoot, "scripts", "explain.mjs"), "utf8");
  assert.match(explainScript, /npm run agent:brief/);
  assert.match(explainScript, /npm run doctor/);
  assert.match(explainScript, /npm run source:status/);
  assert.match(explainScript, /npm run source:status:remote/);
  assert.match(explainScript, /npm run template:explain/);
  assert.match(explainScript, /npm run template:detach:dry-run/);
  assert.match(explainScript, /npm run generator:policy:status/);
  assert.match(explainScript, /npm run template:policy:explain/);
  const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "topogram.project.json"), "utf8"));
  assert.equal(projectConfig.template.id, "topogram/web-api-db");
  assert.equal(projectConfig.template.requested, builtInTemplateRoot);
  assert.equal(projectConfig.template.source, "local");
  assert.equal(projectConfig.template.sourceSpec, builtInTemplateRoot);
  assert.equal(projectConfig.template.sourceRoot, builtInTemplateRoot);
  assert.equal(projectConfig.template.includesExecutableImplementation, true);
  const policy = JSON.parse(fs.readFileSync(path.join(projectRoot, "topogram.template-policy.json"), "utf8"));
  assert.deepEqual(policy.allowedTemplateIds, ["topogram/web-api-db"]);
  assert.equal(policy.executableImplementation, "allow");
  const trustRecord = JSON.parse(fs.readFileSync(path.join(projectRoot, ".topogram-template-trust.json"), "utf8"));
  assert.equal(trustRecord.trustPolicy, "topogram-template-executable-implementation-v1");
  assert.equal(trustRecord.template.id, "topogram/web-api-db");
  assert.equal(trustRecord.template.version, projectConfig.template.version);
  assert.equal(trustRecord.template.requested, builtInTemplateRoot);
  assert.equal(trustRecord.template.sourceSpec, builtInTemplateRoot);
  assert.equal(trustRecord.template.sourceRoot, builtInTemplateRoot);
  assert.equal(trustRecord.implementation.module, "./implementation/index.js");
  assert.equal(trustRecord.content.algorithm, "sha256");
  assert.match(trustRecord.content.digest, /^[a-f0-9]{64}$/);
  assert.ok(trustRecord.content.files.some((file) => file.path === "index.js"));
  const fileManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, ".topogram-template-files.json"), "utf8"));
  assert.equal(fileManifest.template.id, "topogram/web-api-db");
  assert.equal(fileManifest.template.version, projectConfig.template.version);
  assert.ok(fileManifest.files.some((file) => file.path === "topogram.project.json"));
  assert.ok(fileManifest.files.some((file) => file.path === "topo/entities/entity-greeting.tg"));

  fs.appendFileSync(path.join(projectRoot, "topo", "entities", "entity-greeting.tg"), "\n# Local maintained-app note.\n", "utf8");
  const sourceStatus = runCli(["source", "status", "--json"], { cwd: projectRoot });
  assert.equal(sourceStatus.status, 0, sourceStatus.stderr || sourceStatus.stdout);
  const sourcePayload = JSON.parse(sourceStatus.stdout);
  assert.equal(sourcePayload.project.templateOwnedBaseline, undefined);
  assert.equal(sourcePayload.project.templateBaseline.status, "changed");
  assert.equal(sourcePayload.project.templateBaseline.state, "diverged");
  assert.equal(sourcePayload.project.templateBaseline.meaning, "local-project-owns-changes");
  assert.equal(sourcePayload.project.templateBaseline.localOwnership, true);
  assert.equal(sourcePayload.project.templateBaseline.changedAllowed, true);
  assert.equal(sourcePayload.project.templateBaseline.blocksCheck, false);
  assert.equal(sourcePayload.project.templateBaseline.blocksGenerate, false);
  assert.equal(sourcePayload.project.templateBaseline.nextCommand, "topogram template update --check");
  assert.deepEqual(sourcePayload.project.templateBaseline.content.changed, ["topo/entities/entity-greeting.tg"]);
  const humanSourceStatus = runCli(["source", "status"], { cwd: projectRoot });
  assert.equal(humanSourceStatus.status, 0, humanSourceStatus.stderr || humanSourceStatus.stdout);
  assert.match(humanSourceStatus.stdout, /Template baseline: diverged/);
  assert.match(humanSourceStatus.stdout, /Template baseline meaning: local-project-owns-changes/);
  assert.match(humanSourceStatus.stdout, /does not block check\/generate/);
  assert.match(humanSourceStatus.stdout, /local template-derived changes are owned by this project/);

  const templateStatus = runCli(["template", "status", "--json"], { cwd: projectRoot });
  assert.equal(templateStatus.status, 0, templateStatus.stderr || templateStatus.stdout);
  const templateStatusPayload = JSON.parse(templateStatus.stdout);
  assert.equal(templateStatusPayload.ok, true);
  assert.equal(templateStatusPayload.template.id, "topogram/web-api-db");
  assert.equal(templateStatusPayload.template.requested, builtInTemplateRoot);
  assert.equal(templateStatusPayload.template.source, "local");
  assert.equal(templateStatusPayload.latest.checked, false);
  assert.equal(templateStatusPayload.trust.ok, true);

  const localLatest = runCli(["template", "status", "--latest", "--json"], { cwd: projectRoot });
  assert.equal(localLatest.status, 0, localLatest.stderr || localLatest.stdout);
  const localLatestPayload = JSON.parse(localLatest.stdout);
  assert.equal(localLatestPayload.latest.checked, true);
  assert.equal(localLatestPayload.latest.supported, false);
  assert.match(localLatestPayload.latest.reason, /package-backed/);

  const humanTemplateStatus = runCli(["template", "status"], { cwd: projectRoot });
  assert.equal(humanTemplateStatus.status, 0, humanTemplateStatus.stderr || humanTemplateStatus.stdout);
  assert.match(humanTemplateStatus.stdout, /Template status: attached; implementation trust: trusted/);
  assert.match(humanTemplateStatus.stdout, /Latest version: not checked/);

  const install = runNpm(["install"], projectRoot);
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const explain = runNpm(["run", "explain"], projectRoot);
  assert.equal(explain.status, 0, explain.stderr || explain.stdout);
  assert.match(explain.stdout, /Topogram app workflow/);
  assert.match(explain.stdout, /npm run check/);
  assert.match(explain.stdout, /npm run agent:brief/);
  assert.match(explain.stdout, /npm run generate/);
  assert.match(explain.stdout, /npm run verify/);
  assert.match(explain.stdout, /npm run app:probe/);
  assert.match(explain.stdout, /npm run app:runtime/);

  const agentBrief = runNpm(["run", "agent:brief"], projectRoot);
  assert.equal(agentBrief.status, 0, agentBrief.stderr || agentBrief.stdout);
  const agentBriefPayload = JSON.parse(agentBrief.stdout.slice(agentBrief.stdout.indexOf("{")));
  assert.equal(agentBriefPayload.type, "agent_brief");
  assert.equal(agentBriefPayload.template.id, "topogram/web-api-db");
  assert.equal(agentBriefPayload.trust.requiresTrust, true);

  const check = runNpm(["run", "check"], projectRoot);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Topogram check passed/);

  const generate = runNpm(["run", "generate"], projectRoot);
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "services", "app_api")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "web", "app_sveltekit")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", "apps", "db", "app_postgres")), true);
});

test("topogram template detach removes template tracking without bypassing implementation trust", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-detach-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const dryRun = runCli(["template", "detach", "--dry-run", "--json"], { cwd: projectRoot });
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  const dryRunPayload = JSON.parse(dryRun.stdout);
  assert.equal(dryRunPayload.detached, true);
  assert.equal(dryRunPayload.dryRun, true);
  assert.equal(dryRunPayload.removedTemplate.id, "topogram/web-api-db");
  assert.equal(dryRunPayload.implementationTrust.retained, true);
  assert.equal(dryRunPayload.plannedRemovals.some((filePath) => filePath.endsWith(".topogram-template-files.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-files.json")), true);

  const detach = runCli(["template", "detach", "--json"], { cwd: projectRoot });
  assert.equal(detach.status, 0, detach.stderr || detach.stdout);
  const detachPayload = JSON.parse(detach.stdout);
  assert.equal(detachPayload.detached, true);
  assert.equal(detachPayload.implementationTrust.retained, true);
  assert.equal(detachPayload.removedFiles.some((filePath) => filePath.endsWith(".topogram-template-files.json")), true);
  assert.equal(detachPayload.preservedFiles.some((filePath) => filePath.endsWith(".topogram-template-trust.json")), true);

  const projectConfig = readJson(path.join(projectRoot, "topogram.project.json"));
  assert.equal(projectConfig.template, undefined);
  assert.equal(projectConfig.implementation.module, "./implementation/index.js");
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-files.json")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.template-policy.json")), true);

  const sourceStatus = runCli(["source", "status", "--json"], { cwd: projectRoot });
  assert.equal(sourceStatus.status, 0, sourceStatus.stderr || sourceStatus.stdout);
  const sourcePayload = JSON.parse(sourceStatus.stdout);
  assert.equal(sourcePayload.project.template, null);
  assert.equal(sourcePayload.project.templateOwnedBaseline, undefined);
  assert.equal(sourcePayload.project.templateBaseline.status, "missing");
  assert.equal(sourcePayload.project.templateBaseline.meaning, "no-template-baseline");
  assert.equal(sourcePayload.project.trust.status, "trusted");

  const humanSourceStatus = runCli(["source", "status"], { cwd: projectRoot });
  assert.equal(humanSourceStatus.status, 0, humanSourceStatus.stderr || humanSourceStatus.stdout);
  assert.match(humanSourceStatus.stdout, /Template attachment: detached/);
  assert.match(humanSourceStatus.stdout, /Template ownership: project-owned/);
  assert.match(humanSourceStatus.stdout, /Template baseline: missing/);
  assert.match(humanSourceStatus.stdout, /Implementation trust: trusted/);

  const detachedExplain = runCli(["template", "explain", "--json"], { cwd: projectRoot });
  assert.equal(detachedExplain.status, 0, detachedExplain.stderr || detachedExplain.stdout);
  const detachedExplainPayload = JSON.parse(detachedExplain.stdout);
  assert.equal(detachedExplainPayload.attached, false);
  assert.equal(detachedExplainPayload.ownership, "project-owned");
  assert.equal(detachedExplainPayload.template.id, null);
  assert.equal(detachedExplainPayload.commands.detach, null);
  assert.equal(detachedExplainPayload.trust.ok, true);

  const detachedHumanExplain = runCli(["template", "explain"], { cwd: projectRoot });
  assert.equal(detachedHumanExplain.status, 0, detachedHumanExplain.stderr || detachedHumanExplain.stdout);
  assert.match(detachedHumanExplain.stdout, /Template lifecycle: detached/);
  assert.match(detachedHumanExplain.stdout, /Ownership: project-owned/);
  assert.doesNotMatch(detachedHumanExplain.stdout, /topogram template detach --dry-run/);

  const templateStatus = runCli(["template", "status"], { cwd: projectRoot });
  assert.equal(templateStatus.status, 0, templateStatus.stderr || templateStatus.stdout);
  assert.match(templateStatus.stdout, /Template status: detached/);

  const update = runCli(["template", "update", "--status"], { cwd: projectRoot });
  assert.notEqual(update.status, 0, update.stdout);
  assert.match(update.stderr, /detached from template metadata/);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);

  const noImplementationRoot = path.join(root, "hello");
  const hello = runCli(["new", noImplementationRoot, "--template", path.join(engineRoot, "tests", "fixtures", "templates", "hello-web")]);
  assert.equal(hello.status, 0, hello.stderr || hello.stdout);
  const detachPolicy = runCli(["template", "detach", "--remove-policy", "--json"], { cwd: noImplementationRoot });
  assert.equal(detachPolicy.status, 0, detachPolicy.stderr || detachPolicy.stdout);
  const detachPolicyPayload = JSON.parse(detachPolicy.stdout);
  assert.equal(detachPolicyPayload.plannedRemovals.some((filePath) => filePath.endsWith("topogram.template-policy.json")), true);
  assert.equal(fs.existsSync(path.join(noImplementationRoot, "topogram.template-policy.json")), false);
  assert.equal(fs.existsSync(path.join(noImplementationRoot, ".topogram-template-files.json")), false);
});

test("topogram generate requires local executable implementation trust", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const trustPath = path.join(projectRoot, ".topogram-template-trust.json");
  fs.rmSync(trustPath);
  const check = runCli(["check"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  assert.match(check.stderr, /without \.topogram-template-trust\.json/);

  const refused = runCli(["generate"], { cwd: projectRoot });
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.match(refused.stderr, /without \.topogram-template-trust\.json/);
  assert.match(refused.stderr, /topogram trust template/);

  const trust = runCli(["trust", "template"], { cwd: projectRoot });
  assert.equal(trust.status, 0, trust.stderr || trust.stdout);
  assert.match(trust.stdout, /Wrote \.topogram-template-files\.json/);
  assert.match(trust.stdout, /Wrote \.topogram-template-trust\.json/);
  assert.equal(fs.existsSync(trustPath), true);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
});

test("topogram trust template refuses template source repos without force", () => {
  const trust = runCli(["trust", "template", builtInTemplateRoot]);
  assert.notEqual(trust.status, 0, trust.stdout);
  assert.match(trust.stderr, /Cannot write consumer template trust metadata in a template source repo/);
  assert.equal(fs.existsSync(path.join(builtInTemplateRoot, ".topogram-template-files.json")), false);
  assert.equal(fs.existsSync(path.join(builtInTemplateRoot, ".topogram-template-trust.json")), false);
});

test("topogram generate rejects stale template trust metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-stale-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const trustPath = path.join(projectRoot, ".topogram-template-trust.json");
  const trustRecord = JSON.parse(fs.readFileSync(trustPath, "utf8"));
  trustRecord.template.version = "0.0.0-stale";
  fs.writeFileSync(trustPath, `${JSON.stringify(trustRecord, null, 2)}\n`, "utf8");

  const refused = runCli(["generate"], { cwd: projectRoot });
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.match(refused.stderr, /trusts template version '0\.0\.0-stale'/);
  assert.match(refused.stderr, /topogram\.project\.json declares/);
});

test("topogram new rejects template implementation symlinks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-symlink-"));
  const templateRoot = copyBuiltInTemplate(root, "template");
  const outsideFile = path.join(root, "outside-implementation.js");
  fs.writeFileSync(outsideFile, "export default {};\n", "utf8");
  fs.rmSync(path.join(templateRoot, "implementation", "index.js"));
  fs.symlinkSync(outsideFile, path.join(templateRoot, "implementation", "index.js"));

  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", templateRoot]);
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /unsupported symlink 'implementation\/index\.js'/);
  assert.match(create.stderr, /Template packs must copy real files/);
  assert.match(create.stderr, /Replace the symlink with a real file or directory/);
  assert.match(create.stderr, /topogram template check/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), false);
});

test("topogram trust rejects template implementation modules outside implementation root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-outside-implementation-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = readJson(projectConfigPath);
  projectConfig.implementation.module = "./other/index.js";
  writeJson(projectConfigPath, projectConfig);
  fs.mkdirSync(path.join(projectRoot, "other"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "other", "index.js"), "export default {};\n", "utf8");

  const status = runCli(["trust", "status", "--json"], { cwd: projectRoot });
  assert.notEqual(status.status, 0, status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, false);
  assert.equal(statusPayload.requiresTrust, true);
  assert.match(statusPayload.issues.join("\n"), /must be under implementation\/ for template-attached projects/);
  assert.match(statusPayload.issues.join("\n"), /Keep executable template code inside implementation\//);
  assert.match(statusPayload.issues.join("\n"), /topogram trust diff/);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  assert.match(check.stderr, /must be under implementation\/ for template-attached projects/);
  assert.match(check.stderr, /move the module back under implementation\//i);
  assert.match(check.stderr, /topogram trust status/);

  const trust = runCli(["trust", "template"], { cwd: projectRoot });
  assert.notEqual(trust.status, 0, trust.stdout);
  assert.match(trust.stderr, /must be under implementation\//);
  assert.match(trust.stderr, /Move the module back under implementation\//);
});

test("topogram trust rejects implementation symlinks added after project creation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-local-symlink-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const outsideFile = path.join(root, "outside-implementation.js");
  fs.writeFileSync(outsideFile, "export default {};\n", "utf8");
  fs.rmSync(path.join(projectRoot, "implementation", "index.js"));
  fs.symlinkSync(outsideFile, path.join(projectRoot, "implementation", "index.js"));

  const status = runCli(["trust", "status"], { cwd: projectRoot });
  assert.notEqual(status.status, 0, status.stdout);
  assert.match(status.stdout, /Implementation trust status: review required/);
  assert.match(status.stdout, /Template implementation contains unsupported symlink 'index\.js'/);
  assert.match(status.stdout, /Replace symlinks with real files under implementation\//);

  const diff = runCli(["trust", "diff"], { cwd: projectRoot });
  assert.notEqual(diff.status, 0, diff.stdout);
  assert.match(diff.stdout, /Template trust diff: no file-level diff available/);
  assert.match(diff.stdout, /Template implementation contains unsupported symlink 'index\.js'/);
  assert.match(diff.stdout, /topogram trust template/);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  assert.match(check.stderr, /Template implementation contains unsupported symlink 'index\.js'/);
  assert.match(check.stderr, /Replace symlinks with real files under implementation\//);
});

test("topogram trust status reports implementation content drift and trust refresh adopts edits", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-content-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  fs.appendFileSync(path.join(projectRoot, "implementation", "index.js"), "\n// reviewed local edit\n", "utf8");
  fs.writeFileSync(path.join(projectRoot, "implementation", "local-note.js"), "export const localNote = true;\n", "utf8");
  fs.rmSync(path.join(projectRoot, "implementation", "README.md"));

  const status = runCli(["trust", "status", "--json"], { cwd: projectRoot });
  assert.notEqual(status.status, 0, status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, false);
  assert.equal(statusPayload.requiresTrust, true);
  assert.match(statusPayload.issues.join("\n"), /implementation content changed/);
  assert.deepEqual(statusPayload.content.changed, ["index.js"]);
  assert.deepEqual(statusPayload.content.added, ["local-note.js"]);
  assert.deepEqual(statusPayload.content.removed, ["README.md"]);

  const humanStatus = runCli(["trust", "status"], { cwd: projectRoot });
  assert.notEqual(humanStatus.status, 0, humanStatus.stdout);
  assert.match(humanStatus.stdout, /Implementation trust status: review required/);
  assert.match(humanStatus.stdout, /topogram trust diff/);

  const templateStatus = runCli(["template", "status", "--json"], { cwd: projectRoot });
  assert.notEqual(templateStatus.status, 0, templateStatus.stdout);
  const templateStatusPayload = JSON.parse(templateStatus.stdout);
  assert.equal(templateStatusPayload.ok, false);
  assert.equal(templateStatusPayload.template.id, "topogram/web-api-db");
  assert.equal(templateStatusPayload.trust.ok, false);
  assert.match(templateStatusPayload.recommendations.join("\n"), /topogram trust diff/);

  const humanTemplateStatus = runCli(["template", "status"], { cwd: projectRoot });
  assert.notEqual(humanTemplateStatus.status, 0, humanTemplateStatus.stdout);
  assert.match(humanTemplateStatus.stdout, /Template status: attached; implementation trust: review required/);
  assert.match(humanTemplateStatus.stdout, /Changed: index\.js/);
  assert.match(humanTemplateStatus.stdout, /topogram trust diff/);

  const diff = runCli(["trust", "diff", "--json"], { cwd: projectRoot });
  assert.notEqual(diff.status, 0, diff.stdout);
  const diffPayload = JSON.parse(diff.stdout);
  assert.equal(diffPayload.ok, false);
  assert.deepEqual(
    diffPayload.files.map((file) => `${file.kind}:${file.path}`),
    ["changed:index.js", "added:local-note.js", "removed:README.md"]
  );
  const addedFile = diffPayload.files.find((file) => file.path === "local-note.js");
  assert.match(addedFile.unifiedDiff, /\+export const localNote = true;/);
  const changedFile = diffPayload.files.find((file) => file.path === "index.js");
  assert.equal(changedFile.unifiedDiff, null);
  assert.equal(changedFile.diffOmitted, true);

  const humanDiff = runCli(["trust", "diff"], { cwd: projectRoot });
  assert.notEqual(humanDiff.status, 0, humanDiff.stdout);
  assert.match(humanDiff.stdout, /CHANGED: implementation\/index\.js/);
  assert.match(humanDiff.stdout, /ADDED: implementation\/local-note\.js/);
  assert.match(humanDiff.stdout, /\+export const localNote = true;/);
  assert.match(humanDiff.stdout, /REMOVED: implementation\/README\.md/);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  assert.match(check.stderr, /implementation content changed since it was last trusted/);

  const trust = runCli(["trust", "template"], { cwd: projectRoot });
  assert.equal(trust.status, 0, trust.stderr || trust.stdout);
  assert.match(trust.stdout, /Wrote \.topogram-template-files\.json/);
  assert.match(trust.stdout, /Trusted implementation digest/);

  const cleanStatus = runCli(["trust", "status", "--json"], { cwd: projectRoot });
  assert.equal(cleanStatus.status, 0, cleanStatus.stderr || cleanStatus.stdout);
  const cleanPayload = JSON.parse(cleanStatus.stdout);
  assert.equal(cleanPayload.ok, true);
  assert.deepEqual(cleanPayload.content.changed, []);
  assert.deepEqual(cleanPayload.content.added, []);
  assert.deepEqual(cleanPayload.content.removed, []);
});

test("topogram template policy init and check manage project policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.rmSync(path.join(projectRoot, "topogram.template-policy.json"));

  const missing = runCli(["template", "policy", "check", "--json"], { cwd: projectRoot });
  assert.equal(missing.status, 0, missing.stderr || missing.stdout);
  const missingPayload = JSON.parse(missing.stdout);
  assert.equal(missingPayload.exists, false);
  assert.equal(missingPayload.diagnostics.some((diagnostic) => diagnostic.code === "template_policy_missing"), true);

  const init = runCli(["template", "policy", "init", "--json"], { cwd: projectRoot });
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const initPayload = JSON.parse(init.stdout);
  assert.equal(initPayload.policy.allowedTemplateIds.includes("topogram/web-api-db"), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.template-policy.json")), true);

  const check = runCli(["template", "policy", "check", "--json"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.ok, true);
  assert.deepEqual(checkPayload.diagnostics, []);

  const explain = runCli(["template", "policy", "explain", "--json"], { cwd: projectRoot });
  assert.equal(explain.status, 0, explain.stderr || explain.stdout);
  const explainPayload = JSON.parse(explain.stdout);
  assert.equal(explainPayload.ok, true);
  assert.equal(explainPayload.template.id, "topogram/web-api-db");
  assert.equal(explainPayload.rules.some((rule) => rule.name === "allowed-template-id" && rule.ok), true);

  const humanExplain = runCli(["template", "policy", "explain"], { cwd: projectRoot });
  assert.equal(humanExplain.status, 0, humanExplain.stderr || humanExplain.stdout);
  assert.match(humanExplain.stdout, /Template policy: allowed/);
  assert.match(humanExplain.stdout, /Decision: the current template is allowed by this project's template policy\./);
  assert.match(humanExplain.stdout, /Policy checks:/);
  assert.match(humanExplain.stdout, /PASS Allowed template id/);
});

test("topogram template policy pin records a reviewed template version", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-pin-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.rmSync(path.join(projectRoot, "topogram.template-policy.json"));

  const pinCurrent = runCli(["template", "policy", "pin", "--json"], { cwd: projectRoot });
  assert.equal(pinCurrent.status, 0, pinCurrent.stderr || pinCurrent.stdout);
  const currentPayload = JSON.parse(pinCurrent.stdout);
  assert.equal(currentPayload.pinned.id, "topogram/web-api-db");
  assert.equal(currentPayload.policy.pinnedVersions["topogram/web-api-db"], currentPayload.pinned.version);

  const pinExplicit = runCli(["template", "policy", "pin", "@scope/next-template@2.0.0", "--json"], { cwd: projectRoot });
  assert.equal(pinExplicit.status, 0, pinExplicit.stderr || pinExplicit.stdout);
  const explicitPayload = JSON.parse(pinExplicit.stdout);
  assert.equal(explicitPayload.policy.pinnedVersions["@scope/next-template"], "2.0.0");
  assert.equal(explicitPayload.policy.allowedTemplateIds.includes("@scope/next-template"), true);
  assert.equal(explicitPayload.policy.allowedPackageScopes.includes("@scope"), true);
});

test("topogram new supports local path template packs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-local-template-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: topogram\/web-api-db/);
  assert.match(create.stderr, /topogram generate may load it later/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), true);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("topogram new carries template generator package dependencies into starters", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-generator-deps-"));
  const templateRoot = copyBuiltInTemplate(root, "template");
  writePackageJson(templateRoot, {
    name: "@scope/topogram-starter-generator-deps",
    version: "0.1.0",
    devDependencies: {
      "@scope/topogram-generator-web": "^0.1.0",
      "@scope/not-a-generator": "^1.0.0"
    },
    topogramGeneratorDependencies: {
      "@scope/topogram-generator-api": "~0.2.0"
    }
  });
  const projectRoot = path.join(root, "starter");

  const create = runCli(["new", projectRoot, "--template", templateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const pkg = readJson(path.join(projectRoot, "package.json"));

  assert.equal(pkg.devDependencies["@scope/topogram-generator-web"], "^0.1.0");
  assert.equal(pkg.devDependencies["@scope/topogram-generator-api"], "~0.2.0");
  assert.equal(pkg.devDependencies["@scope/not-a-generator"], undefined);
});

test("topogram new carries template starter scripts into starters", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-starter-scripts-"));
  const templateRoot = copyBuiltInTemplate(root, "template");
  const manifestPath = path.join(templateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.starterScripts = {
    "widget:behavior:query": "topogram query widget-behavior ./topo --projection proj_web_surface --json"
  };
  writeJson(manifestPath, manifest);
  const projectRoot = path.join(root, "starter");

  const create = runCli(["new", projectRoot, "--template", templateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const pkg = readJson(path.join(projectRoot, "package.json"));

  assert.equal(pkg.scripts["query:list"], "topogram query list --json");
  assert.equal(pkg.scripts["query:show"], "topogram query show");
  assert.equal(
    pkg.scripts["widget:behavior:query"],
    "topogram query widget-behavior ./topo --projection proj_web_surface --json"
  );
});

test("package-backed templates can inspect and recommend latest versions explicitly", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-latest-"));
  const initialTemplateRoot = copyBuiltInTemplate(root, "template-initial");
  const latestTemplateRoot = copyBuiltInTemplate(root, "template-latest");
  const projectRoot = path.join(root, "starter");
  for (const [templateRoot, version] of [[initialTemplateRoot, "0.1.0"], [latestTemplateRoot, "0.2.0"]]) {
    const manifestPath = path.join(templateRoot, "topogram-template.json");
    const manifest = readJson(manifestPath);
    manifest.id = "@scope/topogram-template-latest";
    manifest.version = version;
    writeJson(manifestPath, manifest);
  }
  fs.appendFileSync(
    path.join(latestTemplateRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# latest package edit\n",
    "utf8"
  );
  const fakeNpmBin = createFakeNpm(root);
  const env = {
    FAKE_TEMPLATE_INITIAL: initialTemplateRoot,
    FAKE_TEMPLATE_LATEST: latestTemplateRoot,
    FAKE_NPM_LATEST_VERSION: "0.2.0",
    PATH: `${fakeNpmBin}${path.delimiter}${process.env.PATH || ""}`
  };

  const create = runCli(["new", projectRoot, "--template", "@scope/topogram-template-latest@0.1.0"], { env });
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const status = runCli(["template", "status", "--latest", "--json"], { cwd: projectRoot, env });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.latest.checked, true);
  assert.equal(statusPayload.latest.supported, true);
  assert.equal(statusPayload.latest.version, "0.2.0");
  assert.equal(statusPayload.latest.candidateSpec, "@scope/topogram-template-latest@0.2.0");
  assert.equal(statusPayload.latest.isCurrent, false);

  const recommend = runCli(["template", "update", "--recommend", "--latest", "--json"], { cwd: projectRoot, env });
  assert.equal(recommend.status, 0, recommend.stderr || recommend.stdout);
  const recommendPayload = JSON.parse(recommend.stdout);
  assert.equal(recommendPayload.mode, "recommend");
  assert.equal(recommendPayload.candidate.version, "0.2.0");
  assert.equal(recommendPayload.recommendations.some((item) => item.command === "topogram template update --apply"), true);
});

test("topogram template update emits a non-writing update plan", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-plan-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = "0.2.0";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# candidate template edit\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-note.tg"),
    `entity entity_note {
  name "Note"
  description "A note added by a template update"
  fields {
    id uuid required
  }
  status active
}
`,
    "utf8"
  );

  const plan = runCli(["template", "update", "--plan", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const payload = JSON.parse(plan.stdout);
  assert.equal(payload.writes, false);
  assert.deepEqual(payload.diagnostics, []);
  assert.equal(payload.current.id, "topogram/web-api-db");
  assert.equal(payload.candidate.id, "topogram/web-api-db");
  assert.equal(payload.candidate.version, "0.2.0");
  assert.equal(payload.summary.added, 1);
  assert.ok(payload.summary.changed >= 2);
  assert.ok(payload.files.some((file) => file.kind === "changed" && file.path === "topo/entities/entity-greeting.tg"));
  assert.ok(payload.files.some((file) => file.kind === "added" && file.path === "topo/entities/entity-note.tg"));
  assert.match(
    payload.files.find((file) => file.path === "topo/entities/entity-greeting.tg").unifiedDiff,
    /\+# candidate template edit/
  );
  assert.equal(fs.existsSync(path.join(projectRoot, "topo", "entities", "entity-note.tg")), false);

  const humanPlan = runCli(["template", "update", "--plan", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.equal(humanPlan.status, 0, humanPlan.stderr || humanPlan.stdout);
  assert.match(humanPlan.stdout, /Template update plan: ready for review/);
  assert.match(humanPlan.stdout, /Writes: none/);
  assert.match(humanPlan.stdout, /ADDED: topo\/entities\/entity-note\.tg/);
});

test("topogram template update check reports clean and pending updates without writing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-check-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const cleanCheck = runCli(["template", "update", "--check", "--json"], { cwd: projectRoot });
  assert.equal(cleanCheck.status, 0, cleanCheck.stderr || cleanCheck.stdout);
  const cleanPayload = JSON.parse(cleanCheck.stdout);
  assert.equal(cleanPayload.mode, "check");
  assert.equal(cleanPayload.ok, true);
  assert.equal(cleanPayload.writes, false);
  assert.deepEqual(cleanPayload.diagnostics, []);

  const cleanHuman = runCli(["template", "update", "--check"], { cwd: projectRoot });
  assert.equal(cleanHuman.status, 0, cleanHuman.stderr || cleanHuman.stdout);
  assert.match(cleanHuman.stdout, /Template update check: aligned/);
  assert.match(cleanHuman.stdout, /This command did not write files/);

  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# candidate check edit\n",
    "utf8"
  );
  const pendingCheck = runCli(["template", "update", "--check", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(pendingCheck.status, 0, pendingCheck.stdout);
  const pendingPayload = JSON.parse(pendingCheck.stdout);
  assert.equal(pendingPayload.mode, "check");
  assert.equal(pendingPayload.writes, false);
  assert.equal(pendingPayload.diagnostics.some((diagnostic) => diagnostic.code === "template_update_available"), true);
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, "topo", "entities", "entity-greeting.tg"), "utf8"), /candidate check edit/);
});

test("topogram template update status reports action needed and writes review report", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-status-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const reportPath = path.join(root, "reports", "template-update-report.json");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(
    path.join(projectRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# local status edit\n",
    "utf8"
  );
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# candidate status edit\n",
    "utf8"
  );

  const status = runCli([
    "template",
    "update",
    "--status",
    "--template",
    nextTemplateRoot,
    "--json",
    "--out",
    reportPath
  ], { cwd: projectRoot });
  assert.notEqual(status.status, 0, status.stdout);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.mode, "status");
  assert.equal(payload.writes, false);
  assert.equal(payload.conflicts.some((conflict) => conflict.path === "topo/entities/entity-greeting.tg"), true);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_update_conflict"), true);
  assert.equal(payload.reportPath, reportPath);
  const report = readJson(reportPath);
  assert.equal(report.mode, "status");
  assert.equal(report.reportPath, undefined);
  assert.equal(report.conflicts.some((conflict) => conflict.path === "topo/entities/entity-greeting.tg"), true);

  const humanStatus = runCli(["template", "update", "--status", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.notEqual(humanStatus.status, 0, humanStatus.stdout);
  assert.match(humanStatus.stdout, /Template update status: action needed/);
  assert.match(humanStatus.stdout, /Refused due to 1 conflict\(s\)/);
});

test("topogram template update recommend explains the next reviewed action", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-recommend-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const reportPath = path.join(root, "reports", "recommendation.json");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.version = "0.2.0";
  writeJson(manifestPath, manifest);
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# candidate recommend edit\n",
    "utf8"
  );

  const recommend = runCli([
    "template",
    "update",
    "--recommend",
    "--template",
    nextTemplateRoot,
    "--json",
    "--out",
    reportPath
  ], { cwd: projectRoot });
  assert.equal(recommend.status, 0, recommend.stderr || recommend.stdout);
  const payload = JSON.parse(recommend.stdout);
  assert.equal(payload.mode, "recommend");
  assert.equal(payload.writes, false);
  assert.equal(payload.recommendations.some((item) => item.action === "apply-candidate" && item.command === "topogram template update --apply"), true);
  assert.equal(payload.recommendations.some((item) => item.action === "pin-reviewed-version" && item.command === "topogram template policy pin topogram/web-api-db@0.2.0"), true);
  assert.equal(readJson(reportPath).mode, "recommend");

  const human = runCli(["template", "update", "--recommend", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Template update recommendation: ready/);
  assert.match(human.stdout, /Recommended next steps:/);
  assert.match(human.stdout, /topogram template update --apply/);
});

test("topogram template update accept-current adopts local file baseline", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-accept-current-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const relativeFile = "topo/entities/entity-greeting.tg";
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(path.join(projectRoot, relativeFile), "\n# local accepted edit\n", "utf8");
  fs.appendFileSync(path.join(nextTemplateRoot, relativeFile), "\n# candidate edit\n", "utf8");

  const refused = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.equal(JSON.parse(refused.stdout).conflicts.some((conflict) => conflict.path === relativeFile), true);

  const accept = runCli(["template", "update", "--accept-current", relativeFile, "--json"], { cwd: projectRoot });
  assert.equal(accept.status, 0, accept.stderr || accept.stdout);
  const payload = JSON.parse(accept.stdout);
  assert.equal(payload.mode, "accept-current");
  assert.equal(payload.writes, true);
  assert.equal(payload.accepted.some((file) => file.path === relativeFile), true);
  const baseline = readJson(path.join(projectRoot, ".topogram-template-files.json"));
  const record = baseline.files.find((file) => file.path === relativeFile);
  assert.ok(record);
  assert.match(fs.readFileSync(path.join(projectRoot, relativeFile), "utf8"), /# local accepted edit/);

  const status = runCli(["template", "update", "--status", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(status.status, 0, status.stdout);
  assert.equal(JSON.parse(status.stdout).conflicts.some((conflict) => conflict.path === relativeFile), false);
});

test("topogram template update accept-candidate applies one safe candidate file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-accept-candidate-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const relativeFile = "topo/entities/entity-greeting.tg";
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(path.join(nextTemplateRoot, relativeFile), "\n# single candidate edit\n", "utf8");

  const accept = runCli(["template", "update", "--accept-candidate", relativeFile, "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(accept.status, 0, accept.stderr || accept.stdout);
  const payload = JSON.parse(accept.stdout);
  assert.equal(payload.mode, "accept-candidate");
  assert.equal(payload.writes, true);
  assert.equal(payload.applied.some((file) => file.path === relativeFile && file.kind === "changed"), true);
  assert.match(fs.readFileSync(path.join(projectRoot, relativeFile), "utf8"), /# single candidate edit/);
});

test("topogram template update delete-current removes one baseline-matching current-only file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-delete-current-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const relativeFile = "topo/entities/entity-greeting.tg";
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.rmSync(path.join(nextTemplateRoot, relativeFile));

  const deleted = runCli(["template", "update", "--delete-current", relativeFile, "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(deleted.status, 0, deleted.stderr || deleted.stdout);
  const payload = JSON.parse(deleted.stdout);
  assert.equal(payload.mode, "delete-current");
  assert.equal(payload.writes, true);
  assert.equal(payload.deleted.some((file) => file.path === relativeFile), true);
  assert.equal(fs.existsSync(path.join(projectRoot, relativeFile)), false);
  const baseline = readJson(path.join(projectRoot, ".topogram-template-files.json"));
  assert.equal(baseline.files.some((file) => file.path === relativeFile), false);
});

test("topogram template update reports incompatible template ids", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-id-mismatch-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.id = "topogram/other-template";
  writeJson(manifestPath, manifest);

  const plan = runCli(["template", "update", "--plan", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(plan.status, 0, plan.stdout);
  const payload = JSON.parse(plan.stdout);
  assert.equal(payload.compatible, false);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_id_mismatch"), true);
});

test("topogram template policy denies disallowed sources, executable templates, and version mismatches", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-deny-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });

  const policyPath = path.join(projectRoot, "topogram.template-policy.json");
  const policy = readJson(policyPath);
  policy.allowedSources = ["package"];
  writeJson(policyPath, policy);
  const localDenied = runCli(["template", "update", "--plan", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(localDenied.status, 0, localDenied.stdout);
  assert.equal(JSON.parse(localDenied.stdout).diagnostics.some((diagnostic) => diagnostic.code === "template_source_denied"), true);

  policy.allowedSources = ["local", "package"];
  policy.executableImplementation = "deny";
  writeJson(policyPath, policy);
  const executableDenied = runCli(["template", "update", "--status", "--json"], { cwd: projectRoot });
  assert.notEqual(executableDenied.status, 0, executableDenied.stdout);
  assert.equal(JSON.parse(executableDenied.stdout).diagnostics.some((diagnostic) => diagnostic.code === "template_executable_denied"), true);

  policy.executableImplementation = "allow";
  policy.pinnedVersions = { "topogram/web-api-db": "0.0.0-pinned" };
  writeJson(policyPath, policy);
  const versionDenied = runCli(["template", "update", "--status", "--json"], { cwd: projectRoot });
  assert.notEqual(versionDenied.status, 0, versionDenied.stdout);
  assert.equal(JSON.parse(versionDenied.stdout).diagnostics.some((diagnostic) => diagnostic.code === "template_version_mismatch"), true);
});

test("topogram template policy explain checks package scope from source spec", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-policy-explain-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const projectConfigPath = path.join(projectRoot, "topogram.project.json");
  const projectConfig = readJson(projectConfigPath);
  projectConfig.template.id = "@topogram/template-sample";
  projectConfig.template.version = "0.1.6";
  projectConfig.template.source = "package";
  projectConfig.template.requested = "sample-template";
  projectConfig.template.sourceSpec = "@evil/topogram-template-sample@0.1.6";
  projectConfig.template.catalog = {
    id: "sample-template",
    source: "./topograms.catalog.json",
    package: "@evil/topogram-template-sample",
    version: "0.1.6",
    packageSpec: "@evil/topogram-template-sample@0.1.6"
  };
  writeJson(projectConfigPath, projectConfig);

  const policyPath = path.join(projectRoot, "topogram.template-policy.json");
  const policy = readJson(policyPath);
  policy.allowedTemplateIds = ["@topogram/template-sample"];
  policy.allowedPackageScopes = ["@topogram"];
  policy.executableImplementation = "allow";
  policy.pinnedVersions = { "@topogram/template-sample": "0.1.6" };
  writeJson(policyPath, policy);

  const check = runCli(["template", "policy", "check", "--json"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.diagnostics.some((diagnostic) => diagnostic.code === "template_package_scope_denied"), true);

  const explain = runCli(["template", "policy", "explain", "--json"], { cwd: projectRoot });
  assert.notEqual(explain.status, 0, explain.stdout);
  const explainPayload = JSON.parse(explain.stdout);
  assert.equal(explainPayload.package.scope, "@evil");
  assert.equal(explainPayload.catalog.packageSpec, "@evil/topogram-template-sample@0.1.6");
  const scopeRule = explainPayload.rules.find((rule) => rule.name === "allowed-package-scope");
  assert.equal(scopeRule.ok, false);
  assert.equal(scopeRule.actual, "@evil");
  assert.equal(scopeRule.expected, "@topogram");

  const humanExplain = runCli(["template", "policy", "explain"], { cwd: projectRoot });
  assert.notEqual(humanExplain.status, 0, humanExplain.stdout);
  assert.match(humanExplain.stdout, /Template policy: denied/);
  assert.match(humanExplain.stdout, /Decision: the current template is blocked by this project's template policy\./);
  assert.match(humanExplain.stdout, /FAIL Allowed package scope/);
  assert.match(humanExplain.stdout, /actual: @evil/);
  assert.match(humanExplain.stdout, /expected: @topogram/);
});

test("topogram template check enforces caller template policy when present", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-policy-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const policy = readJson(path.join(projectRoot, "topogram.template-policy.json"));
  policy.allowedSources = ["package"];
  writeJson(path.join(projectRoot, "topogram.template-policy.json"), policy);

  const check = runCli(["template", "check", builtInTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_source_denied"), true);
  assert.equal(payload.steps.some((step) => step.name === "template-policy" && step.ok === false), true);
});

test("topogram template update applies reviewed template-owned changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-apply-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.version = "0.3.0";
  writeJson(manifestPath, manifest);
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# applied template edit\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-note.tg"),
    `entity entity_note {
  name "Note"
  description "A note added by a template update"
  fields {
    id uuid required
  }
  status active
}
`,
    "utf8"
  );

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  const payload = JSON.parse(apply.stdout);
  assert.equal(payload.mode, "apply");
  assert.equal(payload.writes, true);
  assert.deepEqual(payload.diagnostics, []);
  assert.equal(payload.candidate.version, "0.3.0");
  assert.ok(payload.applied.some((file) => file.path === "topo/entities/entity-greeting.tg"));
  assert.ok(payload.applied.some((file) => file.path === "topo/entities/entity-note.tg"));
  assert.match(fs.readFileSync(path.join(projectRoot, "topo", "entities", "entity-greeting.tg"), "utf8"), /# applied template edit/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topo", "entities", "entity-note.tg")), true);
  const projectConfig = readJson(path.join(projectRoot, "topogram.project.json"));
  assert.equal(projectConfig.template.version, "0.3.0");
  const fileManifest = readJson(path.join(projectRoot, ".topogram-template-files.json"));
  assert.equal(fileManifest.template.version, "0.3.0");

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const trustStatus = runCli(["trust", "status", "--json"], { cwd: projectRoot });
  assert.equal(trustStatus.status, 0, trustStatus.stderr || trustStatus.stdout);
  assert.equal(JSON.parse(trustStatus.stdout).ok, true);

  const currentProjectConfig = readJson(path.join(projectRoot, "topogram.project.json"));
  writeJson(path.join(projectRoot, "topogram.project.json"), {
    version: currentProjectConfig.version,
    workspace: currentProjectConfig.workspace,
    template: currentProjectConfig.template,
    outputs: currentProjectConfig.outputs,
    topology: currentProjectConfig.topology,
    implementation: currentProjectConfig.implementation
  });
  const reorderedPlan = runCli(["template", "update", "--plan", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(reorderedPlan.status, 0, reorderedPlan.stderr || reorderedPlan.stdout);
  assert.equal(JSON.parse(reorderedPlan.stdout).summary.changed, 0);

  const baselineBeforeNoop = fs.readFileSync(path.join(projectRoot, ".topogram-template-files.json"), "utf8");
  const trustBeforeNoop = fs.readFileSync(path.join(projectRoot, ".topogram-template-trust.json"), "utf8");
  const humanApply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.equal(humanApply.status, 0, humanApply.stderr || humanApply.stdout);
  assert.match(humanApply.stdout, /Template update apply: complete/);
  assert.match(humanApply.stdout, /Writes: none/);
  assert.match(humanApply.stdout, /No changes to apply/);
  assert.equal(fs.readFileSync(path.join(projectRoot, ".topogram-template-files.json"), "utf8"), baselineBeforeNoop);
  assert.equal(fs.readFileSync(path.join(projectRoot, ".topogram-template-trust.json"), "utf8"), trustBeforeNoop);
});

test("topogram template update apply refuses local template-owned conflicts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-conflict-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(
    path.join(projectRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# local edit\n",
    "utf8"
  );
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# candidate edit\n",
    "utf8"
  );

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(apply.status, 0, apply.stdout);
  const payload = JSON.parse(apply.stdout);
  assert.equal(payload.mode, "apply");
  assert.equal(payload.writes, false);
  assert.ok(payload.conflicts.some((conflict) => conflict.path === "topo/entities/entity-greeting.tg"));
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_update_conflict"), true);
  const currentText = fs.readFileSync(path.join(projectRoot, "topo", "entities", "entity-greeting.tg"), "utf8");
  assert.match(currentText, /# local edit/);
  assert.doesNotMatch(currentText, /# candidate edit/);

  const humanApply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot], { cwd: projectRoot });
  assert.notEqual(humanApply.status, 0, humanApply.stdout);
  assert.match(humanApply.stdout, /Template update apply: refused/);
  assert.match(humanApply.stdout, /Refused due to 1 conflict\(s\)/);
  assert.match(humanApply.stdout, /Conflict: topo\/entities\/entity-greeting\.tg/);
});

test("topogram template update conflict detection works with pinned candidate version", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-pinned-conflict-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const relativeFile = "topo/entities/entity-greeting.tg";
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });

  const manifestPath = path.join(nextTemplateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.version = "0.1.1-conflict-proof";
  writeJson(manifestPath, manifest);

  const policyPath = path.join(projectRoot, "topogram.template-policy.json");
  const policy = readJson(policyPath);
  policy.pinnedVersions = { ...(policy.pinnedVersions || {}), [manifest.id]: manifest.version };
  writeJson(policyPath, policy);

  fs.appendFileSync(path.join(projectRoot, relativeFile), "\n# local pinned conflict edit\n", "utf8");
  fs.appendFileSync(path.join(nextTemplateRoot, relativeFile), "\n# candidate pinned conflict edit\n", "utf8");

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(apply.status, 0, apply.stdout);
  const payload = JSON.parse(apply.stdout);
  assert.equal(payload.mode, "apply");
  assert.equal(payload.writes, false);
  assert.equal(payload.compatible, true);
  assert.equal(payload.candidate.version, manifest.version);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_version_mismatch"), false);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_update_conflict"), true);
  assert.equal(payload.conflicts.some((conflict) => conflict.path === relativeFile), true);

  const currentText = fs.readFileSync(path.join(projectRoot, relativeFile), "utf8");
  assert.match(currentText, /# local pinned conflict edit/);
  assert.doesNotMatch(currentText, /# candidate pinned conflict edit/);
});

test("topogram trust template records template-owned baseline for update apply", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-baseline-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.rmSync(path.join(projectRoot, ".topogram-template-files.json"));
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.appendFileSync(
    path.join(nextTemplateRoot, "topo", "entities", "entity-greeting.tg"),
    "\n# candidate edit after baseline\n",
    "utf8"
  );

  const refused = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.notEqual(refused.status, 0, refused.stdout);
  const refusedPayload = JSON.parse(refused.stdout);
  assert.match(refusedPayload.issues.join("\n"), /\.topogram-template-files\.json is missing/);
  assert.equal(refusedPayload.diagnostics.some((diagnostic) => diagnostic.code === "template_baseline_missing"), true);

  const trust = runCli(["trust", "template"], { cwd: projectRoot });
  assert.equal(trust.status, 0, trust.stderr || trust.stdout);
  assert.match(trust.stdout, /Wrote \.topogram-template-files\.json/);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-files.json")), true);

  const sourceStatus = runCli(["source", "status", "--local", "--json"], { cwd: projectRoot });
  assert.equal(sourceStatus.status, 0, sourceStatus.stderr || sourceStatus.stdout);
  assert.equal(JSON.parse(sourceStatus.stdout).project.templateBaseline.status, "clean");

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  assert.ok(JSON.parse(apply.stdout).applied.some((file) => file.path === "topo/entities/entity-greeting.tg"));
});

test("topogram template update apply skips current-only deletes with diagnostics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-skip-delete-"));
  const projectRoot = path.join(root, "starter");
  const nextTemplateRoot = path.join(root, "next-template");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  fs.cpSync(builtInTemplateRoot, nextTemplateRoot, { recursive: true });
  fs.rmSync(path.join(nextTemplateRoot, "topo", "entities", "entity-greeting.tg"));

  const apply = runCli(["template", "update", "--apply", "--template", nextTemplateRoot, "--json"], { cwd: projectRoot });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  const payload = JSON.parse(apply.stdout);
  assert.equal(payload.mode, "apply");
  assert.equal(payload.ok, true);
  assert.equal(payload.writes, true);
  assert.equal(payload.skipped.some((file) => file.path === "topo/entities/entity-greeting.tg"), true);
  assert.equal(payload.diagnostics.some((diagnostic) => diagnostic.code === "template_current_only_skipped"), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topo", "entities", "entity-greeting.tg")), true);
});

test("topogram template check validates reusable template conformance", () => {
  const check = runCli(["template", "check", builtInTemplateRoot, "--json"]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.templateSpec, builtInTemplateRoot);
  assert.equal(payload.steps.find((step) => step.name === "create-starter").ok, true);
  assert.equal(payload.steps.find((step) => step.name === "starter-check").ok, true);
  assert.equal(payload.steps.find((step) => step.name === "executable-implementation-trust").details.requiresTrust, true);
  assert.equal(payload.steps.find((step) => step.name === "template-update-plan").details.writes, false);
  assert.deepEqual(payload.diagnostics, []);

  const humanCheck = runCli(["template", "check", builtInTemplateRoot]);
  assert.equal(humanCheck.status, 0, humanCheck.stderr || humanCheck.stdout);
  assert.match(humanCheck.stdout, /Template check passed/);
  assert.match(humanCheck.stdout, /PASS create-starter/);
  assert.match(humanCheck.stdout, /Temp starter:/);
  assert.match(humanCheck.stdout, /PASS starter-check/);
  assert.match(humanCheck.stdout, /PASS executable-implementation-trust/);
  assert.match(humanCheck.stdout, /PASS template-update-plan/);
});

test("topogram template check reports invalid template conformance", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-invalid-"));
  const templateRoot = path.join(root, "bad-template");
  fs.mkdirSync(path.join(templateRoot, "topo"), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, "topogram.project.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(templateRoot, "topogram-template.json"), JSON.stringify({
    id: "bad-template",
    version: "0.1.0",
    kind: "starter"
  }, null, 2));

  const check = runCli(["template", "check", templateRoot, "--json"]);
  assert.notEqual(check.status, 0, check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, false);
  assert.match(payload.errors.join("\n"), /topogramVersion/);
  assert.equal(payload.diagnostics[0].code, "template_manifest_invalid");
  assert.equal(payload.diagnostics[0].severity, "error");
  assert.match(payload.diagnostics[0].path, /topogram-template\.json$/);
  assert.match(payload.diagnostics[0].suggestedFix, /manifest schema/);
  assert.equal(payload.steps.find((step) => step.name === "create-starter").ok, false);

  const humanCheck = runCli(["template", "check", templateRoot]);
  assert.notEqual(humanCheck.status, 0, humanCheck.stdout);
  assert.match(humanCheck.stdout, /FAIL create-starter/);
  assert.match(humanCheck.stdout, /\[error\] template_manifest_invalid:/);
  assert.match(humanCheck.stdout, /fix: Fix topogram-template\.json/);
});

for (const scenario of [
  {
    name: "missing manifest",
    code: "template_manifest_missing",
    setup(templateRoot) {
      fs.rmSync(path.join(templateRoot, "topogram-template.json"));
    }
  },
  {
    name: "missing topogram",
    code: "template_topogram_missing",
    setup(templateRoot) {
      fs.rmSync(path.join(templateRoot, "topo"), { recursive: true });
    }
  },
  {
    name: "missing project config",
    code: "template_project_config_missing",
    setup(templateRoot) {
      fs.rmSync(path.join(templateRoot, "topogram.project.json"));
    }
  },
  {
    name: "missing implementation",
    code: "template_implementation_missing",
    setup(templateRoot) {
      fs.rmSync(path.join(templateRoot, "implementation"), { recursive: true });
    }
  }
]) {
  test(`topogram template check reports ${scenario.name}`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-shape-"));
    const templateRoot = copyBuiltInTemplate(root, "bad-template");
    scenario.setup(templateRoot);

    const check = runCli(["template", "check", templateRoot, "--json"]);
    assert.notEqual(check.status, 0, check.stdout);
    const payload = JSON.parse(check.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.diagnostics[0].code, scenario.code);
    assert.equal(payload.diagnostics[0].step, "create-starter");
    assert.equal(payload.steps.find((step) => step.name === "create-starter").diagnostics[0].code, scenario.code);
    assert.ok(payload.diagnostics[0].suggestedFix);
  });
}

test("topogram template check reports invalid generated project config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-project-"));
  const templateRoot = copyBuiltInTemplate(root, "bad-project-config");
  const projectConfigPath = path.join(templateRoot, "topogram.project.json");
  const projectConfig = readJson(projectConfigPath);
  projectConfig.topology.runtimes[0].generator.id = "topogram/not-real";
  writeJson(projectConfigPath, projectConfig);

  const check = runCli(["template", "check", templateRoot, "--json"]);
  assert.notEqual(check.status, 0, check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, false);
  const diagnostic = payload.diagnostics.find((item) => item.code === "starter_check_failed");
  assert.ok(diagnostic);
  assert.match(diagnostic.message, /unknown generator 'topogram\/not-real'/);
  assert.equal(fs.realpathSync(diagnostic.path), fs.realpathSync(path.join(payload.projectRoot, "topogram.project.json")));
  assert.equal(payload.steps.find((step) => step.name === "starter-check").ok, false);
});

test("topogram template check rejects undeclared executable implementation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-check-trust-"));
  const templateRoot = copyBuiltInTemplate(root, "bad-trust");
  const manifestPath = path.join(templateRoot, "topogram-template.json");
  const manifest = readJson(manifestPath);
  manifest.includesExecutableImplementation = false;
  writeJson(manifestPath, manifest);

  const check = runCli(["template", "check", templateRoot, "--json"]);
  assert.notEqual(check.status, 0, check.stdout);
  const payload = JSON.parse(check.stdout);
  assert.equal(payload.ok, false);
  const diagnostic = payload.diagnostics.find((item) => item.code === "template_implementation_undeclared");
  assert.ok(diagnostic);
  assert.match(diagnostic.message, /contains implementation\//);
  assert.match(diagnostic.suggestedFix, /includesExecutableImplementation to true/);
  assert.equal(payload.steps.find((step) => step.name === "create-starter").ok, false);
});

test("topogram template update requires explicit plan mode", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-update-write-refusal-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot, "--template", builtInTemplateRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const update = runCli(["template", "update"], { cwd: projectRoot });
  assert.notEqual(update.status, 0, update.stdout);
  assert.match(update.stderr, /requires `--status`, `--recommend`, `--plan`, `--check`, `--apply`/);
});

test("topogram new supports packed npm template packs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-packed-template-"));
  const templatePackageRoot = path.join(root, "template-package");
  const packRoot = path.join(root, "pack");
  const projectRoot = path.join(root, "starter");
  fs.mkdirSync(packRoot);
  fs.cpSync(builtInTemplateRoot, templatePackageRoot, { recursive: true });
  writePackageJson(templatePackageRoot, {
    name: "@topogram/template-test",
    version: "0.1.0",
    private: true,
    type: "module",
    files: ["topogram-template.json", "topo", "topogram.project.json", "implementation"]
  });

  const pack = runNpm(["pack", "--pack-destination", packRoot], templatePackageRoot, {
    env: { npm_config_cache: npmCacheRoot }
  });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  const tarball = path.join(packRoot, pack.stdout.trim().split(/\s+/).at(-1));

  const create = runCli(["new", projectRoot, "--template", tarball], {
    env: { npm_config_cache: npmCacheRoot }
  });
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: topogram\/web-api-db/);
  assert.match(create.stderr, /copied implementation\/ code/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topo", "entities", "entity-greeting.tg")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
});

test("topogram new rejects legacy packed template topogram folders", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-packed-template-legacy-"));
  const templatePackageRoot = path.join(root, "template-package");
  const packRoot = path.join(root, "pack");
  const projectRoot = path.join(root, "starter");
  fs.mkdirSync(packRoot);
  fs.cpSync(builtInTemplateRoot, templatePackageRoot, { recursive: true });
  fs.renameSync(path.join(templatePackageRoot, "topo"), path.join(templatePackageRoot, "topogram"));
  writePackageJson(templatePackageRoot, {
    name: "@topogram/template-legacy-workspace-test",
    version: "0.1.0",
    private: true,
    type: "module",
    files: ["topogram-template.json", "topogram", "topogram.project.json", "implementation"]
  });

  const pack = runNpm(["pack", "--pack-destination", packRoot], templatePackageRoot, {
    env: { npm_config_cache: npmCacheRoot }
  });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  const tarball = path.join(packRoot, pack.stdout.trim().split(/\s+/).at(-1));

  const create = runCli(["new", projectRoot, "--template", tarball], {
    env: { npm_config_cache: npmCacheRoot }
  });
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /Package is missing topo\//);
  assert.equal(fs.existsSync(path.join(projectRoot, "topo")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram")), false);
});

test("topogram new reports invalid template manifests", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-invalid-template-"));
  const templateRoot = path.join(root, "bad-template");
  const projectRoot = path.join(root, "starter");
  fs.mkdirSync(path.join(templateRoot, "topo"), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, "topogram.project.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(templateRoot, "topogram-template.json"), JSON.stringify({
    id: "bad-template",
    version: "0.1.0",
    kind: "starter"
  }, null, 2));

  const create = runCli(["new", projectRoot, "--template", templateRoot]);
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /topogram-template\.json is missing required string field 'topogramVersion'/);
});

test("repo root new script creates a generated app starter project outside engine", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-root-create-"));
  const projectRoot = path.join(root, "starter");
  const create = runNpm(["run", "new", "--", projectRoot, "--template", path.join(fixtureTemplatesRoot, "hello-web")], repoRoot);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created Topogram project/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topo", "docs", "workflows", "workflow-hello.md")), true);
});

test("repo root smoke test app script creates and generates disposable app", () => {
  const result = runNpm(["run", "smoke:test-app"], repoRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Smoke test app generated and verified/);
  assert.equal(fs.existsSync(path.join(repoRoot, ".tmp", "smoke-test-app", "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(repoRoot, ".tmp", "smoke-test-app", "app", ".topogram-generated.json")), true);
});

test("topogram new refuses to create generated projects inside engine", () => {
  const create = runCli(["new", "./my-topogram-app"]);
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /inside the engine directory/);
  assert.equal(fs.existsSync(path.join(engineRoot, "my-topogram-app")), false);
});
