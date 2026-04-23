# Topogram Domain

Generated from `/Users/attebury/Documents/topogram/examples/articles/topogram`

## Enums

### `publication_status`

Values: `active`, `archived`

### `article_status`

Values: `open`, `in_progress`, `closed`, `archived`

## Entities

### `entity_publication` - Publication

A tracking publication that groups articles

Fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `publication_status` - required - default `active`
- `created_at` - `datetime` - required

Invariants:
- `name` length <= 120

### `entity_article` - Article

A tracked work item in the article tracker domain

Fields:
- `id` - `uuid` - required
- `title` - `string` - required
- `description` - `text` - optional
- `status` - `article_status` - required - default `open`
- `reviewer_id` - `uuid` - optional
- `publication_id` - `uuid` - required
- `created_at` - `datetime` - required
- `updated_at` - `datetime` - required
- `closed_at` - `datetime` - optional
- `category` - `string` - optional

Relations:
- `reviewer_id` references `entity_user.id`
- `publication_id` references `entity_publication.id`

Invariants:
- `closed_at` requires `status == closed`
- if `status == in_progress`, then `reviewer_id is required`
- if `status == open`, then `closed_at is null`
- `title` length <= 200

### `entity_user` - User

A person who can be assigned articles

Fields:
- `id` - `uuid` - required
- `email` - `string` - required
- `display_name` - `string` - required
- `is_active` - `boolean` - required - default `true`
- `created_at` - `datetime` - required

Invariants:
- `email` format == `email`
- `display_name` length <= 120

## Shapes

### `shape_input_close_article` - Close Article Input

Input for closing an article

Projected fields:
- `article_id` - `uuid` - required
- `closed_at` - `datetime` - optional

### `shape_input_create_article` - Create Article Input

Input for creating an article

Projected fields:
- `title` - `string` - required
- `description` - `text` - optional
- `reviewer_id` - `uuid` - optional
- `publication_id` - `uuid` - required
- `category` - `string` - optional

### `shape_input_get_article` - Get Article Input

Input for loading a single article

Projected fields:
- `article_id` - `uuid` - required

### `shape_input_list_articles` - List Content Approval Input

Input for listing articles

Projected fields:
- `publication_id` - `uuid` - optional
- `reviewer_id` - `uuid` - optional
- `status` - `article_status` - optional
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

### `shape_input_update_article` - Update Article Input

Input for updating an article

Projected fields:
- `article_id` - `uuid` - required
- `title` - `string` - optional
- `description` - `text` - optional
- `reviewer_id` - `uuid` - optional
- `category` - `string` - optional
- `status` - `article_status` - optional

### `shape_output_article_card` - Article Card Output

Compact article payload for cards and lists

Derived from: `entity_article`

Transforms:
- rename `reviewer_id` -> `reviewerId`
- override `title`: optional
- override `status`: default `open`
- override `reviewerId`: required

Projected fields:
- `title` - `string` - optional
- `status` - `article_status` - required - default `open`
- `category` - `string` - optional
- `reviewerId` - `uuid` - required - from `reviewer_id`

### `shape_output_article_detail` - Article Detail Output

Detailed article payload

Derived from: `entity_article`

Projected fields:
- `id` - `uuid` - required
- `title` - `string` - required
- `description` - `text` - optional
- `status` - `article_status` - required - default `open`
- `reviewer_id` - `uuid` - optional
- `publication_id` - `uuid` - required
- `created_at` - `datetime` - required
- `updated_at` - `datetime` - required
- `closed_at` - `datetime` - optional
- `category` - `string` - optional

## Capabilities

### `cap_close_article` - Close Article

Marks an article as closed

Actors: `user`
Reads: `entity_article`
Creates: _none_
Updates: `entity_article`
Deletes: _none_
Input: `shape_input_close_article`
Output: `shape_output_article_detail`

### `cap_create_article` - Create Article

Allows a user to create a new article

Actors: `user`
Reads: `entity_publication`, `entity_user`
Creates: `entity_article`
Updates: _none_
Deletes: _none_
Input: `shape_input_create_article`
Output: `shape_output_article_detail`

### `cap_get_article` - Get Article

Loads a single article

Actors: `user`
Reads: `entity_article`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_article`
Output: `shape_output_article_detail`

### `cap_list_articles` - List Content Approval

Lists articles with optional filters

Actors: `user`
Reads: `entity_article`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_list_articles`
Output: `shape_output_article_detail`

### `cap_update_article` - Update Article

Updates mutable article fields

Actors: `user`
Reads: `entity_article`, `entity_user`
Creates: _none_
Updates: `entity_article`
Deletes: _none_
Input: `shape_input_update_article`
Output: `shape_output_article_detail`

## Rules

### `rule_no_article_creation_in_archived_publication` - Cannot create articles in archived publications

New articles may not be created in archived publications

Applies to: `cap_create_article`
Requirement: `publication.status != archived`
Severity: `error`

### `rule_only_active_users_may_be_assigned_articles` - Only active users may be assigned articles

An article reviewer must be an active user

Applies to: `cap_create_article`, `cap_update_article`
Requirement: `reviewer.is_active == true`
Severity: `error`

## Projections

### `proj_api` - API

HTTP API realization for Content Approval

Platform: `dotnet`
Realizes: `cap_create_article`, `cap_get_article`, `cap_update_article`, `cap_close_article`, `cap_list_articles`
Outputs: `database_schema`, `entity_models`, `request_contracts`, `response_contracts`, `validation_handlers`, `endpoints`

### `proj_db_postgres` - Content Approval Postgres DB

Postgres persistence realization for the Content Approval domain

Platform: `db_postgres`
Realizes: `entity_article`, `entity_publication`, `entity_user`
Outputs: `db_contract`, `sql_schema`

### `proj_db_sqlite` - Content Approval SQLite DB

SQLite persistence realization for the Content Approval domain

Platform: `db_sqlite`
Realizes: `entity_article`, `entity_publication`, `entity_user`
Outputs: `db_contract`, `sql_schema`

### `proj_ui_shared` - Content Approval Shared UI

Platform-neutral UI semantics for the Content Approval product

Platform: `ui_shared`
Realizes: `cap_list_articles`, `cap_get_article`, `cap_create_article`, `cap_update_article`, `cap_close_article`
Outputs: `ui_contract`

### `proj_ui_web_sveltekit` - Content Approval Web UI (SvelteKit)

Web realization for the shared Content Approval UI using a SvelteKit profile

Platform: `ui_web`
Realizes: `proj_ui_shared`, `cap_list_articles`, `cap_get_article`, `cap_create_article`, `cap_update_article`, `cap_close_article`
Outputs: `ui_contract`, `web_app`

### `proj_ui_web` - Content Approval Web UI

Web realization for the shared Content Approval UI using a React profile

Platform: `ui_web`
Realizes: `proj_ui_shared`, `cap_list_articles`, `cap_get_article`, `cap_create_article`, `cap_update_article`, `cap_close_article`
Outputs: `ui_contract`, `web_app`
