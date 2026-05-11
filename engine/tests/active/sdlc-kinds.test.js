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
import { checkWorkspace } from "../../src/sdlc/check.js";
import { explain } from "../../src/sdlc/explain.js";
import { runRelease } from "../../src/sdlc/release.js";
import { archiveStatement, archiveEligibleStatements } from "../../src/archive/archive.js";
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
  assert.ok(taskResult.artifact.depends_on.satisfies.includes("req_audit_persistence"));

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
  assert.ok(board.board.pitch);
  // task is in-progress, so it appears in that lane
  assert.equal(board.board.task["in-progress"].length, 1);
  assert.equal(board.board.bug.open.some((bug) => bug.id === "bug_legacy_audit_corruption"), false);
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

    const history = JSON.parse(fs.readFileSync(path.join(tempRoot, "topo", ".topogram-sdlc-history.json"), "utf8"));
    assert.equal(history.task_implement_audit_writer.length, 1);
    assert.equal(history.task_implement_audit_writer[0].to, "done");
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
    assert.equal(fs.existsSync(path.join(topogramRoot, ".topogram-sdlc-history.json")), true);
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

test("sdlc explain returns next_action and respects DoD", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const result = explain(fixtureRoot, resolved, "task_implement_audit_writer", {});
  assert.equal(result.ok, true);
  assert.equal(result.kind, "task");
  assert.equal(result.status, "in-progress");
  assert.ok(result.next_action);
  assert.ok(["transition", "work", "wait", "review", "none"].includes(result.next_action.kind));
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
    fs.writeFileSync(path.join(tempRoot, "topo", "_archive", "bugs-2027.jsonl"), "{not-json}\n", "utf8");
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

test("archiveStatement accepts an explicit topogram root without nested archive", () => {
  const tempRoot = copyFixtureToTemp();
  try {
    const topogramRoot = path.join(tempRoot, "topo");
    const result = archiveStatement(topogramRoot, "bug_audit_drops_silently", { by: "test" });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.match(result.archiveFile, /topo\/_archive\/bugs-\d{4}\.jsonl$/);
    assert.equal(fs.existsSync(path.join(topogramRoot, "topo")), false);
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
    assert.equal(fs.existsSync(path.join(topogramRoot, "_archive")), true);
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
