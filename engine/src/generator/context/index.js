import { generateContextBundle } from "./bundle.js";
import { generateContextDigest } from "./digest.js";
import { generateContextDiff } from "./diff.js";
import { generateContextReport } from "./report.js";
import { generateContextSlice } from "./slice.js";
import { generateContextTaskMode } from "./task-mode.js";

export function generateContextTarget(target, graph, options = {}) {
  if (target === "context-digest") {
    return generateContextDigest(graph, options);
  }
  if (target === "context-diff") {
    return generateContextDiff(graph, options);
  }
  if (target === "context-slice") {
    return generateContextSlice(graph, options);
  }
  if (target === "context-bundle") {
    return generateContextBundle(graph, options);
  }
  if (target === "context-report") {
    return generateContextReport(graph, options);
  }
  if (target === "context-task-mode") {
    return generateContextTaskMode(graph, options);
  }

  throw new Error(`Unsupported context target '${target}'`);
}
