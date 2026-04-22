# Docs

This directory collects planning and architecture notes for Topogram outside the engine-specific docs.

Current docs:

- [Human/Agent Collaboration Model](./human-agent-collaboration.md)
- [Agent Query Contract](./agent-query-contract.md)
- [Agent Task Modes](./agent-task-modes.md)
- [Workflow Presets Plan](./workflow-presets-plan.md)
- [Topogram Workspace Layout](./topogram-workspace-layout.md)
- [Proof Points And Limits](./proof-points-and-limits.md)
- [Visual Explanation Path](./visual-explanation-path.md)
- [Visual Style Notes](./visual-style-notes.md)
- [Auth Evaluator Path](./auth-evaluator-path.md)
- [Alpha Plan](./alpha-plan.md)
- [Alpha Overview](./alpha-overview.md)
- [Alpha Metrics Plan](./alpha-metrics-plan.md)
- [Alpha Metrics Instrumentation Plan](./alpha-metrics-instrumentation-plan.md)
- [Alpha-Ready Checklist](./alpha-ready-checklist.md)
- [Alpha Launch Tracker](./alpha-launch-tracker.md)
- [Alpha Launch And Repository Shaping Plan](./alpha-launch-and-repo-shaping-plan.md)
- [Invite-Led Alpha](./invite-led-alpha.md)
- [Design Partner Profile](./design-partner-profile.md)
- [Demo Path Confirmation Plan](./demo-path-confirmation-plan.md)
- [Skeptical Evaluator Guide](./skeptical-evaluator.md)
- [Evaluator Path](./evaluator-path.md)
- [Testing Strategy](./testing-strategy.md)
- [Topogram Product Glossary](./topogram-product-glossary.md)
- [Steady-State Development Loop](./steady-state-development-loop.md)
- [Maintained-App Boundary Mechanics](./maintained-app-boundary-mechanics.md)
- [Bearer JWT HS256 Auth Profile](./auth-profile-bearer-jwt-hs256.md)
- [Bearer Demo Auth Profile](./auth-profile-bearer-demo.md)
- [Auth Modeling](./auth-modeling.md)
- [Actors And Roles](./actors-and-roles.md)
- [Import Architecture Plan](./import-architecture-plan.md)
- [Artifact Taxonomy Roadmap](./artifact-taxonomy-roadmap.md)
- [UI Patterns Plan](./ui-patterns-plan.md)
- [Shared Topogram Security Plan](./shared-topogram-security-plan.md)
- [Provider Integration Plan](./provider-integration-plan.md)
- [Topogram + Graphify Integration Sketch](./topogram-graphify-integration-sketch.md)
- [Graphify Optional Evidence Integration Plan](./graphify-optional-evidence-plan.md)
- [Topogram + Agentic Stack Integration Sketch](./topogram-agentic-stack-integration-sketch.md)
- [Generic AWS Provider Example](./aws-provider-example.md)
- [Generic Chainguard Provider Example](./chainguard-provider-example.md)
- [Generic TeamCity Provider Example](./teamcity-provider-example.md)
- [Brownfield Import Roadmap](./brownfield-import-roadmap.md)
- [Confirmed Proof Repo Selection](./confirmed-proof-repo-selection.md)
- [Confirmed Proof Matrix](./confirmed-proof-matrix.md)
- [Development Decisions](./development-decisions.md)
- [Gaps And Missing Pieces](./gaps-and-missing-pieces.md)
- [Brownfield Trial: Prisma Next.js Auth Starter](./brownfield-trial-prisma-nextjs-auth-starter.md)
- [Brownfield Trial: Supabase Express API](./brownfield-trial-supabase-express-api.md)
- [Brownfield Trial: tRPC Next Prisma Starter](./brownfield-trial-trpc-next-prisma-starter.md)
- [Brownfield Trial: Prisma GraphQL SDL First](./brownfield-trial-graphql-sdl-first.md)
- [Brownfield Trial: Prisma GraphQL Nexus](./brownfield-trial-graphql-nexus.md)
- [Brownfield Trial: Nest GraphQL Source Only](./brownfield-trial-nest-graphql-source-only.md)
- [Brownfield Trial: Next.js GraphQL Source Only](./brownfield-trial-nextjs-graphql-source-only.md)
- [Brownfield Trial: GraphQL Nexus Source Only](./brownfield-trial-graphql-nexus-source-only.md)
- [Brownfield Trial: Rails RealWorld Example App](./brownfield-trial-rails-realworld-example-app.md)
- [Brownfield Trial: Django RealWorld Example App](./brownfield-trial-django-realworld-example-app.md)
- [Brownfield Trial: ASP.NET Core RealWorld Example App](./brownfield-trial-aspnetcore-realworld-example-app.md)
- [Brownfield Trial: Pokedex Compose](./brownfield-trial-pokedex-compose.md)
- [Brownfield Trial: Clean Architecture SwiftUI](./brownfield-trial-clean-architecture-swiftui.md)
- [Brownfield Trial: Firefox Focus UIKit](./brownfield-trial-firefox-focus-uikit.md)
- [Brownfield Trial: eShopOnWeb Blazor](./brownfield-trial-eshoponweb-blazor.md)
- [Brownfield Trial: eShopOnWeb Razor Pages MVC](./brownfield-trial-eshoponweb-razor-pages-mvc.md)
- [Brownfield Trial: MAUI TodoREST](./brownfield-trial-maui-todorest.md)
- [Brownfield Trial: Flutter Go Rest App](./brownfield-trial-flutter-go-rest-app.md)
- [Brownfield Trial: React Native Clean Architecture](./brownfield-trial-react-native-clean-architecture.md)
- [Brownfield Trial: RealWorld Backend Spring](./brownfield-trial-realworld-backend-spring.md)
- [Brownfield Trial: Spring Boot RealWorld Example App](./brownfield-trial-spring-boot-realworld-example-app.md)
- [Brownfield Trial: Clean Architecture Delivery Example](./brownfield-trial-clean-architecture-delivery-example.md)
- [Brownfield Trial: RealWorld API Quarkus](./brownfield-trial-realworld-api-quarkus.md)
- [Brownfield Trial: RealWorld Backend Micronaut](./brownfield-trial-realworld-backend-micronaut.md)
- [Brownfield Trial: Jakarta EE REST Sample](./brownfield-trial-jakartaee-rest-sample.md)

These docs focus on:

- human/agent collaboration boundaries
- canonical vs candidate vs generated workspace structure
- testing and verification strategy
- generated auth profile behavior and limits, with signed JWT as the primary alpha auth profile and bearer-demo as a lighter demo/local profile
- authorization modeling guidance
- actor and role modeling guidance
- brownfield import architecture
- artifact taxonomy and long-lived knowledge surfaces
- development-time product and modeling decisions
- workflow and adoption planning
- agent-queryable context and adoption surfaces
- extractor and generator roadmap
- real-trial findings and next steps

Notable current adoption behavior:

- use `reconcile adopt <selector> ... --write` for normal selective promotion
- use `reconcile adopt <selector> ... --refresh-adopted --write` only when you want to refresh existing machine-managed canonical files from improved candidate imports
