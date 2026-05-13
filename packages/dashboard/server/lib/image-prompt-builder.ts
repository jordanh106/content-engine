/**
 * Structured image-prompt builder for carousel cinematic slides.
 *
 * Implements the JSON Prompt Generator schema from Alex's vault. The Haiku planner
 * produces an `ImageBrief` per cinematic slide (subject / setting / lighting /
 * camera / mood); this module composes those fields into a multi-paragraph prompt
 * with section labels (SCENE / STYLE / CAMERA / COMPOSITION / QUALITY / AVOID).
 *
 * The schema lives in TypeScript so we can validate it; the output is paragraphed
 * text because Higgsfield's CLI takes a prompt string, not JSON.
 */
import type { HiggsfieldModelKey } from "./higgsfield-client.js";
import type { VisualSystem } from "./visual-system.js";

export type SlideRole =
  | "hook"
  | "context"
  | "build_1"
  | "build_2"
  | "tension"
  | "payoff"
  | "cta";

export type ImageBrief = {
  /** What is literally in the frame. MUST contain topic-specific nouns (no generic mood). */
  subject: string;
  /** Where and when. Era, location, surface, light source. */
  setting: string;
  /** Usually "static museum still" or "static studio still". One short phrase. */
  action: string;
  /** Light direction, quality, and color temperature in Kelvin. */
  lighting: string;
  /** e.g. "85mm". 85mm hero, 50mm build close-up, 35mm tension. */
  focalLength: string;
  /** e.g. "f/2.8". Shallower for hero, moderate for build. */
  aperture: string;
  /** e.g. "three-quarter overhead, slight low angle". */
  angle: string;
  /** 3-5 mood-specific phrases. */
  moodKeywords: string[];
  /** 3-5 phrases to NOT include (modern materials, plastic, etc.). */
  avoidKeywords: string[];
};

const ROLE_COMPOSITION: Record<SlideRole, string> = {
  hook: "High-contrast hero composition. Dramatic single subject, lower-third and upper-left reserved as negative space for text overlay. Single vanishing point, shallow depth of field — subject crisp, background falls into shadow.",
  context: "",
  build_1: "Warm textural close-up. Subject fills mid-to-upper frame. Bottom 35% reserved as negative space for text overlay. Moderate depth of field — primary detail sharp, surrounding context softly out of focus.",
  build_2: "Warm textural close-up. Subject fills mid-to-upper frame. Bottom 35% reserved as negative space for text overlay. Moderate depth of field — primary detail sharp, surrounding context softly out of focus.",
  tension: "Conceptual / abstract / striking. Should feel different from the build slides — unexpected angle or framing. Subject occupies right half of frame, deep negative space on the left for text overlay. Look feels off-kilter, not safe.",
  payoff: "",
  cta: "",
};

const ROLE_QUALITY: Record<SlideRole, string[]> = {
  hook: ["scroll-stop dramatic stillness", "museum-archive composition", "deep shadow detail", "scroll-stop scroll-stop"],
  context: [],
  build_1: ["intimate close-up", "textural detail", "warm color grade"],
  build_2: ["intimate close-up", "textural detail", "warm color grade"],
  tension: ["conceptual reframe", "unexpected angle", "abstract composition", "off-kilter framing"],
  payoff: [],
  cta: [],
};

/**
 * Map a slide role to its Higgsfield model. HOOK gets the highest-quality model
 * (gpt_image / ChatGPT Image 2). BUILD and TENSION ride the cheap workhorse
 * (Nano Banana 2). Text-only roles (context, payoff, cta) return null — no image gen.
 */
export function modelForRole(role: SlideRole): HiggsfieldModelKey | null {
  switch (role) {
    case "hook":
      return "gpt_image";
    case "build_1":
    case "build_2":
    case "tension":
      return "nano_banana_2";
    case "context":
    case "payoff":
    case "cta":
    default:
      return null;
  }
}

/**
 * Fallback model for a role when the primary fails. nano_banana_flash is the cheapest
 * and fastest Higgsfield model; all cinematic roles can retry through it before we give
 * up and fall back to text-only rendering.
 */
export function fallbackModelForRole(role: SlideRole): HiggsfieldModelKey | null {
  switch (role) {
    case "hook":
    case "build_1":
    case "build_2":
    case "tension":
      return "nano_banana_flash";
    default:
      return null;
  }
}

/**
 * Compose the multi-paragraph Higgsfield prompt from an ImageBrief + Visual System + role.
 * Sections are labeled (SCENE / STYLE / CAMERA / COMPOSITION / QUALITY / AVOID) so the
 * image model can pick out each axis. Visual System contributes style + mood baseline.
 */
export function buildHiggsfieldPrompt(
  brief: ImageBrief,
  visualSystem: VisualSystem,
  role: SlideRole,
): string {
  const composition = ROLE_COMPOSITION[role] || "Balanced composition with clear negative space at the bottom of the frame for text overlay.";
  const roleQuality = ROLE_QUALITY[role] || [];
  const moodAll = dedup([...brief.moodKeywords, ...roleQuality]);
  const avoidAll = dedup([
    ...brief.avoidKeywords,
    "text in image",
    "words in image",
    "typography overlays",
    "watermarks",
  ]);

  return [
    `SCENE: ${brief.subject}. Setting: ${brief.setting}. ${brief.action}.`,
    `STYLE: ${visualSystem.style} Surface and material rendering hyperrealistic. Lighting: ${brief.lighting}. Mood: ${visualSystem.mood}`,
    `CAMERA: ${brief.focalLength}, ${brief.aperture}, ${brief.angle}.`,
    `COMPOSITION: ${composition}`,
    `QUALITY: ${moodAll.join(", ")}.`,
    `AVOID: ${avoidAll.join(", ")}.`,
  ].join("\n\n");
}

function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  return out;
}

/** Validate that an unknown blob looks like an ImageBrief. Used after parsing Haiku output. */
export function isImageBrief(x: unknown): x is ImageBrief {
  if (!x || typeof x !== "object") return false;
  const b = x as Partial<Record<keyof ImageBrief, unknown>>;
  return (
    typeof b.subject === "string" && b.subject.length > 4 &&
    typeof b.setting === "string" &&
    typeof b.action === "string" &&
    typeof b.lighting === "string" &&
    typeof b.focalLength === "string" &&
    typeof b.aperture === "string" &&
    typeof b.angle === "string" &&
    Array.isArray(b.moodKeywords) &&
    Array.isArray(b.avoidKeywords)
  );
}
