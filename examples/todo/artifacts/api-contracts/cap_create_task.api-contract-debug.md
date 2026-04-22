# API Contract Debug

Generated from `/Users/attebury/Documents/topogram/examples/todo/topogram`

## `cap_create_task` - Create Task

Allows a user to create a new task

Endpoint: `POST /tasks`
Success: `201`
Auth: `user`
Request placement: `body`
Projection: `proj_api`
Idempotency: `Idempotency-Key`
Authorization: permission `tasks.create`
Actors: `user`

Request contract:
- shape: `shape_input_create_task`
- `title` - `string` - required in `body`
- `description` - `string` - optional in `body`
- `owner_id` - `string` - optional in `body`
- `project_id` - `string` - required in `body`
- `due_at` - `string` - optional in `body`

Response contract:
- shape: `shape_output_task_detail`
- mode: `item`
- `id` - `string` - required in `body`
- `title` - `string` - required in `body`
- `description` - `string` - optional in `body`
- `status` - `string` - required - default `draft` in `body`
- `owner_id` - `string` - optional in `body`
- `project_id` - `string` - required in `body`
- `created_at` - `string` - required in `body`
- `updated_at` - `string` - required in `body`
- `completed_at` - `string` - optional in `body`
- `due_at` - `string` - optional in `body`

Policy constraints:
- `rule_no_task_creation_in_archived_project` (error)
- `rule_only_active_users_may_own_tasks` (error)

Error cases:
- `rule_no_task_creation_in_archived_project` -> 409
- `rule_only_active_users_may_own_tasks` -> 400
- `cap_create_task_invalid_request` -> 400
- `cap_create_task_idempotency_conflict` -> 409
