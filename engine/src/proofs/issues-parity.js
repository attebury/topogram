import { buildBackendParityEvidence } from "./backend-parity.js";
import { buildWebParityEvidence } from "./web-parity.js";

export function buildIssuesParityEvidence(graph) {
  const web = buildWebParityEvidence(graph, "proj_ui_web__react", "proj_ui_web__sveltekit");
  return {
    web,
    runtime: buildBackendParityEvidence(graph, "proj_api")
  };
}
