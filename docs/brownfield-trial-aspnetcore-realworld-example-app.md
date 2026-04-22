# Brownfield Trial: ASP.NET Core RealWorld Example App

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app`
- Source: `gothinkster/aspnetcore-realworld-example-app`

## What This Trial Proved

This trial confirmed that the extractor-registry architecture can recover a credible backend/domain model from a real ASP.NET Core app with:

- EF Core domain models and `DbContext`
- ASP.NET Core controllers with attribute routing
- feature-folder request/response types
- auth and workflow semantics from controller + feature contracts

## Import Coverage

Current ASP.NET Core support in Topogram covers:

- `db/ef-core`
  - `DbContext`
  - `DbSet<T>`
  - domain model property extraction
  - join/link entity suppression for low-signal relationship tables
- `api/aspnet-core`
  - controller discovery
  - class-level and method-level route attributes
  - auth hints from `[Authorize]`
  - body/query/path extraction
  - feature-type flattening from nested `Create.Command`, `Login.Command`, and envelope records

## Imported Domain Surface

Recovered core bundles:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

Suppressed implementation-noise bundles:

- `articlefavorite`
- `articletag`
- `followedpeople`

## Canonical Outputs

The trial now has canonical Topogram outputs under:

- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/entities`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/capabilities`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/shapes`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/decisions`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/docs/workflows`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/docs/journeys`

Representative adopted canonical concepts include:

- `article`
- `comment`
- `profile`
- `tag`
- `user`
- `account`

## Journey Draft Proof

This trial now also proves the brownfield journey drafting and promotion path end to end.

From `/Users/attebury/Documents/topogram/engine`, the supported flow is:

```bash
node ./src/cli.js adoption status ../trials/aspnetcore-realworld-example-app
node ./src/cli.js reconcile adopt journeys ../trials/aspnetcore-realworld-example-app --write
node ./src/cli.js adoption status ../trials/aspnetcore-realworld-example-app
```

What this proves:

- the trial exposes candidate journey drafts through the brownfield reconcile/adoption path
- `reconcile adopt journeys --write` promotes only candidate `kind: journey` docs
- the canonical journey docs land under `topogram/docs/journeys/`
- the trial reaches `Next Bundle: None` after promotion

Representative canonical journey outputs now on disk:

- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/docs/journeys/account_journey.md`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/docs/journeys/article_journey.md`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/docs/journeys/comment_journey.md`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/docs/journeys/profile_journey.md`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/docs/journeys/tag_journey.md`
- `/Users/attebury/Documents/topogram/trials/aspnetcore-realworld-example-app/topogram/docs/journeys/user_journey.md`

Current trust boundary:

- canonical files on disk are the primary proof surface
- adoption status is now consistent enough to show `Next Bundle: None`, but canonical outputs remain the thing we should trust most when reviewing brownfield promotion results

## Important Current Boundary

The saved status/report state is still slightly conservative around workflow-review persistence for this trial. The canonical files on disk are the trustworthy proof surface right now; the persisted queue summary still needs one more pass to reflect every adopted workflow item perfectly.

That is a status/accounting refinement issue, not an extractor failure.

## Why This Is Enough To Move Forward

ASP.NET Core is now a credible confirmed proof for backend/domain brownfield import because Topogram can:

- recover real entities and capabilities from a non-curated external repo
- suppress EF Core relationship-link noise by default
- reconcile imported evidence into meaningful bundles
- promote a canonical domain surface into `topogram/`

## Deferred For ASP.NET Core v1

- minimal API-specific extraction beyond controller-first coverage
- Razor Pages / MVC view extraction
- Blazor extraction
- perfect workflow-review status persistence for already-written canonical workflow artifacts
