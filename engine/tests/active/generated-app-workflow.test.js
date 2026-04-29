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

function runCli(args) {
  return childProcess.spawnSync(process.execPath, ["./src/cli.js", ...args], {
    cwd: engineRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
}

function runNpm(args, cwd) {
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  return childProcess.spawnSync(npmBin, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\s+$/, "\n");
}

test("public authoring-to-app commands check and generate app bundles", () => {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /topogram check <path>/);
  assert.match(help.stdout, /topogram generate <path>/);
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
});

test("topogram new creates a generated app starter project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-new-"));
  const projectRoot = path.join(root, "starter");
  const create = runCli(["new", projectRoot]);
  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created Topogram project/);

  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts.check, "npm run topogram:check");
  assert.equal(pkg.scripts.generate, "npm run topogram:generate");
  assert.equal(pkg.devDependencies.topogram.startsWith("file:"), true);

  assert.equal(fs.existsSync(path.join(projectRoot, "topogram", "entities", "entity-task.tg")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "topogram.project.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "implementation", "index.js")), true);

  const install = runNpm(["install"], projectRoot);
  assert.equal(install.status, 0, install.stderr || install.stdout);

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
