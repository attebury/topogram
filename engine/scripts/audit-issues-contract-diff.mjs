#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { stableStringify } from "../src/format.js";
import { auditServerContractModules, auditUiContractPair } from "../src/proofs/contract-audit.js";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(workspaceRoot, "..");

const reactUiPath = path.join(repoRoot, "examples", "generated", "issues", "topogram", "tests", "fixtures", "expected", "proj_ui_web.ui-web-contract.json");
const svelteUiPath = path.join(repoRoot, "examples", "generated", "issues", "topogram", "tests", "fixtures", "expected", "proj_ui_web_sveltekit.ui-web-contract.json");
const honoServerPath = path.join(repoRoot, "examples", "generated", "issues", "topogram", "tests", "fixtures", "expected", "hono-server", "src", "lib", "topogram", "server-contract.ts");
const expressServerPath = path.join(repoRoot, "examples", "generated", "issues", "topogram", "tests", "fixtures", "expected", "express-server", "src", "lib", "topogram", "server-contract.ts");

const uiAudit = auditUiContractPair(
  JSON.parse(fs.readFileSync(reactUiPath, "utf8")),
  JSON.parse(fs.readFileSync(svelteUiPath, "utf8"))
);
const serverAudit = auditServerContractModules(
  fs.readFileSync(honoServerPath, "utf8"),
  fs.readFileSync(expressServerPath, "utf8")
);

console.log(
  stableStringify({
    type: "issues_contract_audit",
    workspace: path.join(repoRoot, "examples", "generated", "issues", "topogram"),
    seams: {
      ui_web_contract: {
        files: [reactUiPath, svelteUiPath],
        ...uiAudit
      },
      server_contract: {
        files: [honoServerPath, expressServerPath],
        ...serverAudit
      }
    },
    overall: {
      semanticParity: uiAudit.semanticParity && serverAudit.semanticParity
    }
  })
);
