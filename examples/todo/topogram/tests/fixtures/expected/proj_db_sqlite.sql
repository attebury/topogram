pragma foreign_keys = on;

create table projects (
  created_at text not null,
  description text,
  id text not null,
  name text not null,
  owner_id text,
  status text not null default 'active',
  primary key (id),
  unique (name),
  foreign key (owner_id) references users(id) on delete set null
);

create index projects_owner_id_status_index on projects (owner_id, status);

create table tasks (
  completed_at text,
  created_at text not null,
  description text,
  due_at text,
  id text not null,
  owner_id text,
  priority text not null default 'medium',
  project_id text not null,
  status text not null default 'draft',
  title text not null,
  updated_at text not null,
  primary key (id),
  foreign key (owner_id) references users(id) on delete set null,
  foreign key (project_id) references projects(id) on delete cascade
);

create index tasks_owner_id_status_index on tasks (owner_id, status);
create index tasks_project_id_status_index on tasks (project_id, status);

create table users (
  created_at text not null,
  display_name text not null,
  email text not null,
  id text not null,
  is_active integer not null default 1,
  primary key (id),
  unique (email)
);
