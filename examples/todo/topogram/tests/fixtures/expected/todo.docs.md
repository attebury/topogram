# Topogram Domain

Generated from `/Users/attebury/Documents/topogram/examples/todo/topogram`

## Enums

### `export_job_status`

Values: `accepted`, `running`, `completed`, `failed`, `expired`

### `project_status`

Values: `active`, `archived`

### `task_priority`

Values: `low`, `medium`, `high`

### `task_status`

Values: `draft`, `active`, `completed`, `archived`

## Actors

### `actor_user` - User

Workspace member interacting with the task system

Status: `active`

### `user` - User

A person interacting with the Todo application

Status: `active`

## Decisions

### `dec_task_ownership` - Active task ownership is singular

Active tasks use one accountable owner

Context: `accountability`, `simplified_workflows`, `cleaner_ui`
Consequences: `easier_reporting`, `less_flexible_collaboration`
Status: `accepted`

## Entities

### `entity_project` - Project

A grouping container for tasks

Fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional
- `created_at` - `datetime` - required

Relations:
- `owner_id` references `entity_user.id`

Invariants:
- `name` length <= 120

### `entity_task` - Task

A unit of work tracked in the Todo domain

Fields:
- `id` - `uuid` - required
- `title` - `string` - required
- `description` - `text` - optional
- `status` - `task_status` - required - default `draft`
- `priority` - `task_priority` - required - default `medium`
- `owner_id` - `uuid` - optional
- `project_id` - `uuid` - required
- `created_at` - `datetime` - required
- `updated_at` - `datetime` - required
- `completed_at` - `datetime` - optional
- `due_at` - `datetime` - optional

Relations:
- `owner_id` references `entity_user.id`
- `project_id` references `entity_project.id`

Invariants:
- `completed_at` requires `status == completed`
- if `status == active`, then `owner_id is required`
- if `status == draft`, then `completed_at is null`
- `title` length <= 200

### `entity_user` - User

A person who can own tasks

Fields:
- `id` - `uuid` - required
- `email` - `string` - required
- `display_name` - `string` - required
- `is_active` - `boolean` - required - default `true`
- `created_at` - `datetime` - required

Invariants:
- `email` format == `email`
- `display_name` length <= 120

## Shapes

### `shape_input_complete_task` - Complete Task Input

Input for marking a task complete

Projected fields:
- `task_id` - `uuid` - required
- `completed_at` - `datetime` - optional

### `shape_input_create_project` - Create Project Input

Fields accepted when creating a project

Derived from: `entity_project`

Projected fields:
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional

### `shape_input_create_task` - Create Task Input

Fields accepted when creating a task

Derived from: `entity_task`

Projected fields:
- `title` - `string` - required
- `description` - `text` - optional
- `priority` - `task_priority` - required - default `medium`
- `owner_id` - `uuid` - optional
- `project_id` - `uuid` - required
- `due_at` - `datetime` - optional

### `shape_input_create_user` - Create User Input

Fields accepted when creating a user

Derived from: `entity_user`

Projected fields:
- `email` - `string` - required
- `display_name` - `string` - required
- `is_active` - `boolean` - required - default `true`

### `shape_input_delete_task` - Delete Task Input

Input for deleting a task

Projected fields:
- `task_id` - `uuid` - required

### `shape_input_export_tasks` - Export Tasks Input

Filters accepted when requesting a task export

Projected fields:
- `project_id` - `uuid` - optional
- `owner_id` - `uuid` - optional
- `status` - `task_status` - optional
- `callback_url` - `text` - optional

### `shape_input_get_project` - Get Project Input

Input for fetching a single project

Projected fields:
- `project_id` - `uuid` - required

### `shape_input_get_task_export_job` - Get Task Export Job Input

Input for fetching task export job status

Projected fields:
- `job_id` - `uuid` - required

### `shape_input_get_task` - Get Task Input

Input for fetching a single task

Projected fields:
- `task_id` - `uuid` - required

### `shape_input_get_user` - Get User Input

Input for fetching a single user

Projected fields:
- `user_id` - `uuid` - required

### `shape_input_list_projects` - List Projects Input

Input for listing projects

Projected fields:
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

### `shape_input_list_tasks` - List Tasks Input

Input for listing tasks

Projected fields:
- `project_id` - `uuid` - optional
- `owner_id` - `uuid` - optional
- `status` - `task_status` - optional
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

### `shape_input_list_users` - List Users Input

Input for listing users

Projected fields:
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

### `shape_input_update_project` - Update Project Input

Input for updating a project

Projected fields:
- `project_id` - `uuid` - required
- `name` - `string` - optional
- `description` - `text` - optional
- `status` - `project_status` - optional
- `owner_id` - `uuid` - optional

### `shape_input_update_task` - Update Task Input

Input for updating a task

Projected fields:
- `task_id` - `uuid` - required
- `title` - `string` - optional
- `description` - `text` - optional
- `priority` - `task_priority` - optional
- `owner_id` - `uuid` - optional
- `due_at` - `datetime` - optional
- `status` - `task_status` - optional

### `shape_input_update_user` - Update User Input

Input for updating a user

Projected fields:
- `user_id` - `uuid` - required
- `email` - `string` - optional
- `display_name` - `string` - optional
- `is_active` - `boolean` - optional

### `shape_output_project_card` - Project Card Output

Compact project payload for cards and lists

Derived from: `entity_project`

Projected fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional

### `shape_output_project_detail` - Project Detail Output

Detailed project payload

Derived from: `entity_project`

Projected fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional
- `created_at` - `datetime` - required

### `shape_output_task_card` - Task Card Output

Compact task payload for cards and lists

Derived from: `entity_task`

Transforms:
- rename `due_at` -> `dueAt`
- rename `owner_id` -> `ownerId`
- override `title`: optional
- override `status`: default `active`
- override `priority`: default `medium`
- override `ownerId`: required

Projected fields:
- `title` - `string` - optional
- `status` - `task_status` - required - default `active`
- `priority` - `task_priority` - required - default `medium`
- `dueAt` - `datetime` - optional - from `due_at`
- `ownerId` - `uuid` - required - from `owner_id`

### `shape_output_task_detail` - Task Detail Output

Detailed task payload

Derived from: `entity_task`

Projected fields:
- `id` - `uuid` - required
- `title` - `string` - required
- `description` - `text` - optional
- `status` - `task_status` - required - default `draft`
- `priority` - `task_priority` - required - default `medium`
- `owner_id` - `uuid` - optional
- `project_id` - `uuid` - required
- `created_at` - `datetime` - required
- `updated_at` - `datetime` - required
- `completed_at` - `datetime` - optional
- `due_at` - `datetime` - optional

### `shape_output_task_export_callback` - Task Export Callback

Outbound webhook payload sent when a task export completes

Projected fields:
- `job_id` - `uuid` - required
- `status` - `export_job_status` - required
- `download_url` - `text` - optional
- `error_message` - `text` - optional
- `completed_at` - `datetime` - optional

### `shape_output_task_export_job` - Task Export Job

Accepted job payload for long-running task exports

Projected fields:
- `job_id` - `uuid` - required
- `status` - `string` - required - default `accepted`
- `status_url` - `text` - required
- `submitted_at` - `datetime` - required

### `shape_output_task_export_status` - Task Export Status

Status payload for long-running task export jobs

Projected fields:
- `job_id` - `uuid` - required
- `status` - `export_job_status` - required - default `accepted`
- `status_url` - `text` - required
- `submitted_at` - `datetime` - required
- `completed_at` - `datetime` - optional
- `expires_at` - `datetime` - optional
- `download_url` - `text` - optional
- `error_message` - `text` - optional

### `shape_output_user_card` - User Card Output

Compact user payload for cards and lists

Derived from: `entity_user`

Projected fields:
- `id` - `uuid` - required
- `display_name` - `string` - required
- `email` - `string` - required
- `is_active` - `boolean` - required - default `true`

### `shape_output_user_detail` - User Detail Output

Detailed user payload

Derived from: `entity_user`

Projected fields:
- `id` - `uuid` - required
- `email` - `string` - required
- `display_name` - `string` - required
- `is_active` - `boolean` - required - default `true`
- `created_at` - `datetime` - required

## Capabilities

### `cap_complete_task` - Complete Task

Allows a user to mark a task complete

Actors: `actor_user`
Roles: _none_
Reads: `entity_task`
Creates: _none_
Updates: `entity_task`
Deletes: _none_
Input: `shape_input_complete_task`
Output: `shape_output_task_detail`

### `cap_create_project` - Create Project

Allows a user to create a new project

Actors: `actor_user`
Roles: _none_
Reads: _none_
Creates: `entity_project`
Updates: _none_
Deletes: _none_
Input: `shape_input_create_project`
Output: `shape_output_project_detail`

### `cap_create_task` - Create Task

Allows a user to create a new task

Actors: `actor_user`
Roles: _none_
Reads: `entity_project`, `entity_user`
Creates: `entity_task`
Updates: _none_
Deletes: _none_
Input: `shape_input_create_task`
Output: `shape_output_task_detail`

### `cap_create_user` - Create User

Allows a user to create a new user

Actors: `actor_user`
Roles: _none_
Reads: _none_
Creates: `entity_user`
Updates: _none_
Deletes: _none_
Input: `shape_input_create_user`
Output: `shape_output_user_detail`

### `cap_delete_task` - Delete Task

Allows a user to archive a task through the delete endpoint

Actors: `actor_user`
Roles: _none_
Reads: `entity_task`
Creates: _none_
Updates: _none_
Deletes: `entity_task`
Input: `shape_input_delete_task`
Output: `shape_output_task_detail`

### `cap_download_task_export` - Download Task Export

Downloads the completed task export artifact

Actors: `actor_user`
Roles: _none_
Reads: `entity_task`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_task_export_job`
Output: _none_

### `cap_export_tasks` - Export Tasks

Starts an asynchronous export job for tasks

Actors: `actor_user`
Roles: _none_
Reads: `entity_task`, `entity_project`, `entity_user`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_export_tasks`
Output: `shape_output_task_export_job`

### `cap_get_project` - Get Project

Allows a user to fetch a single project by id

Actors: `actor_user`
Roles: _none_
Reads: `entity_project`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_project`
Output: `shape_output_project_detail`

### `cap_get_task_export_job` - Get Task Export Job

Fetches the current status of a task export job

Actors: `actor_user`
Roles: _none_
Reads: `entity_task`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_task_export_job`
Output: `shape_output_task_export_status`

### `cap_get_task` - Get Task

Allows a user to fetch a single task by id

Actors: `actor_user`
Roles: _none_
Reads: `entity_task`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_task`
Output: `shape_output_task_detail`

### `cap_get_user` - Get User

Allows a user to fetch a single user by id

Actors: `actor_user`
Roles: _none_
Reads: `entity_user`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_user`
Output: `shape_output_user_detail`

### `cap_list_projects` - List Projects

Allows a user to list projects

Actors: `actor_user`
Roles: _none_
Reads: `entity_project`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_list_projects`
Output: `shape_output_project_detail`

### `cap_list_tasks` - List Tasks

Allows a user to list tasks

Actors: `actor_user`
Roles: _none_
Reads: `entity_task`, `entity_project`, `entity_user`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_list_tasks`
Output: `shape_output_task_detail`

### `cap_list_users` - List Users

Allows a user to list users

Actors: `actor_user`
Roles: _none_
Reads: `entity_user`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_list_users`
Output: `shape_output_user_detail`

### `cap_update_project` - Update Project

Allows a user to update mutable project fields

Actors: `actor_user`
Roles: _none_
Reads: `entity_project`
Creates: _none_
Updates: `entity_project`
Deletes: _none_
Input: `shape_input_update_project`
Output: `shape_output_project_detail`

### `cap_update_task` - Update Task

Allows a user to update mutable task fields

Actors: `actor_user`
Roles: _none_
Reads: `entity_task`
Creates: _none_
Updates: `entity_task`
Deletes: _none_
Input: `shape_input_update_task`
Output: `shape_output_task_detail`

### `cap_update_user` - Update User

Allows a user to update mutable user fields

Actors: `actor_user`
Roles: _none_
Reads: `entity_user`
Creates: _none_
Updates: `entity_user`
Deletes: _none_
Input: `shape_input_update_user`
Output: `shape_output_user_detail`

## Rules

### `rule_no_task_creation_in_archived_project` - Cannot create tasks in archived projects

New tasks may not be created in archived projects

Applies to: `cap_create_task`
Actors: _none_
Roles: _none_
Requirement: `project.status != archived`
Severity: `error`

### `rule_only_active_users_may_own_tasks` - Only active users may own tasks

A task owner must be an active user

Applies to: `cap_create_task`, `cap_update_task`
Actors: _none_
Roles: _none_
Requirement: `owner.is_active == true`
Severity: `error`

## Projections

### `proj_api` - API

HTTP API realization for Todo

Platform: `dotnet`
Realizes: `cap_create_task`, `cap_get_task`, `cap_update_task`, `cap_complete_task`, `cap_list_tasks`, `cap_delete_task`, `cap_export_tasks`, `cap_get_task_export_job`, `cap_download_task_export`, `cap_list_projects`, `cap_get_project`, `cap_create_project`, `cap_update_project`, `cap_list_users`, `cap_get_user`, `cap_create_user`, `cap_update_user`
Outputs: `database_schema`, `entity_models`, `request_contracts`, `response_contracts`, `validation_handlers`, `endpoints`

### `proj_db_postgres` - Todo Postgres DB

Postgres persistence realization for the Todo domain

Platform: `db_postgres`
Realizes: `entity_task`, `entity_project`, `entity_user`
Outputs: `db_contract`, `sql_schema`

### `proj_db_sqlite` - Todo SQLite DB

SQLite persistence realization for the Todo domain

Platform: `db_sqlite`
Realizes: `entity_task`, `entity_project`, `entity_user`
Outputs: `db_contract`, `sql_schema`

### `proj_ui_shared` - Todo Shared UI

Platform-neutral UI semantics for the Todo product

Platform: `ui_shared`
Realizes: `cap_list_projects`, `cap_get_project`, `cap_create_project`, `cap_update_project`, `cap_list_users`, `cap_get_user`, `cap_create_user`, `cap_update_user`, `cap_list_tasks`, `cap_get_task`, `cap_create_task`, `cap_update_task`, `cap_complete_task`, `cap_delete_task`, `cap_export_tasks`, `cap_get_task_export_job`, `cap_download_task_export`
Outputs: `ui_contract`

### `proj_ui_web_react` - Todo Web UI (React)

Web realization for the shared Todo UI using a React profile

Platform: `ui_web`
Realizes: `cap_list_projects`, `cap_get_project`, `cap_create_project`, `cap_update_project`, `cap_list_users`, `cap_get_user`, `cap_create_user`, `cap_update_user`, `proj_ui_shared`, `cap_list_tasks`, `cap_get_task`, `cap_create_task`, `cap_update_task`, `cap_complete_task`, `cap_delete_task`, `cap_export_tasks`, `cap_get_task_export_job`, `cap_download_task_export`
Outputs: `ui_contract`, `web_app`

### `proj_ui_web` - Todo Web UI

Web realization for the shared Todo UI using a SvelteKit profile

Platform: `ui_web`
Realizes: `cap_list_projects`, `cap_get_project`, `cap_create_project`, `cap_update_project`, `cap_list_users`, `cap_get_user`, `cap_create_user`, `cap_update_user`, `proj_ui_shared`, `cap_list_tasks`, `cap_get_task`, `cap_create_task`, `cap_update_task`, `cap_complete_task`, `cap_delete_task`, `cap_export_tasks`, `cap_get_task_export_job`, `cap_download_task_export`
Outputs: `ui_contract`, `web_app`

## Verification

### `ver_create_task_policy` - Create task policy

Verifies create-task behavior and policy

Method: `runtime`
Validates: `cap_create_task`, `rule_no_task_creation_in_archived_project`, `rule_only_active_users_may_own_tasks`
Scenarios: `create_task_in_active_project`, `reject_task_in_archived_project`, `reject_assignment_to_inactive_user`

### `ver_runtime_smoke` - Todo runtime smoke

Covers the minimum web and API checks for the generated Todo stack.

Method: `smoke`
Validates: `cap_create_task`, `cap_get_task`, `cap_list_tasks`
Scenarios: `tasks_page_responds`, `create_task_smoke`, `get_created_task_smoke`, `list_tasks_smoke`

### `ver_task_runtime_flow` - Task runtime flow

Verifies core task CRUD and export runtime behavior.

Method: `runtime`
Validates: `cap_create_task`, `cap_get_task`, `cap_list_tasks`, `cap_update_task`, `cap_complete_task`, `cap_delete_task`, `cap_export_tasks`, `cap_get_task_export_job`, `cap_download_task_export`
Scenarios: `create_task_runtime`, `get_created_task_runtime`, `list_tasks_runtime`, `update_task_runtime`, `complete_task_runtime`, `delete_task_runtime`, `export_tasks_runtime`, `get_task_export_job_runtime`, `download_task_export_runtime`

## Operations

### `op_task_creation_monitoring` - Task creation monitoring

Runtime monitoring for task creation

Observes: `cap_create_task`
Metrics: `task_creation_latency`, `task_creation_failure_rate`
Alerts: `high_task_creation_failure_rate`

## Companion Docs

### `user` - User

Kind: `glossary`
Status: `canonical`

Workspace member who can own projects and be assigned tasks.

Related entities: `entity_user`
Related capabilities: `cap_create_user`, `cap_update_user`

### `task_creation_and_ownership` - Task Creation And Ownership

Kind: `journey`
Status: `canonical`

A user creates a task in an active project, assigns clear ownership, and can immediately find it again to keep work moving.

Related entities: `entity_task`, `entity_project`, `entity_user`
Related capabilities: `cap_create_task`, `cap_get_task`, `cap_list_tasks`, `cap_update_task`
