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
    return generateHonoServer(graph, options);
  }
  if (target === "express-server") {
    return generateExpressServer(graph, options);
  }

  throw new Error(`Unsupported backend generator target '${target}'`);
}
