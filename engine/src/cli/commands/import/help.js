// @ts-check

import { TOPOGRAM_IMPORT_FILE } from "../../../import/provenance.js";
import { TOPOGRAM_IMPORT_ADOPTIONS_FILE } from "./paths.js";

export function printExtractHelp() {
  console.log("Usage: topogram extract <app-path> --out <target> [--from <track[,track]>] [--json]");
  console.log("   or: topogram extract refresh [path] [--from <app-path>] [--dry-run] [--json]");
  console.log("   or: topogram extract diff [path] [--json]");
  console.log("   or: topogram extract check [path] [--json]");
  console.log("   or: topogram extract plan [path] [--json]");
  console.log("   or: topogram extract status [path] [--json]");
  console.log("   or: topogram extract history [path] [--verify] [--json]");
  console.log("");
  console.log("Extracts reviewable Topogram candidates from a brownfield app without modifying the app.");
  console.log("");
  console.log("Behavior:");
  console.log("  - writes raw extraction candidates under topo/candidates/app");
  console.log("  - writes reconcile proposal bundles under topo/candidates/reconcile");
  console.log("  - writes topogram.project.json with maintained ownership and no generated stack binding");
  console.log(`  - writes ${TOPOGRAM_IMPORT_FILE} with source file hashes from extraction time`);
  console.log("  - extracted Topogram artifacts are project-owned after creation");
  console.log("  - refresh rewrites only candidate/reconcile artifacts and source provenance");
  console.log("");
  console.log("Examples:");
  console.log("  topogram extract ./existing-app --out ./extracted-topogram");
  console.log("  topogram extract ./existing-app --out ./extracted-topogram --from db,api,ui");
  console.log("  topogram extract ./existing-cli --out ./extracted-topogram --from cli");
  console.log("  topogram extract diff ./extracted-topogram");
  console.log("  topogram extract refresh ./extracted-topogram --from ./existing-app --dry-run");
  console.log("  topogram extract refresh ./extracted-topogram --from ./existing-app");
  console.log("  topogram extract check ./extracted-topogram");
  console.log("  topogram extract plan ./extracted-topogram");
  console.log("  topogram extract status ./extracted-topogram");
  console.log("  topogram extract history ./extracted-topogram");
  console.log("  topogram extract history ./extracted-topogram --verify");
  console.log("  topogram extract check --json");
}

export function printAdoptHelp() {
  console.log("Usage: topogram adopt --list [path] [--json]");
  console.log("   or: topogram adopt <selector> [path] [--dry-run|--write] [--force --reason <text>] [--json]");
  console.log("");
  console.log("Promotes reviewed extraction candidates into canonical topo/ files.");
  console.log("");
  console.log("Behavior:");
  console.log("  - previews never write canonical Topogram files unless --write is passed");
  console.log("  - writes refuse dirty brownfield source provenance unless --force is passed");
  console.log(`  - writes append audit receipts to ${TOPOGRAM_IMPORT_ADOPTIONS_FILE}`);
  console.log("  - forced writes require --reason <text>");
  console.log("");
  console.log("Examples:");
  console.log("  topogram adopt --list ./extracted-topogram");
  console.log("  topogram adopt bundle:task ./extracted-topogram --dry-run");
  console.log("  topogram adopt bundle:task ./extracted-topogram --write");
  console.log("  topogram adopt bundle:task ./extracted-topogram --write --force --reason \"Reviewed source drift\"");
}
