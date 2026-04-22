#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const engineRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(engineRoot, "..");
const cliPath = path.join(engineRoot, "src", "cli.js");
const fixtureSource = path.join(engineRoot, "tests", "fixtures", "import", "incomplete-topogram", "topogram");
const fixtureBuilderPath = path.join(engineRoot, "scripts", "build-adoption-plan-fixture.mjs");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-agent-planning-"));
const workspaceRoot = path.join(tempRoot, "topogram");
fs.cpSync(fixtureSource, workspaceRoot, { recursive: true });

const buildResult = spawnSync(process.execPath, [
  fixtureBuilderPath,
  workspaceRoot,
  "--scenario",
  "projection-impact",
  "--json"
], { encoding: "utf8", cwd: repoRoot });

if (buildResult.status !== 0) {
  console.error(buildResult.stderr || buildResult.stdout || "Failed to build planning fixture");
  process.exit(1);
}

const fixturePayload = JSON.parse(buildResult.stdout);
const stagedTopogramRoot = fixturePayload.staged_topogram_root;
if (!stagedTopogramRoot || !fs.existsSync(stagedTopogramRoot)) {
  console.error("Planning fixture builder did not return a valid staged topogram root");
  process.exit(1);
}

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    cwd: engineRoot
  });
}

function runAndParse(args, expectedType) {
  const result = runCli(args);
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `Planning query failed: ${args.join(" ")}`);
    process.exit(1);
  }
  const parsed = JSON.parse(result.stdout);
  if (parsed.type !== expectedType) {
    console.error(`Expected ${expectedType}, received ${parsed.type}`);
    process.exit(1);
  }
  return parsed;
}

const nextAction = runAndParse([
  "query",
  "next-action",
  stagedTopogramRoot,
  "--mode",
  "import-adopt"
], "next_action_query");

const singleAgentPlan = runAndParse([
  "query",
  "single-agent-plan",
  stagedTopogramRoot,
  "--mode",
  "import-adopt"
], "single_agent_plan");

const multiAgentPlan = runAndParse([
  "query",
  "multi-agent-plan",
  stagedTopogramRoot,
  "--mode",
  "import-adopt"
], "multi_agent_plan");

const firstReviewLane = multiAgentPlan.lanes.find((lane) =>
  !["adoption_operator", "verification_runner"].includes(lane.role)
)?.lane_id || multiAgentPlan.lanes.find((lane) => lane.role === "adoption_operator")?.lane_id;
if (!firstReviewLane) {
  console.error("No lane was emitted in the multi-agent plan");
  process.exit(1);
}

const workPacket = runAndParse([
  "query",
  "work-packet",
  stagedTopogramRoot,
  "--mode",
  "import-adopt",
  "--lane",
  firstReviewLane
], "work_packet");

const laneStatus = runAndParse([
  "query",
  "lane-status",
  stagedTopogramRoot,
  "--mode",
  "import-adopt"
], "lane_status_query");

const handoffStatus = runAndParse([
  "query",
  "handoff-status",
  stagedTopogramRoot,
  "--mode",
  "import-adopt"
], "handoff_status_query");

console.log(JSON.stringify({
  type: "agent_planning_verification",
  workspace: stagedTopogramRoot,
  next_action: {
    mode: nextAction.mode,
    kind: nextAction.next_action?.kind || null
  },
  single_agent_plan: {
    mode: singleAgentPlan.mode,
    has_primary_artifacts: (singleAgentPlan.primary_artifacts || []).length > 0,
    sequence_steps: (singleAgentPlan.recommended_sequence || []).length
  },
  multi_agent_plan: {
    lane_count: multiAgentPlan.summary?.lane_count || 0,
    parallel_workstream_count: multiAgentPlan.summary?.parallel_workstream_count || 0,
    serialized_gate_count: multiAgentPlan.summary?.serialized_gate_count || 0
  },
  work_packet: {
    lane_id: workPacket.lane?.lane_id || null,
    role: workPacket.lane?.role || null,
    step_count: (workPacket.recommended_steps || []).length
  },
  lane_status: laneStatus.summary,
  handoff_status: handoffStatus.summary
}, null, 2));
