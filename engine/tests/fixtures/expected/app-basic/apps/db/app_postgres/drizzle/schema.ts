import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const collectionsTable = pgTable("collections", {
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  description: text("description"),
  id: uuid("id").notNull().primaryKey(),
  name: text("name").notNull(),
  owner_id: uuid("owner_id").references(() => membersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
}, (table) => ({
  collections_owner_id_status_index: index("collections_owner_id_status_index").on(table.owner_id, table.status),
  collections_name_unique: uniqueIndex("collections_name_unique").on(table.name),
}));

export const itemsTable = pgTable("items", {
  collection_id: uuid("collection_id").notNull().references(() => collectionsTable.id, { onDelete: "cascade" }),
  completed_at: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  description: text("description"),
  due_at: timestamp("due_at", { withTimezone: true, mode: "string" }),
  id: uuid("id").notNull().primaryKey(),
  owner_id: uuid("owner_id").references(() => membersTable.id, { onDelete: "set null" }),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("draft"),
  title: text("title").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => ({
  items_collection_id_status_index: index("items_collection_id_status_index").on(table.collection_id, table.status),
  items_owner_id_status_index: index("items_owner_id_status_index").on(table.owner_id, table.status),
}));

export const membersTable = pgTable("members", {
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  display_name: text("display_name").notNull(),
  email: text("email").notNull(),
  id: uuid("id").notNull().primaryKey(),
  is_active: boolean("is_active").notNull().default(true),
}, (table) => ({
  members_email_unique: uniqueIndex("members_email_unique").on(table.email),
}));
