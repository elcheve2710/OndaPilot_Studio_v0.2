import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// One isolated editorial state per authenticated ChatGPT user.
export const radioStates = sqliteTable("radio_states", {
  userId: text("user_id").primaryKey(),
  dataJson: text("data_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});
