# DB Contract Debug

Generated from `/Users/attebury/topogram-cursor/examples/generated/todo/topogram`

## `proj_db_postgres` - Todo Postgres DB

Platform: `db_postgres`
Profile: `postgres_sql`

### `tasks` <- `entity_task`

Columns:
- `id` <- `id` : `uuid` required
- `title` <- `title` : `string` required
- `description` <- `description` : `text` optional
- `status` <- `status` : `task_status` required
- `priority` <- `priority` : `task_priority` required
- `owner_id` <- `owner_id` : `uuid` optional
- `project_id` <- `project_id` : `uuid` required
- `created_at` <- `created_at` : `datetime` required
- `updated_at` <- `updated_at` : `datetime` required
- `completed_at` <- `completed_at` : `datetime` optional
- `due_at` <- `due_at` : `datetime` optional
Primary key: `id`
Unique: _none_
Indexes: index[project_id, status], index[owner_id, status]
Relations: `owner_id` -> `entity_user.id` on_delete set_null, `project_id` -> `entity_project.id` on_delete cascade
Lifecycle: soft_delete(status=archived), timestamps(created_at, updated_at)

### `projects` <- `entity_project`

Columns:
- `id` <- `id` : `uuid` required
- `name` <- `name` : `string` required
- `description` <- `description` : `text` optional
- `status` <- `status` : `project_status` required
- `owner_id` <- `owner_id` : `uuid` optional
- `created_at` <- `created_at` : `datetime` required
Primary key: `id`
Unique: [name]
Indexes: unique[name], index[owner_id, status]
Relations: `owner_id` -> `entity_user.id` on_delete set_null
Lifecycle: _none_

### `users` <- `entity_user`

Columns:
- `id` <- `id` : `uuid` required
- `email` <- `email` : `string` required
- `display_name` <- `display_name` : `string` required
- `is_active` <- `is_active` : `boolean` required
- `created_at` <- `created_at` : `datetime` required
Primary key: `id`
Unique: [email]
Indexes: unique[email]
Relations: _none_
Lifecycle: _none_
