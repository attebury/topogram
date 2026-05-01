// Compact a JSONL archive file into pretty-printed JSON for inspection.
//
// Reverse operation `expand` is intentionally absent — JSONL is the
// canonical on-disk format because it supports append-only growth without
// re-serialization.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArchiveFile } from "./jsonl.js";

export function compact(jsonlPath, outputPath) {
  if (!existsSync(jsonlPath)) {
    return { ok: false, error: `File not found: ${jsonlPath}` };
  }
  const entries = parseArchiveFile(jsonlPath);
  const errors = entries.filter((e) => e.__error).map((e) => e.__error);
  const valid = entries.filter((e) => !e.__error);
  const out = outputPath || jsonlPath.replace(/\.jsonl$/, ".json");
  writeFileSync(out, JSON.stringify(valid, null, 2) + "\n", "utf8");
  return {
    ok: true,
    inputFile: jsonlPath,
    outputFile: out,
    count: valid.length,
    errors
  };
}
