import fs from "node:fs";

import { EXAMPLE_IMPLEMENTATIONS } from "../../examples/registry.js";

function normalizeRoot(root) {
  return String(root || "").replace(/\\/g, "/");
}

export function getExampleImplementation(graph) {
  const root = normalizeRoot(graph?.root);
  const realRoot = (() => {
    try {
      return normalizeRoot(fs.realpathSync(graph?.root));
    } catch {
      return root;
    }
  })();
  const matched = EXAMPLE_IMPLEMENTATIONS.find(
    (implementation) => root.includes(implementation.exampleRoot) || realRoot.includes(implementation.exampleRoot)
  );
  if (matched) {
    return matched;
  }
  return EXAMPLE_IMPLEMENTATIONS[0];
}
