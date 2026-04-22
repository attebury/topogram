# Brownfield Trial: React Native Clean Architecture

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/react-native-clean-architecture`
- Source: `carlossalasamper/react-native-clean-architecture`

## What This Trial Proved

This trial confirmed that Topogram can recover a credible React Native domain surface from a real Expo/TypeScript app with:

- bounded-context TypeScript domain entities
- repository-backed HTTP access
- React Navigation routes
- React Native presentation screens

For this repo, the proof centers on the `post` context.

## Import Coverage

Current React Native support in Topogram covers:

- `db/react-native-entities`
  - `src/*/domain/entities/*Entity.ts`
  - TypeScript interface fields
- `api/react-native-repository`
  - `src/*/infrastructure/implementations/*Repository.ts`
  - repository methods backed by `httpClient.get/post/patch/delete`
  - endpoint, path param, and basic output-shape inference
- `ui/react-native-screens`
  - `src/*/presentation/screens/*Screen.tsx`
  - React Navigation `RootNavigator.tsx`
  - list/detail screen inference
  - UI capability hints

## Imported Domain Surface

Recovered core bundle:

- `post`

That bundle groups:

- `entity_post`
- `cap_get_post`
- `cap_list_posts`
- `post_detail`
- `post_list`
- `workflow_post`

## Canonical Outputs

Canonical outputs now exist under:

- `/Users/attebury/Documents/topogram/trials/react-native-clean-architecture/topogram/entities`
- `/Users/attebury/Documents/topogram/trials/react-native-clean-architecture/topogram/capabilities`
- `/Users/attebury/Documents/topogram/trials/react-native-clean-architecture/topogram/shapes`
- `/Users/attebury/Documents/topogram/trials/react-native-clean-architecture/topogram/decisions`
- `/Users/attebury/Documents/topogram/trials/react-native-clean-architecture/topogram/docs/workflows`
- `/Users/attebury/Documents/topogram/trials/react-native-clean-architecture/topogram/docs/reports`

Representative promoted files:

- `entity-post.tg`
- `cap-get-post.tg`
- `cap-list-posts.tg`
- `shape-output-get-post.tg`
- `shape-output-list-posts.tg`
- `decision-post.tg`
- `workflow_post.md`
- `ui-post_detail.md`
- `ui-post_list.md`

## Proof Status

Saved status is clean:

- `Next Bundle: None`
- `Blocked items: 0`

So React Native is now in confirmed-proof territory for this bounded-context, backend-connected shape.

## Deferred For React Native v1

- broader navigation extraction outside a single root stack
- mutation/form flows
- state-manager-specific action semantics beyond simple screen/use-case inference
- wider support for multi-context apps beyond a single `post` domain proof
