import { buildBackendParityEvidence } from "./backend-parity.js";
import { buildWebParityEvidence } from "./web-parity.js";

export function buildIssuesParityEvidence(graph) {
  const web = buildWebParityEvidence(graph, "proj_web_surface__react", "proj_web_surface__sveltekit");
  return {
    web,
    runtime: buildBackendParityEvidence(graph, "proj_api")
  };
}
