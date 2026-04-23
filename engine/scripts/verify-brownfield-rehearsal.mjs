#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const engineRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(engineRoot, "..");
const cliPath = path.join(engineRoot, "src", "cli.js");
const fixtureBuilderPath = path.join(engineRoot, "scripts", "build-adoption-plan-fixture.mjs");
const fixtureWorkspaceRoot = path.join(engineRoot, "tests", "fixtures", "import", "incomplete-topogram");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-brownfield-rehearsal-"));
const workspaceRoot = path.join(tempRoot, "incomplete-topogram");
fs.cpSync(fixtureWorkspaceRoot, workspaceRoot, { recursive: true });

const buildResult = spawnSync(process.execPath, [
  fixtureBuilderPath,
  workspaceRoot,
  "--scenario",
  "projection-impact",
  "--json"
], { encoding: "utf8", cwd: repoRoot });

if (buildResult.status !== 0) {
  console.error(buildResult.stderr || buildResult.stdout || "Failed to build brownfield rehearsal fixture");
  process.exit(1);
}

const fixturePayload = JSON.parse(buildResult.stdout);
const stagedTopogramRoot = fixturePayload.staged_topogram_root;
if (!stagedTopogramRoot || !fs.existsSync(stagedTopogramRoot)) {
  console.error("Brownfield rehearsal fixture builder did not return a valid staged topogram root");
  process.exit(1);
}

function runAndParse(args, expectedType) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    cwd: engineRoot
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `Brownfield rehearsal query failed: ${args.join(" ")}`);
    process.exit(1);
  }
  const parsed = JSON.parse(result.stdout);
  if (parsed.type !== expectedType) {
    console.error(`Expected ${expectedType}, received ${parsed.type}`);
    process.exit(1);
  }
  return parsed;
}

const importPlan = runAndParse([
  "query",
  "import-plan",
  stagedTopogramRoot
], "import_plan_query");

const reviewPacket = runAndParse([
  "query",
  "review-packet",
  stagedTopogramRoot,
  "--mode",
  "import-adopt"
], "review_packet_query");

const proceedDecision = runAndParse([
  "query",
  "proceed-decision",
  stagedTopogramRoot,
  "--mode",
  "import-adopt"
], "proceed_decision_query");

const nextAction = runAndParse([
  "query",
  "next-action",
  stagedTopogramRoot,
  "--mode",
  "import-adopt"
], "next_action_query");

if (reviewPacket.source !== "import-plan") {
  console.error(`Expected review-packet source import-plan, received ${reviewPacket.source}`);
  process.exit(1);
}

if (proceedDecision.decision !== "stop_no_go") {
  console.error(`Expected proceed-decision stop_no_go for staged import review with maintained no-go seams, received ${proceedDecision.decision}`);
  process.exit(1);
}

if (reviewPacket.recommended_query_family !== "import-plan") {
  console.error(`Expected review-packet recommended_query_family import-plan, received ${reviewPacket.recommended_query_family}`);
  process.exit(1);
}

if (proceedDecision.recommended_query_family !== "import-plan") {
  console.error(`Expected proceed-decision recommended_query_family import-plan, received ${proceedDecision.recommended_query_family}`);
  process.exit(1);
}

console.log(JSON.stringify({
  type: "brownfield_rehearsal_verification",
  workspace: stagedTopogramRoot,
  next_action: {
    kind: nextAction.next_action?.kind || null,
    recommended_query_family: nextAction.recommended_query_family || null
  },
  import_plan: {
    staged_item_count: importPlan.summary?.staged_item_count || 0,
    requires_human_review_count: importPlan.summary?.requires_human_review_count || 0,
    maintained_seam_review_status: importPlan.maintained_seam_review_summary?.status || null
  },
  review_packet: {
    source: reviewPacket.source,
    recommended_query_family: reviewPacket.recommended_query_family || null,
    operator_start: reviewPacket.operator_loop?.start_query_family || null
  },
  proceed_decision: {
    decision: proceedDecision.decision,
    recommended_query_family: proceedDecision.recommended_query_family || null,
    operator_start: proceedDecision.operator_loop?.start_query_family || null
  }
}, null, 2));
