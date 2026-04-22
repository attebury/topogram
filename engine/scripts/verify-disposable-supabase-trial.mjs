#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(engineRoot, "..");
const cliPath = path.join(engineRoot, "src", "cli.js");
const sourceRoot = path.join(repoRoot, "trials", "supabase-express-api");
const disposableIgnoredDirs = [
  ".git",
  "topogram",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".yarn",
  "Pods",
  "DerivedData",
  "vendor",
  "target"
];

let cleanup = false;
let printRootOnly = false;
let tempRoot = null;

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === "--cleanup") {
    cleanup = true;
    continue;
  }
  if (arg === "--keep") {
    cleanup = false;
    continue;
  }
  if (arg === "--print-root") {
    printRootOnly = true;
    continue;
  }
  if (arg === "--temp-root") {
    tempRoot = process.argv[index + 1];
    if (!tempRoot) {
      console.error("Missing value for --temp-root");
      process.exit(1);
    }
    index += 1;
    continue;
  }
  console.error("Usage: node ./scripts/verify-disposable-supabase-trial.mjs [--temp-root <path>] [--keep] [--cleanup] [--print-root]");
  process.exit(1);
}

function localDateStamp() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveTempRoot() {
  if (tempRoot) {
    return path.resolve(tempRoot);
  }

  const base = path.join(os.tmpdir(), `topogram-brownfield-import-supabase-${localDateStamp()}`);
  if (!fs.existsSync(base)) {
    return base;
  }

  let suffix = 1;
  while (fs.existsSync(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function fail(message, detail = null) {
  console.error(message);
  if (detail) {
    console.error(detail);
  }
  console.error(`Disposable workspace preserved at: ${workspaceRoot}`);
  process.exit(1);
}

function runCli(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: engineRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    fail(`CLI step failed: node ./src/cli.js ${args.join(" ")}`, result.stderr || result.stdout);
  }

  return result;
}

function loadJson(relativePath) {
  const target = path.join(workspaceRoot, relativePath);
  if (!fs.existsSync(target)) {
    fail(`Expected file to exist: ${relativePath}`);
  }

  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function ensureFile(relativePath) {
  const target = path.join(workspaceRoot, relativePath);
  if (!fs.existsSync(target)) {
    fail(`Expected file to exist: ${relativePath}`);
  }
  return target;
}

function readAdoptionStatus() {
  return loadJson("topogram/candidates/reconcile/adoption-status.json");
}

const workspaceRoot = resolveTempRoot();
fs.cpSync(sourceRoot, workspaceRoot, { recursive: true });

for (const dirName of disposableIgnoredDirs) {
  fs.rmSync(path.join(workspaceRoot, dirName), { recursive: true, force: true });
}

for (const dirName of disposableIgnoredDirs) {
  if (fs.existsSync(path.join(workspaceRoot, dirName))) {
    fail(`Expected copied ${dirName}/ to be removed before import`);
  }
}

runCli(["import", "app", workspaceRoot, "--from", "db,api,ui,workflows", "--write"]);
runCli(["import", "docs", workspaceRoot, "--write"]);
runCli(["report", "gaps", workspaceRoot, "--write"]);
runCli(["reconcile", workspaceRoot, "--write"]);
runCli(["adoption", "status", workspaceRoot, "--write"]);
runCli(["reconcile", "adopt", "from-plan", workspaceRoot, "--write"]);
runCli(["reconcile", workspaceRoot, "--write"]);
runCli(["adoption", "status", workspaceRoot, "--write"]);

const executedReviewSelectors = [];
let adoptionStatus = readAdoptionStatus();
let previousSignature = JSON.stringify({
  next_bundle: adoptionStatus.next_bundle?.bundle || null,
  blocked_item_count: adoptionStatus.blocked_item_count,
  applied_item_count: adoptionStatus.applied_item_count,
  approved_review_groups: adoptionStatus.approved_review_groups || []
});

for (let iteration = 0; iteration < 12; iteration += 1) {
  const selector = adoptionStatus.next_bundle?.recommend_bundle_review_selector || null;
  if (!selector) {
    break;
  }

  executedReviewSelectors.push(selector);
  runCli(["reconcile", "adopt", selector, workspaceRoot, "--write"]);
  runCli(["reconcile", "adopt", "from-plan", workspaceRoot, "--write"]);
  runCli(["reconcile", workspaceRoot, "--write"]);
  runCli(["adoption", "status", workspaceRoot, "--write"]);

  adoptionStatus = readAdoptionStatus();
  const signature = JSON.stringify({
    next_bundle: adoptionStatus.next_bundle?.bundle || null,
    blocked_item_count: adoptionStatus.blocked_item_count,
    applied_item_count: adoptionStatus.applied_item_count,
    approved_review_groups: adoptionStatus.approved_review_groups || []
  });
  if (signature === previousSignature) {
    fail(`Disposable trial made no progress after selector ${selector}`);
  }
  previousSignature = signature;
}

const topogramRoot = path.join(workspaceRoot, "topogram");
if (!fs.existsSync(topogramRoot)) {
  fail("Fresh topogram/ was not created in disposable workspace");
}

adoptionStatus = readAdoptionStatus();
const reconcileReport = loadJson("topogram/candidates/reconcile/report.json");
const appCandidates = loadJson("topogram/candidates/app/candidates.json");
const uiFindings = loadJson("topogram/candidates/app/ui/findings.json");

if (adoptionStatus.next_bundle !== null) {
  const nextActionSelector = adoptionStatus.next_bundle?.next_action?.selector || null;
  const closureReason = adoptionStatus.next_bundle?.auth_closure_summary?.reason || adoptionStatus.next_bundle?.next_action?.reason || "No further closure path was surfaced.";
  fail(
    `Expected next_bundle to be null after disposable review/adopt loop; remaining bundle is ${adoptionStatus.next_bundle?.bundle || "unknown"} (${nextActionSelector || "no selector available"}).`,
    `Closure did not finish. ${closureReason}`
  );
}

if (adoptionStatus.blocked_item_count !== 0) {
  fail(`Expected blocked_item_count to be 0, received ${adoptionStatus.blocked_item_count}`);
}

if (!(Number(adoptionStatus.applied_item_count) > 0)) {
  fail(`Expected applied_item_count > 0, received ${adoptionStatus.applied_item_count}`);
}

if (!Array.isArray(appCandidates.db?.entities) || appCandidates.db.entities.length === 0) {
  fail("DB import no longer produced usable entity evidence");
}

if (!Array.isArray(appCandidates.api?.capabilities) || appCandidates.api.capabilities.length === 0) {
  fail("API import no longer produced usable capability evidence");
}

const hasBackendOnlyFinding = Array.isArray(uiFindings) && uiFindings.some((finding) => finding.kind === "backend_only_project");
if (!hasBackendOnlyFinding) {
  fail("UI import did not report an explicit backend-only/no-UI outcome");
}

const approvedReviewGroups = Array.isArray(reconcileReport.approved_review_groups)
  ? reconcileReport.approved_review_groups
  : [];
const workflowReviewGroups = Array.isArray(reconcileReport.workflow_review_groups)
  ? reconcileReport.workflow_review_groups
  : [];
if (approvedReviewGroups.length === 0 && workflowReviewGroups.length === 0) {
  fail("Maintained-boundary-related reconcile reporting disappeared for the Supabase import flow");
}

const requiredCanonicalDirs = [
  "topogram/entities",
  "topogram/capabilities",
  "topogram/shapes",
  "topogram/decisions",
  "topogram/docs/workflows"
];

for (const relativeDir of requiredCanonicalDirs) {
  const absoluteDir = path.join(workspaceRoot, relativeDir);
  if (!fs.existsSync(absoluteDir) || fs.readdirSync(absoluteDir).length === 0) {
    fail(`Expected canonical outputs under ${relativeDir}`);
  }
}

const inspectionFiles = [
  "topogram/candidates/app/report.md",
  "topogram/candidates/docs/import-report.md",
  "topogram/candidates/reports/gap-report.md",
  "topogram/candidates/reconcile/report.md",
  "topogram/candidates/reconcile/adoption-status.json"
];

for (const relativeFile of inspectionFiles) {
  ensureFile(relativeFile);
}

const summary = {
  type: "disposable_supabase_trial_verification",
  workspace: workspaceRoot,
  source_root: sourceRoot,
  cleanup_on_success: cleanup,
  executed_review_selectors: executedReviewSelectors,
  contract: {
    next_bundle: adoptionStatus.next_bundle,
    blocked_item_count: adoptionStatus.blocked_item_count,
    applied_item_count: adoptionStatus.applied_item_count
  },
  import_signals: {
    db_entities: appCandidates.db.entities.length,
    api_capabilities: appCandidates.api.capabilities.length,
    ui_backend_only: hasBackendOnlyFinding
  },
  reconcile_signals: {
    approved_review_groups: approvedReviewGroups.length,
    workflow_review_groups: workflowReviewGroups.length
  },
  inspection_files: inspectionFiles
};

if (cleanup) {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
}

if (printRootOnly) {
  process.stdout.write(`${workspaceRoot}\n`);
} else {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
