import { generateApiContractGraph } from "../../generator/api.js";

export function buildApiRealization(graph, options = {}) {
  return generateApiContractGraph(graph, options);
}
