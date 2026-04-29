export const TODO_RUNTIME_CHECKS = {
  environmentStage: {
    id: "environment",
    name: "Environment Readiness",
    failFast: true,
    checks: [
      {
        id: "required_env",
        kind: "env_required",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_tasks_page_ready",
        kind: "web_contract",
        path: "/tasks",
        expectStatus: 200,
        expectText: "Tasks",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_projects_page_ready",
        kind: "web_contract",
        path: "/projects",
        expectStatus: 200,
        expectText: "Projects",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_users_page_ready",
        kind: "web_contract",
        path: "/users",
        expectStatus: 200,
        expectText: "Users",
        mandatory: true,
        mutating: false
      },
      {
        id: "api_health_ready",
        kind: "api_health",
        path: "/health",
        expectStatus: 200,
        expectOk: true,
        mandatory: true,
        mutating: false
      },
      {
        id: "api_ready",
        kind: "api_ready",
        path: "/ready",
        expectStatus: 200,
        expectReady: true,
        mandatory: true,
        mutating: false
      },
      {
        id: "api_seed_task_ready",
        kind: "api_contract",
        capabilityId: "cap_get_task",
        pathParams: {
          task_id: "$env:TOPOGRAM_DEMO_TASK_ID"
        },
        expectShape: "task_detail",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_task_detail_owner_edit_visible",
        kind: "web_contract",
        path: "/tasks/$env:TOPOGRAM_DEMO_PRIMARY_ID",
        expectStatus: 200,
        expectText: "Edit Task",
        mandatory: true,
        mutating: false
      },
      {
        id: "web_task_detail_non_owner_edit_hidden",
        kind: "web_contract",
        path: "/tasks/$env:TOPOGRAM_DEMO_PRIMARY_ID?topogram_auth_user_id=99999999-9999-4999-8999-999999999999",
        expectStatus: 200,
        expectText: "Back to Tasks",
        expectNotText: "Edit Task",
        mandatory: true,
        mutating: false
      }
    ]
  },
  apiStage: {
    id: "api",
    name: "API Runtime Flows",
    failFast: false,
    checks: [
      { id: "create_task", kind: "api_contract", capabilityId: "cap_create_task", mutating: true, mandatory: true },
      { id: "get_created_task", kind: "api_contract", capabilityId: "cap_get_task", mutating: false, mandatory: true },
      { id: "list_tasks", kind: "api_contract", capabilityId: "cap_list_tasks", mutating: false, mandatory: true },
      { id: "export_tasks", kind: "api_contract", capabilityId: "cap_export_tasks", mutating: true, mandatory: true },
      { id: "get_task_export_job", kind: "api_contract", capabilityId: "cap_get_task_export_job", mutating: false, mandatory: true },
      { id: "download_task_export", kind: "api_contract", capabilityId: "cap_download_task_export", mutating: false, mandatory: true },
      { id: "project_lookup_ready", kind: "lookup_contract", lookupKey: "project", mandatory: true, mutating: false },
      { id: "user_lookup_ready", kind: "lookup_contract", lookupKey: "user", mandatory: true, mutating: false },
      { id: "update_without_precondition", kind: "api_negative", capabilityId: "cap_update_task", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mutating: false, mandatory: true },
      { id: "update_with_stale_precondition", kind: "api_negative", capabilityId: "cap_update_task", expectStatus: 412, expectErrorCode: "stale_precondition", stalePrecondition: true, mutating: false, mandatory: true },
      { id: "update_task", kind: "api_contract", capabilityId: "cap_update_task", mutating: true, mandatory: true },
      { id: "complete_without_precondition", kind: "api_negative", capabilityId: "cap_complete_task", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mutating: false, mandatory: true },
      { id: "complete_task", kind: "api_contract", capabilityId: "cap_complete_task", mutating: true, mandatory: true },
      { id: "delete_without_precondition", kind: "api_negative", capabilityId: "cap_delete_task", expectStatusFrom: "precondition", expectErrorCodeFrom: "precondition", mutating: false, mandatory: true },
      { id: "delete_task", kind: "api_contract", capabilityId: "cap_delete_task", mutating: true, mandatory: true },
      { id: "invalid_create_returns_4xx", kind: "api_negative", capabilityId: "cap_create_task", expectStatusClass: 4, expectErrorCode: "cap_create_task_invalid_request", mutating: false, mandatory: true },
      { id: "get_unknown_task_not_found", kind: "api_negative", capabilityId: "cap_get_task", expectStatus: 404, expectErrorCode: "cap_get_task_not_found", mutating: false, mandatory: true }
    ]
  },
  smokeChecks: [
    { id: "web_tasks_page", type: "web_get", path: "/tasks", expectStatus: 200, expectText: "Tasks" },
    { id: "create_task", type: "api_post", path: "/tasks", expectStatus: 201, capabilityId: "cap_create_task" },
    { id: "get_task", type: "api_get", path: "/tasks/:id", expectStatus: 200, capabilityId: "cap_get_task" },
    { id: "list_tasks", type: "api_get", path: "/tasks", expectStatus: 200, capabilityId: "cap_list_tasks" }
  ]
};
