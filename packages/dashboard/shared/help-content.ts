import type { DashboardView, TourStep, ChecklistItem, ChangelogEntry } from "../shared/types.js";

// ============================================
// Field Manual Types & Content
// ============================================

export type GuideBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "tip"; label: string; text: string }
  | { type: "shortcut"; keys: string[]; description: string }
  | { type: "steps"; title: string; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; variant: "info" | "warning" | "success"; text: string }
  | { type: "navigate"; label: string; targetView: DashboardView };

export type GuideSection = {
  id: string;
  title: string;
  phase: "discover" | "produce" | "publish" | "measure" | "reference";
  relatedView: DashboardView | null;
  summary: string;
  content: GuideBlock[];
  keywords: string[];
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    phase: "reference",
    relatedView: "HOME",
    summary: "Overview of the workflow and how the dashboard is organized.",
    keywords: ["overview", "workflow", "navigation", "start", "begin", "intro"],
    content: [
      { type: "paragraph", text: "The dashboard organizes your content creation workflow into four phases: Discover (find what to make), Produce (make it), Publish (ship it), and Measure (learn from it). Each phase has dedicated views accessible from the sidebar." },
      { type: "heading", text: "The Content Lifecycle" },
      { type: "steps", title: "Your workflow flows through 5 stages:", items: [
        "Research: Use Opportunities and Watchlist to find trending topics and competitor gaps",
        "Plan: Develop ideas, assign formats (A-G), generate storyboards, and schedule on the calendar",
        "Produce: Record voiceovers, generate AI visuals, and assemble final cuts in batch sessions",
        "Publish: Generate platform-specific captions, score virality, and post to all platforms",
        "Measure: Log performance metrics, review AI insights, and feed learnings back into research",
      ]},
      { type: "callout", variant: "info", text: "You do not have to follow this linearly. Jump to wherever your current work needs you." },
      { type: "navigate", label: "Go to Home", targetView: "HOME" },
    ],
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    phase: "reference",
    relatedView: null,
    summary: "Quick keys to navigate the dashboard without a mouse.",
    keywords: ["keyboard", "shortcut", "hotkey", "key", "cmd", "ctrl"],
    content: [
      { type: "shortcut", keys: ["Cmd", "K"], description: "Open Command Palette (search anything)" },
      { type: "shortcut", keys: ["?"], description: "Open this Field Manual" },
      { type: "shortcut", keys: ["V"], description: "Toggle Vault panel (hooks & styles)" },
      { type: "shortcut", keys: ["W"], description: "Go to Watchlist" },
      { type: "heading", text: "Number Keys" },
      { type: "table", headers: ["Key", "View"], rows: [
        ["1", "Home"], ["2", "Opportunities"], ["3", "Ideas"], ["4", "Library"],
        ["5", "Pipeline"], ["6", "Session"], ["7", "Calendar"], ["8", "Captions"], ["9", "Metrics"],
      ]},
      { type: "callout", variant: "info", text: "Number keys only work when you are not typing in a text input." },
    ],
  },
  {
    id: "opportunities",
    title: "Opportunities",
    phase: "discover",
    relatedView: "OPPORTUNITIES",
    summary: "AI-scored content topics ranked by 7 weighted dimensions.",
    keywords: ["opportunities", "scoring", "trends", "demand", "competition", "discover"],
    content: [
      { type: "paragraph", text: "Opportunities scores potential topics across seven dimensions and ranks them by overall potential. Use this to find the highest-impact content to create next." },
      { type: "heading", text: "The 7 Dimensions" },
      { type: "table", headers: ["Dimension", "Weight"], rows: [
        ["Audience Demand", "25%"], ["Competition Gap", "20%"], ["Trend Momentum", "15%"],
        ["Format Fit", "10%"], ["Hook Availability", "10%"], ["Platform Alignment", "10%"], ["Audience Diversity", "10%"],
      ]},
      { type: "tip", label: "Sort by dimension", text: "Click any dimension header to sort. Sort by Competition Gap to find topics no one else covers." },
      { type: "steps", title: "How to use:", items: [
        "Review the top-scored opportunities",
        "Check evidence sources (Reddit threads, X posts, web articles)",
        "Click 'Add to Ideas' to move a topic into the Idea Bank for development",
      ]},
      { type: "callout", variant: "warning", text: "If data feels stale, the view warns you. Refresh with /last30days in Claude Code." },
      { type: "navigate", label: "Go to Opportunities", targetView: "OPPORTUNITIES" },
    ],
  },
  {
    id: "ideas",
    title: "Idea Bank",
    phase: "discover",
    relatedView: "IDEAS",
    summary: "Stage and develop content ideas before they become scripts.",
    keywords: ["ideas", "brainstorm", "generate", "concept", "scoring", "n8n"],
    content: [
      { type: "paragraph", text: "Your staging area for content ideas. Ideas come from research, competitor analysis, automated n8n workflows, or manual entry." },
      { type: "heading", text: "Categories" },
      { type: "paragraph", text: "Trending (hot now), Competitor (from watching others), Evergreen (always relevant), Audience (from questions/pain points), Personal (your ideas), Archived." },
      { type: "heading", text: "AI Idea Generation" },
      { type: "paragraph", text: "Click 'Generate Ideas' for AI-powered brainstorming. The AI considers your existing library, research data, and audience segments to suggest novel ideas with suggested formats and hook angles." },
      { type: "heading", text: "Concept Scoring" },
      { type: "paragraph", text: "When developing an idea, generate a one-sentence concept scored on 4 dimensions: Technical Interest, Emotional Resonance, 10-Second Explainability, and Visual Payoff. Ideas scoring 7+ are auto-approved." },
      { type: "tip", label: "Sync n8n", text: "'Sync n8n' pulls new ideas discovered by your automated weekly digest workflow. Only adds ideas not already in the bank." },
      { type: "navigate", label: "Go to Ideas", targetView: "IDEAS" },
    ],
  },
  {
    id: "watchlist",
    title: "Watchlist",
    phase: "discover",
    relatedView: "WATCHLIST",
    summary: "Track competitors and inspiration creators across platforms.",
    keywords: ["watchlist", "competitors", "creators", "analysis", "benchmark", "blue ocean"],
    content: [
      { type: "paragraph", text: "Monitor creators you want to learn from or compete with. Run deep analysis, compare benchmarks, and find content gaps." },
      { type: "steps", title: "Key features:", items: [
        "Add creators with handle, platform, and why you track them",
        "Click 'Analyze' to run deep creator analysis (hook styles, formats, posting frequency)",
        "View 'Blue Ocean' topics: content gaps your competitors cover but you don't",
        "Compare your metrics against competitors in the Benchmarking section",
        "Check 'Rising Creators' from automated watchlist intelligence",
      ]},
      { type: "tip", label: "Creator Videos", text: "Expand a creator to see their individual videos with outlier detection (which videos vastly outperformed their average)." },
      { type: "navigate", label: "Go to Watchlist", targetView: "WATCHLIST" },
    ],
  },
  {
    id: "library",
    title: "Content Library",
    phase: "produce",
    relatedView: "LIBRARY",
    summary: "Browse all 57 production-ready video scripts with filters and search.",
    keywords: ["library", "videos", "scripts", "browse", "filter", "formats", "content"],
    content: [
      { type: "paragraph", text: "Your complete library of video scripts. Each video has a code (e.g., A01), format, audience segment, full script, Cinema Studio shot prompts, and production metadata." },
      { type: "heading", text: "Filters" },
      { type: "paragraph", text: "Filter by audience segment, format (A-G), production style (Real/Enhanced/Heavy AI/Full AI), or search across titles, codes, tags, and script content." },
      { type: "heading", text: "Format Codes" },
      { type: "table", headers: ["Code", "Format", "Duration"], rows: [
        ["A", "Explainer", "30-45s"], ["B", "Checklist", "30-45s"], ["C", "Demo", "30-60s"],
        ["D", "Myth Buster", "15-30s"], ["E", "Walkthrough", "45-60s"], ["F", "Quick Tip", "6-15s"], ["G", "Patient Story", "15-30s"],
      ]},
      { type: "tip", label: "Video Detail", text: "Click any card to open the detail panel with 8 tabs: Script, Shots, Timeline, Produce, Storyboard, Publish, Waterfall, and Info." },
      { type: "navigate", label: "Go to Library", targetView: "LIBRARY" },
    ],
  },
  {
    id: "pipeline",
    title: "Pipeline",
    phase: "produce",
    relatedView: "PIPELINE",
    summary: "Kanban board tracking every video through 6 production stages.",
    keywords: ["pipeline", "kanban", "status", "drag", "advance", "stages", "quality gate"],
    content: [
      { type: "heading", text: "The 6 Stages" },
      { type: "paragraph", text: "SCRIPTED (script written) -> RECORDING (voiceover/filming) -> GENERATING (AI graphics + Cinema Studio) -> ASSEMBLED (edited in CapCut) -> SCHEDULED (date set) -> PUBLISHED (live)." },
      { type: "heading", text: "How to advance videos" },
      { type: "steps", title: "", items: [
        "Desktop: Drag cards between columns",
        "Mobile: Tap a column to expand it, use the 'Move to [NEXT]' button",
        "Bulk: Click checkboxes on multiple cards, then use the bulk action bar",
      ]},
      { type: "heading", text: "Quality Gates" },
      { type: "paragraph", text: "When you advance a video, a checklist modal verifies prerequisites. For example, moving RECORDING to GENERATING checks that footage is captured, voiceover is done, and audio quality is verified. You can skip the gate if needed, but critical items are flagged in amber." },
      { type: "tip", label: "Completion bar", text: "Each pipeline card shows a thin progress bar at the bottom indicating quality gate completion." },
      { type: "navigate", label: "Go to Pipeline", targetView: "PIPELINE" },
    ],
  },
  {
    id: "production-styles",
    title: "Production Styles",
    phase: "reference",
    relatedView: null,
    summary: "Four styles that determine checklists, tips, and AI guidance for each video.",
    keywords: ["production", "style", "real", "enhanced", "heavy ai", "full ai", "filming"],
    content: [
      { type: "paragraph", text: "Every video gets assigned a production style that cascades through the entire production workflow: checklists, shot guidance, quality gates, and technique recommendations." },
      { type: "table", headers: ["Style", "Description", "Best For"], rows: [
        ["Real", "You on camera, no AI generation", "Talking-head, demos, personal stories"],
        ["Enhanced", "Real footage + subtle AI polish", "Most content. Film yourself, enhance with AI"],
        ["Heavy AI", "Film the hook only, AI does the rest", "Complex visuals, you appear in hook/CTA only"],
        ["Full AI", "Voiceover only, all AI visuals", "Scalable content (10+ videos/week)"],
      ]},
      { type: "callout", variant: "success", text: "Start with Enhanced for most content. It gives the best balance of authenticity and production value." },
      { type: "tip", label: "Assign early", text: "Set the production style in the Video Detail panel's Info tab. This choice determines all downstream checklists and guidance." },
    ],
  },
  {
    id: "produce-tab",
    title: "Produce Tab",
    phase: "produce",
    relatedView: null,
    summary: "Your live production companion with checklists and shot-by-shot guidance.",
    keywords: ["produce", "companion", "checklist", "filming", "shot cards", "technique", "guidance"],
    content: [
      { type: "paragraph", text: "The Produce tab in Video Detail transforms your storyboard into a step-by-step production guide usable on your phone while filming." },
      { type: "heading", text: "Three Sections" },
      { type: "steps", title: "", items: [
        "Pre-Production Checklist: Items to verify before you start (tripod, lighting, audio, script rehearsal). Varies by production style.",
        "Shot-by-Shot Cards: One card per storyboard shot with technique guidance, tool/model recommendations, camera movement suggestions, VFX tricks, and a completion checkbox.",
        "Post-Production Checklist: Quality checks after editing. For Enhanced style, includes seamlessness verification.",
      ]},
      { type: "tip", label: "Anti-slop check", text: "For Enhanced videos, the post-production checklist asks: 'Watch full edit on phone at 1x speed. Can you spot AI?' This is the most important quality gate." },
      { type: "heading", text: "Shot Card Details" },
      { type: "paragraph", text: "Each shot card shows: production method badge, filming tips, tool recommendation (Cinema Studio, Mixed Media), AI model recommendation (Sora 2 for hero shots, Minimax for iteration), suggested camera movement, VFX trick, color grade notes, and Cinema Studio prompt with copy button." },
    ],
  },
  {
    id: "storyboards",
    title: "Storyboards",
    phase: "produce",
    relatedView: null,
    summary: "AI-generated shot-by-shot breakdown from your script.",
    keywords: ["storyboard", "shots", "generate", "visual style", "acts", "camera"],
    content: [
      { type: "paragraph", text: "The Storyboard tab in Video Detail generates a shot-by-shot production plan from your script. Each shot maps to a 5-act structure (hook, conflict, build, resolution, CTA) and respects your production style." },
      { type: "steps", title: "How to use:", items: [
        "Open a video's Storyboard tab",
        "Optionally select a Visual Style from the Vault for consistent aesthetics",
        "Click 'Generate Storyboard'",
        "Review shots: each specifies duration, act, production method, camera movement, and prompts",
        "Edit individual shots or ask AI to suggest the best technique for any shot",
      ]},
      { type: "heading", text: "Technique Context" },
      { type: "paragraph", text: "Inline badges appear on each shot: camera defaults (body, lens, focal length) for AI-generated shots, tool + model recommendations, and movement suggestions when the current setting differs from the recommended one." },
    ],
  },
  {
    id: "sessions",
    title: "Sessions",
    phase: "produce",
    relatedView: "SESSION",
    summary: "Batch production sessions with a timer for efficient recording nights.",
    keywords: ["session", "batch", "voiceover", "generation", "assembly", "timer", "recording"],
    content: [
      { type: "heading", text: "3 Session Types" },
      { type: "table", headers: ["Type", "Input", "Advances To"], rows: [
        ["Voiceover", "SCRIPTED videos", "RECORDING"],
        ["Generation", "RECORDING videos", "GENERATING"],
        ["Assembly", "GENERATING videos", "ASSEMBLED"],
      ]},
      { type: "steps", title: "How to run a session:", items: [
        "Pick a session type",
        "Choose from smart batch recommendations (e.g., '5 prenatal videos, 40 min') or select manually",
        "Start the session. The timer begins.",
        "Mark each video complete as you finish. It auto-advances in the pipeline.",
        "End the session to see your summary (total time, videos completed).",
      ]},
      { type: "tip", label: "Batch by audience", text: "Recording similar content back-to-back is faster. The recommendations group videos by audience segment." },
      { type: "navigate", label: "Go to Sessions", targetView: "SESSION" },
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    phase: "publish",
    relatedView: "CALENDAR",
    summary: "Schedule content across platforms with cadence tracking.",
    keywords: ["calendar", "schedule", "platform", "cadence", "gaps", "week", "month"],
    content: [
      { type: "paragraph", text: "Week and month views showing what is scheduled across all platforms. Cadence gap warnings appear when you fall below target posting frequency." },
      { type: "heading", text: "Cadence Targets" },
      { type: "table", headers: ["Platform", "Target"], rows: [
        ["Instagram Reels", "4-5/week"], ["TikTok", "3-5/week"], ["YouTube Shorts", "2-3/week"], ["YouTube Long-form", "1/week"],
      ]},
      { type: "steps", title: "How to use:", items: [
        "Click + on any day/platform cell to schedule a video",
        "Assign a video code or leave as placeholder",
        "Amber highlights show cadence gaps",
        "Add notes for posting reminders",
      ]},
      { type: "navigate", label: "Go to Calendar", targetView: "CALENDAR" },
    ],
  },
  {
    id: "captions",
    title: "Caption Studio",
    phase: "publish",
    relatedView: "CAPTIONS",
    summary: "AI-generated captions optimized for each platform's constraints.",
    keywords: ["captions", "hashtags", "instagram", "tiktok", "youtube", "generate", "publish"],
    content: [
      { type: "heading", text: "Platform Limits" },
      { type: "table", headers: ["Platform", "Max Length", "Visible"], rows: [
        ["Instagram Reels", "2,200 chars", "First 125"],
        ["TikTok", "4,000 chars", "First 100"],
        ["YouTube Shorts", "100 chars", "All"],
        ["YouTube Long-form", "5,000 chars", "First 200"],
      ]},
      { type: "steps", title: "How to use:", items: [
        "Select a video by code",
        "Click 'Generate All' to create captions for all platforms simultaneously",
        "Each caption gets a quality score (hook, CTA, readability, hashtags, emoji, length)",
        "Edit inline, save variants for A/B testing",
        "Mark as 'approved' or 'posted'",
      ]},
      { type: "navigate", label: "Go to Captions", targetView: "CAPTIONS" },
    ],
  },
  {
    id: "metrics",
    title: "Metrics",
    phase: "measure",
    relatedView: "METRICS",
    summary: "Track post-publish performance and surface AI-powered insights.",
    keywords: ["metrics", "analytics", "performance", "views", "engagement", "insights", "charts"],
    content: [
      { type: "paragraph", text: "Log performance metrics after publishing, then let the system generate actionable insights from your data." },
      { type: "heading", text: "What to track" },
      { type: "paragraph", text: "Views, likes, saves, shares, and comments per video per platform. Enter manually since platform APIs are not connected." },
      { type: "heading", text: "Charts & Analysis" },
      { type: "steps", title: "", items: [
        "Average views by format (which formats perform best)",
        "Engagement and save rates by format",
        "Views distribution by platform",
        "Top performers table sorted by total views",
      ]},
      { type: "heading", text: "AI Insights" },
      { type: "paragraph", text: "Four types: Wins (what's working), Opportunities (what to try), Trends (directional patterns), Recommendations (specific actions)." },
      { type: "tip", label: "Velocity", text: "Velocity metrics show average days between pipeline stages and identify which stage videos get stuck in." },
      { type: "navigate", label: "Go to Metrics", targetView: "METRICS" },
    ],
  },
  {
    id: "vault",
    title: "Vault",
    phase: "reference",
    relatedView: "VAULT",
    summary: "Reusable hooks, writing styles, and visual styles extracted from winning content.",
    keywords: ["vault", "hooks", "styles", "visual", "extract", "template", "mad lib"],
    content: [
      { type: "paragraph", text: "The Vault stores reusable creative assets: hook templates, writing styles, and visual styles. Open it with the V key or from the sidebar." },
      { type: "heading", text: "Hooks" },
      { type: "paragraph", text: "Hook templates use Mad Lib format with [VARIABLE] placeholders. Library hooks (from hook-patterns.md) are read-only. Custom hooks you add can be edited. Filter by category, format, platform, or optimization goal." },
      { type: "tip", label: "Extract & Adapt", text: "'Extract Pattern' converts raw hook text into a reusable template. 'Adapt' generates niche variations of any hook." },
      { type: "heading", text: "Writing Styles" },
      { type: "paragraph", text: "Paste a creator's transcript and AI extracts concrete rules: sentence length, tone, structure, techniques, things to avoid. Apply saved styles when generating scripts." },
      { type: "heading", text: "Visual Styles" },
      { type: "paragraph", text: "After analyzing creator videos (deep DNA breakdowns), select 2-3 breakdowns and AI synthesizes them into a unified visual style with exact colors, typography, and timing rules. Apply when generating storyboards." },
      { type: "shortcut", keys: ["V"], description: "Toggle Vault panel" },
    ],
  },
  {
    id: "batch-model",
    title: "Batch Production Model",
    phase: "reference",
    relatedView: null,
    summary: "The voiceover/generation/assembly batch system for efficient content creation.",
    keywords: ["batch", "efficient", "evening", "voiceover", "generation", "assembly", "workflow"],
    content: [
      { type: "paragraph", text: "The most efficient way to produce content is in batches grouped by audience category." },
      { type: "table", headers: ["Session", "What You Do", "Time", "Output"], rows: [
        ["Voiceover Night", "Record scripts for one audience (5-8 videos)", "45-60 min", "Audio files"],
        ["Generation Night", "Cinema Studio shots + Remotion graphics", "60-90 min", "Video clips + graphics"],
        ["Assembly Night", "CapCut editing, captioning, export", "60-90 min", "5-8 final videos"],
      ]},
      { type: "callout", variant: "success", text: "Per video: ~20-30 min total. Per month (8 sessions): 24-40 videos." },
      { type: "tip", label: "Use Sessions view", text: "The Sessions view automates this pattern with smart batch recommendations, a timer, and auto-advance on completion." },
      { type: "navigate", label: "Start a Session", targetView: "SESSION" },
    ],
  },
  {
    id: "quality-gates",
    title: "Quality Gates",
    phase: "reference",
    relatedView: null,
    summary: "Non-blocking checklists at each pipeline transition to prevent 'AI slop'.",
    keywords: ["quality", "gate", "checklist", "transition", "slop", "seamless"],
    content: [
      { type: "paragraph", text: "Quality gates appear when advancing a video in the pipeline. They verify prerequisites before moving forward. You can skip them, but critical items are flagged in amber." },
      { type: "heading", text: "Key Transitions" },
      { type: "steps", title: "", items: [
        "SCRIPTED to RECORDING: Production style and storyboard are set",
        "RECORDING to GENERATING: Audio quality verified, all footage captured",
        "GENERATING to ASSEMBLED: Color grade consistent, AI transitions seamless, graphics rendered",
        "ASSEMBLED to SCHEDULED: Final review at 1x speed, captions written, platform exports ready",
        "SCHEDULED to PUBLISHED: Posted to all platforms, hashtags applied",
      ]},
      { type: "callout", variant: "warning", text: "The most important gate: GENERATING to ASSEMBLED. Watch your edit at 1x speed on your phone. If you can spot the AI, fix it before advancing." },
    ],
  },
  {
    id: "automation",
    title: "Automation (n8n)",
    phase: "discover",
    relatedView: null,
    summary: "Two automated workflows that run weekly to feed research into the dashboard.",
    keywords: ["automation", "n8n", "workflow", "weekly", "digest", "intelligence"],
    content: [
      { type: "paragraph", text: "Two n8n workflows run automatically in the background, generating research data that feeds Opportunities and Watchlist views." },
      { type: "table", headers: ["Workflow", "Schedule", "Purpose"], rows: [
        ["Content Intelligence", "Monday 8am", "Searches trending topics on Reddit, X, and web. Generates weekly digest."],
        ["Watchlist Intelligence", "Wednesday 8am", "Monitors tracked creators, finds cross-niche opportunities, surfaces rising creators."],
      ]},
      { type: "tip", label: "Manual skills", text: "For deeper research, use Claude Code skills: /last30days, /viral-scout, /creator-analysis, /content-planner." },
    ],
  },
];

export type ViewHelpData = {
  title: string;
  description: string;
  tips: Array<{ label: string; detail: string }>;
};

export type HintData = {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
};

export const VIEW_HELP: Record<DashboardView, ViewHelpData> = {
  HOME: {
    title: "Production Overview",
    description:
      "Your command center. See production progress, intelligence signals, and tonight's recommended session.",
    tips: [
      {
        label: "Stat Cards",
        detail:
          "Each card shows how many videos are in that production stage. The 6 stages flow left to right: Scripted, Recording, Generating, Assembled, Scheduled, Published.",
      },
      {
        label: "Intelligence Cards",
        detail:
          "Data Health checks if research data is stale. Top Opportunity shows the highest-scored content idea. Bottleneck identifies where videos pile up. Velocity tracks average days from script to publish.",
      },
      {
        label: "Quick Actions",
        detail:
          "These copy Claude Code slash commands to your clipboard. Paste them into Claude Code to run research and planning skills.",
      },
      {
        label: "Tonight's Session",
        detail:
          "Recommends the most efficient next batch of work based on which pipeline stage has the most videos for one audience.",
      },
    ],
  },
  PIPELINE: {
    title: "Production Pipeline",
    description:
      "Track every video through 6 production stages. Desktop: drag cards between columns. Mobile: use the advance buttons.",
    tips: [
      {
        label: "Drag to Advance",
        detail:
          "On desktop, grab any card and drop it into a different column to change its production status.",
      },
      {
        label: "Mobile Advance",
        detail:
          "On mobile, tap a stage to expand it, then use the 'Move to [NEXT]' button on each card.",
      },
      {
        label: "Bulk Selection",
        detail:
          "Click the checkbox on any card to select it. A bulk action bar appears to move multiple videos at once.",
      },
      {
        label: "Stage Meanings",
        detail:
          "SCRIPTED: script written. RECORDING: voiceover/filming. GENERATING: AI graphics + Cinema Studio. ASSEMBLED: edited in CapCut. SCHEDULED: date set. PUBLISHED: live.",
      },
    ],
  },
  LIBRARY: {
    title: "Content Library",
    description:
      "Browse all video scripts. Search, filter, and tap any card to see full script, shot prompts, and render controls.",
    tips: [
      {
        label: "Format Codes",
        detail:
          "A=Explainer, B=Checklist, C=Demo, D=Myth Buster, E=Walkthrough, F=Quick Tip, G=Patient Story. Each has a distinct color.",
      },
      {
        label: "Video Detail",
        detail:
          "Tap a card to open the detail panel with Script, Shots, Timeline, Production, and Info tabs.",
      },
      {
        label: "Copy Prompts",
        detail:
          "In the Shots tab, each Cinema Studio prompt has a copy button for pasting into Higgsfield.",
      },
    ],
  },
  IDEAS: {
    title: "Idea Bank",
    description:
      "Content ideas staged for future planning. Ideas come from research, competitor analysis, or manual entry.",
    tips: [
      {
        label: "Generate",
        detail:
          "AI generates new ideas based on your existing library, research data, and trending topics.",
      },
      {
        label: "Sync n8n",
        detail:
          "Pulls new ideas discovered by your automated n8n weekly digest workflow. Only adds ideas not already in the bank.",
      },
      {
        label: "Categories",
        detail:
          "Trending (hot now), Competitor (from watching others), Evergreen (always relevant), Audience (from questions/pain points), Personal (your ideas).",
      },
    ],
  },
  OPPORTUNITIES: {
    title: "Content Opportunities",
    description:
      "AI-scored content opportunities ranked by 7 dimensions. Higher overall score means stronger evidence this topic will perform well.",
    tips: [
      {
        label: "7 Dimensions",
        detail:
          "Audience Demand (25%), Competition Gap (20%), Trend Momentum (15%), Format Fit (10%), Hook Availability (10%), Platform Alignment (10%), Engagement Potential (10%).",
      },
      {
        label: "Evidence",
        detail:
          "Each opportunity links to Reddit threads, X posts, and web articles that support the scoring.",
      },
      {
        label: "Add to Ideas",
        detail: "Move a high-scoring opportunity into the Idea Bank for planning.",
      },
    ],
  },
  WATCHLIST: {
    title: "Creator Watchlist",
    description:
      "Track competitors and inspiration creators. Run analysis skills directly from each card.",
    tips: [
      {
        label: "Analysis",
        detail:
          "The Analyze button copies a Claude Code command that runs deep analysis on that creator's content patterns.",
      },
      {
        label: "View Analysis",
        detail:
          "When analysis exists, click 'View Analysis' to see content patterns, hook styles, and key takeaways.",
      },
    ],
  },
  CALENDAR: {
    title: "Content Calendar",
    description:
      "Week view showing what is scheduled across all platforms. Click any cell to add an entry.",
    tips: [
      {
        label: "Cadence Gaps",
        detail:
          "Amber warnings mean you are below the target posting frequency for a platform this week. Targets come from your industry config.",
      },
      {
        label: "Adding Entries",
        detail:
          "Hover over (or tap) any cell and click the + icon. You can assign a video code or leave it as a placeholder.",
      },
    ],
  },
  SESSION: {
    title: "Session Planner",
    description:
      "Batch production sessions. Pick a session type, select videos, and work through them with a timer.",
    tips: [
      {
        label: "3 Session Types",
        detail:
          "Voiceover: record scripts (SCRIPTED videos). Generation: create graphics (RECORDING videos). Assembly: final cuts (GENERATING videos).",
      },
      {
        label: "Auto-Advance",
        detail:
          "Completing a video in a session automatically moves it to the next pipeline stage.",
      },
      {
        label: "Timer",
        detail:
          "The timer runs during the active phase. When you end the session, it shows time per video.",
      },
    ],
  },
  VAULT: {
    title: "The Vault",
    description:
      "Save and reuse viral hooks and writing styles. Extract patterns from winning content and apply them to your scripts.",
    tips: [
      {
        label: "Hook Templates",
        detail:
          "Hooks are stored as Mad Lib templates with [VARIABLE] placeholders. Fill in the blanks to generate new hooks instantly.",
      },
      {
        label: "Style Extraction",
        detail:
          "Paste a creator's transcript and AI extracts concrete writing rules: sentence length, tone, structure, techniques.",
      },
      {
        label: "Library vs Custom",
        detail:
          "Blue 'Library' badges are from hook-patterns.md (read-only). Custom hooks you add can be edited and deleted.",
      },
    ],
  },
  METRICS: {
    title: "Performance Metrics",
    description:
      "Track post-publish performance. Manually enter views, likes, saves, shares, and comments from each platform.",
    tips: [
      {
        label: "Manual Entry",
        detail:
          "After publishing, enter metrics from each platform. This is a manual step since platform APIs are not connected.",
      },
      {
        label: "Charts",
        detail:
          "Compare average views by format, engagement rates, and views by platform to see what works best.",
      },
      {
        label: "Top Performers",
        detail:
          "The table shows which videos get the best engagement and save rates, helping guide future content.",
      },
    ],
  },
  CAPTIONS: {
    title: "Caption Studio",
    description:
      "Generate, manage, and store social media captions for your videos. AI-powered generation with format-aware hook patterns and platform-specific optimization.",
    tips: [
      {
        label: "Generate All",
        detail:
          "One click generates captions for all 4 platforms (Instagram, TikTok, YouTube Shorts, YouTube Long) using your video's script and hook patterns.",
      },
      {
        label: "Status Tracking",
        detail:
          "Mark captions as Draft, Approved, or Posted to track which posts are ready to publish.",
      },
      {
        label: "Variants",
        detail:
          "Generate multiple caption variants per platform for A/B testing. Each generation adds a new variant.",
      },
    ],
  },
};

export const FEATURE_HINTS: Record<string, HintData> = {
  "pipeline-drag": {
    content: "Drag cards between columns to change their production stage.",
    side: "bottom",
  },
  "pipeline-bulk": {
    content: "Click the checkbox on cards to select multiple, then bulk-move them.",
    side: "left",
  },
  "skill-buttons": {
    content:
      "Copies a Claude Code command to your clipboard. Paste it into Claude Code to run.",
    side: "bottom",
  },
  "sync-n8n": {
    content:
      "Pulls new content ideas from your automated n8n research workflow.",
    side: "bottom",
  },
  "session-phases": {
    content:
      "Setup: pick videos. Active: work through them with a timer. Complete: see your stats.",
    side: "bottom",
  },
  "calendar-gaps": {
    content:
      "Amber warnings mean you are below the target posting frequency for that platform.",
    side: "bottom",
  },
  "intelligence-cards": {
    content:
      "Real-time signals: data freshness, top opportunity, pipeline bottleneck, and production speed.",
    side: "bottom",
  },
  "format-codes": {
    content:
      "A=Explainer, B=Checklist, C=Demo, D=Myth Buster, E=Walkthrough, F=Quick Tip, G=Patient Story",
    side: "bottom",
  },
  "opportunity-dims": {
    content:
      "7 weighted dimensions produce the overall score. Expand any opportunity to see the breakdown.",
    side: "bottom",
  },
};

// ============================================
// Guided Tour Steps
// ============================================

export const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="stat-cards"]',
    title: "Production at a Glance",
    content: "These cards show how many videos are in each production stage. Track your progress from script to publish.",
    side: "bottom",
    view: "HOME",
  },
  {
    targetSelector: '[data-tour="action-feed"]',
    title: "Your Action Feed",
    content: "Prioritized tasks based on deadlines, cadence gaps, and stuck videos. Start here each session.",
    side: "top",
    view: "HOME",
  },
  {
    targetSelector: '[data-tour="pipeline-board"]',
    title: "Drag to Advance",
    content: "Drag video cards between columns to move them through production stages.",
    side: "bottom",
    view: "PIPELINE",
  },
  {
    targetSelector: '[data-tour="video-card"]',
    title: "Video Detail",
    content: "Tap any card to see the full script, shot prompts, and production controls.",
    side: "bottom",
    view: "LIBRARY",
  },
  {
    targetSelector: '[data-tour="caption-workspace"]',
    title: "Caption Studio",
    content: "Generate captions for all platforms with one click. Edit, approve, and track status.",
    side: "bottom",
    view: "CAPTIONS",
  },
];

// ============================================
// Onboarding Checklist
// ============================================

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: "visit-library", label: "Browse your content library", eventId: "visit-library", targetView: "LIBRARY" },
  { id: "open-detail", label: "Open a video detail panel", eventId: "open-detail", targetView: "LIBRARY" },
  { id: "move-video", label: "Move a video in the pipeline", eventId: "move-video", targetView: "PIPELINE" },
  { id: "visit-ideas", label: "Check out the idea bank", eventId: "visit-ideas", targetView: "IDEAS" },
  { id: "visit-calendar", label: "Explore your calendar", eventId: "visit-calendar", targetView: "CALENDAR" },
];

// ============================================
// Changelog
// ============================================

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-03-05",
    title: "Guided Onboarding & New Features",
    items: [
      "Welcome tour walks you through the dashboard",
      "Onboarding checklist tracks your first steps",
      "Caption Studio for persistent caption management",
      "Competitive Benchmarking on Watchlist",
      "Smart Action Feed on Home",
      "Better tooltips with keyboard support",
      "Improved empty states across all views",
    ],
  },
];
