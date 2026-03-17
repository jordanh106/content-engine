import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../shared/schema.js";
import path from "path";
import fs from "fs";

const dataDir = path.resolve(import.meta.dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "dashboard.db");
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS video_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_code TEXT NOT NULL UNIQUE,
    current_status TEXT NOT NULL DEFAULT 'SCRIPTED',
    status_updated_at TEXT DEFAULT (datetime('now')),
    notes TEXT,
    production_plan_path TEXT,
    voiceover_recorded_at TEXT,
    generated_at TEXT,
    assembled_at TEXT,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_code TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_at TEXT DEFAULT (datetime('now')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS calendar_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    platform TEXT NOT NULL,
    video_code TEXT,
    slot_label TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS production_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_type TEXT NOT NULL,
    audience_category TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration_minutes INTEGER,
    video_codes TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS session_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES production_sessions(id) ON DELETE CASCADE,
    video_code TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    order_index INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_code TEXT NOT NULL,
    platform TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    watch_time_seconds INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS saved_captions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_code TEXT NOT NULL,
    platform TEXT NOT NULL,
    caption TEXT NOT NULL,
    variant INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hashtag_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hashtags TEXT NOT NULL,
    category TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS caption_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT,
    template TEXT NOT NULL,
    format TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS channel_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handle TEXT NOT NULL,
    platform TEXT NOT NULL,
    followers INTEGER,
    avg_views INTEGER,
    engagement_rate_bps INTEGER,
    save_rate_bps INTEGER,
    posts_per_week INTEGER,
    recorded_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vault_hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    example TEXT,
    category TEXT NOT NULL DEFAULT 'custom',
    source_creator TEXT,
    source_url TEXT,
    best_format TEXT,
    platform TEXT,
    optimizes TEXT,
    variables TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vault_styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    source_creator TEXT,
    source_url TEXT,
    source_transcript TEXT,
    style_rules TEXT NOT NULL,
    example_script TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS creator_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_handle TEXT NOT NULL,
    platform TEXT NOT NULL,
    video_url TEXT,
    video_title TEXT,
    thumbnail_url TEXT,
    published_at TEXT,
    duration_seconds INTEGER,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    outlier_score_x100 INTEGER,
    recorded_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS video_breakdowns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_video_id INTEGER REFERENCES creator_videos(id) ON DELETE CASCADE,
    creator_handle TEXT,
    video_url TEXT,
    topic TEXT,
    angle TEXT,
    hook_format TEXT,
    story_style TEXT,
    visual_format TEXT,
    visuals TEXT,
    audio TEXT,
    raw_notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS script_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_code TEXT,
    idea_topic TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    script TEXT NOT NULL,
    hook_id INTEGER,
    style_id INTEGER,
    change_note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_waterfall (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_video_code TEXT NOT NULL,
    derived_video_code TEXT,
    tier TEXT NOT NULL,
    platform TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'idea',
    performance_note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS thumbnail_concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_code TEXT NOT NULL,
    text_overlay TEXT NOT NULL,
    expression TEXT,
    background TEXT,
    color_scheme TEXT,
    style TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT,
    target_view TEXT,
    target_id TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Indices for query performance
sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_perf_metrics_video_platform ON performance_metrics(video_code, platform);
  CREATE INDEX IF NOT EXISTS idx_perf_metrics_recorded ON performance_metrics(recorded_at);
  CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_entries(date);
  CREATE INDEX IF NOT EXISTS idx_calendar_video ON calendar_entries(video_code);
  CREATE INDEX IF NOT EXISTS idx_status_history_video ON status_history(video_code);
  CREATE INDEX IF NOT EXISTS idx_video_status_code ON video_status(video_code);
  CREATE INDEX IF NOT EXISTS idx_creator_videos_handle ON creator_videos(creator_handle);
  CREATE INDEX IF NOT EXISTS idx_script_versions_video ON script_versions(video_code);
  CREATE INDEX IF NOT EXISTS idx_session_items_session ON session_items(session_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
  CREATE INDEX IF NOT EXISTS idx_saved_captions_video ON saved_captions(video_code);
  CREATE INDEX IF NOT EXISTS idx_channel_snapshots_handle ON channel_snapshots(handle, platform);
`);

// Migrations for existing databases
try {
  sqlite.exec(`ALTER TABLE script_versions ADD COLUMN idea_topic TEXT`);
} catch { /* column already exists */ }

// Add assembly_checklist column
try {
  sqlite.exec(`ALTER TABLE video_status ADD COLUMN assembly_checklist TEXT`);
} catch { /* column already exists */ }

// Fix script_versions: video_code must be nullable (SQLite can't ALTER COLUMN, must recreate)
try {
  const info = sqlite.prepare("PRAGMA table_info(script_versions)").all() as Array<{ name: string; notnull: number }>;
  const vcCol = info.find((c) => c.name === "video_code");
  if (vcCol && vcCol.notnull === 1) {
    sqlite.exec(`
      CREATE TABLE script_versions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_code TEXT,
        idea_topic TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        script TEXT NOT NULL,
        hook_id INTEGER,
        style_id INTEGER,
        change_note TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO script_versions_new SELECT * FROM script_versions;
      DROP TABLE script_versions;
      ALTER TABLE script_versions_new RENAME TO script_versions;
    `);
    console.log("[db] Migrated script_versions: video_code is now nullable");
  }
} catch (e) { console.warn("[db] script_versions migration:", e); }

// ============================================
// Kova-Inspired Features: New Tables
// ============================================

// Feature 2: Visual Style System
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS vault_visual_styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    source_creator TEXT,
    source_url TEXT,
    source_breakdown_ids TEXT,
    typography_system TEXT NOT NULL,
    color_palette TEXT NOT NULL,
    transition_rules TEXT,
    set_design_rules TEXT,
    music_guidelines TEXT,
    motion_graphics_style TEXT,
    do_not TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Feature 3: Storyboard System
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS storyboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_code TEXT NOT NULL,
    visual_style_id INTEGER,
    one_sentence_concept TEXT,
    story_structure TEXT,
    total_duration_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS storyboard_shots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyboard_id INTEGER NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    shot_number INTEGER NOT NULL,
    act TEXT,
    duration_seconds REAL NOT NULL,
    shot_type TEXT,
    camera_movement TEXT,
    cinema_studio_prompt TEXT,
    script_line TEXT,
    broll_type TEXT,
    production_method TEXT NOT NULL DEFAULT 'real',
    ai_enhancement_notes TEXT,
    remotion_component TEXT,
    notes TEXT,
    order_index INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Feature 4: AI Enhancement Prompt Workbench
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS ai_generation_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyboard_shot_id INTEGER REFERENCES storyboard_shots(id) ON DELETE CASCADE,
    video_code TEXT NOT NULL,
    shot_number INTEGER,
    technique TEXT NOT NULL,
    tool TEXT,
    model TEXT,
    prompt_text TEXT NOT NULL,
    prompt_version INTEGER NOT NULL DEFAULT 1,
    source_description TEXT,
    target_description TEXT,
    result_notes TEXT,
    result_rating INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Feature 5: One-Sentence Concept Framework
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS idea_concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_topic TEXT NOT NULL,
    one_sentence TEXT NOT NULL,
    technical_interest_score INTEGER,
    emotional_resonance_score INTEGER,
    ten_second_explainability_score INTEGER,
    visual_payoff_score INTEGER,
    overall_score INTEGER,
    ai_feedback TEXT,
    refined_version TEXT,
    approved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// New indices
sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_storyboards_video ON storyboards(video_code);
  CREATE INDEX IF NOT EXISTS idx_storyboard_shots_storyboard ON storyboard_shots(storyboard_id);
  CREATE INDEX IF NOT EXISTS idx_ai_prompts_video ON ai_generation_prompts(video_code);
  CREATE INDEX IF NOT EXISTS idx_ai_prompts_shot ON ai_generation_prompts(storyboard_shot_id);
  CREATE INDEX IF NOT EXISTS idx_idea_concepts_topic ON idea_concepts(idea_topic);
`);

// Feature 1: Deep DNA columns on video_breakdowns
const dnaColumns = [
  "typography_system", "story_structure", "aesthetic_keywords", "color_palette",
  "set_design", "music_audio", "transition_style", "replication_plan",
  "broll_types", "one_sentence_concept",
];
for (const col of dnaColumns) {
  try { sqlite.exec(`ALTER TABLE video_breakdowns ADD COLUMN ${col} TEXT`); } catch { /* exists */ }
}

// Migration: Add production_style column to video_status
try {
  sqlite.exec(`ALTER TABLE video_status ADD COLUMN production_style TEXT`);
} catch { /* column already exists */ }

// Migration: Add source_idea_topic to video_status (feedback loop)
try {
  sqlite.exec(`ALTER TABLE video_status ADD COLUMN source_idea_topic TEXT`);
} catch { /* column already exists */ }

// Migration: Add hook_pattern_used and format_id to performance_metrics (feedback loop)
try {
  sqlite.exec(`ALTER TABLE performance_metrics ADD COLUMN hook_pattern_used TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE performance_metrics ADD COLUMN format_id TEXT`);
} catch { /* column already exists */ }

// Migration: Add image_url and image_style to storyboard_shots
try {
  sqlite.exec(`ALTER TABLE storyboard_shots ADD COLUMN image_url TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE storyboard_shots ADD COLUMN image_style TEXT`);
} catch { /* column already exists */ }

// Migration: Create production_checklist table
sqlite.exec(`CREATE TABLE IF NOT EXISTS production_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_code TEXT NOT NULL,
  checklist_type TEXT NOT NULL,
  item_key TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  completed_at TEXT,
  stage_transition TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Migration: Create social_attributions table
sqlite.exec(`CREATE TABLE IF NOT EXISTS social_attributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

// Migration: Platform connections (OAuth tokens)
sqlite.exec(`CREATE TABLE IF NOT EXISTS platform_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  channel_id TEXT,
  channel_name TEXT,
  connected_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

// Migration: YouTube video links
sqlite.exec(`CREATE TABLE IF NOT EXISTS youtube_video_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_code TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL UNIQUE,
  youtube_title TEXT,
  match_score INTEGER,
  match_method TEXT,
  platform TEXT NOT NULL DEFAULT 'youtube_shorts',
  last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);
