# Topogram Domain

Generated from `/Users/attebury/topogram-cursor/examples/generated/content-approval/topogram`

## Enums

### `article_status`

Values: `draft`, `submitted`, `needs_revision`, `approved`, `rejected`

### `publication_status`

Values: `active`, `archived`

## Actors

### `actor_author` - Author

User drafting and resubmitting articles

Status: `active`

### `actor_manager` - Manager

User reviewing, approving, rejecting, or requesting revisions on submitted articles

Status: `active`

### `manager` - Manager

A reviewer with approval authority in the Content Approval application

Status: `active`

### `user` - User

A person interacting with the Content Approval application

Status: `active`

## Roles

### `role_author` - Author

May create and update articles that move through the editorial workflow

Status: `active`

### `role_manager` - Manager

May review submitted articles and request editorial decisions

Status: `active`

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
- `revision_requested_at` - `datetime` - optional
- `approved_at` - `datetime` - optional
- `rejected_at` - `datetime` - optional
- `reviewer_notes` - `text` - optional
- `category` - `string` - optional

Relations:
- `reviewer_id` references `entity_user.id`
- `publication_id` references `entity_publication.id`

Invariants:
- `submitted_at` requires `status == submitted`
- `revision_requested_at` requires `status == needs_revision`
- `approved_at` requires `status == approved`
- `rejected_at` requires `status == rejected`
- `reviewer_notes` requires `status == needs_revision`
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

### `shape_input_request_article_revision` - Request Article Revision Input

Input for requesting article revisions during review

Projected fields:
- `article_id` - `uuid` - required
- `revision_requested_at` - `datetime` - optional
- `reviewer_notes` - `text` - required

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
- `revision_requested_at` - `optional`
- `approved_at` - `optional`
- `rejected_at` - `optional`
- `reviewer_notes` - `optional`
- `category` - `optional`

## Capabilities

### `cap_approve_article` - Approve Article

Approves a submitted article

Actors: `actor_manager`
Roles: `role_manager`
Reads: _none_
Creates: _none_
Updates: `entity_article`
Deletes: _none_
Input: `shape_input_approve_article`
Output: `shape_output_article_detail`

### `cap_create_article` - Create Article

Creates a new article draft

Actors: `actor_author`
Roles: `role_author`
Reads: _none_
Creates: `entity_article`
Updates: _none_
Deletes: _none_
Input: `shape_input_create_article`
Output: `shape_output_article_detail`

### `cap_get_article` - Get Article

Fetches a single article

Actors: `actor_author`
Roles: `role_author`
Reads: `entity_article`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_article`
Output: `shape_output_article_detail`

### `cap_list_articles` - List Articles

Lists articles across draft, submitted, approved, and rejected states

Actors: `actor_author`
Roles: `role_author`
Reads: `entity_article`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_list_articles`
Output: `shape_output_article_detail`

### `cap_reject_article` - Reject Article

Rejects a submitted article with reviewer notes

Actors: `actor_manager`
Roles: `role_manager`
Reads: _none_
Creates: _none_
Updates: `entity_article`
Deletes: _none_
Input: `shape_input_reject_article`
Output: `shape_output_article_detail`

### `cap_request_article_revision` - Request Article Revision

Requests revisions for an article under review

Actors: `actor_manager`
Roles: `role_manager`
Reads: _none_
Creates: _none_
Updates: `entity_article`
Deletes: _none_
Input: `shape_input_request_article_revision`
Output: `shape_output_article_detail`

### `cap_update_article` - Update Article

Updates an article draft or submits it for review

Actors: `actor_author`
Roles: `role_author`
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
Actors: _none_
Roles: `role_author`
Requirement: `publication.status != archived`
Severity: `error`

### `rule_only_active_users_may_review_articles` - Only active users may review articles

Assigned reviewers must be active users

Applies to: `cap_create_article`, `cap_update_article`, `cap_approve_article`, `cap_reject_article`
Actors: `actor_manager`
Roles: `role_manager`
Requirement: `reviewer.is_active == true`
Severity: `error`

## Projections

### `proj_api` - API

HTTP API realization for Content Approval

Platform: `dotnet`
Realizes: `cap_create_article`, `cap_get_article`, `cap_update_article`, `cap_request_article_revision`, `cap_approve_article`, `cap_reject_article`, `cap_list_articles`
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
Realizes: `cap_list_articles`, `cap_get_article`, `cap_create_article`, `cap_update_article`, `cap_request_article_revision`, `cap_approve_article`, `cap_reject_article`
Outputs: `ui_contract`

### `proj_ui_web__react` - Content Approval Web UI

Web realization for the shared Content Approval UI using a React profile

Platform: `ui_web`
Realizes: `proj_ui_shared`, `cap_list_articles`, `cap_get_article`, `cap_create_article`, `cap_update_article`, `cap_request_article_revision`, `cap_approve_article`, `cap_reject_article`
Outputs: `ui_contract`, `web_app`

### `proj_ui_web__sveltekit` - Content Approval Web UI (SvelteKit)

Web realization for the shared Content Approval UI using a SvelteKit profile

Platform: `ui_web`
Realizes: `proj_ui_shared`, `cap_list_articles`, `cap_get_article`, `cap_create_article`, `cap_update_article`, `cap_request_article_revision`, `cap_approve_article`, `cap_reject_article`
Outputs: `ui_contract`, `web_app`

## Verification

### `ver_article_review_flow` - Article review flow

Verifies article creation, revision requests, resubmission, approval, and rejection.

Method: `runtime`
Validates: `cap_create_article`, `cap_get_article`, `cap_list_articles`, `cap_update_article`, `cap_request_article_revision`, `cap_approve_article`, `cap_reject_article`
Scenarios: `create_article_in_draft`, `request_revision_for_submitted_article`, `resubmit_article_after_revision_requested`, `reject_approval_without_precondition`, `approve_submitted_article`, `reject_submitted_article`

### `ver_runtime_smoke` - Content approval runtime smoke

Covers the minimum web and API checks for the generated Content Approval stack.

Method: `smoke`
Validates: `cap_create_article`, `cap_get_article`, `cap_list_articles`
Scenarios: `articles_page_responds`, `create_article_smoke`, `get_created_article_smoke`, `list_articles_smoke`

## Companion Docs

### `article_resubmission_after_review` - Article Resubmission After Review

Kind: `journey`
Status: `canonical`

An author resubmits an article after review feedback without losing the editorial context of the requested revision.

Related entities: `entity_article`
Related capabilities: `cap_request_article_revision`, `cap_update_article`, `cap_get_article`

### `import_gap_report` - Content Approval Import Gap Report

Kind: `report`
Status: `inferred`

Example brownfield-style report showing what still requires review after workflow import.

Related entities: `entity_article`
Related capabilities: `cap_request_article_revision`, `cap_update_article`

### `article_review` - Article Review Workflow

Kind: `workflow`
Status: `canonical`

Editorial review flow from draft to submitted, needs_revision, approved, or rejected.

Related entities: `entity_article`
Related capabilities: `cap_create_article`, `cap_approve_article`, `cap_reject_article`, `cap_request_article_revision`, `cap_update_article`
