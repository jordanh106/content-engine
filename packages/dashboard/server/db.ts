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
  CREATE INDEX IF NOT EXISTS idx_perf_metrics_video_recorded ON performance_metrics(video_code, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_creator_videos_handle_platform ON creator_videos(creator_handle, platform);
  CREATE INDEX IF NOT EXISTS idx_creator_videos_status ON creator_videos(status);
  CREATE INDEX IF NOT EXISTS idx_creator_videos_outlier ON creator_videos(outlier_score_x100 DESC);
  CREATE INDEX IF NOT EXISTS idx_production_checklist_video ON production_checklist(video_code);
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

// Migration: Add summary column to video_breakdowns
try { sqlite.exec(`ALTER TABLE video_breakdowns ADD COLUMN summary TEXT`); } catch { /* exists */ }

// Migration: Add production_style column to video_status
try {
  sqlite.exec(`ALTER TABLE video_status ADD COLUMN production_style TEXT`);
} catch { /* column already exists */ }

// Migration: Add source_idea_topic to video_status (feedback loop)
try {
  sqlite.exec(`ALTER TABLE video_status ADD COLUMN source_idea_topic TEXT`);
} catch { /* column already exists */ }

// Migration: Add production metadata to video_status (feedback loop)
try {
  sqlite.exec(`ALTER TABLE video_status ADD COLUMN hook_pattern_used TEXT`);
} catch { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE video_status ADD COLUMN target_platform TEXT`);
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

// Migration: Add status column to creator_videos
try {
  sqlite.exec(`ALTER TABLE creator_videos ADD COLUMN status TEXT NOT NULL DEFAULT 'inbox'`);
} catch { /* column already exists */ }

// Migration: Add notes column to creator_videos
try {
  sqlite.exec(`ALTER TABLE creator_videos ADD COLUMN notes TEXT`);
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

sqlite.exec(`CREATE TABLE IF NOT EXISTS inspiration_inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'inbox',
  created_at TEXT DEFAULT (datetime('now'))
)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_inspiration_inbox_status ON inspiration_inbox(status)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS research_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_research_reports_type ON research_reports(type, created_at)`);

// Migration: Creator Personas
sqlite.exec(`CREATE TABLE IF NOT EXISTS creator_personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  role TEXT,
  initials TEXT,
  avatar_color TEXT,
  voice_tone TEXT,
  humor_style TEXT,
  content_strengths TEXT,
  audience_affinities TEXT,
  hook_preferences TEXT,
  sentence_style TEXT,
  do_not TEXT,
  example_lines TEXT,
  vault_style_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

// Seed: Pre-built creator personas — uses prepared statements to avoid SQL escaping issues
{
  // One-time correction: rename "Dr. Jordan" to "Jordan Harper" with correct role
  sqlite.prepare(
    "UPDATE creator_personas SET name = ?, role = ? WHERE name = ?"
  ).run("Jordan Harper", "Office Manager & Co-Owner", "Dr. Jordan");

  // One-time fix: restore contractions in example_lines (previously flattened by SQL escaping bug)
  sqlite.prepare(
    "UPDATE creator_personas SET example_lines = ? WHERE name = 'Jordan Harper'"
  ).run(JSON.stringify(["Yeah.", "I'll give them that.", "Trust your instincts. They're right."]));
  sqlite.prepare(
    "UPDATE creator_personas SET example_lines = ? WHERE name = 'Dr. Ashley'"
  ).run(JSON.stringify([
    "If you're pregnant and still exercising, I made this for you.",
    "Your baby's spine starts forming before you know you're pregnant.",
    "This one is for the moms doing all the things.",
  ]));

  const insertPersona = sqlite.prepare(`
    INSERT OR IGNORE INTO creator_personas
      (name, role, initials, avatar_color, voice_tone, humor_style, sentence_style, content_strengths, audience_affinities, hook_preferences, do_not, example_lines)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPersona.run(
    "Jordan Harper",
    "Office Manager & Co-Owner",
    "JH",
    "teal",
    "Deadpan authority with dry humor. Serious content that earns a laugh.",
    "Brief dry asides, fourth-wall breaks, CTA as comedy. Never mugging.",
    "Short. Punchy. Direct. Vary length deliberately. One-word sentences land.",
    JSON.stringify(["Myth busting", "Education", "Pattern interrupt", "Humor-wrapped advice"]),
    JSON.stringify(["Athletes", "Adults", "WFH professionals", "Skeptics"]),
    JSON.stringify(["myth_contrarian", "pattern_interrupt", "statistic"]),
    JSON.stringify(["Sound effects", "Meme overlays", "Exaggerated reactions", "Emdashes"]),
    JSON.stringify(["Yeah.", "I'll give them that.", "Trust your instincts. They're right."])
  );
  insertPersona.run(
    "Dr. Ashley",
    "Chiropractor, Prenatal & Pediatric Specialist",
    "DA",
    "violet",
    "Warm clinical empathy. Medical authority with maternal warmth.",
    "Gentle, relatable, parent-to-parent recognition moments. Humor from truth, not punchlines.",
    "Conversational, 10-15 words. Warm transitions. Never clinical third-person.",
    JSON.stringify(["Prenatal", "Pediatric", "Patient stories", "Demo and exercise"]),
    JSON.stringify(["Prenatal moms", "New parents", "Families", "Pediatric patients"]),
    JSON.stringify(["story_emotional", "question", "did_you_know"]),
    JSON.stringify(["Cold clinical language", "Aggressive CTAs", "Emdashes", "Deadpan delivery"]),
    JSON.stringify([
      "If you're pregnant and still exercising, I made this for you.",
      "Your baby's spine starts forming before you know you're pregnant.",
      "This one is for the moms doing all the things.",
    ])
  );
}

sqlite.exec(`CREATE TABLE IF NOT EXISTS dismissed_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_fingerprint TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'not_relevant',
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Carousel & Thumbnail Generation
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS generated_carousels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_code TEXT,
    idea_topic TEXT,
    platform TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL,
    slide_count INTEGER NOT NULL,
    hook_line TEXT,
    talking_points TEXT,
    cta_text TEXT,
    status TEXT NOT NULL DEFAULT 'generating',
    generation_source TEXT NOT NULL DEFAULT 'manual',
    template_version TEXT,
    strategy_version TEXT,
    composite_score REAL,
    n8n_execution_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS carousel_slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carousel_id INTEGER NOT NULL REFERENCES generated_carousels(id) ON DELETE CASCADE,
    slide_index INTEGER NOT NULL,
    slide_type TEXT NOT NULL,
    image_path TEXT,
    filename TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_carousels_video ON generated_carousels(video_code);
  CREATE INDEX IF NOT EXISTS idx_carousels_status ON generated_carousels(status);
  CREATE INDEX IF NOT EXISTS idx_carousel_slides_carousel ON carousel_slides(carousel_id);
`);

// Carousel Lab: add new columns if they don't exist yet (idempotent migrations)
const addColumnIfMissing = (table: string, column: string, type: string) => {
  try {
    sqlite.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch {
    // Column already exists — ignore
  }
};

addColumnIfMissing("generated_carousels", "hook_archetype", "TEXT");
addColumnIfMissing("generated_carousels", "audience", "TEXT");
addColumnIfMissing("generated_carousels", "canva_design_id", "TEXT");
addColumnIfMissing("generated_carousels", "canva_design_url", "TEXT");
addColumnIfMissing("generated_carousels", "remix_source_url", "TEXT");
addColumnIfMissing("generated_carousels", "remix_source_type", "TEXT"); // "url" | "screenshot"
addColumnIfMissing("generated_carousels", "source_carousel_id", "INTEGER"); // for cross-platform multiplied carousels
addColumnIfMissing("carousel_slides", "heading", "TEXT");
addColumnIfMissing("carousel_slides", "body_text", "TEXT");
addColumnIfMissing("generated_carousels", "carousel_style", "TEXT DEFAULT 'flat'");
addColumnIfMissing("generated_carousels", "output_format", "TEXT DEFAULT 'static'");
addColumnIfMissing("generated_carousels", "video_path", "TEXT");

// Carousel Watch: tracked accounts for competitor carousel monitoring
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS carousel_watch_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL,
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(platform, handle)
  );

  CREATE TABLE IF NOT EXISTS carousel_watch_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES carousel_watch_accounts(id) ON DELETE CASCADE,
    post_url TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,
    post_type TEXT DEFAULT 'carousel',
    thumbnail_url TEXT,
    caption TEXT,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    analysis_json TEXT,
    fetched_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_watch_posts_account ON carousel_watch_posts(account_id);
`);
addColumnIfMissing("carousel_slides", "visual_suggestion", "TEXT");

// ============================================
// Creator Growth System
// ============================================

sqlite.exec(`CREATE TABLE IF NOT EXISTS creator_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level INTEGER NOT NULL DEFAULT 1,
  level_name TEXT NOT NULL DEFAULT 'Observer',
  xp INTEGER NOT NULL DEFAULT 0,
  quests_completed TEXT DEFAULT '[]',
  active_quest_id TEXT,
  milestones_reached TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS quest_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quest_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  xp_awarded INTEGER DEFAULT 0,
  coach_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Blowing Up: tracked creators for daily scanning
sqlite.exec(`CREATE TABLE IF NOT EXISTS blowing_up_creators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL,
  platform TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(handle, platform)
)`);

// Seed default tracked creators if table is empty
{
  const count = sqlite.prepare("SELECT COUNT(*) as c FROM blowing_up_creators").get() as { c: number };
  if (count.c === 0) {
    const seed = sqlite.prepare("INSERT OR IGNORE INTO blowing_up_creators (handle, platform) VALUES (?, ?)");
    seed.run("@mommasc.hiro", "TikTok");
    seed.run("@dr.kimbra.runyan", "Instagram");
    seed.run("@sheridan.rossi", "Instagram");
    seed.run("@collectivechiro", "Instagram");
    seed.run("@backpainacademy", "Instagram");
    seed.run("@nomusclepain_academy", "Instagram");
  }
}

// Ensure exactly one creator_progress row exists (singleton)
const progressCount = sqlite.prepare("SELECT COUNT(*) as count FROM creator_progress").get() as { count: number };
if (progressCount.count === 0) {
  sqlite.prepare("INSERT INTO creator_progress (level, level_name, xp) VALUES (1, 'Observer', 0)").run();
}

// Higgsfield Soul Characters: trained character refs with auto-inject support
sqlite.exec(`CREATE TABLE IF NOT EXISTS higgsfield_characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  soul_id TEXT NOT NULL UNIQUE,
  training_image_ids TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'training',
  active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Storytelling Reel Engine: reel manifests + per-shot rows + reroll audit
sqlite.exec(`
CREATE TABLE IF NOT EXISTS storytelling_reels (
  reel_id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  title TEXT,
  style TEXT NOT NULL,
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scripting',
  total_duration_sec INTEGER NOT NULL,
  soul_character_id TEXT,
  voice_id TEXT,
  voiceover_url TEXT,
  voiceover_duration_sec REAL,
  voiceover_provider TEXT,
  music_url TEXT,
  music_duration_sec REAL,
  captions_srt TEXT,
  final_mp4_url TEXT,
  alternate_hooks_json TEXT,
  cost_credits REAL DEFAULT 0,
  cost_breakdown_json TEXT,
  manifest_json TEXT,
  source_text TEXT,
  source_urls_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS storytelling_shots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reel_id TEXT NOT NULL REFERENCES storytelling_reels(reel_id) ON DELETE CASCADE,
  shot_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  motion_prompt TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  start_sec REAL NOT NULL DEFAULT 0,
  end_sec REAL NOT NULL DEFAULT 0,
  sfx_beat TEXT,
  UNIQUE(reel_id, shot_index)
);

CREATE TABLE IF NOT EXISTS storytelling_rerolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reel_id TEXT NOT NULL,
  shot_index INTEGER NOT NULL,
  reroll_type TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  credits_spent REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// ─── Projects (unified unit of work) ──────────────────────────────────────
sqlite.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafting',
  brief_md TEXT,
  active INTEGER DEFAULT 0,
  source_template_id TEXT,
  thumbnail_url TEXT,
  cost_credits REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_refs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT,
  upload_id TEXT,
  url TEXT,
  file_path TEXT,
  kind TEXT NOT NULL DEFAULT 'image',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT,
  url TEXT,
  file_path TEXT,
  model_used TEXT,
  prompt TEXT,
  cost_credits REAL DEFAULT 0,
  predicted_virality REAL,
  predicted_virality_breakdown_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Append-only progress log for in-flight orchestrators.
-- Each row is a stage state transition. UI dedupes to latest state per stage.
CREATE TABLE IF NOT EXISTS project_generation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_kind ON projects(kind);
CREATE INDEX IF NOT EXISTS idx_project_outputs_project ON project_outputs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_refs_project ON project_refs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_log_project_created ON project_generation_log(project_id, created_at DESC);
`);

addColumnIfMissing("projects", "visual_system_json", "TEXT");

// Audience-first pivot: tag ideas + assets with the audience segment(s) they serve.
addColumnIfMissing("inspiration_inbox", "audience_tags", "TEXT"); // CSV of audience segment IDs
addColumnIfMissing("creator_videos", "audience_tags", "TEXT");
addColumnIfMissing("project_outputs", "audience_tags", "TEXT");
addColumnIfMissing("projects", "audience_tags", "TEXT");
