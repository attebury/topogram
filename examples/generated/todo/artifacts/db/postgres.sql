create table tasks (
  id uuid not null,
  title text not null,
  description text,
  status text not null default 'draft',
  owner_id uuid,
  project_id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  due_at timestamptz,
  primary key (id),
  foreign key (owner_id) references users(id) on delete set null,
  foreign key (project_id) references projects(id) on delete cascade
);

create index tasks_project_id_status_index on tasks (project_id, status);
create index tasks_owner_id_status_index on tasks (owner_id, status);

create table projects (
  id uuid not null,
  name text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null,
  primary key (id),
  unique (name)
);


create table users (
  id uuid not null,
  email text not null,
  display_name text not null,
  is_active boolean not null default TRUE,
  created_at timestamptz not null,
  primary key (id),
  unique (email)
);
