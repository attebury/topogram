import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { auditServerContractModules, auditUiContractPair } from "../../src/proofs/contract-audit.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

test("issues contract auditor reports parity for emitted seams", () => {
  const reactUi = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "examples", "generated", "issues", "topogram", "tests", "fixtures", "expected", "proj_ui_web.ui-web-contract.json"),
      "utf8"
    )
  );
  const svelteUi = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "examples", "generated", "issues", "topogram", "tests", "fixtures", "expected", "proj_ui_web_sveltekit.ui-web-contract.json"),
      "utf8"
    )
  );
  const honoServer = fs.readFileSync(
    path.join(repoRoot, "examples", "generated", "issues", "topogram", "tests", "fixtures", "expected", "hono-server", "src", "lib", "topogram", "server-contract.ts"),
    "utf8"
  );
  const expressServer = fs.readFileSync(
    path.join(repoRoot, "examples", "generated", "issues", "topogram", "tests", "fixtures", "expected", "express-server", "src", "lib", "topogram", "server-contract.ts"),
    "utf8"
  );

  const uiAudit = auditUiContractPair(reactUi, svelteUi);
  const serverAudit = auditServerContractModules(honoServer, expressServer);

  assert.equal(uiAudit.semanticParity, true);
  assert.equal(uiAudit.summary.screenCount > 0, true);
  assert.deepEqual(uiAudit.differences.screens, []);

  assert.equal(serverAudit.semanticParity, true);
  assert.equal(serverAudit.summary.routeCount > 0, true);
  assert.deepEqual(serverAudit.differences.routes, []);
});
