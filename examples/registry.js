import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(examplesDir);
const demoDirs = [path.join(repoRoot, "demos")];

async function loadImplementation(baseDir, exampleDirName) {
  const modulePath = path.join(baseDir, exampleDirName, "implementation", "index.js");
  if (!fs.existsSync(modulePath)) {
    return null;
  }
  const module = await import(pathToFileURL(modulePath).href);
  return module.default || Object.values(module).find((value) => value && typeof value === "object" && value.exampleId);
}

async function loadImplementationsFrom(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const implementations = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const implementation = await loadImplementation(baseDir, entry.name);
    if (implementation) {
      implementations.push(implementation);
      continue;
    }
    const nestedDir = path.join(baseDir, entry.name);
    for (const nestedEntry of fs.readdirSync(nestedDir, { withFileTypes: true })) {
      if (!nestedEntry.isDirectory()) {
        continue;
      }
      const nestedImplementation = await loadImplementation(baseDir, path.join(entry.name, nestedEntry.name));
      if (nestedImplementation) {
        implementations.push(nestedImplementation);
      }
    }
  }
  return implementations;
}

export const EXAMPLE_IMPLEMENTATIONS = [
  ...(await loadImplementationsFrom(examplesDir)),
  ...(await Promise.all(demoDirs.map((demoDir) => loadImplementationsFrom(demoDir)))).flat()
].sort((left, right) => String(left.exampleId).localeCompare(String(right.exampleId)));
