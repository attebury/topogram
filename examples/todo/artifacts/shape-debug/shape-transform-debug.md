# Shape Transform Debug

Generated from `/Users/attebury/Documents/topogram/examples/todo/topogram`

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

## `shape_input_create_task` - Create Task Input

Fields accepted when creating a task

Selection mode: `derived_from_entity`
Source: `entity_task`
Include: `title`, `description`, `owner_id`, `project_id`, `due_at`
Exclude: _none_

Selected fields:
- `title` - `string` - required
- `description` - `text` - optional
- `owner_id` - `uuid` - optional
- `project_id` - `uuid` - required
- `due_at` - `datetime` - optional

Transforms:
- _none_

Result fields:
- `title` - `string` - required
- `description` - `text` - optional
- `owner_id` - `uuid` - optional
- `project_id` - `uuid` - required
- `due_at` - `datetime` - optional

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

## `shape_input_update_task` - Update Task Input

Input for updating a task

Selection mode: `explicit_fields`
Include: _none_
Exclude: _none_

Selected fields:
- `task_id` - `uuid` - required
- `title` - `string` - optional
- `description` - `text` - optional
- `owner_id` - `uuid` - optional
- `due_at` - `datetime` - optional
- `status` - `task_status` - optional

Transforms:
- _none_

Result fields:
- `task_id` - `uuid` - required
- `title` - `string` - optional
- `description` - `text` - optional
- `owner_id` - `uuid` - optional
- `due_at` - `datetime` - optional
- `status` - `task_status` - optional

## `shape_output_task_card` - Task Card Output

Compact task payload for cards and lists

Selection mode: `derived_from_entity`
Source: `entity_task`
Include: `title`, `status`, `due_at`, `owner_id`
Exclude: _none_

Selected fields:
- `title` - `string` - required
- `status` - `task_status` - required - default `draft`
- `due_at` - `datetime` - optional
- `owner_id` - `uuid` - optional

Transforms:
- rename `due_at` -> `dueAt`
- rename `owner_id` -> `ownerId`
- override `title`: optional
- override `status`: default `active`
- override `ownerId`: required

Result fields:
- `title` - `string` - optional
- `status` - `task_status` - required - default `active`
- `dueAt` - `datetime` - optional - from `due_at`
- `ownerId` - `uuid` - required - from `owner_id`

## `shape_output_task_detail` - Task Detail Output

Detailed task payload

Selection mode: `derived_from_entity`
Source: `entity_task`
Include: `id`, `title`, `description`, `status`, `owner_id`, `project_id`, `created_at`, `updated_at`, `completed_at`, `due_at`
Exclude: _none_

Selected fields:
- `id` - `uuid` - required
- `title` - `string` - required
- `description` - `text` - optional
- `status` - `task_status` - required - default `draft`
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
