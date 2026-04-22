import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));

async function loadImplementation(exampleDirName) {
  const modulePath = path.join(examplesDir, exampleDirName, "implementation", "index.js");
  if (!fs.existsSync(modulePath)) {
    return null;
  }
  const module = await import(pathToFileURL(modulePath).href);
  return module.default || Object.values(module).find((value) => value && typeof value === "object" && value.exampleId);
}

async function loadImplementations() {
  const entries = fs.readdirSync(examplesDir, { withFileTypes: true });
  const implementations = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const implementation = await loadImplementation(entry.name);
    if (implementation) {
      implementations.push(implementation);
    }
  }
  return implementations.sort((left, right) => String(left.exampleId).localeCompare(String(right.exampleId)));
}

export const EXAMPLE_IMPLEMENTATIONS = await loadImplementations();
