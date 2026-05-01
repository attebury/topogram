export const HELLO_BACKEND_REPOSITORY_REFERENCE = {
  capabilityIds: [
    "cap_get_greeting",
    "cap_list_greetings",
    "cap_create_greeting",
    "cap_update_greeting"
  ],
  preconditionCapabilityIds: [],
  preconditionResource: {
    variableName: "currentGreeting",
    repositoryMethod: "getGreeting",
    inputField: "greeting_id",
    versionField: "created_at"
  },
  downloadCapabilityId: "",
  repositoryInterfaceName: "StarterRepository",
  prismaRepositoryClassName: "PrismaStarterRepository",
  drizzleRepositoryClassName: "DrizzleStarterRepository",
  dependencyName: "starterRepository",
  lookupBindings: [],
  export: {
    filename: "starter-export.json",
    contentType: "application/json"
  },
  drizzleHint: "Fill in Drizzle query logic if you switch this starter to a Drizzle runtime.",
  drizzleSchemaImports: ["greetingsTable"],
  additionalTypeNames: [],
  additionalTypeDeclarations: [],
  additionalInterfaceMethods: []
};
