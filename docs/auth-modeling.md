# Auth Modeling

This note documents the current Topogram authorization modeling surface.

Use it to answer one practical question: which policy shape should model this action or route?

## Current Policy Shapes

Topogram currently supports three policy shapes in modeled authorization and UI visibility:

- `permission`
- `ownership`
- `claim`

They are intentionally small. Use the simplest policy that correctly describes the behavior.

## Rule Of Thumb

- use `permission` when access depends on a named capability grant
- use `ownership` when access depends on who owns or is assigned to a resource
- use `claim` when access depends on identity attributes carried by the principal, like reviewer or tenant context

If more than one condition is required, combine them on the same capability or action instead of inventing a new policy type.

## Permission

Use `permission` when the rule is about named product authority, not resource identity.

Example:

```tg
http_authz {
  cap_export_tasks permission tasks.export
}

ui_visibility {
  action cap_export_tasks visible_if permission tasks.export
}
```

Choose this when the main question is:

- does this principal have the right product-level grant?

Good fit:

- create or export actions
- admin-style screens
- actions that are not tied to one owned record

## Ownership

Use `ownership` when the rule is about a principal's relationship to a specific resource.

Example:

```tg
http_authz {
  cap_update_issue ownership owner_or_admin ownership_field assignee_id
}

ui_visibility {
  action cap_update_issue visible_if ownership owner_or_admin ownership_field assignee_id
}
```

Choose this when the main question is:

- is this user the owner, assignee, or author of this record?

Good fit:

- edit or close actions on assigned work
- detail-page actions tied to one record
- flows where admin bypass is acceptable but ordinary users need ownership

Prefer `ownership_field` when the resource field is known. That keeps the generated backend and generated UI aligned on the same explicit mapping.

## Claim

Use `claim` when access depends on a principal attribute that travels with identity itself.

Example:

```tg
http_authz {
  cap_approve_article permission articles.approve claim reviewer claim_value true
}

ui_visibility {
  action cap_approve_article visible_if claim reviewer claim_value true
}
```

Choose this when the main question is:

- does this signed-in principal carry the required identity attribute?

Good fit:

- reviewer-only actions
- tenant or workspace-bound access
- flags that come from signed claims rather than resource ownership

Use `claim_value` when the rule depends on one concrete claim value. Without `claim_value`, claim checks mean the claim must simply be present and truthy.

## Combining Policies

Topogram can carry more than one condition on the same capability.

Example:

```tg
http_authz {
  cap_update_account permission accounts.write claim tenant claim_value internal ownership owner ownership_field owner_id
}
```

Use combined policies only when each condition is actually required. Prefer one clear rule over a stack of unnecessary gates.

## Where These Appear

Today these policy shapes flow through:

- `http_authz` in API projections
- `ui_visibility` in shared UI projections
- emitted API contracts and OpenAPI extensions
- emitted UI web contracts and UI contract debug output
- generated backend auth enforcement
- generated web visibility helpers
- generated runtime verification bundles

## Current Proofs

- `permission`: the Issues example proves signed-token permission enforcement for create/read/update/close behavior
- `ownership`: the Issues example proves owner-or-admin update and close behavior with `403` forbidden checks
- `claim`: the Content Approval example proves reviewer-only approval behavior with a valid signed token that lacks the required claim

## Boundary

This is the current modeling surface, not a claim that broader production auth is solved.

For the primary generated auth proof surface, see [Bearer JWT HS256 Auth Profile](./auth-profile-bearer-jwt-hs256.md).

For the lighter-weight local/demo profile, see [Bearer Demo Auth Profile](./auth-profile-bearer-demo.md).
