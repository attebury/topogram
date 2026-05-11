#!/usr/bin/env node

import fs from "node:fs";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log("Usage: fakecli check [path] --json");
  console.log("Usage: fakecli import <app-path> --out <target> --from <tracks> --json");
  process.exit(0);
}

if (args[0] === "check") {
  console.log(JSON.stringify({ ok: true }));
  process.exit(0);
}

if (args[0] === "import") {
  fs.writeFileSync(args[2] || "./imported.json", JSON.stringify({ imported: true }));
  process.exit(0);
}

console.error(`Unknown command: ${args[0]}`);
process.exit(1);
