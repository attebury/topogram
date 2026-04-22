import test from "node:test";
import assert from "node:assert/strict";
import { lex } from "../../src/parser.js";

test("lex ignores comments and preserves escaped string values", () => {
  const tokens = lex(
    `entity entity_task {
  name "Task\\nTitle" # comment
  tags [alpha, beta]
}
`,
    "memory.tg"
  );

  const words = tokens.filter((token) => token.type === "word").map((token) => token.value);
  assert.deepEqual(words, ["entity", "entity_task", "name", "tags", "alpha", "beta"]);

  const stringToken = tokens.find((token) => token.type === "string");
  assert.ok(stringToken);
  assert.equal(stringToken.value, "Task\nTitle");
});

test("lex tracks line and column across newlines", () => {
  const tokens = lex("entity thing {\n  title \"Hello\"\n}\n", "positions.tg");
  const titleToken = tokens.find((token) => token.type === "word" && token.value === "title");
  assert.ok(titleToken);
  assert.equal(titleToken.start.line, 2);
  assert.equal(titleToken.start.column, 3);
});

test("lex reports unterminated strings with file context", () => {
  assert.throws(
    () => lex('entity broken { name "unterminated', "broken.tg"),
    /broken\.tg:1:\d+ Unterminated string literal/
  );
});
