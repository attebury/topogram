import fs from "node:fs";

import { generateContextBundle } from "./bundle.js";
import { generateContextDigest } from "./digest.js";
import { generateContextDiff } from "./diff.js";
import { generateContextSlice } from "./slice.js";
import { jsonByteSize, jsonLineCount, percentOf } from "./shared.js";

function walkTopogramFiles(root) {
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = `${root}/${entry.name}`;
    if (entry.isDirectory()) {
      output.push(...walkTopogramFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".tg")) {
      output.push(absolutePath);
    }
  }
  return output;
}

function rawWorkspaceMetrics(graph) {
  const files = walkTopogramFiles(graph.root);
  let bytes = 0;
  let lines = 0;

  for (const file of files) {
    const contents = fs.readFileSync(file, "utf8");
    bytes += Buffer.byteLength(contents);
    lines += contents.split("\n").length;
  }

  return { bytes, lines };
}

function pickFirstId(items) {
  return (items || [])[0]?.id || null;
}

export function generateContextReport(graph, options = {}) {
  const rawWorkspace = rawWorkspaceMetrics(graph);
  const resolvedGraph = {
    bytes: jsonByteSize(graph),
    lines: jsonLineCount(graph)
  };
  const digest = generateContextDigest(graph);
  const digestMetrics = {
    bytes: jsonByteSize(digest),
    lines: jsonLineCount(digest)
  };

  const sliceRows = [];
  const capabilityId = pickFirstId(graph.byKind.capability);
  const workflowId = (graph.docs || []).find((doc) => doc.kind === "workflow")?.id || null;
  const projectionId = pickFirstId(graph.byKind.projection);
  const entityId = pickFirstId(graph.byKind.entity);

  for (const [kind, selector] of [
    ["capability", capabilityId ? { capabilityId } : null],
    ["workflow", workflowId ? { workflowId } : null],
    ["projection", projectionId ? { projectionId } : null],
    ["entity", entityId ? { entityId } : null]
  ]) {
    if (!selector) {
      continue;
    }
    const slice = generateContextSlice(graph, selector);
    const bytes = jsonByteSize(slice);
    sliceRows.push({
      kind,
      id: slice.focus.id,
      bytes,
      lines: jsonLineCount(slice),
      slice_vs_resolved_percent: percentOf(bytes, resolvedGraph.bytes)
    });
  }

  const bundleRows = [];
  for (const task of ["api", "ui", "db", "maintained-app"]) {
    const bundle = generateContextBundle(graph, { taskId: task });
    const bytes = jsonByteSize(bundle);
    bundleRows.push({
      task,
      bytes,
      lines: jsonLineCount(bundle),
      bundle_vs_resolved_percent: percentOf(bytes, resolvedGraph.bytes)
    });
  }

  let diffMetrics = null;
  if (options.fromTopogramPath) {
    const diff = generateContextDiff(graph, options);
    const bytes = jsonByteSize(diff);
    diffMetrics = {
      bytes,
      lines: jsonLineCount(diff),
      diff_vs_resolved_percent: percentOf(bytes, resolvedGraph.bytes),
      diff_vs_digest_percent: percentOf(bytes, digestMetrics.bytes)
    };
  }

  return {
    type: "context_report",
    version: 1,
    roots: {
      workspace: graph.root,
      baseline: options.fromTopogramPath || null
    },
    raw_workspace: rawWorkspace,
    resolved_graph: resolvedGraph,
    workspace_digest: {
      ...digestMetrics,
      digest_vs_resolved_percent: percentOf(digestMetrics.bytes, resolvedGraph.bytes)
    },
    slices: sliceRows,
    bundles: bundleRows,
    diff: diffMetrics
  };
}
