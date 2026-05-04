import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parsePath, parseSource } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { validateWorkspace } from "../../src/validator.js";
import { generateWorkspace } from "../../src/generator/index.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "app-basic");

function workspaceFromSource(source) {
  return {
    root: "<memory>",
    files: [parseSource(source, "component-test.tg")],
    docs: []
  };
}

function makeBaselineCopy() {
  return makeWorkspaceCopy("topogram-component-baseline-");
}

function makeWorkspaceCopy(prefix) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  function copyRecursive(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }
  copyRecursive(fixtureRoot, tempRoot);
  return tempRoot;
}

function removeDataGridComponentUsage(workspaceRoot) {
  const projectionPath = path.join(workspaceRoot, "projections", "proj-ui-shared.tg");
  const source = fs.readFileSync(projectionPath, "utf8");
  fs.writeFileSync(
    projectionPath,
    source.replace(
      /\n  ui_components \{\n    screen task_list region results component component_ui_data_grid data rows from cap_list_tasks event row_select navigate task_detail\n  \}\n/,
      "\n"
    )
  );
}

test("component kind validates and resolves from the app fixture", () => {
  const ast = parsePath(fixtureRoot);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const component = resolved.graph.byKind.component.find((entry) => entry.id === "component_ui_data_grid");
  assert.ok(component);
  assert.equal(component.componentContract.id, "component_ui_data_grid");
  assert.equal(component.componentContract.props[0].name, "rows");
  assert.deepEqual(component.componentContract.patterns, ["resource_table", "data_grid_view"]);
  assert.deepEqual(component.componentContract.behaviors, [
    {
      kind: "selection",
      directives: {
        mode: "multi",
        state: "selected_ids",
        emits: "row_select"
      },
      source: "structured"
    },
    {
      kind: "sorting",
      directives: {
        fields: ["title", "status", "created_at"],
        default: ["created_at", "desc"]
      },
      source: "structured"
    }
  ]);
});

test("component validator rejects missing props and status", () => {
  const ast = workspaceFromSource(`
component component_missing_required {
  name "Missing Required"
  description "Invalid component"
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /Missing required field 'props'/);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /Missing required field 'status'/);
});

test("component validator rejects invalid patterns, regions, and event shapes", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Payload"
  description "Payload"
  status active
}

component component_invalid_refs {
  name "Invalid Refs"
  description "Invalid references"
  props {
    rows array required
  }
  events {
    row_select missing_shape
  }
  patterns [not_a_pattern]
  regions [not_a_region]
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  const messages = validation.errors.map((error) => error.message).join("\n");
  assert.match(messages, /references missing shape 'missing_shape'/);
  assert.match(messages, /pattern 'not_a_pattern' is not supported/);
  assert.match(messages, /region 'not_a_region' is not supported/);
});

test("component validator rejects invalid behavior shorthand and structured bindings", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Payload"
  description "Payload"
  status active
}

component component_invalid_behaviors {
  name "Invalid Behaviors"
  description "Invalid behavior contracts"
  props {
    selected_ids array optional default []
  }
  events {
    row_select shape_event_payload
  }
  behavior [selecion]
  behaviors {
    selection mode sometimes state missing_state emits missing_event
    sorting unknown true
    bulk_action actions [missing_action]
  }
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  const messages = validation.errors.map((error) => error.message).join("\n");
  assert.match(messages, /behavior 'selecion' is not supported/);
  assert.match(messages, /behavior 'selection' references unknown prop 'missing_state'/);
  assert.match(messages, /behavior 'selection' references unknown event 'missing_event'/);
  assert.match(messages, /behavior 'selection' has invalid mode 'sometimes'/);
  assert.match(messages, /behavior 'sorting' has unsupported directive 'unknown'/);
  assert.match(messages, /behavior 'bulk_action' references unknown event or capability 'missing_action'/);
});

test("component validator rejects removed consumers field", () => {
  const ast = workspaceFromSource(`
projection proj_ui_shared {
  name "Shared UI"
  description "Shared UI projection"
  platform ui_shared
  realizes []
  outputs [ui_contract]
  status active
}

component component_removed_consumers {
  name "Removed Consumers"
  description "Consumers used to point projection usage in the wrong direction"
  props {
    rows array required
  }
  consumers [proj_ui_shared]
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /Field 'consumers' is not allowed/);
});

test("ui-component-contract generator emits selected and workspace contracts", () => {
  const ast = parsePath(fixtureRoot);
  const selected = generateWorkspace(ast, {
    target: "ui-component-contract",
    componentId: "component_ui_data_grid"
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.artifact.id, "component_ui_data_grid");
  assert.equal(selected.artifact.events[0].shape.id, "shape_output_task_card");

  const all = generateWorkspace(ast, { target: "ui-component-contract" });
  assert.equal(all.ok, true);
  assert.equal(all.artifact.component_ui_data_grid.id, "component_ui_data_grid");
});

test("projection ui_components resolve component placement and bindings", () => {
  const ast = parsePath(fixtureRoot);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const projection = resolved.graph.byKind.projection.find((entry) => entry.id === "proj_ui_shared");
  assert.ok(projection);
  assert.deepEqual(projection.uiComponents, [
    {
      type: "ui_component_binding",
      screenId: "task_list",
      region: "results",
      component: {
        id: "component_ui_data_grid",
        kind: "component"
      },
      dataBindings: [
        {
          prop: "rows",
          source: {
            id: "cap_list_tasks",
            kind: "capability"
          }
        }
      ],
      eventBindings: [
        {
          event: "row_select",
          action: "navigate",
          target: {
            id: "task_detail",
            kind: "screen"
          }
        }
      ],
      raw: [
        "screen",
        "task_list",
        "region",
        "results",
        "component",
        "component_ui_data_grid",
        "data",
        "rows",
        "from",
        "cap_list_tasks",
        "event",
        "row_select",
        "navigate",
        "task_detail"
      ],
      loc: projection.uiComponents[0].loc
    }
  ]);

  const slice = generateWorkspace(ast, {
    target: "context-slice",
    projectionId: "proj_ui_shared"
  });
  assert.equal(slice.ok, true);
  assert.deepEqual(slice.artifact.depends_on.components, ["component_ui_data_grid"]);
  assert.equal(slice.artifact.related.components[0].id, "component_ui_data_grid");

  const concreteSlice = generateWorkspace(ast, {
    target: "context-slice",
    projectionId: "proj_ui_web"
  });
  assert.equal(concreteSlice.ok, true);
  assert.deepEqual(concreteSlice.artifact.depends_on.components, ["component_ui_data_grid"]);

  const webContract = generateWorkspace(ast, {
    target: "ui-web-contract",
    projectionId: "proj_ui_web"
  });
  assert.equal(webContract.ok, true);
  assert.equal(webContract.artifact.components.component_ui_data_grid.id, "component_ui_data_grid");
  const taskList = webContract.artifact.screens.find((screen) => screen.id === "task_list");
  assert.deepEqual(taskList.components, [
    {
      type: "ui_component_usage",
      region: "results",
      component: {
        id: "component_ui_data_grid",
        name: "Data Grid",
        category: "collection",
        version: "1.0"
      },
      dataBindings: [
        {
          prop: "rows",
          source: {
            id: "cap_list_tasks",
            kind: "capability"
          }
        }
      ],
      eventBindings: [
        {
          event: "row_select",
          action: "navigate",
          target: {
            id: "task_detail",
            kind: "screen"
          }
        }
      ],
      behaviorRealizations: [
        {
          kind: "selection",
          source: "structured",
          directives: {
            mode: "multi",
            state: "selected_ids",
            emits: "row_select"
          },
          state: {
            prop: "selected_ids",
            requiredness: "optional",
            bound: false,
            source: null,
            defaultValue: []
          },
          emits: [
            {
              event: "row_select",
              bound: true,
              bindings: [
                {
                  event: "row_select",
                  action: "navigate",
                  target: {
                    id: "task_detail",
                    kind: "screen"
                  }
                }
              ],
              effects: [
                {
                  type: "navigation",
                  event: "row_select",
                  target: {
                    id: "task_detail",
                    kind: "screen"
                  }
                }
              ]
            }
          ],
          actions: [],
          dataDependencies: [
            {
              prop: "rows",
              source: {
                id: "cap_list_tasks",
                kind: "capability"
              }
            }
          ],
          effects: [
            {
              type: "navigation",
              event: "row_select",
              target: {
                id: "task_detail",
                kind: "screen"
              }
            }
          ],
          status: "realized"
        },
        {
          kind: "sorting",
          source: "structured",
          directives: {
            fields: ["title", "status", "created_at"],
            default: ["created_at", "desc"]
          },
          state: null,
          emits: [],
          actions: [],
          dataDependencies: [
            {
              prop: "rows",
              source: {
                id: "cap_list_tasks",
                kind: "capability"
              }
            }
          ],
          effects: [],
          status: "realized"
        }
      ]
    }
  ]);
});

test("component-conformance-report passes valid inherited projection usage", () => {
  const ast = parsePath(fixtureRoot);
  const report = generateWorkspace(ast, {
    target: "component-conformance-report",
    projectionId: "proj_ui_web"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.type, "component_conformance_report");
  assert.deepEqual(report.artifact.filters, {
    projection: "proj_ui_web",
    component: null
  });
  assert.equal(report.artifact.summary.total_usages, 1);
  assert.equal(report.artifact.summary.passed_usages, 1);
  assert.equal(report.artifact.summary.errors, 0);
  assert.equal(report.artifact.summary.warnings, 0);
  assert.deepEqual(report.artifact.summary.affected_components, ["component_ui_data_grid"]);
  assert.deepEqual(report.artifact.summary.affected_projections, ["proj_ui_shared", "proj_ui_web"]);
  assert.equal(report.artifact.projection_usages[0].projection.id, "proj_ui_web");
  assert.equal(report.artifact.projection_usages[0].source_projection.id, "proj_ui_shared");
  assert.equal(report.artifact.projection_usages[0].outcome, "pass");
  assert.equal(report.artifact.component_contracts[0].id, "component_ui_data_grid");
  assert.deepEqual(report.artifact.component_contracts[0].approvals, []);
  assert.equal(report.artifact.write_scope.paths.some((filePath) => filePath.endsWith("component-ui-data-grid.tg")), true);
  assert.equal(report.artifact.write_scope.paths.some((filePath) => filePath.endsWith("proj-ui-web.tg")), true);
  assert.equal(report.artifact.write_scope.paths.some((filePath) => filePath.endsWith("proj-ui-shared.tg")), true);
});

test("component-conformance-report reports required props, action context, status, and approvals", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Event Payload"
  description "Event payload"
  status active
}

capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

capability cap_update_item {
  name "Update Item"
  description "Update item"
  status active
}

component component_grid {
  name "Grid"
  description "Grid"
  category collection
  props {
    rows array required
    selected_ids array optional
  }
  events {
    row_select shape_event_payload
  }
  behavior [selection]
  behaviors {
    selection mode multi state selected_ids emits row_select
  }
  patterns [resource_table]
  regions [results]
  approvals [design, security]
  status draft
}

projection proj_ui {
  name "UI"
  description "UI"
  platform ui_shared
  realizes [cap_list_items]
  outputs [ui_contract]

  ui_screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  ui_screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  ui_components {
    screen item_list region results component component_grid event row_select action cap_update_item
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));
  const report = generateWorkspace(ast, {
    target: "component-conformance-report",
    projectionId: "proj_ui",
    componentId: "component_grid"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.total_usages, 1);
  assert.equal(report.artifact.summary.error_usages, 1);
  assert.equal(report.artifact.summary.errors, 2);
  assert.equal(report.artifact.summary.warnings, 1);
  assert.deepEqual(report.artifact.summary.affected_components, ["component_grid"]);
  assert.deepEqual(report.artifact.summary.affected_projections, ["proj_ui"]);
  assert.deepEqual(
    report.artifact.checks.map((check) => check.code).sort(),
    [
      "component_event_action_not_in_projection",
      "component_required_prop_missing",
      "component_status_not_active"
    ]
  );
  assert.equal(report.artifact.checks.find((check) => check.code === "component_required_prop_missing").prop, "rows");
  assert.equal(report.artifact.component_contracts[0].id, "component_grid");
  assert.deepEqual(report.artifact.component_contracts[0].approvals, ["design", "security"]);
  assert.deepEqual(report.artifact.component_contracts[0].behaviors, [
    {
      kind: "selection",
      directives: {
        mode: "multi",
        state: "selected_ids",
        emits: "row_select"
      },
      source: "structured"
    }
  ]);
});

test("component-conformance-report surfaces behavior realizations and unbound emitted events", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Event Payload"
  description "Event payload"
  status active
}

capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

component component_grid {
  name "Grid"
  description "Grid"
  category collection
  props {
    rows array required
    selected_ids array optional default []
  }
  events {
    row_select shape_event_payload
  }
  behaviors {
    selection mode multi state selected_ids emits row_select
  }
  patterns [resource_table]
  regions [results]
  status active
}

projection proj_ui {
  name "UI"
  description "UI"
  platform ui_shared
  realizes [cap_list_items]
  outputs [ui_contract]

  ui_screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  ui_screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  ui_components {
    screen item_list region results component component_grid data rows from cap_list_items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const report = generateWorkspace(ast, {
    target: "component-conformance-report",
    projectionId: "proj_ui",
    componentId: "component_grid"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.total_usages, 1);
  assert.equal(report.artifact.summary.warning_usages, 1);
  assert.equal(report.artifact.summary.warnings, 1);
  assert.deepEqual(report.artifact.checks.map((check) => check.code), ["component_behavior_event_unbound"]);
  assert.deepEqual(report.artifact.projection_usages[0].behavior_realizations, [
    {
      kind: "selection",
      source: "structured",
      directives: {
        mode: "multi",
        state: "selected_ids",
        emits: "row_select"
      },
      state: {
        prop: "selected_ids",
        requiredness: "optional",
        bound: false,
        source: null,
        defaultValue: []
      },
      emits: [
        {
          event: "row_select",
          bound: false,
          bindings: [],
          effects: []
        }
      ],
      actions: [],
      dataDependencies: [
        {
          prop: "rows",
          source: {
            id: "cap_list_items",
            kind: "capability"
          }
        }
      ],
      effects: [],
      status: "partial"
    }
  ]);
});

test("component behavior action directives surface command effects", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Event Payload"
  description "Event payload"
  status active
}

capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

capability cap_update_item {
  name "Update Item"
  description "Update item"
  status active
}

component component_grid {
  name "Grid"
  description "Grid"
  category collection
  props {
    rows array required
  }
  events {
    row_update shape_event_payload
  }
  behaviors {
    optimistic_update actions [row_update] rollback true
  }
  patterns [resource_table]
  regions [results]
  status active
}

projection proj_ui {
  name "UI"
  description "UI"
  platform ui_shared
  realizes [cap_list_items, cap_update_item]
  outputs [ui_contract]

  ui_screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  ui_screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  ui_components {
    screen item_list region results component component_grid data rows from cap_list_items event row_update action cap_update_item
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const report = generateWorkspace(ast, {
    target: "component-conformance-report",
    projectionId: "proj_ui",
    componentId: "component_grid"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.warnings, 0);
  assert.deepEqual(report.artifact.projection_usages[0].behavior_realizations[0].actions, [
    {
      event: "row_update",
      bound: true,
      bindings: [
        {
          event: "row_update",
          action: "action",
          target: {
            id: "cap_update_item",
            kind: "capability"
          }
        }
      ],
      effects: [
        {
          type: "command",
          event: "row_update",
          capability: {
            id: "cap_update_item",
            kind: "capability"
          }
        }
      ]
    }
  ]);
  assert.deepEqual(report.artifact.projection_usages[0].behavior_realizations[0].effects, [
    {
      type: "command",
      event: "row_update",
      capability: {
        id: "cap_update_item",
        kind: "capability"
      }
    }
  ]);
});

test("component behavior capability action directives surface command effects", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Event Payload"
  description "Event payload"
  status active
}

capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

capability cap_update_item {
  name "Update Item"
  description "Update item"
  status active
}

component component_grid {
  name "Grid"
  description "Grid"
  category collection
  props {
    rows array required
  }
  events {
    row_update shape_event_payload
  }
  behaviors {
    optimistic_update actions [cap_update_item] rollback true
  }
  patterns [resource_table]
  regions [results]
  status active
}

projection proj_ui {
  name "UI"
  description "UI"
  platform ui_shared
  realizes [cap_list_items, cap_update_item]
  outputs [ui_contract]

  ui_screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  ui_screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  ui_components {
    screen item_list region results component component_grid data rows from cap_list_items event row_update action cap_update_item
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const report = generateWorkspace(ast, {
    target: "component-conformance-report",
    projectionId: "proj_ui",
    componentId: "component_grid"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.warnings, 0);
  assert.deepEqual(report.artifact.projection_usages[0].behavior_realizations[0].actions, [
    {
      event: null,
      capability: {
        id: "cap_update_item",
        kind: "capability"
      },
      bound: true,
      bindings: [
        {
          event: "row_update",
          action: "action",
          target: {
            id: "cap_update_item",
            kind: "capability"
          }
        }
      ],
      effects: [
        {
          type: "command",
          event: "row_update",
          capability: {
            id: "cap_update_item",
            kind: "capability"
          }
        }
      ]
    }
  ]);
  assert.deepEqual(report.artifact.projection_usages[0].behavior_realizations[0].effects, [
    {
      type: "command",
      event: "row_update",
      capability: {
        id: "cap_update_item",
        kind: "capability"
      }
    }
  ]);
});

test("component behavior capability action directives warn when unbound", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Event Payload"
  description "Event payload"
  status active
}

capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

capability cap_update_item {
  name "Update Item"
  description "Update item"
  status active
}

component component_grid {
  name "Grid"
  description "Grid"
  category collection
  props {
    rows array required
  }
  events {
    row_update shape_event_payload
  }
  behaviors {
    optimistic_update actions [cap_update_item] rollback true
  }
  patterns [resource_table]
  regions [results]
  status active
}

projection proj_ui {
  name "UI"
  description "UI"
  platform ui_shared
  realizes [cap_list_items, cap_update_item]
  outputs [ui_contract]

  ui_screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  ui_screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  ui_components {
    screen item_list region results component component_grid data rows from cap_list_items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const report = generateWorkspace(ast, {
    target: "component-conformance-report",
    projectionId: "proj_ui",
    componentId: "component_grid"
  });
  assert.equal(report.ok, true);
  assert.deepEqual(report.artifact.checks.map((check) => check.code), ["component_behavior_action_unbound"]);
  assert.deepEqual(report.artifact.projection_usages[0].behavior_realizations[0].actions, [
    {
      event: null,
      capability: {
        id: "cap_update_item",
        kind: "capability"
      },
      bound: false,
      bindings: [],
      effects: [
        {
          type: "command",
          event: null,
          capability: {
            id: "cap_update_item",
            kind: "capability"
          },
          source: "behavior"
        }
      ]
    }
  ]);
  assert.deepEqual(report.artifact.projection_usages[0].behavior_realizations[0].status, "partial");

  const behaviorReport = generateWorkspace(ast, {
    target: "component-behavior-report",
    projectionId: "proj_ui",
    componentId: "component_grid"
  });
  assert.equal(behaviorReport.ok, true);
  assert.equal(behaviorReport.artifact.type, "component_behavior_report");
  assert.equal(behaviorReport.artifact.summary.total_usages, 1);
  assert.equal(behaviorReport.artifact.summary.total_behaviors, 1);
  assert.equal(behaviorReport.artifact.summary.partial, 1);
  assert.deepEqual(behaviorReport.artifact.summary.affected_components, ["component_grid"]);
  assert.deepEqual(behaviorReport.artifact.summary.affected_projections, ["proj_ui"]);
  assert.deepEqual(behaviorReport.artifact.summary.affected_capabilities, ["cap_list_items", "cap_update_item"]);
  assert.deepEqual(behaviorReport.artifact.groups.components.map((group) => group.id), ["component_grid"]);
  assert.deepEqual(behaviorReport.artifact.groups.screens.map((group) => group.id), ["item_list"]);
  assert.deepEqual(behaviorReport.artifact.groups.capabilities.map((group) => group.id), ["cap_list_items", "cap_update_item"]);
  assert.deepEqual(behaviorReport.artifact.groups.effects.map((group) => group.id), ["command"]);
  assert.equal(behaviorReport.artifact.behaviors[0].behavior.kind, "optimistic_update");
  assert.deepEqual(behaviorReport.artifact.behaviors[0].effect_types, ["command"]);
  assert.deepEqual(behaviorReport.artifact.behaviors[0].capabilities, ["cap_list_items", "cap_update_item"]);
  assert.equal(
    behaviorReport.artifact.highlights.some((highlight) =>
      highlight.code === "component_behavior_action_unbound" &&
      highlight.capability === "cap_update_item"
    ),
    true
  );
});

test("component-conformance-report filters by component and rejects unknown selectors", () => {
  const ast = parsePath(fixtureRoot);
  const report = generateWorkspace(ast, {
    target: "component-conformance-report",
    componentId: "component_ui_data_grid"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.total_usages, 3);
  assert.deepEqual(report.artifact.summary.affected_components, ["component_ui_data_grid"]);
  assert.deepEqual(report.artifact.summary.affected_projections, ["proj_ui_shared", "proj_ui_web", "proj_ui_web_react"]);

  assert.throws(
    () => generateWorkspace(ast, {
      target: "component-conformance-report",
      componentId: "component_does_not_exist"
    }),
    /No component found with id 'component_does_not_exist'/
  );
  assert.throws(
    () => generateWorkspace(ast, {
      target: "component-conformance-report",
      projectionId: "proj_does_not_exist"
    }),
    /No projection found with id 'proj_does_not_exist'/
  );
});

test("projection ui_components validate component props, events, and navigation targets", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Event Payload"
  description "Event payload"
  status active
}

capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

component component_grid {
  name "Grid"
  description "Grid"
  props {
    rows array required
  }
  events {
    row_select shape_event_payload
  }
  patterns [resource_table]
  regions [results]
  status active
}

projection proj_ui {
  name "UI"
  description "UI"
  platform ui_shared
  realizes [cap_list_items]
  outputs [ui_contract]

  ui_screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  ui_screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  ui_components {
    screen item_list region results component component_grid data missing_rows from cap_list_items event missing_select navigate item_detail
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  const messages = validation.errors.map((error) => error.message).join("\n");
  assert.match(messages, /references unknown prop 'missing_rows'/);
  assert.match(messages, /references unknown event 'missing_select'/);
  assert.match(messages, /references unknown navigation target 'item_detail'/);
});

test("component prop defaults preserve real values", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "ui-component-contract",
    componentId: "component_ui_data_grid"
  });
  assert.equal(result.ok, true);
  const props = Object.fromEntries(result.artifact.props.map((prop) => [prop.name, prop]));
  assert.deepEqual(props.selected_ids.defaultValue, []);
  assert.equal(props.loading.defaultValue, false);
  assert.equal(typeof props.loading.defaultValue, "boolean");
});

test("component approvals are resolved and emitted in contracts", () => {
  const ast = workspaceFromSource(`
component component_requires_approval {
  name "Approval Component"
  description "Needs design and security review"
  props {
    label string required
  }
  approvals [design, security]
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const component = resolved.graph.byKind.component.find((entry) => entry.id === "component_requires_approval");
  assert.deepEqual(component.approvals, ["design", "security"]);
  assert.deepEqual(component.componentContract.approvals, ["design", "security"]);

  const result = generateWorkspace(ast, {
    target: "ui-component-contract",
    componentId: "component_requires_approval"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.artifact.approvals, ["design", "security"]);
});

test("component prop defaults coerce booleans, numbers, lists, and null", () => {
  const ast = workspaceFromSource(`
component component_default_literals {
  name "Default Literals"
  description "Exercises every supported default literal form"
  props {
    enabled boolean optional default true
    disabled boolean optional default false
    items array optional default []
    page_size integer optional default 10
    weight number optional default 1.5
    label string optional default "All"
    note string optional default null
  }
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));
  const result = generateWorkspace(ast, {
    target: "ui-component-contract",
    componentId: "component_default_literals"
  });
  assert.equal(result.ok, true);
  const props = Object.fromEntries(result.artifact.props.map((prop) => [prop.name, prop]));
  assert.equal(props.enabled.defaultValue, true);
  assert.equal(props.disabled.defaultValue, false);
  assert.deepEqual(props.items.defaultValue, []);
  assert.equal(props.page_size.defaultValue, 10);
  assert.equal(props.weight.defaultValue, 1.5);
  assert.equal(props.label.defaultValue, "All");
  assert.equal(props.note.defaultValue, null);
});

test("ui-component-contract throws on unknown component id", () => {
  const ast = parsePath(fixtureRoot);
  assert.throws(
    () => generateWorkspace(ast, {
      target: "ui-component-contract",
      componentId: "component_does_not_exist"
    }),
    /No component found with id 'component_does_not_exist'/
  );
});

test("context-diff reports component additions and modifications", () => {
    const baselineRoot = makeBaselineCopy();
  try {
    const baselineComponentPath = path.join(baselineRoot, "components", "component-ui-data-grid.tg");
    fs.unlinkSync(baselineComponentPath);
    removeDataGridComponentUsage(baselineRoot);

    const additiveAst = parsePath(fixtureRoot);
    const additive = generateWorkspace(additiveAst, {
      target: "context-diff",
      fromTopogramPath: baselineRoot
    });
    assert.equal(additive.ok, true);
    const dataGridAdd = (additive.artifact.components || []).find((entry) => entry.id === "component_ui_data_grid");
    assert.ok(dataGridAdd, "expected additive component entry");
    assert.equal(dataGridAdd.classification, "additive");

    const modifiedSource = fs
      .readFileSync(path.join(fixtureRoot, "components", "component-ui-data-grid.tg"), "utf8")
      .replace('version "1.0"', 'version "1.1"');
    fs.mkdirSync(path.dirname(baselineComponentPath), { recursive: true });
    fs.writeFileSync(baselineComponentPath, modifiedSource);

    const modifiedAst = parsePath(fixtureRoot);
    const modified = generateWorkspace(modifiedAst, {
      target: "context-diff",
      fromTopogramPath: baselineRoot
    });
    assert.equal(modified.ok, true);
    const dataGridModified = (modified.artifact.components || []).find((entry) => entry.id === "component_ui_data_grid");
    assert.ok(dataGridModified, "expected modified component entry");
    assert.equal(dataGridModified.classification, "modified");
    assert.equal(dataGridModified.current.version, "1.0");
    assert.equal(dataGridModified.baseline.version, "1.1");
  } finally {
    fs.rmSync(baselineRoot, { recursive: true, force: true });
  }
});

test("context-diff reports projection impact for removed components from baseline", () => {
  const currentRoot = makeWorkspaceCopy("topogram-component-current-");
  try {
    fs.unlinkSync(path.join(currentRoot, "components", "component-ui-data-grid.tg"));
    removeDataGridComponentUsage(currentRoot);

    const currentAst = parsePath(currentRoot);
    const result = generateWorkspace(currentAst, {
      target: "context-diff",
      fromTopogramPath: fixtureRoot
    });
    assert.equal(result.ok, true);
    const dataGridRemoved = (result.artifact.components || []).find((entry) => entry.id === "component_ui_data_grid");
    assert.ok(dataGridRemoved, "expected removed component entry");
    assert.equal(dataGridRemoved.classification, "removed");
    assert.deepEqual(
      result.artifact.affected_generated_surfaces.projections.map((projection) => projection.id),
      ["proj_ui_shared", "proj_ui_web", "proj_ui_web_react"]
    );
  } finally {
    fs.rmSync(currentRoot, { recursive: true, force: true });
  }
});

test("context-slice with --component focuses on the component contract closure", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "context-slice",
    componentId: "component_ui_data_grid"
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.focus.kind, "component");
  assert.equal(result.artifact.focus.id, "component_ui_data_grid");
  assert.ok(
    result.artifact.depends_on.projections.includes("proj_ui_shared"),
    `expected proj_ui_shared in depends_on.projections, got ${JSON.stringify(result.artifact.depends_on.projections)}`
  );
  assert.ok(
    result.artifact.depends_on.shapes.includes("shape_output_task_card"),
    `expected shape_output_task_card in depends_on.shapes, got ${JSON.stringify(result.artifact.depends_on.shapes)}`
  );
  assert.equal(result.artifact.review_boundary.automation_class, "review_required");
  assert.deepEqual(result.artifact.review_boundary.reasons, ["component_surface"]);
});

test("context-slice with --component preserves dependency references by kind", () => {
  const ast = workspaceFromSource(`
entity entity_dep {
  name "Dependency Entity"
  description "Dependency entity"
  fields {
    id string required
  }
  status active
}

shape shape_dep from entity_dep {
  name "Dependency Shape"
  description "Dependency shape"
  status active
}

capability cap_dep {
  name "Dependency Capability"
  description "Dependency capability"
  status active
}

capability cap_shape {
  name "Shape Capability"
  description "Capability that exposes the dependency shape"
  output [shape_dep]
  status active
}

projection proj_direct {
  name "Direct Projection"
  description "Direct projection dependency"
  platform ui_shared
  realizes [cap_dep]
  outputs [ui_contract]
  status active
}

projection proj_from_cap {
  name "Capability Projection"
  description "Projection expanded from capability dependency"
  platform ui_shared
  realizes [cap_dep]
  outputs [ui_contract]
  status active
}

projection proj_from_entity {
  name "Entity Projection"
  description "Projection expanded from entity dependency"
  platform db_sqlite
  realizes [entity_dep]
  outputs [db_contract]
  db_tables {
    entity_dep table deps
  }
  status active
}

projection proj_from_shape {
  name "Shape Projection"
  description "Projection expanded from shape dependency"
  platform ui_shared
  realizes [cap_shape]
  outputs [ui_contract]
  status active
}

component component_other {
  name "Other Component"
  description "Other component"
  props {
    label string required
  }
  status active
}

component component_dep_test {
  name "Dependency Component"
  description "Component with dependencies across statement kinds"
  props {
    rows array required
  }
  dependencies [shape_dep, entity_dep, cap_dep, proj_direct, component_other]
  status active
}

verification ver_component_dependencies {
  name "Component dependency verification"
  description "Covers dependency-driven component context"
  validates [shape_dep, entity_dep, cap_dep, proj_direct, component_other]
  method smoke
  scenarios [component_dependency_context]
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const result = generateWorkspace(ast, {
    target: "context-slice",
    componentId: "component_dep_test"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.artifact.depends_on.shapes, ["shape_dep"]);
  assert.deepEqual(result.artifact.depends_on.entities, ["entity_dep"]);
  assert.deepEqual(result.artifact.depends_on.capabilities, ["cap_dep"]);
  assert.deepEqual(result.artifact.depends_on.components, ["component_other"]);
  assert.deepEqual(result.artifact.depends_on.projections, [
    "proj_direct",
    "proj_from_cap",
    "proj_from_entity",
    "proj_from_shape"
  ]);
  assert.deepEqual(result.artifact.depends_on.verifications, ["ver_component_dependencies"]);
  assert.equal(result.artifact.related.shapes[0].id, "shape_dep");
  assert.equal(result.artifact.related.entities[0].id, "entity_dep");
  assert.equal(result.artifact.related.capabilities[0].id, "cap_dep");
  assert.equal(result.artifact.related.components[0].id, "component_other");
  assert.deepEqual(result.artifact.related.projections.map((projection) => projection.id), [
    "proj_direct",
    "proj_from_cap",
    "proj_from_entity",
    "proj_from_shape"
  ]);
  assert.deepEqual(result.artifact.verification_targets.verification_ids, ["ver_component_dependencies"]);
});

test("context-slice rejects unknown component id", () => {
  const ast = parsePath(fixtureRoot);
  assert.throws(
    () => generateWorkspace(ast, {
      target: "context-slice",
      componentId: "component_does_not_exist"
    }),
    /No component found with id 'component_does_not_exist'/
  );
});
