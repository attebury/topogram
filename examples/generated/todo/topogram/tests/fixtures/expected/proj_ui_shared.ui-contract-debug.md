# UI Contract Debug

Generated from `/Users/attebury/topogram-cursor/examples/generated/todo/topogram`

## `proj_ui_shared` - Todo Shared UI

Platform: `ui_shared`
Realizes: `cap_list_projects`, `cap_get_project`, `cap_create_project`, `cap_update_project`, `cap_list_users`, `cap_get_user`, `cap_create_user`, `cap_update_user`, `cap_list_tasks`, `cap_get_task`, `cap_create_task`, `cap_update_task`, `cap_complete_task`, `cap_delete_task`, `cap_export_tasks`, `cap_get_task_export_job`, `cap_download_task_export`
Outputs: `ui_contract`
App shell: brand `Topogram Todo`, shell `bottom_tabs`
Navigation: `Projects`, `Users`, `Tasks`, `Board`, `Calendar`

### `project_list` - Projects

Kind: `list`
Load: `cap_list_projects`
Item shape: `shape_output_project_card`
Empty state: `No projects yet` - Create a project to organize your tasks
States: `loading=skeleton`, `empty=empty_state_panel`, `error=inline`, `unauthorized=auto`, `notFound=auto`, `success=auto`
Patterns: `resource_table`

Actions:
- primary: `cap_create_project`
- screen action: `cap_create_project` (primary)

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: `table`
- groupBy: _none_
- sort: `created_at` desc

Visibility:
- `cap_create_project` visible_if permission `projects.create`

Lookups:
- _none_

Regions:
- `results` pattern `resource_table` placement `primary`

### `project_detail` - Project Details

Kind: `detail`
Load: `cap_get_project`
View shape: `shape_output_project_detail`
States: `loading=skeleton`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=auto`
Patterns: `detail_panel`

Actions:
- primary: `cap_update_project`

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- `cap_update_project` visible_if permission `projects.update`

Lookups:
- _none_

Regions:
- _none_

### `project_create` - Create Project

Kind: `form`
Submit: `cap_create_project`
Input shape: `shape_input_create_project`
Success navigate: `project_detail`
States: `loading=auto`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=banner`
Patterns: `edit_form`

Actions:
- _none_

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- field `owner_id` -> entity `entity_user` label_field `display_name` empty_label "Unassigned"

Regions:
- _none_

### `project_edit` - Edit Project

Kind: `form`
Submit: `cap_update_project`
Input shape: `shape_input_update_project`
Success navigate: `project_detail`
States: `loading=auto`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=banner`
Patterns: `edit_form`

Actions:
- _none_

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- field `owner_id` -> entity `entity_user` label_field `display_name` empty_label "Unassigned"

Regions:
- _none_

### `user_list` - Users

Kind: `list`
Load: `cap_list_users`
Item shape: `shape_output_user_card`
Empty state: `No users yet` - Create a user to start assigning work
States: `loading=skeleton`, `empty=empty_state_panel`, `error=inline`, `unauthorized=auto`, `notFound=auto`, `success=auto`
Patterns: `resource_table`

Actions:
- primary: `cap_create_user`
- screen action: `cap_create_user` (primary)

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: `table`
- groupBy: _none_
- sort: `created_at` desc

Visibility:
- `cap_create_user` visible_if permission `users.create`

Lookups:
- _none_

Regions:
- `results` pattern `resource_table` placement `primary`

### `user_detail` - User Details

Kind: `detail`
Load: `cap_get_user`
View shape: `shape_output_user_detail`
States: `loading=skeleton`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=auto`
Patterns: `detail_panel`

Actions:
- primary: `cap_update_user`

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- `cap_update_user` visible_if permission `users.update`

Lookups:
- _none_

Regions:
- _none_

### `user_create` - Create User

Kind: `form`
Submit: `cap_create_user`
Input shape: `shape_input_create_user`
Success navigate: `user_detail`
States: `loading=auto`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=banner`
Patterns: `edit_form`

Actions:
- _none_

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- _none_

Regions:
- _none_

### `user_edit` - Edit User

Kind: `form`
Submit: `cap_update_user`
Input shape: `shape_input_update_user`
Success navigate: `user_detail`
States: `loading=auto`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=banner`
Patterns: `edit_form`

Actions:
- _none_

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- _none_

Regions:
- _none_

### `task_list` - Tasks

Kind: `list`
Load: `cap_list_tasks`
Item shape: `shape_output_task_card`
Empty state: `No tasks yet` - Create a task to get started
States: `loading=skeleton`, `empty=empty_state_panel`, `error=inline`, `unauthorized=auto`, `notFound=auto`, `success=auto`
Patterns: `summary_stats`, `action_bar`, `resource_table`

Actions:
- primary: `cap_create_task`
- screen action: `cap_export_tasks` (secondary)

Collection:
- filters: `project_id`, `owner_id`, `status`
- search: _none_
- pagination: _none_
- views: `table`
- groupBy: `status`
- sort: `created_at` desc

Visibility:
- `cap_export_tasks` visible_if permission `tasks.export`

Lookups:
- field `project_id` -> entity `entity_project` label_field `name` empty_label "All projects"
- field `owner_id` -> entity `entity_user` label_field `display_name` empty_label "All owners"

Regions:
- `hero` pattern `summary_stats` placement `primary`
- `toolbar` pattern `action_bar` placement `primary`
- `results` pattern `resource_table` placement `primary`

### `task_board` - Task Board

Kind: `board`
Load: `cap_list_tasks`
Item shape: `shape_output_task_card`
Empty state: `No tasks on this board` - Create a task to start planning work
States: `loading=skeleton`, `empty=empty_state_panel`, `error=inline`, `unauthorized=auto`, `notFound=auto`, `success=auto`
Patterns: `action_bar`, `board_view`

Actions:
- primary: `cap_create_task`

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- _none_

Regions:
- `toolbar` pattern `action_bar` placement `primary`
- `results` pattern `board_view` placement `primary`

### `task_calendar` - Task Calendar

Kind: `calendar`
Load: `cap_list_tasks`
Item shape: `shape_output_task_card`
Empty state: `No scheduled tasks` - Create a task with dates to populate the calendar
States: `loading=skeleton`, `empty=empty_state_panel`, `error=inline`, `unauthorized=auto`, `notFound=auto`, `success=auto`
Patterns: `action_bar`, `calendar_view`

Actions:
- primary: `cap_create_task`

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- _none_

Regions:
- `toolbar` pattern `action_bar` placement `primary`
- `results` pattern `calendar_view` placement `primary`

### `task_detail` - Task Details

Kind: `detail`
Load: `cap_get_task`
View shape: `shape_output_task_detail`
States: `loading=skeleton`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=auto`
Patterns: `detail_panel`, `activity_feed`

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
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- `cap_delete_task` visible_if permission `tasks.delete`
- `cap_update_task` visible_if ownership `owner_or_admin` ownership_field `owner_id`
- `cap_complete_task` visible_if ownership `owner_or_admin` ownership_field `owner_id`

Lookups:
- _none_

Regions:
- `summary` pattern `detail_panel` placement `primary`
- `activity` pattern `activity_feed` placement `supporting`

### `task_create` - Create Task

Kind: `wizard`
Submit: `cap_create_task`
Input shape: `shape_input_create_task`
Success navigate: `task_detail`
States: `loading=auto`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=banner`

Actions:
- _none_

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- field `project_id` -> entity `entity_project` label_field `name`
- field `owner_id` -> entity `entity_user` label_field `display_name` empty_label "Unassigned"

Regions:
- _none_

### `task_edit` - Edit Task

Kind: `form`
Submit: `cap_update_task`
Input shape: `shape_input_update_task`
Success navigate: `task_detail`
States: `loading=auto`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=banner`
Patterns: `edit_form`

Actions:
- _none_

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- field `owner_id` -> entity `entity_user` label_field `display_name` empty_label "Unassigned"

Regions:
- _none_

### `task_exports` - Export Status

Kind: `job_status`
Load: `cap_get_task_export_job`
View shape: `shape_output_task_export_status`
States: `loading=auto`, `empty=auto`, `error=auto`, `unauthorized=auto`, `notFound=auto`, `success=auto`

Actions:
- terminal: `cap_download_task_export`

Collection:
- filters: _none_
- search: _none_
- pagination: _none_
- views: _none_
- groupBy: _none_
- sort: _none_

Visibility:
- _none_

Lookups:
- _none_

Regions:
- _none_
