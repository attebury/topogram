// Phase 2 SDLC golden tests.
//
// Validates the full SDLC layer: per-kind validators, resolver back-links,
// slices for the 6 new selectors, generators (board / doc-page /
// release-notes / traceability-matrix), state-machine transitions, DoD
// rules, archive load/save, and release dry-run output.

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parsePath, parseSource } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { validateWorkspace } from "../../src/validator.js";
import { generateWorkspace } from "../../src/generator/index.js";
import { validateTransition, legalTransitionsFor } from "../../src/sdlc/transitions/index.js";
import { checkDoD } from "../../src/sdlc/dod/index.js";
import { transitionStatement } from "../../src/sdlc/transition.js";
import { createPlan, explainPlan, transitionPlanStep } from "../../src/sdlc/plan.js";
import { checkWorkspace } from "../../src/sdlc/check.js";
import { explain } from "../../src/sdlc/explain.js";
import { runSdlcCommitPrep } from "../../src/sdlc/prep.js";
import { runRelease } from "../../src/sdlc/release.js";
import { scaffoldNew } from "../../src/sdlc/scaffold.js";
import { startTask } from "../../src/sdlc/start.js";
import {
  buildSdlcAvailablePayload,
  buildSdlcBlockersPayload,
  buildSdlcClaimedPayload,
  buildSdlcProofGapsPayload
} from "../../src/sdlc/views.js";
import { auditWorkspace } from "../../src/sdlc/audit.js";
import { sdlcAdopt } from "../../src/sdlc/adopt.js";
import { archiveStatement, archiveEligibleStatements } from "../../src/archive/archive.js";
import { unarchive } from "../../src/archive/unarchive.js";
import { loadArchive } from "../../src/archive/resolver-bridge.js";
import { generateSdlcBoard } from "../../src/generator/sdlc/board.js";
import { generateSdlcReleaseNotes } from "../../src/generator/sdlc/release-notes.js";
import { generateSdlcTraceabilityMatrix } from "../../src/generator/sdlc/traceability-matrix.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = path.join(engineRoot, "src", "cli.js");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "sdlc-basic");

function workspaceFromSource(source) {
  return {
    root: "<memory>",
    files: [parseSource(source, "sdlc-test.tg")],
    docs: []
  };
}

function copyFixtureToTemp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-sdlc-"));
  function copy(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        copy(path.join(src, entry), path.join(dest, entry));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }
  copy(fixtureRoot, tempRoot);
  return tempRoot;
}

function writeStartableTask(root, extra = "") {
  const taskPath = path.join(root, "topo", "tasks", "start-followup.tg");
  fs.writeFileSync(taskPath, `task task_start_followup {
  name "Start followup"
  description "Exercise the task-start workflow"
  satisfies [req_audit_persistence]
  acceptance_refs [ac_audit_survives_restart]
  verification_refs [verification_audit_persists]
  affects [cap_record_audit]
${extra}  priority medium
  work_type implementation
  status unclaimed
}
`, "utf8");
  return taskPath;
}

test("SDLC fixture parses and validates with no errors", () => {
  const ast = parsePath(fixtureRoot);
  const validation = validateWorkspace(ast);
  assert.equal(
    validation.ok,
    true,
    JSON.stringify(validation.errors, null, 2)
  );
});

test("resolver populates SDLC back-links", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);

  const pitch = resolved.graph.byKind.pitch.find((p) => p.id === "pitch_audit_logging");
  assert.ok(pitch);
  assert.deepEqual(pitch.requirements, ["req_audit_persistence"]);

  const requirement = resolved.graph.byKind.requirement.find((r) => r.id === "req_audit_persistence");
  assert.deepEqual(requirement.acceptanceCriteria, ["ac_audit_survives_restart"]);
  assert.deepEqual(requirement.tasks, ["task_implement_audit_writer"]);

  const task = resolved.graph.byKind.task.find((t) => t.id === "task_implement_audit_writer");
  assert.deepEqual(task.plans, ["plan_implement_audit_writer"]);

  const plan = resolved.graph.byKind.plan.find((p) => p.id === "plan_implement_audit_writer");
  assert.equal(plan.task.id, "task_implement_audit_writer");
  assert.deepEqual(plan.steps.map((step) => step.id), ["inspect_current_state", "implement_writer", "verify_runtime"]);

  const ac = resolved.graph.byKind.acceptance_criterion.find((a) => a.id === "ac_audit_survives_restart");
  assert.deepEqual(ac.tasks, ["task_implement_audit_writer"]);

  const cap = resolved.graph.byKind.capability.find((c) => c.id === "cap_record_audit");
  assert.ok(cap.affectedByPitches.includes("pitch_audit_logging"));
  assert.ok(cap.affectedByRequirements.includes("req_audit_persistence"));
  assert.ok(cap.affectedByTasks.includes("task_implement_audit_writer"));
  assert.ok(cap.affectedByBugs.includes("bug_audit_drops_silently"));

  const rule = resolved.graph.byKind.rule.find((r) => r.id === "rule_audit_required");
  assert.ok(rule.introducedByRequirements.includes("req_audit_persistence"));
  assert.ok(rule.violatedByBugs.includes("bug_audit_drops_silently"));

  const decision = resolved.graph.byKind.decision.find((d) => d.id === "decision_audit_format");
  assert.equal(decision.introducedByTasks?.length || 0, 0);
});

test("domain.members includes SDLC kinds", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const dom = resolved.graph.byKind.domain.find((d) => d.id === "dom_app");
  assert.ok(dom.members.pitches.includes("pitch_audit_logging"));
  assert.ok(dom.members.requirements.includes("req_audit_persistence"));
  assert.ok(dom.members.tasks.includes("task_implement_audit_writer"));
  assert.ok(dom.members.plans.includes("plan_implement_audit_writer"));
  assert.ok(dom.members.bugs.includes("bug_audit_drops_silently"));
});

test("query slice --pitch returns the focused subgraph", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "context-slice",
    pitchId: "pitch_audit_logging"
  });
  assert.equal(result.ok, true, JSON.stringify(result.validation, null, 2));
  assert.equal(result.artifact.focus.kind, "pitch");
  assert.equal(result.artifact.focus.id, "pitch_audit_logging");
  assert.ok(result.artifact.depends_on.requirements.includes("req_audit_persistence"));
  assert.ok(result.artifact.review_boundary.reasons.includes("pitch_scope"));
});

test("query slice --requirement / --task / --bug each return focused subgraphs", () => {
  const ast = parsePath(fixtureRoot);
  const reqResult = generateWorkspace(ast, { target: "context-slice", requirementId: "req_audit_persistence" });
  assert.equal(reqResult.ok, true);
  assert.equal(reqResult.artifact.focus.kind, "requirement");
  assert.ok(reqResult.artifact.depends_on.acceptance_criteria.includes("ac_audit_survives_restart"));

  const taskResult = generateWorkspace(ast, { target: "context-slice", taskId: "task_implement_audit_writer" });
  assert.equal(taskResult.ok, true);
  assert.equal(taskResult.artifact.focus.kind, "task");
  assert.equal(taskResult.artifact.summary.disposition, null);
  assert.ok(taskResult.artifact.depends_on.satisfies.includes("req_audit_persistence"));
  assert.ok(taskResult.artifact.depends_on.plans.includes("plan_implement_audit_writer"));

  const planResult = generateWorkspace(ast, { target: "context-slice", planId: "plan_implement_audit_writer" });
  assert.equal(planResult.ok, true);
  assert.equal(planResult.artifact.focus.kind, "plan");
  assert.equal(planResult.artifact.depends_on.task, "task_implement_audit_writer");
  assert.equal(planResult.artifact.steps.length, 3);

  const bugResult = generateWorkspace(ast, { target: "context-slice", bugId: "bug_audit_drops_silently" });
  assert.equal(bugResult.ok, true);
  assert.equal(bugResult.artifact.focus.kind, "bug");
  assert.ok(bugResult.artifact.depends_on.violates.includes("rule_audit_required"));
});

test("sdlc-board groups by status with SDLC summarizers", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const board = generateSdlcBoard(resolved.graph);
  assert.equal(board.type, "sdlc_board");
  assert.ok(board.board.task);
  assert.ok(board.board.plan);
  assert.ok(board.board.pitch);
  // task is in-progress, so it appears in that lane
  assert.equal(board.board.task["in-progress"].length, 1);
  assert.equal(board.board.plan.active.length, 1);
  assert.equal(board.board.bug.open.some((bug) => bug.id === "bug_legacy_audit_corruption"), false);
});

test("plans validate nested steps and complete DoD", () => {
  const valid = validateWorkspace(workspaceFromSource(`
task task_example {
  name "Example"
  description "Example task"
  priority medium
  work_type implementation
  status unclaimed
}
plan plan_example {
  name "Example plan"
  description "Example implementation plan"
  task task_example
  steps {
    step inspect status done description "Inspect current state."
    step verify status skipped description "Skipped with reason." outcome "No runtime surface."
  }
  status complete
}
`));
  assert.equal(valid.ok, true, JSON.stringify(valid.errors, null, 2));

  const invalid = validateWorkspace(workspaceFromSource(`
task task_example {
  name "Example"
  description "Example task"
  priority medium
  work_type implementation
  status unclaimed
}
plan plan_example {
  name "Example plan"
  description "Example implementation plan"
  task task_example
  steps {
    step inspect status pending description "Inspect current state."
    step inspect status waiting description "Duplicate and invalid."
  }
  status complete
}
`));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.message.includes("duplicate step")));
  assert.ok(invalid.errors.some((error) => error.message.includes("Invalid step status")));
  assert.ok(invalid.errors.some((error) => error.message.includes("requires all steps")));
});

test("task disposition validates unfinished task intent", () => {
  const valid = validateWorkspace(workspaceFromSource(`
task task_followup {
  name "Follow-up"
  description "Open follow-up task"
  priority medium
  work_type implementation
  disposition follow_up
  status unclaimed
}
`));
  assert.equal(valid.ok, true, JSON.stringify(valid.errors, null, 2));

  const invalid = validateWorkspace(workspaceFromSource(`
task task_followup {
  name "Follow-up"
  description "Open follow-up task"
  priority medium
  work_type implementation
  disposition maybe
  status unclaimed
}
`));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.message.includes("Invalid disposition")));
});

test("sdlc new and adopt use topo/sdlc while custom SDLC layouts remain valid", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const adoption = sdlcAdopt(tempRoot);
    assert.equal(adoption.ok, true, JSON.stringify(adoption, null, 2));
    assert.ok(fs.existsSync(path.join(tempRoot, "topo", "sdlc", "tasks")));
    assert.ok(fs.existsSync(path.join(tempRoot, "topo", "sdlc", "plans")));
    assert.ok(fs.existsSync(path.join(tempRoot, "topo", "sdlc", "_archive")));

    const created = scaffoldNew(tempRoot, "task", "root_convention");
    assert.equal(created.ok, true, JSON.stringify(created, null, 2));
    assert.equal(created.file, path.join(tempRoot, "topo", "sdlc", "tasks", "root_convention.tg"));
    assert.ok(fs.existsSync(created.file));

    const customLayoutFile = path.join(tempRoot, "topo", "tasks", "custom-layout.tg");
    fs.writeFileSync(customLayoutFile, `task task_custom_layout {
  name "Custom layout"
  description "Custom task location remains valid."
  priority medium
  work_type implementation
  status unclaimed
}
`, "utf8");
    const validation = validateWorkspace(parsePath(tempRoot));
    assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sdlc prep commit requires explicit disposition for open touched tasks", () => {
  const tempRoot = copyFixtureToTemp();
  const taskDir = path.join(tempRoot, "topo", "sdlc", "tasks");
  const taskFile = path.join(taskDir, "followups.tg");
  try {
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(taskFile, `task task_open_followup {
  name "Open follow-up"
  description "Open follow-up left by the branch."
  priority medium
  work_type implementation
  status unclaimed
}
`, "utf8");

    const ambiguous = runSdlcCommitPrep(tempRoot, {
      changedFiles: ["topo/sdlc/tasks/followups.tg"]
    });
    assert.equal(ambiguous.ok, false);
    assert.ok(ambiguous.errors.some((error) => error.includes("needs explicit disposition")));

    fs.writeFileSync(taskFile, `task task_open_followup {
  name "Open follow-up"
  description "Open follow-up left by the branch."
  priority medium
  work_type implementation
  disposition follow_up
  status unclaimed
}
`, "utf8");
    const classified = runSdlcCommitPrep(tempRoot, {
      changedFiles: ["topo/sdlc/tasks/followups.tg"]
    });
    assert.equal(classified.ok, true, JSON.stringify(classified, null, 2));
    assert.equal(classified.openTasks[0].disposition, "follow_up");

    fs.writeFileSync(taskFile, `task task_open_followup {
  name "Open follow-up"
  description "Open follow-up left by the branch."
  priority medium
  work_type implementation
  disposition blocker
  status unclaimed
}
`, "utf8");
    const blocking = runSdlcCommitPrep(tempRoot, {
      changedFiles: ["topo/sdlc/tasks/followups.tg"]
    });
    assert.equal(blocking.ok, false);
    assert.ok(blocking.errors.some((error) => error.includes("disposition blocker")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sdlc prep commit includes untracked task files before staging", () => {
  const tempRoot = copyFixtureToTemp();
  const taskDir = path.join(tempRoot, "topo", "sdlc", "tasks");
  const untrackedTask = path.join(taskDir, "untracked-followup.tg");
  try {
    assert.equal(childProcess.spawnSync("git", ["init"], { cwd: tempRoot }).status, 0);
    assert.equal(childProcess.spawnSync("git", ["add", "."], { cwd: tempRoot }).status, 0);
    assert.equal(childProcess.spawnSync("git", [
      "-c",
      "user.name=Topogram Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-m",
      "baseline"
    ], { cwd: tempRoot }).status, 0);

    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(untrackedTask, `task task_untracked_followup {
  name "Untracked follow-up"
  description "Untracked open task should still block commit prep."
  priority medium
  work_type implementation
  status unclaimed
}
`, "utf8");

    const result = runSdlcCommitPrep(tempRoot, {});
    assert.equal(result.ok, false, JSON.stringify(result, null, 2));
    assert.ok(result.changedFiles.includes("topo/sdlc/tasks/untracked-followup.tg"));
    assert.deepEqual(result.taskFiles, ["topo/sdlc/tasks/untracked-followup.tg"]);
    assert.equal(result.changedTasks[0].id, "task_untracked_followup");
    assert.ok(result.errors.some((error) => error.includes("needs explicit disposition")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sdlc audit surfaces draft records backed by done tasks", () => {
  const ast = workspaceFromSource(`
domain dom_app {
  name "App"
  description "App domain"
  status active
}

actor actor_dev {
  name "Developer"
  description "Developer"
  status active
}

capability cap_ship_feature {
  name "Ship Feature"
  description "Ship a feature"
  domain dom_app
  actors [actor_dev]
  status active
}

verification verification_feature {
  name "Feature Verification"
  description "Verifies the feature"
  validates [cap_ship_feature]
  method contract
  scenarios [unit]
  domain dom_app
  status active
}

requirement req_feature {
  name "Feature"
  description "A feature should exist"
  affects [cap_ship_feature]
  domain dom_app
  priority medium
  status draft
}

acceptance_criterion ac_feature_done {
  name "Feature Done"
  description "Given the feature, when tests run, then it passes"
  requirement req_feature
  status draft
}

task task_feature_done {
  name "Feature Done"
  description "Implement the feature"
  satisfies [req_feature]
  acceptance_refs [ac_feature_done]
  verification_refs [verification_feature]
  affects [cap_ship_feature]
  claimed_by [actor_dev]
  priority medium
  work_type implementation
  status done
}
`);
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const audit = auditWorkspace("<memory>", resolved);
  assert.equal(audit.type, "sdlc_audit");
  assert.equal(audit.ok, false);
  assert.equal(audit.counts.draftRequirementsWithCompletedTasks, 1);
  assert.equal(audit.counts.draftAcceptanceCriteriaWithCompletedTasks, 1);
  assert.equal(audit.counts.doneTasksWithDraftReferences, 1);
  assert.equal(audit.findings.draftRequirementsWithCompletedTasks[0].id, "req_feature");
  assert.equal(audit.findings.draftAcceptanceCriteriaWithCompletedTasks[0].id, "ac_feature_done");
});

test("sdlc-traceability-matrix walks pitch → req → AC → task → verification", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const matrix = generateSdlcTraceabilityMatrix(resolved.graph);
  assert.equal(matrix.type, "sdlc_traceability_matrix");
  assert.equal(matrix.rows.length, 1);
  const row = matrix.rows[0];
  assert.equal(row.pitch.id, "pitch_audit_logging");
  assert.equal(row.requirement.id, "req_audit_persistence");
  assert.equal(row.acceptance_criterion.id, "ac_audit_survives_restart");
  assert.deepEqual(row.tasks.map((t) => t.id), ["task_implement_audit_writer"]);
  assert.deepEqual(row.bugs.map((b) => b.id), ["bug_audit_drops_silently"]);
  assert.deepEqual(row.verifications.map((v) => v.id), ["verification_audit_persists"]);
});

test("sdlc-release-notes assembles approved pitches + done tasks + verified bugs", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const notes = generateSdlcReleaseNotes(resolved.graph, { appVersion: "1.0.0" });
  assert.equal(notes.type, "sdlc_release_notes");
  assert.equal(notes.app_version, "1.0.0");
  assert.equal(notes.counts.pitches, 1);
  assert.equal(notes.counts.bugs, 2);
  assert.deepEqual(notes.bugs.map((bug) => bug.id).sort(), ["bug_audit_drops_silently", "bug_legacy_audit_corruption"]);
});

test("legal transitions: task can move unclaimed → claimed → in-progress → done", () => {
  assert.deepEqual(legalTransitionsFor("task", "unclaimed"), ["claimed"]);
  assert.equal(validateTransition("task", "claimed", "in-progress").ok, true);
  assert.equal(validateTransition("task", "claimed", "done").ok, false);
  assert.equal(validateTransition("pitch", "draft", "approved").ok, false);
  assert.deepEqual(legalTransitionsFor("plan", "active"), ["complete", "superseded", "draft"]);
});

test("DoD: task in-progress fails when blocked_by has a non-done blocker", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const blockedTask = {
    kind: "task",
    id: "task_blocked_example",
    status: "claimed",
    workType: "implementation",
    claimedBy: ["actor_dev"],
    blockedBy: [{ id: "task_implement_audit_writer", target: { kind: "task", id: "task_implement_audit_writer" } }],
    satisfies: [],
    acceptanceRefs: []
  };
  const byId = new Map(resolved.graph.statements.map((s) => [s.id, s]));
  const dod = checkDoD("task", blockedTask, "in-progress", { byId });
  assert.equal(dod.satisfied, false);
  assert.ok(dod.errors[0].includes("blocked_by"));
});

test("DoD: approved acceptance criteria require Given/when/then wording", () => {
  const dod = checkDoD("acceptance_criterion", {
    kind: "acceptance_criterion",
    id: "ac_missing_bdd",
    description: "The behavior works",
    requirement: { id: "req_audit_persistence" }
  }, "approved", { byId: new Map() });
  assert.equal(dod.satisfied, false);
  assert.match(dod.errors.join("\n"), /Given\/When\/Then/);
});

test("DoD: done task validates referenced requirement, approved AC, and verification kinds", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const byId = new Map(resolved.graph.statements.map((s) => [s.id, s]));
  const badTask = {
    kind: "task",
    id: "task_bad_refs",
    status: "in-progress",
    claimedBy: ["actor_dev"],
    satisfies: [{ id: "cap_record_audit" }],
    acceptanceRefs: [{ id: "ac_missing" }],
    verificationRefs: [{ id: "req_audit_persistence" }]
  };
  const dod = checkDoD("task", badTask, "done", { byId });
  assert.equal(dod.satisfied, false);
  assert.match(dod.errors.join("\n"), /expected cap_record_audit to be requirement/);
  assert.match(dod.errors.join("\n"), /missing acceptance_criterion 'ac_missing'/);
  assert.match(dod.errors.join("\n"), /expected req_audit_persistence to be verification/);
});

test("transitionStatement rewrites .tg status surgically and appends history", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const before = fs.readFileSync(
      path.join(tempRoot, "topo", "tasks", "implement-audit-writer.tg"),
      "utf8"
    );
    assert.ok(before.includes("status in-progress"));

    const result = transitionStatement(tempRoot, "task_implement_audit_writer", "done", {
      actor: "agent-test",
      note: "test transition"
    });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(result.from, "in-progress");
    assert.equal(result.to, "done");

    const after = fs.readFileSync(
      path.join(tempRoot, "topo", "tasks", "implement-audit-writer.tg"),
      "utf8"
    );
    assert.ok(after.includes("status done"));
    // Other lines unchanged
    assert.ok(after.includes("name \"Implement audit writer\""));

    const history = JSON.parse(fs.readFileSync(path.join(tempRoot, "topo", "sdlc", ".topogram-sdlc-history.json"), "utf8"));
    assert.equal(history.task_implement_audit_writer.length, 1);
    assert.equal(history.task_implement_audit_writer[0].to, "done");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("plan helpers create, explain, and transition nested steps with history", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const createdDryRun = createPlan(tempRoot, "task_implement_audit_writer", "audit_followup", {});
    assert.equal(createdDryRun.ok, true, JSON.stringify(createdDryRun, null, 2));
    assert.equal(createdDryRun.dryRun, true);
    assert.ok(createdDryRun.content.includes("plan plan_audit_followup"));

    const created = createPlan(tempRoot, "task_implement_audit_writer", "audit_followup", { write: true });
    assert.equal(created.ok, true, JSON.stringify(created, null, 2));
    assert.ok(fs.existsSync(path.join(tempRoot, "topo", "sdlc", "plans", "audit_followup.tg")));

    const explained = explainPlan(tempRoot, "plan_implement_audit_writer");
    assert.equal(explained.ok, true, JSON.stringify(explained, null, 2));
    assert.equal(explained.next_step.id, "implement_writer");

    const dryRun = transitionPlanStep(tempRoot, "plan_implement_audit_writer", "implement_writer", "done", {
      actor: "agent-test"
    });
    assert.equal(dryRun.ok, true, JSON.stringify(dryRun, null, 2));
    assert.equal(dryRun.dryRun, true);

    const result = transitionPlanStep(tempRoot, "plan_implement_audit_writer", "implement_writer", "done", {
      write: true,
      actor: "agent-test",
      note: "step done"
    });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    const planFile = fs.readFileSync(path.join(tempRoot, "topo", "plans", "implement-audit-writer.tg"), "utf8");
    assert.ok(planFile.includes("step implement_writer status done"));
    const history = JSON.parse(fs.readFileSync(path.join(tempRoot, "topo", "sdlc", ".topogram-sdlc-history.json"), "utf8"));
    assert.equal(history["plan_implement_audit_writer#implement_writer"][0].to, "done");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("transitionStatement accepts an explicit topogram root without nested history", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const topogramRoot = path.join(tempRoot, "topo");
    const result = transitionStatement(topogramRoot, "task_implement_audit_writer", "done", {
      actor: "agent-test"
    });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(fs.existsSync(path.join(topogramRoot, "sdlc", ".topogram-sdlc-history.json")), true);
    assert.equal(fs.existsSync(path.join(topogramRoot, "topo")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sdlc check surfaces DoD warnings and ok when satisfied", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const result = checkWorkspace(fixtureRoot, resolved);
  assert.ok(result);
  // The fixture is valid — no DoD errors
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors, null, 2));
});

test("sdlc check defaults to configured topo workspace from project root", () => {
  const tempRoot = copyFixtureToTemp();
  try {
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
    const result = childProcess.spawnSync(process.execPath, [cliPath, "sdlc", "check", "--strict"], {
      cwd: tempRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        FORCE_COLOR: "0"
      }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout), {
      errors: [],
      ok: true,
      warnings: []
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("documented task query commands work through the CLI", () => {
  const slice = childProcess.spawnSync(process.execPath, [
    cliPath,
    "query",
    "slice",
    fixtureRoot,
    "--task",
    "task_implement_audit_writer",
    "--json"
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    }
  });
  assert.equal(slice.status, 0, slice.stderr || slice.stdout);
  assert.equal(JSON.parse(slice.stdout).focus.id, "task_implement_audit_writer");

  const plan = childProcess.spawnSync(process.execPath, [
    cliPath,
    "query",
    "single-agent-plan",
    fixtureRoot,
    "--mode",
    "modeling",
    "--task",
    "task_implement_audit_writer",
    "--json"
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    }
  });
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  assert.equal(JSON.parse(plan.stdout).type, "single_agent_plan");
});

test("SDLC query views report available, claimed, blockers, and proof gaps", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    writeStartableTask(tempRoot);
    const resolved = resolveWorkspace(parsePath(tempRoot));
    assert.equal(resolved.ok, true, JSON.stringify(resolved.validation, null, 2));

    const available = buildSdlcAvailablePayload(resolved.graph);
    assert.ok(available.unclaimed_tasks.some((task) => task.id === "task_start_followup"));

    const claimed = buildSdlcClaimedPayload(resolved.graph, "actor_dev");
    assert.ok(claimed.claimed_tasks.some((task) => task.id === "task_implement_audit_writer"));

    const blockers = buildSdlcBlockersPayload(resolved.graph, "task_start_followup");
    assert.deepEqual(blockers.blocked_tasks[0].unresolved_blockers, []);

    const gaps = buildSdlcProofGapsPayload(resolved.graph, "task_start_followup");
    assert.equal(gaps.gaps[0].ready_for_done, false);
    assert.match(gaps.gaps[0].errors.join("\n"), /claimed_by/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("SDLC query views work through the CLI", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    writeStartableTask(tempRoot);
    const available = childProcess.spawnSync(process.execPath, [
      cliPath,
      "query",
      "sdlc-available",
      tempRoot,
      "--json"
    ], { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
    assert.equal(available.status, 0, available.stderr || available.stdout);
    assert.ok(JSON.parse(available.stdout).unclaimed_tasks.some((task) => task.id === "task_start_followup"));

    const claimed = childProcess.spawnSync(process.execPath, [
      cliPath,
      "query",
      "sdlc-claimed",
      tempRoot,
      "--actor",
      "actor_dev",
      "--json"
    ], { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
    assert.equal(claimed.status, 0, claimed.stderr || claimed.stdout);
    assert.ok(JSON.parse(claimed.stdout).claimed_tasks.some((task) => task.id === "task_implement_audit_writer"));

    const proof = childProcess.spawnSync(process.execPath, [
      cliPath,
      "query",
      "sdlc-proof-gaps",
      tempRoot,
      "--task",
      "task_start_followup",
      "--json"
    ], { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
    assert.equal(proof.status, 0, proof.stderr || proof.stdout);
    assert.equal(JSON.parse(proof.stdout).gaps[0].ready_for_done, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sdlc start returns a read-only packet and does not mutate by default", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const taskFile = writeStartableTask(tempRoot);
    const before = fs.readFileSync(taskFile, "utf8");
    const result = startTask(tempRoot, "task_start_followup", { actor: "actor_dev" });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(result.type, "sdlc_start_packet");
    assert.equal(result.dryRun, true);
    assert.equal(result.can_start, true);
    assert.equal(fs.readFileSync(taskFile, "utf8"), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sdlc start --write claims and starts an unclaimed task through history", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const taskFile = writeStartableTask(tempRoot);
    const result = startTask(tempRoot, "task_start_followup", {
      actor: "actor_dev",
      write: true,
      note: "start test"
    });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(result.task.status, "in-progress");
    const taskText = fs.readFileSync(taskFile, "utf8");
    assert.match(taskText, /claimed_by \[actor_dev\]/);
    assert.match(taskText, /status in-progress/);
    const history = JSON.parse(fs.readFileSync(path.join(tempRoot, "topo", "sdlc", ".topogram-sdlc-history.json"), "utf8"));
    assert.deepEqual(history.task_start_followup.map((entry) => entry.to), ["claimed", "in-progress"]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sdlc start refuses blocked tasks and tasks claimed by another actor", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    writeStartableTask(tempRoot, "  blocked_by [task_implement_audit_writer]\n");
    const blocked = startTask(tempRoot, "task_start_followup", {
      actor: "actor_dev",
      write: true
    });
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /cannot be started/);

    const claimedByOther = startTask(fixtureRoot, "task_implement_audit_writer", {
      actor: "actor_other",
      write: true
    });
    assert.equal(claimedByOther.ok, false);
    assert.match(claimedByOther.error, /cannot be started/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("sdlc explain returns next_action and respects DoD", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const result = explain(fixtureRoot, resolved, "task_implement_audit_writer", {});
  assert.equal(result.ok, true);
  assert.equal(result.kind, "task");
  assert.equal(result.status, "in-progress");
  assert.ok(result.next_action);
  assert.equal(result.next_action.kind, "transition");
  assert.equal(result.next_action.to, "done");
  assert.equal(result.plans[0].id, "plan_implement_audit_writer");
});

test("archive bridge loads JSONL fixture entries", () => {
  const archive = loadArchive(fixtureRoot);
  assert.equal(archive.errors.length, 0);
  assert.equal(archive.entries.length, 1);
  assert.equal(archive.entries[0].id, "bug_legacy_audit_corruption");
  assert.equal(archive.entries[0].archived, true);
  assert.equal(archive.entries[0].severity, "medium");
});

test("resolver fails validation when archive JSONL is malformed", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    fs.mkdirSync(path.join(tempRoot, "topo", "sdlc", "_archive"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "topo", "sdlc", "_archive", "bugs-2027.jsonl"), "{not-json}\n", "utf8");
    const resolved = resolveWorkspace(parsePath(tempRoot));
    assert.equal(resolved.ok, false);
    assert.ok(resolved.validation.errors.some((error) => error.message.includes("Invalid SDLC archive")));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("archiveEligibleStatements identifies terminal-status artifacts", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const eligible = archiveEligibleStatements(resolved, {});
  // bug_audit_drops_silently is verified — eligible. task in-progress isn't.
  assert.ok(eligible.includes("bug_audit_drops_silently"));
  assert.ok(!eligible.includes("task_implement_audit_writer"));
});

test("archiveStatement moves a verified bug to year-bucketed JSONL", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const result = archiveStatement(tempRoot, "bug_audit_drops_silently", { by: "test" });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.match(result.archiveFile, /bugs-\d{4}\.jsonl$/);

    // Source file should be removed (was the only statement in the file)
    assert.equal(fs.existsSync(result.file), false);

    // Re-loading the workspace should still see the bug via the archive
    const archive = loadArchive(tempRoot);
    assert.ok(archive.entries.some((e) => e.id === "bug_audit_drops_silently"));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("archiveStatement moves a completed plan to year-bucketed JSONL", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    assert.equal(transitionPlanStep(tempRoot, "plan_implement_audit_writer", "implement_writer", "done", { write: true }).ok, true);
    assert.equal(transitionPlanStep(tempRoot, "plan_implement_audit_writer", "verify_runtime", "done", { write: true }).ok, true);
    const completed = transitionStatement(tempRoot, "plan_implement_audit_writer", "complete", {
      actor: "agent-test"
    });
    assert.equal(completed.ok, true, JSON.stringify(completed, null, 2));

    const result = archiveStatement(tempRoot, "plan_implement_audit_writer", { by: "test" });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.match(result.archiveFile, /plans-\d{4}\.jsonl$/);
    assert.equal(fs.existsSync(result.file), false);

    const archive = loadArchive(tempRoot);
    assert.ok(archive.entries.some((entry) => entry.id === "plan_implement_audit_writer"));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("archiveStatement accepts an explicit topogram root without nested archive", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const topogramRoot = path.join(tempRoot, "topo");
    const result = archiveStatement(topogramRoot, "bug_audit_drops_silently", { by: "test" });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.match(result.archiveFile, /topo\/sdlc\/_archive\/bugs-\d{4}\.jsonl$/);
    assert.equal(fs.existsSync(path.join(topogramRoot, "topo")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("unarchive restores archived bugs under the SDLC record root", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const archiveResult = archiveStatement(tempRoot, "bug_audit_drops_silently", { by: "test" });
    assert.equal(archiveResult.ok, true, JSON.stringify(archiveResult, null, 2));

    const result = unarchive(tempRoot, "bug_audit_drops_silently", {});
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(
      result.targetFile,
      path.join(tempRoot, "topo", "sdlc", "bugs", "bug_audit_drops_silently.tg")
    );
    assert.equal(fs.existsSync(result.targetFile), true);
    assert.equal(fs.existsSync(path.join(tempRoot, "topo", "bugs", "bug_audit_drops_silently.tg")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("unarchive rejects archived entry ids that would escape SDLC record roots", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const archiveRoot = path.join(tempRoot, "topo", "sdlc", "_archive");
    fs.mkdirSync(archiveRoot, { recursive: true });
    fs.writeFileSync(
      path.join(archiveRoot, "bugs-2027.jsonl"),
      `${JSON.stringify({
        id: "bug_../../escape",
        kind: "bug",
        name: "Traversal",
        description: "Malicious archived id",
        status: "verified",
        fields: {},
        transitions: [],
        archived: { at: "2027-01-01T00:00:00.000Z", by: "test" }
      })}\n`,
      "utf8"
    );

    const result = unarchive(tempRoot, "bug_../../escape", {});
    assert.equal(result.ok, false);
    assert.match(result.error, /not a safe Topogram identifier/);
    assert.equal(fs.existsSync(path.join(tempRoot, "topo", "sdlc", "escape.tg")), false);
    assert.equal(fs.existsSync(path.join(tempRoot, "topo", "sdlc", "bugs", "bug_..", "..", "escape.tg")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("archived bugs participate in traceability after active source is archived", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const archiveResult = archiveStatement(tempRoot, "bug_audit_drops_silently", { by: "test" });
    assert.equal(archiveResult.ok, true, JSON.stringify(archiveResult, null, 2));
    const resolved = resolveWorkspace(parsePath(tempRoot));
    assert.equal(resolved.ok, true, JSON.stringify(resolved.validation, null, 2));
    const matrix = generateSdlcTraceabilityMatrix(resolved.graph);
    assert.deepEqual(matrix.rows[0].bugs.map((bug) => bug.id), ["bug_audit_drops_silently"]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("release dry-run reports release notes + planned doc/archive mutations", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const result = runRelease(tempRoot, { appVersion: "1.0.0", dryRun: true });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.equal(result.dryRun, true);
    assert.equal(result.appVersion, "1.0.0");
    assert.ok(result.release_notes);
    assert.equal(result.release_notes.app_version, "1.0.0");
    assert.ok(result.archive.candidates.includes("bug_audit_drops_silently"));
    // Dry run — nothing actually written
    assert.equal(fs.existsSync(path.join(tempRoot, "topo", "bugs", "audit-drops-silently.tg")), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("release accepts an explicit topogram root without nested archive", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const topogramRoot = path.join(tempRoot, "topo");
    const result = runRelease(topogramRoot, { appVersion: "1.0.0", actor: "release-test" });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.ok(result.archive.candidates.includes("bug_audit_drops_silently"));
    assert.equal(fs.existsSync(path.join(topogramRoot, "sdlc", "_archive")), true);
    assert.equal(fs.existsSync(path.join(topogramRoot, "topo")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("release stamps only missing or older comparable document app versions", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const docsRoot = path.join(tempRoot, "topo", "docs", "reference");
    fs.mkdirSync(docsRoot, { recursive: true });
    const writeDoc = (slug, appVersionLine) => {
      const appVersion = appVersionLine ? `${appVersionLine}\n` : "";
      fs.writeFileSync(
        path.join(docsRoot, `${slug}.md`),
        `---\nid: doc_${slug.replace(/-/g, "_")}\nkind: reference\ntitle: "${slug}"\nstatus: draft\n${appVersion}---\n\nBody\n`,
        "utf8"
      );
    };
    writeDoc("missing", "");
    writeDoc("older", "app_version: 1.12.9");
    writeDoc("older-beta", "app_version: 1.12.0-beta");
    writeDoc("equal", "app_version: 1.13");
    writeDoc("newer", "app_version: v1.14.0");
    writeDoc("incomparable", "app_version: next-release");

    const result = runRelease(path.join(tempRoot, "topo"), { appVersion: "1.13.0", dryRun: true });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    const updated = result.document_app_version_updates
      .map((entry) => path.basename(entry.file, ".md"))
      .sort();
    assert.deepEqual(updated, ["missing", "older", "older-beta"]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("validator rejects invalid SDLC priority", () => {
  const source = `
pitch pitch_bad {
  name "Bad"
  description "Bad pitch"
  priority urgent
  status draft
}
`;
  const validation = validateWorkspace(workspaceFromSource(source));
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((e) => e.message.includes("Invalid priority 'urgent'")));
});

test("validator rejects invalid SDLC identifier prefix", () => {
  const source = `
task my_task {
  name "Bad"
  description "Bad task"
  priority medium
  work_type implementation
  claimed_by [actor_x]
  status claimed
}
actor actor_x { name "X" description "Y" status active }
`;
  const validation = validateWorkspace(workspaceFromSource(source));
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((e) => e.message.includes("Task identifier 'my_task' must match")));
});

test("validator enforces task claimed_by when status requires", () => {
  const source = `
task task_unclaimed_in_progress {
  name "Bad"
  description "No claimed_by"
  priority medium
  work_type implementation
  status in-progress
}
`;
  const validation = validateWorkspace(workspaceFromSource(source));
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((e) => e.message.includes("requires field 'claimed_by'")));
});

test("validator enforces verified bug requires fixed_in_verification", () => {
  const source = `
bug bug_unverified {
  name "X"
  description "Y"
  priority high
  severity high
  status verified
}
`;
  const validation = validateWorkspace(workspaceFromSource(source));
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((e) => e.message.includes("requires field 'fixed_in_verification'")));
});
