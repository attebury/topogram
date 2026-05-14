#!/usr/bin/env node
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cliPath = path.join(repoRoot, "engine", "src", "cli.js");

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertIncludes(text, phrase, label) {
  assert.equal(text.includes(phrase), true, `${label} should include ${phrase}`);
}

function listMarkdownFiles() {
  const files = ["README.md", "AGENTS.md", "CONTRIBUTING.md", "engine/README.md"];
  const stack = [path.join(repoRoot, "docs")];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path.relative(repoRoot, fullPath));
      }
    }
  }
  return files.sort();
}

function verifyLocalLinks(files) {
  const failures = [];
  const markdownLinkPattern = /\[[^\]]+\]\((?!https?:|mailto:|#)([^)]+)\)/g;
  for (const file of files) {
    const text = read(file);
    let match;
    while ((match = markdownLinkPattern.exec(text))) {
      const targetWithoutAnchor = match[1].split("#")[0];
      if (!targetWithoutAnchor) continue;
      const target = path.normalize(path.join(repoRoot, path.dirname(file), targetWithoutAnchor));
      if (!fs.existsSync(target)) {
        failures.push(`${file}: ${match[1]} -> ${path.relative(repoRoot, target)}`);
      }
    }
  }
  assert.deepEqual(failures, [], `Broken local markdown links:\n${failures.join("\n")}`);
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

function runCliJson(args, options = {}) {
  const result = runCli(args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(`Expected JSON from topogram ${args.join(" ")}:\n${result.stdout}\n${result.stderr}`);
  }
}

function createLocalStarter() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-docs-check-"));
  const projectRoot = path.join(root, "starter");
  const result = runCli([
    "copy",
    path.join(repoRoot, "engine", "tests", "fixtures", "templates", "hello-web"),
    projectRoot
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return projectRoot;
}

function verifyFirstRunCommandsMatchStarter() {
  const projectRoot = createLocalStarter();
  try {
    const scripts = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")).scripts || {};
    const requiredScripts = [
      "agent:brief",
      "doctor",
      "source:status",
      "template:explain",
      "generator:policy:check",
      "check",
      "generate",
      "verify"
    ];
    const greenfieldDocs = read("docs/start/greenfield-generate.md");
    const readme = read("README.md");
    const agentDocs = read("docs/agent-first-run.md");

    for (const script of requiredScripts) {
      assert.ok(scripts[script], `generated starter package.json should expose ${script}`);
      assert.match(greenfieldDocs, new RegExp(`npm run ${escapeRegExp(script)}`));
    }

    for (const script of ["agent:brief", "doctor", "source:status", "template:explain", "check", "generate", "verify"]) {
      assert.match(readme, new RegExp(`npm run ${escapeRegExp(script)}`));
      assert.match(agentDocs, new RegExp(`npm run ${escapeRegExp(script)}`));
    }
  } finally {
    fs.rmSync(path.dirname(projectRoot), { recursive: true, force: true });
  }
}

function createImportProject(sourceFixture, tracks) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-docs-import-"));
  const target = path.join(root, "imported");
  const payload = runCliJson([
    "extract",
    path.join(repoRoot, "engine", "tests", "fixtures", "import", sourceFixture),
    "--out",
    target,
    "--from",
    tracks,
    "--json"
  ]);
  return { root, target, payload };
}

function verifyBrownfieldDocsMatchExtractWorkflow() {
  const brownfieldDocs = read("docs/start/brownfield-import.md");
  const importJsonDocs = read("docs/reference/import-json.md");
  const requiredBrownfieldCommands = [
    "topogram extract ./existing-app --out ./imported-topogram --from db,api,ui",
    "topogram extract ./existing-cli --out ./imported-topogram --from cli",
    "topogram extractor list",
    "topogram extractor show @topogram/extractor-prisma-db",
    "topogram extractor policy pin @topogram/extractor-prisma-db@1",
    "topogram extract check",
    "topogram extract diff",
    "topogram extract plan",
    "topogram adopt --list",
    "topogram query extract-plan ./topo --json",
    "topogram query single-agent-plan ./topo --mode extract-adopt --json",
    "topogram query multi-agent-plan ./topo --mode extract-adopt --json",
    "topogram query work-packet ./topo --mode extract-adopt --lane adoption_operator --json",
    "topogram adopt bundle:task --dry-run",
    "topogram adopt widgets --dry-run",
    "topogram adopt bundle:cli --dry-run",
    "topogram adopt cli --dry-run",
    "topogram extract history --verify"
  ];
  for (const command of requiredBrownfieldCommands) {
    assertIncludes(brownfieldDocs, command, "brownfield extract/adopt docs");
  }
  for (const field of ["workspaceRoot", "candidateCounts", "extraction_context", "apiCapabilities", "uiWidgets", "cliCommands", "cliSurfaces"]) {
    assertIncludes(importJsonDocs, field, "extract/adopt JSON docs");
  }
  assertIncludes(importJsonDocs, "topogram query extract-plan ./topo --json", "extract/adopt JSON docs");
  assertIncludes(importJsonDocs, "topogram query work-packet ./topo --mode extract-adopt --lane adoption_operator --json", "extract/adopt JSON docs");

  const extractorList = runCli(["extractor", "list"]);
  assert.equal(extractorList.status, 0, extractorList.stderr || extractorList.stdout);
  assert.match(extractorList.stdout, /Package-backed extractors are listed for discovery/);
  assert.match(extractorList.stdout, /@topogram\/extractor-prisma-db/);

  const extractorShow = runCli(["extractor", "show", "@topogram/extractor-prisma-db"]);
  assert.equal(extractorShow.status, 0, extractorShow.stderr || extractorShow.stdout);
  assert.match(extractorShow.stdout, /Install: npm install -D @topogram\/extractor-prisma-db/);
  assert.match(extractorShow.stdout, /Policy: topogram extractor policy pin @topogram\/extractor-prisma-db@1/);

  const routeImport = createImportProject("route-fallback", "api,ui");
  try {
    assert.equal(routeImport.payload.workspaceRoot, path.join(routeImport.target, "topo"));
    assert.equal(routeImport.payload.tracks.includes("api"), true);
    assert.equal(routeImport.payload.tracks.includes("ui"), true);
    assert.ok(routeImport.payload.candidateCounts.apiCapabilities > 0);
    assert.ok(routeImport.payload.candidateCounts.uiWidgets > 0);
    assert.equal(
      routeImport.payload.nextCommands.includes("topogram query extract-plan ./topo"),
      true,
      "extract should recommend focused extract-plan query"
    );

    const check = runCliJson(["extract", "check", routeImport.target, "--json"]);
    assert.equal(check.workspaceRoot, path.join(routeImport.target, "topo"));
    assert.equal(check.extract.status, "clean");

    const diff = runCliJson(["extract", "diff", routeImport.target, "--json"]);
    assert.equal(diff.workspaceRoot, path.join(routeImport.target, "topo"));
    assert.equal(diff.candidateCounts.uiWidgets, routeImport.payload.candidateCounts.uiWidgets);

    const plan = runCliJson(["extract", "plan", routeImport.target, "--json"]);
    assert.equal(plan.bundles.some((bundle) => bundle.bundle === "task"), true);

    const adoptList = runCliJson(["adopt", "--list", routeImport.target, "--json"]);
    assert.equal(adoptList.selectors.some((selector) => selector.selector === "bundle:task"), true);
    assert.equal(adoptList.broadSelectors.some((selector) => selector.selector === "widgets"), true);

    const widgetsPreview = runCliJson(["adopt", "widgets", routeImport.target, "--dry-run", "--json"]);
    assert.equal(widgetsPreview.write, false);
    assert.equal(widgetsPreview.promotedCanonicalItems.some((item) => item.kind === "widget"), true);
    assert.deepEqual(widgetsPreview.writtenFiles, []);

    const importPlan = runCliJson(["query", "extract-plan", path.join(routeImport.target, "topo"), "--json"]);
    assert.equal(importPlan.type, "extract_plan_query");
    assert.equal(importPlan.summary.plan_present, true);

    const singleAgentPlan = runCliJson(["query", "single-agent-plan", path.join(routeImport.target, "topo"), "--mode", "extract-adopt", "--json"]);
    assert.equal(singleAgentPlan.type, "single_agent_plan");
    assert.equal(singleAgentPlan.extraction_context.type, "extraction_context");

    const multiAgentPlan = runCliJson(["query", "multi-agent-plan", path.join(routeImport.target, "topo"), "--mode", "extract-adopt", "--json"]);
    assert.equal(multiAgentPlan.type, "multi_agent_plan");
    assert.equal(multiAgentPlan.extraction_context.type, "extraction_context");

    const workPacket = runCliJson(["query", "work-packet", path.join(routeImport.target, "topo"), "--mode", "extract-adopt", "--lane", "adoption_operator", "--json"]);
    assert.equal(workPacket.type, "work_packet");
    assert.equal(workPacket.extraction_context.type, "extraction_context");

    const history = runCliJson(["extract", "history", routeImport.target, "--verify", "--json"]);
    assert.equal(history.verified, true);
    assert.equal(history.verification.auditOnly, true);
  } finally {
    fs.rmSync(routeImport.root, { recursive: true, force: true });
  }

  const cliImport = createImportProject("cli-basic", "cli");
  try {
    assert.equal(cliImport.payload.workspaceRoot, path.join(cliImport.target, "topo"));
    assert.ok(cliImport.payload.candidateCounts.cliCommands > 0);
    assert.ok(cliImport.payload.candidateCounts.cliSurfaces > 0);

    const cliPlan = runCliJson(["extract", "plan", cliImport.target, "--json"]);
    assert.equal(cliPlan.bundles.some((bundle) => bundle.bundle === "cli"), true);

    const cliAdoptList = runCliJson(["adopt", "--list", cliImport.target, "--json"]);
    assert.equal(cliAdoptList.selectors.some((selector) => selector.selector === "bundle:cli"), true);
    assert.equal(cliAdoptList.broadSelectors.some((selector) => selector.selector === "cli"), true);

    const cliPreview = runCliJson(["adopt", "bundle:cli", cliImport.target, "--dry-run", "--json"]);
    assert.equal(cliPreview.write, false);
    assert.equal(cliPreview.promotedCanonicalItems.some((item) => item.suggested_action === "promote_cli_surface"), true);
  } finally {
    fs.rmSync(cliImport.root, { recursive: true, force: true });
  }
}

function verifyAgentDocsMatchCoreWorkflow() {
  const agentDocs = read("docs/agent-first-run.md");
  const requiredCommands = [
    "topogram agent brief --json",
    "topogram query list --json",
    "topogram query show <name> --json",
    "topogram check --json",
    "topogram query slice ./topo --journey journey_greenfield_start_from_template --json",
    "topogram query extract-plan ./topo --json",
    "topogram sdlc explain <task-id> --json",
    "topogram sdlc prep commit . --base origin/main --head HEAD --json",
    "topogram sdlc gate . --base origin/main --head HEAD --require-adopted --json"
  ];
  for (const command of requiredCommands) {
    assertIncludes(agentDocs, command, "agent first-run docs");
  }

  const brief = runCliJson(["agent", "brief", path.join(repoRoot, "engine", "tests", "fixtures", "templates", "hello-web"), "--json"]);
  assert.equal(brief.type, "agent_brief");
  assert.ok(Array.isArray(brief.read_order));
  assert.ok(Array.isArray(brief.first_commands));

  const journeySlice = runCliJson(["query", "slice", ".", "--journey", "journey_greenfield_start_from_template", "--json"]);
  assert.equal(journeySlice.focus.kind, "journey");
  assert.equal(journeySlice.focus.id, "journey_greenfield_start_from_template");
  assert.ok(Array.isArray(journeySlice.steps));
}

function verifyDslDocsMatchJourneySyntax() {
  const dslDocs = read("docs/reference/dsl.md");
  const cliReference = read("docs/reference/cli.md");
  for (const phrase of [
    "`journey` statements model ordered user, maintainer, or agent workflows as graph",
    "step {",
    "alternate {",
    "Markdown journey documents are transitional/supporting drafts"
  ]) {
    assertIncludes(dslDocs, phrase, "DSL reference");
  }
  assertIncludes(cliReference, "topogram query slice ./topo --journey journey_greenfield_start_from_template --json", "CLI reference");
}

function verifyTemplateCatalogDocsMatchStarter() {
  const projectRoot = createLocalStarter();
  try {
    const concepts = read("docs/concepts/templates-catalog.md");
    const greenfield = read("docs/start/greenfield-generate.md");
    assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-template-files.json")), true);
    assert.equal(fs.existsSync(path.join(projectRoot, ".topogram-source.json")), false);
    for (const phrase of [
      ".topogram-template-files.json",
      ".topogram-source.json",
      "topogram template explain",
      "topogram template status",
      "topogram source status --local"
    ]) {
      assertIncludes(concepts, phrase, "template/catalog docs");
    }
    assertIncludes(greenfield, "pure Topogram source provenance", "greenfield docs");

    const explain = runCliJson(["template", "explain", projectRoot, "--json"]);
    assert.equal(explain.ok, true);
    assert.ok(explain.template);
  } finally {
    fs.rmSync(path.dirname(projectRoot), { recursive: true, force: true });
  }
}

function verifyCliReferenceMatchesHelp() {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  const cliReference = read("docs/reference/cli.md");
  for (const command of [
    "topogram init",
    "topogram copy",
    "topogram check",
    "topogram generate",
    "topogram emit",
    "topogram extract",
    "topogram agent brief",
    "topogram query list",
    "topogram widget check",
    "topogram template list",
    "topogram generator list",
    "topogram catalog list",
    "topogram sdlc policy explain"
  ]) {
    assert.match(help.stdout, new RegExp(escapeRegExp(command)));
    assert.match(cliReference, new RegExp(escapeRegExp(command)));
  }
}

function verifyStaleCommandNamesStayOut() {
  const publicDocs = listMarkdownFiles()
    .filter((file) => file !== "docs/release-matrix.md")
    .map((file) => [file, read(file)]);
  const forbidden = [
    "topogram template show",
    "topogram release:status",
    "topogram migrate workspace-folder",
    "topogram new",
    "topogram import",
    "topogram catalog copy"
  ];
  for (const [file, text] of publicDocs) {
    for (const phrase of forbidden) {
      assert.equal(text.includes(phrase), false, `${file} should not mention stale command ${phrase}`);
    }
  }
}

function main() {
  const files = listMarkdownFiles();
  verifyLocalLinks(files);
  verifyFirstRunCommandsMatchStarter();
  verifyBrownfieldDocsMatchExtractWorkflow();
  verifyAgentDocsMatchCoreWorkflow();
  verifyDslDocsMatchJourneySyntax();
  verifyTemplateCatalogDocsMatchStarter();
  verifyCliReferenceMatchesHelp();
  verifyStaleCommandNamesStayOut();
  console.log(`Docs check passed for ${files.length} markdown files.`);
}

main();
