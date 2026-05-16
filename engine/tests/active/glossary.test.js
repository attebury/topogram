import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseSource } from "../../src/parser.js";
import { validateWorkspace } from "../../src/validator.js";
import { generateWorkspace } from "../../src/generator/index.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = path.join(engineRoot, "src", "cli.js");

function workspaceFromSource(source) {
  return {
    root: "<memory>",
    files: [parseSource(source, "glossary-test.tg")],
    docs: []
  };
}

function glossarySource() {
  return `
domain dom_terms {
  name "Terms"
  description "Glossary test domain"
  status active
}

term term_context_slice {
  name "Context Slice"
  description "Focused graph packet"
  category agent_workflow
  domain dom_terms
  aliases [slice]
  status active
}

term term_agent_mode {
  name "Agent Mode"
  description "Work posture for a focused packet"
  category agent_workflow
  domain dom_terms
  related_terms [term_context_slice]
  status active
}

capability cap_query_context {
  name "Query Context"
  description "Read focused context"
  related_terms [term_context_slice term_agent_mode]
  domain dom_terms
  status active
}

rule rule_tests_prove_consumer_value {
  name "Tests Prove Consumer Value"
  description "Consumer-facing tests prove behavior"
  applies_to [cap_query_context]
  severity error
  status enforced
}

rule rule_maintainable_security_focused_code {
  name "Maintainable Security Focused Code"
  description "Code must be maintainable and security focused"
  applies_to [cap_query_context]
  severity error
  status enforced
}

rule rule_stateful_workflow_mutations_use_cli {
  name "Stateful Workflow Mutations Use CLI"
  description "Stateful workflow mutations use the CLI"
  applies_to [cap_query_context]
  severity error
  status enforced
}
`;
}

test("term category, domain, and related_terms validate and resolve", () => {
  const ast = workspaceFromSource(glossarySource());
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const result = generateWorkspace(ast, { target: "glossary" });
  assert.equal(result.ok, true, JSON.stringify(result.validation, null, 2));
  assert.equal(result.artifact.type, "glossary");
  const mode = result.artifact.terms.find((term) => term.id === "term_agent_mode");
  assert.equal(mode.category, "agent_workflow");
  assert.equal(mode.domain, "dom_terms");
  assert.deepEqual(mode.related_terms, ["term_context_slice"]);
});

test("context slices include explicit glossary terms, standing rules, and mode guidance", () => {
  const ast = workspaceFromSource(glossarySource());
  const result = generateWorkspace(ast, {
    target: "context-slice",
    capabilityId: "cap_query_context",
    modeId: "implementation"
  });
  assert.equal(result.ok, true, JSON.stringify(result.validation, null, 2));
  assert.deepEqual(result.artifact.depends_on.terms, ["term_agent_mode", "term_context_slice"]);
  assert.deepEqual(result.artifact.related.terms.map((term) => term.id), ["term_agent_mode", "term_context_slice"]);
  assert.deepEqual(result.artifact.standing_rules.map((rule) => rule.id), [
    "rule_maintainable_security_focused_code",
    "rule_stateful_workflow_mutations_use_cli",
    "rule_tests_prove_consumer_value"
  ]);
  assert.equal(result.artifact.agent_guidance.mode, "implementation");
  assert.ok(result.artifact.agent_guidance.next_queries.some((command) => command.includes("--mode implementation")));
});

test("emit glossary writes and checks markdown output", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-glossary-"));
  const topo = path.join(root, "topo");
  const outDir = path.join(root, "docs", "concepts");
  fs.mkdirSync(topo, { recursive: true });
  fs.writeFileSync(path.join(topo, "glossary.tg"), glossarySource(), "utf8");

  childProcess.execFileSync(process.execPath, [cliPath, "emit", "glossary", topo, "--write", "--out-dir", outDir], {
    cwd: root,
    stdio: "pipe"
  });
  const glossaryPath = path.join(outDir, "glossary.md");
  const markdown = fs.readFileSync(glossaryPath, "utf8");
  assert.match(markdown, /# Glossary/);
  assert.match(markdown, /## Agent Workflow/);
  assert.match(markdown, /### Context Slice/);

  const checkOutput = childProcess.execFileSync(process.execPath, [cliPath, "emit", "glossary", topo, "--check", glossaryPath], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe"
  });
  assert.match(checkOutput, /is up to date/);
});

test("slice markdown shows agent guidance, standing rules, and glossary terms", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-glossary-slice-"));
  const topo = path.join(root, "topo");
  fs.mkdirSync(topo, { recursive: true });
  fs.writeFileSync(path.join(topo, "glossary.tg"), glossarySource(), "utf8");

  const result = childProcess.spawnSync(process.execPath, [
    cliPath,
    "query",
    "slice",
    topo,
    "--mode",
    "implementation",
    "--capability",
    "cap_query_context",
    "--format",
    "markdown"
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /## Agent Guidance/);
  assert.match(result.stdout, /Mode: implementation/);
  assert.match(result.stdout, /## Standing Rules/);
  assert.match(result.stdout, /rule_tests_prove_consumer_value/);
  assert.match(result.stdout, /## Glossary Terms/);
  assert.match(result.stdout, /term_context_slice/);
});
