import {
  generateUiContractDebug,
  generateUiContractGraph
} from "../contracts.js";
import { generatorDefaultsMap, getProjection } from "../shared.js";
import { generateWithComponentGenerator } from "../../adapters.js";
import { generatorProfile } from "../../registry.js";
import { generateReactApp } from "./react.js";
import { generateSvelteKitApp } from "./sveltekit.js";
import { generateVanillaWebApp } from "./vanilla.js";
import {
  generateUiSurfaceContract,
  generateUiSurfaceDebug
} from "./ui-surface-contract.js";

export function generateWebApp(graph, options = {}) {
  const projection = getProjection(graph, options.projectionId);
  const runtime = options.runtime || options.component;
  if (runtime?.generator?.id) {
    return generateWithComponentGenerator({
      graph,
      projection,
      runtime,
      component: runtime,
      topology: options.topology || null,
      implementation: options.implementation || null,
      options: { ...options, projectionId: projection.id }
    }).files;
  }
  const profile = generatorProfile(runtime?.generator?.id, null) || generatorDefaultsMap(projection).profile || "sveltekit";
  if (profile === "vanilla") {
    return generateVanillaWebApp(graph, options);
  }
  return profile === "react" ? generateReactApp(graph, options) : generateSvelteKitApp(graph, options);
}

export function generateWebTarget(target, graph, options = {}) {
  if (target === "ui-contract-graph") {
    return generateUiContractGraph(graph, options);
  }
  if (target === "ui-contract-debug") {
    return generateUiContractDebug(graph, options);
  }
  if (target === "ui-surface-contract") {
    return generateUiSurfaceContract(graph, options);
  }
  if (target === "ui-surface-debug") {
    return generateUiSurfaceDebug(graph, options);
  }
  if (target === "sveltekit-app") {
    return generateWebApp(graph, options);
  }

  throw new Error(`Unsupported web generator target '${target}'`);
}
