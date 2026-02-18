import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const videoStatus = sqliteTable("video_status", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code").notNull().unique(),
  currentStatus: text("current_status").notNull().default("SCRIPTED"),
  statusUpdatedAt: text("status_updated_at").default(
    sql`(datetime('now'))`,
  ),
  notes: text("notes"),
  productionPlanPath: text("production_plan_path"),
  voiceoverRecordedAt: text("voiceover_recorded_at"),
  generatedAt: text("generated_at"),
  assembledAt: text("assembled_at"),
  publishedAt: text("published_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const statusHistory = sqliteTable("status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedAt: text("changed_at").default(sql`(datetime('now'))`),
  notes: text("notes"),
});

export const calendarEntries = sqliteTable("calendar_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  platform: text("platform").notNull(),
  videoCode: text("video_code"),
  slotLabel: text("slot_label"),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const productionSessions = sqliteTable("production_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionType: text("session_type").notNull(),
  audienceCategory: text("audience_category"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  durationMinutes: integer("duration_minutes"),
  videoCodes: text("video_codes"),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const sessionItems = sqliteTable("session_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => productionSessions.id, { onDelete: "cascade" }),
  videoCode: text("video_code").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false),
  completedAt: text("completed_at"),
  orderIndex: integer("order_index").notNull(),
});

export const performanceMetrics = sqliteTable("performance_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code").notNull(),
  platform: text("platform").notNull(),
  recordedAt: text("recorded_at").notNull(),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  saves: integer("saves").default(0),
  shares: integer("shares").default(0),
  comments: integer("comments").default(0),
  watchTimeSeconds: integer("watch_time_seconds"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
