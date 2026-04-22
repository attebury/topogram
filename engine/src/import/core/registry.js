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
import { genericWorkflowExtractor } from "../extractors/workflows/generic.js";
import { genericVerificationExtractor } from "../extractors/verification/generic.js";
import { authSessionEnricher } from "../enrichers/auth-session.js";
import { djangoRestEnricher } from "../enrichers/django-rest.js";
import { railsModelEnricher } from "../enrichers/rails-models.js";
import { railsControllerEnricher } from "../enrichers/rails-controllers.js";
import { workflowTargetStateEnricher } from "../enrichers/workflow-target-state.js";
import { docLinkingEnricher } from "../enrichers/doc-linking.js";

export const extractorRegistry = {
  db: [prismaExtractor, djangoModelsExtractor, efCoreExtractor, roomExtractor, swiftDataExtractor, dotnetModelsExtractor, flutterEntitiesExtractor, reactNativeEntitiesExtractor, railsSchemaExtractor, liquibaseExtractor, myBatisXmlExtractor, jpaExtractor, drizzleExtractor, sqlExtractor, snapshotExtractor],
  api: [openApiExtractor, openApiCodeExtractor, graphQlSdlExtractor, graphQlCodeFirstExtractor, trpcExtractor, aspNetCoreExtractor, retrofitExtractor, swiftWebApiExtractor, flutterDioExtractor, reactNativeRepositoryExtractor, fastifyExtractor, expressExtractor, djangoRoutesExtractor, railsRoutesExtractor, micronautExtractor, jaxRsExtractor, springWebExtractor, nextRouteExtractor, genericRouteFallbackExtractor, nextServerActionExtractor, nextAuthExtractor],
  ui: [nextAppRouterUiExtractor, nextPagesRouterUiExtractor, androidComposeUiExtractor, blazorUiExtractor, razorPagesUiExtractor, swiftUiExtractor, uiKitExtractor, mauiXamlUiExtractor, flutterScreensUiExtractor, reactNativeScreensExtractor, reactRouterUiExtractor, svelteKitUiExtractor, backendOnlyUiExtractor],
  workflows: [genericWorkflowExtractor],
  verification: [genericVerificationExtractor]
};

export const enricherRegistry = {
  db: [railsModelEnricher],
  api: [djangoRestEnricher, railsControllerEnricher, authSessionEnricher],
  ui: [],
  workflows: [workflowTargetStateEnricher, docLinkingEnricher],
  verification: []
};

export function getExtractorsForTrack(track) {
  return extractorRegistry[track] || [];
}

export function getEnrichersForTrack(track) {
  return enricherRegistry[track] || [];
}
