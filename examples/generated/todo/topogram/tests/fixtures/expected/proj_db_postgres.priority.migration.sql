DO $$ BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

alter table projects add column owner_id uuid;

create index projects_owner_id_status_index on projects (owner_id, status);

alter table projects add foreign key (owner_id) references users(id) on delete set null;

alter table tasks add column priority "TaskPriority" not null default 'medium';
