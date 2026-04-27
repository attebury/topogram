#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { parsePath } from "../src/parser.js";
import { resolveWorkspace } from "../src/resolver.js";
import { generateWorkspace } from "../src/generator.js";
import { stableStringify } from "../src/format.js";
import { formatValidationErrors, validateWorkspace } from "../src/validator.js";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(workspaceRoot, "..");
const issuesRoot = path.join(repoRoot, "examples", "generated", "issues");
const issuesPath = path.join(issuesRoot, "topogram");
const expectedRoot = path.join(issuesRoot, "topogram", "tests", "fixtures", "expected");
const issuesAppsRoot = path.join(issuesRoot, "apps", "local-stack");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, "utf8");
}

function writeText(filePath, value) {
  ensureDir(filePath);
  if (value === "" || value.endsWith("\n")) {
    fs.writeFileSync(filePath, value, "utf8");
  } else {
    fs.writeFileSync(filePath, `${value}\n`, "utf8");
  }
}

function writeBundle(dirPath, files) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  for (const [relativePath, contents] of Object.entries(files)) {
    writeText(path.join(dirPath, relativePath), contents);
  }
}

function assertOk(result, label) {
  if (!result.ok) {
    throw new Error(`${label} failed:\n${formatValidationErrors(result.validation)}`);
  }
  return result.artifact;
}

const issuesAst = parsePath(issuesPath);
const validation = validateWorkspace(issuesAst);
if (!validation.ok) {
  throw new Error(`Issues example failed validation:\n${formatValidationErrors(validation)}`);
}

const resolved = resolveWorkspace(issuesAst);
if (!resolved.ok) {
  throw new Error(`Issues example failed resolution:\n${formatValidationErrors(resolved.validation)}`);
}

writeJson(path.join(expectedRoot, "issues.resolve.json"), resolved.graph);

const jsonTargets = [
  [["docs-index.json"], { target: "docs-index" }],
  [["verification-plan.json"], { target: "verification-plan" }],
  [["proj_ui_web__react.ui-web-contract.json"], { target: "ui-web-contract", projectionId: "proj_ui_web__react" }],
  [["proj_ui_web__sveltekit.ui-web-contract.json"], { target: "ui-web-contract", projectionId: "proj_ui_web__sveltekit" }],
  [["proj_db_sqlite.db-schema-snapshot.json"], { target: "db-schema-snapshot", projectionId: "proj_db_sqlite" }],
  [["runtime-check-plan.json"], { target: "runtime-check-plan" }],
  [["app-bundle-plan.json"], { target: "app-bundle-plan" }],
  [["openapi.json"], { target: "openapi" }]
];

for (const [[fileName], options] of jsonTargets) {
  writeJson(path.join(expectedRoot, fileName), assertOk(generateWorkspace(issuesAst, options), fileName));
}

const textTargets = [
  [["issues.docs.md"], { target: "docs" }]
  ,
  [["verification-checklist.md"], { target: "verification-checklist" }]
];

for (const [[fileName], options] of textTargets) {
  writeText(path.join(expectedRoot, fileName), assertOk(generateWorkspace(issuesAst, options), fileName));
}

const bundleTargets = [
  [["hono-server"], { target: "hono-server", projectionId: "proj_api" }],
  [["express-server"], { target: "express-server", projectionId: "proj_api" }],
  [["react-app"], { target: "sveltekit-app", projectionId: "proj_ui_web__react" }],
  [["sveltekit-app"], { target: "sveltekit-app", projectionId: "proj_ui_web__sveltekit" }],
  [["runtime-check-bundle"], { target: "runtime-check-bundle" }],
  [["app-bundle"], { target: "app-bundle" }]
];

for (const [[dirName], options] of bundleTargets) {
  writeBundle(path.join(expectedRoot, dirName), assertOk(generateWorkspace(issuesAst, options), dirName));
}

const localStackBundle = assertOk(generateWorkspace(issuesAst, { target: "app-bundle" }), "apps/local-stack");
for (const [relativePath, contents] of Object.entries(localStackBundle)) {
  writeText(path.join(issuesAppsRoot, relativePath), contents);
}

console.log("Refreshed Issues example expected fixtures.");
