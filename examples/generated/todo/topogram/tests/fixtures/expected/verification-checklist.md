# Verification Checklist

Generated from `/Users/attebury/Documents/topogram/examples/generated/todo/topogram`

## `ver_create_task_policy` - Create task policy

Verifies create-task behavior and policy

Method: `runtime`
Status: `active`
Validates: `cap_create_task`, `rule_no_task_creation_in_archived_project`, `rule_only_active_users_may_own_tasks`

- [ ] create task in active project
- [ ] reject task in archived project
- [ ] reject assignment to inactive user

## `ver_runtime_smoke` - Todo runtime smoke

Covers the minimum web and API checks for the generated Todo stack.

Method: `smoke`
Status: `active`
Validates: `cap_create_task`, `cap_get_task`, `cap_list_tasks`

- [ ] tasks page responds
- [ ] create task smoke
- [ ] get created task smoke
- [ ] list tasks smoke

## `ver_task_runtime_flow` - Task runtime flow

Verifies core task CRUD and export runtime behavior.

Method: `runtime`
Status: `active`
Validates: `cap_create_task`, `cap_get_task`, `cap_list_tasks`, `cap_update_task`, `cap_complete_task`, `cap_delete_task`, `cap_export_tasks`, `cap_get_task_export_job`, `cap_download_task_export`

- [ ] create task runtime
- [ ] get created task runtime
- [ ] list tasks runtime
- [ ] update task runtime
- [ ] complete task runtime
- [ ] delete task runtime
- [ ] export tasks runtime
- [ ] get task export job runtime
- [ ] download task export runtime
