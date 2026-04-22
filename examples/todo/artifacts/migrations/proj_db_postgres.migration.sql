create table projects (
  created_at timestamptz not null,
  description text,
  id uuid not null,
  name text not null,
  status text not null default 'active',
  primary key (id),
  unique (name)
);

create unique index projects_name_unique on projects (name);

create unique index projects_name_unique on projects (name);

create table tasks (
  completed_at timestamptz,
  created_at timestamptz not null,
  description text,
  due_at timestamptz,
  id uuid not null,
  owner_id uuid,
  project_id uuid not null,
  status text not null default 'draft',
  title text not null,
  updated_at timestamptz not null,
  primary key (id),
  foreign key (owner_id) references users(id) on delete set null,
  foreign key (project_id) references projects(id) on delete cascade
);

create index tasks_owner_id_status_index on tasks (owner_id, status);

create index tasks_project_id_status_index on tasks (project_id, status);

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

create unique index users_email_unique on users (email);

create unique index users_email_unique on users (email);
