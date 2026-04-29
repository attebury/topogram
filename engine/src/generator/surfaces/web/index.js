import {
  generateUiContractDebug,
  generateUiContractGraph
} from "../contracts.js";
import { generatorDefaultsMap, getProjection } from "../shared.js";
import { generatorProfile } from "../../registry.js";
import { generateReactApp } from "./react.js";
import { generateSvelteKitApp } from "./sveltekit.js";
import {
  generateUiWebContract,
  generateUiWebDebug
} from "./ui-web-contract.js";

export function generateWebApp(graph, options = {}) {
  const projection = getProjection(graph, options.projectionId);
  const profile = generatorProfile(options.component?.generator?.id, null) || generatorDefaultsMap(projection).profile || "sveltekit";
  return profile === "react"
    ? generateReactApp(graph, options)
    : generateSvelteKitApp(graph, options);
}

export function generateWebTarget(target, graph, options = {}) {
  if (target === "ui-contract-graph") {
    return generateUiContractGraph(graph, options);
  }
  if (target === "ui-contract-debug") {
    return generateUiContractDebug(graph, options);
  }
  if (target === "ui-web-contract") {
    return generateUiWebContract(graph, options);
  }
  if (target === "ui-web-debug") {
    return generateUiWebDebug(graph, options);
  }
  if (target === "sveltekit-app") {
    return generateWebApp(graph, options);
  }

  throw new Error(`Unsupported web generator target '${target}'`);
}
