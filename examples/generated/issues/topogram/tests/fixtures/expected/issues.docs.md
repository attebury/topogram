# Topogram Domain

Generated from `/Users/attebury/topogram-cursor/examples/generated/issues/topogram`

## Enums

### `board_status`

Values: `active`, `archived`

### `issue_status`

Values: `open`, `in_progress`, `closed`, `archived`

## Actors

### `actor_user` - User

Workspace member interacting with the issue tracker

Status: `active`

### `user` - User

A person interacting with the Issues application

Status: `active`

## Entities

### `entity_board` - Board

A tracking board that groups issues

Fields:
- `id` - `uuid` - required
- `name` - `string` - required
- `description` - `text` - optional
- `status` - `board_status` - required - default `active`
- `created_at` - `datetime` - required

Invariants:
- `name` length <= 120

### `entity_issue` - Issue

A tracked work item in the issue tracker domain

Fields:
- `id` - `uuid` - required
- `title` - `string` - required
- `description` - `text` - optional
- `status` - `issue_status` - required - default `open`
- `assignee_id` - `uuid` - optional
- `board_id` - `uuid` - required
- `created_at` - `datetime` - required
- `updated_at` - `datetime` - required
- `closed_at` - `datetime` - optional
- `priority` - `string` - optional

Relations:
- `assignee_id` references `entity_user.id`
- `board_id` references `entity_board.id`

Invariants:
- `closed_at` requires `status == closed`
- if `status == in_progress`, then `assignee_id is required`
- if `status == open`, then `closed_at is null`
- `title` length <= 200

### `entity_user` - User

A person who can be assigned issues

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

### `shape_input_close_issue` - Close Issue Input

Input for closing an issue

Projected fields:
- `issue_id` - `uuid` - required
- `closed_at` - `datetime` - optional

### `shape_input_create_issue` - Create Issue Input

Input for creating an issue

Projected fields:
- `title` - `string` - required
- `description` - `text` - optional
- `assignee_id` - `uuid` - optional
- `board_id` - `uuid` - required
- `priority` - `string` - optional

### `shape_input_get_issue` - Get Issue Input

Input for loading a single issue

Projected fields:
- `issue_id` - `uuid` - required

### `shape_input_list_issues` - List Issues Input

Input for listing issues

Projected fields:
- `board_id` - `uuid` - optional
- `assignee_id` - `uuid` - optional
- `status` - `issue_status` - optional
- `after` - `text` - optional
- `limit` - `integer` - optional - default `25`

### `shape_input_update_issue` - Update Issue Input

Input for updating an issue

Projected fields:
- `issue_id` - `uuid` - required
- `title` - `string` - optional
- `description` - `text` - optional
- `assignee_id` - `uuid` - optional
- `priority` - `string` - optional
- `status` - `issue_status` - optional

### `shape_output_issue_card` - Issue Card Output

Compact issue payload for cards and lists

Derived from: `entity_issue`

Transforms:
- rename `assignee_id` -> `assigneeId`
- override `title`: optional
- override `status`: default `open`
- override `assigneeId`: required

Projected fields:
- `title` - `string` - optional
- `status` - `issue_status` - required - default `open`
- `priority` - `string` - optional
- `assigneeId` - `uuid` - required - from `assignee_id`

### `shape_output_issue_detail` - Issue Detail Output

Detailed issue payload

Derived from: `entity_issue`

Projected fields:
- `id` - `uuid` - required
- `title` - `string` - required
- `description` - `text` - optional
- `status` - `issue_status` - required - default `open`
- `assignee_id` - `uuid` - optional
- `board_id` - `uuid` - required
- `created_at` - `datetime` - required
- `updated_at` - `datetime` - required
- `closed_at` - `datetime` - optional
- `priority` - `string` - optional

## Capabilities

### `cap_close_issue` - Close Issue

Marks an issue as closed

Actors: `actor_user`
Roles: _none_
Reads: `entity_issue`
Creates: _none_
Updates: `entity_issue`
Deletes: _none_
Input: `shape_input_close_issue`
Output: `shape_output_issue_detail`

### `cap_create_issue` - Create Issue

Allows a user to create a new issue

Actors: `actor_user`
Roles: _none_
Reads: `entity_board`, `entity_user`
Creates: `entity_issue`
Updates: _none_
Deletes: _none_
Input: `shape_input_create_issue`
Output: `shape_output_issue_detail`

### `cap_get_issue` - Get Issue

Loads a single issue

Actors: `actor_user`
Roles: _none_
Reads: `entity_issue`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_get_issue`
Output: `shape_output_issue_detail`

### `cap_list_issues` - List Issues

Lists issues with optional filters

Actors: `actor_user`
Roles: _none_
Reads: `entity_issue`
Creates: _none_
Updates: _none_
Deletes: _none_
Input: `shape_input_list_issues`
Output: `shape_output_issue_detail`

### `cap_update_issue` - Update Issue

Updates mutable issue fields

Actors: `actor_user`
Roles: _none_
Reads: `entity_issue`, `entity_user`
Creates: _none_
Updates: `entity_issue`
Deletes: _none_
Input: `shape_input_update_issue`
Output: `shape_output_issue_detail`

## Rules

### `rule_no_issue_creation_in_archived_board` - Cannot create issues in archived boards

New issues may not be created in archived boards

Applies to: `cap_create_issue`
Actors: _none_
Roles: _none_
Requirement: `board.status != archived`
Severity: `error`

### `rule_only_active_users_may_be_assigned_issues` - Only active users may be assigned issues

An issue assignee must be an active user

Applies to: `cap_create_issue`, `cap_update_issue`
Actors: _none_
Roles: _none_
Requirement: `assignee.is_active == true`
Severity: `error`

## Projections

### `proj_api` - API

HTTP API realization for Issues

Platform: `dotnet`
Realizes: `cap_create_issue`, `cap_get_issue`, `cap_update_issue`, `cap_close_issue`, `cap_list_issues`
Outputs: `database_schema`, `entity_models`, `request_contracts`, `response_contracts`, `validation_handlers`, `endpoints`

### `proj_db_postgres` - Issues Postgres DB

Postgres persistence realization for the Issues domain

Platform: `db_postgres`
Realizes: `entity_issue`, `entity_board`, `entity_user`
Outputs: `db_contract`, `sql_schema`

### `proj_db_sqlite` - Issues SQLite DB

SQLite persistence realization for the Issues domain

Platform: `db_sqlite`
Realizes: `entity_issue`, `entity_board`, `entity_user`
Outputs: `db_contract`, `sql_schema`

### `proj_ui_native__ios` - Issues Native iOS UI

Native SwiftUI realization sharing routes and UI hints with the web stacks

Platform: `ui_ios`
Realizes: `proj_ui_shared`, `cap_list_issues`, `cap_get_issue`, `cap_create_issue`, `cap_update_issue`, `cap_close_issue`
Outputs: `ui_contract`, `web_app`

### `proj_ui_shared` - Issues Shared UI

Platform-neutral UI semantics for the Issues product

Platform: `ui_shared`
Realizes: `cap_list_issues`, `cap_get_issue`, `cap_create_issue`, `cap_update_issue`, `cap_close_issue`
Outputs: `ui_contract`

### `proj_ui_web__react` - Issues Web UI

Web realization for the shared Issues UI using a React profile

Platform: `ui_web`
Realizes: `proj_ui_shared`, `cap_list_issues`, `cap_get_issue`, `cap_create_issue`, `cap_update_issue`, `cap_close_issue`
Outputs: `ui_contract`, `web_app`

### `proj_ui_web__sveltekit` - Issues Web UI (SvelteKit)

Web realization for the shared Issues UI using a SvelteKit profile

Platform: `ui_web`
Realizes: `proj_ui_shared`, `cap_list_issues`, `cap_get_issue`, `cap_create_issue`, `cap_update_issue`, `cap_close_issue`
Outputs: `ui_contract`, `web_app`

## Companion Docs

### `issue_creation_and_assignment` - Issue Creation And Assignment

Kind: `journey`
Status: `canonical`

A user creates an issue on an active board, assigns it to an active teammate when appropriate, and can immediately find it again in the standard issue views.

Related entities: `entity_issue`, `entity_board`, `entity_user`
Related capabilities: `cap_create_issue`, `cap_get_issue`, `cap_list_issues`

### `issue_resolution_and_closure` - Issue Resolution And Closure

Kind: `journey`
Status: `canonical`

An assigned user reviews an issue in detail, updates it as work progresses, and closes it without losing ownership or lifecycle clarity.

Related entities: `entity_issue`, `entity_user`
Related capabilities: `cap_get_issue`, `cap_update_issue`, `cap_close_issue`
