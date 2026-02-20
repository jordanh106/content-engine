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

## Skills

| Skill | Invocation | Purpose |
|-------|-----------|---------|
| last30days | `/last30days [topic]` | Research trending topics on Reddit + X + Web from last 30 days |
| remotion-best-practices | Auto-loaded when working with Remotion | Domain knowledge for Remotion video creation |
| brand-factory | Auto-loaded when applying brand | Industry-specific brand colors, typography, voice |
| theme-factory | `/theme-factory` | 11 pre-set styling themes for artifacts |
| content-planner | `/content-planner` | Research output to weekly content calendar |
| video-director | `/video-director` | Calendar entry to full production plan |

### Skill Pipeline
```
/last30days → /content-planner → /video-director → Remotion (primary graphics) + Cinema Studio (footage) → Assembly
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

**Phases 2-5 PENDING**:
- Phase 2: Pipeline Board (kanban with @dnd-kit drag-to-advance, DashboardHome with StatCards, Tonight's Session recommendation)
- Phase 3: Session Planner (batch production checklist with timer, auto-advance status on completion)
- Phase 4: Calendar (week/month views across IG Reels / YT Shorts / YT Long, gap detection, drag-to-reschedule)
- Phase 5: Metrics (manual metric entry, Recharts charts, top performers)

### Dashboard Architecture

```
content-library.md  ──parser──→  Video data (scripts, shots, tags, format)
config.json         ──parser──→  Audiences, conditions, platforms
production-plans/   ──parser──→  Generated production plans
                                         ↓
                               Express API enriches with:
                                         ↓
SQLite DB           ──query──→   Status, dates, calendar, sessions, metrics
```

### SQLite Tables

- `video_status` - Production status per video (SCRIPTED → RECORDING → GENERATING → ASSEMBLED → SCHEDULED → PUBLISHED)
- `status_history` - Audit trail of status changes
- `calendar_entries` - Publishing schedule (date, platform, video_code)
- `production_sessions` - Batch session tracking (type, duration, videos completed)
- `session_items` - Checklist items within a session
- `performance_metrics` - Post-publish metrics (views, likes, saves, shares, comments)

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
