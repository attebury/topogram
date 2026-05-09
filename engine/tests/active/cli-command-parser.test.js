import assert from "node:assert/strict";
import test from "node:test";

import { parseSplitCommandArgs } from "../../src/cli/command-parser.js";

test("split command parser handles extracted command families", () => {
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
});

test("split command parser leaves unsplit command families to the legacy parser", () => {
  assert.equal(parseSplitCommandArgs(["query", "slice", "./topogram"]), null);
  assert.equal(parseSplitCommandArgs(["generate"]), null);
});
