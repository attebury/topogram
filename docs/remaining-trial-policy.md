# Remaining Trial Policy

This page records the completed migration away from checked-in local `trials/` directories in the product repo after the split to [topogram-demo](https://github.com/attebury/topogram-demo).

The short version:

- `topogram-demo` is the public home for imported proof claims
- `topogram` now keeps proof-corpus inputs under `engine/tests/fixtures/import`
- the product repo no longer treats a top-level `trials/` tree as required checked-in state

## Completed Migration

Imported proof mirrors now live publicly in `topogram-demo/examples/imported/*`, and product-side proof-corpus coverage now runs from curated fixtures under `engine/tests/fixtures/import`.

Policy:

- treat `topogram-demo/examples/imported/*` as the public proof source of truth
- treat `engine/tests/fixtures/import/*` as the product repo's regression fixture source of truth
- do not reintroduce local `trials/` copies when a curated fixture or `topogram-demo` target already exists

`pokedex-compose` is now the model for this extraction path:

- the product repo keeps the smaller curated fixture at `engine/tests/fixtures/import/pokedex-compose-source`
- the larger local `trials/pokedex-compose` copy should not be treated as required repo state anymore

`eShopOnWeb` now follows the same rule on the product side:

- the product repo keeps the smaller curated fixture at `engine/tests/fixtures/import/eshoponweb-source`
- the public imported proof source of truth remains `topogram-demo/examples/imported/eshoponweb`
- the larger local `trials/eShopOnWeb` copy should not be treated as required repo state anymore

`supabase-express-api` now follows the same rule on the product side:

- the product repo keeps the smaller curated fixture at `engine/tests/fixtures/import/supabase-express-api-source`
- the public imported proof source of truth remains `topogram-demo/examples/imported/supabase-express-api`
- the larger local `trials/supabase-express-api` copy should not be treated as required repo state anymore

`rails-realworld-example-app` and `django-realworld-example-app` now follow the same rule on the product side:

- the product repo keeps the smaller curated fixtures at `engine/tests/fixtures/import/rails-realworld-example-app-source` and `engine/tests/fixtures/import/django-realworld-example-app-source`
- the public imported proof source of truth remains `topogram-demo/examples/imported/rails-realworld-example-app` and `topogram-demo/examples/imported/django-realworld-example-app`
- the larger local `trials/rails-realworld-example-app` and `trials/django-realworld-example-app` copies should not be treated as required repo state anymore

`clean-architecture-swiftui` now follows the same rule on the product side:

- the product repo keeps the smaller curated fixture at `engine/tests/fixtures/import/clean-architecture-swiftui-source`
- the public imported proof source of truth remains `topogram-demo/examples/imported/clean-architecture-swiftui`
- the larger local `trials/clean-architecture-swiftui` copy should not be treated as required repo state anymore

`prisma-nextjs-auth-starter` now follows the same rule for proof-only corpus coverage:

- the product repo keeps the smaller proof snapshot fixture at `engine/tests/fixtures/import/prisma-nextjs-auth-proof`
- the optional corpus lane uses that extracted `topogram/` snapshot directly for confirmed-proof coverage
- the larger local `trials/prisma-nextjs-auth-starter` copy should not be treated as required repo state anymore

`spring-boot-realworld-example-app` now follows the standard source-plus-proof fixture rule:

- the product repo keeps the extracted fixture at `engine/tests/fixtures/import/spring-boot-realworld-example-app-fixture`
- the optional corpus lane uses that fixture for both import coverage and confirmed-proof coverage
- the larger local `trials/spring-boot-realworld-example-app` copy should not be treated as required repo state anymore

`realworld-backend-spring` and `clean-architecture-delivery-example` now follow the same standard source-plus-proof fixture rule:

- the product repo keeps the extracted fixtures at `engine/tests/fixtures/import/realworld-backend-spring-fixture` and `engine/tests/fixtures/import/clean-architecture-delivery-example-fixture`
- the optional corpus lane uses those fixtures for both import coverage and confirmed-proof coverage
- the larger local `trials/realworld-backend-spring` and `trials/clean-architecture-delivery-example` copies should not be treated as required repo state anymore

`realworld-api-quarkus`, `realworld-backend-micronaut`, and `jakartaee-rest-sample` now follow the same standard source-plus-proof fixture rule:

- the product repo keeps the extracted fixtures at `engine/tests/fixtures/import/realworld-api-quarkus-fixture`, `engine/tests/fixtures/import/realworld-backend-micronaut-fixture`, and `engine/tests/fixtures/import/jakartaee-rest-sample-fixture`
- the optional corpus lane uses those fixtures for both import coverage and confirmed-proof coverage
- the larger local `trials/realworld-api-quarkus`, `trials/realworld-backend-micronaut`, and `trials/jakartaee-rest-sample` copies should not be treated as required repo state anymore

`aspnetcore-realworld-example-app` now follows the same standard source-plus-proof fixture rule:

- the product repo keeps the extracted fixture at `engine/tests/fixtures/import/aspnetcore-realworld-example-app-fixture`
- the optional corpus lane uses that fixture for both import coverage and confirmed-proof coverage
- the larger local `trials/aspnetcore-realworld-example-app` copy should not be treated as required repo state anymore

`trpc-examples-next-prisma-starter` and `fastify-demo` now follow the same standard source-plus-proof fixture rule:

- the product repo keeps the extracted fixtures at `engine/tests/fixtures/import/trpc-examples-next-prisma-starter-fixture` and `engine/tests/fixtures/import/fastify-demo-fixture`
- the optional corpus lane uses those fixtures for both import and confirmed-proof coverage, including verification import coverage for the tRPC example
- the larger local `trials/trpc-examples-next-prisma-starter` and `trials/fastify-demo` copies should not be treated as required repo state anymore

### 3. Removed or no-longer-needed corpus material

Large local corpora such as `ui-survey`, `maui-samples`, and `prisma-examples` have already been cut down or replaced with extracted fixtures.

Policy:

- do not reintroduce large checked-in corpus trees just because a single subpath is useful
- extract the smallest needed fixture instead
- if a large upstream corpus is needed again, treat it as recloneable local data, not default checked-in repo content

## Completed State

`trials/` is no longer part of the required checked-in product repo layout.

The proof-corpus inputs now live under `engine/tests/fixtures/import`, and any future corpus additions should default to curated fixtures instead of reintroducing a top-level checked-in `trials/` directory.

## Rules For New Trial Additions

Do not add a new top-level `trials/<name>` directory unless at least one of these is true:

- it is an active imported proof target that is also being managed in `topogram-demo`
- it is temporarily needed during a migration from live trial repo to curated fixture
- it is the smallest practical local input for a product-side regression that cannot yet be represented as a curated fixture

Bias:

- prefer `engine/tests/fixtures/import/*` for automated regression inputs
- prefer `topogram-demo/examples/imported/*` for public imported proof claims
- keep `trials/` out of the product repo rather than recreating it as a compatibility layer
