import type {
  ParsedVideo,
  Idea,
  IntelDigest,
  ResearchReport,
  HookPatternCategory,
  IndustryConfig,
  DataSourceSummary,
  FormatId,
} from "../../shared/types.js";

export type TopPerformerInfo = {
  videoCode: string;
  title: string;
  format: FormatId;
  audience: string;
  totalViews: number;
  totalEngagement: number;
};

export type PreComputedSignals = {
  // Coverage analysis
  coveredTopics: string[];
  coverageByAudience: Record<string, number>;
  coverageByFormat: Record<string, number>;

  // Hook availability
  hooksByCategory: Record<string, number>;
  totalHooks: number;

  // Platform cadence gaps
  platformCadence: Record<string, string>;
  publishedByPlatform: Record<string, number>;

  // Performance baselines (from existing videos)
  avgViewsByFormat: Record<string, number>;
  avgEngagementByFormat: Record<string, number>;

  // Top performers for feedback loop
  topPerformers: TopPerformerInfo[];
  performanceSummary: string;

  // Data source summary
  dataSourceSummary: DataSourceSummary;

  // Stale data warnings
  staleWarnings: string[];

  // Raw data for AI prompt
  researchSummary: string;
  digestSummary: string;
  hookSummary: string;
  ideaSummary: string;
  librarySummary: string;
};

export function computeSignals(
  videos: ParsedVideo[],
  ideas: Idea[],
  digest: IntelDigest | null,
  research: ResearchReport | null,
  hookLibrary: HookPatternCategory[],
  config: IndustryConfig,
  performanceData: Array<{ videoCode: string; views: number; likes: number; saves: number; shares: number; comments: number }>,
): PreComputedSignals {
  const staleWarnings: string[] = [];

  // Coverage analysis
  const coveredTopics = videos.map((v) => v.title.toLowerCase());
  const coverageByAudience: Record<string, number> = {};
  const coverageByFormat: Record<string, number> = {};

  for (const v of videos) {
    coverageByAudience[v.audience] = (coverageByAudience[v.audience] ?? 0) + 1;
    coverageByFormat[v.format] = (coverageByFormat[v.format] ?? 0) + 1;
  }

  // Hook availability
  const hooksByCategory: Record<string, number> = {};
  let totalHooks = 0;
  for (const cat of hookLibrary) {
    hooksByCategory[cat.name] = cat.patterns.length;
    totalHooks += cat.patterns.length;
  }

  // Platform cadence
  const platformCadence: Record<string, string> = {};
  if (config.postingCadence) {
    for (const [platform, cadence] of Object.entries(config.postingCadence)) {
      platformCadence[platform] = cadence;
    }
  }

  // Performance baselines
  const avgViewsByFormat: Record<string, number> = {};
  const avgEngagementByFormat: Record<string, number> = {};
  const formatPerf: Record<string, { views: number; engagement: number; count: number }> = {};

  const videoMap = new Map(videos.map((v) => [v.code, v]));
  for (const p of performanceData) {
    const video = videoMap.get(p.videoCode);
    if (!video) continue;
    const f = video.format;
    if (!formatPerf[f]) formatPerf[f] = { views: 0, engagement: 0, count: 0 };
    formatPerf[f].views += p.views;
    formatPerf[f].engagement += p.likes + p.saves + p.shares + p.comments;
    formatPerf[f].count += 1;
  }
  for (const [f, d] of Object.entries(formatPerf)) {
    avgViewsByFormat[f] = d.count > 0 ? Math.round(d.views / d.count) : 0;
    avgEngagementByFormat[f] = d.count > 0 ? Math.round(d.engagement / d.count) : 0;
  }

  // Data source summary
  const dataSourceSummary: DataSourceSummary = {
    redditThreads: research?.reddit?.length ?? 0,
    xPosts: research?.x?.length ?? 0,
    webResults: research?.web?.length ?? 0,
    instagramResults: research?.instagram?.length ?? 0,
    tiktokResults: research?.tiktok?.length ?? 0,
    facebookResults: research?.facebook?.length ?? 0,
    hookPatterns: totalHooks,
    existingVideos: videos.length,
    ideasInBank: ideas.filter((i) => i.category !== "archived").length,
    hasDigest: digest !== null,
  };

  // Stale warnings
  if (!research) {
    staleWarnings.push("No research data. Run Research to gather Reddit/X/web discussions.");
  } else if (research.generated_at) {
    const researchAge = (Date.now() - new Date(research.generated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (researchAge > 7) {
      staleWarnings.push(`Research is ${Math.round(researchAge)} days old. Re-run for fresher signals.`);
    }
  }
  if (!digest) {
    staleWarnings.push("No viral insights digest. Run /viral-scout for market intelligence.");
  }
  if (performanceData.length === 0) {
    staleWarnings.push("No performance metrics. Add video metrics for engagement predictions.");
  }

  // Build summary strings for AI prompt
  const researchSummary = buildResearchSummary(research);
  const digestSummary = buildDigestSummary(digest);
  const hookSummary = buildHookSummary(hookLibrary);
  const ideaSummary = buildIdeaSummary(ideas);
  const librarySummary = buildLibrarySummary(videos, coverageByAudience, coverageByFormat);

  // Top performers for feedback loop
  const { topPerformers, performanceSummary } = buildPerformanceSummary(videos, performanceData);

  return {
    coveredTopics,
    coverageByAudience,
    coverageByFormat,
    hooksByCategory,
    totalHooks,
    platformCadence,
    publishedByPlatform: {},
    avgViewsByFormat,
    avgEngagementByFormat,
    topPerformers,
    performanceSummary,
    dataSourceSummary,
    staleWarnings,
    researchSummary,
    digestSummary,
    hookSummary,
    ideaSummary,
    librarySummary,
  };
}

function buildResearchSummary(research: ResearchReport | null): string {
  if (!research) return "";
  const parts: string[] = [];

  if (research.reddit.length > 0) {
    parts.push("REDDIT DISCUSSIONS:");
    for (const r of research.reddit.slice(0, 15)) {
      const comments = r.engagement?.num_comments ?? 0;
      parts.push(`- r/${r.subreddit}: "${r.title}" (score: ${r.score}, comments: ${comments}) - ${r.why_relevant}`);
      if (r.comment_insights.length > 0) {
        parts.push(`  Insights: ${r.comment_insights.slice(0, 3).join("; ")}`);
      }
    }
  }

  if (research.x.length > 0) {
    parts.push("\nX/TWITTER POSTS:");
    for (const x of research.x.slice(0, 15)) {
      parts.push(`- @${x.author_handle}: "${x.text.slice(0, 120)}" (score: ${x.score}) - ${x.why_relevant}`);
    }
  }

  if (research.web.length > 0) {
    parts.push("\nWEB SOURCES:");
    for (const w of research.web.slice(0, 10)) {
      parts.push(`- ${w.source_domain}: "${w.title}" - ${w.snippet.slice(0, 150)}`);
    }
  }

  if (research.instagram?.length > 0) {
    parts.push("\nINSTAGRAM REELS TRENDS:");
    for (const i of research.instagram.slice(0, 8)) {
      parts.push(`- "${i.title}" (${i.source}) - ${i.snippet}`);
    }
  }

  if (research.tiktok?.length > 0) {
    parts.push("\nTIKTOK TRENDS:");
    for (const t of research.tiktok.slice(0, 8)) {
      parts.push(`- "${t.title}" (${t.source}) - ${t.snippet}`);
    }
  }

  if (research.facebook?.length > 0) {
    parts.push("\nFACEBOOK GROUP DISCUSSIONS:");
    for (const f of research.facebook.slice(0, 8)) {
      parts.push(`- "${f.title}" (${f.source}) - ${f.snippet}`);
    }
  }

  if (research.best_practices.length > 0) {
    parts.push("\nBEST PRACTICES:");
    for (const bp of research.best_practices.slice(0, 5)) {
      parts.push(`- ${bp}`);
    }
  }

  return parts.join("\n");
}

function buildDigestSummary(digest: IntelDigest | null): string {
  if (!digest) return "";
  const parts: string[] = [`MARKET INTELLIGENCE (${digest.date} digest):`];

  if (digest.trendingTopics.length > 0) {
    parts.push("\nTrending Topics:");
    for (const t of digest.trendingTopics) {
      parts.push(`- ${t.topic} (${t.platforms.join(", ")}) - ${t.context}, ${t.engagementRange}`);
    }
  }

  if (digest.hookPatterns.length > 0) {
    parts.push("\nHook Patterns Working Now:");
    for (const h of digest.hookPatterns) {
      parts.push(`- [${h.type}] "${h.text}" (${h.platform}, ${h.priority} priority)`);
    }
  }

  if (digest.contentGaps.length > 0) {
    parts.push("\nContent Gaps:");
    for (const g of digest.contentGaps) {
      parts.push(`- ${g.area}: ${g.description}`);
    }
  }

  if (digest.formatTrends.length > 0) {
    parts.push("\nFormat Trends:");
    for (const f of digest.formatTrends) {
      parts.push(`- Format ${f.format} (${f.platforms}): ${f.trend}`);
    }
  }

  return parts.join("\n");
}

function buildHookSummary(hookLibrary: HookPatternCategory[]): string {
  if (hookLibrary.length === 0) return "";
  const parts = ["PROVEN HOOK PATTERNS LIBRARY:"];
  for (const cat of hookLibrary) {
    parts.push(`\n${cat.name} (${cat.patterns.length} patterns):`);
    for (const p of cat.patterns.slice(0, 4)) {
      parts.push(`- "${p.pattern}" -> Example: "${p.example}" (Best: Format ${p.bestFormat}, ${p.platform}, optimizes ${p.optimizes})`);
    }
  }
  return parts.join("\n");
}

function buildIdeaSummary(ideas: Idea[]): string {
  const pending = ideas.filter((i) => i.category !== "archived");
  if (pending.length === 0) return "";
  const parts = [`PENDING IDEAS IN IDEA BANK (${pending.length} ideas):`];
  for (const i of pending.slice(0, 40)) {
    parts.push(`- "${i.topic}" (${i.category}, Format ${i.suggestedFormat}, ${i.priority} priority)`);
  }
  return parts.join("\n");
}

function buildPerformanceSummary(
  videos: ParsedVideo[],
  performanceData: Array<{ videoCode: string; views: number; likes: number; saves: number; shares: number; comments: number }>,
): { topPerformers: TopPerformerInfo[]; performanceSummary: string } {
  if (performanceData.length === 0) {
    return { topPerformers: [], performanceSummary: "" };
  }

  const videoMap = new Map(videos.map((v) => [v.code, v]));
  const ranked = performanceData
    .map((p) => {
      const video = videoMap.get(p.videoCode);
      if (!video) return null;
      const totalEngagement = p.likes + p.saves + p.shares + p.comments;
      return {
        videoCode: p.videoCode,
        title: video.title,
        format: video.format,
        audience: video.audienceLabel,
        totalViews: p.views,
        totalEngagement,
      };
    })
    .filter((x): x is TopPerformerInfo => x !== null)
    .sort((a, b) => b.totalViews + b.totalEngagement - (a.totalViews + a.totalEngagement))
    .slice(0, 10);

  if (ranked.length === 0) {
    return { topPerformers: [], performanceSummary: "" };
  }

  const parts = ["TOP PERFORMING VIDEOS (use these as success signals for similar content):"];
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    parts.push(`${i + 1}. ${r.videoCode}: "${r.title}" (Format ${r.format}, ${r.audience}, ${r.totalViews.toLocaleString()} views, ${r.totalEngagement.toLocaleString()} engagements)`);
  }
  parts.push("\nWhen an opportunity topic closely matches a top performer, set similarTopPerformer to that video's code and title (e.g., \"D2: Tech Neck Fix (9,200 views)\").");

  return { topPerformers: ranked, performanceSummary: parts.join("\n") };
}

function buildLibrarySummary(
  videos: ParsedVideo[],
  byAudience: Record<string, number>,
  byFormat: Record<string, number>,
): string {
  const parts = [`EXISTING CONTENT LIBRARY (${videos.length} videos):`];
  parts.push("\nBy Audience (coverage status):");
  for (const [aud, count] of Object.entries(byAudience)) {
    const label = count >= 9 ? "SATURATED - strongly prefer other audiences" : count >= 5 ? "BALANCED" : "UNDERSERVED - prioritize";
    parts.push(`- ${aud}: ${count} videos (${label})`);
  }
  parts.push("\nBy Format:");
  for (const [fmt, count] of Object.entries(byFormat)) {
    parts.push(`- Format ${fmt}: ${count} videos`);
  }
  parts.push("\nAll Video Titles (for coverage gap detection):");
  for (const v of videos) {
    parts.push(`- ${v.code}: "${v.title}" (Format ${v.format}, ${v.audienceLabel})`);
  }
  return parts.join("\n");
}
