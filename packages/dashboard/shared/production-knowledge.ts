// ============================================
// Production Knowledge Base
// Structured constants from production guides
// ============================================

import type { ProductionStyle } from "./types.js";

// ============================================
// Types
// ============================================

export type CinemaDefaults = {
  camera: string;
  lens: string;
  focalLength: string;
  genre: string;
  colorNotes: string;
};

export type AiModelInfo = {
  speed: "fast" | "medium" | "slow";
  quality: "good" | "high" | "highest";
  bestFor: string;
};

export type HiggsfieldToolInfo = {
  purpose: string;
  whenToUse: string;
};

export type VfxTrickInfo = {
  id: string;
  name: string;
  description: string;
  steps: string[];
  bestFor: string[];
};

export type ChecklistItem = {
  key: string;
  label: string;
  critical: boolean;
};

export type ToolModelRecommendation = {
  tool: string;
  model: string;
  reason: string;
};

export type CameraMovementSuggestion = {
  movement: string;
  reason: string;
};

// ============================================
// Per-Format Camera Defaults
// From cinema-defaults.md
// ============================================

export const CINEMA_DEFAULTS_BY_FORMAT: Record<string, CinemaDefaults> = {
  A: {
    camera: "ARRI Alexa",
    lens: "Cooke",
    focalLength: "35mm",
    genre: "Intimate",
    colorNotes: "Warm, inviting, teal accents",
  },
  B: {
    camera: "ARRI Alexa",
    lens: "Cooke",
    focalLength: "35mm",
    genre: "Intimate",
    colorNotes: "Warm, inviting, teal accents",
  },
  C: {
    camera: "Sony Venice",
    lens: "Canon K35",
    focalLength: "24mm",
    genre: "Intimate",
    colorNotes: "Bright, clean, wellness aesthetic",
  },
  D: {
    camera: "RED V-RAPTOR",
    lens: "Zeiss Ultra Prime",
    focalLength: "50mm",
    genre: "Auto",
    colorNotes: "High contrast for myth/truth split",
  },
  E: {
    camera: "ARRI Alexa",
    lens: "Cooke",
    focalLength: "35mm",
    genre: "Intimate",
    colorNotes: "Warm clinical setting, reassuring",
  },
  F: {
    camera: "ARRI Alexa",
    lens: "Cooke",
    focalLength: "35mm",
    genre: "Intimate",
    colorNotes: "Warm, inviting, teal accents",
  },
  G: {
    camera: "ARRI Alexa",
    lens: "Cooke",
    focalLength: "35mm",
    genre: "Intimate",
    colorNotes: "Warm, emotional, cinematic mood",
  },
};

// ============================================
// AI Model Recommendations
// From higgsfield-guide.md
// ============================================

export const AI_MODELS: Record<string, AiModelInfo> = {
  "Minimax Hailuo 02": {
    speed: "fast",
    quality: "good",
    bestFor: "Fast iteration, most shots, time-sensitive trends",
  },
  "Sora 2": {
    speed: "slow",
    quality: "highest",
    bestFor: "Hero shots, final quality, office tours, service spotlights",
  },
  "WAN 2.6": {
    speed: "medium",
    quality: "high",
    bestFor: "Multi-shot continuity, sequences that need visual consistency",
  },
  "Kling 2.6/3.0": {
    speed: "medium",
    quality: "high",
    bestFor: "Lip-sync work, voice clone integration",
  },
};

// ============================================
// Higgsfield Tool Selection
// From higgsfield-guide.md
// ============================================

export const HIGGSFIELD_TOOLS: Record<string, HiggsfieldToolInfo> = {
  "Mixed Media": {
    purpose: "Apply signature visual look to all real clips",
    whenToUse: "Every batch session. First step for all real footage.",
  },
  "Cinema Studio": {
    purpose: "Add cinematic camera moves to static shots",
    whenToUse: "When a phone clip needs dolly, orbit, crane, or push-in movement",
  },
  Upscale: {
    purpose: "Match phone footage quality to AI segments",
    whenToUse: "When cutting between real and AI footage with noticeable quality gap",
  },
  "Motion Engine": {
    purpose: "Smooth shaky real footage",
    whenToUse: "When a clip has good content but unstable camera",
  },
  "Lipsync Studio": {
    purpose: "Polish speaking performances or sync voice clones",
    whenToUse: "When redoing audio pacing or creating voice clone lip sync",
  },
};

// ============================================
// VFX Tricks
// From higgsfield-guide.md (The 3 VFX Tricks)
// ============================================

export const VFX_TRICKS: VfxTrickInfo[] = [
  {
    id: "scene_extension",
    name: "Scene Extension",
    description: "Film a real moment, then AI continues the scene seamlessly",
    steps: [
      "Film a real 3-5 second clip",
      "Extract the last frame of your clip",
      "Use that frame as the start frame for AI generation",
      "AI continues the scene with cinematic quality",
    ],
    bestFor: ["Office tours", "Patient arrivals", "Transitions between real clips"],
  },
  {
    id: "impossible_camera",
    name: "Impossible Camera Moves",
    description: "Take a static phone shot and add cinema-grade camera movements",
    steps: [
      "Film a steady 3-5 second clip (tripod or stable surface)",
      "Upload to Cinema Studio",
      "Apply a camera preset (Slow Orbit, Crane Up, Bullet Time, etc.)",
      "Static clip now has Hollywood-level camera movement",
    ],
    bestFor: ["Treatment room reveals", "Equipment showcases", "Dramatic freeze moments"],
  },
  {
    id: "environment_enhancement",
    name: "Environment Enhancement",
    description: "AI enhances or transforms the environment while preserving your real performance",
    steps: [
      "Record yourself speaking or demonstrating against any background",
      "Upload to Mixed Media",
      "AI enhances the environment (lighting, background, atmosphere)",
      "Your real movements and expressions stay intact",
    ],
    bestFor: ["Tips filmed in imperfect spaces", "Exercise demos", "Consistent brand aesthetic"],
  },
];

// ============================================
// Filming Tips by Production Method
// ============================================

const FILMING_TIPS_REAL: string[] = [
  "Natural window light at 45 degrees",
  "Tripod or stable surface, never handheld",
  "Look directly into the lens at eye level",
  "Clean, uncluttered background",
  "Lock exposure so it doesn't auto-adjust",
  "3-15 seconds per clip, the sweet spot for processing",
];

const FILMING_TIPS_ENHANCED: string[] = [
  ...FILMING_TIPS_REAL,
  "Leave breathing room around the subject for AI to work with",
  "Film extra 2-3s at end for potential scene extension",
  "Shoot a wide establishing shot for environment enhancement",
  "Export a reference frame for color-grade matching later",
];

const GENERATION_TIPS_AI: string[] = [
  "Include camera body, lens, focal length, and genre in prompts",
  "Use format-specific camera defaults as the starting point",
  "For hero shots, use Sora 2. For iteration, use Minimax.",
  "Describe the emotional tone, not just the visual content",
  "Keep prompts under 100 words for consistency",
];

const GENERATION_TIPS_MOTION: string[] = [
  "Verify Remotion component props match the schema",
  "Preview at 1080x1920 (9:16) at 30fps before final render",
  "Use brand colors: teal #0d9488, cream, gold accents",
  "Keep text large enough to read on mobile (min 48px)",
];

export function getFilmingTips(
  productionMethod: string,
  _productionStyle: ProductionStyle | null,
): string[] {
  switch (productionMethod) {
    case "real":
      return FILMING_TIPS_REAL;
    case "ai_enhanced":
      return FILMING_TIPS_ENHANCED;
    case "ai_generated":
      return GENERATION_TIPS_AI;
    case "motion_graphic":
      return GENERATION_TIPS_MOTION;
    default:
      return FILMING_TIPS_REAL;
  }
}

// ============================================
// Pre-Production Checklists
// Per production style
// ============================================

export const PRE_PRODUCTION_CHECKLISTS: Record<ProductionStyle, ChecklistItem[]> = {
  real: [
    { key: "tripod_ready", label: "Tripod or stable surface ready", critical: true },
    { key: "lighting_check", label: "Natural light at 45 degrees or consistent overhead", critical: true },
    { key: "audio_test", label: "Test audio levels (peak at -6dB)", critical: true },
    { key: "background_clean", label: "Clean, uncluttered background", critical: false },
    { key: "script_rehearsed", label: "Script rehearsed 2x", critical: false },
    { key: "exposure_locked", label: "Exposure locked (no auto-adjust mid-clip)", critical: false },
  ],
  enhanced: [
    { key: "tripod_ready", label: "Tripod or stable surface ready", critical: true },
    { key: "lighting_check", label: "Natural light at 45 degrees or consistent overhead", critical: true },
    { key: "audio_test", label: "Test audio levels (peak at -6dB)", critical: true },
    { key: "background_clean", label: "Clean, uncluttered background", critical: false },
    { key: "script_rehearsed", label: "Script rehearsed 2x", critical: false },
    { key: "breathing_room", label: "Leave extra framing space for AI to work with", critical: true },
    { key: "reference_frame", label: "Plan to export reference frame for color matching", critical: true },
    { key: "extra_wide_shot", label: "Plan extra wide/long takes for scene extension", critical: false },
    { key: "mixed_media_preset", label: "Mixed Media preset selected (Clean/Premium or Cinematic Mood)", critical: false },
  ],
  heavy_ai: [
    { key: "audio_test", label: "Test audio levels for voiceover (peak at -6dB)", critical: true },
    { key: "hook_filmed", label: "Hook shot filmed (if talent appears in hook)", critical: false },
    { key: "cinema_defaults", label: "Cinema Studio camera defaults confirmed for this format", critical: true },
    { key: "prompts_drafted", label: "AI generation prompts reviewed per shot", critical: true },
    { key: "model_selected", label: "AI model selected per shot (Sora 2 for hero, Minimax for iteration)", critical: false },
  ],
  full_ai: [
    { key: "quiet_room", label: "Quiet room for voiceover recording", critical: true },
    { key: "mic_distance", label: "Consistent mic distance (6-8 inches)", critical: true },
    { key: "audio_test", label: "Test audio levels (peak at -6dB, no room echo)", critical: true },
    { key: "script_timing", label: "Script read-through timed to match shot durations", critical: true },
    { key: "cinema_defaults", label: "Cinema Studio camera defaults confirmed for this format", critical: true },
    { key: "prompts_drafted", label: "All AI generation prompts reviewed", critical: true },
    { key: "model_selected", label: "AI model selected per shot", critical: false },
  ],
};

// ============================================
// Post-Production Quality Checklists
// Per production style
// ============================================

export const POST_PRODUCTION_CHECKLISTS: Record<ProductionStyle, ChecklistItem[]> = {
  real: [
    { key: "footage_stable", label: "All footage is stable (no shaky clips)", critical: true },
    { key: "audio_clean", label: "Audio clean, no clipping or background noise", critical: true },
    { key: "consistent_look", label: "Mixed Media preset applied to all clips", critical: false },
    { key: "phone_review", label: "Watch full edit on phone at 1x speed", critical: true },
  ],
  enhanced: [
    { key: "seamless_test", label: "Watch full edit on phone at 1x - can you spot where AI begins?", critical: true },
    { key: "color_match", label: "Color temperature consistent across real and AI shots", critical: true },
    { key: "motion_track", label: "AI elements track naturally with camera movement", critical: true },
    { key: "upscale_match", label: "Upscaled phone footage matches AI segment resolution", critical: true },
    { key: "audio_sync", label: "Voiceover timing matches visual pacing", critical: false },
    { key: "cut_points", label: "No visible jump at cut points between real and AI", critical: true },
  ],
  heavy_ai: [
    { key: "renders_quality", label: "All AI renders pass visual quality check", critical: true },
    { key: "color_consistent", label: "Color grade consistent across all AI shots", critical: true },
    { key: "hook_match", label: "Hook real footage matches AI visual style", critical: true },
    { key: "audio_sync", label: "Voiceover timing matches visual pacing", critical: true },
    { key: "motion_natural", label: "AI motion looks natural (no uncanny movement)", critical: true },
  ],
  full_ai: [
    { key: "renders_quality", label: "All AI renders pass visual quality check", critical: true },
    { key: "color_consistent", label: "Color grade consistent across all shots", critical: true },
    { key: "audio_sync", label: "Voiceover timing matches visual pacing", critical: true },
    { key: "motion_natural", label: "AI motion looks natural (no uncanny movement)", critical: true },
    { key: "lip_sync", label: "Lip sync matches voiceover (if voice clone used)", critical: false },
    { key: "graphics_branded", label: "Remotion graphics use correct brand colors", critical: false },
  ],
};

// ============================================
// Pipeline Quality Gate Items
// Per stage transition
// ============================================

export const QUALITY_GATE_ITEMS: Record<string, ChecklistItem[]> = {
  "SCRIPTED->RECORDING": [
    { key: "style_set", label: "Production style assigned", critical: true },
    { key: "storyboard_done", label: "Storyboard generated and reviewed", critical: false },
    { key: "equipment_ready", label: "Equipment and setup ready", critical: false },
  ],
  "RECORDING->GENERATING": [
    { key: "footage_captured", label: "All real footage captured", critical: true },
    { key: "voiceover_done", label: "Voiceover recorded", critical: true },
    { key: "audio_quality", label: "Audio quality verified (no clipping, consistent room tone)", critical: true },
  ],
  "GENERATING->ASSEMBLED": [
    { key: "renders_complete", label: "All AI generations completed", critical: true },
    { key: "color_consistent", label: "Color grade consistent across real and AI shots", critical: true },
    { key: "seamless_cuts", label: "Seamless transitions verified", critical: true },
    { key: "graphics_rendered", label: "All Remotion motion graphics rendered", critical: false },
  ],
  "ASSEMBLED->SCHEDULED": [
    { key: "final_review", label: "Full video reviewed at 1x speed on phone", critical: true },
    { key: "captions_done", label: "Captions written and scored", critical: true },
    { key: "platform_exports", label: "Platform-specific exports ready", critical: false },
  ],
  "SCHEDULED->PUBLISHED": [
    { key: "posted", label: "Posted to all scheduled platforms", critical: true },
    { key: "hashtags_applied", label: "Captions and hashtags applied", critical: false },
  ],
};

// ============================================
// Camera Movement Suggestions
// Based on shot context
// ============================================

const MOVEMENT_BY_ACT: Record<string, { movement: string; reason: string }> = {
  hook: { movement: "Slow Push In", reason: "Draws viewer in during the critical first 3 seconds" },
  conflict: { movement: "Static or Slow Orbit", reason: "Stable framing lets the conflict land" },
  build: { movement: "Tracking or Dolly", reason: "Forward movement builds momentum" },
  resolution: { movement: "Crane Up", reason: "Rising movement signals resolution and payoff" },
  cta: { movement: "Slow Push In", reason: "Tightening frame creates intimacy for the ask" },
};

const MOVEMENT_BY_SHOT_TYPE: Record<string, { movement: string; reason: string }> = {
  wide: { movement: "Slow Orbit or Crane", reason: "Wide shots benefit from sweeping movements" },
  medium: { movement: "Slow Push In or Static", reason: "Medium shots work with subtle or no movement" },
  closeup: { movement: "Static or Slow Push In", reason: "Close-ups need stability to maintain intimacy" },
  macro: { movement: "Static", reason: "Macro detail shots need rock-steady framing" },
  pov: { movement: "Tracking", reason: "POV shots should follow natural eye movement" },
  insert: { movement: "Static or Slow Orbit", reason: "Insert shots need clean, readable framing" },
};

export function suggestCameraMovement(
  shotType: string | null,
  act: string | null,
  productionMethod: string,
  _formatId: string,
): CameraMovementSuggestion | null {
  if (productionMethod === "real" || productionMethod === "motion_graphic") {
    return null; // real shots use phone camera, motion graphics don't have camera moves
  }

  // Prefer act-based suggestion, fall back to shot-type
  if (act && MOVEMENT_BY_ACT[act]) {
    return MOVEMENT_BY_ACT[act];
  }
  if (shotType && MOVEMENT_BY_SHOT_TYPE[shotType]) {
    return MOVEMENT_BY_SHOT_TYPE[shotType];
  }
  return { movement: "Static", reason: "Default to static when context is unclear" };
}

// ============================================
// Tool + Model Recommendation
// Based on shot production method and context
// ============================================

export function recommendToolAndModel(
  productionMethod: string,
  shotType: string | null,
  act: string | null,
): ToolModelRecommendation | null {
  if (productionMethod === "real") {
    return {
      tool: "Mixed Media",
      model: "N/A",
      reason: "Apply signature look preset to all real footage",
    };
  }

  if (productionMethod === "motion_graphic") {
    return {
      tool: "Remotion",
      model: "N/A",
      reason: "Render via Remotion Studio",
    };
  }

  if (productionMethod === "ai_enhanced") {
    // Scene extension or environment enhancement
    if (act === "hook" || act === "cta") {
      return {
        tool: "Cinema Studio",
        model: "Sora 2",
        reason: "Hero moments deserve highest quality. Use Slow Push In.",
      };
    }
    return {
      tool: "Mixed Media + Cinema Studio",
      model: "Minimax Hailuo 02",
      reason: "Apply Mixed Media preset first, then add camera move if needed",
    };
  }

  if (productionMethod === "ai_generated") {
    const isHeroShot = act === "hook" || act === "resolution" || shotType === "wide";
    if (isHeroShot) {
      return {
        tool: "Cinema Studio",
        model: "Sora 2",
        reason: "Hero shot. Use highest quality model for maximum impact.",
      };
    }
    return {
      tool: "Cinema Studio",
      model: "Minimax Hailuo 02",
      reason: "Standard AI generation. Fast iteration, good quality.",
    };
  }

  return null;
}

// ============================================
// VFX Trick Suggestion
// Based on production method and context
// ============================================

export function suggestVfxTrick(
  productionMethod: string,
  shotType: string | null,
  act: string | null,
): string | null {
  if (productionMethod !== "ai_enhanced") return null;

  // Scene extension for transitions and establishing shots
  if (act === "hook" || shotType === "wide") {
    return "Scene Extension";
  }
  // Camera moves for static shots that need energy
  if (act === "build" || act === "resolution") {
    return "Impossible Camera Moves";
  }
  // Environment enhancement for talking head improvements
  return "Environment Enhancement";
}

// ============================================
// Quality Gate Helpers
// ============================================

export function getQualityGateItems(
  fromStatus: string,
  toStatus: string,
  _style: ProductionStyle | null,
): ChecklistItem[] {
  const key = `${fromStatus}->${toStatus}`;
  return QUALITY_GATE_ITEMS[key] || [];
}

export function getStyleFilteredGateItems(
  fromStatus: string,
  toStatus: string,
  style: ProductionStyle | null,
): ChecklistItem[] {
  const items = getQualityGateItems(fromStatus, toStatus, style);

  // Filter out irrelevant items based on style
  return items.filter((item) => {
    if (!style) return true;

    // Real videos don't need seamless AI transition checks
    if (style === "real" && (item.key === "seamless_cuts" || item.key === "color_consistent")) {
      return false;
    }
    // Full AI videos don't need footage capture checks
    if (style === "full_ai" && item.key === "footage_captured") {
      return false;
    }
    return true;
  });
}
