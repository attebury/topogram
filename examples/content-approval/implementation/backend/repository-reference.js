export const CONTENT_APPROVAL_BACKEND_REPOSITORY_REFERENCE = {
  capabilityIds: [
    "cap_get_article",
    "cap_list_articles",
    "cap_create_article",
    "cap_update_article",
    "cap_request_article_revision",
    "cap_approve_article",
    "cap_reject_article"
  ],
  preconditionCapabilityIds: [
    "cap_update_article",
    "cap_request_article_revision",
    "cap_approve_article",
    "cap_reject_article"
  ],
  preconditionResource: {
    variableName: "currentArticle",
    repositoryMethod: "getArticle",
    inputField: "article_id",
    versionField: "updated_at"
  },
  downloadCapabilityId: null,
  repositoryInterfaceName: "ArticleRepository",
  prismaRepositoryClassName: "PrismaArticleRepository",
  drizzleRepositoryClassName: "DrizzleArticleRepository",
  dependencyName: "articleRepository",
  lookupBindings: [
    {
      entityId: "entity_publication",
      route: "/lookups/publications",
      repositoryMethod: "listPublicationOptions"
    },
    {
      entityId: "entity_user",
      route: "/lookups/users",
      repositoryMethod: "listUserOptions"
    }
  ],
  drizzleHint: "Use the Prisma profile for the runnable Content Approval runtime or fill in the Drizzle query logic here.",
  drizzleSchemaImports: ["articlesTable", "publicationsTable", "usersTable"],
  additionalTypeNames: ["LookupOption"],
  additionalTypeDeclarations: [
    `export interface LookupOption {\n  value: string;\n  label: string;\n}`
  ],
  additionalInterfaceMethods: [
    "listPublicationOptions(): Promise<LookupOption[]>;",
    "listUserOptions(): Promise<LookupOption[]>;"
  ]
};
