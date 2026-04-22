# Topogram Domain

Generated from `/Users/attebury/Documents/topogram/examples/content-approval/topogram`

## Enums

### `article_status`

Values: `draft`, `submitted`, `approved`, `rejected`

### `publication_status`

Values: `active`, `archived`

## Entities

### `entity_article` - Article

A draftable and reviewable article in the content approval workflow

Fields:
- `id` - `uuid` - required
- `title` - `string` - required
- `description` - `text` - optional
- `status` - `article_status` - required - default `draft`
- `reviewer_id` - `uuid` - optional
- `publication_id` - `uuid` - required
- `created_at` - `datetime` - required
- `updated_at` - `datetime` - required
- `submitted_at` - `datetime` - optional
- `approved_at` - `datetime` - optional
- `rejected_at` - `datetime` - optional
- `reviewer_notes` - `text` - optional
- `category` - `string` - optional

Relations:
- `reviewer_id` references `entity_user.id`
- `publication_id` references `entity_publication.id`

Invariants:
- `submitted_at` requires `status == submitted`
- `approved_at` requires `status == approved`
- `rejected_at` requires `status == rejected`
- `reviewer_notes` requires `status == approved`
- if `status == submitted`, then `reviewer_id is required`
- `title` length <= 200

### `entity_publication` - Publication

A publishing space that owns articles and review workflow

Fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `publication_status` - required - default `active`
- `created_at` - `datetime` - required

### `entity_user` - User

A collaborator who can draft, review, approve, or reject articles

Fields:
- `id` - `uuid` - required
- `email` - `string` - required
- `display_name` - `text` - required
- `is_active` - `boolean` - required - default `true`
- `created_at` - `datetime` - required

## Shapes

### `shape_input_approve_article` - Approve Article Input

Input for approving an article under review

Projected fields:
- `article_id` - `uuid` - required
- `approved_at` - `datetime` - optional
- `reviewer_notes` - `text` - optional

### `shape_input_create_article` - Create Article Input

Input for creating an article draft

Projected fields:
- `title` - `text` - required
- `description` - `text` - optional
- `reviewer_id` - `uuid` - optional
- `publication_id` - `uuid` - required
- `category` - `text` - optional

### `shape_input_get_article` - Get Article Input

Input for fetching a single article

Projected fields:
- `article_id` - `uuid` - required

### `shape_input_list_articles` - List Articles Input

Input for listing articles by workflow status, reviewer, or publication

Projected fields:
- `publication_id` - `uuid` - optional
- `reviewer_id` - `uuid` - optional
- `status` - `article_status` - optional
- `after` - `datetime` - optional
- `limit` - `integer` - optional

### `shape_input_reject_article` - Reject Article Input

Input for rejecting an article under review

Projected fields:
- `article_id` - `uuid` - required
- `rejected_at` - `datetime` - optional
- `reviewer_notes` - `text` - optional

### `shape_input_update_article` - Update Article Input

Input for editing an article draft or submitting it for review

Projected fields:
- `article_id` - `uuid` - required
- `title` - `text` - optional
- `description` - `text` - optional
- `reviewer_id` - `uuid` - optional
- `category` - `text` - optional
- `status` - `article_status` - optional

### `shape_output_article_card` - Article Card

Compact card view for article listings

Derived from: `entity_article`

Projected fields:
- `id` - `required`
- `title` - `required`
- `status` - `required`
- `reviewer_id` - `optional`
- `publication_id` - `required`
- `updated_at` - `required`
- `category` - `optional`

### `shape_output_article_detail` - Article Detail

Detailed article view including review decisions

Derived from: `entity_article`

Projected fields:
- `id` - `required`
- `title` - `required`
- `description` - `optional`
- `status` - `required`
- `reviewer_id` - `optional`
- `publication_id` - `required`
- `created_at` - `required`
- `updated_at` - `required`
- `submitted_at` - `optional`
- `approved_at` - `optional`
- `rejected_at` - `optional`
- `reviewer_notes` - `optional`
- `category` - `optional`

## Capabilities

### `cap_approve_article` - Approve Article

Approves a submitted article

Actors: `manager`
Reads: _none_
Creates: _none_
Updates: `entity_article`
Deletes: _none_
Input: `shape_input_approve_article`
Output: `shape_output_article_detail`

### `cap_create_article` - Create Article

Creates a new article draft

Actors: `user`
Reads: _none_
Creates: `entity_article`
Updates: _none_
Deletes: _none_
Input: `shape_input_create_article`
Output: `shape_output_article_detail`

### `cap_get_article` - Get Article

Fetches a single article

Actors: `user`
Reads: `entity_article`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_article`
Output: `shape_output_article_detail`

### `cap_list_articles` - List Articles

Lists articles across draft, submitted, approved, and rejected states

Actors: `user`
Reads: `entity_article`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_list_articles`
Output: `shape_output_article_detail`

### `cap_reject_article` - Reject Article

Rejects a submitted article with reviewer notes

Actors: `manager`
Reads: _none_
Creates: _none_
Updates: `entity_article`
Deletes: _none_
Input: `shape_input_reject_article`
Output: `shape_output_article_detail`

### `cap_update_article` - Update Article

Updates an article draft or submits it for review

Actors: `user`
Reads: _none_
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

### `rule_only_active_users_may_review_articles` - Only active users may review articles

Assigned reviewers must be active users

Applies to: `cap_create_article`, `cap_update_article`, `cap_approve_article`, `cap_reject_article`
Requirement: `reviewer.is_active == true`
Severity: `error`

## Projections

### `proj_api` - API

HTTP API realization for Content Approval

Platform: `dotnet`
Realizes: `cap_create_article`, `cap_get_article`, `cap_update_article`, `cap_approve_article`, `cap_reject_article`, `cap_list_articles`
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
Realizes: `cap_list_articles`, `cap_get_article`, `cap_create_article`, `cap_update_article`, `cap_approve_article`, `cap_reject_article`
Outputs: `ui_contract`

### `proj_ui_web` - Content Approval Web UI

Web realization for the shared Content Approval UI using a React profile

Platform: `ui_web`
Realizes: `proj_ui_shared`, `cap_list_articles`, `cap_get_article`, `cap_create_article`, `cap_update_article`, `cap_approve_article`, `cap_reject_article`
Outputs: `ui_contract`, `web_app`
