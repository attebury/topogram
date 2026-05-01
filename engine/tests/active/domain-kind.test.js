import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parsePath, parseSource } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { validateWorkspace } from "../../src/validator.js";
import { generateWorkspace } from "../../src/generator/index.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "domains", "feedlot");

function workspaceFromSource(source) {
  return {
    root: "<memory>",
    files: [parseSource(source, "domain-test.tg")],
    docs: []
  };
}

test("domain fixture parses and validates with no errors", () => {
  const ast = parsePath(fixtureRoot);
  const validation = validateWorkspace(ast);
  assert.equal(
    validation.ok,
    true,
    JSON.stringify(validation.errors, null, 2)
  );
  assert.equal(validation.errors.length, 0);
});

test("resolver builds members back-links per domain", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);

  const rnf = resolved.graph.byKind.domain.find((d) => d.id === "dom_rnf");
  assert.ok(rnf);
  assert.deepEqual(
    rnf.members.capabilities.sort(),
    ["cap_call_feed", "cap_monitor_loads"]
  );
  assert.deepEqual(
    rnf.members.entities.sort(),
    ["entity_feed_call", "entity_route"]
  );
  assert.deepEqual(rnf.members.rules, ["rule_draft_persistence"]);
  assert.deepEqual(rnf.members.verifications, ["verification_call_feed_save"]);

  const feedInventory = resolved.graph.byKind.domain.find((d) => d.id === "dom_feed_inventory");
  assert.ok(feedInventory);
  assert.equal(feedInventory.members.entities.length, 3);
  assert.equal(feedInventory.members.capabilities.length, 2);

  const drugtrac = resolved.graph.byKind.domain.find((d) => d.id === "dom_drugtrac");
  assert.ok(drugtrac);
  assert.deepEqual(drugtrac.members.verifications, ["verification_safe_to_ship"]);
});

test("resolvedDomain pointer is populated on tagged statements", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);

  const callFeed = resolved.graph.byKind.capability.find((c) => c.id === "cap_call_feed");
  assert.ok(callFeed.resolvedDomain);
  assert.equal(callFeed.resolvedDomain.id, "dom_rnf");
  assert.equal(callFeed.resolvedDomain.target.kind, "domain");

  const party = resolved.graph.byKind.entity.find((e) => e.id === "entity_party");
  assert.equal(party.resolvedDomain, null);
});

test("query slice --domain returns the focused subgraph", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "context-slice",
    domainId: "dom_rnf"
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.focus.kind, "domain");
  assert.equal(result.artifact.focus.id, "dom_rnf");
  assert.deepEqual(
    result.artifact.depends_on.capabilities,
    ["cap_call_feed", "cap_monitor_loads"]
  );
  assert.deepEqual(
    result.artifact.depends_on.projections,
    ["proj_rnf_desktop", "proj_rnf_mobile"]
  );
  assert.deepEqual(
    result.artifact.review_boundary.reasons,
    ["domain_surface"]
  );
});

test("domain-coverage produces a per-platform realization matrix", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "domain-coverage",
    domainId: "dom_rnf"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.artifact.platforms, ["desktop", "maui"]);
  assert.equal(result.artifact.coverage_matrix.cap_call_feed.desktop, true);
  assert.equal(result.artifact.coverage_matrix.cap_call_feed.maui, true);
  assert.equal(result.artifact.coverage_matrix.cap_monitor_loads.desktop, true);
  assert.equal(result.artifact.coverage_matrix.cap_monitor_loads.maui, false);
});

test("domain-list returns a sorted navigation summary", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, { target: "domain-list" });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.domains.length, 3);
  const ids = result.artifact.domains.map((d) => d.id);
  assert.deepEqual(ids, ["dom_drugtrac", "dom_feed_inventory", "dom_rnf"]);
  for (const domain of result.artifact.domains) {
    assert.ok(domain.members_count > 0);
  }
});

test("domain-page emits a markdown artifact at the canonical path", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "domain-page",
    domainId: "dom_rnf"
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.output.path, "topogram/docs-generated/domains/dom_rnf.md");
  assert.match(result.artifact.output.contents, /# Read-N-Feed/);
  assert.match(result.artifact.output.contents, /## In scope/);
  assert.match(result.artifact.output.contents, /## Per-platform coverage/);
  assert.match(result.artifact.output.contents, /\| desktop \| maui \|/);
});

test("validator rejects a domain field referencing an unknown id", () => {
  const ast = workspaceFromSource(`
domain dom_known {
  name "Known"
  description "Existing domain"
  status active
}

capability cap_bad {
  name "Bad"
  description "References missing domain"
  domain dom_missing
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(
    validation.errors.map((error) => error.message).join("\n"),
    /capability cap_bad domain references missing domain 'dom_missing'/
  );
});

test("validator rejects a domain field referencing the wrong kind", () => {
  const ast = workspaceFromSource(`
entity entity_party {
  name "Party"
  description "A party"
  fields {
    id string required
  }
  status active
}

capability cap_bad_target {
  name "Bad target"
  description "References an entity as a domain"
  domain entity_party
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(
    validation.errors.map((error) => error.message).join("\n"),
    /must reference a domain, found entity 'entity_party'/
  );
});

test("validator rejects a domain identifier without the dom_ prefix", () => {
  const ast = workspaceFromSource(`
domain feed_inventory {
  name "Bad prefix"
  description "Invalid"
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(
    validation.errors.map((error) => error.message).join("\n"),
    /Domain identifier 'feed_inventory' must match/
  );
});

test("validator detects parent_domain self-reference", () => {
  const ast = workspaceFromSource(`
domain dom_self {
  name "Self"
  description "Self-parent"
  status active
  parent_domain dom_self
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(
    validation.errors.map((error) => error.message).join("\n"),
    /cannot be its own parent_domain/
  );
});

test("validator detects a parent_domain cycle across two domains", () => {
  const ast = workspaceFromSource(`
domain dom_alpha {
  name "Alpha"
  description "Alpha"
  status active
  parent_domain dom_beta
}

domain dom_beta {
  name "Beta"
  description "Beta"
  status active
  parent_domain dom_alpha
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(
    validation.errors.map((error) => error.message).join("\n"),
    /parent_domain chain forms a cycle/
  );
});

test("validator rejects a domain field on a kind that cannot carry one", () => {
  const ast = workspaceFromSource(`
domain dom_known {
  name "Known"
  description "Known"
  status active
}

term term_party {
  name "Party"
  description "Generic party"
  domain dom_known
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, false);
  assert.match(
    validation.errors.map((error) => error.message).join("\n"),
    /Field 'domain' is not allowed on term term_party/
  );
});

test("workspace inventory reports domains alongside other kinds", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const domainIds = resolved.graph.byKind.domain.map((d) => d.id).sort();
  assert.deepEqual(domainIds, ["dom_drugtrac", "dom_feed_inventory", "dom_rnf"]);
});

test("query slice --domain throws on unknown domain id", () => {
  const ast = parsePath(fixtureRoot);
  assert.throws(() => {
    generateWorkspace(ast, {
      target: "context-slice",
      domainId: "dom_does_not_exist"
    });
  }, /No domain found with id 'dom_does_not_exist'/);
});
