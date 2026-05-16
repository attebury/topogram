import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const cliPath = path.join(repoRoot, "engine", "src", "cli.js");

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    }
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("topogram init creates an empty maintained workspace without overwriting app files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-init-"));
  const appRoot = path.join(root, "existing-app");
  fs.mkdirSync(path.join(appRoot, "src"), { recursive: true });
  fs.writeFileSync(path.join(appRoot, "src", "index.js"), "console.log('app source');\n", "utf8");
  fs.writeFileSync(path.join(appRoot, "README.md"), "# Existing App\n", "utf8");

  try {
    const init = runCli(["init", appRoot, "--json"]);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const payload = JSON.parse(init.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.projectRoot, appRoot);
    assert.equal(payload.workspaceRoot, path.join(appRoot, "topo"));
    assert.equal(payload.created.includes("topogram.project.json"), true);
    assert.equal(payload.created.includes("topo"), true);
    assert.equal(payload.skipped.includes("README.md"), true);

    assert.equal(fs.readFileSync(path.join(appRoot, "src", "index.js"), "utf8"), "console.log('app source');\n");
    assert.equal(fs.readFileSync(path.join(appRoot, "README.md"), "utf8"), "# Existing App\n");
    assert.equal(fs.existsSync(path.join(appRoot, "AGENTS.md")), true);

    const config = readJson(path.join(appRoot, "topogram.project.json"));
    assert.deepEqual(config, {
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

    const check = runCli(["check", appRoot, "--json"]);
    assert.equal(check.status, 0, check.stderr || check.stdout);
    const checkPayload = JSON.parse(check.stdout);
    assert.equal(checkPayload.ok, true);
    assert.equal(checkPayload.project.resolvedTopology.outputs[0].ownership, "maintained");
    assert.equal(checkPayload.project.resolvedTopology.runtimes.length, 0);

    const brief = runCli(["agent", "brief", appRoot, "--json"]);
    assert.equal(brief.status, 0, brief.stderr || brief.stdout);
    const briefPayload = JSON.parse(brief.stdout);
    assert.equal(briefPayload.template.id, null);
    assert.equal(briefPayload.topology.outputs[0].ownership, "maintained");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("topogram init --adopt-sdlc adopts enforced SDLC and scaffolds folders during initialization", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-init-sdlc-"));
  const appRoot = path.join(root, "existing-app");
  fs.mkdirSync(appRoot, { recursive: true });

  try {
    const init = runCli(["init", appRoot, "--adopt-sdlc", "--json"]);
    assert.equal(init.status, 0, init.stderr || init.stdout);
    const payload = JSON.parse(init.stdout);
    assert.equal(payload.sdlc.enabled, true);
    assert.equal(payload.created.includes("topogram.sdlc-policy.json"), true);
    assert.equal(payload.created.includes("topo/sdlc"), true);
    assert.equal(payload.created.includes("topo/sdlc/tasks"), true);
    assert.equal(payload.created.includes("topo/sdlc/plans"), true);
    assert.equal(payload.created.includes("topo/sdlc/_archive"), true);
    assert.deepEqual(payload.sdlc.folders.sort(), [
      "_archive",
      "acceptance_criteria",
      "bugs",
      "decisions",
      "pitches",
      "plans",
      "requirements",
      "tasks"
    ]);

    const policy = readJson(path.join(appRoot, "topogram.sdlc-policy.json"));
    assert.equal(policy.status, "adopted");
    assert.equal(policy.mode, "enforced");
    assert.equal(policy.protectedPaths.includes("topo/**"), true);
    for (const folder of payload.sdlc.folders) {
      assert.equal(fs.existsSync(path.join(appRoot, "topo", "sdlc", folder)), true);
    }

    const explain = runCli(["sdlc", "policy", "explain", appRoot, "--json"]);
    assert.equal(explain.status, 0, explain.stderr || explain.stdout);
    const explainPayload = JSON.parse(explain.stdout);
    assert.equal(explainPayload.policy.exists, true);
    assert.equal(explainPayload.policy.status, "adopted");
    assert.equal(explainPayload.policy.mode, "enforced");

    const sdlcCheck = runCli(["sdlc", "check", appRoot, "--strict"]);
    assert.equal(sdlcCheck.status, 0, sdlcCheck.stderr || sdlcCheck.stdout);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("topogram init refuses existing Topogram config or non-empty topo workspace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-init-refuse-"));
  try {
    const initialized = path.join(root, "initialized");
    fs.mkdirSync(initialized, { recursive: true });
    fs.writeFileSync(path.join(initialized, "topogram.project.json"), "{}\n", "utf8");
    const existingConfig = runCli(["init", initialized]);
    assert.notEqual(existingConfig.status, 0);
    assert.match(existingConfig.stderr, /topogram\.project\.json already exists/);

    const nonEmptyTopo = path.join(root, "non-empty-topo");
    fs.mkdirSync(path.join(nonEmptyTopo, "topo"), { recursive: true });
    fs.writeFileSync(path.join(nonEmptyTopo, "topo", "note.txt"), "not empty\n", "utf8");
    const nonEmpty = runCli(["init", nonEmptyTopo]);
    assert.notEqual(nonEmpty.status, 0);
    assert.match(nonEmpty.stderr, /topo\/ already exists and is not empty/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
