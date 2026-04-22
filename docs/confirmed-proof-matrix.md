# Confirmed Proof Matrix

This matrix tracks which brownfield stacks are fully closed proofs versus still-open baselines or partial proofs.

## Closed Proofs

These trials currently have:

- real imported brownfield evidence
- adopted canonical Topogram outputs
- saved `adoption-status` with `Next Bundle: None`
- no blocked adoption items

- Rails: `/Users/attebury/Documents/topogram/trials/rails-realworld-example-app`
- Django: `/Users/attebury/Documents/topogram/trials/django-realworld-example-app`
- Prisma Next.js Auth Starter: `/Users/attebury/Documents/topogram/trials/prisma-nextjs-auth-starter`
- Supabase Express API: `/Users/attebury/Documents/topogram/trials/supabase-express-api`
- tRPC Next Prisma Starter: `/Users/attebury/Documents/topogram/trials/trpc-examples-next-prisma-starter`
- Prisma GraphQL SDL First: `/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-sdl-first`
- Prisma GraphQL Nexus: `/Users/attebury/Documents/topogram/trials/prisma-examples/orm/graphql-nexus`
- Nest GraphQL Source Only: `/Users/attebury/Documents/topogram/trials/nest-graphql-source-only`
- Next.js GraphQL Source Only: `/Users/attebury/Documents/topogram/trials/nextjs-graphql-source-only`
- GraphQL Nexus Source Only: `/Users/attebury/Documents/topogram/trials/graphql-nexus-source-only`
- ASP.NET Core: `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app`
- Android: `/Users/attebury/Documents/topogram/trials/pokedex-compose`
- iOS: `/Users/attebury/Documents/topogram/trials/clean-architecture-swiftui`
- MAUI: `/Users/attebury/Documents/topogram/trials/maui-samples/10.0/WebServices/TodoREST`
- Fastify: `/Users/attebury/Documents/topogram/trials/fastify-demo`
- Flutter: `/Users/attebury/Documents/topogram/trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)`
- React Native: `/Users/attebury/Documents/topogram/trials/react-native-clean-architecture`
- RealWorld Backend Spring: `/Users/attebury/Documents/topogram/trials/realworld-backend-spring`
- Spring Boot RealWorld Example App: `/Users/attebury/Documents/topogram/trials/spring-boot-realworld-example-app`
- Clean Architecture Delivery Example: `/Users/attebury/Documents/topogram/trials/clean-architecture-delivery-example`
- RealWorld API Quarkus: `/Users/attebury/Documents/topogram/trials/realworld-api-quarkus`
- RealWorld Backend Micronaut: `/Users/attebury/Documents/topogram/trials/realworld-backend-micronaut`
- Jakarta EE REST Sample: `/Users/attebury/Documents/topogram/trials/jakartaee-rest-sample`

## Partial Or Open Proofs

There are currently no non-GraphQL app-stack proofs sitting in the partial/open bucket.
## Current Regression Contract

The cross-proof regression suite currently locks the closed-proof set above into a shared contract:

- saved `adoption-status.json` exists
- `next_bundle === null`
- `blocked_item_count === 0`
- `applied_item_count > 0`

As more partial proofs are cleaned up, they should move into the closed-proof set and be added to the same regression contract.
