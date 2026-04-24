import path from "node:path";

export const importFixtureCatalog = [
  {
    key: "prismaOpenApiPath",
    slug: "prisma-openapi",
    kind: "contract-source",
    usedBy: ["test:proof-corpus"],
    description: "Prisma-backed OpenAPI import fixture for DB/API importer coverage."
  },
  {
    key: "sqlOpenApiPath",
    slug: "sql-openapi",
    kind: "contract-source",
    usedBy: ["test:proof-corpus"],
    description: "SQL-backed OpenAPI import fixture for DB/API importer coverage."
  },
  {
    key: "incompleteImportTopogramPath",
    slug: "incomplete-topogram/topogram",
    kind: "adoption-planning",
    usedBy: ["agent-planning docs", "test:proof-corpus"],
    description: "Incomplete Topogram workspace used for import/adopt planning and review-packet flows."
  },
  {
    key: "prismaNextjsAuthProofPath",
    slug: "prisma-nextjs-auth-proof",
    kind: "proof-only",
    usedBy: ["test:proof-corpus"],
    description: "Extracted auth proof snapshot used only for confirmed-proof coverage."
  },
  {
    key: "routeFallbackPath",
    slug: "route-fallback",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    description: "Minimal importer fallback fixture for route and UI route heuristics."
  },
  {
    key: "supabaseExpressTrialPath",
    slug: "supabase-express-api-source",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    publicHome: "topogram-demo/examples/imported/supabase-express-api",
    description: "Curated source fixture for the Supabase Express imported proof target."
  },
  {
    key: "trpcTrialPath",
    slug: "trpc-examples-next-prisma-starter-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "tRPC + Next + Prisma source and proof fixture."
  },
  {
    key: "fastifyTrialPath",
    slug: "fastify-demo-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Fastify importer and confirmed-proof fixture."
  },
  {
    key: "railsTrialPath",
    slug: "rails-realworld-example-app-source",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    publicHome: "topogram-demo/examples/imported/rails-realworld-example-app",
    description: "Curated Rails RealWorld source fixture."
  },
  {
    key: "djangoTrialPath",
    slug: "django-realworld-example-app-source",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    publicHome: "topogram-demo/examples/imported/django-realworld-example-app",
    description: "Curated Django RealWorld source fixture."
  },
  {
    key: "springTrialPath",
    slug: "realworld-backend-spring-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Spring backend source and confirmed-proof fixture."
  },
  {
    key: "springBootRealworldTrialPath",
    slug: "spring-boot-realworld-example-app-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Spring Boot RealWorld source and confirmed-proof fixture."
  },
  {
    key: "cleanArchitectureDeliveryTrialPath",
    slug: "clean-architecture-delivery-example-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Java clean-architecture delivery source and proof fixture."
  },
  {
    key: "quarkusTrialPath",
    slug: "realworld-api-quarkus-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Quarkus API source and confirmed-proof fixture."
  },
  {
    key: "micronautTrialPath",
    slug: "realworld-backend-micronaut-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Micronaut backend source and confirmed-proof fixture."
  },
  {
    key: "jakartaEeTrialPath",
    slug: "jakartaee-rest-sample-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Jakarta EE REST source and confirmed-proof fixture."
  },
  {
    key: "aspnetCoreTrialPath",
    slug: "aspnetcore-realworld-example-app-fixture",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "ASP.NET Core RealWorld source and confirmed-proof fixture."
  },
  {
    key: "eShopOnWebTrialPath",
    slug: "eshoponweb-source",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    publicHome: "topogram-demo/examples/imported/eshoponweb",
    description: "Curated eShopOnWeb source fixture."
  },
  {
    key: "pokedexComposeTrialPath",
    slug: "pokedex-compose-source",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    description: "Android Compose source fixture for importer coverage."
  },
  {
    key: "swiftUiTrialPath",
    slug: "clean-architecture-swiftui-source",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    publicHome: "topogram-demo/examples/imported/clean-architecture-swiftui",
    description: "Curated SwiftUI source fixture for imported iOS proof coverage."
  },
  {
    key: "uiKitTrialPath",
    slug: "focus-ios-source",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    description: "UIKit source fixture extracted from the UI survey corpus."
  },
  {
    key: "mauiTodoRestTrialPath",
    slug: "maui-todo-rest-source",
    kind: "source-only",
    usedBy: ["test:proof-corpus"],
    description: "MAUI TodoREST source fixture."
  },
  {
    key: "flutterGoRestTrialPath",
    slug: "flutter-go-rest-source",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Flutter + Go REST source and confirmed-proof fixture."
  },
  {
    key: "reactNativeTrialPath",
    slug: "react-native-clean-architecture-source",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "React Native clean-architecture source and confirmed-proof fixture."
  },
  {
    key: "graphqlSdlTrialPath",
    slug: "graphql-sdl-first-source",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "GraphQL SDL-first source and confirmed-proof fixture."
  },
  {
    key: "nestGraphqlTrialPath",
    slug: "nest-graphql-source",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Nest GraphQL source and confirmed-proof fixture."
  },
  {
    key: "nextGraphqlTrialPath",
    slug: "nextjs-graphql-source",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "Next.js GraphQL source and confirmed-proof fixture."
  },
  {
    key: "nexusGraphqlTrialPath",
    slug: "graphql-nexus-source",
    kind: "source-plus-proof",
    usedBy: ["test:proof-corpus"],
    description: "GraphQL Nexus source and confirmed-proof fixture."
  },
  {
    key: "maintainedSeamCandidatesPath",
    slug: "maintained-seam-candidates",
    kind: "narrow-test",
    usedBy: ["engine narrow tests"],
    description: "Real-trial-derived maintained seam candidate fixtures used by narrow tests."
  }
];

export function resolveImportFixturePaths(workspaceRoot) {
  const importFixturesRoot = path.join(workspaceRoot, "tests", "fixtures", "import");
  return Object.fromEntries(
    importFixtureCatalog.map(({ key, slug }) => [key, path.join(importFixturesRoot, ...slug.split("/"))])
  );
}

export function listImportFixtureInventory(workspaceRoot) {
  const importFixturesRoot = path.join(workspaceRoot, "tests", "fixtures", "import");
  return importFixtureCatalog.map((fixture) => ({
    ...fixture,
    absolutePath: path.join(importFixturesRoot, ...fixture.slug.split("/"))
  }));
}
