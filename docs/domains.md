# Domains

The `domain` statement kind groups a workspace's spec by business slice
(FIS, RNF, DrugTrac, etc.). It exists for the same reason a 600-statement
workspace eventually gets unreadable as one flat namespace: humans and
agents need a smaller scope to reason about.

`domain` is orthogonal to `projection.platform`. A capability lives in a
domain (`dom_rnf`) and is realized by projections targeting one or more
platforms (`desktop`, `maui`, `mcp`). The two axes never collide; the
combination falls out as a coverage matrix from the existing graph.

## When to author a domain

Add a `domain` statement when:

- The spec has crossed roughly 100 statements and a clear business
  vocabulary is emerging (feed inventory, cattle management, etc.).
- A new contributor needs to know which subset of the spec to read first.
- You want per-domain coverage (which platforms realize FIS today?).
- You want to slice context for an agent (`--domain dom_rnf` returns
  only the relevant capabilities, entities, rules, projections, and
  verifications).

Skip it when:

- The workspace is small (fewer than ~100 statements) and the flat
  namespace is still scannable.
- Every spec belongs to one domain (the field becomes noise).

## Canonical shape

```text
domain dom_feed_inventory {
  name "Feed Inventory System"
  description "Commodity master, storage bins, milling, contracts, levies"
  in_scope [
    "Commodity master data and nutrient profiles"
    "Storage bin definition and tracking"
    "Physical inventory counts and adjustments"
    "Milled ingredient formulation and yield tracking"
    "Commodity contracts and forward pricing"
    "Grain levies and UOM conversions"
  ]
  out_of_scope [
    "Feed ration formulation (see dom_rnf)"
    "Mobile inventory audits"
    "Commodity futures trading integration"
  ]
  owners [actor_feed_mill_supervisor, actor_commodity_buyer]
  aliases ["FIS", "Feed Inventory"]
  status active
}
```

Required: `name`, `description`, `status`. Optional: `in_scope`,
`out_of_scope`, `owners`, `parent_domain`, `aliases`.

The identifier must match `^dom_[a-z][a-z0-9_]*$`. Status reuses the
global vocabulary (`draft`, `proposed`, `active`, `deprecated`).

## Tagging existing statements

Add an optional singular `domain` field to a workhorse kind:

```text
capability cap_call_feed {
  name "Call Feed"
  description "Daily feed-calling workflow"
  domain dom_rnf
  actors [actor_feed_caller]
  reads [entity_pen, entity_route]
  creates [entity_feed_call]
  status active
}
```

Cross-cutting statements (`entity_party`, `rule_audit_trail_required`,
shared terms, actors, roles, enums, shapes, components, projections)
omit `domain`. The validator only allows the field on
`capability`, `entity`, `rule`, `verification`, `orchestration`,
`operation`, and `decision`.

A statement may belong to **at most one domain**. If a capability
legitimately spans two business slices, split it or move it to a
`dom_shared` umbrella.

## Resolver-derived back-links

The resolver builds reverse indexes so a domain knows its members:

```text
domain.members.capabilities       [cap_call_feed, cap_pen_inventory, ...]
domain.members.entities           [entity_pen, entity_feed_call, ...]
domain.members.rules              [rule_draft_persistence, ...]
domain.members.verifications      [verification_call_feed_save, ...]
domain.members.orchestrations     [...]
domain.members.operations         [...]
domain.members.decisions          [...]
```

Each tagged statement also carries a `resolvedDomain` pointer parallel
to `resolvedReferences`.

## Folder convention (engine-invisible)

```text
topogram/
  domains/
    dom-feed-inventory.tg
    dom-cattle-management.tg
  feed-inventory/
    capabilities/
    entities/
    rules/
  cattle-management/
    ...
  shared/                      # cross-cutting (party, address, audit)
```

The parser flattens everything; folders are documentation, `git blame`
targets, and `CODEOWNERS` entries only.

## CLI surface

```bash
# Slice the graph to one domain (capabilities, entities, rules,
# verifications, orchestrations, operations, decisions, plus the
# projections that realize any of its capabilities).
topogram query slice ./topogram --domain dom_feed_inventory

# Per-platform coverage matrix for a single domain.
topogram query domain-coverage ./topogram --domain dom_feed_inventory

# Navigation summary of all domains.
topogram query domain-list ./topogram

# --domain also slices the existing review-packet, change-plan, and
# verification-targets queries.
topogram query review-packet ./topogram --domain dom_feed_inventory
topogram query verification-targets ./topogram --domain dom_feed_inventory
topogram query change-plan ./topogram --domain dom_feed_inventory
```

Unknown domain ids hard-error (mirroring `--component` behavior).

## Generators

- `domain-coverage` — JSON realization matrix for one domain
  (capabilities × platforms).
- `domain-page` — markdown summary at
  `topogram/docs-generated/domains/{slug}.md` per domain (members,
  in/out-of-scope, per-platform coverage table).

Both run through the standard `generate` family with the
`--target` flag, or via the `query` family for live JSON.

## Documents

Markdown documents under `docs/` may carry a singular `domain` field in
their frontmatter:

```yaml
---
id: doc_call_feed_user_guide
kind: workflow
title: "Call Feed user guide"
status: draft
domain: dom_rnf
---
```

The validator checks that the value resolves to a `domain` statement.

## Non-goals

- No subdomain hierarchy beyond `parent_domain` (reserved field, no
  resolver rules in v1).
- No multi-domain statements (a capability belongs to one domain or
  none).
- No domain-aware realization providers (domain is metadata for queries
  and navigation, not generator input).
- No replication of Forge's `accu-trac-forge/domain/` folder hub. The
  graph supersedes it.
