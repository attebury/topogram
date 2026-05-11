import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkDoD } from "../../src/sdlc/dod/index.js";
import { completeTask } from "../../src/sdlc/complete.js";
import { linkSdlcRecord } from "../../src/sdlc/link.js";
import { defaultSdlcPolicy, loadSdlcPolicy, validateSdlcPolicy, writeDefaultSdlcPolicy } from "../../src/sdlc/policy.js";
import { runSdlcGate } from "../../src/sdlc/gate.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(engineRoot, "..");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "sdlc-basic");

function copyFixtureToTemp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-sdlc-policy-"));
  fs.cpSync(fixtureRoot, tempRoot, { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "topogram.project.json"), JSON.stringify({
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
  }, null, 2));
  return tempRoot;
}

function writePolicy(root, overrides = {}) {
  fs.writeFileSync(path.join(root, "topogram.sdlc-policy.json"), `${JSON.stringify({
    ...defaultSdlcPolicy(),
    ...overrides
  }, null, 2)}\n`, "utf8");
}

test("SDLC policy validates schema and default init writes an adopted policy", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const policyPath = path.join(tempRoot, "topogram.sdlc-policy.json");
    assert.equal(fs.existsSync(policyPath), false);
    const result = writeDefaultSdlcPolicy(tempRoot);
    assert.equal(result.ok, true);
    const info = loadSdlcPolicy(tempRoot);
    assert.equal(info.exists, true);
    assert.equal(info.status, "adopted");
    assert.equal(info.mode, "enforced");
    assert.deepEqual(info.diagnostics, []);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("SDLC policy validation rejects unsafe protected paths and invalid modes", () => {
  const result = validateSdlcPolicy({
    ...defaultSdlcPolicy(),
    mode: "strict",
    protectedPaths: ["../secret"]
  });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.message.includes("mode")));
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.message.includes("Invalid protected path")));
});

test("SDLC gate reports not adopted unless require-adopted is requested", async () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const advisory = await runSdlcGate(tempRoot, {
      changedFiles: ["engine/src/cli.js"]
    });
    assert.equal(advisory.ok, true, JSON.stringify(advisory, null, 2));
    assert.equal(advisory.policy.status, "not_adopted");

    const required = await runSdlcGate(tempRoot, {
      changedFiles: ["engine/src/cli.js"],
      requireAdopted: true
    });
    assert.equal(required.ok, false);
    assert.ok(required.errors.some((message) => message.includes("not adopted")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("SDLC gate enforces protected changes unless linked, record-backed, or exempted", async () => {
  const tempRoot = copyFixtureToTemp();
  try {
    writePolicy(tempRoot);

    const unlinked = await runSdlcGate(tempRoot, {
      changedFiles: ["engine/src/sdlc/gate.js"],
      requireAdopted: true
    });
    assert.equal(unlinked.ok, false);
    assert.ok(unlinked.errors.some((message) => message.includes("Protected changes require")));

    const linked = await runSdlcGate(tempRoot, {
      changedFiles: ["engine/src/sdlc/gate.js"],
      sdlcIds: ["task_implement_audit_writer"],
      requireAdopted: true
    });
    assert.equal(linked.ok, true, JSON.stringify(linked, null, 2));
    assert.deepEqual(linked.validSdlcIds, ["task_implement_audit_writer"]);

    const recordBacked = await runSdlcGate(tempRoot, {
      changedFiles: ["topo/tasks/implement-audit-writer.tg"],
      requireAdopted: true
    });
    assert.equal(recordBacked.ok, true, JSON.stringify(recordBacked, null, 2));

    const nonSdlcTopoChange = await runSdlcGate(tempRoot, {
      changedFiles: ["topo/projections/example.tg"],
      requireAdopted: true
    });
    assert.equal(nonSdlcTopoChange.ok, false);

    const exempted = await runSdlcGate(tempRoot, {
      changedFiles: ["engine/src/sdlc/gate.js"],
      exemption: "Emergency CI repair",
      requireAdopted: true
    });
    assert.equal(exempted.ok, true, JSON.stringify(exempted, null, 2));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("done task DoD requires satisfies, acceptance_refs, and verification_refs", () => {
  const task = {
    kind: "task",
    id: "task_missing_verification",
    status: "in-progress",
    workType: "implementation",
    claimedBy: ["actor_dev"],
    satisfies: [{ id: "req_audit_persistence" }],
    acceptanceRefs: [{ id: "ac_audit_survives_restart" }]
  };
  const dod = checkDoD("task", task, "done", { byId: new Map() });
  assert.equal(dod.satisfied, false);
  assert.ok(dod.errors.some((message) => message.includes("verification_refs")));
});

test("sdlc link and complete update task verification references", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const taskFile = path.join(tempRoot, "topo", "tasks", "implement-audit-writer.tg");
    fs.writeFileSync(
      taskFile,
      fs.readFileSync(taskFile, "utf8").replace(/\n  verification_refs \[[^\]]+\]/, ""),
      "utf8"
    );

    const link = linkSdlcRecord(tempRoot, "task_implement_audit_writer", "verification_audit_persists", { write: true });
    assert.equal(link.ok, true, JSON.stringify(link, null, 2));
    assert.ok(fs.readFileSync(taskFile, "utf8").includes("verification_refs [verification_audit_persists]"));

    const complete = completeTask(tempRoot, "task_implement_audit_writer", "verification_audit_persists", {
      write: true,
      actor: "agent-test"
    });
    assert.equal(complete.ok, true, JSON.stringify(complete, null, 2));
    assert.ok(fs.readFileSync(taskFile, "utf8").includes("status done"));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("engine repo has adopted enforced SDLC policy", () => {
  const info = loadSdlcPolicy(repoRoot);
  assert.equal(info.exists, true);
  assert.equal(info.status, "adopted");
  assert.equal(info.mode, "enforced");
});
