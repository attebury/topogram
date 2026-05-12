import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parsePath, parseSource } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { validateWorkspace } from "../../src/validator.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "workspaces", "cli-surface-basic", "topo");

function workspaceFromSource(source) {
  return {
    root: "<memory>",
    files: [parseSource(source, "cli-surface-test.tg")],
    docs: []
  };
}

test("cli_surface fixture validates and resolves commands", () => {
  const validation = validateWorkspace(parsePath(fixtureRoot));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const resolved = resolveWorkspace(parsePath(fixtureRoot));
  assert.equal(resolved.ok, true);
  const projection = resolved.graph.byKind.projection.find((entry) => entry.id === "proj_cli_surface");
  assert.ok(projection);
  assert.equal(projection.type, "cli_surface");
  assert.deepEqual(projection.commands.map((command) => command.id), ["check", "extract"]);
  assert.equal(projection.commands[0].capability.id, "cap_check_topogram");
  assert.equal(projection.commands[0].mode, "read_only");
  assert.equal(projection.commandOptions[0].name, "json");
  assert.equal(projection.commandOptions[1].values.includes("cli"), true);
  assert.equal(projection.commandOutputs[0].schema.id, "shape_check_result");
  assert.equal(projection.commandEffects[1].effect, "writes_workspace");
  assert.equal(projection.commandExamples[0].example, "topogram check --json");
});

test("cli_surface rejects unknown capability references", () => {
  const validation = validateWorkspace(workspaceFromSource(`
capability cap_known {
  name "Known"
  description "Known command"
  status active
}

projection proj_cli_surface {
  name "CLI"
  description "CLI"
  type cli_surface
  realizes [cap_known]
  outputs [maintained_app]
  commands {
    command check capability cap_missing usage "tool check" mode read_only
  }
  status active
}
`));

  assert.equal(validation.ok, false);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /references unknown capability 'cap_missing'/);
});

test("cli_surface rejects malformed option and effect entries", () => {
  const validation = validateWorkspace(workspaceFromSource(`
capability cap_check {
  name "Check"
  description "Check"
  status active
}

projection proj_cli_surface {
  name "CLI"
  description "CLI"
  type cli_surface
  realizes [cap_check]
  outputs [maintained_app]
  commands {
    command check capability cap_check usage "tool check" mode read_only
  }
  command_options {
    command check option json type object
  }
  command_effects {
    command check effect mutates_everything
  }
  status active
}
`));

  assert.equal(validation.ok, false);
  const messages = validation.errors.map((error) => error.message).join("\n");
  assert.match(messages, /has invalid type 'object'/);
  assert.match(messages, /has invalid effect 'mutates_everything'/);
});

test("cli surface blocks are rejected on non-cli projections", () => {
  const validation = validateWorkspace(workspaceFromSource(`
capability cap_check {
  name "Check"
  description "Check"
  status active
}

projection proj_api {
  name "API"
  description "API"
  type api_contract
  realizes [cap_check]
  outputs [api]
  commands {
    command check capability cap_check usage "tool check" mode read_only
  }
  status active
}
`));

  assert.equal(validation.ok, false);
  assert.match(validation.errors.map((error) => error.message).join("\n"), /commands belongs on cli_surface projections/);
});
