# UI Web Debug

Generated from `/Users/attebury/topogram-cursor/examples/generated/todo/topogram`

## `proj_ui_web` - Todo Web UI

Shared projection: `proj_ui_shared`
Generator defaults: `profile=sveltekit`, `language=typescript`, `styling=css`
App shell: `bottom_tabs` brand `Topogram Todo`
Navigation: `Projects`, `Users`, `Tasks`, `Board`, `Calendar`

### `project_list`

Route: `/projects`
Layout hints: `layout=responsive_collection`, `desktop_variant=table`, `mobile_variant=cards`, `collection=table`

### `project_detail`

Route: `/projects/:id`
Layout hints: `layout=detail_page`

### `project_create`

Route: `/projects/new`
Layout hints: `present=page`

### `project_edit`

Route: `/projects/:id/edit`
Layout hints: `present=page`

### `user_list`

Route: `/users`
Layout hints: `layout=responsive_collection`, `desktop_variant=table`, `mobile_variant=cards`, `collection=table`

### `user_detail`

Route: `/users/:id`
Layout hints: `layout=detail_page`

### `user_create`

Route: `/users/new`
Layout hints: `present=page`

### `user_edit`

Route: `/users/:id/edit`
Layout hints: `present=page`

### `task_list`

Route: `/tasks`
Layout hints: `shell=bottom_tabs`, `layout=responsive_collection`, `desktop_variant=table`, `mobile_variant=cards`, `collection=table`

### `task_board`

Route: `/tasks/board`
Layout hints: `layout=responsive_collection`, `desktop_variant=board`, `mobile_variant=cards`, `collection=board`

### `task_calendar`

Route: `/tasks/calendar`
Layout hints: `layout=responsive_collection`, `desktop_variant=calendar`, `mobile_variant=list`, `collection=calendar`

### `task_detail`

Route: `/tasks/:id`
Layout hints: `breadcrumbs=visible`, `layout=detail_page`

### `task_create`

Route: `/tasks/new`
Layout hints: `present=bottom_sheet`

### `task_edit`

Route: `/tasks/:id/edit`
Layout hints: `present=page`

### `task_exports`

Route: `/task-exports/:job_id`
Layout hints: `present=page`

### Sitemap

- include `/projects` (Projects)
- include `/projects/:id` (Project Details)
- include `/projects/new` (Create Project)
- include `/projects/:id/edit` (Edit Project)
- include `/users` (Users)
- include `/users/:id` (User Details)
- include `/users/new` (Create User)
- include `/users/:id/edit` (Edit User)
- include `/tasks` (Tasks)
- include `/tasks/board` (Board)
- include `/tasks/calendar` (Calendar)
- exclude `/tasks/:id` (Task Details)
- exclude `/tasks/new` (Create Task)
- include `/tasks/:id/edit` (Edit Task)
- include `/task-exports/:job_id` (Export Status)
