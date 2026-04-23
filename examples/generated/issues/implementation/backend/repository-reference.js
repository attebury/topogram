export const ISSUES_BACKEND_REPOSITORY_REFERENCE = {
  capabilityIds: [
    "cap_get_issue",
    "cap_list_issues",
    "cap_create_issue",
    "cap_update_issue",
    "cap_close_issue"
  ],
  preconditionCapabilityIds: [
    "cap_update_issue",
    "cap_close_issue"
  ],
  preconditionResource: {
    variableName: "currentIssue",
    repositoryMethod: "getIssue",
    inputField: "issue_id",
    versionField: "updated_at"
  },
  downloadCapabilityId: null,
  repositoryInterfaceName: "IssueRepository",
  prismaRepositoryClassName: "PrismaIssueRepository",
  drizzleRepositoryClassName: "DrizzleIssueRepository",
  dependencyName: "issueRepository",
  lookupBindings: [
    {
      entityId: "entity_board",
      route: "/lookups/boards",
      repositoryMethod: "listBoardOptions"
    },
    {
      entityId: "entity_user",
      route: "/lookups/users",
      repositoryMethod: "listUserOptions"
    }
  ],
  drizzleHint: "Use the Prisma profile for the runnable Issues runtime or fill in the Drizzle query logic here.",
  drizzleSchemaImports: ["issuesTable", "boardsTable", "usersTable"],
  additionalTypeNames: ["LookupOption"],
  additionalTypeDeclarations: [
    `export interface LookupOption {\n  value: string;\n  label: string;\n}`
  ],
  additionalInterfaceMethods: [
    "listBoardOptions(): Promise<LookupOption[]>;",
    "listUserOptions(): Promise<LookupOption[]>;"
  ]
};
