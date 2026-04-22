pragma foreign_keys = on;

create table tasks (
  id text not null,
  title text not null,
  description text,
  status text not null default 'draft',
  owner_id text,
  project_id text not null,
  created_at text not null,
  updated_at text not null,
  completed_at text,
  due_at text,
  primary key (id),
  foreign key (owner_id) references users(id) on delete set null,
  foreign key (project_id) references projects(id) on delete cascade
);

create index tasks_project_id_status_index on tasks (project_id, status);
create index tasks_owner_id_status_index on tasks (owner_id, status);

create table projects (
  id text not null,
  name text not null,
  description text,
  status text not null default 'active',
  created_at text not null,
  primary key (id),
  unique (name)
);


create table users (
  id text not null,
  email text not null,
  display_name text not null,
  is_active integer not null default 1,
  created_at text not null,
  primary key (id),
  unique (email)
);
