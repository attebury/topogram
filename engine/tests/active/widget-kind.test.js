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
import { APP_BASIC_IMPLEMENTATION } from "../fixtures/workspaces/app-basic/implementation/index.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "app-basic");

function workspaceFromSource(source) {
  return {
    root: "<memory>",
    files: [parseSource(source, "widget-test.tg")],
    docs: []
  };
}

function makeBaselineCopy() {
  return makeWorkspaceCopy("topogram-widget-baseline-");
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

function removeDataGridWidgetUsage(workspaceRoot) {
  const projectionPath = path.join(workspaceRoot, "projections", "proj-ui-contract.tg");
  const source = fs.readFileSync(projectionPath, "utf8");
  fs.writeFileSync(
    projectionPath,
    source.replace(
      /\n  widget_bindings \{\n    screen item_list region results widget widget_data_grid data rows from cap_list_items event row_select navigate item_detail\n  \}\n/,
      "\n"
    )
  );
}

test("widget kind validates and resolves from the app fixture", () => {
  const ast = parsePath(fixtureRoot);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const widget = resolved.graph.byKind.widget.find((entry) => entry.id === "widget_data_grid");
  assert.ok(widget);
  assert.equal(widget.widgetContract.id, "widget_data_grid");
  assert.equal(widget.widgetContract.props[0].name, "rows");
  assert.deepEqual(widget.widgetContract.patterns, ["resource_table", "data_grid_view"]);
  assert.deepEqual(widget.widgetContract.behaviors, [
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

test("widget validator rejects missing props and status", () => {
  const ast = workspaceFromSource(`
widget widget_missing_required {
  name "Missing Required"
  description "Invalid widget"
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /Missing required field 'props'/);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /Missing required field 'status'/);
});

test("widget validator rejects invalid patterns, regions, and event shapes", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Payload"
  description "Payload"
  status active
}

widget widget_invalid_refs {
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

test("widget validator rejects invalid behavior shorthand and structured bindings", () => {
  const ast = workspaceFromSource(`
shape shape_event_payload {
  name "Payload"
  description "Payload"
  status active
}

widget widget_invalid_behaviors {
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

test("widget validator rejects removed consumers field", () => {
  const ast = workspaceFromSource(`
projection proj_ui_contract {
  name "Shared UI"
  description "Shared UI projection"
  type ui_contract
  realizes []
  outputs [ui_contract]
  status active
}

widget widget_removed_consumers {
  name "Removed Consumers"
  description "Consumers used to point projection usage in the wrong direction"
  props {
    rows array required
  }
  consumers [proj_ui_contract]
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /Field 'consumers' is not allowed/);
});

test("ui-widget-contract generator emits selected and workspace contracts", () => {
  const ast = parsePath(fixtureRoot);
  const selected = generateWorkspace(ast, {
    target: "ui-widget-contract",
    widgetId: "widget_data_grid"
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.artifact.id, "widget_data_grid");
  assert.equal(selected.artifact.events[0].shape.id, "shape_output_item_card");

  const all = generateWorkspace(ast, { target: "ui-widget-contract" });
  assert.equal(all.ok, true);
  assert.equal(all.artifact.widget_data_grid.id, "widget_data_grid");
});

test("projection widget_bindings resolve widget placement and bindings", () => {
  const ast = parsePath(fixtureRoot);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const projection = resolved.graph.byKind.projection.find((entry) => entry.id === "proj_ui_contract");
  assert.ok(projection);
  assert.deepEqual(projection.widgetBindings, [
    {
      type: "widget_binding",
      screenId: "item_list",
      region: "results",
      widget: {
        id: "widget_data_grid",
        kind: "widget"
      },
      dataBindings: [
        {
          prop: "rows",
          source: {
            id: "cap_list_items",
            kind: "capability"
          }
        }
      ],
      eventBindings: [
        {
          event: "row_select",
          action: "navigate",
          target: {
            id: "item_detail",
            kind: "screen"
          }
        }
      ],
      raw: [
        "screen",
        "item_list",
        "region",
        "results",
        "widget",
        "widget_data_grid",
        "data",
        "rows",
        "from",
        "cap_list_items",
        "event",
        "row_select",
        "navigate",
        "item_detail"
      ],
      loc: projection.widgetBindings[0].loc
    }
  ]);

  const slice = generateWorkspace(ast, {
    target: "context-slice",
    projectionId: "proj_ui_contract"
  });
  assert.equal(slice.ok, true);
  assert.deepEqual(slice.artifact.depends_on.widgets, ["widget_data_grid"]);
  assert.equal(slice.artifact.related.widgets[0].id, "widget_data_grid");

  const concreteSlice = generateWorkspace(ast, {
    target: "context-slice",
    projectionId: "proj_web_surface"
  });
  assert.equal(concreteSlice.ok, true);
  assert.deepEqual(concreteSlice.artifact.depends_on.widgets, ["widget_data_grid"]);

  const webContract = generateWorkspace(ast, {
    target: "ui-surface-contract",
    projectionId: "proj_web_surface"
  });
  assert.equal(webContract.ok, true);
  assert.equal(webContract.artifact.widgets.widget_data_grid.id, "widget_data_grid");
  const itemList = webContract.artifact.screens.find((screen) => screen.id === "item_list");
  assert.deepEqual(itemList.widgets, [
      {
        type: "ui_widget_usage",
        region: "results",
        pattern: "resource_table",
        placement: "primary",
        widget: {
        id: "widget_data_grid",
        name: "Data Grid",
        category: "collection",
        version: "1.0"
      },
      dataBindings: [
        {
          prop: "rows",
          source: {
            id: "cap_list_items",
            kind: "capability"
          }
        }
      ],
      eventBindings: [
        {
          event: "row_select",
          action: "navigate",
          target: {
            id: "item_detail",
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
                    id: "item_detail",
                    kind: "screen"
                  }
                }
              ],
              effects: [
                {
                  type: "navigation",
                  event: "row_select",
                  target: {
                    id: "item_detail",
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
                id: "cap_list_items",
                kind: "capability"
              }
            }
          ],
          effects: [
            {
              type: "navigation",
              event: "row_select",
              target: {
                id: "item_detail",
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
                id: "cap_list_items",
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

test("widget-conformance-report passes valid inherited projection usage", () => {
  const ast = parsePath(fixtureRoot);
  const report = generateWorkspace(ast, {
    target: "widget-conformance-report",
    projectionId: "proj_web_surface"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.type, "widget_conformance_report");
  assert.deepEqual(report.artifact.filters, {
    projection: "proj_web_surface",
    widget: null
  });
  assert.equal(report.artifact.summary.total_usages, 1);
  assert.equal(report.artifact.summary.passed_usages, 1);
  assert.equal(report.artifact.summary.errors, 0);
  assert.equal(report.artifact.summary.warnings, 0);
  assert.deepEqual(report.artifact.summary.affected_widgets, ["widget_data_grid"]);
  assert.deepEqual(report.artifact.summary.affected_projections, ["proj_ui_contract", "proj_web_surface"]);
  assert.equal(report.artifact.projection_usages[0].projection.id, "proj_web_surface");
  assert.equal(report.artifact.projection_usages[0].source_projection.id, "proj_ui_contract");
  assert.equal(report.artifact.projection_usages[0].outcome, "pass");
  assert.equal(report.artifact.widget_contracts[0].id, "widget_data_grid");
  assert.deepEqual(report.artifact.widget_contracts[0].approvals, []);
  assert.equal(report.artifact.write_scope.paths.some((filePath) => filePath.endsWith("widget-data-grid.tg")), true);
  assert.equal(report.artifact.write_scope.paths.some((filePath) => filePath.endsWith("proj-web-surface.tg")), true);
  assert.equal(report.artifact.write_scope.paths.some((filePath) => filePath.endsWith("proj-ui-contract.tg")), true);
});

test("widget-conformance-report reports required props, action context, status, and approvals", () => {
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

widget widget_grid {
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
  type ui_contract
  realizes [cap_list_items]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_grid event row_select action cap_update_item
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));
  const report = generateWorkspace(ast, {
    target: "widget-conformance-report",
    projectionId: "proj_ui",
    widgetId: "widget_grid"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.total_usages, 1);
  assert.equal(report.artifact.summary.error_usages, 1);
  assert.equal(report.artifact.summary.errors, 2);
  assert.equal(report.artifact.summary.warnings, 1);
  assert.deepEqual(report.artifact.summary.affected_widgets, ["widget_grid"]);
  assert.deepEqual(report.artifact.summary.affected_projections, ["proj_ui"]);
  assert.deepEqual(
    report.artifact.checks.map((check) => check.code).sort(),
    [
      "widget_event_action_not_in_projection",
      "widget_required_prop_missing",
      "widget_status_not_active"
    ]
  );
  assert.equal(report.artifact.checks.find((check) => check.code === "widget_required_prop_missing").prop, "rows");
  assert.equal(report.artifact.widget_contracts[0].id, "widget_grid");
  assert.deepEqual(report.artifact.widget_contracts[0].approvals, ["design", "security"]);
  assert.deepEqual(report.artifact.widget_contracts[0].behaviors, [
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

test("widget-conformance-report surfaces behavior realizations and unbound emitted events", () => {
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

widget widget_grid {
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
  type ui_contract
  realizes [cap_list_items]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_grid data rows from cap_list_items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const report = generateWorkspace(ast, {
    target: "widget-conformance-report",
    projectionId: "proj_ui",
    widgetId: "widget_grid"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.total_usages, 1);
  assert.equal(report.artifact.summary.warning_usages, 1);
  assert.equal(report.artifact.summary.warnings, 1);
  assert.deepEqual(report.artifact.checks.map((check) => check.code), ["widget_behavior_event_unbound"]);
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

test("widget behavior action directives surface command effects", () => {
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

widget widget_grid {
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
  type ui_contract
  realizes [cap_list_items, cap_update_item]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_grid data rows from cap_list_items event row_update action cap_update_item
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const report = generateWorkspace(ast, {
    target: "widget-conformance-report",
    projectionId: "proj_ui",
    widgetId: "widget_grid"
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

test("widget behavior capability action directives surface command effects", () => {
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

widget widget_grid {
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
  type ui_contract
  realizes [cap_list_items, cap_update_item]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_grid data rows from cap_list_items event row_update action cap_update_item
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const report = generateWorkspace(ast, {
    target: "widget-conformance-report",
    projectionId: "proj_ui",
    widgetId: "widget_grid"
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

test("widget behavior capability action directives warn when unbound", () => {
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

widget widget_grid {
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
  type ui_contract
  realizes [cap_list_items, cap_update_item]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_grid data rows from cap_list_items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const report = generateWorkspace(ast, {
    target: "widget-conformance-report",
    projectionId: "proj_ui",
    widgetId: "widget_grid"
  });
  assert.equal(report.ok, true);
  assert.deepEqual(report.artifact.checks.map((check) => check.code), ["widget_behavior_action_unbound"]);
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
    target: "widget-behavior-report",
    projectionId: "proj_ui",
    widgetId: "widget_grid"
  });
  assert.equal(behaviorReport.ok, true);
  assert.equal(behaviorReport.artifact.type, "widget_behavior_report");
  assert.equal(behaviorReport.artifact.summary.total_usages, 1);
  assert.equal(behaviorReport.artifact.summary.total_behaviors, 1);
  assert.equal(behaviorReport.artifact.summary.partial, 1);
  assert.deepEqual(behaviorReport.artifact.summary.affected_widgets, ["widget_grid"]);
  assert.deepEqual(behaviorReport.artifact.summary.affected_projections, ["proj_ui"]);
  assert.deepEqual(behaviorReport.artifact.summary.affected_capabilities, ["cap_list_items", "cap_update_item"]);
  assert.deepEqual(behaviorReport.artifact.groups.widgets.map((group) => group.id), ["widget_grid"]);
  assert.deepEqual(behaviorReport.artifact.groups.screens.map((group) => group.id), ["item_list"]);
  assert.deepEqual(behaviorReport.artifact.groups.capabilities.map((group) => group.id), ["cap_list_items", "cap_update_item"]);
  assert.deepEqual(behaviorReport.artifact.groups.effects.map((group) => group.id), ["command"]);
  assert.equal(behaviorReport.artifact.behaviors[0].behavior.kind, "optimistic_update");
  assert.deepEqual(behaviorReport.artifact.behaviors[0].effect_types, ["command"]);
  assert.deepEqual(behaviorReport.artifact.behaviors[0].capabilities, ["cap_list_items", "cap_update_item"]);
  assert.equal(
    behaviorReport.artifact.highlights.some((highlight) =>
      highlight.code === "widget_behavior_action_unbound" &&
      highlight.capability === "cap_update_item"
    ),
    true
  );
});

test("widget-conformance-report filters by widget and rejects unknown selectors", () => {
  const ast = parsePath(fixtureRoot);
  const report = generateWorkspace(ast, {
    target: "widget-conformance-report",
    widgetId: "widget_data_grid"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.total_usages, 3);
  assert.deepEqual(report.artifact.summary.affected_widgets, ["widget_data_grid"]);
  assert.deepEqual(report.artifact.summary.affected_projections, ["proj_ui_contract", "proj_web_surface", "proj_web_surface_react"]);

  assert.throws(
    () => generateWorkspace(ast, {
      target: "widget-conformance-report",
      widgetId: "widget_does_not_exist"
    }),
    /No widget found with id 'widget_does_not_exist'/
  );
  assert.throws(
    () => generateWorkspace(ast, {
      target: "widget-conformance-report",
      projectionId: "proj_does_not_exist"
    }),
    /No projection found with id 'proj_does_not_exist'/
  );
});

test("projection widget_bindings validate widget props, events, and navigation targets", () => {
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

widget widget_grid {
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
  type ui_contract
  realizes [cap_list_items]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_grid data missing_rows from cap_list_items event missing_select navigate item_detail
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

test("projection widget_bindings are rejected on concrete UI projections", () => {
  const ast = workspaceFromSource(`
capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

shape shape_event_payload {
  name "Event Payload"
  description "Event payload"
  status active
}

widget widget_grid {
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

projection proj_web_surface {
  name "Web"
  description "Concrete web projection"
  type web_surface
  realizes [cap_list_items]
  outputs [ui_contract, web_app]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  screen_routes {
    screen item_list path /items
  }

  widget_bindings {
    screen item_list region results widget widget_grid data rows from cap_list_items event row_select navigate item_list
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /widget_bindings belongs on shared UI projections/);
});

test("concrete UI projections reject shared semantic UI ownership blocks", () => {
  const ast = workspaceFromSource(`
entity entity_item {
  name "Item"
  description "Item entity"
  fields {
    id uuid required
    title string required
  }
  status active
}

capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

projection proj_web_surface {
  name "Web"
  description "Concrete web projection"
  type web_surface
  realizes [cap_list_items]
  outputs [ui_contract, web_app]

  app_shell {
    brand "Items"
    shell top_nav
  }

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  collection_views {
    screen item_list pagination cursor
  }

  screen_actions {
    screen item_list action cap_list_items prominence primary placement toolbar
  }

  visibility_rules {
    action cap_list_items visible_if permission items.view
  }

  field_lookups {
    screen item_list field item_id entity entity_item label_field title
  }

  navigation {
    group main label "Main" placement primary pattern top_nav
    screen item_list group main label "Items" order 10 visible true default true
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  screen_routes {
    screen item_list path /items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  const messages = validation.errors.map((error) => error.message).join("\n");
  for (const key of [
    "screens",
    "collection_views",
    "screen_actions",
    "visibility_rules",
    "field_lookups",
    "app_shell",
    "navigation",
    "screen_regions"
  ]) {
    assert.match(
      messages,
      new RegExp(`${key} belongs on shared UI projections`),
      `expected concrete ownership rejection for ${key}`
    );
  }
});

test("shared UI projections reject concrete route ownership", () => {
  const ast = workspaceFromSource(`
capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

projection proj_ui_contract {
  name "Shared"
  description "Shared UI projection"
  type ui_contract
  realizes [cap_list_items]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_routes {
    screen item_list path /items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(
    validation.errors.map((error) => error.message).join("\n"),
    /screen_routes belongs on concrete UI projections/
  );
});

test("concrete UI projections inherit shared widget usage only", () => {
  const ast = workspaceFromSource(`
capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

widget widget_shared_grid {
  name "Shared Grid"
  description "Shared grid"
  props {
    rows array required
  }
  patterns [resource_table]
  regions [results]
  status active
}

projection proj_ui_contract {
  name "Shared"
  description "Shared UI projection"
  type ui_contract
  realizes [cap_list_items]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_shared_grid data rows from cap_list_items
  }

  status active
}

projection proj_web_surface {
  name "Web"
  description "Concrete web projection"
  type web_surface
  realizes [proj_ui_contract]
  outputs [ui_contract, web_app]

  screen_routes {
    screen item_list path /items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, validation.errors.map((error) => error.message).join("\n"));

  const webContract = generateWorkspace(ast, {
    target: "ui-surface-contract",
    projectionId: "proj_web_surface"
  });
  assert.equal(webContract.ok, true);
  assert.deepEqual(Object.keys(webContract.artifact.widgets).sort(), ["widget_shared_grid"]);
  const screen = webContract.artifact.screens.find((entry) => entry.id === "item_list");
  assert.deepEqual(screen.widgets.map((entry) => entry.widget.id), ["widget_shared_grid"]);

  const report = generateWorkspace(ast, {
    target: "widget-conformance-report",
    projectionId: "proj_web_surface"
  });
  assert.equal(report.ok, true);
  assert.equal(report.artifact.summary.total_usages, 1);
  assert.equal(report.artifact.summary.errors, 0);
  assert.deepEqual(report.artifact.summary.affected_widgets, ["widget_shared_grid"]);
  assert.deepEqual(report.artifact.projection_usages.map((entry) => entry.screen.kind), ["list"]);
});

test("ui design intent is shared-owned and inherited by concrete UI contracts", () => {
  const ast = workspaceFromSource(`
capability cap_view_items {
  name "View Items"
  description "View items"
  status active
}

projection proj_ui_contract {
  name "Shared"
  description "Shared UI projection"
  type ui_contract
  realizes [cap_view_items]
  outputs [ui_contract]

  design_tokens {
    density compact
    tone operational
    radius_scale small
    color_role primary accent
    color_role danger critical
    typography_role heading prominent
    typography_role body readable
    action_role primary prominent
    action_role destructive danger
    accessibility contrast aa
    accessibility motion reduced
    accessibility focus visible
    accessibility min_touch_target comfortable
  }

  screens {
    screen item_list kind list title "Items" load cap_view_items
  }

  status active
}

projection proj_web_surface {
  name "Web"
  description "Concrete web projection"
  type web_surface
  realizes [proj_ui_contract]
  outputs [ui_contract, web_app]

  screen_routes {
    screen item_list path /items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, validation.errors.map((error) => error.message).join("\n"));

  const webContract = generateWorkspace(ast, {
    target: "ui-surface-contract",
    projectionId: "proj_web_surface"
  });
  assert.equal(webContract.ok, true);
  assert.deepEqual(webContract.artifact.designTokens, {
    density: "compact",
    tone: "operational",
    radiusScale: "small",
    colorRoles: {
      danger: "critical",
      primary: "accent"
    },
    typographyRoles: {
      body: "readable",
      heading: "prominent"
    },
    actionRoles: {
      destructive: "danger",
      primary: "prominent"
    },
    accessibility: {
      contrast: "aa",
      focus: "visible",
      min_touch_target: "comfortable",
      motion: "reduced"
    }
  });
  assert.doesNotMatch(JSON.stringify(webContract.artifact.designTokens), /css|class|tailwind|swiftui/i);
});

test("ui design intent rejects concrete ownership and unknown taxonomy values", () => {
  const concreteAst = workspaceFromSource(`
projection proj_web_surface {
  name "Web"
  description "Concrete web projection"
  type web_surface
  outputs [ui_contract, web_app]

  design_tokens {
    density compact
  }

  status active
}
`);
  const concreteValidation = validateWorkspace(concreteAst);
  assert.equal(concreteValidation.ok, false);
  assert.match(concreteValidation.errors.map((error) => error.message).join("\n"), /design_tokens belongs on shared UI projections/);

  const taxonomyAst = workspaceFromSource(`
projection proj_ui_contract {
  name "Shared"
  description "Shared UI projection"
  type ui_contract
  outputs [ui_contract]

  design_tokens {
    density cramped
    tone loud
    radius_scale huge
    color_role brand accent
    typography_role title prominent
    action_role danger critical
    accessibility contrast weak
    accessibility sparkle true
    raw_css primary-button
  }

  status active
}
`);
  const taxonomyValidation = validateWorkspace(taxonomyAst);
  assert.equal(taxonomyValidation.ok, false);
  const messages = taxonomyValidation.errors.map((error) => error.message).join("\n");
  assert.match(messages, /density has invalid value 'cramped'/);
  assert.match(messages, /tone has invalid value 'loud'/);
  assert.match(messages, /radius_scale has invalid value 'huge'/);
  assert.match(messages, /color_role has invalid role 'brand'/);
  assert.match(messages, /typography_role has invalid role 'title'/);
  assert.match(messages, /action_role has invalid role 'danger'/);
  assert.match(messages, /accessibility 'contrast' has invalid value 'weak'/);
  assert.match(messages, /accessibility has invalid setting 'sparkle'/);
  assert.match(messages, /design_tokens has unknown key 'raw_css'/);
});

test("widget usage contracts carry resolved region patterns", () => {
  const ast = workspaceFromSource(`
capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

widget widget_grid {
  name "Grid"
  description "Grid"
  props {
    rows array required
  }
  patterns [resource_table, board_view]
  regions [results]
  status active
}

projection proj_ui_contract {
  name "Shared"
  description "Shared UI projection"
  type ui_contract
  realizes [cap_list_items]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
    screen item_board kind board title "Board" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
    screen item_board region results pattern board_view placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_grid data rows from cap_list_items
    screen item_board region results widget widget_grid data rows from cap_list_items
  }

  status active
}

projection proj_web_surface {
  name "Web"
  description "Concrete web projection"
  type web_surface
  realizes [proj_ui_contract]
  outputs [ui_contract, web_app]

  screen_routes {
    screen item_list path /items
    screen item_board path /items/board
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, validation.errors.map((error) => error.message).join("\n"));

  const webContract = generateWorkspace(ast, {
    target: "ui-surface-contract",
    projectionId: "proj_web_surface"
  });
  assert.equal(webContract.ok, true);
  const patterns = Object.fromEntries(
    webContract.artifact.screens.map((screen) => [screen.id, screen.widgets[0]?.pattern])
  );
  assert.deepEqual(patterns, {
    item_board: "board_view",
    item_list: "resource_table"
  });
});

test("web generation fails instead of silently omitting unsupported widget patterns", () => {
  const ast = workspaceFromSource(`
capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

widget widget_lookup {
  name "Lookup"
  description "Lookup widget"
  props {
    rows array required
  }
  patterns [lookup_select]
  regions [results]
  status active
}

projection proj_ui_contract {
  name "Shared"
  description "Shared UI projection"
  type ui_contract
  realizes [cap_list_items]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern lookup_select placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_lookup data rows from cap_list_items
  }

  status active
}

projection proj_web_surface {
  name "Web"
  description "Concrete web projection"
  type web_surface
  realizes [proj_ui_contract]
  outputs [ui_contract, web_app]

  screen_routes {
    screen item_list path /items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, validation.errors.map((error) => error.message).join("\n"));

  assert.throws(
    () => generateWorkspace(ast, {
      target: "sveltekit-app",
      projectionId: "proj_web_surface",
      implementation: APP_BASIC_IMPLEMENTATION
    }),
    /unsupported SvelteKit widget pattern 'lookup_select'/
  );
});

test("projection widget_bindings validate widget region and pattern compatibility", () => {
  const ast = workspaceFromSource(`
capability cap_list_items {
  name "List Items"
  description "List items"
  status active
}

widget widget_summary {
  name "Summary"
  description "Summary widget"
  props {
    rows array required
  }
  patterns [summary_stats]
  regions [toolbar]
  status active
}

projection proj_ui_contract {
  name "Shared UI"
  description "Shared UI projection"
  type ui_contract
  realizes [cap_list_items]
  outputs [ui_contract]

  screens {
    screen item_list kind list title "Items" load cap_list_items
  }

  screen_regions {
    screen item_list region results pattern resource_table placement primary
  }

  widget_bindings {
    screen item_list region results widget widget_summary data rows from cap_list_items
  }

  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  const messages = validation.errors.map((error) => error.message).join("\n");
  assert.match(messages, /supports regions \[toolbar\]/);
  assert.match(messages, /with pattern 'resource_table'.*supports patterns \[summary_stats\]/);
});

test("widget prop defaults preserve real values", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "ui-widget-contract",
    widgetId: "widget_data_grid"
  });
  assert.equal(result.ok, true);
  const props = Object.fromEntries(result.artifact.props.map((prop) => [prop.name, prop]));
  assert.deepEqual(props.selected_ids.defaultValue, []);
  assert.equal(props.loading.defaultValue, false);
  assert.equal(typeof props.loading.defaultValue, "boolean");
});

test("widget approvals are resolved and emitted in contracts", () => {
  const ast = workspaceFromSource(`
widget widget_requires_approval {
  name "Approval Widget"
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
  const widget = resolved.graph.byKind.widget.find((entry) => entry.id === "widget_requires_approval");
  assert.deepEqual(widget.approvals, ["design", "security"]);
  assert.deepEqual(widget.widgetContract.approvals, ["design", "security"]);

  const result = generateWorkspace(ast, {
    target: "ui-widget-contract",
    widgetId: "widget_requires_approval"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.artifact.approvals, ["design", "security"]);
});

test("widget prop defaults coerce booleans, numbers, lists, and null", () => {
  const ast = workspaceFromSource(`
widget widget_default_literals {
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
    target: "ui-widget-contract",
    widgetId: "widget_default_literals"
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

test("ui-widget-contract throws on unknown widget id", () => {
  const ast = parsePath(fixtureRoot);
  assert.throws(
    () => generateWorkspace(ast, {
      target: "ui-widget-contract",
      widgetId: "widget_does_not_exist"
    }),
    /No widget found with id 'widget_does_not_exist'/
  );
});

test("context-diff reports widget additions and modifications", () => {
    const baselineRoot = makeBaselineCopy();
  try {
    const baselineWidgetPath = path.join(baselineRoot, "widgets", "widget-data-grid.tg");
    fs.unlinkSync(baselineWidgetPath);
    removeDataGridWidgetUsage(baselineRoot);

    const additiveAst = parsePath(fixtureRoot);
    const additive = generateWorkspace(additiveAst, {
      target: "context-diff",
      fromTopogramPath: baselineRoot
    });
    assert.equal(additive.ok, true);
    const dataGridAdd = (additive.artifact.widgets || []).find((entry) => entry.id === "widget_data_grid");
    assert.ok(dataGridAdd, "expected additive widget entry");
    assert.equal(dataGridAdd.classification, "additive");

    const modifiedSource = fs
      .readFileSync(path.join(fixtureRoot, "widgets", "widget-data-grid.tg"), "utf8")
      .replace('version "1.0"', 'version "1.1"');
    fs.mkdirSync(path.dirname(baselineWidgetPath), { recursive: true });
    fs.writeFileSync(baselineWidgetPath, modifiedSource);

    const modifiedAst = parsePath(fixtureRoot);
    const modified = generateWorkspace(modifiedAst, {
      target: "context-diff",
      fromTopogramPath: baselineRoot
    });
    assert.equal(modified.ok, true);
    const dataGridModified = (modified.artifact.widgets || []).find((entry) => entry.id === "widget_data_grid");
    assert.ok(dataGridModified, "expected modified widget entry");
    assert.equal(dataGridModified.classification, "modified");
    assert.equal(dataGridModified.current.version, "1.0");
    assert.equal(dataGridModified.baseline.version, "1.1");
  } finally {
    fs.rmSync(baselineRoot, { recursive: true, force: true });
  }
});

test("context-diff reports projection impact for removed widgets from baseline", () => {
  const currentRoot = makeWorkspaceCopy("topogram-widget-current-");
  try {
    fs.unlinkSync(path.join(currentRoot, "widgets", "widget-data-grid.tg"));
    removeDataGridWidgetUsage(currentRoot);

    const currentAst = parsePath(currentRoot);
    const result = generateWorkspace(currentAst, {
      target: "context-diff",
      fromTopogramPath: fixtureRoot
    });
    assert.equal(result.ok, true);
    const dataGridRemoved = (result.artifact.widgets || []).find((entry) => entry.id === "widget_data_grid");
    assert.ok(dataGridRemoved, "expected removed widget entry");
    assert.equal(dataGridRemoved.classification, "removed");
    assert.deepEqual(
      result.artifact.affected_generated_surfaces.projections.map((projection) => projection.id),
      ["proj_ui_contract", "proj_web_surface", "proj_web_surface_react"]
    );
  } finally {
    fs.rmSync(currentRoot, { recursive: true, force: true });
  }
});

test("context-slice with --widget focuses on the widget contract closure", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "context-slice",
    widgetId: "widget_data_grid"
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.focus.kind, "widget");
  assert.equal(result.artifact.focus.id, "widget_data_grid");
  assert.ok(
    result.artifact.depends_on.projections.includes("proj_ui_contract"),
    `expected proj_ui_contract in depends_on.projections, got ${JSON.stringify(result.artifact.depends_on.projections)}`
  );
  assert.ok(
    result.artifact.depends_on.shapes.includes("shape_output_item_card"),
    `expected shape_output_item_card in depends_on.shapes, got ${JSON.stringify(result.artifact.depends_on.shapes)}`
  );
  assert.equal(result.artifact.review_boundary.automation_class, "review_required");
  assert.deepEqual(result.artifact.review_boundary.reasons, ["widget_surface"]);
  assert.equal(result.artifact.ui_agent_packet.type, "ui_agent_packet");
  assert.equal(result.artifact.ui_agent_packet.ownership.widgetPlacement, "ui_contract");
  assert.equal(result.artifact.ui_agent_packet.ownership.concreteSurfacesInherit, true);
  assert.deepEqual(result.artifact.ui_agent_packet.widget.patterns, ["resource_table", "data_grid_view"]);
  assert.deepEqual(result.artifact.ui_agent_packet.sourceUsages.map((entry) => entry.projection.id), ["proj_ui_contract"]);
  assert.deepEqual(result.artifact.ui_agent_packet.sourceUsages[0].usage, {
    screenId: "item_list",
    screen: {
      id: "item_list",
      kind: "list",
      title: "Items"
    },
    region: "results",
    regionContract: {
      name: "results",
      pattern: "resource_table",
      placement: "primary",
      title: null,
      state: null,
      variant: null
    },
    widgetId: "widget_data_grid",
    dataBindings: [{ prop: "rows", source: "cap_list_items" }],
    eventBindings: [{ event: "row_select", action: "navigate", target: "item_detail" }]
  });
  assert.ok(result.artifact.ui_agent_packet.inheritedBy.includes("proj_web_surface"));
  assert.ok(result.artifact.ui_agent_packet.requiredGates.some((gate) => gate.command === "topogram check"));
  assert.ok(result.artifact.ui_agent_packet.requiredGates.some((gate) => gate.command.includes("topogram widget behavior --widget widget_data_grid")));
});

test("context-slice with --projection exposes inherited UI agent packet", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "context-slice",
    projectionId: "proj_web_surface"
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.focus.kind, "projection");
  assert.equal(result.artifact.ui_agent_packet.type, "ui_agent_packet");
  assert.equal(result.artifact.ui_agent_packet.sharedProjection.id, "proj_ui_contract");
  assert.equal(result.artifact.ui_agent_packet.ownership.widgetPlacement, "ui_contract");
  assert.deepEqual(result.artifact.ui_agent_packet.widgets.map((usage) => usage.widgetId), ["widget_data_grid"]);
  assert.deepEqual(result.artifact.ui_agent_packet.widgets[0].screen, {
    id: "item_list",
    kind: "list",
    title: "Items"
  });
  assert.equal(result.artifact.ui_agent_packet.widgets[0].regionContract.pattern, "resource_table");
  assert.equal(result.artifact.ui_agent_packet.designTokens.find((entry) => entry.key === "density")?.role, "compact");
  assert.ok(result.artifact.ui_agent_packet.requiredGates.some((gate) => gate.command.includes("topogram widget check --projection proj_web_surface")));
});

test("context-slice with --widget preserves dependency references by kind", () => {
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
  type ui_contract
  realizes [cap_dep]
  outputs [ui_contract]
  status active
}

projection proj_from_cap {
  name "Capability Projection"
  description "Projection expanded from capability dependency"
  type ui_contract
  realizes [cap_dep]
  outputs [ui_contract]
  status active
}

projection proj_from_entity {
  name "Entity Projection"
  description "Projection expanded from entity dependency"
  type db_contract
  realizes [entity_dep]
  outputs [db_contract]
  tables {
    entity_dep table deps
  }
  status active
}

projection proj_from_shape {
  name "Shape Projection"
  description "Projection expanded from shape dependency"
  type ui_contract
  realizes [cap_shape]
  outputs [ui_contract]
  status active
}

widget widget_other {
  name "Other Widget"
  description "Other widget"
  props {
    label string required
  }
  status active
}

widget widget_dep_test {
  name "Dependency Widget"
  description "Widget with dependencies across statement kinds"
  props {
    rows array required
  }
  dependencies [shape_dep, entity_dep, cap_dep, proj_direct, widget_other]
  status active
}

verification ver_widget_dependencies {
  name "Widget dependency verification"
  description "Covers dependency-driven widget context"
  validates [shape_dep, entity_dep, cap_dep, proj_direct, widget_other]
  method smoke
  scenarios [widget_dependency_context]
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const result = generateWorkspace(ast, {
    target: "context-slice",
    widgetId: "widget_dep_test"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.artifact.depends_on.shapes, ["shape_dep"]);
  assert.deepEqual(result.artifact.depends_on.entities, ["entity_dep"]);
  assert.deepEqual(result.artifact.depends_on.capabilities, ["cap_dep"]);
  assert.deepEqual(result.artifact.depends_on.widgets, ["widget_other"]);
  assert.deepEqual(result.artifact.depends_on.projections, [
    "proj_direct",
    "proj_from_cap",
    "proj_from_entity",
    "proj_from_shape"
  ]);
  assert.deepEqual(result.artifact.depends_on.verifications, ["ver_widget_dependencies"]);
  assert.equal(result.artifact.related.shapes[0].id, "shape_dep");
  assert.equal(result.artifact.related.entities[0].id, "entity_dep");
  assert.equal(result.artifact.related.capabilities[0].id, "cap_dep");
  assert.equal(result.artifact.related.widgets[0].id, "widget_other");
  assert.deepEqual(result.artifact.related.projections.map((projection) => projection.id), [
    "proj_direct",
    "proj_from_cap",
    "proj_from_entity",
    "proj_from_shape"
  ]);
  assert.deepEqual(result.artifact.verification_targets.verification_ids, ["ver_widget_dependencies"]);
});

test("context-slice rejects unknown widget id", () => {
  const ast = parsePath(fixtureRoot);
  assert.throws(
    () => generateWorkspace(ast, {
      target: "context-slice",
      widgetId: "widget_does_not_exist"
    }),
    /No widget found with id 'widget_does_not_exist'/
  );
});
