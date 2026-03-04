// ============================================
// Production Status
// ============================================

export const PRODUCTION_STATUSES = [
  "SCRIPTED",
  "RECORDING",
  "GENERATING",
  "ASSEMBLED",
  "SCHEDULED",
  "PUBLISHED",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

// ============================================
// Video Formats
// ============================================

export const FORMAT_IDS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export type FormatInfo = {
  id: FormatId;
  name: string;
  shortName: string;
};

export const FORMATS: Record<FormatId, FormatInfo> = {
  A: { id: "A", name: "Explainer", shortName: "Explainer" },
  B: { id: "B", name: "Checklist", shortName: "Checklist" },
  C: { id: "C", name: "Demo", shortName: "Demo" },
  D: { id: "D", name: "Myth Buster", shortName: "Myth Buster" },
  E: { id: "E", name: "Walkthrough", shortName: "Walkthrough" },
  F: { id: "F", name: "Quick Tip", shortName: "Quick Tip" },
  G: { id: "G", name: "Patient Story", shortName: "Patient Story" },
};

// ============================================
// Parsed Video (from content-library.md)
// ============================================

export type ShotPrompt = {
  number: number;
  duration: number;
  prompt: string;
  cameraMovement: string;
};

export type ParsedVideo = {
  code: string;
  title: string;
  format: FormatId;
  formatName: string;
  duration: number;
  tags: string[];
  audience: string;
  audienceLabel: string;
  script: string;
  deliveryCues: string[];
  shots: ShotPrompt[];
  vibeMotion: string | null;
};

// ============================================
// Config (from config.json)
// ============================================

export type Audience = {
  id: string;
  label: string;
};

export type Condition = {
  id: string;
  label: string;
  audience: string;
};

export type IndustryConfig = {
  name: string;
  slug: string;
  audiences: Audience[];
  conditions: Condition[];
  platforms: string[];
  postingCadence: Record<string, string>;
  contentMix: Record<string, number>;
};

// ============================================
// API Response Types
// ============================================

export type VideoSummary = {
  code: string;
  title: string;
  format: FormatId;
  formatName: string;
  duration: number;
  audience: string;
  audienceLabel: string;
  tags: string[];
  status: ProductionStatus;
  scriptPreview: string;
  remotionGraphicsRequired: boolean;
  remotionGraphicsNotes: string | null;
};

export type VideoDetailResponse = ParsedVideo & {
  status: ProductionStatus;
  statusUpdatedAt: string | null;
  notes: string | null;
  remotionGraphicsRequired: boolean;
  remotionGraphicsNotes: string | null;
};

// ============================================
// Dashboard View Navigation
// ============================================

export const DASHBOARD_VIEWS = [
  "HOME",
  "PIPELINE",
  "LIBRARY",
  "IDEAS",
  "OPPORTUNITIES",
  "WATCHLIST",
  "CALENDAR",
  "SESSION",
  "COMPOSER",
  "METRICS",
] as const;

export type DashboardView = (typeof DASHBOARD_VIEWS)[number];

// ============================================
// Pipeline API Response Types
// ============================================

export type PipelineVideo = {
  code: string;
  title: string;
  format: FormatId;
  audience: string;
  audienceLabel: string;
  daysInStage: number;
};

export type PipelineResponse = {
  stages: Record<ProductionStatus, PipelineVideo[]>;
  summary: Record<ProductionStatus, number>;
  total: number;
};

// ============================================
// Remotion Render Job Types
// ============================================

export type RenderJobStatus = "queued" | "running" | "completed" | "failed";

export type RenderJob = {
  id: string;
  videoCode: string;
  compositionId: string;
  status: RenderJobStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  outputUrl: string | null;
  error: string | null;
  shotId: string | null;
  componentType: string | null;
};

export type RenderJobsResponse = {
  jobs: RenderJob[];
};

// ============================================
// Vibe Motion Component Types
// ============================================

export type VibeMotionComponent = {
  id: string;
  componentType: string;
  compositionId: string;
  durationInSeconds: number;
  props: Record<string, unknown>;
  label: string;
};

export type ShotsResponse = {
  components: VibeMotionComponent[];
  jobs: RenderJob[];
};

// ============================================
// Timeline Types
// ============================================

export type SceneFlowEntry = {
  scene: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  componentType: string;
  isRepeating: boolean;
  repeatingNote: string | null;
};

export type FormatTimingData = {
  formatId: FormatId;
  formatName: string;
  scenes: SceneFlowEntry[];
  totalDuration: [number, number];
};

export type TimelineItem = {
  id: string;
  type: "cinema-shot" | "motion-graphic" | "scene-marker";
  startTime: number;
  duration: number;
  label: string;
  sceneName: string | null;
  shot?: ShotPrompt;
  component?: VibeMotionComponent;
};

export type TimelineResponse = {
  items: TimelineItem[];
  formatTiming: FormatTimingData;
  totalDuration: number;
};

// ============================================
// AI Composer Types
// ============================================

export type ComponentOperation =
  | { action: "add"; component: VibeMotionComponent }
  | { action: "replace"; index: number; component: VibeMotionComponent }
  | {
      action: "modify";
      index: number;
      props: Record<string, unknown>;
      durationInSeconds?: number;
    }
  | { action: "remove"; index: number }
  | { action: "reorder"; order: number[] };

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ComposerAiRequest = {
  prompt: string;
  components: VibeMotionComponent[];
  selectedIndex: number | null;
  conversationHistory?: ConversationMessage[];
  videoContext: {
    code: string;
    title: string;
    format: string;
    script: string;
    audience: string;
    tags: string[];
  };
};

export type ComposerAiResponse = {
  operations: ComponentOperation[];
  message: string;
};

// ============================================
// Idea Bank Types
// ============================================

export type IdeaCategory = "trending" | "competitor" | "evergreen" | "audience" | "personal" | "archived";

export type Idea = {
  id: number;
  topic: string;
  suggestedFormat: string;
  hookAngle: string;
  priority: "High" | "Medium" | "Low";
  source: string;
  dateAdded: string;
  category: IdeaCategory;
};

// ============================================
// Idea Generator AI Types
// ============================================

export type IdeaGenerateRequest = {
  prompt: string;
  conversationHistory: ConversationMessage[];
  existingTopics: string[];
};

export type GeneratedIdea = {
  topic: string;
  suggestedFormat: string;
  hookAngle: string;
  priority: "High" | "Medium" | "Low";
  category: IdeaCategory;
};

export type IdeaGenerateResponse = {
  ideas: GeneratedIdea[];
  message: string;
};

// ============================================
// Caption Generator Types
// ============================================

export type CaptionRequest = {
  prompt: string;
  conversationHistory: ConversationMessage[];
  context: {
    topic: string;
    hookAngle?: string;
    suggestedFormat?: string;
    category?: string;
    script?: string;
  };
};

export type CaptionResponse = {
  captions: { platform: string; caption: string }[];
  message: string;
};

// ============================================
// Watchlist Types
// ============================================

export type WatchlistCreator = {
  handle: string;
  platform: string;
  followers: string;
  whyTracking: string;
  contentStyle: string;
  frequency: string;
  lastAnalyzed: string;
};

// ============================================
// Content Intelligence Types
// ============================================

export type TrendingTopic = {
  topic: string;
  platforms: string[];
  context: string;
  engagementRange: string;
};

export type HookPattern = {
  type: string;
  text: string;
  platform: string;
  priority: string;
};

export type FormatTrend = {
  format: string;
  trend: string;
  platforms: string;
};

export type ContentGap = {
  area: string;
  description: string;
};

export type IntelDigest = {
  date: string;
  trendingTopics: TrendingTopic[];
  hookPatterns: HookPattern[];
  formatTrends: FormatTrend[];
  creatorHighlights: string[];
  contentGaps: ContentGap[];
  recommendedIdeas: string[];
  nextActions: string[];
};

// ============================================
// Research Report Types (from /last30days skill)
// ============================================

export type ResearchEngagement = {
  // Reddit fields
  score?: number;
  num_comments?: number;
  upvote_ratio?: number;
  // X fields
  likes?: number;
  reposts?: number;
  replies?: number;
  quotes?: number;
};

export type RedditThread = {
  id: string;
  title: string;
  url: string;
  subreddit: string;
  date: string | null;
  engagement: ResearchEngagement | null;
  comment_insights: string[];
  relevance: number;
  why_relevant: string;
  score: number;
};

export type XPost = {
  id: string;
  text: string;
  url: string;
  author_handle: string;
  date: string | null;
  engagement: ResearchEngagement | null;
  relevance: number;
  why_relevant: string;
  score: number;
};

export type WebResult = {
  id: string;
  title: string;
  url: string;
  source_domain: string;
  snippet: string;
  date: string | null;
  relevance: number;
  why_relevant: string;
  score: number;
};

export type ResearchReport = {
  topic: string;
  range: { from: string; to: string };
  generated_at: string;
  mode: string;
  reddit: RedditThread[];
  x: XPost[];
  web: WebResult[];
  best_practices: string[];
  reddit_error?: string;
  x_error?: string;
  web_error?: string;
  from_cache?: boolean;
  cache_age_hours?: number;
};

// ============================================
// Hook Patterns Library (from hook-patterns.md)
// ============================================

export type HookPatternEntry = {
  pattern: string;
  example: string;
  bestFormat: string;
  platform: string;
  optimizes: string;
};

export type HookPatternCategory = {
  name: string;
  description: string;
  patterns: HookPatternEntry[];
};

// ============================================
// Unified Intelligence Response
// ============================================

export type UnifiedIntelligenceResponse = {
  digest: IntelDigest | null;
  availableDates: string[];
  research: ResearchReport | null;
  hookLibrary: HookPatternCategory[];
  counts: {
    redditThreads: number;
    xPosts: number;
    webResults: number;
    hookPatterns: number;
  };
};

// ============================================
// Metrics Intelligence Types
// ============================================

export type MetricsSyncEntry = {
  videoCode?: string;
  postTitle?: string;
  platformPostId?: string;
  platform: string;
  views: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
  watchTimeSeconds?: number;
  recordedAt: string;
};

export type MetricsInsight = {
  type: "win" | "opportunity" | "trend" | "recommendation";
  title: string;
  detail: string;
  relatedFormat?: string;
  relatedPlatform?: string;
};

export type ContentRecommendation = {
  ideaTopic: string;
  reason: string;
  suggestedFormat: string;
  suggestedPlatform: string;
  confidenceScore: "high" | "medium" | "low";
};

export type MetricsInsightsResponse = {
  insights: MetricsInsight[];
  summary: string;
  recommendations: ContentRecommendation[];
};

// ============================================
// Content Opportunity Aggregator Types
// ============================================

export const OPPORTUNITY_DIMENSIONS = [
  "audienceDemand",
  "competitionGap",
  "trendMomentum",
  "formatFit",
  "hookAvailability",
  "platformAlignment",
  "engagementPotential",
] as const;

export type OpportunityDimension = (typeof OPPORTUNITY_DIMENSIONS)[number];

export type DimensionScore = {
  dimension: OpportunityDimension;
  score: number;
  rationale: string;
};

export type OpportunityEvidence = {
  type: "reddit" | "x" | "web" | "viral-digest" | "performance";
  title: string;
  detail: string;
  url?: string;
  engagement?: { score?: number; upvotes?: number; comments?: number };
};

export type SuggestedHook = {
  pattern: string;
  example: string;
  category: string;
  optimizes: string;
};

export type CompetitionCheck = {
  coveredVideos: string[];
  gapDescription: string;
  coverageLevel: "none" | "partial" | "saturated";
};

export type CommunitySignals = {
  redditThreads: number;
  topRedditTitle: string | null;
  topRedditScore: number;
  xPosts: number;
  topXPreview: string | null;
  topXScore: number;
  webArticles: number;
};

export type ContentOpportunity = {
  id: string;
  topic: string;
  overallScore: number;
  dimensions: DimensionScore[];
  suggestedFormat: FormatId;
  formatRationale: string;
  suggestedHook: SuggestedHook;
  targetPlatform: string;
  targetAudience: string;
  evidence: OpportunityEvidence[];
  whyNow: string;
  competitionCheck: CompetitionCheck;
  communitySignals: CommunitySignals;
  ideaBankMatch: string | null;
};

export type DataSourceSummary = {
  redditThreads: number;
  xPosts: number;
  webResults: number;
  hookPatterns: number;
  existingVideos: number;
  ideasInBank: number;
  hasDigest: boolean;
};

export type OpportunitiesResponse = {
  opportunities: ContentOpportunity[];
  generatedAt: string;
  dataSourceSummary: DataSourceSummary;
  staleWarnings: string[];
};
