export const TODO_WEB_REFERENCE = {
  brandName: "Topogram Todo",
  client: {
    primaryParam: "task_id",
    functionNames: {
      list: "listTasks",
      get: "getTask",
      create: "createTask",
      update: "updateTask",
      terminal: "completeTask"
    },
    capabilityIds: {
      list: "cap_list_tasks",
      get: "cap_get_task",
      create: "cap_create_task",
      update: "cap_update_task",
      terminal: "cap_complete_task"
    },
    extraFunctions: [
      { name: "deleteTask", capabilityId: "cap_delete_task", primaryParam: "task_id" },
      { name: "exportTasks", capabilityId: "cap_export_tasks" },
      { name: "getTaskExportJob", capabilityId: "cap_get_task_export_job", primaryParam: "job_id" }
    ]
  },
  nav: {
    browseLabel: "Tasks",
    browseRoute: "/tasks",
    createLabel: "Create Task",
    createRoute: "/tasks/new",
    links: [
      { label: "Tasks", route: "/tasks" },
      { label: "Projects", route: "/projects" },
      { label: "Users", route: "/users" }
    ]
  },
  home: {
    demoPrimaryEnvVar: "PUBLIC_TOPOGRAM_DEMO_PRIMARY_ID",
    demoTaskLabel: "Open Demo Task",
    heroDescriptionTemplate: "Generated from Topogram via the PROFILE profile and wired to a multi-resource workspace for tasks, projects, and users.",
    dynamicRouteText: "This screen uses a dynamic route.",
    noRouteText: "No direct route is exposed for this screen."
  },
  createPrimary: {
    defaultAssigneeEnvVar: "PUBLIC_TOPOGRAM_DEMO_USER_ID",
    defaultContainerEnvVar: "PUBLIC_TOPOGRAM_DEMO_CONTAINER_ID",
    helperText: "A project is required to create a task. Owner is optional.",
    projectPlaceholder: "Select a project",
    cancelLabel: "Cancel",
    submitLabel: "Create Task"
  }
};
