export const APP_BASIC_BACKEND_REPOSITORY_REFERENCE = {
  capabilityIds: [
    "cap_get_collection",
    "cap_list_collections",
    "cap_create_collection",
    "cap_update_collection",
    "cap_get_member",
    "cap_list_members",
    "cap_create_member",
    "cap_update_member",
    "cap_get_item",
    "cap_list_items",
    "cap_create_item",
    "cap_update_item",
    "cap_complete_item",
    "cap_delete_item",
    "cap_export_items",
    "cap_get_item_export_job"
  ],
  preconditionCapabilityIds: [
    "cap_update_item",
    "cap_complete_item",
    "cap_delete_item"
  ],
  preconditionResource: {
    variableName: "currentItem",
    repositoryMethod: "getItem",
    inputField: "item_id",
    versionField: "updated_at"
  },
  downloadCapabilityId: "cap_download_item_export",
  repositoryInterfaceName: "AppBasicRepository",
  prismaRepositoryClassName: "PrismaAppBasicRepository",
  drizzleRepositoryClassName: "DrizzleAppBasicRepository",
  dependencyName: "appBasicRepository",
  lookupBindings: [
    {
      entityId: "entity_collection",
      route: "/lookups/collections",
      repositoryMethod: "listCollectionOptions"
    },
    {
      entityId: "entity_member",
      route: "/lookups/members",
      repositoryMethod: "listMemberOptions"
    }
  ],
  export: {
    filename: "item-export.zip",
    contentType: "application/zip"
  },
  drizzleHint: "Use the Prisma profile for the runnable app-basic runtime or fill in the Drizzle query logic here.",
  drizzleSchemaImports: ["itemsTable", "collectionsTable", "membersTable"],
  additionalTypeNames: [
    "DownloadItemExportInput",
    "DownloadItemExportResult",
    "MarkExportJobCompletedInput",
    "MarkExportJobCompletedResult",
    "LookupOption"
  ],
  additionalTypeDeclarations: [
    `export interface DownloadItemExportInput {\n  job_id: string;\n}`,
    `export interface DownloadItemExportResult {\n  body: Uint8Array;\n  contentType: string;\n  filename: string;\n}`,
    `export interface LookupOption {\n  value: string;\n  label: string;\n}`,
    `export interface MarkExportJobCompletedInput {\n  job_id: string;\n  state: string;\n  download_url?: string;\n  error_message?: string;\n}`,
    `export interface MarkExportJobCompletedResult {\n  job_id: string;\n  state: string;\n}`
  ],
  additionalInterfaceMethods: [
    "listCollectionOptions(): Promise<LookupOption[]>;",
    "listMemberOptions(): Promise<LookupOption[]>;",
    "downloadItemExport(input: DownloadItemExportInput): Promise<DownloadItemExportResult>;",
    "markExportJobCompleted(input: MarkExportJobCompletedInput): Promise<MarkExportJobCompletedResult>;"
  ]
};
