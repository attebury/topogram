# Actors And Roles

Topogram now distinguishes between `actor` and `role`.

- `actor` means a participant in a journey, workflow, or capability flow
- `role` means an access or responsibility classification that helps explain who may do something

They are related, but they are not the same concept.

## Use `actor` For Participation

Use an `actor` when you want to describe who is involved in a flow.

Examples:

- a user drafting an article
- a manager reviewing a submission
- a background job reacting to an event

Journeys usually care about actors first because journeys start from user or system participation.

Capabilities may also reference actors when it matters who initiates the action.

## Use `role` For Access And Responsibility

Use a `role` when you want to describe who is permitted, responsible, or expected to perform an action.

Examples:

- author
- reviewer
- manager

Rules usually care about roles because rules explain what is allowed or constrained.

Capabilities may reference roles when access intent should be explicit in the canonical model.

## Recommended Pattern

Keep the model small and intentional:

- journeys reference `related_actors` and, when helpful, `related_roles`
- capabilities reference `actors` for flow participation and `roles` for access intent
- rules reference `roles` when constraining allowed behavior and `actors` only when participation itself matters

Good examples:

- a journey links to `actor_author` and `role_author`
- a capability links to `actors [actor_author]` and `roles [role_author]`
- a rule links to `roles [role_manager]`

## Out Of Scope For Now

This is not full auth modeling.

Topogram is intentionally not modeling:

- sessions
- identity providers
- tokens
- middleware behavior
- RBAC hierarchies
- policy languages

Those details can remain projection- or runtime-specific until repeated use proves that they belong in the canonical DSL.
