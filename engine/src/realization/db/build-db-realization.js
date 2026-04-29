import {
  buildDbProjectionContract,
  dbProjectionCandidates,
  getProjection
} from "../../generator/surfaces/databases/shared.js";

export function buildDbRealization(graph, options = {}) {
  if (options.projectionId) {
    return buildDbProjectionContract(graph, getProjection(graph, options.projectionId));
  }

  const output = {};
  for (const projection of dbProjectionCandidates(graph)) {
    output[projection.id] = buildDbProjectionContract(graph, projection);
  }
  return output;
}
