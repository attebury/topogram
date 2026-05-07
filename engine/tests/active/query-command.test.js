import assert from "node:assert/strict";
import childProcess from "node:child_process";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const engineRoot = path.join(repoRoot, "engine");

function runCli(args, options = {}) {
  return childProcess.spawnSync(process.execPath, [path.join(engineRoot, "src", "cli.js"), ...args], {
    cwd: options.cwd || engineRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {}),
      PATH: options.env?.PATH || process.env.PATH || ""
    }
  });
}

test("query help lists discovery commands", () => {
  const queryHelp = runCli(["query", "--help"]);
  assert.equal(queryHelp.status, 0, queryHelp.stderr || queryHelp.stdout);
  assert.match(queryHelp.stdout, /Usage: topogram query list \[--json\]/);
  assert.match(queryHelp.stdout, /topogram query show <name> \[--json\]/);
  assert.match(queryHelp.stdout, /topogram query widget-behavior \[path\]/);
  assert.match(queryHelp.stdout, /widget-behavior/);
  assert.match(queryHelp.stdout, /recommended artifact queries/);
});

test("query list exposes stable query definitions", () => {
  const queryList = runCli(["query", "list", "--json"]);
  assert.equal(queryList.status, 0, queryList.stderr || queryList.stdout);
  const payload = JSON.parse(queryList.stdout);
  assert.equal(payload.type, "query_list");
  assert.equal(payload.version, 1);

  const componentBehaviorQuery = payload.queries.find((query) => query.name === "widget-behavior");
  assert.ok(componentBehaviorQuery);
  assert.equal(componentBehaviorQuery.output, "widget_behavior_report");
  assert.match(componentBehaviorQuery.purpose, /widget behavior/);
  assert.deepEqual(componentBehaviorQuery.selectors, ["projection", "widget"]);
  assert.deepEqual(componentBehaviorQuery.args, ["[path]", "[--projection <id>]", "[--widget <id>]", "[--json]"]);
  assert.match(componentBehaviorQuery.example, /topogram query widget-behavior/);
});

test("query show exposes one query definition", () => {
  const queryShow = runCli(["query", "show", "widget-behavior", "--json"]);
  assert.equal(queryShow.status, 0, queryShow.stderr || queryShow.stdout);
  const payload = JSON.parse(queryShow.stdout);
  assert.equal(payload.type, "query_definition");
  assert.equal(payload.version, 1);
  assert.equal(payload.query.name, "widget-behavior");
  assert.equal(payload.query.output, "widget_behavior_report");
  assert.deepEqual(payload.query.selectors, ["projection", "widget"]);

  const queryShowHuman = runCli(["query", "show", "widget-behavior"]);
  assert.equal(queryShowHuman.status, 0, queryShowHuman.stderr || queryShowHuman.stdout);
  assert.match(queryShowHuman.stdout, /Query: widget-behavior/);
  assert.match(queryShowHuman.stdout, /Purpose: Show how reusable widget behavior/);
  assert.match(queryShowHuman.stdout, /Output: widget_behavior_report/);
});

test("query show rejects unknown query names", () => {
  const unknownQueryShow = runCli(["query", "show", "not-a-query", "--json"]);
  assert.equal(unknownQueryShow.status, 1);
  assert.match(unknownQueryShow.stderr, /Unknown query 'not-a-query'/);
  assert.match(unknownQueryShow.stderr, /topogram query list/);
});
