# Content Engine Dashboard Guide

Your complete reference for using the Content Engine Dashboard to research, plan, produce, publish, and measure short-form video content.

The dashboard runs at `http://localhost:3001`. Start it with `npm run dashboard` from the repo root.

---

## Navigation

The sidebar organizes everything into four groups that mirror your workflow:

| Group | Views | Purpose |
|-------|-------|---------|
| **Discover** | Opportunities, Ideas, Watchlist | Find what to make |
| **Produce** | Library, Pipeline, Session | Make it |
| **Publish** | Calendar, Captions | Ship it |
| **Measure** | Metrics | Learn from it |

**Home** is always accessible at the bottom of the sidebar. The **Vault** opens as a slide-out panel (not a page).

On mobile, the bottom tab bar shows Home, Library, Pipeline, and Metrics. Tap "More" for everything else.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+K` | Command palette (search videos, ideas, creators, hooks, or jump to any view) |
| `1`-`9` | Direct navigation (1=Home, 2=Opportunities, 3=Ideas, 4=Library, 5=Pipeline, 6=Session, 7=Calendar, 8=Captions, 9=Metrics) |
| `V` | Toggle Vault panel |
| `W` | Go to Watchlist |

---

## The Workflow

Content moves through five phases. Each phase has dedicated views in the dashboard.

```
Research          Plan            Produce          Publish          Measure
(what to make)    (shape it)      (build it)       (ship it)        (learn)
     |                |               |                |               |
Opportunities    Ideas           Pipeline         Calendar         Metrics
Watchlist        Library         Sessions         Captions         Insights
Creator Intel    Calendar        Video Detail     Publish Tab      Benchmarks
n8n Automation   Concept Score   Produce Tab
                 Storyboard
```

You do not have to follow this linearly. Jump to wherever your current work needs you.

---

## 1. Research & Discovery

### Opportunities

**What it does:** Scores potential content topics across seven dimensions and ranks them by overall potential.

**The seven dimensions:**
- Audience Demand (25%) - how much your audience wants this
- Competition Gap (20%) - whether competitors have covered it
- Trend Momentum (15%) - current search/social interest
- Format Fit (10%) - how well it maps to your video formats
- Hook Availability (10%) - whether strong hooks exist for it
- Platform Alignment (10%) - fit with your target platforms
- Audience Diversity (10%) - reaches underserved audience segments

**How to use it:**
- Sort by any dimension to find specific strengths (e.g., sort by Competition Gap to find topics no one covers)
- Each opportunity shows evidence sources (Reddit threads, X posts, web data) with links
- Click "Add to Ideas" to move a high-scoring opportunity into your idea bank for development
- If the data feels stale, the view warns you and suggests refreshing with `/last30days`

### Watchlist

**What it does:** Tracks competitors and inspiration creators across platforms.

**How to use it:**
- Add creators you want to monitor (handle, platform, why you track them, how often to check)
- Click "Analyze" on any creator to run a deep analysis (hook styles, posting frequency, format preferences, content gaps)
- View analyzed creators' profiles to see their patterns, top-performing content, and hooks worth adapting
- Check the "Blue Ocean" section for topics competitors cover that you don't (content gaps)
- The "Rising Creators" section surfaces new players from automated watchlist intelligence

**Benchmarking:** Compare your metrics (avg views, engagement rate, save rate, posts/week) against creators on your watchlist.

### Automated Research (n8n)

Two workflows run automatically in the background:

- **Content Intelligence (Mondays):** Searches trending topics across Reddit, X, and the web. Generates a weekly digest that feeds Opportunities.
- **Watchlist Intelligence (Wednesdays):** Monitors your tracked creators, finds cross-niche opportunities, and surfaces rising creators.

Both outputs appear in their respective views automatically. No manual action needed.

### Claude Code Skills

Run these from the terminal for deeper research:

| Command | What it does |
|---------|-------------|
| `/last30days [topic]` | Research trending topics from the last 30 days across Reddit, X, and the web |
| `/viral-scout [niche]` | Find top-performing niche content across platforms and extract patterns |
| `/creator-analysis @handle` | Deep-dive on a specific creator's patterns, hooks, and formats |
| `/content-planner` | Turn research into a weekly content calendar with format assignments |
| `/video-director` | Convert a calendar entry into a full production plan |

---

## 2. Planning

### Ideas

**What it does:** Your staging area for content ideas before they become scripts.

**Categories:** Trending, Competitor, Evergreen, Audience, Personal, Archived. Use the filter chips to focus.

**How to use it:**
- Browse existing ideas from the idea bank
- Use the "Generate Ideas" button for AI-powered brainstorming. The AI considers your existing library, research data, and audience segments to suggest novel ideas
- Each idea shows: topic, suggested format (A-G), hook angle, priority level, and source
- Click any idea to develop it further, edit details, or archive it
- "Sync n8n" pulls in new ideas discovered by your automated research workflows

**Concept Scoring:** When developing an idea, you can generate a one-sentence concept and score it on four dimensions:
- Technical Interest (surprising facts or counterintuitive angle)
- Emotional Resonance (connects to viewer feelings)
- 10-Second Explainability (understood immediately)
- Visual Payoff (something satisfying to see)

Ideas scoring 7+ are auto-approved. Lower scores get AI feedback on how to strengthen them.

### Content Library

**What it does:** Browse your complete library of 57 production-ready video scripts.

**Filters:**
- By audience segment (7 audiences)
- By format (A-G: Explainer, Checklist, Demo, Myth Buster, Walkthrough, Quick Tip, Patient Story)
- By production style (Real, Enhanced, Heavy AI, Full AI)
- By search (title, code, tags, script content)

**How to use it:**
- Click any video card to open the Video Detail panel
- Cards show the video code, title, format, audience, duration, and current production status
- Sort by audience, alphabetically, by format, or by duration

### Calendar

**What it does:** Schedule content across platforms with cadence tracking.

**Platforms:** Instagram Reels, YouTube Shorts, TikTok, YouTube Long-form, IG Stories.

**Views:** Toggle between week and month view.

**How to use it:**
- Click the `+` on any day/platform cell to schedule a video
- Assign a video code from your library, or leave it as a placeholder slot
- Amber highlights show cadence gaps (you're posting below your target frequency for that platform)
- Add notes to entries for posting reminders
- Edit or delete entries as plans change

**Cadence targets** (from your config):
- Instagram Reels: 4-5/week
- TikTok: 3-5/week
- YouTube Shorts: 2-3/week
- YouTube Long-form: 1/week

---

## 3. Production

### Pipeline Board

**What it does:** Kanban board tracking every video through six production stages.

**Stages:**
```
SCRIPTED -> RECORDING -> GENERATING -> ASSEMBLED -> SCHEDULED -> PUBLISHED
```

**How to use it:**
- **Desktop:** Drag cards between columns to advance their status
- **Mobile:** Tap a column to expand it, then use the "Move to [NEXT]" button
- **Bulk actions:** Click the checkbox on multiple cards, then use the bulk action bar to move them all at once
- **Filters:** Narrow by format, audience, or production style

**Quality Gates:** When you advance a video, a checklist modal appears with items to verify before moving forward. For example, moving from RECORDING to GENERATING checks that footage is captured, voiceover is done, and audio quality is verified. You can skip the gate if needed, but critical items are flagged in amber.

Each pipeline card shows a thin progress bar at the bottom indicating quality gate completion (teal = in progress, green = 100%).

### Production Styles

Every video gets assigned a production style that determines what checklists, tips, and guidance the app provides.

| Style | What it means | When to use it |
|-------|--------------|----------------|
| **Real** | You on camera, no AI generation | Talking-head content, demos, personal stories |
| **Enhanced** | Real footage + subtle AI polish | Most content. Film yourself, then enhance backgrounds, add camera moves, extend scenes |
| **Heavy AI** | Film the hook only, AI does the rest | Complex visual content where you appear in the hook/CTA but AI handles the body |
| **Full AI** | Voiceover only, all AI visuals | Scalable content. Record audio, AI generates all visuals via Cinema Studio |

Assign the production style in the Video Detail panel's Info tab. This choice cascades through the entire production workflow (checklists, shot guidance, quality gates).

### Video Detail Panel

Click any video in the Library or Pipeline to open the detail panel. It has eight tabs:

**Script** - Full script with delivery cues in brackets like `[Warm, empathetic]`. Platform adaptation controls let you see how the script works at different lengths (6s TikTok vs 60s YouTube). Use "Analyze Script" for AI feedback on voice, hook, tone, and structure.

**Shots** - Cinema Studio shot list with copy-to-clipboard prompts. Use "Copy All Prompts" to batch import into Cinema Studio.

**Timeline** - Visual timeline of shot sequencing with format timing breakdown.

**Produce** - Your live production companion (see next section).

**Storyboard** - AI-generated shot-by-shot breakdown (see Storyboard section below).

**Publish** - Generate virality scores (5 dimensions), thumbnail concepts, and platform-specific captions. View calendar status per platform. Mark as Published when posted.

**Waterfall** - Track derived content (cutdowns, shorts, text versions) from a source video across tiers and platforms.

**Info** - Set production style, view tags, format, audience, and add notes.

### Produce Tab (Production Companion)

**What it does:** Transforms your storyboard into a step-by-step production guide you can follow on your phone while filming.

**Three sections:**

**Pre-Production Checklist** - Items to verify before you start. Varies by production style:
- Real: tripod ready, lighting check, audio test, background clean, script rehearsed
- Enhanced: all of the above + reference frame for color matching, extra wide shots for scene extension
- Heavy AI: audio test, hook filmed, cinema defaults confirmed, prompts drafted
- Full AI: quiet room, consistent mic distance, script timing matched

**Shot-by-Shot Cards** - One card per storyboard shot. Each shows:
- Shot number, act (hook/conflict/build/resolution/CTA), duration
- Production method badge (Film, AI Enhanced, AI Generated, Motion Graphic)
- Script line for that shot
- Filming tips specific to the production method
- Tool recommendation (Cinema Studio, Mixed Media, Remotion)
- AI model recommendation (Sora 2 for hero shots, Minimax for iteration)
- Suggested camera movement with reasoning
- VFX trick suggestion (Scene Extension, Impossible Camera Moves, Environment Enhancement)
- Color grade notes
- Cinema Studio prompt (with copy button)
- Completion checkbox (large 44px tap target for mobile use)

**Post-Production Checklist** - Quality checks after editing. For Enhanced style, this includes seamlessness verification ("Watch full edit on phone at 1x speed, can you spot AI?"), color temperature consistency, and motion tracking checks.

Mark items complete as you go. Completion percentages persist across sessions.

### Storyboards

**What it does:** AI generates a shot-by-shot production plan from your script.

**How to use it:**
1. Open a video's Storyboard tab
2. Optionally select a Visual Style from the Vault to apply consistent aesthetics
3. Click "Generate Storyboard"
4. The AI creates shots mapped to a 5-act structure (hook, conflict, build, resolution, CTA), respecting your assigned production style

Each shot specifies:
- Duration and act placement
- Production method (real, AI enhanced, AI generated, motion graphic)
- Camera movement and shot type
- Cinema Studio prompt (for AI shots)
- B-roll type (macro, process, reveal)
- Remotion component (for motion graphics)
- Enhancement notes (for AI-enhanced shots)

**Technique context badges** appear inline on each shot card:
- Camera defaults badge (camera body, lens, focal length) for AI-generated shots
- Tool + model badge (recommended Higgsfield tool and AI model)
- Movement suggestion if the current movement differs from what the system recommends

You can edit individual shots, change production methods, or ask AI to suggest the best enhancement technique for any shot.

### Sessions

**What it does:** Batch production sessions with a timer for efficient recording nights.

**Three session types:**
- **Voiceover:** Record scripts for SCRIPTED videos (advances to RECORDING)
- **Generation:** Create AI graphics for RECORDING videos (advances to GENERATING)
- **Assembly:** Final cuts for GENERATING videos (advances to ASSEMBLED)

**How to use it:**
1. Pick a session type
2. Choose from smart batch recommendations (e.g., "5 prenatal videos, estimated 40 min") or select videos manually
3. Start the session. The timer begins
4. Work through the checklist. Mark each video complete as you finish it
5. Completing a video auto-advances its pipeline status
6. End the session to see your summary (total time, videos completed)

Past sessions are logged with duration and completion stats.

---

## 4. Publishing

### Publish Tab (in Video Detail)

Before scheduling, use the Publish tab on any video to:

- **Virality Score:** AI scores your video across five dimensions (hook strength, topic relevance, format fit, shareability, platform potential). Use this to prioritize which videos to publish first.
- **Thumbnail Concepts:** AI generates text overlay, expression, background, and color scheme suggestions for thumbnails.
- **Platform Captions:** Generate and review captions for each platform directly from this tab.
- **Calendar Status:** See which platforms this video is scheduled for and identify gaps.

### Captions Studio

**What it does:** AI-generated captions optimized for each platform's constraints and audience behavior.

**Platforms and limits:**
- Instagram Reels: 2,200 chars (first 125 visible)
- TikTok: 4,000 chars (first 100 visible)
- YouTube Shorts: 100 chars
- YouTube Long-form: 5,000 chars (first 200 visible)

**How to use it:**
1. Select a video by code
2. Click "Generate All" to create captions for all four platforms simultaneously
3. Each caption gets a quality score (hook strength, CTA clarity, readability, hashtag quality, emoji usage, length optimization)
4. Edit captions inline, save variants for A/B testing
5. Mark captions as "approved" or "posted" as you publish

The AI uses your brand voice, hook patterns from the Vault, and format-specific guidelines to write platform-native captions.

---

## 5. Measuring

### Metrics

**What it does:** Track post-publish performance and surface actionable insights.

**Manual entry:** After publishing, log views, likes, saves, shares, and comments per video per platform.

**Charts:**
- Average views by format (which formats perform best)
- Engagement rate by format
- Save rate by format (saves indicate "reference" value)
- Views distribution by platform
- Posting frequency over time
- Engagement trends

**Top Performers Table:** Sorted by total views, showing format, audience, platform, and rates.

**AI Insights:** The system generates four types of intelligence from your metrics:
- **Wins:** What's working ("Format B gets 3x more saves on Instagram")
- **Opportunities:** What to try ("Your TikTok engagement is 40% below your IG, try shorter hooks")
- **Trends:** Directional patterns ("Save rates are climbing week-over-week")
- **Recommendations:** Specific actions ("Double down on Format A for YouTube Shorts")

**Velocity Metrics:** Average days between pipeline stages, bottleneck identification (which stage videos get stuck in).

**Cadence Tracking:** Posts per week by platform vs. your targets.

---

## 6. Power Features

### Vault

Open with `V` or from the command palette. A slide-out panel with three sections:

**Hooks** - Your hook pattern library.
- Library hooks come from `hook-patterns.md` (read-only, blue badges)
- Custom hooks are ones you create or extract (editable, green badges)
- Each hook is a Mad Lib template with `[VARIABLE]` placeholders (e.g., "Did you know [SURPRISING FACT] can [UNEXPECTED OUTCOME]?")
- Filter by category (question, statistic, myth, emotional, did-you-know, pattern interrupt), format, platform, or what it optimizes
- "Extract Pattern" lets you paste raw hook text and AI converts it to a reusable template
- "Adapt" generates niche variations of any hook
- Usage tracking shows which hooks you use most

**Styles** - Reusable writing styles extracted from creator transcripts.
- Paste a transcript, AI extracts concrete rules: sentence length, tone, structure, techniques, things to avoid
- Save styles and apply them when generating scripts
- Each style produces an example script showing the rules in action

**Visual Styles** - Composite visual guides built from video breakdowns.
- After analyzing creator videos (deep DNA breakdowns covering typography, color, transitions, set design, music), select 2-3 breakdowns
- AI synthesizes them into a unified visual style with exact hex colors, pixel sizes, timing rules
- Apply visual styles when generating storyboards for consistent aesthetics across videos

### Command Palette (Cmd+K)

Fast access to everything:
- Search videos by code or title
- Search ideas by topic
- Search creators on your watchlist
- Search hooks in the Vault
- Quick navigation to any view
- Launch Claude Code skills

### Notifications

The bell icon (top-right on desktop) shows production alerts:
- Videos stuck in a stage for more than 14 days
- Platform cadence gaps (falling behind posting targets)
- Stale research data (research older than 14 days)
- Session completions
- New opportunities discovered
- n8n sync results
- Watchlist intelligence updates

Click any notification to navigate directly to the relevant view.

### Content Waterfall

Track how a single source video generates derivative content across platforms and tiers:
- Tier 1: Hero video (full production)
- Tier 2: Platform-specific cutdowns
- Tier 3: Micro-content (clips, quotes)
- Tier 4: Text/image derivatives

Each derivative tracks its own status from idea through published.

### Search

`Cmd+K` or the search bar searches across all data sources simultaneously: videos, ideas, creators, hooks. Results are grouped by type with direct navigation.

---

## 7. Tips & Best Practices

### Choose the Right Production Style

| If you want... | Use |
|----------------|-----|
| Maximum authenticity and personality | Real |
| Professional look without losing authenticity | Enhanced |
| Complex visuals with your face in hook/CTA | Heavy AI |
| Scalable content production (10+ videos/week) | Full AI |

Start with **Enhanced** for most content. It gives you the best balance of authenticity and production value.

### Batch by Category

The most efficient production model:

| Session | What you do | Time | Output |
|---------|------------|------|--------|
| Voiceover Night | Record scripts for one audience category (5-8 videos) | 45-60 min | Audio files |
| Generation Night | Cinema Studio shots + Remotion graphics | 60-90 min | Video clips + graphics |
| Assembly Night | CapCut editing, captioning, export | 60-90 min | 5-8 final videos |

Per video: ~20-30 min total. Per month (8 sessions): 24-40 videos.

Use the **Session** view to plan and time these batches.

### Quality Gate Discipline

Quality gates are non-blocking (you can always skip), but treating them seriously prevents "AI slop":

- **SCRIPTED to RECORDING:** Make sure a production style and storyboard are set. This determines everything downstream.
- **RECORDING to GENERATING:** Verify audio quality before investing time in AI generation. Bad audio ruins everything.
- **GENERATING to ASSEMBLED:** The seamlessness check matters most. Watch your edit at 1x speed on your phone. If you can spot the AI, fix it.
- **ASSEMBLED to SCHEDULED:** Final review + captions. This is your last chance before it goes public.

### Suggested Weekly Routine

| Day | Activity | Views to use |
|-----|----------|-------------|
| Monday | Review n8n digest, check Opportunities, add to Ideas | Home, Opportunities, Ideas |
| Tuesday | Develop top ideas, assign formats, generate storyboards | Ideas, Library, Video Detail |
| Wednesday | Voiceover session (batch 5-8 scripts) | Session, Pipeline |
| Thursday | Review watchlist intel, analyze a competitor | Watchlist |
| Friday | Generation session (Cinema Studio + Remotion) | Session, Pipeline |
| Saturday | Assembly session (CapCut editing) | Session, Pipeline |
| Sunday | Schedule week's content, generate captions, log metrics | Calendar, Captions, Metrics |

### The Anti-Slop Checklist

For Enhanced and Heavy AI videos, verify these before publishing:
1. Watch the full edit on your phone at 1x speed. Can you spot where AI begins?
2. Color temperature is consistent across real and AI shots
3. AI elements track naturally with camera movement
4. Upscaled phone footage matches AI segment resolution
5. Voiceover timing matches visual pacing
6. Cut points between real and AI feel natural

These items appear automatically in your Produce tab's post-production checklist when using Enhanced or Heavy AI styles.
