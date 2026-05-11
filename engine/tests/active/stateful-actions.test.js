import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadArchive } from "../../src/archive/resolver-bridge.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const cliPath = path.join(repoRoot, "engine", "src", "cli.js");
const fixtureRoot = path.join(repoRoot, "engine", "tests", "fixtures", "workspaces", "sdlc-basic");

function copyFixtureToTemp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-stateful-actions-"));
  fs.cpSync(fixtureRoot, root, { recursive: true });
  return root;
}

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      ...(options.env || {})
    }
  });
}

function replaceInFile(filePath, from, to) {
  const text = fs.readFileSync(filePath, "utf8");
  assert.ok(text.includes(from), `${filePath} did not include ${from}`);
  fs.writeFileSync(filePath, text.replace(from, to), "utf8");
}

test("SDLC statement status changes are command-owned and direct edits are detected", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const transition = runCli([
      "sdlc",
      "transition",
      "task_implement_audit_writer",
      "done",
      tempRoot,
      "--actor",
      "stateful-test",
      "--note",
      "command-owned transition"
    ]);
    assert.equal(transition.status, 0, transition.stderr || transition.stdout);

    const history = JSON.parse(fs.readFileSync(path.join(tempRoot, "topo", "sdlc", ".topogram-sdlc-history.json"), "utf8"));
    assert.equal(history.task_implement_audit_writer.at(-1).to, "done");

    replaceInFile(
      path.join(tempRoot, "topo", "tasks", "implement-audit-writer.tg"),
      "status done",
      "status in-progress"
    );

    const strictCheck = runCli(["sdlc", "check", tempRoot, "--strict"]);
    assert.notEqual(strictCheck.status, 0, strictCheck.stdout);
    assert.match(strictCheck.stdout, /status drift/);
    assert.match(strictCheck.stdout, /topogram sdlc transition/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("plan step status changes are command-owned and direct edits are detected", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const transition = runCli([
      "sdlc",
      "plan",
      "step",
      "complete",
      "plan_implement_audit_writer",
      "implement_writer",
      tempRoot,
      "--actor",
      "stateful-test",
      "--write"
    ]);
    assert.equal(transition.status, 0, transition.stderr || transition.stdout);

    const history = JSON.parse(fs.readFileSync(path.join(tempRoot, "topo", "sdlc", ".topogram-sdlc-history.json"), "utf8"));
    assert.equal(history["plan_implement_audit_writer#implement_writer"].at(-1).to, "done");

    replaceInFile(
      path.join(tempRoot, "topo", "plans", "implement-audit-writer.tg"),
      "step implement_writer status done",
      "step implement_writer status pending"
    );

    const strictCheck = runCli(["sdlc", "check", tempRoot, "--strict"]);
    assert.notEqual(strictCheck.status, 0, strictCheck.stdout);
    assert.match(strictCheck.stdout, /step status drift/);
    assert.match(strictCheck.stdout, /topogram sdlc plan step transition/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("SDLC history sidecar shape is validated as command-owned audit state", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    fs.mkdirSync(path.join(tempRoot, "topo", "sdlc"), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, "topo", "sdlc", ".topogram-sdlc-history.json"),
      JSON.stringify({ task_implement_audit_writer: { to: "done" } }, null, 2),
      "utf8"
    );

    const strictCheck = runCli(["sdlc", "check", tempRoot, "--strict"]);
    assert.notEqual(strictCheck.status, 0, strictCheck.stdout);
    assert.match(strictCheck.stdout, /must be an array of transition records/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("archive JSONL entries require command-owned archive schema", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    fs.mkdirSync(path.join(tempRoot, "topo", "sdlc", "_archive"), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, "topo", "sdlc", "_archive", "tasks-2026.jsonl"),
      JSON.stringify({
        id: "task_manual_archive",
        kind: "task",
        name: "Manual archive",
        description: "Missing command-owned archive transition metadata",
        status: "done",
        archived: { at: "2026-05-11T00:00:00.000Z" }
      }) + "\n",
      "utf8"
    );

    const archive = loadArchive(tempRoot);
    assert.equal(archive.entries.some((entry) => entry.id === "task_manual_archive"), false);
    assert.ok(archive.errors.some((error) => /transitions array/.test(error)), JSON.stringify(archive.errors, null, 2));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("docs name command-owned state surfaces and their commands", () => {
  const sdlcDocs = fs.readFileSync(path.join(repoRoot, "docs", "sdlc.md"), "utf8");
  const agentDocs = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
  const importDocs = fs.readFileSync(path.join(repoRoot, "docs", "import.md"), "utf8");
  const templateDocs = fs.readFileSync(path.join(repoRoot, "docs", "template-authoring.md"), "utf8");
  const releaseDocs = fs.readFileSync(path.join(repoRoot, "docs", "releasing.md"), "utf8");

  for (const required of [
    "topo/sdlc/.topogram-sdlc-history.json",
    "topo/sdlc/_archive/*.jsonl",
    ".topogram-template-trust.json",
    ".topogram-template-files.json",
    ".topogram-source.json",
    "app/.topogram-generated.json",
    "topogram sdlc transition",
    "topogram sdlc plan step",
    "topogram trust template",
    "topogram import history --verify",
    "topogram generate",
    "topogram emit --write",
    "topogram release:status"
  ]) {
    assert.match(sdlcDocs, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(agentDocs, /Stateful workflow mutations are command-owned/);
  assert.match(importDocs, /Import provenance and adoption receipts are command-owned state/);
  assert.match(templateDocs, /\.topogram-template-trust\.json.*command-owned state/s);
  assert.match(releaseDocs, /Release status reports.*command-owned state/s);
});
