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

export const savedCaptions = sqliteTable("saved_captions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code").notNull(),
  platform: text("platform").notNull(),
  caption: text("caption").notNull(),
  variant: integer("variant").default(1),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const hashtagGroups = sqliteTable("hashtag_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  hashtags: text("hashtags").notNull(), // JSON array of strings
  category: text("category"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const captionTemplates = sqliteTable("caption_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  platform: text("platform"),
  template: text("template").notNull(),
  format: text("format"),
  usageCount: integer("usage_count").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const channelSnapshots = sqliteTable("channel_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  handle: text("handle").notNull(),
  platform: text("platform").notNull(),
  followers: integer("followers"),
  avgViews: integer("avg_views"),
  engagementRateBps: integer("engagement_rate_bps"),
  saveRateBps: integer("save_rate_bps"),
  postsPerWeek: integer("posts_per_week"),
  recordedAt: text("recorded_at").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const vaultHooks = sqliteTable("vault_hooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pattern: text("pattern").notNull(),
  example: text("example"),
  category: text("category").notNull().default("custom"),
  sourceCreator: text("source_creator"),
  sourceUrl: text("source_url"),
  bestFormat: text("best_format"),
  platform: text("platform"),
  optimizes: text("optimizes"),
  variables: text("variables"),
  usageCount: integer("usage_count").default(0),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const vaultStyles = sqliteTable("vault_styles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  sourceCreator: text("source_creator"),
  sourceUrl: text("source_url"),
  sourceTranscript: text("source_transcript"),
  styleRules: text("style_rules").notNull(),
  exampleScript: text("example_script"),
  usageCount: integer("usage_count").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const creatorVideos = sqliteTable("creator_videos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creatorHandle: text("creator_handle").notNull(),
  platform: text("platform").notNull(),
  videoUrl: text("video_url"),
  videoTitle: text("video_title"),
  thumbnailUrl: text("thumbnail_url"),
  publishedAt: text("published_at"),
  durationSeconds: integer("duration_seconds"),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  saves: integer("saves").default(0),
  outlierScoreX100: integer("outlier_score_x100"),
  recordedAt: text("recorded_at").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const videoBreakdowns = sqliteTable("video_breakdowns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creatorVideoId: integer("creator_video_id"),
  creatorHandle: text("creator_handle"),
  videoUrl: text("video_url"),
  topic: text("topic"),
  angle: text("angle"),
  hookFormat: text("hook_format"),
  storyStyle: text("story_style"),
  visualFormat: text("visual_format"),
  visuals: text("visuals"),
  audio: text("audio"),
  rawNotes: text("raw_notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const scriptVersions = sqliteTable("script_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code"),
  ideaTopic: text("idea_topic"),
  version: integer("version").notNull().default(1),
  script: text("script").notNull(),
  hookId: integer("hook_id"),
  styleId: integer("style_id"),
  changeNote: text("change_note"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const thumbnailConcepts = sqliteTable("thumbnail_concepts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code").notNull(),
  textOverlay: text("text_overlay").notNull(),
  expression: text("expression"),
  background: text("background"),
  colorScheme: text("color_scheme"),
  style: text("style"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  targetView: text("target_view"),
  targetId: text("target_id"),
  read: integer("read", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const contentWaterfall = sqliteTable("content_waterfall", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceVideoCode: text("source_video_code").notNull(),
  derivedVideoCode: text("derived_video_code"),
  tier: text("tier").notNull(),
  platform: text("platform"),
  description: text("description"),
  status: text("status").notNull().default("idea"),
  performanceNote: text("performance_note"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
