import { prismaExtractor } from "../extractors/db/prisma.js";
import { djangoModelsExtractor } from "../extractors/db/django-models.js";
import { efCoreExtractor } from "../extractors/db/ef-core.js";
import { roomExtractor } from "../extractors/db/room.js";
import { swiftDataExtractor } from "../extractors/db/swiftdata.js";
import { dotnetModelsExtractor } from "../extractors/db/dotnet-models.js";
import { flutterEntitiesExtractor } from "../extractors/db/flutter-entities.js";
import { reactNativeEntitiesExtractor } from "../extractors/db/react-native-entities.js";
import { railsSchemaExtractor } from "../extractors/db/rails-schema.js";
import { liquibaseExtractor } from "../extractors/db/liquibase.js";
import { myBatisXmlExtractor } from "../extractors/db/mybatis-xml.js";
import { jpaExtractor } from "../extractors/db/jpa.js";
import { drizzleExtractor } from "../extractors/db/drizzle.js";
import { sqlExtractor } from "../extractors/db/sql.js";
import { snapshotExtractor } from "../extractors/db/snapshot.js";
import { openApiExtractor } from "../extractors/api/openapi.js";
import { openApiCodeExtractor } from "../extractors/api/openapi-code.js";
import { graphQlSdlExtractor } from "../extractors/api/graphql-sdl.js";
import { graphQlCodeFirstExtractor } from "../extractors/api/graphql-code-first.js";
import { trpcExtractor } from "../extractors/api/trpc.js";
import { aspNetCoreExtractor } from "../extractors/api/aspnet-core.js";
import { retrofitExtractor } from "../extractors/api/retrofit.js";
import { swiftWebApiExtractor } from "../extractors/api/swift-webapi.js";
import { flutterDioExtractor } from "../extractors/api/flutter-dio.js";
import { reactNativeRepositoryExtractor } from "../extractors/api/react-native-repository.js";
import { fastifyExtractor } from "../extractors/api/fastify.js";
import { expressExtractor } from "../extractors/api/express.js";
import { djangoRoutesExtractor } from "../extractors/api/django-routes.js";
import { railsRoutesExtractor } from "../extractors/api/rails-routes.js";
import { springWebExtractor } from "../extractors/api/spring-web.js";
import { micronautExtractor } from "../extractors/api/micronaut.js";
import { jaxRsExtractor } from "../extractors/api/jaxrs.js";
import { nextRouteExtractor } from "../extractors/api/next-route.js";
import { genericRouteFallbackExtractor } from "../extractors/api/generic-route-fallback.js";
import { nextServerActionExtractor } from "../extractors/api/next-server-action.js";
import { nextAuthExtractor } from "../extractors/api/nextauth.js";
import { nextAppRouterUiExtractor } from "../extractors/ui/next-app-router.js";
import { nextPagesRouterUiExtractor } from "../extractors/ui/next-pages-router.js";
import { androidComposeUiExtractor } from "../extractors/ui/android-compose.js";
import { blazorUiExtractor } from "../extractors/ui/blazor.js";
import { razorPagesUiExtractor } from "../extractors/ui/razor-pages.js";
import { swiftUiExtractor } from "../extractors/ui/swiftui.js";
import { uiKitExtractor } from "../extractors/ui/uikit.js";
import { mauiXamlUiExtractor } from "../extractors/ui/maui-xaml.js";
import { flutterScreensUiExtractor } from "../extractors/ui/flutter-screens.js";
import { reactNativeScreensExtractor } from "../extractors/ui/react-native-screens.js";
import { reactRouterUiExtractor } from "../extractors/ui/react-router.js";
import { svelteKitUiExtractor } from "../extractors/ui/sveltekit.js";
import { backendOnlyUiExtractor } from "../extractors/ui/backend-only.js";
import { genericCliExtractor } from "../extractors/cli/generic.js";
import { genericWorkflowExtractor } from "../extractors/workflows/generic.js";
import { genericVerificationExtractor } from "../extractors/verification/generic.js";
import { authSessionEnricher } from "../enrichers/auth-session.js";
import { djangoRestEnricher } from "../enrichers/django-rest.js";
import { railsModelEnricher } from "../enrichers/rails-models.js";
import { railsControllerEnricher } from "../enrichers/rails-controllers.js";
import { workflowTargetStateEnricher } from "../enrichers/workflow-target-state.js";
import { docLinkingEnricher } from "../enrichers/doc-linking.js";

function extractorPack(id, tracks, extractors, candidateKinds, stack = {}, capabilities = {}) {
  return {
    manifest: {
      id,
      version: "1",
      tracks,
      source: "bundled",
      extractors: extractors.map((extractor) => extractor.id),
      stack,
      capabilities,
      candidateKinds,
      evidenceTypes: ["runtime_source", "parser_config", "docs", "tests", "fixtures"]
    },
    extractors
  };
}

export const BUILTIN_EXTRACTOR_PACKS = [
  extractorPack(
    "topogram/db-extractors",
    ["db"],
    [prismaExtractor, djangoModelsExtractor, efCoreExtractor, roomExtractor, swiftDataExtractor, dotnetModelsExtractor, flutterEntitiesExtractor, reactNativeEntitiesExtractor, railsSchemaExtractor, liquibaseExtractor, myBatisXmlExtractor, jpaExtractor, drizzleExtractor, sqlExtractor, snapshotExtractor],
    ["entity", "enum", "relation", "index", "maintained_db_migration_seam"],
    { domain: "database" },
    { schema: true, migrations: true, maintainedSeams: true }
  ),
  extractorPack(
    "topogram/api-extractors",
    ["api"],
    [openApiExtractor, openApiCodeExtractor, graphQlSdlExtractor, graphQlCodeFirstExtractor, trpcExtractor, aspNetCoreExtractor, retrofitExtractor, swiftWebApiExtractor, flutterDioExtractor, reactNativeRepositoryExtractor, fastifyExtractor, expressExtractor, djangoRoutesExtractor, railsRoutesExtractor, micronautExtractor, jaxRsExtractor, springWebExtractor, nextRouteExtractor, genericRouteFallbackExtractor, nextServerActionExtractor, nextAuthExtractor],
    ["capability", "route", "stack"],
    { domain: "api" },
    { routes: true, openapi: true, graphql: true }
  ),
  extractorPack(
    "topogram/ui-extractors",
    ["ui"],
    [nextAppRouterUiExtractor, nextPagesRouterUiExtractor, androidComposeUiExtractor, blazorUiExtractor, razorPagesUiExtractor, swiftUiExtractor, uiKitExtractor, mauiXamlUiExtractor, flutterScreensUiExtractor, reactNativeScreensExtractor, reactRouterUiExtractor, svelteKitUiExtractor, backendOnlyUiExtractor],
    ["screen", "route", "action", "flow", "widget", "shape", "stack"],
    { domain: "ui" },
    { screens: true, widgets: true, flows: true }
  ),
  extractorPack(
    "topogram/cli-extractors",
    ["cli"],
    [genericCliExtractor],
    ["command", "capability", "cli_surface"],
    { domain: "cli" },
    { commands: true, options: true, effects: true }
  ),
  extractorPack(
    "topogram/workflow-extractors",
    ["workflows"],
    [genericWorkflowExtractor],
    ["workflow", "workflow_state", "workflow_transition"],
    { domain: "workflow" },
    { workflows: true }
  ),
  extractorPack(
    "topogram/verification-extractors",
    ["verification"],
    [genericVerificationExtractor],
    ["verification", "scenario", "framework", "script"],
    { domain: "verification" },
    { verifications: true }
  )
];

export const extractorRegistry = Object.fromEntries(
  ["db", "api", "ui", "cli", "workflows", "verification"].map((track) => [
    track,
    BUILTIN_EXTRACTOR_PACKS.flatMap((pack) => pack.extractors).filter((extractor) => extractor.track === track)
  ])
);

export const enricherRegistry = {
  db: [railsModelEnricher],
  api: [djangoRestEnricher, railsControllerEnricher, authSessionEnricher],
  ui: [],
  cli: [],
  workflows: [workflowTargetStateEnricher, docLinkingEnricher],
  verification: []
};

export function getExtractorsForTrack(track) {
  return extractorRegistry[track] || [];
}

export function getEnrichersForTrack(track) {
  return enricherRegistry[track] || [];
}

export function getBundledExtractorPack(id) {
  return BUILTIN_EXTRACTOR_PACKS.find((pack) => pack.manifest.id === id) || null;
}

export function getBundledExtractorById(id) {
  return BUILTIN_EXTRACTOR_PACKS.flatMap((pack) => pack.extractors).find((extractor) => extractor.id === id) || null;
}
