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

function createLocalStarter() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-docs-check-"));
  const projectRoot = path.join(root, "starter");
  const result = runCli([
    "new",
    projectRoot,
    "--template",
    path.join(repoRoot, "engine", "tests", "fixtures", "templates", "hello-web")
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
      assert.match(greenfieldDocs, new RegExp(`npm run ${script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }

    for (const script of ["agent:brief", "doctor", "source:status", "template:explain", "check", "generate", "verify"]) {
      assert.match(readme, new RegExp(`npm run ${script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(agentDocs, new RegExp(`npm run ${script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }
  } finally {
    fs.rmSync(path.dirname(projectRoot), { recursive: true, force: true });
  }
}

function verifyCliReferenceMatchesHelp() {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  const cliReference = read("docs/reference/cli.md");
  for (const command of [
    "topogram new",
    "topogram check",
    "topogram generate",
    "topogram emit",
    "topogram import",
    "topogram agent brief",
    "topogram query list",
    "topogram widget check",
    "topogram template list",
    "topogram generator list",
    "topogram catalog list",
    "topogram sdlc policy explain"
  ]) {
    assert.match(help.stdout, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(cliReference, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
}

function verifyStaleCommandNamesStayOut() {
  const publicDocs = listMarkdownFiles()
    .filter((file) => file !== "docs/release-matrix.md")
    .map((file) => [file, read(file)]);
  const forbidden = [
    "topogram template show",
    "topogram release:status",
    "topogram migrate workspace-folder"
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
  verifyCliReferenceMatchesHelp();
  verifyStaleCommandNamesStayOut();
  console.log(`Docs check passed for ${files.length} markdown files.`);
}

main();
