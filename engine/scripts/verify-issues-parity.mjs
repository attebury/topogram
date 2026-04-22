#!/usr/bin/env node

import path from "node:path";

import { parsePath } from "../src/parser.js";
import { resolveWorkspace } from "../src/resolver.js";
import { buildIssuesParityEvidence } from "../src/proofs/issues-parity.js";
import { stableStringify } from "../src/format.js";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(workspaceRoot, "..");
const issuesPath = path.join(repoRoot, "examples", "issues", "topogram");

const issuesAst = parsePath(issuesPath);
const resolved = resolveWorkspace(issuesAst);
if (!resolved.ok) {
  console.error("Failed to resolve issues workspace");
  process.exit(1);
}

const evidence = buildIssuesParityEvidence(resolved.graph);
if (!evidence.web.semanticParity) {
  console.error("Issues web parity failed");
  process.exit(1);
}
if (!evidence.runtime.sharedServerContract || !evidence.runtime.honoTargetMarker || !evidence.runtime.expressTargetMarker) {
  console.error("Issues runtime parity failed");
  process.exit(1);
}

console.log(
  stableStringify({
    type: "issues_parity_verification",
    workspace: issuesPath,
    web: {
      profiles: [evidence.web.leftProfile, evidence.web.rightProfile],
      screen_count: evidence.web.leftScreens.length,
      semantic_parity: evidence.web.semanticParity
    },
    runtime: {
      targets: ["hono-server", "express-server"],
      shared_server_contract: evidence.runtime.sharedServerContract,
      target_markers: {
        hono: evidence.runtime.honoTargetMarker,
        express: evidence.runtime.expressTargetMarker
      }
    }
  })
);
