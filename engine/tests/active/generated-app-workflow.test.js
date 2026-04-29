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
const builtInTemplateRoot = path.join(engineRoot, "templates", "web-api-db");
const npmCacheRoot = path.join(os.tmpdir(), "topogram-generated-app-workflow-npm-cache");
fs.mkdirSync(npmCacheRoot, { recursive: true });

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [path.join(engineRoot, "src", "cli.js"), ...args], {
    cwd: options.cwd || engineRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {}),
      PATH: process.env.PATH || ""
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
      PATH: process.env.PATH || ""
    }
  });
}

function writePackageJson(root, pkg) {
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\s+$/, "\n");
}

test("public authoring-to-app commands check and generate app bundles", () => {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /topogram check \[path\]/);
  assert.match(help.stdout, /topogram generate \[path\]/);
  assert.doesNotMatch(help.stdout, /topogram build \[path\]/);
  assert.doesNotMatch(help.stdout, /query work-packet/);

  const check = runCli(["check", fixtureRoot]);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Topogram check passed/);

  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-app-basic-"));
  const generate = runCli(["generate", fixtureRoot, "--out", outputRoot]);
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  for (const relativePath of [
    ".topogram-generated.json",
    "README.md",
    "package.json",
    "app-bundle-plan.json",
    "scripts/bootstrap.sh",
    "scripts/compile-check.sh",
    "scripts/runtime-check.sh"
  ]) {
    assert.equal(
      readText(path.join(outputRoot, relativePath)),
      readText(path.join(expectedRoot, relativePath)),
      `${relativePath} should match the app-basic fixture`
    );
  }

  const statusAlias = runCli(["status", fixtureRoot]);
  assert.notEqual(statusAlias.status, 0, statusAlias.stdout);

  const doctorAlias = runCli(["doctor", fixtureRoot]);
  assert.notEqual(doctorAlias.status, 0, doctorAlias.stdout);

  const buildAlias = runCli(["build", fixtureRoot, "--out", outputRoot]);
  assert.notEqual(buildAlias.status, 0, buildAlias.stdout);
});

test("public commands default to project topogram and app paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-defaults-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["create", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const check = runCli(["check"], { cwd: projectRoot });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /Topogram check passed/);

  const inspect = runCli(["check", "--json"], { cwd: projectRoot });
  assert.equal(inspect.status, 0, inspect.stderr || inspect.stdout);
  assert.equal(JSON.parse(inspect.stdout).project.resolvedTopology.components.length, 3);

  const install = runNpm(["install"], projectRoot);
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
});

test("topogram new creates a generated app starter project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-new-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created Topogram project/);
  assert.match(create.stdout, /npm run check/);
  assert.match(create.stdout, /npm run generate/);

  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts.explain, "node ./scripts/explain.mjs");
  assert.equal(pkg.scripts.check, "topogram check");
  assert.equal(pkg.scripts["check:json"], "topogram check --json");
  assert.equal(pkg.scripts.generate, "topogram generate");
  assert.equal(pkg.scripts.status, undefined);
  assert.equal(pkg.scripts.inspect, undefined);
  assert.equal(pkg.scripts.build, undefined);
  assert.equal(pkg.devDependencies["@attebury/topogram"].startsWith("file:"), true);
  assert.equal(pkg.devDependencies.topogram, undefined);

  assert.match(create.stderr, /copied implementation\/ code/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-task.tg")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-trust.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "scripts", "explain.mjs")), true);
  const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "topogram.project.json"), "utf8"));
  assert.equal(projectConfig.template.id, "topogram/web-api-db");
  assert.equal(projectConfig.template.includesExecutableImplementation, true);
  const trustRecord = JSON.parse(fs.readFileSync(path.join(projectRoot, ".topogram-template-trust.json"), "utf8"));
  assert.equal(trustRecord.trustPolicy, "topogram-template-executable-implementation-v1");
  assert.equal(trustRecord.template.id, "topogram/web-api-db");
  assert.equal(trustRecord.template.version, projectConfig.template.version);
  assert.equal(trustRecord.implementation.module, "./implementation/index.js");
  assert.equal(trustRecord.content.algorithm, "sha256");
  assert.match(trustRecord.content.digest, /^[a-f0-9]{64}$/);
  assert.ok(trustRecord.content.files.some((file) => file.path === "index.js"));

  const install = runNpm(["install"], projectRoot);
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const explain = runNpm(["run", "explain"], projectRoot);
  assert.equal(explain.status, 0, explain.stderr || explain.stdout);
  assert.match(explain.stdout, /Topogram app workflow/);
  assert.match(explain.stdout, /npm run check/);
  assert.match(explain.stdout, /npm run generate/);
  assert.match(explain.stdout, /npm run verify/);

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

test("topogram generate requires local executable implementation trust", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
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
  assert.match(trust.stdout, /Wrote \.topogram-template-trust\.json/);
  assert.equal(fs.existsSync(trustPath), true);

  const generate = runCli(["generate"], { cwd: projectRoot });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);
  assert.equal(fs.existsSync(path.join(projectRoot, "app", ".topogram-generated.json")), true);
});

test("topogram generate rejects stale template trust metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-stale-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
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

test("topogram trust status reports implementation content drift and trust refresh adopts edits", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-template-trust-content-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
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

  const check = runCli(["check"], { cwd: projectRoot });
  assert.notEqual(check.status, 0, check.stdout);
  assert.match(check.stderr, /implementation content changed since it was last trusted/);

  const trust = runCli(["trust", "template"], { cwd: projectRoot });
  assert.equal(trust.status, 0, trust.stderr || trust.stdout);
  assert.match(trust.stdout, /Trusted implementation digest/);

  const cleanStatus = runCli(["trust", "status", "--json"], { cwd: projectRoot });
  assert.equal(cleanStatus.status, 0, cleanStatus.stderr || cleanStatus.stdout);
  const cleanPayload = JSON.parse(cleanStatus.stdout);
  assert.equal(cleanPayload.ok, true);
  assert.deepEqual(cleanPayload.content.changed, []);
  assert.deepEqual(cleanPayload.content.added, []);
  assert.deepEqual(cleanPayload.content.removed, []);
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

test("topogram new supports packed npm template packs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-packed-template-"));
  const templatePackageRoot = path.join(root, "template-package");
  const packRoot = path.join(root, "pack");
  const projectRoot = path.join(root, "starter");
  fs.mkdirSync(packRoot);
  fs.cpSync(builtInTemplateRoot, templatePackageRoot, { recursive: true });
  writePackageJson(templatePackageRoot, {
    name: "@attebury/topogram-template-test",
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
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Template: topogram\/web-api-db/);
  assert.match(create.stderr, /copied implementation\/ code/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);
});

test("topogram new reports invalid template manifests", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-invalid-template-"));
  const templateRoot = path.join(root, "bad-template");
  const projectRoot = path.join(root, "starter");
  fs.mkdirSync(path.join(templateRoot, "topogram"), { recursive: true });
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
  const create = runNpm(["run", "new", "--", projectRoot], repoRoot);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created Topogram project/);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-greeting.tg")), true);
});

test("repo root smoke test app script creates and generates disposable app", () => {
  const result = runNpm(["run", "smoke:test-app"], repoRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Smoke test app generated/);
  assert.equal(fs.existsSync(path.join(repoRoot, ".tmp", "smoke-test-app", "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(repoRoot, ".tmp", "smoke-test-app", "app", ".topogram-generated.json")), true);
});

test("topogram new refuses to create generated projects inside engine", () => {
  const create = runCli(["new", "./my-topogram-app"]);
  assert.notEqual(create.status, 0, create.stdout);
  assert.match(create.stderr, /inside the engine directory/);
  assert.equal(fs.existsSync(path.join(engineRoot, "my-topogram-app")), false);
});
