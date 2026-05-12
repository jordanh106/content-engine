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
      { type: "heading", text: "Quick Filter Presets" },
      { type: "paragraph", text: "Three chips above the filter bar narrow the list instantly. Top Scoring: ≥70 overall score. Quick Wins: Format F (micro) or B (checklist) — fastest to produce. Research-Backed: 3+ evidence sources. Presets stack with sort and format filters." },
      { type: "heading", text: "Dismiss + Learn" },
      { type: "paragraph", text: "Click X on any opportunity card to dismiss it. Choose: Already covered, Not relevant, or Oversaturated. Dismissed items are hidden immediately and the reason is stored to SQLite." },
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
      { type: "heading", text: "Angle Spinner" },
      { type: "paragraph", text: "On any idea, click 'Spin 6 Angles' to generate 6 alternate video concepts, one per Kallaway archetype (Fortune Teller, Experimenter, Teacher, Magician, Investigator, Contrarian). Each angle includes a title, description, and suggested format. Use this to explore different creative directions before committing to a script." },
      { type: "navigate", label: "Go to Ideas", targetView: "IDEAS" },
    ],
  },
  {
    id: "idea-lab",
    title: "Idea Lab",
    phase: "discover",
    relatedView: "IDEAS",
    summary: "Three-mode AI workshop for developing content ideas into production-ready scripts.",
    keywords: ["idea lab", "script", "modes", "finisher", "fixer", "original", "analyze video", "url", "adapt", "hook", "vault", "save", "copy prompt", "structure", "rehook"],
    content: [
      { type: "paragraph", text: "Idea Lab is an AI workshop inside the Ideas view. Access it via the Idea Lab tab. It has three entry modes." },
      { type: "table", headers: ["Entry Mode", "Input", "What You Get"], rows: [
        ["Analyze Video", "Paste a video URL", "3 niche-specific adaptations with hooks and format suggestions"],
        ["Guide Me", "Describe a vague idea", "AI asks one question at a time to shape it into a production concept"],
        ["7 Ways", "Type any topic", "The topic rewritten across all 7 video formats simultaneously"],
      ]},
      { type: "heading", text: "Script Modes" },
      { type: "steps", title: "", items: [
        "Original: AI generates a complete script from your topic and hook. No extra input needed.",
        "Finisher: Paste your raw notes or bullet points. AI assembles them into a structured script without adding outside facts.",
        "Fixer: Paste a rough draft. AI polishes pacing, hook, and CTA without changing your voice.",
      ]},
      { type: "tip", label: "Finisher vs Fixer", text: "Use Finisher when you have notes but no script. Use Fixer when you have a draft but it feels flat or off-structure." },
      { type: "heading", text: "Script Structure Visualization" },
      { type: "paragraph", text: "After a script generates, expand the collapsible 'Script Structure' row: Hook → Setup → Rehook → Build → Final Hook as colored pills. Each pill is a loop-open or loop-close in Kallaway's rehook dance." },
      { type: "heading", text: "Copy as Prompt" },
      { type: "paragraph", text: "'Copy as Prompt' exports a structured block (topic, format, audience, hook, key points, CTA, structure) for pasting into Claude or ChatGPT to regenerate or expand the script externally." },
      { type: "heading", text: "Save to Vault" },
      { type: "paragraph", text: "The bookmark icon next to any hook line saves it to your Vault as a custom hook in the 'custom' category. Find it in the Vault's Hooks tab." },
      { type: "callout", variant: "info", text: "Hook Rewriter pills (Question, Myth, Stat, etc.) rewrite just the hook in any Kallaway style without regenerating the whole script." },
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
      { type: "heading", text: "Creator Search" },
      { type: "paragraph", text: "A search box at the top filters creators by handle or tracking reason in real time. When exactly one creator matches, their card auto-expands." },
      { type: "heading", text: "7 DNA Components" },
      { type: "paragraph", text: "Every video breakdown shows 7 components: Topic, Angle, Hook, Storytelling Style, Visual Format, Key Visuals, Audio. These are what you extract from a creator's video and replicate when adapting content to your niche." },
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
    summary: "AI-generated captions with Kallaway hook archetypes, freeform mode, Hook Lab, and multi-variant generation.",
    keywords: ["captions", "hashtags", "instagram", "tiktok", "youtube", "generate", "publish", "freeform", "hook lab", "kallaway", "archetype", "variant", "refinement", "template"],
    content: [
      { type: "heading", text: "Two Modes" },
      { type: "paragraph", text: "Library Mode: Select a video from your content library and generate captions from its script. Freeform Mode: Click 'Describe Your Video' to generate captions for any content, including memes, trending sounds, and visual-only posts. Describe the video, pick a mood, select platforms, and add tags." },
      { type: "heading", text: "Multi-Variant Generation" },
      { type: "paragraph", text: "Each generation creates 2 caption variants per platform, each using a different Kallaway hook archetype (Teacher, Contrarian, Fortune Teller, etc.). Variants are labeled with their archetype so you can compare approaches before approving." },
      { type: "heading", text: "Hook Alignment (Advanced)" },
      { type: "paragraph", text: "In freeform mode, expand the Hook Alignment section to add Visual Hook, Text Overlay, and Audio Context fields. These follow Kallaway's 4-component alignment: Visual leads (most important), then text, then spoken, then audio. The AI uses these to write captions that match your video's hook structure." },
      { type: "heading", text: "Hook Lab" },
      { type: "paragraph", text: "Click Hook Lab to generate 6 hooks, one per Kallaway archetype. Each hook shows a 3-part structure breakdown: Context Lean (sets up the topic), Pattern Interrupt (disrupts expectation), and Contrarian Snapback (flips to the unexpected). Click any hook to copy it." },
      { type: "heading", text: "AI Refinement" },
      { type: "paragraph", text: "After generating, use the AI Refinement chat to iterate. Chips are grouped by category: Hook (stronger hook, contrarian snapback, different archetype), Value (more value, simplify), CTA (stronger CTA, add urgency), and Platform (shorter for TikTok, add hashtags). Type freeform requests too." },
      { type: "heading", text: "Quality Scoring" },
      { type: "paragraph", text: "Every caption is scored 0-100 across 6 dimensions: Hook (Kallaway 3-part structure detection), CTA presence, Readability (sentence rhythm variation), Hashtags (platform-appropriate count), Emoji density, and Length (platform limit ratio)." },
      { type: "heading", text: "Templates & Hashtag Groups" },
      { type: "paragraph", text: "Save any caption as a reusable template. Save and insert hashtag groups for consistent tagging across posts." },
      { type: "heading", text: "Publish Kit" },
      { type: "paragraph", text: "The platform coverage bar shows which platforms have approved captions. Use bulk approve, copy all, or mark as posted from the Publish Kit section." },
      { type: "heading", text: "Platform Limits" },
      { type: "table", headers: ["Platform", "Max Length", "Visible"], rows: [
        ["Instagram Reels", "2,200 chars", "First 125"],
        ["TikTok", "4,000 chars", "First 100"],
        ["YouTube Shorts", "100 chars", "All"],
        ["YouTube Long-form", "5,000 chars", "First 200"],
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
      { type: "heading", text: "Outlier Score" },
      { type: "paragraph", text: "The Outlier column in the Top Performers table shows the video's views divided by your median views. Emerald = 2x+, Teal = 5x+, Violet = 10x+. Kallaway's key discovery signal — study what made those videos different and replicate." },
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
      { type: "heading", text: "Hook Archetype Badges" },
      { type: "paragraph", text: "Each hook card shows a dark pill badge: Teacher, Fortuneteller, Contrarian, Experimenter, Magician, or Investigator. Derived from the hook category. Scan for diversity — if you only see Teacher and Fortuneteller, you are missing Magician and Investigator patterns." },
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
  {
    id: "kallaway-hooks",
    title: "Kallaway Hook Framework",
    phase: "reference",
    relatedView: null,
    summary: "6 hook archetypes, 4-component alignment, and the 3-part structure for scroll-stopping content.",
    keywords: ["kallaway", "hooks", "archetype", "alignment", "visual", "contrarian", "fortune teller", "experimenter", "teacher", "magician", "investigator", "rehook", "superfan"],
    content: [
      { type: "heading", text: "4-Component Alignment" },
      { type: "paragraph", text: "Visual (most important) > Text Overlay > Spoken Word > Audio/Music. Start with the strongest visual, then write the spoken hook to match. The visual hook is what stops the scroll; everything else reinforces it." },
      { type: "heading", text: "3-Part Hook Structure" },
      { type: "paragraph", text: "Every strong hook follows three beats: Context Lean (establish the topic and why it matters), Pattern Interrupt (a contrast word or twist that disrupts expectation), and Contrarian Snapback (flip to the unexpected direction). Example: 'Most people stretch before workouts [context]. But stretching cold muscles [interrupt] actually increases your injury risk [snapback].'" },
      { type: "heading", text: "6 Hook Archetypes" },
      { type: "table", headers: ["Archetype", "Strategy", "Formula"], rows: [
        ["Fortune Teller", "Predict the future", "In [timeframe], [surprising prediction]"],
        ["Experimenter", "Test and reveal", "I tried [thing] for [duration], here's what happened"],
        ["Teacher", "Explain simply", "[Number] [things] about [topic] you need to know"],
        ["Magician", "Transform expectations", "Watch [ordinary thing] become [extraordinary result]"],
        ["Investigator", "Uncover hidden truths", "The real reason [common belief] is [surprising truth]"],
        ["Contrarian", "Challenge consensus", "Everyone says [common advice], but [opposite] works better"],
      ]},
      { type: "heading", text: "Re-hook Dance" },
      { type: "paragraph", text: "Hook > Context > Conflict > Rehook (repeated). Each rehook opens a new curiosity loop before closing the previous one. More open loops = longer retention. For YouTube Long-form, use 3-5 rehooks throughout the video." },
      { type: "heading", text: "90-Minute Superfan Rule" },
      { type: "paragraph", text: "~270 short-form videos = ~90 minutes of watched content = superfan territory. When a viewer has watched 90 minutes of your content, they become a committed follower. The Superfan Progress tracker on the Home dashboard tracks your progress toward this goal." },
      { type: "tip", label: "Where this is used", text: "The Hook Lab and Angle Spinner both use this framework. Caption scoring evaluates the 3-part structure. Understanding the archetypes helps you choose better angles and write stronger hooks." },
    ],
  },
  {
    id: "inspiration-inbox",
    title: "Inspiration Inbox",
    phase: "discover",
    relatedView: "IDEAS",
    summary: "Frictionless raw-idea capture — dump anything without structure, develop it into the Idea Bank when ready.",
    keywords: ["inbox", "capture", "inspiration", "ideas", "raw", "develop", "dismiss"],
    content: [
      { type: "paragraph", text: "The Inspiration Inbox sits above the Idea Bank in the Ideas view. It's a friction-free capture layer for raw ideas, screenshots, links, phrases, or anything that sparks inspiration — no required fields, no structure needed." },
      { type: "heading", text: "Capturing Ideas" },
      { type: "steps", title: "How to capture", items: [
        "Open the Ideas view and expand the Inspiration Inbox at the top.",
        "Type any raw thought in the text box — a topic, a hook, a competitor video title, anything.",
        "Optionally paste a source URL (link to a video or article that inspired the idea).",
        "Press ⌘+Enter or click Capture to save it.",
      ]},
      { type: "heading", text: "Developing Ideas" },
      { type: "paragraph", text: "Each inbox item has two actions: Develop and Dismiss. Click Develop to expand an inline form where you can set a topic name, category (trending, competitor, evergreen, audience, personal), and priority. Confirming writes the idea directly to the Idea Bank markdown file and removes it from the inbox." },
      { type: "tip", label: "Dismiss", text: "Dismiss removes the item from the inbox without creating an Idea Bank entry — useful for quick captures you later decide aren't worth pursuing." },
    ],
  },
  {
    id: "trend-pulse",
    title: "Trend Pulse",
    phase: "discover",
    relatedView: "HOME",
    summary: "Live trending signals on the Home screen, pulled from the n8n weekly digest — with one-click 'Add to Ideas'.",
    keywords: ["trend pulse", "trending", "home", "digest", "n8n", "ideas", "hook patterns", "content gaps"],
    content: [
      { type: "paragraph", text: "The Trend Pulse widget appears on the Home screen between Quick Stats and the Superfan Pipeline. It surfaces the latest data from the n8n Content Intelligence weekly digest without requiring you to open any files." },
      { type: "heading", text: "What It Shows" },
      { type: "table", headers: ["Section", "Content"], rows: [
        ["Trending Now", "Top trending topics from the digest, with platform tags"],
        ["Hook Patterns Spotted", "Copy-ready hook text patterns performing well right now"],
        ["Content Gaps", "Underserved angles competitors are missing"],
      ]},
      { type: "heading", text: "Actions" },
      { type: "steps", title: "Available actions", items: [
        "Click '+ Idea' next to a trending topic to add it directly to the Inspiration Inbox.",
        "Click 'Copy' on a hook pattern to copy the hook text to your clipboard.",
        "The digest date label shows when the data was last updated by n8n.",
      ]},
      { type: "tip", label: "Automatic", text: "The Trend Pulse widget is hidden entirely if no digest file exists. It appears automatically after the first n8n Content Intelligence workflow run (Mondays at 8am)." },
    ],
  },
  {
    id: "carousel-waterfall",
    title: "Content Waterfall — Carousel Tier",
    phase: "produce",
    relatedView: "LIBRARY",
    summary: "Auto-Generate now produces 12 derivatives including 2 carousel slide outlines (Instagram + LinkedIn).",
    keywords: ["carousel", "waterfall", "auto-generate", "instagram", "linkedin", "slides", "derivative"],
    content: [
      { type: "paragraph", text: "The Waterfall Auto-Generate function produces 12 derivatives per video — 10 video/text shorts plus 2 carousel outlines. Carousels are the highest-engagement format on Instagram (0.55% avg engagement) and are now first-class content in the pipeline." },
      { type: "heading", text: "What's Generated" },
      { type: "table", headers: ["Platform", "Format", "Slides"], rows: [
        ["Instagram", "Educational breakdown", "7 slides — bold hook cover, 5 insight slides (max 15 words each), CTA + Save prompt"],
        ["LinkedIn", "Professional insight post", "6 slides — bold claim, 4 evidence/step slides, key takeaway + follow CTA"],
      ]},
      { type: "heading", text: "Slide Outline Cards" },
      { type: "steps", title: "Using carousel cards", items: [
        "After Auto-Generate, a Carousels section appears below Text posts in the Waterfall tab.",
        "Carousel cards show the slide-by-slide outline by default — click the chevron to collapse.",
        "Each slide is listed with its slide number and the suggested copy (max 12 words per slide).",
        "Status (Idea / Created / Published) is tracked the same as other waterfall items.",
      ]},
      { type: "tip", label: "Idempotent", text: "Running Auto-Generate again skips carousel items that already exist (carousel::instagram and carousel::linkedin are unique keys). Only new items are created." },
    ],
  },
  {
    id: "carousel-lab",
    title: "Carousel Lab",
    phase: "produce",
    relatedView: "CAROUSEL_LAB",
    summary: "Create, edit, and push carousels to Canva using Kallaway-structured slide frameworks.",
    keywords: ["carousel", "slides", "instagram", "linkedin", "canva", "hook archetype", "rehook", "fresh start", "from video", "generate", "export", "slide editor"],
    content: [
      { type: "paragraph", text: "Carousel Lab is a standalone creation environment in the Produce section. It replaces the basic carousel auto-generation in the Waterfall tab with a full creation workflow." },
      { type: "heading", text: "Two Creation Modes" },
      { type: "table", headers: ["Mode", "Input", "Best For"], rows: [
        ["Fresh Start", "Topic + audience + hook archetype", "Original carousel ideas not tied to a specific video"],
        ["From Video", "Pick a video from your library", "Extending a video's content into a shareable carousel format"],
      ]},
      { type: "heading", text: "Kallaway Carousel Structure" },
      { type: "steps", title: "Instagram 7-slide structure", items: [
        "Slide 1 — Cover: Hook in your chosen archetype (Fortuneteller, Contrarian, etc.)",
        "Slides 2-4 — Content: One insight per slide, max 20 words body",
        "Slide 5 — Rehook: Mid-carousel pattern interrupt — restarts curiosity, does not summarize",
        "Slide 6 — Resolution: The actual fix, takeaway, or answer",
        "Slide 7 — CTA: Save prompt + action (link in bio, book a consult)",
      ]},
      { type: "tip", label: "Rehook vs Summary", text: "The Rehook slide must open a loop, not close one. 'Here's what most people miss' works. 'To summarize' kills the scroll." },
      { type: "heading", text: "Slide Editor" },
      { type: "paragraph", text: "After generation, click any slide tab to edit heading, body copy, and visual direction. Changes persist to the database immediately. Use Revert to undo unsaved changes." },
      { type: "heading", text: "Push to Canva" },
      { type: "paragraph", text: "Click 'Push to Canva' to get the command: /carousel-lab push [id]. Run it in Claude Code. The skill uses Canva MCP to create a real designed presentation with your brand kit, then saves the URL to the dashboard. The 'Open in Canva' link appears automatically." },
      { type: "callout", variant: "info", text: "Instagram: download each slide as PNG from Canva. LinkedIn: export as PDF — LinkedIn converts it to a swipeable carousel." },
      { type: "navigate", label: "Go to Carousel Lab", targetView: "CAROUSEL_LAB" },
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
      {
        label: "Superfan Pipeline",
        detail:
          "The progress tracker shows how many published videos you have toward the 270-video goal (90 min of content = superfan territory).",
      },
      {
        label: "Content Mix",
        detail:
          "The stacked bar shows your content library split by duration tier: Micro (<15s), Short (15-45s), Medium (45-90s), Long (90s+). Hover each segment for counts. Kallaway: ~270 short-form videos at 20s avg = 90 min watched = superfan territory.",
      },
    ],
  },
  SCRIPT_WIZARD: {
    title: "Create",
    description:
      "AI-powered script creation wizard. Describe a topic, generate hook variations, pick one, then generate a full script with conversational refinement.",
    tips: [
      { label: "Hook Variations", detail: "Generate 6 AI hook options, each with a predicted performance level. Pick the one that resonates." },
      { label: "Chat Refinement", detail: "After generating a script, use the chat input to refine it: 'Make the hook more provocative', 'Shorten to 30s', etc." },
      { label: "Duration Slider", detail: "Adjust target duration with the slider. Word count updates automatically." },
    ],
  },
  INTELLIGENCE: {
    title: "Intelligence",
    description:
      "Unified analytics hub with 4 tabs: Performance metrics, content Opportunities, Ideas bank, and Watchlist creator tracking.",
    tips: [
      { label: "Performance", detail: "Top performers, engagement charts, format analytics, and content health score." },
      { label: "Opportunities", detail: "Scored content gaps based on trending topics and competitor analysis." },
      { label: "Ideas", detail: "Your idea bank and inspiration inbox. Categorized by trending, competitor, evergreen, audience." },
      { label: "Watchlist", detail: "Track competitor creators, scan their recent videos, analyze hooks and formats." },
    ],
  },
  DISCOVER_FEED: {
    title: "Discover",
    description:
      "Visual discovery feed showing top-performing competitor videos, your own best content, and trending topics. Hover thumbnails to preview.",
    tips: [
      {
        label: "Outlier Videos",
        detail:
          "Videos that performed 2x or more above their creator's average. These are the content patterns worth studying and adapting.",
      },
      {
        label: "Hover to Preview",
        detail:
          "On desktop, hover any video thumbnail to play a muted preview. On mobile, videos auto-play when scrolled into view.",
      },
      {
        label: "Your Top Performers",
        detail:
          "Your own published videos ranked by total views. Click to open full details and see what worked.",
      },
      {
        label: "Trending Topics",
        detail:
          "Latest trending topics from the weekly intelligence digest. Click '+ Create' to turn a trend into a content idea.",
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
      {
        label: "Angle Spinner",
        detail:
          "Click 'Spin 6 Angles' on any idea to see it through 6 Kallaway hook archetypes. Each angle is a ready-to-film concept with a suggested format.",
      },
      {
        label: "Script Modes",
        detail:
          "After clicking 'Write Script' in Idea Lab, choose: Original (AI generates fresh), Finisher (paste notes → AI completes), or Fixer (paste draft → AI polishes).",
      },
      {
        label: "Copy as Prompt",
        detail:
          "After generating a script draft, 'Copy as Prompt' exports a structured block for Claude or ChatGPT — topic, format, hook, key points, CTA, and structure.",
      },
      {
        label: "Save to Vault",
        detail:
          "The bookmark icon next to any hook line in adaptation cards saves that hook to the Vault as a custom hook. Find it in the Vault's Hooks tab.",
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
      {
        label: "Quick Filter Presets",
        detail:
          "Three chips: Top Scoring (score ≥70), Quick Wins (Format F or B — fastest to produce), Research-Backed (3+ evidence sources). Stack with sort and format filters.",
      },
      {
        label: "Dismiss + Learn",
        detail:
          "Click X on any card to dismiss it with a reason: Already covered, Not relevant, or Oversaturated. Dismissed topics are hidden and the reason is persisted to SQLite.",
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
      {
        label: "Creator Search",
        detail:
          "Filter the creator list by handle or tracking reason. When exactly one creator matches, that card auto-expands.",
      },
      {
        label: "7 DNA Components",
        detail:
          "Each video breakdown shows 7 components: Topic, Angle, Hook, Storytelling Style, Visual Format, Key Visuals, Audio. These are the fields to replicate when adapting a creator's video to your niche.",
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
      {
        label: "Hook Archetype Badges",
        detail:
          "Dark pill badges on each hook card show the Kallaway archetype: Teacher, Fortuneteller, Contrarian, Experimenter, Magician, or Investigator. Scan your vault to find which archetypes you are missing.",
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
      {
        label: "Outlier Score",
        detail:
          "The multiplier badge in the Top Performers table shows how many times a video exceeded your own median views. Emerald=2x+, Teal=5x+, Violet=10x+. Study what made outliers different and replicate the pattern.",
      },
    ],
  },
  CAPTIONS: {
    title: "Caption Studio",
    description:
      "Generate multi-variant captions with Kallaway hook archetypes, use Hook Lab for structure breakdowns, or describe any video for freeform captions.",
    tips: [
      {
        label: "Freeform Mode",
        detail:
          "Don't have a library video? Use 'Describe Your Video' to generate captions for any content, including memes, trending sounds, and visual-only posts.",
      },
      {
        label: "Hook Lab",
        detail:
          "Click Hook Lab to generate 6 hooks using Kallaway's archetypes. Each shows a 3-part breakdown (Context Lean, Pattern Interrupt, Contrarian Snapback). Click to copy.",
      },
      {
        label: "Multi-Variant",
        detail:
          "Each generation creates 2 variants per platform using different hook archetypes. Compare approaches before approving.",
      },
      {
        label: "Refinement",
        detail:
          "Use the AI Refinement chips grouped by Hook, Value, CTA, and Platform to iterate. Try 'Add a contrarian snapback' or 'Try a different archetype'.",
      },
      {
        label: "Copy as Prompt",
        detail:
          "In the freeform panel, 'Copy as Prompt' exports a structured prompt (video, platform, description, requirements) to paste into Claude or ChatGPT.",
      },
    ],
  },
  STRATEGY: {
    title: "Strategy",
    description:
      "See which hook patterns and formats are performing best across platforms. Run AI analysis to get KEEP / PROMOTE / DEMOTE recommendations.",
    tips: [
      {
        label: "Hook Pattern Matrix",
        detail:
          "The table shows weighted engagement (save rate + share rate + comment rate) by hook type and platform. Green cells are above average.",
      },
      {
        label: "Improving Coverage",
        detail:
          "Tag metric entries with a hook pattern in the Metrics form. The more entries tagged, the more accurate the matrix becomes.",
      },
      {
        label: "AI Analysis",
        detail:
          "Click 'Analyze Strategy' to compare your performance data against hook-patterns.md. The AI identifies patterns that are winning or losing relative to their current emphasis.",
      },
    ],
  },
  CAROUSEL_LAB: {
    title: "Carousel Lab",
    description:
      "Create, edit, and push carousels to Canva. Two modes: Fresh Start builds from any topic; From Video adapts an existing script.",
    tips: [
      {
        label: "Fresh vs From Video",
        detail:
          "Fresh Start generates a carousel from any topic, audience, and hook archetype. From Video adapts a script you already wrote — your hook and key points carry over without adding new information.",
      },
      {
        label: "Rehook Slide",
        detail:
          "Instagram carousels include a Rehook slide at slide 5. This is not a summary — it's a loop-open that restarts curiosity mid-scroll. Without it, viewers stop swiping after slide 4.",
      },
      {
        label: "Slide Editor",
        detail:
          "Click any slide tab to edit its heading, body copy, and visual direction. Changes save directly to the database. Use Revert to undo unsaved changes.",
      },
      {
        label: "Push to Canva",
        detail:
          "After saving your carousel, run /carousel-lab push [id] in Claude Code. Canva MCP creates a designed presentation with your brand kit and saves the URL here automatically.",
      },
      {
        label: "Analytics Panel",
        detail:
          "The right panel shows your carousel composite score (save rate × 0.4 + share × 0.3 + engagement × 0.2 + CTR × 0.1), by-platform breakdown, and current template/strategy versions.",
      },
    ],
  },
  CANVAS: {
    title: "Visual Canvas",
    description:
      "Spatial workspace for content workflows. Drag creators, videos, ideas, and URL sources onto an infinite canvas, connect them with edges, then generate a blueprint-compliant script from any selected combination.",
    tips: [
      {
        label: "Add nodes from the Asset Library",
        detail:
          "The left drawer has four panels: Creators (your watchlist), Videos (top outliers), Ideas (from your idea bank + trending topics), and Source (paste any URL or text). Click any asset to drop it onto the canvas.",
      },
      {
        label: "Connect & select",
        detail:
          "Drag from a node's bottom handle to another node's top handle to draw a connection. Click nodes to select them — selected nodes plus anything connected to them get included in the next generation.",
      },
      {
        label: "Generate from selected",
        detail:
          "With one or more nodes selected, click 'Generate Script from Selected' in the top right. Claude reads every selected and connected node, applies the Master Blueprint, and drops the resulting script as a new node on the canvas.",
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
  "freeform-mode": {
    content:
      "No library video? Describe any video and generate captions from scratch.",
    side: "bottom",
  },
  "hook-lab": {
    content:
      "6 Kallaway archetypes, each with a 3-part structure breakdown. Click any hook to copy it.",
    side: "bottom",
  },
  "angle-spinner": {
    content:
      "Spin any idea through 6 hook archetypes to explore different creative angles.",
    side: "bottom",
  },
  "opportunity-presets": {
    content:
      "Three quick filters: Top Scoring (≥70 overall), Quick Wins (Format F or B — fastest to produce), Research-Backed (3+ evidence sources). Click to toggle; click again to clear.",
    side: "bottom",
  },
  "opportunity-dismiss": {
    content:
      "Dismiss this topic with a reason: Already covered, Not relevant, or Oversaturated. Dismissed topics are hidden and the reason is stored.",
    side: "top",
  },
  "creator-search": {
    content:
      "Filter creators by handle or tracking reason. When only one match exists the card auto-expands.",
    side: "bottom",
  },
  "outlier-score": {
    content:
      "Multiplier vs your own median views. Emerald = 2x+, Teal = 5x+, Violet = 10x+. Kallaway's primary discovery signal — study what made these videos different.",
    side: "top",
  },
  "script-modes": {
    content:
      "Original: AI generates fresh from your topic and hook. Finisher: paste your notes and AI completes. Fixer: paste your rough draft and AI polishes.",
    side: "bottom",
  },
  "save-hook-vault": {
    content:
      "Saves this hook to your Vault as a custom hook. Find it later in the Vault's Hooks tab.",
    side: "right",
  },
  "copy-as-prompt": {
    content:
      "Exports a structured AI prompt with your topic, format, hook, and key points. Paste into Claude or ChatGPT.",
    side: "top",
  },
  "script-structure": {
    content:
      "Kallaway's rehook dance: Hook → Setup → Rehook → Build → Final Hook. Every transition must re-earn attention.",
    side: "bottom",
  },
  "content-mix": {
    content:
      "Your library split by duration tier. Kallaway: 270 short-form videos at 20s avg = 90 min watched = superfan territory.",
    side: "bottom",
  },
  "hook-archetype-badge": {
    content:
      "Kallaway archetype derived from hook category. Use this to spot which types you are over- or under-using.",
    side: "right",
  },
  "carousel-archetype": {
    content:
      "Pick the Kallaway archetype for your cover slide. Fortuneteller and Contrarian perform best on Instagram. Teacher and Investigator work well on LinkedIn.",
    side: "bottom",
  },
  "carousel-slide-editor": {
    content:
      "Edit each slide's heading, body copy, and visual direction. Changes save directly to the database — use Revert to undo.",
    side: "top",
  },
  "carousel-canva-push": {
    content:
      "After saving, run /carousel-lab push [id] in Claude Code to create a real Canva design with your brand kit. The URL appears here when done.",
    side: "top",
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
    content: "Generate 2 caption variants per platform, use Hook Lab for Kallaway archetypes, or describe any video for freeform captions.",
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
  { id: "use-idea-lab", label: "Generate a script in Idea Lab", eventId: "use-idea-lab", targetView: "IDEAS" },
  { id: "check-opportunities", label: "Review your scored content opportunities", eventId: "check-opportunities", targetView: "OPPORTUNITIES" },
  { id: "create-carousel", label: "Create your first carousel in Carousel Lab", eventId: "create-carousel", targetView: "CAROUSEL_LAB" },
];

// ============================================
// Changelog
// ============================================

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.0",
    date: "2026-03-20",
    title: "Carousel Lab",
    items: [
      "Carousel Lab: dedicated standalone view in Produce section",
      "Fresh Start mode: create carousels without a source video (topic, audience, hook archetype)",
      "From Video mode: AI adapts your existing script into carousel format",
      "Slide editor: edit heading, body copy, and visual direction per slide after generation",
      "Kallaway Rehook slide: required mid-carousel loop re-open on Instagram",
      "Canva MCP export via /carousel-lab Claude Code skill",
      "Analytics panel: composite score, by-platform breakdown, template/strategy version tracking",
      "Cmd+K 'Generate Carousel' now navigates directly to Carousel Lab",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-03-20",
    title: "IdeaLab Upgrades, Outlier Scores & Opportunity Filters",
    items: [
      "IdeaLab: Script Modes — Original, Finisher (paste notes→complete), Fixer (paste draft→polish)",
      "IdeaLab: Copy as Prompt — exports structured AI prompt for Claude or ChatGPT",
      "IdeaLab: Save to Vault — bookmark icon on hook lines saves to Vault as custom hooks",
      "IdeaLab: Script Structure Visualization — Hook→Setup→Rehook→Build→Final Hook pill flow",
      "Opportunities: Filter Presets — Top Scoring (≥70), Quick Wins (F or B), Research-Backed (3+ evidence)",
      "Opportunities: Dismiss + Learn — X button with reason picker; dismissed topics persist to SQLite",
      "Watchlist: Creator Search — filter by handle or tracking reason",
      "Watchlist: 7 DNA Components — Topic, Angle, Hook, Storytelling Style, Visual Format, Key Visuals, Audio",
      "Vault + Opportunities: Hook Archetype Labels — Teacher, Fortuneteller, Contrarian, Experimenter, Magician, Investigator",
      "Metrics: Outlier Score — multiplier badge vs your own median (Emerald=2x+, Teal=5x+, Violet=10x+)",
      "Home: Content Mix Widget — stacked bar showing library split by duration tier",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-03-11",
    title: "Kallaway Hook Framework & Caption Studio Overhaul",
    items: [
      "Caption Studio: 2 variants per platform using different Kallaway hook archetypes",
      "Freeform captions: Describe any video to generate captions without a library entry",
      "Hook Lab: 6 Kallaway archetypes with 3-part structure breakdown",
      "Hook Alignment: Visual, text, and audio context fields for better caption alignment",
      "Caption scoring: Now evaluates Kallaway 3-Part Hook Structure and rhythm variation",
      "Idea Bank: Angle Spinner generates 6 archetype-based video concepts per idea",
      "Dashboard Home: Superfan Progress tracker (270 videos = 90 min = superfan territory)",
      "New refinement chips: contrarian snapback, different archetype, mid-caption rehook",
      "hook-patterns.md: Complete Kallaway framework documentation",
    ],
  },
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
