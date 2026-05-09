import assert from "node:assert/strict";
import test from "node:test";

import { parseSplitCommandArgs } from "../../src/cli/command-parser.js";

test("split command parser handles extracted command families", () => {
  assert.deepEqual(parseSplitCommandArgs(["new", "./starter", "--template", "hello-web"]), {
    newProject: true,
    inputPath: "./starter"
  });
  assert.deepEqual(parseSplitCommandArgs(["create", "./starter"]), {
    newProject: true,
    inputPath: "./starter"
  });
  assert.deepEqual(parseSplitCommandArgs(["new", "--list-templates"]), {
    templateList: true,
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["generate"]), {
    generateTarget: "app-bundle",
    write: true,
    inputPath: "./topogram",
    defaultOutDir: "./app"
  });
  assert.deepEqual(parseSplitCommandArgs(["generate", "./custom-topogram"]), {
    generateTarget: "app-bundle",
    write: true,
    inputPath: "./custom-topogram",
    defaultOutDir: "./app"
  });
  assert.deepEqual(parseSplitCommandArgs(["generate", "app", "./custom-topogram"]), {
    generateTarget: "app-bundle",
    write: true,
    inputPath: "./custom-topogram",
    defaultOutDir: "./app"
  });
  assert.deepEqual(parseSplitCommandArgs(["version"]), { version: true, inputPath: null });
  assert.deepEqual(parseSplitCommandArgs(["--version"]), { version: true, inputPath: null });
  assert.deepEqual(parseSplitCommandArgs(["query", "list", "--json"]), { queryList: true, inputPath: null });
  assert.deepEqual(parseSplitCommandArgs(["query", "show", "widget-behavior", "--json"]), {
    queryShow: true,
    queryShowName: "widget-behavior",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["query", "show"]), {
    queryShow: true,
    queryShowName: null,
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["query", "show", "--json"]), {
    queryShow: true,
    queryShowName: "--json",
    inputPath: null
  });
  assert.deepEqual(parseSplitCommandArgs(["check"]), { check: true, inputPath: "./topogram" });
  assert.deepEqual(parseSplitCommandArgs(["check", "./custom-topogram"]), {
    check: true,
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["agent", "brief"]), {
    agentBrief: true,
    inputPath: "./topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["agent", "brief", "./custom-topogram", "--json"]), {
    agentBrief: true,
    inputPath: "./custom-topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["widget", "check"]), {
    widgetCheck: true,
    inputPath: "./topogram"
  });
  assert.deepEqual(parseSplitCommandArgs(["widget", "behavior", "./custom-topogram", "--json"]), {
    widgetBehavior: true,
    inputPath: "./custom-topogram"
  });
});

test("split command parser leaves unsplit command families to the legacy parser", () => {
  assert.equal(parseSplitCommandArgs(["query", "slice", "./topogram"]), null);
  assert.equal(parseSplitCommandArgs(["generate", "journeys", "./topogram"]), null);
});
