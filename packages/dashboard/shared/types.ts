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

export const FORMAT_IDS = ["A", "B", "C", "D", "E"] as const;
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
};

export type VideoDetailResponse = ParsedVideo & {
  status: ProductionStatus;
  statusUpdatedAt: string | null;
  notes: string | null;
};

// ============================================
// Dashboard View Navigation
// ============================================

export const DASHBOARD_VIEWS = [
  "HOME",
  "PIPELINE",
  "LIBRARY",
  "CALENDAR",
  "SESSION",
] as const;

export type DashboardView = (typeof DASHBOARD_VIEWS)[number];
