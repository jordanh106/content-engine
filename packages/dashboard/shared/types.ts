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
  "CAPTIONS",
  "VAULT",
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
// Conversation Types
// ============================================

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
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

export type PlatformResearchItem = {
  title: string;
  url: string;
  source: string;
  snippet: string;
  relevance: number;
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
  instagram: PlatformResearchItem[];
  tiktok: PlatformResearchItem[];
  facebook: PlatformResearchItem[];
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
  "audienceDiversity",
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
  similarTopPerformer?: string | null;
};

export type DataSourceSummary = {
  redditThreads: number;
  xPosts: number;
  webResults: number;
  instagramResults: number;
  tiktokResults: number;
  facebookResults: number;
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

// ============================================
// Analytics Types (Production Velocity, Content Mix, Cadence)
// ============================================

export type StageTransition = {
  fromStatus: string;
  toStatus: string;
  avgDays: number;
  medianDays: number;
  count: number;
};

export type VelocityResponse = {
  transitions: StageTransition[];
  bottleneck: { stage: string; avgDays: number } | null;
  avgDaysTotal: number;
  completedVideos: number;
};

export type ContentMixResponse = {
  targets: Record<string, number>;
  actual: Record<string, number>;
  totalPublished: number;
  compliant: boolean;
  deviations: Array<{ type: string; target: number; actual: number; delta: number }>;
};

export type CadenceWeek = {
  weekLabel: string;
  weekStart: string;
  platforms: Array<{ platform: string; target: number; actual: number; onTrack: boolean }>;
};

export type CadenceResponse = {
  weeks: CadenceWeek[];
  overall: Array<{ platform: string; avgPerWeek: number; target: number; onTrack: boolean }>;
};

// ============================================
// Session Planner Types
// ============================================

export type SessionType = "voiceover" | "generation" | "assembly";

export type SessionItem = {
  videoCode: string;
  title: string;
  format: FormatId;
  completed: boolean;
  completedAt: string | null;
  orderIndex: number;
};

export type ProductionSession = {
  id: number;
  sessionType: SessionType;
  audienceCategory: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  videoCodes: string[];
  items: SessionItem[];
};

export type AvailableVideosResponse = {
  videos: Array<{
    code: string;
    title: string;
    format: FormatId;
    audience: string;
    audienceLabel: string;
  }>;
  sessionType: SessionType;
};

// ============================================
// Calendar Types
// ============================================

export type CalendarEntry = {
  id: number;
  date: string;
  platform: string;
  videoCode: string | null;
  slotLabel: string | null;
  status: string;
  notes: string | null;
  videoTitle?: string;
  videoFormat?: FormatId;
};

export type CalendarResponse = {
  entries: CalendarEntry[];
  platforms: string[];
};

export type CalendarGap = {
  platform: string;
  week: string;
  target: number;
  actual: number;
  deficit: number;
};

// ============================================
// Creator Insights Types
// ============================================

export type CreatorInsight = {
  handle: string;
  analyzedAt: string;
  contentPatterns: string[];
  hookStyles: string[];
  postingFrequency: string;
  topPerformingFormats: string[];
  keyTakeaways: string[];
  rawMarkdown: string;
};

// ============================================
// Production Plan Types
// ============================================

export type ProductionPlan = {
  videoCode: string;
  title: string;
  generatedAt: string;
  hookVariations: string[];
  platformOptimization: Record<string, string>;
  shotList: string[];
  rawMarkdown: string;
};

// ============================================
// Watchlist Intelligence Types
// ============================================

export type WatchlistIntelIdea = {
  topic: string;
  suggestedFormat: string;
  hookAngle: string;
  priority: string;
  source: string;
  category: IdeaCategory;
  inspiredBy: string;
  whyNonObvious: string;
  targetAudience: string;
};

export type RisingCreator = {
  handle: string;
  platform: string;
  followers: string;
  whyWatch: string;
};

export type SelfImprovementNotes = {
  bestQueries: string[];
  mostActionableCreators: string[];
  nextScanFocus: string;
};

export type WatchlistIntelReport = {
  date: string;
  markdown: string;
  ideas: WatchlistIntelIdea[];
  risingCreators: RisingCreator[];
  selfImprovementNotes: SelfImprovementNotes;
  previousTopics: string[];
};

// ============================================
// Saved Caption Types
// ============================================

export type SavedCaption = {
  id: number;
  videoCode: string;
  platform: string;
  caption: string;
  variant: number;
  status: "draft" | "approved" | "posted";
  createdAt: string;
  updatedAt: string;
};

// ============================================
// Channel Snapshot / Benchmarking Types
// ============================================

export type ChannelSnapshot = {
  id: number;
  handle: string;
  platform: string;
  followers: number | null;
  avgViews: number | null;
  engagementRateBps: number | null;
  saveRateBps: number | null;
  postsPerWeek: number | null;
  recordedAt: string;
  notes: string | null;
};

export type BenchmarkComparison = {
  yourMetrics: {
    avgViews: number;
    avgEngagementRate: number;
    avgSaveRate: number;
    postsPerWeek: number;
    totalPublished: number;
  };
  competitors: Array<{
    handle: string;
    platform: string;
    latestSnapshot: ChannelSnapshot;
    trend: "growing" | "stable" | "declining" | "unknown";
  }>;
};

// ============================================
// Smart Action Feed Types
// ============================================

export type ActionItem = {
  type: "captions" | "cadence" | "stuck" | "opportunity" | "session";
  priority: number;
  title: string;
  detail: string;
  actionLabel: string;
  targetView: DashboardView;
  urgency: "today" | "this_week" | "recommendation";
};

export type ActionsResponse = {
  actions: ActionItem[];
};

// ============================================
// Onboarding Types
// ============================================

export type OnboardingProgress = {
  welcomeCompleted: boolean;
  tourCompleted: boolean;
  tourStep: number;
  checklist: Record<string, boolean>;
  firstVisitDate: string;
  viewsVisited: string[];
};

export type TourStep = {
  targetSelector: string;
  title: string;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  view?: DashboardView;
};

export type ChecklistItem = {
  id: string;
  label: string;
  eventId: string;
  targetView?: DashboardView;
};

export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  items: string[];
};

// ============================================
// Vault Types (Hooks + Styles)
// ============================================

export type VaultHook = {
  id: number;
  pattern: string;
  example: string | null;
  category: string;
  sourceCreator: string | null;
  sourceUrl: string | null;
  bestFormat: string | null;
  platform: string | null;
  optimizes: string | null;
  variables: string[];
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  isLibrary?: boolean;
};

export type VaultStyle = {
  id: number;
  name: string;
  description: string | null;
  sourceCreator: string | null;
  sourceUrl: string | null;
  sourceTranscript: string | null;
  styleRules: {
    sentenceLength: string;
    tone: string;
    structure: string;
    techniques: string[];
    doNot: string[];
  };
  exampleScript: string | null;
  usageCount: number;
  createdAt: string;
};

// ============================================
// Creator Videos + Outlier Detection Types
// ============================================

export type CreatorVideo = {
  id: number;
  creatorHandle: string;
  platform: string;
  videoUrl: string | null;
  videoTitle: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  outlierScoreX100: number | null;
  recordedAt: string;
  createdAt: string;
};

export type VideoBreakdown = {
  id: number;
  creatorVideoId: number | null;
  creatorHandle: string | null;
  videoUrl: string | null;
  topic: string | null;
  angle: string | null;
  hookFormat: string | null;
  storyStyle: string | null;
  visualFormat: string | null;
  visuals: string | null;
  audio: string | null;
  rawNotes: string | null;
  createdAt: string;
  // Deep DNA fields (Feature 1)
  typographySystem: string | null;
  storyStructure: string | null;
  aestheticKeywords: string | null;
  colorPalette: string | null;
  setDesign: string | null;
  musicAudio: string | null;
  transitionStyle: string | null;
  replicationPlan: string | null;
  brollTypes: string | null;
  oneSentenceConcept: string | null;
};

// Parsed deep DNA structures
export type StoryStructure = {
  hook: { description: string; timestamp: string };
  conflict: { description: string; timestamp: string };
  build: { description: string; timestamp: string };
  resolution: { description: string; timestamp: string };
  cta: { description: string; timestamp: string };
};

export type TypographySystem = {
  title: string;
  header: string;
  caption: string;
  overlayStyle: string;
};

export type ColorPalette = {
  primary: string;
  secondary: string;
  accent: string;
  mood: string;
  grading?: string;
};

export type SetDesignInfo = {
  elements: string[];
  lighting: string;
  environment: string;
};

export type MusicAudioInfo = {
  mood: string;
  bpm: string;
  genre: string;
  energyCurve: string;
};

export type BrollTypes = {
  macro: string[];
  process: string[];
  reveal: string[];
};

// ============================================
// Script Versions Types
// ============================================

export type ScriptVersion = {
  id: number;
  videoCode: string | null;
  ideaTopic: string | null;
  version: number;
  script: string;
  hookId: number | null;
  styleId: number | null;
  changeNote: string | null;
  createdAt: string;
};

// ============================================
// Content Waterfall Types
// ============================================

export type WaterfallEntry = {
  id: number;
  sourceVideoCode: string;
  derivedVideoCode: string | null;
  tier: "source" | "cutdown" | "short" | "text";
  platform: string | null;
  description: string | null;
  status: "idea" | "created" | "published";
  performanceNote: string | null;
  createdAt: string;
};

// ============================================
// Idea Concept Types (Feature 5)
// ============================================

export type IdeaConcept = {
  id: number;
  ideaTopic: string;
  oneSentence: string;
  technicalInterestScore: number;
  emotionalResonanceScore: number;
  tenSecondExplainabilityScore: number;
  visualPayoffScore: number;
  overallScore: number;
  aiFeedback: string | null;
  refinedVersion: string | null;
  approved: boolean;
  createdAt: string;
};

// ============================================
// Visual Style Types (Feature 2)
// ============================================

export type VaultVisualStyle = {
  id: number;
  name: string;
  description: string | null;
  sourceCreator: string | null;
  sourceUrl: string | null;
  sourceBreakdownIds: string | null;
  typographySystem: string;
  colorPalette: string;
  transitionRules: string | null;
  setDesignRules: string | null;
  musicGuidelines: string | null;
  motionGraphicsStyle: string | null;
  doNot: string | null;
  usageCount: number;
  createdAt: string;
};

// ============================================
// Storyboard Types (Feature 3)
// ============================================

export type Storyboard = {
  id: number;
  videoCode: string;
  visualStyleId: number | null;
  oneSentenceConcept: string | null;
  storyStructure: string | null;
  totalDurationSeconds: number | null;
  status: "draft" | "approved" | "in_production" | "completed";
  createdAt: string;
  updatedAt: string;
  shots?: StoryboardShot[];
};

export type StoryboardShot = {
  id: number;
  storyboardId: number;
  shotNumber: number;
  act: "hook" | "conflict" | "build" | "resolution" | "cta" | null;
  durationSeconds: number;
  shotType: string | null;
  cameraMovement: string | null;
  cinemaStudioPrompt: string | null;
  scriptLine: string | null;
  brollType: "macro" | "process" | "reveal" | null;
  productionMethod: "real" | "ai_enhanced" | "ai_generated" | "motion_graphic";
  aiEnhancementNotes: string | null;
  remotionComponent: string | null;
  notes: string | null;
  orderIndex: number;
  createdAt: string;
};

// ============================================
// AI Generation Prompt Types (Feature 4)
// ============================================

export type AiGenerationPrompt = {
  id: number;
  storyboardShotId: number | null;
  videoCode: string;
  shotNumber: number | null;
  technique: "set_enhancement" | "ai_transition" | "scene_extension" | "full_generation";
  tool: string | null;
  model: string | null;
  promptText: string;
  promptVersion: number;
  sourceDescription: string | null;
  targetDescription: string | null;
  resultNotes: string | null;
  resultRating: number | null;
  status: "draft" | "generating" | "completed" | "rejected";
  createdAt: string;
};
