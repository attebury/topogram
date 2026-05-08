import { generateWithComponentGenerator } from "../../adapters.js";
import { generateExpressServer } from "./express.js";
import { generateHonoServer } from "./hono.js";
import { generatePersistenceScaffold } from "./persistence-wiring.js";
import { generateServerContract } from "./server-contract.js";

export function generateBackendTarget(target, graph, options = {}) {
  if (target === "server-contract") {
    return generateServerContract(graph, options);
  }
  if (target === "persistence-scaffold") {
    return generatePersistenceScaffold(graph, options);
  }
  if (target === "hono-server") {
    const runtime = options.runtime || options.component;
    if (runtime?.generator?.id) {
      return generateWithComponentGenerator({
        graph,
        projection: runtime.projection,
        runtime,
        component: runtime,
        topology: options.topology || null,
        implementation: options.implementation || null,
        options
      }).files;
    }
    return generateHonoServer(graph, options);
  }
  if (target === "express-server") {
    const runtime = options.runtime || options.component;
    if (runtime?.generator?.id) {
      return generateWithComponentGenerator({
        graph,
        projection: runtime.projection,
        runtime,
        component: runtime,
        topology: options.topology || null,
        implementation: options.implementation || null,
        options
      }).files;
    }
    return generateExpressServer(graph, options);
  }

  throw new Error(`Unsupported backend generator target '${target}'`);
}
