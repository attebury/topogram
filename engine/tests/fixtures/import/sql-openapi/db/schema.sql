CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  priority task_priority NOT NULL,
  owner_id TEXT REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_tasks_owner_priority ON tasks (owner_id, priority);
