import { buildBackendParityEvidence } from "./backend-parity.js";
import { buildWebParityEvidence } from "./web-parity.js";

export function buildIssuesParityEvidence(graph) {
  const web = buildWebParityEvidence(graph, "proj_ui_web", "proj_ui_web_sveltekit");
  return {
    web,
    runtime: buildBackendParityEvidence(graph, "proj_api")
  };
}
