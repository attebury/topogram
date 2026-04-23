export const TODO_BACKEND_REPOSITORY_REFERENCE = {
  capabilityIds: [
    "cap_get_project",
    "cap_list_projects",
    "cap_create_project",
    "cap_update_project",
    "cap_get_user",
    "cap_list_users",
    "cap_create_user",
    "cap_update_user",
    "cap_get_task",
    "cap_list_tasks",
    "cap_create_task",
    "cap_update_task",
    "cap_complete_task",
    "cap_delete_task",
    "cap_export_tasks",
    "cap_get_task_export_job"
  ],
  preconditionCapabilityIds: [
    "cap_update_task",
    "cap_complete_task",
    "cap_delete_task"
  ],
  preconditionResource: {
    variableName: "currentTask",
    repositoryMethod: "getTask",
    inputField: "task_id",
    versionField: "updated_at"
  },
  downloadCapabilityId: "cap_download_task_export",
  repositoryInterfaceName: "TodoRepository",
  prismaRepositoryClassName: "PrismaTodoRepository",
  drizzleRepositoryClassName: "DrizzleTodoRepository",
  dependencyName: "todoRepository",
  lookupBindings: [
    {
      entityId: "entity_project",
      route: "/lookups/projects",
      repositoryMethod: "listProjectOptions"
    },
    {
      entityId: "entity_user",
      route: "/lookups/users",
      repositoryMethod: "listUserOptions"
    }
  ],
  export: {
    filename: "task-export.zip",
    contentType: "application/zip"
  },
  drizzleHint: "Use the Prisma profile for the runnable Todo runtime or fill in the Drizzle query logic here.",
  drizzleSchemaImports: ["tasksTable", "projectsTable", "usersTable"],
  additionalTypeNames: [
    "DownloadTaskExportInput",
    "DownloadTaskExportResult",
    "MarkExportJobCompletedInput",
    "MarkExportJobCompletedResult",
    "LookupOption"
  ],
  additionalTypeDeclarations: [
    `export interface DownloadTaskExportInput {\n  job_id: string;\n}`,
    `export interface DownloadTaskExportResult {\n  body: Uint8Array;\n  contentType: string;\n  filename: string;\n}`,
    `export interface LookupOption {\n  value: string;\n  label: string;\n}`,
    `export interface MarkExportJobCompletedInput {\n  job_id: string;\n  state: string;\n  download_url?: string;\n  error_message?: string;\n}`,
    `export interface MarkExportJobCompletedResult {\n  job_id: string;\n  state: string;\n}`
  ],
  additionalInterfaceMethods: [
    "listProjectOptions(): Promise<LookupOption[]>;",
    "listUserOptions(): Promise<LookupOption[]>;",
    "downloadTaskExport(input: DownloadTaskExportInput): Promise<DownloadTaskExportResult>;",
    "markExportJobCompleted(input: MarkExportJobCompletedInput): Promise<MarkExportJobCompletedResult>;"
  ]
};
