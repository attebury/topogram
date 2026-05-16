import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parsePath, parseSource } from "../../src/parser.js";
import { resolveWorkspace } from "../../src/resolver.js";
import { validateWorkspace } from "../../src/validator.js";
import { generateWorkspace } from "../../src/generator/index.js";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = path.join(engineRoot, "tests", "fixtures", "domains", "commerce");

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

  const fulfillment = resolved.graph.byKind.domain.find((d) => d.id === "dom_order_fulfillment");
  assert.ok(fulfillment);
  assert.deepEqual(
    fulfillment.members.capabilities.sort(),
    ["cap_fulfill_order", "cap_monitor_shipments"]
  );
  assert.deepEqual(
    fulfillment.members.entities.sort(),
    ["entity_fulfillment_batch", "entity_pick_route"]
  );
  assert.deepEqual(fulfillment.members.rules, ["rule_draft_persistence"]);
  assert.deepEqual(fulfillment.members.verifications, ["verification_fulfill_order_save"]);

  const inventory = resolved.graph.byKind.domain.find((d) => d.id === "dom_inventory");
  assert.ok(inventory);
  assert.equal(inventory.members.entities.length, 3);
  assert.equal(inventory.members.capabilities.length, 2);

  const support = resolved.graph.byKind.domain.find((d) => d.id === "dom_support");
  assert.ok(support);
  assert.deepEqual(support.members.verifications, ["verification_sla_status"]);
});

test("resolvedDomain pointer is populated on tagged statements", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);

  const fulfillOrder = resolved.graph.byKind.capability.find((c) => c.id === "cap_fulfill_order");
  assert.ok(fulfillOrder.resolvedDomain);
  assert.equal(fulfillOrder.resolvedDomain.id, "dom_order_fulfillment");
  assert.equal(fulfillOrder.resolvedDomain.target.kind, "domain");

  const party = resolved.graph.byKind.entity.find((e) => e.id === "entity_party");
  assert.equal(party.resolvedDomain, null);
});

test("query slice --domain returns the focused subgraph", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "context-slice",
    domainId: "dom_order_fulfillment"
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.focus.kind, "domain");
  assert.equal(result.artifact.focus.id, "dom_order_fulfillment");
  assert.deepEqual(
    result.artifact.depends_on.capabilities,
    ["cap_fulfill_order", "cap_monitor_shipments"]
  );
  assert.deepEqual(
    result.artifact.depends_on.projections,
    ["proj_fulfillment_mobile", "proj_fulfillment_web"]
  );
  assert.deepEqual(
    result.artifact.review_boundary.reasons,
    ["domain_surface"]
  );
});

test("domain-coverage produces a per-type realization matrix", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "domain-coverage",
    domainId: "dom_order_fulfillment"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.artifact.projectionTypes, ["ios_surface", "web_surface"]);
  assert.equal(result.artifact.coverage_matrix.cap_fulfill_order.web_surface, true);
  assert.equal(result.artifact.coverage_matrix.cap_fulfill_order.ios_surface, true);
  assert.equal(result.artifact.coverage_matrix.cap_monitor_shipments.web_surface, true);
  assert.equal(result.artifact.coverage_matrix.cap_monitor_shipments.ios_surface, false);
});

test("domain-list returns a sorted navigation summary", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, { target: "domain-list" });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.domains.length, 3);
  const ids = result.artifact.domains.map((d) => d.id);
  assert.deepEqual(ids, ["dom_inventory", "dom_order_fulfillment", "dom_support"]);
  for (const domain of result.artifact.domains) {
    assert.ok(domain.members_count > 0);
  }
});

test("domain-page emits a markdown artifact at the canonical path", () => {
  const ast = parsePath(fixtureRoot);
  const result = generateWorkspace(ast, {
    target: "domain-page",
    domainId: "dom_order_fulfillment"
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.output.path, "topo/docs-generated/domains/dom_order_fulfillment.md");
  assert.match(result.artifact.output.contents, /# Order Fulfillment/);
  assert.match(result.artifact.output.contents, /## In scope/);
  assert.match(result.artifact.output.contents, /## Per-type coverage/);
  assert.match(result.artifact.output.contents, /\| ios_surface \| web_surface \|/);
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

test("validator accepts domain-tagged terms and indexes them under domain members", () => {
  const ast = workspaceFromSource(`
domain dom_known {
  name "Known"
  description "Known"
  status active
}

term term_party {
  name "Party"
  description "Generic party"
  category business_language
  domain dom_known
  status active
}
`);
  const validation = validateWorkspace(ast);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));
  const resolved = resolveWorkspace(ast);
  assert.equal(resolved.ok, true);
  const domain = resolved.graph.byKind.domain.find((entry) => entry.id === "dom_known");
  assert.deepEqual(domain.members.terms, ["term_party"]);
});

test("workspace inventory reports domains alongside other kinds", () => {
  const ast = parsePath(fixtureRoot);
  const resolved = resolveWorkspace(ast);
  const domainIds = resolved.graph.byKind.domain.map((d) => d.id).sort();
  assert.deepEqual(domainIds, ["dom_inventory", "dom_order_fulfillment", "dom_support"]);
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
