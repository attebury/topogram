import assert from "node:assert/strict";
import test from "node:test";

import { generateWorkspace } from "../../src/generator/index.js";
import { parseSource } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { validateWorkspace } from "../../src/validator.js";

function workspaceFromSource(source) {
  return {
    root: "<memory>",
    files: [parseSource(source, "journey-test.tg")],
    docs: []
  };
}

const validJourneySource = `
actor actor_developer {
  name "Developer"
  description "Builds with Topogram."
  status active
}

domain dom_app {
  name "App"
  description "App domain."
  status active
}

capability cap_create_project {
  name "Create Project"
  description "Create a project."
  actors [actor_developer]
  status active
}

projection proj_cli {
  name "CLI"
  description "CLI surface."
  type cli_surface
  realizes [cap_create_project]
  outputs [stdout]
  commands {
    command new capability cap_create_project mode read_only
  }
  status active
}

journey journey_greenfield_start {
  name "Greenfield Start"
  description "Developer starts a project from a template."
  status canonical
  domain dom_app
  actors [actor_developer]
  goal "Create a valid generated app from a copied Topogram starter."
  related_capabilities [cap_create_project]
  related_projections [proj_cli]
  success_signals ["topogram check passes"]
  failure_signals ["generated files are edited as source"]

  step {
    id inspect_templates
    intent "Find available templates."
    commands ["topogram template list --json"]
    expects ["Template aliases are visible."]
  }

  step {
    id create_project
    intent "Copy the selected template into a project."
    after [inspect_templates]
    commands ["topogram copy hello-web ./my-app"]
    expects ["Project contains topo/ and topogram.project.json."]
  }

  alternate {
    id use_package_spec
    from inspect_templates
    condition "The template is not in the catalog."
    commands ["topogram copy @topogram/template-hello-web ./my-app"]
  }
}

verification verification_journey_start {
  name "Journey Start Verification"
  description "Verifies the journey."
  validates [journey_greenfield_start]
  method journey
  scenarios [greenfield]
  status active
}
`;

test("journey records validate and resolve as first-class graph statements", () => {
  const workspace = workspaceFromSource(validJourneySource);
  const validation = validateWorkspace(workspace);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

  const resolved = resolveWorkspace(workspace);
  assert.equal(resolved.ok, true, JSON.stringify(resolved.validation?.errors, null, 2));
  const journey = resolved.graph.byKind.journey.find((item) => item.id === "journey_greenfield_start");
  assert.ok(journey);
  assert.equal(journey.goal, "Create a valid generated app from a copied Topogram starter.");
  assert.deepEqual(journey.steps.map((step) => step.id), ["inspect_templates", "create_project"]);
  assert.deepEqual(journey.steps[1].after, ["inspect_templates"]);
  assert.equal(journey.alternates[0].from, "inspect_templates");

  const domain = resolved.graph.byKind.domain.find((item) => item.id === "dom_app");
  assert.ok(domain.members.journeys.includes("journey_greenfield_start"));
});

test("journey query slice includes ordered steps, alternates, and related graph context", () => {
  const workspace = workspaceFromSource(validJourneySource);
  const result = generateWorkspace(workspace, {
    target: "context-slice",
    journeyId: "journey_greenfield_start"
  });
  assert.equal(result.ok, true, JSON.stringify(result.validation, null, 2));
  assert.equal(result.artifact.focus.kind, "journey");
  assert.deepEqual(result.artifact.steps.map((step) => step.id), ["inspect_templates", "create_project"]);
  assert.equal(result.artifact.alternates[0].id, "use_package_spec");
  assert.ok(result.artifact.depends_on.capabilities.includes("cap_create_project"));
  assert.ok(result.artifact.depends_on.projections.includes("proj_cli"));
  assert.ok(result.artifact.depends_on.verifications.includes("verification_journey_start"));
});

test("journey validation rejects malformed ordered records", () => {
  const invalid = validateWorkspace(workspaceFromSource(`
actor actor_developer {
  name "Developer"
  description "Builds with Topogram."
  status active
}

journey journey_bad {
  name "Bad"
  description "Bad journey."
  status canonical
  actors [actor_developer]
  goal "Do a thing."

  step {
    id duplicate
    intent "First."
  }

  step {
    id duplicate
    intent "Second."
    after [missing_step]
    unsupported true
  }

  alternate {
    id detour
    from missing_step
    condition "Missing source step."
  }
}
`));

  assert.equal(invalid.ok, false);
  const messages = invalid.errors.map((error) => error.message).join("\n");
  assert.match(messages, /duplicate step 'duplicate'/);
  assert.match(messages, /after references missing step 'missing_step'/);
  assert.match(messages, /Unsupported 'step' field 'unsupported'/);
  assert.match(messages, /alternate 'detour' from references missing step 'missing_step'/);
});
