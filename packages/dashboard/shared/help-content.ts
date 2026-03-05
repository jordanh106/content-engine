import type { DashboardView } from "../shared/types.js";

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
  COMPOSER: {
    title: "Motion Graphics Composer",
    description:
      "Visual editor for Remotion motion graphics. Arrange components, preview live, and render individual clips.",
    tips: [
      {
        label: "Full-Page Mode",
        detail:
          "Composer replaces the dashboard temporarily. Press Back to return to the video you came from.",
      },
      {
        label: "AI Chat",
        detail:
          "Describe changes in natural language. The AI modifies components based on your instructions.",
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
  "composer-button": {
    content:
      "Opens a full-page visual editor for this video's motion graphics.",
    side: "left",
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
