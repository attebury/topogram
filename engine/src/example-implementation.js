import fs from "node:fs";
import path from "node:path";

import { EXAMPLE_IMPLEMENTATIONS } from "../../examples/registry.js";

function normalizeRoot(root) {
  return String(root || "").replace(/\\/g, "/");
}

function findImplementationConfig(root) {
  let current = root;
  while (current && current !== path.dirname(current)) {
    const candidate = path.join(current, "topogram.implementation.json");
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    }
    current = path.dirname(current);
  }
  return null;
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
  const explicitConfig = (() => {
    try {
      return findImplementationConfig(fs.realpathSync(graph?.root));
    } catch {
      return graph?.root ? findImplementationConfig(path.resolve(graph.root)) : null;
    }
  })();
  if (explicitConfig?.implementation_id) {
    const explicitMatch = EXAMPLE_IMPLEMENTATIONS.find(
      (implementation) => implementation.exampleId === explicitConfig.implementation_id
    );
    if (!explicitMatch) {
      throw new Error(`No Topogram implementation found for implementation_id '${explicitConfig.implementation_id}'.`);
    }
    return explicitMatch;
  }
  const matched = EXAMPLE_IMPLEMENTATIONS.find(
    (implementation) => root.includes(implementation.exampleRoot) || realRoot.includes(implementation.exampleRoot)
  );
  if (matched) {
    return matched;
  }
  return EXAMPLE_IMPLEMENTATIONS[0];
}
