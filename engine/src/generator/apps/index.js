import { generateBackendTarget } from "./backend/index.js";
import { generateSwiftUiApp } from "./ios/swiftui-app.js";
import { generateWebTarget } from "./web/index.js";

export function generateAppTarget(target, graph, options = {}) {
  if (target === "server-contract" || target === "persistence-scaffold" || target === "hono-server" || target === "express-server") {
    return generateBackendTarget(target, graph, options);
  }
  if (target === "swiftui-app") {
    return generateSwiftUiApp(graph, options);
  }

  return generateWebTarget(target, graph, options);
}
