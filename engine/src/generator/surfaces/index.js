import { generateBackendTarget } from "./services/index.js";
import { generateSwiftUiApp } from "./native/swiftui-app.js";
import { generateWebTarget } from "./web/index.js";
import { generateWithComponentGenerator } from "../adapters.js";

export function generateAppTarget(target, graph, options = {}) {
  if (target === "server-contract" || target === "persistence-scaffold" || target === "hono-server" || target === "express-server") {
    return generateBackendTarget(target, graph, options);
  }
  if (target === "swiftui-app") {
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
    return generateSwiftUiApp(graph, options);
  }

  return generateWebTarget(target, graph, options);
}
