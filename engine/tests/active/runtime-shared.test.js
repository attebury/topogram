import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVerificationSummary,
  selectChecksByVerification
} from "../../src/generator/runtime/shared.js";

test("buildVerificationSummary deduplicates scenarios across direct and planned entries", () => {
  const graph = {
    byKind: {
      verification: [
        {
          id: "ver_runtime_smoke",
          name: "Runtime smoke",
          method: "smoke",
          validates: [{ id: "cap_create_task", kind: "capability" }],
          scenarios: ["create_task_smoke", "list_tasks_smoke"]
        },
        {
          id: "ver_runtime_flow",
          name: "Runtime flow",
          method: "runtime",
          validates: [{ id: "cap_update_task", kind: "capability" }],
          plan: {
            scenarios: [
              { target: { id: "create_task_smoke" } },
              { target: { id: "complete_task_runtime" } }
            ]
          }
        }
      ]
    }
  };

  const smokeSummary = buildVerificationSummary(graph, ["smoke"]);
  assert.deepEqual(smokeSummary.methods, ["smoke"]);
  assert.deepEqual(
    smokeSummary.scenarios.map((entry) => entry.id),
    ["create_task_smoke", "list_tasks_smoke"]
  );

  const combinedSummary = buildVerificationSummary(graph, ["smoke", "runtime"]);
  assert.deepEqual(
    combinedSummary.scenarios.map((entry) => entry.id),
    ["create_task_smoke", "complete_task_runtime", "list_tasks_smoke"]
  );
});

test("selectChecksByVerification keeps lookup and web checks while filtering by verified capabilities", () => {
  const graph = {
    byKind: {
      verification: [
        {
          id: "ver_runtime_flow",
          method: "runtime",
          validates: [{ id: "cap_create_task", kind: "capability" }]
        }
      ]
    }
  };
  const checks = [
    { id: "create", kind: "api_contract", capabilityId: "cap_create_task" },
    { id: "delete", kind: "api_contract", capabilityId: "cap_delete_task" },
    { id: "lookup", kind: "lookup_contract" },
    { id: "web", kind: "web_contract", type: "web_get" }
  ];

  const selection = selectChecksByVerification(graph, checks, ["runtime"], {
    keepLookupChecks: true,
    keepWebChecks: true
  });

  assert.deepEqual(
    selection.checks.map((entry) => entry.id),
    ["create", "lookup", "web"]
  );
  assert.deepEqual(selection.selection.capabilityIds, ["cap_create_task"]);
  assert.deepEqual(selection.selection.omittedCheckIds, ["delete"]);
});
