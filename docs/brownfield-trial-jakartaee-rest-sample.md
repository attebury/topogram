# Brownfield Trial: Jakarta EE REST Sample

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample`
- Source: `hantsy/jakartaee-rest-sample`

## What This Trial Proved

This trial confirmed that the Java proof set also covers standards-driven JAX-RS/Jakarta EE apps. Topogram can now recover a credible backend/domain model from a Jakarta EE REST app with:

- JAX-RS resources and nested subresource paths
- JPA entity evidence
- task CRUD plus task-status update semantics

## Import Coverage

Current Java coverage used by this trial includes:

- `api/jaxrs`
  - class-level and method-level `@Path`
  - HTTP method annotations
  - subresource path handling like `/tasks/{id}/status`
  - path/body extraction
- `db/jpa`
  - `@Entity` parsing
  - field extraction
  - relation inference from JPA annotations

## Imported Domain Surface

Recovered core bundle:

- `task`

Representative capabilities:

- `cap_list_tasks`
- `cap_create_task`
- `cap_get_task`
- `cap_update_task`
- `cap_update_task_status`
- `cap_delete_task`

## Canonical Outputs

The trial now has canonical Topogram outputs under:

- [/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/entities](/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/entities)
- [/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/capabilities](/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/capabilities)
- [/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/shapes](/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/shapes)
- [/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/decisions](/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/decisions)
- [/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/docs/workflows](/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/docs/workflows)

## Completion Signal

Saved status is now fully closed:

- [/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/candidates/reconcile/adoption-status.md](/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample/topogram/candidates/reconcile/adoption-status.md)
- `Next Bundle: None`
- `Blocked items: 0`

## Why This Is Enough To Move Forward

This is the Jakarta EE proof because Topogram can now:

- recover a real domain from standards-based JAX-RS resources without Spring or Quarkus-specific assumptions
- preserve subresource semantics like task status updates
- combine JPA entity evidence with route evidence into one stable `task` bundle
- close the queue with a curated canonical surface

## Deferred For Java v1

- broader Jakarta EE security and CDI inference
- Java UI extraction
- deeper service/use-case graph reconstruction
