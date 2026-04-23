# Remaining Trial Policy

This page defines what the remaining local `trials/` directories in the product repo mean after the split to [topogram-demo](https://github.com/attebury/topogram-demo).

The short version:

- `topogram-demo` is the public home for imported proof claims
- `topogram` should keep only the smallest local trial set still needed for product-side regression or migration-era proof ops
- a local `trials/` directory is not automatically an active public claim

## Current Categories

### 1. Imported proof mirrors that now belong conceptually to `topogram-demo`

These are the active imported proof targets whose public source of truth is now `topogram-demo`:

- `trials/supabase-express-api`
- `trials/eShopOnWeb`
- `trials/clean-architecture-swiftui`
- `trials/rails-realworld-example-app`
- `trials/django-realworld-example-app`

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
- `trials/realworld-backend-spring`
- `trials/spring-boot-realworld-example-app`
- `trials/clean-architecture-delivery-example`
- `trials/realworld-api-quarkus`
- `trials/realworld-backend-micronaut`
- `trials/jakartaee-rest-sample`
- `trials/aspnetcore-realworld-example-app`
- `trials/pokedex-compose`
- `trials/prisma-nextjs-auth-starter`

Policy:

- these are local regression assets, not public evaluator-facing proof claims
- keep them only while they provide coverage that has not yet been extracted into curated fixtures
- prefer extracting the smallest stable source fixture into `engine/tests/fixtures/import` and then deleting the larger local trial

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

1. extract or replace the remaining local trial users in `engine/scripts/test.js`
2. remove local mirrors of the five active imported proof targets once the optional corpus lane no longer needs them
3. move historical brownfield-trial docs toward `topogram-demo` links or archive framing so local `trials/` paths stop reading like the active public proof home
