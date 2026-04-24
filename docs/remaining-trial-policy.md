# Remaining Trial Policy

This page defines what the remaining local `trials/` directories in the product repo mean after the split to [topogram-demo](https://github.com/attebury/topogram-demo).

The short version:

- `topogram-demo` is the public home for imported proof claims
- `topogram` should keep only the smallest local trial set still needed for product-side regression or migration-era proof ops
- a local `trials/` directory is not automatically an active public claim

## Current Categories

### 1. Imported proof mirrors that now belong conceptually to `topogram-demo`

These are the active imported proof targets whose public source of truth is now `topogram-demo`:


Why they still exist locally:

- migration-era historical brownfield docs still reference them
- the opt-in legacy corpus check in `engine/scripts/test.js` still reads some of them directly

Policy:

- treat `topogram-demo/examples/imported/*` as the public proof source of truth
- do not describe the local `trials/` copies as the public proof home
- remove these local mirrors once product-repo scripts no longer need them

### 2. Local legacy proof-corpus fixtures still used by the optional corpus check

These remain in `topogram` because the opt-in `npm run test:proof-corpus` lane still uses them as realistic importer inputs:

- `trials/trpc-examples-next-prisma-starter`
- `trials/fastify-demo`

Policy:

- these are local regression assets, not public evaluator-facing proof claims
- keep them only while they provide coverage that has not yet been extracted into curated fixtures
- prefer extracting the smallest stable source fixture into `engine/tests/fixtures/import` and then deleting the larger local trial

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

### 3. Removed or no-longer-needed corpus material

Large local corpora such as `ui-survey`, `maui-samples`, and `prisma-examples` have already been cut down or replaced with extracted fixtures.

Policy:

- do not reintroduce large checked-in corpus trees just because a single subpath is useful
- extract the smallest needed fixture instead
- if a large upstream corpus is needed again, treat it as recloneable local data, not default checked-in repo content

## Rules For New Trial Additions

Do not add a new top-level `trials/<name>` directory unless at least one of these is true:

- it is an active imported proof target that is also being managed in `topogram-demo`
- it is temporarily needed during a migration from live trial repo to curated fixture
- it is the smallest practical local input for a product-side regression that cannot yet be represented as a curated fixture

Bias:

- prefer `engine/tests/fixtures/import/*` for automated regression inputs
- prefer `topogram-demo/examples/imported/*` for public imported proof claims
- keep `trials/` as a shrinking migration-era compatibility layer, not as a growing corpus

## Next Cleanup Steps

The next reduction targets are:

1. keep extracting the remaining local trial users in `engine/scripts/test.js` into curated fixtures where the source tree is small enough to carry cleanly
2. remove local mirrors of the five active imported proof targets once the optional corpus lane no longer needs them
3. move historical brownfield-trial docs toward `topogram-demo` links or archive framing so local `trials/` paths stop reading like the active public proof home
