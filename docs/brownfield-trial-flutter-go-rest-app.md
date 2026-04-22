# Brownfield Trial: Flutter Go Rest App

## Repo

- Trial repo: `/Users/attebury/Documents/topogram/trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)`
- Source: `SinaSys/flutter_go_rest_app`

## What This Trial Proved

This trial confirmed that Topogram can recover a credible Flutter domain surface from a real feature-structured app using:

- Dart domain entities
- Dio-based remote data sources
- Flutter Material screen files
- feature-level workflows across user, post, todo, and comment

## Import Coverage

Current Flutter support in Topogram covers:

- `db/flutter-entities`
  - `lib/features/*/domain/entities/*_entity.dart`
  - immutable entity fields
  - enum extraction from entity files
- `api/flutter-dio`
  - `lib/features/*/data/datasources/*_remote_data_source.dart`
  - Dio CRUD calls
  - `ApiConfig` path discovery
  - query/path/input/output hints
- `ui/flutter-screens`
  - `lib/features/*/presentation/screens/*_screen.dart`
  - list/detail/create-style screen inference
  - screen-to-entity clustering
  - primary capability hints from UI flows

## Imported Domain Surface

Recovered core bundles:

- `user`
- `post`
- `todo`
- `comment`

Supporting enum bundles:

- `enum-user-gender`
- `enum-user-user-status`
- `enum-todo-todo-status`

The strongest canonical proof is the `post` bundle, which groups:

- `entity_post`
- `cap_list_posts`
- `cap_create_post`
- `cap_update_post`
- `cap_delete_post`
- `post_list`
- `post_detail`
- `create_post`
- `workflow_post`

## Canonical Outputs

Canonical outputs now exist under:

- `/Users/attebury/Documents/topogram/trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)/topogram/entities`
- `/Users/attebury/Documents/topogram/trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)/topogram/capabilities`
- `/Users/attebury/Documents/topogram/trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)/topogram/shapes`
- `/Users/attebury/Documents/topogram/trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)/topogram/decisions`
- `/Users/attebury/Documents/topogram/trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)/topogram/docs/workflows`
- `/Users/attebury/Documents/topogram/trials/flutter_go_rest_app/#10 - Clean Architecture Version (RxDart + Provider)/topogram/docs/reports`

Representative promoted files include:

- `entity-post.tg`
- `entity-todo.tg`
- `entity-user.tg`
- `entity-comment.tg`
- `cap-list-posts.tg`
- `cap-create-post.tg`
- `cap-update-post.tg`
- `cap-delete-post.tg`
- `cap-list-todos.tg`
- `cap-list-users.tg`
- `cap-list-comments.tg`
- `decision-post.tg`
- `decision-todo.tg`
- `decision-user.tg`
- `decision-comment.tg`
- `workflow_post.md`
- `workflow_todo.md`
- `workflow_user.md`
- `workflow_comment.md`
- `ui-post_list.md`
- `ui-post_detail.md`
- `ui-create_post.md`
- `ui-todo_list.md`
- `ui-user_list.md`

## Proof Status

Saved status is clean now:

- `Next Bundle: None`
- `Blocked items: 0`

The earlier plan-path mismatch for legacy entity and enum adoption entries is fixed, so the saved queue now matches the real canonical proof surface on disk.

## Why This Is Enough To Move Forward

Flutter is now a credible confirmed proof because Topogram can:

- recover core feature entities from Dart domain classes
- recover CRUD capabilities from Dio remote data sources
- recover main Flutter screens from feature presentation files
- reconcile those signals into meaningful `user`, `post`, `todo`, and `comment` bundles
- promote a real canonical surface into `topogram/`
- finish with a clean saved adoption queue

## Deferred For Flutter v1

- route extraction from `Navigator`/router setup rather than inferring from screen files
- deeper bloc/provider event semantics
- richer form/input extraction from widget trees
- broader support beyond this feature-structured architecture style
