// @ts-check

import { TOPOGRAM_IMPORT_FILE } from "../../../import/provenance.js";
import { TOPOGRAM_IMPORT_ADOPTIONS_FILE } from "./paths.js";

export function printImportHelp() {
  console.log("Usage: topogram import <app-path> --out <target> [--from <track[,track]>] [--json]");
  console.log("   or: topogram import refresh [path] [--from <app-path>] [--dry-run] [--json]");
  console.log("   or: topogram import diff [path] [--json]");
  console.log("   or: topogram import check [path] [--json]");
  console.log("   or: topogram import plan [path] [--json]");
  console.log("   or: topogram import adopt --list [path] [--json]");
  console.log("   or: topogram import adopt <selector> [path] [--dry-run|--write] [--force --reason <text>] [--json]");
  console.log("   or: topogram import status [path] [--json]");
  console.log("   or: topogram import history [path] [--verify] [--json]");
  console.log("");
  console.log("Creates an editable Topogram workspace from a brownfield app without modifying the app.");
  console.log("");
  console.log("Behavior:");
  console.log("  - writes raw import candidates under topo/candidates/app");
  console.log("  - writes reconcile proposal bundles under topo/candidates/reconcile");
  console.log("  - writes topogram.project.json with maintained ownership and no generated stack binding");
  console.log(`  - writes ${TOPOGRAM_IMPORT_FILE} with source file hashes from import time`);
  console.log("  - imported Topogram artifacts are project-owned after creation");
  console.log("  - refresh rewrites only candidate/reconcile artifacts and source provenance");
  console.log("  - adoption previews never write canonical Topogram files unless --write is passed");
  console.log("  - adoption writes refuse dirty brownfield source provenance unless --force is passed");
  console.log(`  - adoption writes append audit receipts to ${TOPOGRAM_IMPORT_ADOPTIONS_FILE}`);
  console.log("  - forced adoption writes require --reason <text>");
  console.log("");
  console.log("Examples:");
  console.log("  topogram import ./existing-app --out ./imported-topogram");
  console.log("  topogram import ./existing-app --out ./imported-topogram --from db,api,ui");
  console.log("  topogram import ./existing-cli --out ./imported-topogram --from cli");
  console.log("  topogram import diff ./imported-topogram");
  console.log("  topogram import refresh ./imported-topogram --from ./existing-app --dry-run");
  console.log("  topogram import refresh ./imported-topogram --from ./existing-app");
  console.log("  topogram import check ./imported-topogram");
  console.log("  topogram import plan ./imported-topogram");
  console.log("  topogram import adopt --list ./imported-topogram");
  console.log("  topogram import adopt bundle:task ./imported-topogram --dry-run");
  console.log("  topogram import adopt bundle:task ./imported-topogram --write");
  console.log("  topogram import adopt bundle:task ./imported-topogram --write --force --reason \"Reviewed source drift\"");
  console.log("  topogram import status ./imported-topogram");
  console.log("  topogram import history ./imported-topogram");
  console.log("  topogram import history ./imported-topogram --verify");
  console.log("  topogram import check --json");
}
