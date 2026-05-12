import { pgTable, text } from "drizzle-orm/pg-core";

export const ghostTasks = pgTable("ghost_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull()
});
