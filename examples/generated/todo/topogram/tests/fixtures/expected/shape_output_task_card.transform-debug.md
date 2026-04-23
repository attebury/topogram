# Shape Transform Debug

Generated from `/Users/attebury/Documents/topogram/examples/generated/todo/topogram`

## `shape_output_task_card` - Task Card Output

Compact task payload for cards and lists

Selection mode: `derived_from_entity`
Source: `entity_task`
Include: `title`, `status`, `priority`, `due_at`, `owner_id`
Exclude: _none_

Selected fields:
- `title` - `string` - required
- `status` - `task_status` - required - default `draft`
- `priority` - `task_priority` - required - default `medium`
- `due_at` - `datetime` - optional
- `owner_id` - `uuid` - optional

Transforms:
- rename `due_at` -> `dueAt`
- rename `owner_id` -> `ownerId`
- override `title`: optional
- override `status`: default `active`
- override `priority`: default `medium`
- override `ownerId`: required

Result fields:
- `title` - `string` - optional
- `status` - `task_status` - required - default `active`
- `priority` - `task_priority` - required - default `medium`
- `dueAt` - `datetime` - optional - from `due_at`
- `ownerId` - `uuid` - required - from `owner_id`
