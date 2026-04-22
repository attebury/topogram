#!/usr/bin/env node

import path from "node:path";

import { stableStringify } from "../src/format.js";
import { parsePath } from "../src/parser.js";
import { buildBackendParityEvidence } from "../src/proofs/backend-parity.js";
import { buildIssuesParityEvidence } from "../src/proofs/issues-parity.js";
import { buildWebParityEvidence } from "../src/proofs/web-parity.js";
import { resolveWorkspace } from "../src/resolver.js";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(workspaceRoot, "..");

function resolveExample(exampleName) {
  const workspacePath = path.join(repoRoot, "examples", exampleName, "topogram");
  const ast = parsePath(workspacePath);
  const resolved = resolveWorkspace(ast);
  if (!resolved.ok) {
    throw new Error(`Failed to resolve ${exampleName} workspace`);
  }
  return { workspacePath, graph: resolved.graph };
}

function verifyWebParity(exampleName, leftProjectionId, rightProjectionId) {
  const { workspacePath, graph } = resolveExample(exampleName);
  const evidence = buildWebParityEvidence(graph, leftProjectionId, rightProjectionId);
  if (!evidence.semanticParity) {
    throw new Error(`${exampleName} web parity failed`);
  }
  return {
    example: exampleName,
    workspace: workspacePath,
    seam: "ui_contract",
    projections: [leftProjectionId, rightProjectionId],
    profiles: [evidence.leftProfile, evidence.rightProfile],
    semantic_parity: evidence.semanticParity,
    screen_count: evidence.leftScreens.length
  };
}

function verifyBackendParity(exampleName, projectionId = "proj_api") {
  const { workspacePath, graph } = resolveExample(exampleName);
  const evidence = buildBackendParityEvidence(graph, projectionId);
  if (!evidence.sharedServerContract || !evidence.honoTargetMarker || !evidence.expressTargetMarker) {
    throw new Error(`${exampleName} backend parity failed`);
  }
  return {
    example: exampleName,
    workspace: workspacePath,
    seam: "server_contract",
    projection: projectionId,
    targets: ["hono-server", "express-server"],
    shared_server_contract: evidence.sharedServerContract,
    target_markers: {
      hono: evidence.honoTargetMarker,
      express: evidence.expressTargetMarker
    }
  };
}

const issues = resolveExample("issues");
const issuesEvidence = buildIssuesParityEvidence(issues.graph);
if (
  !issuesEvidence.web.semanticParity ||
  !issuesEvidence.runtime.sharedServerContract ||
  !issuesEvidence.runtime.honoTargetMarker ||
  !issuesEvidence.runtime.expressTargetMarker
) {
  throw new Error("issues parity verification failed");
}

const webParity = [
  {
    example: "issues",
    workspace: issues.workspacePath,
    seam: "ui_contract",
    projections: ["proj_ui_web", "proj_ui_web_sveltekit"],
    profiles: [issuesEvidence.web.leftProfile, issuesEvidence.web.rightProfile],
    semantic_parity: issuesEvidence.web.semanticParity,
    screen_count: issuesEvidence.web.leftScreens.length
  },
  verifyWebParity("content-approval", "proj_ui_web", "proj_ui_web_sveltekit"),
  verifyWebParity("todo", "proj_ui_web_react", "proj_ui_web")
];

const backendParity = [
  {
    example: "issues",
    workspace: issues.workspacePath,
    seam: "server_contract",
    projection: "proj_api",
    targets: ["hono-server", "express-server"],
    shared_server_contract: issuesEvidence.runtime.sharedServerContract,
    target_markers: {
      hono: issuesEvidence.runtime.honoTargetMarker,
      express: issuesEvidence.runtime.expressTargetMarker
    }
  },
  verifyBackendParity("content-approval"),
  verifyBackendParity("todo")
];

console.log(
  stableStringify({
    type: "parity_matrix_verification",
    repo: repoRoot,
    summary: {
      web_domains: webParity.length,
      backend_domains: backendParity.length,
      web_targets: ["react", "sveltekit"],
      backend_targets: ["hono-server", "express-server"]
    },
    web_parity: webParity,
    backend_parity: backendParity
  })
);
