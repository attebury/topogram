# UI Contract Debug

Generated from `/Users/attebury/Documents/topogram/examples/todo/topogram`

## `proj_ui_shared` - Todo Shared UI

Platform: `ui_shared`
Realizes: `cap_list_tasks`, `cap_get_task`, `cap_create_task`, `cap_update_task`, `cap_complete_task`, `cap_delete_task`, `cap_export_tasks`, `cap_get_task_export_job`, `cap_download_task_export`
Outputs: `ui_contract`

### `task_list` - Tasks

Kind: `list`
Load: `cap_list_tasks`
Item shape: `shape_output_task_card`
Empty state: `No tasks yet` - Create a task to get started

Actions:
- primary: `cap_create_task`
- screen action: `cap_export_tasks` (secondary)

Collection:
- filters: `project_id`, `owner_id`, `status`
- search: _none_
- pagination: `cursor`
- sort: `created_at` desc

Visibility:
- `cap_export_tasks` visible_if permission `tasks.export`

Lookups:
- field `project_id` -> entity `entity_project` label_field `name` empty_label "All projects"
- field `owner_id` -> entity `entity_user` label_field `display_name` empty_label "All owners"

### `task_detail` - Task Details

Kind: `detail`
Load: `cap_get_task`
View shape: `shape_output_task_detail`

Actions:
- primary: `cap_update_task`
- secondary: `cap_complete_task`
- destructive: `cap_delete_task`
- screen action: `cap_complete_task` (primary)
- screen action: `cap_delete_task` (destructive)

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- sort: _none_

Visibility:
- `cap_delete_task` visible_if permission `tasks.delete`
- `cap_update_task` visible_if ownership `owner_or_admin`
- `cap_complete_task` visible_if ownership `owner_or_admin`

Lookups:
- _none_

### `task_create` - Create Task

Kind: `form`
Submit: `cap_create_task`
Input shape: `shape_input_create_task`
Success navigate: `task_detail`

Actions:
- _none_

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- field `project_id` -> entity `entity_project` label_field `name`
- field `owner_id` -> entity `entity_user` label_field `display_name` empty_label "Unassigned"

### `task_edit` - Edit Task

Kind: `form`
Submit: `cap_update_task`
Input shape: `shape_input_update_task`
Success navigate: `task_detail`

Actions:
- _none_

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- field `owner_id` -> entity `entity_user` label_field `display_name` empty_label "Unassigned"

### `task_exports` - Export Status

Kind: `job_status`
Load: `cap_get_task_export_job`
View shape: `shape_output_task_export_status`

Actions:
- terminal: `cap_download_task_export`

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- _none_
