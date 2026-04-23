DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('draft', 'active', 'completed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

create table projects (
  created_at timestamptz not null,
  description text,
  id uuid not null,
  name text not null,
  owner_id uuid,
  status "ProjectStatus" not null default 'active',
  primary key (id),
  unique (name)
);

create index projects_owner_id_status_index on projects (owner_id, status);

create table tasks (
  completed_at timestamptz,
  created_at timestamptz not null,
  description text,
  due_at timestamptz,
  id uuid not null,
  owner_id uuid,
  priority "TaskPriority" not null default 'medium',
  project_id uuid not null,
  status "TaskStatus" not null default 'draft',
  title text not null,
  updated_at timestamptz not null,
  primary key (id)
);

create index tasks_owner_id_status_index on tasks (owner_id, status);

create index tasks_project_id_status_index on tasks (project_id, status);

create table users (
  created_at timestamptz not null,
  display_name text not null,
  email text not null,
  id uuid not null,
  is_active boolean not null default TRUE,
  primary key (id),
  unique (email)
);

alter table projects add foreign key (owner_id) references users(id) on delete set null;

alter table tasks add foreign key (owner_id) references users(id) on delete set null;

alter table tasks add foreign key (project_id) references projects(id) on delete cascade;
