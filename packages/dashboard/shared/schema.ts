import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
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
  productionStyle: text("production_style"),
  sourceIdeaTopic: text("source_idea_topic"),
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
  // Feedback loop fields: link performance back to hook patterns and formats
  hookPatternUsed: text("hook_pattern_used"),
  formatId: text("format_id"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const socialAttributions = sqliteTable("social_attributions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthKey: text("month_key").notNull(), // "2026-03" format
  count: integer("count").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
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
  status: text("status").notNull().default("inbox"),
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
  // Deep DNA fields (Feature 1)
  typographySystem: text("typography_system"),
  storyStructure: text("story_structure"),
  aestheticKeywords: text("aesthetic_keywords"),
  colorPalette: text("color_palette"),
  setDesign: text("set_design"),
  musicAudio: text("music_audio"),
  transitionStyle: text("transition_style"),
  replicationPlan: text("replication_plan"),
  brollTypes: text("broll_types"),
  oneSentenceConcept: text("one_sentence_concept"),
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

// Kova-Inspired Features

export const vaultVisualStyles = sqliteTable("vault_visual_styles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  sourceCreator: text("source_creator"),
  sourceUrl: text("source_url"),
  sourceBreakdownIds: text("source_breakdown_ids"),
  typographySystem: text("typography_system").notNull(),
  colorPalette: text("color_palette").notNull(),
  transitionRules: text("transition_rules"),
  setDesignRules: text("set_design_rules"),
  musicGuidelines: text("music_guidelines"),
  motionGraphicsStyle: text("motion_graphics_style"),
  doNot: text("do_not"),
  usageCount: integer("usage_count").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const storyboards = sqliteTable("storyboards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code").notNull(),
  visualStyleId: integer("visual_style_id"),
  oneSentenceConcept: text("one_sentence_concept"),
  storyStructure: text("story_structure"),
  totalDurationSeconds: integer("total_duration_seconds"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const storyboardShots = sqliteTable("storyboard_shots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storyboardId: integer("storyboard_id").notNull(),
  shotNumber: integer("shot_number").notNull(),
  act: text("act"),
  durationSeconds: real("duration_seconds").notNull(),
  shotType: text("shot_type"),
  cameraMovement: text("camera_movement"),
  cinemaStudioPrompt: text("cinema_studio_prompt"),
  scriptLine: text("script_line"),
  brollType: text("broll_type"),
  productionMethod: text("production_method").notNull().default("real"),
  aiEnhancementNotes: text("ai_enhancement_notes"),
  remotionComponent: text("remotion_component"),
  notes: text("notes"),
  orderIndex: integer("order_index").notNull(),
  imageUrl: text("image_url"),
  imageStyle: text("image_style"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const aiGenerationPrompts = sqliteTable("ai_generation_prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storyboardShotId: integer("storyboard_shot_id"),
  videoCode: text("video_code").notNull(),
  shotNumber: integer("shot_number"),
  technique: text("technique").notNull(),
  tool: text("tool"),
  model: text("model"),
  promptText: text("prompt_text").notNull(),
  promptVersion: integer("prompt_version").notNull().default(1),
  sourceDescription: text("source_description"),
  targetDescription: text("target_description"),
  resultNotes: text("result_notes"),
  resultRating: integer("result_rating"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const ideaConcepts = sqliteTable("idea_concepts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ideaTopic: text("idea_topic").notNull(),
  oneSentence: text("one_sentence").notNull(),
  technicalInterestScore: integer("technical_interest_score"),
  emotionalResonanceScore: integer("emotional_resonance_score"),
  tenSecondExplainabilityScore: integer("ten_second_explainability_score"),
  visualPayoffScore: integer("visual_payoff_score"),
  overallScore: integer("overall_score"),
  aiFeedback: text("ai_feedback"),
  refinedVersion: text("refined_version"),
  approved: integer("approved", { mode: "boolean" }).default(false),
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

// Platform Connections (OAuth tokens)

export const platformConnections = sqliteTable("platform_connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull().unique(), // "youtube", "instagram", "tiktok"
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: text("token_expires_at"),
  channelId: text("channel_id"),
  channelName: text("channel_name"),
  connectedAt: text("connected_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const youtubeVideoLinks = sqliteTable("youtube_video_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code").notNull(),
  youtubeVideoId: text("youtube_video_id").notNull().unique(),
  youtubeTitle: text("youtube_title"),
  matchScore: integer("match_score"), // 0-100 word overlap
  matchMethod: text("match_method"), // "auto" | "manual"
  platform: text("platform").notNull().default("youtube_shorts"), // "youtube_shorts" | "youtube_long"
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// Production Companion

export const productionChecklist = sqliteTable("production_checklist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code").notNull(),
  checklistType: text("checklist_type").notNull(),
  itemKey: text("item_key").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false),
  completedAt: text("completed_at"),
  stageTransition: text("stage_transition"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const inspirationInbox = sqliteTable("inspiration_inbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  sourceUrl: text("source_url"),
  status: text("status").notNull().default("inbox"), // "inbox" | "developed" | "dismissed"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// Creator Personas

export const creatorPersonas = sqliteTable("creator_personas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  role: text("role"),
  initials: text("initials"),
  avatarColor: text("avatar_color"),
  voiceTone: text("voice_tone"),
  humorStyle: text("humor_style"),
  contentStrengths: text("content_strengths"), // JSON: string[]
  audienceAffinities: text("audience_affinities"), // JSON: string[]
  hookPreferences: text("hook_preferences"), // JSON: string[]
  sentenceStyle: text("sentence_style"),
  doNot: text("do_not"), // JSON: string[]
  exampleLines: text("example_lines"), // JSON: string[]
  vaultStyleId: integer("vault_style_id"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// Dismissed Opportunities

export const dismissedOpportunities = sqliteTable("dismissed_opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topicFingerprint: text("topic_fingerprint").notNull().unique(), // lowercased topic slug
  reason: text("reason").notNull().default("not_relevant"), // "already_covered" | "not_relevant" | "oversaturated"
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ============================================
// Generated Carousels & Thumbnails
// ============================================

export const generatedCarousels = sqliteTable("generated_carousels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoCode: text("video_code"),
  ideaTopic: text("idea_topic"),
  platform: text("platform").notNull(), // "instagram" | "linkedin" | "tiktok" | "youtube_thumbnail"
  aspectRatio: text("aspect_ratio").notNull(), // "1:1" | "4:5" | "9:16" | "16:9"
  slideCount: integer("slide_count").notNull(),
  hookLine: text("hook_line"),
  talkingPoints: text("talking_points"), // JSON array
  ctaText: text("cta_text"),
  status: text("status").notNull().default("generating"), // "generating" | "completed" | "failed"
  generationSource: text("generation_source").notNull().default("manual"), // "manual" | "scheduled"
  templateVersion: text("template_version"), // git commit hash of templates used
  strategyVersion: text("strategy_version"), // git commit hash of carousel-strategy.md
  compositeScore: real("composite_score"), // cached engagement score
  n8nExecutionId: text("n8n_execution_id"),
  hookArchetype: text("hook_archetype"), // Kallaway archetype used for cover slide
  audience: text("audience"),            // target audience segment
  canvaDesignId: text("canva_design_id"),
  canvaDesignUrl: text("canva_design_url"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});

export const carouselSlides = sqliteTable("carousel_slides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  carouselId: integer("carousel_id")
    .notNull()
    .references(() => generatedCarousels.id, { onDelete: "cascade" }),
  slideIndex: integer("slide_index").notNull(),
  slideType: text("slide_type").notNull(), // "cover" | "content" | "rehook" | "cta"
  imagePath: text("image_path"),
  filename: text("filename"),
  heading: text("heading"),          // editable slide heading
  bodyText: text("body_text"),       // editable slide body copy
  visualSuggestion: text("visual_suggestion"), // editable visual direction
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
