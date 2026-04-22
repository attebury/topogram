#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { runWorkflow } from "../src/workflows.js";
import { stableStringify } from "../src/format.js";

const engineRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(engineRoot, "..");
const examplesRoot = path.join(repoRoot, "examples");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeArtifact(filePath, contents) {
  ensureDir(filePath);
  const value = typeof contents === "string" ? contents : `${stableStringify(contents)}\n`;
  fs.writeFileSync(filePath, value, "utf8");
}

function discoverExampleTopograms(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  return fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name, "topogram"))
    .filter((topogramPath) => fs.existsSync(topogramPath) && fs.statSync(topogramPath).isDirectory())
    .sort();
}

const targetArgs = process.argv.slice(2);
const discoveredTopograms = discoverExampleTopograms(examplesRoot);
const selectedTopograms = targetArgs.length === 0
  ? discoveredTopograms
  : targetArgs.map((value) => path.resolve(value)).filter((candidate) => {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return true;
      }
      const withTopogram = path.join(candidate, "topogram");
      return fs.existsSync(withTopogram) && fs.statSync(withTopogram).isDirectory();
    }).map((candidate) => {
      if (path.basename(candidate) === "topogram") {
        return candidate;
      }
      return path.join(candidate, "topogram");
    });

if (selectedTopograms.length === 0) {
  console.error("No example topogram workspaces found.");
  process.exit(1);
}

const summaries = [];
for (const topogramPath of selectedTopograms) {
  const result = runWorkflow("generate-journeys", topogramPath);
  for (const [relativePath, contents] of Object.entries(result.files || {})) {
    writeArtifact(path.join(topogramPath, relativePath), contents);
  }
  summaries.push({
    example: path.basename(path.dirname(topogramPath)),
    topogram: topogramPath,
    generated_draft_count: result.summary.generated_draft_count,
    canonical_journey_count: result.summary.canonical_journey_count,
    report: path.join(topogramPath, "candidates", "docs", "journeys", "import-report.md")
  });
}

console.log(
  stableStringify({
    type: "generate_missing_journeys",
    examples_processed: summaries.length,
    examples: summaries
  })
);
