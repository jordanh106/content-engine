export type PlatformSpec = {
  name: string;
  aspectRatio: string;
  maxDurationSeconds: number;
  idealDurationRange: string;
  captionRequirements: string;
  notes: string;
};

export const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  "Instagram Reels": {
    name: "Instagram Reels",
    aspectRatio: "9:16",
    maxDurationSeconds: 90,
    idealDurationRange: "15-30s",
    captionRequirements: "Auto-captions recommended, max 2200 chars description",
    notes: "Hook in first 1-2s, slower cuts outperform rapid cuts",
  },
  TikTok: {
    name: "TikTok",
    aspectRatio: "9:16",
    maxDurationSeconds: 600,
    idealDurationRange: "6-15s",
    captionRequirements: "Text-heavy overlays, trending sounds, max 2200 chars",
    notes: "Micro-content preferred for Format F, text overlays essential",
  },
  "YouTube Shorts": {
    name: "YouTube Shorts",
    aspectRatio: "9:16",
    maxDurationSeconds: 60,
    idealDurationRange: "30-60s",
    captionRequirements: "Burned-in captions recommended, SEO-friendly title",
    notes: "Slightly longer, more educational depth than Reels/TikTok",
  },
  "YouTube Long": {
    name: "YouTube Long",
    aspectRatio: "16:9",
    maxDurationSeconds: 43200,
    idealDurationRange: "3-10 min",
    captionRequirements: "SRT/VTT subtitles, detailed description with timestamps",
    notes: "Pattern: you speaking > Remotion graphic > B-roll > back to you",
  },
};
