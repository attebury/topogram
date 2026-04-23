DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('draft', 'active', 'completed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

alter table tasks add column due_at timestamptz;

create index tasks_owner_id_status_index on tasks (owner_id, status);
