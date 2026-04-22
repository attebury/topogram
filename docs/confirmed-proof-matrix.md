# Confirmed Proof Matrix

This matrix tracks which brownfield stacks are fully closed proofs versus still-open baselines or partial proofs.

## Closed Proofs

These trials currently have:

- real imported brownfield evidence
- adopted canonical Topogram outputs
- saved `adoption-status` with `Next Bundle: None`
- no blocked adoption items

- Rails: `./trials/rails-realworld-example-app`
- Django: `./trials/django-realworld-example-app`
- Prisma Next.js Auth Starter: `./trials/prisma-nextjs-auth-starter`
- Supabase Express API: `./trials/supabase-express-api`
- tRPC Next Prisma Starter: `./trials/trpc-examples-next-prisma-starter`
- Prisma GraphQL SDL First: `./trials/prisma-examples/orm/graphql-sdl-first`
- Prisma GraphQL Nexus: `./trials/prisma-examples/orm/graphql-nexus`
- Nest GraphQL Source Only: `./trials/nest-graphql-source-only`
- Next.js GraphQL Source Only: `./trials/nextjs-graphql-source-only`
- GraphQL Nexus Source Only: `./trials/graphql-nexus-source-only`
- ASP.NET Core: `./trials/aspnetcore-realworld-example-app`
- Android: `./trials/pokedex-compose`
- iOS: `./trials/clean-architecture-swiftui`
- MAUI: `./trials/maui-samples/10.0/WebServices/TodoREST`
- Fastify: `./trials/fastify-demo`
- Flutter: `./trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)`
- React Native: `./trials/react-native-clean-architecture`
- RealWorld Backend Spring: `./trials/realworld-backend-spring`
- Spring Boot RealWorld Example App: `./trials/spring-boot-realworld-example-app`
- Clean Architecture Delivery Example: `./trials/clean-architecture-delivery-example`
- RealWorld API Quarkus: `./trials/realworld-api-quarkus`
- RealWorld Backend Micronaut: `./trials/realworld-backend-micronaut`
- Jakarta EE REST Sample: `./trials/jakartaee-rest-sample`

## Partial Or Open Proofs

There are currently no non-GraphQL app-stack proofs sitting in the partial/open bucket.
## Current Regression Contract

The cross-proof regression suite currently locks the closed-proof set above into a shared contract:

- saved `adoption-status.json` exists
- `next_bundle === null`
- `blocked_item_count === 0`
- `applied_item_count > 0`

As more partial proofs are cleaned up, they should move into the closed-proof set and be added to the same regression contract.
