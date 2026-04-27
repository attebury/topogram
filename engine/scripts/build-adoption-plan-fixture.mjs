#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { stableStringify } from "../src/format.js";
import { runWorkflow } from "../src/workflows.js";

function printUsage() {
  console.log("Usage: node ./scripts/build-adoption-plan-fixture.mjs <path> [--scenario <base|projection-impact>] [--out-dir <path>] [--json]");
}

function normalizeTopogramPath(inputPath) {
  const absolute = path.resolve(inputPath);
  if (path.basename(absolute) === "topogram") {
    return absolute;
  }
  const candidate = path.join(absolute, "topogram");
  return fs.existsSync(candidate) ? candidate : absolute;
}

function normalizeWorkspacePaths(inputPath) {
  const topogramRoot = normalizeTopogramPath(inputPath);
  const candidateWorkspaceRoot = path.dirname(topogramRoot);
  const siblingEntries = fs.existsSync(candidateWorkspaceRoot)
    ? fs.readdirSync(candidateWorkspaceRoot).filter((entry) => entry !== ".DS_Store")
    : [];
  const hasSiblingEvidence =
    path.basename(topogramRoot) === "topogram" &&
    siblingEntries.some((entry) => entry !== "topogram");
  return {
    sourceTopogramRoot: topogramRoot,
    sourceWorkspaceRoot: hasSiblingEvidence ? candidateWorkspaceRoot : topogramRoot
  };
}

function writeWorkflowFiles(result, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [relativePath, contents] of Object.entries(result.files || {})) {
    if (!relativePath.startsWith("candidates/reconcile/")) {
      continue;
    }
    const destination = path.join(outDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(
      destination,
      typeof contents === "string" ? contents : `${stableStringify(contents)}\n`,
      "utf8"
    );
  }
}

function injectProjectionImpactScenario(topogramRoot) {
  const projectionsRoot = path.join(topogramRoot, "projections");
  fs.mkdirSync(projectionsRoot, { recursive: true });
  fs.writeFileSync(
    path.join(projectionsRoot, "proj-ui-shared.tg"),
    `projection proj_ui_shared {
  name "Task Shared UI"
  description "Minimal shared UI projection for projection impact tests"

  platform ui_shared
  realizes [cap_create_task]
  outputs [ui_contract]

  ui_screens {
    screen task_create kind form title "Create Task" input_shape shape_input_create_task submit cap_create_task success_navigate task_create
  }

  status active
}
`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(projectionsRoot, "proj-api.tg"),
    `projection proj_api {
  name "API"
  description "Minimal API projection for projection impact tests"
  platform dotnet
  realizes [cap_create_task]
  outputs [endpoints]

  http {
    cap_create_task method POST path /tasks success 201 auth user request body
  }

  status active
}
`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(projectionsRoot, "proj-ui-web--react.tg"),
    `projection proj_ui_web__react {
  name "Web UI"
  description "Minimal web UI projection for projection impact tests"
  platform ui_web
  realizes [proj_ui_shared, cap_create_task]
  outputs [ui_contract]

  ui_routes {
    screen task_create path /tasks/new
  }

  ui_web {
    screen task_create present page
  }

  generator_defaults {
    profile react
    language typescript
    styling css
  }

  status active
}
`,
    "utf8"
  );
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help")) {
  printUsage();
  process.exit(args.includes("--help") ? 0 : 1);
}

const inputPath = args[0];
const outDirIndex = args.indexOf("--out-dir");
const scenarioIndex = args.indexOf("--scenario");
const outputJson = args.includes("--json");
const requestedOutDir = outDirIndex >= 0 ? path.resolve(args[outDirIndex + 1]) : null;
const scenario = scenarioIndex >= 0 ? String(args[scenarioIndex + 1] || "base") : "base";

const { sourceTopogramRoot, sourceWorkspaceRoot } = normalizeWorkspacePaths(inputPath);
if (!fs.existsSync(sourceTopogramRoot)) {
  throw new Error(`Topogram path '${sourceTopogramRoot}' does not exist.`);
}

const stageRoot = requestedOutDir || fs.mkdtempSync(path.join(os.tmpdir(), "topogram-adoption-plan-"));
const stagedWorkspaceRoot = sourceWorkspaceRoot === sourceTopogramRoot ? path.join(stageRoot, "topogram") : stageRoot;
const stagedTopogramRoot = sourceWorkspaceRoot === sourceTopogramRoot
  ? stagedWorkspaceRoot
  : path.join(stagedWorkspaceRoot, "topogram");

fs.rmSync(stagedWorkspaceRoot, { recursive: true, force: true });
fs.mkdirSync(path.dirname(stagedWorkspaceRoot), { recursive: true });
fs.cpSync(sourceWorkspaceRoot, stagedWorkspaceRoot, { recursive: true });

if (scenario === "projection-impact") {
  injectProjectionImpactScenario(stagedTopogramRoot);
} else if (scenario !== "base") {
  throw new Error(`Unsupported scenario '${scenario}'.`);
}

const reconcileResult = runWorkflow("reconcile", stagedTopogramRoot);
writeWorkflowFiles(reconcileResult, reconcileResult.defaultOutDir);

const payload = {
  type: "adoption_plan_fixture_build",
  source_topogram_root: sourceTopogramRoot,
  source_workspace_root: sourceWorkspaceRoot,
  staged_workspace_root: stagedWorkspaceRoot,
  staged_topogram_root: stagedTopogramRoot,
  scenario,
  adoption_plan_path: path.join(stagedTopogramRoot, "candidates", "reconcile", "adoption-plan.json"),
  agent_adoption_plan_path: path.join(stagedTopogramRoot, "candidates", "reconcile", "adoption-plan.agent.json"),
  reconcile_report_path: path.join(stagedTopogramRoot, "candidates", "reconcile", "report.json")
};

console.log(outputJson ? stableStringify(payload) : payload.agent_adoption_plan_path);
