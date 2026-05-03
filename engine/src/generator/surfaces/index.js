import { generateBackendTarget } from "./services/index.js";
import { generateSwiftUiApp } from "./native/swiftui-app.js";
import { generateWebTarget } from "./web/index.js";
import { generateWithComponentGenerator } from "../adapters.js";

export function generateAppTarget(target, graph, options = {}) {
  if (target === "server-contract" || target === "persistence-scaffold" || target === "hono-server" || target === "express-server") {
    return generateBackendTarget(target, graph, options);
  }
  if (target === "swiftui-app") {
    if (options.component?.generator?.id) {
      return generateWithComponentGenerator({
        graph,
        projection: options.component.projection,
        component: options.component,
        topology: options.topology || null,
        implementation: options.implementation || null,
        options
      }).files;
    }
    return generateSwiftUiApp(graph, options);
  }

  return generateWebTarget(target, graph, options);
}
