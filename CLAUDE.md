# Content Engine

Industry-agnostic content creation toolkit. Claude skills, reusable video formats, documented production workflows, Remotion-powered motion graphics, and a production dashboard. Chiropractic is the first industry; the architecture supports any industry by swapping config and content packs.

## Architecture

```
skills/              Claude Code skills (symlinked to ~/.claude/skills/)
formats/             7 reusable video format templates (industry-agnostic)
workflows/           Production process documentation (industry-agnostic)
industries/          Pluggable industry content packs
packages/
  remotion-studio/   Programmatic motion graphics (7 compositions)
  dashboard/         Production management dashboard (React + Express + SQLite)
scripts/             Repo utilities (install, scaffold)
```

## Active Industry

**Chiropractic** (Collective Family Chiropractic)
- Config: `industries/chiropractic/config.json` (7 audiences, 65 conditions, 4 platforms)
- Brand: `industries/chiropractic/brand.md` and `skills/brand-factory/presets/collective-family.md`
- Content: `industries/chiropractic/content-library.md` (57 production-ready videos)
- Calendar: `industries/chiropractic/calendar.md` (4-week rolling plan)
- Production guides: `industries/chiropractic/production-guides/` (5 detailed guides)
- Cinema defaults: `industries/chiropractic/cinema-defaults.md`
- Hook patterns: `industries/chiropractic/hook-patterns.md` (6 hook categories, CTA patterns, platform rules)
- Idea bank: `industries/chiropractic/idea-bank.md` (content ideas staging area)
- Watchlist: `industries/chiropractic/watchlist.md` (competitor/inspiration creator tracking)
- Viral insights: `industries/chiropractic/viral-insights/` (scout reports and cumulative patterns)
- Creator insights: `industries/chiropractic/creator-insights/` (per-creator analysis profiles)
- Watchlist intelligence: `industries/chiropractic/watchlist-insights/` (weekly competitive intelligence reports)
- Carousel strategy: `industries/chiropractic/carousel-strategy.md` (autoresearch-optimized content rules for carousels)
- Carousel optimizer: `industries/chiropractic/carousel-optimizer/` (autoresearch loop configurations for templates + strategy)

## Skills

| Skill | Invocation | Purpose |
|-------|-----------|---------|
| last30days | `/last30days [topic]` | Research trending topics on Reddit + X + Web from last 30 days |
| viral-scout | `/viral-scout [niche]` | Find top-performing niche content across platforms, extract patterns |
| creator-analysis | `/creator-analysis @handle` | Deep-dive on a specific creator's patterns, hooks, and formats |
| competitor-research | `/competitor-research [niche]` | Broad competitive landscape analysis and positioning |
| content-planner | `/content-planner` | Research output to weekly content calendar (uses hook patterns, idea bank, viral insights) |
| video-director | `/video-director` | Calendar entry to full production plan (hook variations, platform optimization, transcript analysis) |
| remotion-best-practices | Auto-loaded when working with Remotion | Domain knowledge for Remotion video creation |
| brand-factory | Auto-loaded when applying brand | Industry-specific brand colors, typography, voice |
| theme-factory | `/theme-factory` | 11 pre-set styling themes for artifacts |

### Skill Pipeline
```
/last30days ─┐
/viral-scout ─┼→ /content-planner → /video-director → Remotion + Cinema Studio → Assembly
/creator-analysis ─┘         ↑                ↑
                     idea-bank.md      hook-patterns.md
```

## Video Formats

Seven reusable templates in `formats/`. Swap the topic, keep the structure:

| Format | Name | Duration | Best For |
|--------|------|----------|----------|
| A | Explainer ("What Is [X]?") | 30-45s | Education, SEO |
| B | Checklist ("Signs Your [X] Needs [Y]") | 30-45s | Shareability, saves |
| C | Demo ("The Exercise/Tutorial") | 30-60s | Actionable value |
| D | Myth Buster ("Myth vs. Truth") | 15-30s | Engagement, comments |
| E | Walkthrough ("What Happens During [X]") | 45-60s | New patient/customer conversion |
| F | Quick Tip ("Did You Know?") | 6-15s | TikTok micro-content, quick facts |
| G | Patient Story ("This Changed Everything") | 15-30s | Social proof, testimonials |

## Remotion Project

Location: `packages/remotion-studio/`

Renders motion graphics programmatically (title cards, stat cards, checklist overlays, myth/truth reveals, step indicators, CTAs). This is the PRIMARY graphics pipeline for this repo. Does NOT replace Cinema Studio for cinematic footage. They combine in post-production.

Each composition accepts parametrized input via Zod schemas. Brand colors come from the theme system.

### Compositions

| ID | Format | Default Duration |
|----|--------|-----------------|
| Explainer | A | 30s |
| Checklist | B | 35s |
| Demo | C | 40s |
| MythBuster | D | 15s |
| Walkthrough | E | 45s |
| QuickTip | F | 15s |
| PatientStory | G | 25s |

All render at **1080x1920 (9:16)** at **30 fps**.

### Key Patterns

- Animations use `useCurrentFrame()` + `spring()` + `interpolate()`. No CSS animations.
- Sequencing uses `<Series>` for sequential scenes.
- Zod must be exactly `3.22.3`.
- Props use `type` declarations, not `interface`.
- Shared components: `TitleCard`, `StatCard`, `ChecklistOverlay`, `MythTruthReveal`, `StepIndicator`, `CallToAction`, `HookText`, `SectionCard`, `FrequencyCard`, `KineticText`, `ChartCard`, `QuoteCard`.
- Effects: `GrainOverlay`, `GradientBackground`, `VhsOverlay` (retro aesthetic, enabled via `theme.vhsOverlay`).

## Dashboard

Location: `packages/dashboard/`

Internal production management tool for tracking content through the production pipeline. Reads markdown/JSON files as the source of truth for content. Uses SQLite only for tracking production state, scheduling, and metrics.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, TailwindCSS 4 |
| State | TanStack React Query v5 |
| Charts | Recharts |
| Backend | Express 5, TypeScript, tsx (dev server) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Icons | lucide-react |
| File watching | chokidar |

No auth. Localhost only. Solo internal tool accessed from desktop and phone.

### Current Status

**Phase 1 COMPLETE**: Content Library + VideoDetail + API + responsive layout
- Content library parser (`server/parsers/content-library.ts`) reads all 57 videos from `content-library.md`
- Config parser (`server/parsers/config.ts`) reads audiences, conditions, platforms from `config.json`
- API routes: `GET /api/videos` (filter by audience/format/status/search), `GET /api/videos/:code`, `GET /api/videos/config/industry`, `GET /api/pipeline`, `PUT /api/pipeline/:code/status`
- ContentLibrary view: filterable card grid (3-col desktop, 1-col mobile) grouped by audience
- VideoDetail: slide-out panel (desktop) / full-screen sheet (mobile) with Script, Shots, Info tabs
- Shots tab has click-to-copy buttons for Cinema Studio prompts (44px touch targets)
- Layout: sidebar nav on desktop, bottom tabs on mobile
- SQLite database auto-creates tables on startup

**Phase 2 COMPLETE**: Pipeline Board + DashboardHome
- PipelineBoard: kanban with drag-to-advance status
- DashboardHome: stat cards, tonight's session recommendation

**Phase 5 COMPLETE**: Metrics + Ideas + Watchlist
- MetricsView: manual metric entry (views/likes/saves/shares/comments per video per platform), top performers table, bar charts (avg views by format, engagement/save rate by format), pie chart (views by platform)
- IdeasView: reads `idea-bank.md`, category filter chips (trending/competitor/evergreen/audience/personal/archived), idea cards with priority and format tags
- WatchlistView: reads `watchlist.md`, creator cards with platform badges, last-analyzed status, quick action commands
- API routes: `/api/metrics`, `/api/ideas`, `/api/watchlist`
- Parsers: `idea-bank.ts`, `watchlist.ts` with file-watching cache invalidation

**Additional features shipped**:
- **Inspiration Inbox**: Frictionless raw-idea capture layer in IdeasView. SQLite-only (`inspiration_inbox` table, no markdown file). Statuses: inbox / developed / dismissed. Develop action writes to `idea-bank.md`.
- **Trend Pulse widget**: Home screen widget surfacing latest n8n Content Intelligence digest. Shows trending topics, hook patterns, content gaps. One-click "+ Add to Ideas". Auto-hidden if no digest file exists.
- **Carousel Waterfall tier**: Auto-Generate in Waterfall tab produces 12 derivatives (was 10). Two new carousel items: Instagram (7-slide) + LinkedIn (6-slide) with AI-generated slide outlines. Carousel cards in WaterfallTab show expandable slide-by-slide briefs.
- **Carousel & Thumbnail Pipeline**: Self-improving carousel generation via n8n workflows + autoresearch loops. Branded HTML templates (cover, content, CTA, thumbnail) rendered to images. Dashboard-triggered generation from VideoDetail CarouselsTab. Batch workflow on Friday 8am. Two autoresearch optimization loops: template design + content strategy, both driven by composite engagement score. Version stamping tracks which template/strategy produced which results.

**Phases 3-4 PENDING**:
- Phase 3: Session Planner (batch production checklist with timer, auto-advance status on completion)
- Phase 4: Calendar (week/month views across IG Reels / YT Shorts / TikTok / YT Long, gap detection, drag-to-reschedule)

### Dashboard Architecture

```
content-library.md  ──parser──→  Video data (scripts, shots, tags, format)
config.json         ──parser──→  Audiences, conditions, platforms
production-plans/   ──parser──→  Generated production plans
idea-bank.md        ──parser──→  Content ideas (staged for planning)
watchlist.md        ──parser──→  Tracked creators
viral-insights/     ──parser──→  Weekly n8n digest (Trend Pulse widget)
                                         ↓
                               Express API enriches with:
                                         ↓
SQLite DB           ──query──→   Status, dates, calendar, sessions, metrics, inbox
```

### SQLite Tables

- `video_status` - Production status per video (SCRIPTED → RECORDING → GENERATING → ASSEMBLED → SCHEDULED → PUBLISHED)
- `status_history` - Audit trail of status changes
- `calendar_entries` - Publishing schedule (date, platform, video_code)
- `production_sessions` - Batch session tracking (type, duration, videos completed)
- `session_items` - Checklist items within a session
- `performance_metrics` - Post-publish metrics (views, likes, saves, shares, comments)
- `inspiration_inbox` - Raw idea captures (content, source_url, status: inbox/developed/dismissed)
- `generated_carousels` - Carousel metadata with template/strategy version stamps, composite scores
- `carousel_slides` - Individual slide records (image paths, slide type, index)

### Design System

- **Cards**: `bg-white border border-slate-200 rounded-2xl p-5`
- **Labels**: `text-[10px] font-black uppercase tracking-[0.2em] text-slate-400`
- **Buttons**: `rounded-full text-[10px] font-black uppercase tracking-widest`
- **Colors**: Teal-600 primary, slate neutrals
- **Typography**: Serif headings, sans-serif body
- **Format colors**: A=teal, B=emerald, C=sky, D=rose, E=violet, F=orange, G=pink
- **Responsive**: Mobile-first. `md:` breakpoint switches from bottom tabs to sidebar, single column to multi-column grids.

## Higgsfield AI Production

Reference: `industries/chiropractic/production-guides/`

### Core Philosophy

"Film Real. Enhance with AI." Authenticity is the competitive advantage. AI makes real content look professionally produced.

- 80% hybrid content (real footage + AI enhancement)
- 15% AI-generated graphics (Remotion primary; Vibe Motion optional fallback)
- 5% AI supplemental inserts (environments, anatomical visuals)

### 3 VFX Tricks (from River Cody)

1. **Scene Extension** - Film 3-5s real clip, extract last frame, AI continues the scene seamlessly
2. **Impossible Camera Moves** - Static phone footage + Cinema Studio presets (Slow Orbit, Crane Up, Bullet Time)
3. **Environment Enhancement** - AI transforms background while preserving your real performance

### Higgsfield Tools

| Tool | Purpose |
|------|---------|
| Mixed Media | Apply signature look to all real clips |
| Cinema Studio | Add cinematic camera moves to static shots |
| Upscale | Match phone footage quality to AI segments |
| Motion Engine | Smooth shaky real footage |
| Vibe Motion | Optional fallback for quick one-off graphics when Remotion is not practical |
| Lipsync Studio | Polish speaking performances |

### AI Models

- **Minimax Hailuo 02**: Fast iteration, good enough for most shots
- **Sora 2**: Highest quality, use for hero shots
- **WAN 2.6**: Multi-shot continuity
- **Kling 2.6/3.0**: Lip-sync work

### Cinema Studio Camera Defaults

| Content Type | Camera | Lens | Focal Length | Genre |
|-------------|--------|------|-------------|-------|
| Medical/educational | ARRI Alexa | Cooke | 35mm | Intimate |
| Anatomical/visual | RED V-RAPTOR | Zeiss Ultra Prime | 50mm | Auto |
| Exercise/movement | Sony Venice | Canon K35 | 24mm | Intimate |

### Production Guides

| File | Content |
|------|---------|
| `cinema-studio-guide.md` | Complete Cinema Studio 2.0 guide: 50+ camera movements, 8 genres, Hero Frame First workflow |
| `higgsfield-guide.md` | Full platform guide: Mixed Media, 3 VFX tricks, workflow architecture |
| `higgsfield-prompts.md` | 19 production templates across 3 tiers with ready-to-use prompts |
| `chainsaw-video-plan.md` | Hybrid production example: filmed + AI enhanced, 5-act structure, humor strategy |
| `chainsaw-video-ai-version.md` | Full AI production example: voiceover only, 20-shot Cinema Studio list |

## Creator Research

### River Cody (Primary Style Influence)

- Source: [3 VFX Tricks - Mixing AI with Real Footage](https://www.youtube.com/watch?v=3I2jj6HA3p0)
- The "River Cody move": brief fourth-wall break commenting on absurdity without undercutting information
- Deadpan humor that lands harder because of serious setup
- Referenced in `chainsaw-video-plan.md` as narrative style model

### Blake Ridder (Cinematography Influence)

- Color grading approach: emotional arc across video (cool/desaturated for tension, warm for resolution)
- Real cinematography craft enhanced by AI, not replaced
- Referenced in `chainsaw-video-plan.md` for color grading strategy

## Voice and Humor

Jordan's natural humor style, calibrated from the chainsaw video and production guides:

- **Deadpan asides**: "Yeah." / "I'll give them that." Brief, dry commentary
- **Audience acknowledgment**: "trust your instincts" - directly addressing what the viewer is thinking
- **CTA as comedy**: Make the call-to-action entertaining, never begging
- **Never mug for camera** or add sound effects to humor moments
- **Humor lives inside narrative**, not on top of it
- **Formula**: Serious setups earn the humor. Humor earns trust. Trust earns the takeaway.

## Production Methodology

### Batch-by-Category Model

| Phase | Activity | Time | Output |
|-------|----------|------|--------|
| Voiceover Night | Record all scripts for one audience category (5-8 videos) | 45-60 min | Audio files |
| Generation Night | Cinema Studio shots + Remotion graphics | 60-90 min | Video clips + graphics |
| Assembly Night | CapCut editing, captioning, export | 60-90 min | 5-8 final videos |

Per video: ~20-30 min total. Per month (8 sessions): 24-40 videos. Entire 57-video library: 6-8 weeks of evening sessions.

### Dual Production Models

1. **Hybrid** (filmed + AI enhanced): You on camera, AI enhances visuals/environments. Higher personality, longer production.
2. **Full AI-generated**: Voiceover only, Cinema Studio visuals, no filming. Faster production, scalable to series.

### Content Pillars

- **Educate**: Explainers, demos, "what is..." (position as expert)
- **Inspire**: Patient stories, transformations (emotional connection)
- **Engage**: Myth busters, Q&A, trends (community interaction)
- **Showcase**: Office tours, services, team (highlight practice)
- **Personal**: Behind-the-scenes, day in life (build trust)

### Platform Optimization

- **Instagram Reels**: 15-30s, 9:16, hook in first 1-2s, slower cuts outperform rapid cuts. 4-5/week.
- **TikTok**: 6-15s micro-content (Format F), text-heavy overlays, trending sounds. 3-5/week.
- **YouTube Shorts**: Up to 60s, slightly longer and more educational. 2-3/week.
- **YouTube Long-form**: 3-10 min, pattern: you speaking (real)  > Remotion graphic > B-roll (AI/enhanced) > back to you. 1/week.

## Key Commands

```bash
npm run install-skills   # Symlink skills to ~/.claude/skills/
npm run uninstall-skills # Remove symlinks
npm run new-industry     # Scaffold a new industry pack
npm run preview          # Remotion preview
npm run render           # Remotion render
npm run typecheck        # TypeScript check (Remotion)
npm run dashboard        # Start dashboard (port 3001)
npm run test:skills      # Run last30days Python tests
```

## Adding a New Industry

```bash
bash scripts/new-industry.sh dental
```

Then edit:
1. `industries/dental/config.json` - Audiences, conditions, platforms
2. `industries/dental/brand.md` - Voice, tone, content rules
3. `industries/dental/content-library.md` - Video scripts using formats A-G
4. `skills/brand-factory/presets/dental.md` - Brand colors, typography, design tokens

## n8n Automation

Instance: `https://n8n.srv1290877.hstgr.cloud` (via MCP)

| Workflow | ID | Trigger | Purpose |
|----------|----|---------|---------|
| Content Intelligence - Weekly Digest | D0jO8S647x12BxCg | Weekly (Monday 8am) | Searches for trending niche content, extracts patterns, generates markdown digest |
| Watchlist Intelligence | sQXCCmZ7HspGFJME | Weekly (Wednesday 8am) | Monitors watchlist creators, finds non-obvious opportunities via cross-niche analysis, self-improves by reading previous outputs |
| Carousel & Thumbnail Generator | 2RVLLlgoDcr7hs4f | Friday 8am / On demand | Generates branded carousel slides and YouTube thumbnails from HTML templates |

The n8n instance is connected via MCP tools for workflow management. Workflows complement the Claude skills pipeline by automating periodic research tasks.

## Carousel & Thumbnail Pipeline

Self-improving carousel generation system using n8n workflows and autoresearch optimization loops.

### Architecture

```
Dashboard "Generate Carousel" ──POST──> n8n Webhook (/carousel-generate)
                                              │
Weekly Schedule Trigger ──────────────────────┘
                                              ▼
                                  [Code: Build Slide HTML from templates]
                                              ▼
                                  [HTML-to-Image rendering]
                                              ▼
Dashboard receives images ──> data/carousel-images/ ──> SQLite tracking
                                              │
                          Publish ──> Collect metrics ──> Autoresearch loop
```

### Platform Dimensions

| Platform | Aspect | Width | Height |
|----------|--------|-------|--------|
| Instagram (square) | 1:1 | 1080 | 1080 |
| Instagram (portrait) | 4:5 | 1080 | 1350 |
| LinkedIn | 1:1 | 1080 | 1080 |
| TikTok | 9:16 | 1080 | 1920 |
| YouTube thumbnail | 16:9 | 1280 | 720 |

### Key Files

| File | Purpose |
|------|---------|
| `packages/dashboard/server/routes/carousels.ts` | CRUD + generation + metrics routes |
| `packages/dashboard/server/carousel-templates/` | Editable HTML/CSS templates (autoresearch asset) |
| `packages/dashboard/server/carousel-templates/config.json` | Template variables (font sizes, spacing, colors) |
| `packages/dashboard/components/CarouselsTab.tsx` | Carousel generation UI in VideoDetail |
| `packages/dashboard/components/ui/CarouselPreview.tsx` | Slide viewer with lightbox |
| `industries/chiropractic/carousel-strategy.md` | Content strategy rules (autoresearch asset) |
| `industries/chiropractic/carousel-optimizer/` | Autoresearch loop configurations |

### API Routes

- `GET /api/carousels` - List with filters (?videoCode, ?platform, ?status)
- `GET /api/carousels/:id` - Single carousel with slides
- `POST /api/carousels/generate` - Create and trigger n8n generation
- `POST /api/carousels/:videoCode/from-script` - Auto-extract from video script
- `POST /api/carousels/ingest` - Receive images from batch workflow
- `DELETE /api/carousels/:id` - Remove carousel + images
- `GET /api/carousels/templates` - Serve current templates + strategy for n8n
- `GET /api/carousels/metrics/score` - Composite engagement score (autoresearch verify)
- `GET /api/carousels/metrics/by-version` - Performance by template/strategy version
- `GET /api/carousels/experiments` - Experiment log for autoresearch

### Autoresearch Self-Improving Loops

Two optimization loops, each with its own editable asset and scalar metric:

**Template Loop** (`carousel-optimizer/template-loop.md`):
- Asset: `packages/dashboard/server/carousel-templates/**`
- Metric: `curl -s http://localhost:3001/api/carousels/metrics/score | jq '.compositeScore'`
- Optimizes: font sizes, colors, spacing, gradients, CTA styling

**Strategy Loop** (`carousel-optimizer/strategy-loop.md`):
- Asset: `industries/chiropractic/carousel-strategy.md`
- Metric: same composite score filtered by strategy version
- Optimizes: hook rankings, slide counts, copy length, CTA wording, content structure

Composite score formula: `save_rate*0.4 + share_rate*0.3 + engagement*0.2 + ctr*0.1`

### SQLite Tables

- `generated_carousels` - Carousel metadata, version stamps, composite scores
- `carousel_slides` - Individual slide records with image paths

## Git

- Remote: `https://github.com/jordanh106/content-engine.git`
- Branch: `main`

## Conventions

- No emdashes in any generated content. Use commas, periods, or restructure.
- Patient/customer-facing content: warm, educational, empowering
- Video scripts include delivery cues in brackets: `[Warm, empathetic]`
- Cinema Studio prompts always specify: camera body, lens, focal length, genre
- Exercise instructions always include frequency and difficulty level
- Organize content by audience segment (life stage, demographic, etc.)
- Dashboard components are single-file with co-located logic
- Types live in `shared/types.ts` within each package
- Schema changes go in `shared/schema.ts`
- Prefer editing existing files over creating new ones
