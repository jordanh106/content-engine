/**
 * Visual System — the locked design language a single carousel runs on.
 *
 * Every slide (cinematic image-bg or text-only paper) inherits the same Visual System
 * so the carousel reads as one cohesive piece. The system is either derived from a
 * user-uploaded reference image (via Haiku Vision teardown) or falls back to the
 * brand default (warm cream + coral editorial mood).
 */
export type VisualSystemDensity = "minimal" | "medium" | "dense";

export type VisualSystem = {
  style: string;
  palette: string[];
  typographyMood: string;
  density: VisualSystemDensity;
  mood: string;
  paletteColors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
  };
};

export const BRAND_DEFAULT_SYSTEM: VisualSystem = {
  style: "Warm editorial cinematic. Magazine-grade still photography with soft natural light.",
  palette: ["#faf6ed warm cream", "#e11d48 coral red", "#1a1a1a near-black", "#737373 warm gray"],
  typographyMood: "Georgia serif display headlines, Nunito Sans body. Tight letterspacing on large headlines.",
  density: "medium",
  mood: "Warm, considered, slightly nostalgic. Like a small-press print magazine.",
  paletteColors: {
    primary: "#0d9488",
    accent: "#e11d48",
    background: "#faf6ed",
    text: "#1a1a1a",
  },
};

export function summarizeVisualSystem(vs: VisualSystem): string {
  return `${vs.style} Palette: ${vs.palette.join(", ")}. Typography: ${vs.typographyMood} Density: ${vs.density}. Mood: ${vs.mood}`;
}

export function serializeVisualSystem(vs: VisualSystem): string {
  return JSON.stringify(vs);
}

export function deserializeVisualSystem(raw: string | null | undefined): VisualSystem | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "style" in parsed && "paletteColors" in parsed) {
      return parsed as VisualSystem;
    }
  } catch { /* fall through */ }
  return null;
}
