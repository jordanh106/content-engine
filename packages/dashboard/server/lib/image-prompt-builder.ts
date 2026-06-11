/**
 * Structured image-prompt builder for carousel cinematic slides.
 *
 * Implements the JSON Prompt Generator schema from Alex's vault verbatim. The Haiku
 * planner produces an `ImagePromptSchema` per cinematic slide (scene / style / technical
 * / materials? / environment? / composition / quality); this module fills in Visual
 * System + per-role defaults and serializes to a literal JSON string for Higgsfield.
 *
 * Modern image-gen models (ChatGPT Image 2, Nano Banana 2) interpret structured JSON
 * prompts more faithfully than prose because every axis is explicit and unambiguous.
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

export type ImagePromptSchema = {
  scene: {
    description: string;   // dense paragraph covering subject + action + setting + palette
    subject: string;       // physical description; MUST contain topic-specific nouns
    setting: string;
    action: string;        // usually "static museum still"
  };
  style: {
    primary: string;       // "editorial cinematic" / "hyperrealistic museum photography"
    rendering_quality: string;
    surface_textures: string;
    lighting: string;      // direction + quality + color temperature
  };
  technical: {
    camera: {
      focal_length: string;
      aperture: string;
      depth_of_field: string;
      angle: string;
    };
    resolution: string;
    rendering: string;
  };
  materials?: {
    skin?: string;
    fabric?: string;
    surfaces?: string;
    transparency?: string;
  };
  environment?: {
    atmosphere?: string;
    time?: string;
    particles?: string;
  };
  composition: {
    perspective: string;
    framing: string;
    subject_placement: string;
    ui_elements: string;   // always "NO TEXT in image — text composited as HTML overlay in post"
  };
  quality: {
    include: string[];
    avoid: string[];
    reference_standard: string;
  };
};

const UI_ELEMENTS_RULE = "NO TEXT in image — text is composited as HTML overlay in post. Reserve negative space described in subject_placement for the headline + body to land cleanly.";

const SAFE_AVOID_FLOOR = [
  "text in image",
  "words in image",
  "typography overlays",
  "watermarks",
  "blurry text artifacts",
  "garbled lettering",
];

type RoleDefaults = {
  framing: string;
  subject_placement: string;
  qualityKeywords: string[];
};

const ROLE_DEFAULTS: Record<SlideRole, RoleDefaults> = {
  hook: {
    framing: "rule of thirds, lower-third negative space reserved for headline overlay",
    subject_placement: "right-of-center, occupying ~35% of frame, deep shadow elsewhere",
    qualityKeywords: ["scroll-stop dramatic stillness", "museum-archive composition", "deep shadow detail", "hero composition"],
  },
  context: { framing: "", subject_placement: "", qualityKeywords: [] },
  build_1: {
    framing: "centered, mid-frame fill, bottom 35% reserved as negative space for text",
    subject_placement: "subject fills mid-to-upper frame, edges softly out of focus",
    qualityKeywords: ["intimate close-up", "textural detail", "warm color grade"],
  },
  build_2: {
    framing: "centered, mid-frame fill, bottom 35% reserved as negative space for text",
    subject_placement: "subject fills mid-to-upper frame, edges softly out of focus",
    qualityKeywords: ["intimate close-up", "textural detail", "warm color grade"],
  },
  tension: {
    framing: "off-kilter, right-half subject, deep negative space on the left for text",
    subject_placement: "subject right of center, unusual angle, feels different from build slides",
    qualityKeywords: ["conceptual reframe", "unexpected angle", "abstract composition", "off-kilter framing"],
  },
  payoff: { framing: "", subject_placement: "", qualityKeywords: [] },
  cta: { framing: "", subject_placement: "", qualityKeywords: [] },
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
 * Fill in any soft fields Haiku left empty. Priority order:
 *   1. Haiku-supplied value (if present and non-empty)
 *   2. Visual System baseline (style + mood)
 *   3. Role hint (framing / subject_placement / quality keywords)
 *
 * Forced fields (always overwritten):
 *   - composition.ui_elements (we never want text baked into the image)
 *   - quality.avoid floor (always includes the "no text in image" guards)
 */
export function applyDefaults(
  schema: ImagePromptSchema,
  visualSystem: VisualSystem,
  role: SlideRole,
): ImagePromptSchema {
  const roleDef = ROLE_DEFAULTS[role];
  return {
    scene: {
      description: schema.scene.description || `${schema.scene.subject}. ${schema.scene.setting}. ${schema.scene.action}. Palette anchored to: ${visualSystem.palette.join(", ")}.`,
      subject: schema.scene.subject,
      setting: schema.scene.setting,
      action: schema.scene.action || "static museum still",
    },
    style: {
      primary: schema.style.primary || visualSystem.style,
      rendering_quality: schema.style.rendering_quality || "hyperrealistic",
      surface_textures: schema.style.surface_textures || "natural material detail, fine surface grain",
      lighting: schema.style.lighting || "single soft warm light source from camera-left, gentle shadows, ~3200K",
    },
    technical: {
      camera: {
        focal_length: schema.technical.camera.focal_length || "85mm",
        aperture: schema.technical.camera.aperture || "f/2.8",
        depth_of_field: schema.technical.camera.depth_of_field || "shallow — subject sharp, background softly defocused",
        angle: schema.technical.camera.angle || "three-quarter overhead",
      },
      resolution: schema.technical.resolution || "ultra high definition, 2K print-quality",
      rendering: schema.technical.rendering || "medium-format aesthetic, fine film grain, subtle vignetting",
    },
    materials: schema.materials,
    environment: schema.environment,
    composition: {
      perspective: schema.composition.perspective || "single vanishing point, layered depth",
      framing: schema.composition.framing || roleDef.framing || "rule of thirds, negative space at bottom for text",
      subject_placement: schema.composition.subject_placement || roleDef.subject_placement || "subject right-of-center, negative space at bottom",
      ui_elements: UI_ELEMENTS_RULE,
    },
    quality: {
      include: dedup([
        ...(schema.quality.include ?? []),
        ...roleDef.qualityKeywords,
      ]),
      avoid: dedup([
        ...(schema.quality.avoid ?? []),
        ...SAFE_AVOID_FLOOR,
      ]),
      reference_standard: schema.quality.reference_standard || `Visual System reference: ${visualSystem.style} · ${visualSystem.mood}`,
    },
  };
}

/**
 * Serialize a prompt schema as literal JSON for Higgsfield's text prompt input.
 * Wraps in `{ "prompt": { ... } }` exactly as Alex's vault docs specify.
 */
export function buildHiggsfieldPrompt(
  schema: ImagePromptSchema,
  visualSystem: VisualSystem,
  role: SlideRole,
): string {
  const filled = applyDefaults(schema, visualSystem, role);
  return JSON.stringify({ prompt: filled }, null, 2);
}

function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (typeof s !== "string") continue;
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  return out;
}

/**
 * Tolerant parser for Haiku output. Validates the required top-level shape but accepts
 * partial sub-field fills (empty strings) so applyDefaults can finish the job. Returns
 * null if the input is unrecoverable (wrong type, missing entire sections).
 */
export function parseImagePromptSchema(x: unknown): ImagePromptSchema | null {
  if (!x || typeof x !== "object") return null;
  const obj = x as Record<string, unknown>;

  const scene = asObject(obj.scene);
  const style = asObject(obj.style);
  const technical = asObject(obj.technical);
  const composition = asObject(obj.composition);
  const quality = asObject(obj.quality);
  if (!scene || !style || !technical || !composition || !quality) return null;

  const camera = asObject(technical.camera);
  if (!camera) return null;

  // Subject is the load-bearing field — refuse to accept a brief with empty/missing subject.
  const subject = asString(scene.subject).trim();
  if (subject.length < 8) return null;

  return {
    scene: {
      description: asString(scene.description),
      subject,
      setting: asString(scene.setting),
      action: asString(scene.action),
    },
    style: {
      primary: asString(style.primary),
      rendering_quality: asString(style.rendering_quality),
      surface_textures: asString(style.surface_textures),
      lighting: asString(style.lighting),
    },
    technical: {
      camera: {
        focal_length: asString(camera.focal_length),
        aperture: asString(camera.aperture),
        depth_of_field: asString(camera.depth_of_field),
        angle: asString(camera.angle),
      },
      resolution: asString(technical.resolution),
      rendering: asString(technical.rendering),
    },
    materials: asMaterials(obj.materials),
    environment: asEnvironment(obj.environment),
    composition: {
      perspective: asString(composition.perspective),
      framing: asString(composition.framing),
      subject_placement: asString(composition.subject_placement),
      ui_elements: asString(composition.ui_elements),
    },
    quality: {
      include: asStringArray(quality.include),
      avoid: asStringArray(quality.avoid),
      reference_standard: asString(quality.reference_standard),
    },
  };
}

function asObject(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function asString(x: unknown): string {
  return typeof x === "string" ? x : "";
}

function asStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function asMaterials(x: unknown): ImagePromptSchema["materials"] {
  const obj = asObject(x);
  if (!obj) return undefined;
  const out: NonNullable<ImagePromptSchema["materials"]> = {};
  if (typeof obj.skin === "string" && obj.skin.trim()) out.skin = obj.skin;
  if (typeof obj.fabric === "string" && obj.fabric.trim()) out.fabric = obj.fabric;
  if (typeof obj.surfaces === "string" && obj.surfaces.trim()) out.surfaces = obj.surfaces;
  if (typeof obj.transparency === "string" && obj.transparency.trim()) out.transparency = obj.transparency;
  return Object.keys(out).length > 0 ? out : undefined;
}

function asEnvironment(x: unknown): ImagePromptSchema["environment"] {
  const obj = asObject(x);
  if (!obj) return undefined;
  const out: NonNullable<ImagePromptSchema["environment"]> = {};
  if (typeof obj.atmosphere === "string" && obj.atmosphere.trim()) out.atmosphere = obj.atmosphere;
  if (typeof obj.time === "string" && obj.time.trim()) out.time = obj.time;
  if (typeof obj.particles === "string" && obj.particles.trim()) out.particles = obj.particles;
  return Object.keys(out).length > 0 ? out : undefined;
}
