#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { listImportFixtureInventory } from "./proof-corpus-fixtures.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventory = listImportFixtureInventory(workspaceRoot);

const grouped = new Map();

for (const entry of inventory) {
  const bucket = grouped.get(entry.kind) || [];
  bucket.push(entry);
  grouped.set(entry.kind, bucket);
}

for (const [kind, entries] of grouped.entries()) {
  console.log(`${kind}`);
  for (const entry of entries) {
    const uses = entry.usedBy.join(", ");
    const publicHome = entry.publicHome ? ` | public: ${entry.publicHome}` : "";
    console.log(`- ${entry.slug} | uses: ${uses}${publicHome}`);
    console.log(`  ${path.relative(workspaceRoot, entry.absolutePath)}`);
    console.log(`  ${entry.description}`);
  }
  console.log("");
}
