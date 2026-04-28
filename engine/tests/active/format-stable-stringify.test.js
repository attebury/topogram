import test from "node:test";
import assert from "node:assert/strict";
import { stableStringify } from "../../src/format.js";

test("stableStringify sorts object keys recursively and keeps array order", () => {
  const input = {
    zeta: 1,
    alpha: {
      second: true,
      first: "value"
    },
    list: [
      { b: 2, a: 1 },
      "tail"
    ]
  };

  assert.equal(
    stableStringify(input),
    `{
  "alpha": {
    "first": "value",
    "second": true
  },
  "list": [
    {
      "a": 1,
      "b": 2
    },
    "tail"
  ],
  "zeta": 1
}`
  );
});
