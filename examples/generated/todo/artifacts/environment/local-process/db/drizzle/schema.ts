import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const projectsTable = pgTable("projects", {
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  description: text("description"),
  id: uuid("id").notNull().primaryKey(),
  name: text("name").notNull(),
  owner_id: uuid("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
}, (table) => ({
  projects_owner_id_status_index: index("projects_owner_id_status_index").on(table.owner_id, table.status),
  projects_name_unique: uniqueIndex("projects_name_unique").on(table.name),
}));

export const tasksTable = pgTable("tasks", {
  completed_at: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  description: text("description"),
  due_at: timestamp("due_at", { withTimezone: true, mode: "string" }),
  id: uuid("id").notNull().primaryKey(),
  owner_id: uuid("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  priority: text("priority").notNull().default("medium"),
  project_id: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("draft"),
  title: text("title").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => ({
  tasks_owner_id_status_index: index("tasks_owner_id_status_index").on(table.owner_id, table.status),
  tasks_project_id_status_index: index("tasks_project_id_status_index").on(table.project_id, table.status),
}));

export const usersTable = pgTable("users", {
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  display_name: text("display_name").notNull(),
  email: text("email").notNull(),
  id: uuid("id").notNull().primaryKey(),
  is_active: boolean("is_active").notNull().default(true),
}, (table) => ({
  users_email_unique: uniqueIndex("users_email_unique").on(table.email),
}));
