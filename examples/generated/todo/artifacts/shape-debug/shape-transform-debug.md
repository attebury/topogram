# Shape Transform Debug

Generated from `/Users/attebury/Documents/topogram/examples/generated/todo/topogram`

## `shape_input_complete_task` - Complete Task Input

Input for marking a task complete

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `task_id` - `uuid` - required
- `completed_at` - `datetime` - optional

Transforms:
- _none_

Result fields:
- `task_id` - `uuid` - required
- `completed_at` - `datetime` - optional

## `shape_input_create_project` - Create Project Input

Fields accepted when creating a project

Selection mode: `derived_from_entity`
Source: `entity_project`
Include: `name`, `description`, `status`, `owner_id`
Exclude: _none_

Selected fields:
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional

Transforms:
- _none_

Result fields:
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional

## `shape_input_create_task` - Create Task Input

Fields accepted when creating a task

Selection mode: `derived_from_entity`
Source: `entity_task`
Include: `title`, `description`, `priority`, `owner_id`, `project_id`, `due_at`
Exclude: _none_

Selected fields:
- `title` - `string` - required
- `description` - `text` - optional
- `priority` - `task_priority` - required - default `medium`
- `owner_id` - `uuid` - optional
- `project_id` - `uuid` - required
- `due_at` - `datetime` - optional

Transforms:
- _none_

Result fields:
- `title` - `string` - required
- `description` - `text` - optional
- `priority` - `task_priority` - required - default `medium`
- `owner_id` - `uuid` - optional
- `project_id` - `uuid` - required
- `due_at` - `datetime` - optional

## `shape_input_create_user` - Create User Input

Fields accepted when creating a user

Selection mode: `derived_from_entity`
Source: `entity_user`
Include: `email`, `display_name`, `is_active`
Exclude: _none_

Selected fields:
- `email` - `string` - required
- `display_name` - `string` - required
- `is_active` - `boolean` - required - default `true`

Transforms:
- _none_

Result fields:
- `email` - `string` - required
- `display_name` - `string` - required
- `is_active` - `boolean` - required - default `true`

## `shape_input_delete_task` - Delete Task Input

Input for deleting a task

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `task_id` - `uuid` - required

Transforms:
- _none_

Result fields:
- `task_id` - `uuid` - required

## `shape_input_export_tasks` - Export Tasks Input

Filters accepted when requesting a task export

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `project_id` - `uuid` - optional
- `owner_id` - `uuid` - optional
- `status` - `task_status` - optional
- `callback_url` - `text` - optional

Transforms:
- _none_

Result fields:
- `project_id` - `uuid` - optional
- `owner_id` - `uuid` - optional
- `status` - `task_status` - optional
- `callback_url` - `text` - optional

## `shape_input_get_project` - Get Project Input

Input for fetching a single project

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `project_id` - `uuid` - required

Transforms:
- _none_

Result fields:
- `project_id` - `uuid` - required

## `shape_input_get_task_export_job` - Get Task Export Job Input

Input for fetching task export job status

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `job_id` - `uuid` - required

Transforms:
- _none_

Result fields:
- `job_id` - `uuid` - required

## `shape_input_get_task` - Get Task Input

Input for fetching a single task

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `task_id` - `uuid` - required

Transforms:
- _none_

Result fields:
- `task_id` - `uuid` - required

## `shape_input_get_user` - Get User Input

Input for fetching a single user

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `user_id` - `uuid` - required

Transforms:
- _none_

Result fields:
- `user_id` - `uuid` - required

## `shape_input_list_projects` - List Projects Input

Input for listing projects

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

Transforms:
- _none_

Result fields:
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

## `shape_input_list_tasks` - List Tasks Input

Input for listing tasks

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `project_id` - `uuid` - optional
- `owner_id` - `uuid` - optional
- `status` - `task_status` - optional
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

Transforms:
- _none_

Result fields:
- `project_id` - `uuid` - optional
- `owner_id` - `uuid` - optional
- `status` - `task_status` - optional
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

## `shape_input_list_users` - List Users Input

Input for listing users

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

Transforms:
- _none_

Result fields:
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

## `shape_input_update_project` - Update Project Input

Input for updating a project

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `project_id` - `uuid` - required
- `name` - `string` - optional
- `description` - `text` - optional
- `status` - `project_status` - optional
- `owner_id` - `uuid` - optional

Transforms:
- _none_

Result fields:
- `project_id` - `uuid` - required
- `name` - `string` - optional
- `description` - `text` - optional
- `status` - `project_status` - optional
- `owner_id` - `uuid` - optional

## `shape_input_update_task` - Update Task Input

Input for updating a task

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `task_id` - `uuid` - required
- `title` - `string` - optional
- `description` - `text` - optional
- `priority` - `task_priority` - optional
- `owner_id` - `uuid` - optional
- `due_at` - `datetime` - optional
- `status` - `task_status` - optional

Transforms:
- _none_

Result fields:
- `task_id` - `uuid` - required
- `title` - `string` - optional
- `description` - `text` - optional
- `priority` - `task_priority` - optional
- `owner_id` - `uuid` - optional
- `due_at` - `datetime` - optional
- `status` - `task_status` - optional

## `shape_input_update_user` - Update User Input

Input for updating a user

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `user_id` - `uuid` - required
- `email` - `string` - optional
- `display_name` - `string` - optional
- `is_active` - `boolean` - optional

Transforms:
- _none_

Result fields:
- `user_id` - `uuid` - required
- `email` - `string` - optional
- `display_name` - `string` - optional
- `is_active` - `boolean` - optional

## `shape_output_project_card` - Project Card Output

Compact project payload for cards and lists

Selection mode: `derived_from_entity`
Source: `entity_project`
Include: `id`, `name`, `description`, `status`, `owner_id`
Exclude: _none_

Selected fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional

Transforms:
- _none_

Result fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional

## `shape_output_project_detail` - Project Detail Output

Detailed project payload

Selection mode: `derived_from_entity`
Source: `entity_project`
Include: `id`, `name`, `description`, `status`, `owner_id`, `created_at`
Exclude: _none_

Selected fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional
- `created_at` - `datetime` - required

Transforms:
- _none_

Result fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `project_status` - required - default `active`
- `owner_id` - `uuid` - optional
- `created_at` - `datetime` - required

## `shape_output_task_card` - Task Card Output

Compact task payload for cards and lists

Selection mode: `derived_from_entity`
Source: `entity_task`
Include: `title`, `status`, `priority`, `due_at`, `owner_id`
Exclude: _none_

Selected fields:
- `title` - `string` - required
- `status` - `task_status` - required - default `draft`
- `priority` - `task_priority` - required - default `medium`
- `due_at` - `datetime` - optional
- `owner_id` - `uuid` - optional

Transforms:
- rename `due_at` -> `dueAt`
- rename `owner_id` -> `ownerId`
- override `title`: optional
- override `status`: default `active`
- override `priority`: default `medium`
- override `ownerId`: required

Result fields:
- `title` - `string` - optional
- `status` - `task_status` - required - default `active`
- `priority` - `task_priority` - required - default `medium`
- `dueAt` - `datetime` - optional - from `due_at`
- `ownerId` - `uuid` - required - from `owner_id`

## `shape_output_task_detail` - Task Detail Output

Detailed task payload

Selection mode: `derived_from_entity`
Source: `entity_task`
Include: `id`, `title`, `description`, `status`, `priority`, `owner_id`, `project_id`, `created_at`, `updated_at`, `completed_at`, `due_at`
Exclude: _none_

Selected fields:
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

Transforms:
- _none_

Result fields:
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

## `shape_output_task_export_callback` - Task Export Callback

Outbound webhook payload sent when a task export completes

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `job_id` - `uuid` - required
- `status` - `export_job_status` - required
- `download_url` - `text` - optional
- `error_message` - `text` - optional
- `completed_at` - `datetime` - optional

Transforms:
- _none_

Result fields:
- `job_id` - `uuid` - required
- `status` - `export_job_status` - required
- `download_url` - `text` - optional
- `error_message` - `text` - optional
- `completed_at` - `datetime` - optional

## `shape_output_task_export_job` - Task Export Job

Accepted job payload for long-running task exports

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `job_id` - `uuid` - required
- `status` - `string` - required - default `accepted`
- `status_url` - `text` - required
- `submitted_at` - `datetime` - required

Transforms:
- _none_

Result fields:
- `job_id` - `uuid` - required
- `status` - `string` - required - default `accepted`
- `status_url` - `text` - required
- `submitted_at` - `datetime` - required

## `shape_output_task_export_status` - Task Export Status

Status payload for long-running task export jobs

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `job_id` - `uuid` - required
- `status` - `export_job_status` - required - default `accepted`
- `status_url` - `text` - required
- `submitted_at` - `datetime` - required
- `completed_at` - `datetime` - optional
- `expires_at` - `datetime` - optional
- `download_url` - `text` - optional
- `error_message` - `text` - optional

Transforms:
- _none_

Result fields:
- `job_id` - `uuid` - required
- `status` - `export_job_status` - required - default `accepted`
- `status_url` - `text` - required
- `submitted_at` - `datetime` - required
- `completed_at` - `datetime` - optional
- `expires_at` - `datetime` - optional
- `download_url` - `text` - optional
- `error_message` - `text` - optional

## `shape_output_user_card` - User Card Output

Compact user payload for cards and lists

Selection mode: `derived_from_entity`
Source: `entity_user`
Include: `id`, `display_name`, `email`, `is_active`
Exclude: _none_

Selected fields:
- `id` - `uuid` - required
- `display_name` - `string` - required
- `email` - `string` - required
- `is_active` - `boolean` - required - default `true`

Transforms:
- _none_

Result fields:
- `id` - `uuid` - required
- `display_name` - `string` - required
- `email` - `string` - required
- `is_active` - `boolean` - required - default `true`

## `shape_output_user_detail` - User Detail Output

Detailed user payload

Selection mode: `derived_from_entity`
Source: `entity_user`
Include: `id`, `email`, `display_name`, `is_active`, `created_at`
Exclude: _none_

Selected fields:
- `id` - `uuid` - required
- `email` - `string` - required
- `display_name` - `string` - required
- `is_active` - `boolean` - required - default `true`
- `created_at` - `datetime` - required

Transforms:
- _none_

Result fields:
- `id` - `uuid` - required
- `email` - `string` - required
- `display_name` - `string` - required
- `is_active` - `boolean` - required - default `true`
- `created_at` - `datetime` - required
