/**
 * Project Kind Registry — declarative source of truth for every project type.
 *
 * Each kind defines: its stepper, brief schema, expected outputs, and how
 * "Generate" should behave (in-project orchestrator vs route to specialist surface
 * vs template-only).
 *
 * This drives ProjectDetail's stepper, BriefEditor's section cards, Quick-Start
 * dispatch logic, virality predictor mode, and per-orchestrator validation.
 */
import type { ProjectKind } from "./types.js";

export type StepId = "brief" | "refs" | "generate" | "review" | "ship";

export type ProjectKindGenerationMode =
  | { type: "orchestrator"; endpoint: string }
  | { type: "route"; surface: "storytelling-reel-modal" | "marketing-studio-modal" | "carousel-lab" | "script-wizard" }
  | { type: "template_only"; comingSoon?: boolean };

export type ProjectKindStep = {
  id: StepId;
  label: string;
  hint: string;
};

export type ProjectKindExpectedOutput = {
  label: string;
  kind: "image" | "video" | "html" | "carousel" | "text";
  count?: number;
  blurb: string;
};

export type ProjectKindBriefSection = {
  heading: string;       // markdown ## heading exactly
  placeholder: string;
  required: boolean;
  hint?: string;
  minLength?: number;    // optional content threshold (chars) to consider this section "filled"
  rows?: number;         // textarea rows
};

export type ProjectKindDefinition = {
  kind: ProjectKind;
  label: string;
  icon: string;                                    // lucide-react component name
  group: "brand" | "showcase";                     // drives virality scoring mode
  /** "brand" = Collective Family Chiropractic voice rubric. "showcase" = editorial / brief-aligned. */
  generationMode: ProjectKindGenerationMode;
  /** Minimum refs required before Generate can run. */
  refsMinimum: number;
  /** Steps shown in the stepper across the top of ProjectDetail. */
  steps: ProjectKindStep[];
  /** Visual preview chips below the stepper. */
  expectedOutputs: ProjectKindExpectedOutput[];
  /** Schema for the BriefEditor section cards. */
  briefSections: ProjectKindBriefSection[];
  /** Primary CTA label shown when the user is on the Generate step. */
  generateCtaLabel: string;
  /** Short description shown in the Generate-step panel. */
  generateBlurb: string;
};

const BRAND_BRIEF_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Topic", placeholder: 'e.g. "Why your morning back pain is actually a hip flexor problem"', required: true, minLength: 12, rows: 2 },
  { heading: "Audience", placeholder: "Adults 30-55 with chronic low-back pain, posture issues, sedentary work.", required: true, minLength: 30, rows: 2 },
  { heading: "Hook", placeholder: "Pattern-interrupt with a specific counter-intuitive claim or statistic.", required: true, minLength: 30, rows: 2 },
  { heading: "Teaching beats (3 things they'll learn)", placeholder: "1.\n2.\n3.", required: true, minLength: 30, rows: 4, hint: "List 3 specific learnings, numbered." },
  { heading: "CTA", placeholder: "Save this for tomorrow morning · Book a visit · Share with someone who needs it.", required: true, minLength: 12, rows: 2 },
];

const PATIENT_STORY_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Patient (anonymous or by initial)", placeholder: 'e.g. "Sarah K. — postpartum mom"', required: true, minLength: 6, rows: 1 },
  { heading: "Their problem before", placeholder: '"Couldn\'t pick up her toddler without sharp lower-back pain"', required: true, minLength: 30, rows: 3 },
  { heading: "What changed", placeholder: "Concrete moment of relief, weeks-to-result, lifestyle shift.", required: true, minLength: 30, rows: 3 },
  { heading: "Visual style", placeholder: "Warm, candid, golden-hour. Family at home. NO stock photo energy.", required: true, minLength: 20, rows: 2 },
  { heading: "Closing line", placeholder: "Specific, human, not salesy. 1-2 sentences max.", required: true, minLength: 12, rows: 2 },
];

const OFFICE_TOUR_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Walkthrough beats", placeholder: "1. Entrance / waiting area\n2. Adjustment room\n3. Education / consultation space\n4. Family-friendly amenities", required: true, minLength: 50, rows: 5 },
  { heading: "Vibe", placeholder: "Warm. Bright. Inviting. NOT clinical.", required: true, minLength: 12, rows: 2 },
  { heading: "Voiceover hook", placeholder: '"Most chiropractic offices feel like a dentist. This one feels like..."', required: true, minLength: 20, rows: 2 },
];

const DID_YOU_KNOW_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Topic", placeholder: 'e.g. "Things you probably do every day that quietly wreck your spine"', required: true, minLength: 20, rows: 2 },
  { heading: "Slide hooks (5-7 lines)", placeholder: "1. Hook slide (one bold sentence)\n2.\n3.\n4.\n5.\n6.\n7. CTA slide", required: true, minLength: 60, rows: 8, hint: "Each line becomes one slide." },
];

const BRAND_LAUNCH_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Brand", placeholder: "[Brand name]", required: true, minLength: 3, rows: 1 },
  { heading: "Mood", placeholder: "3-5 sentence vibe description. Editorial, not AI-aesthetic.", required: true, minLength: 30, rows: 4 },
  { heading: "Hero subject", placeholder: 'What\'s in the hero shot. Specific. e.g. "Hand-stitched leather notebook on a writing desk at dawn."', required: true, minLength: 30, rows: 3 },
  { heading: "Audience", placeholder: "Who's seeing this. Two sentences.", required: true, minLength: 20, rows: 2 },
  { heading: "Tagline candidates (3)", placeholder: "1.\n2.\n3.", required: false, rows: 4 },
];

const HOLIDAY_VARIANT_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Holiday / season", placeholder: 'e.g. "Christmas warm-and-cozy", "Halloween moody-Gothic", "summer beach"', required: true, minLength: 8, rows: 1 },
  { heading: "Original brand asset", placeholder: "Reference the asset(s) being themed. Drop them in refs.", required: true, minLength: 12, rows: 2 },
  { heading: "Holiday treatment", placeholder: "Specific elements (wreath, pumpkin, snow, etc.) — but tasteful, no cliché.", required: true, minLength: 20, rows: 3 },
];

const STORYTELLING_REEL_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Style", placeholder: "Pick from: Science Mystery (flagship), True Crime, Historical, Cosmic Horror, Future Sci-Fi.", required: true, minLength: 6, rows: 1 },
  { heading: "Topic", placeholder: 'e.g. "The 1970 Apollo 13 oxygen tank explosion"', required: true, minLength: 12, rows: 2 },
  { heading: "Length (seconds)", placeholder: "30 or 45 or 60", required: true, minLength: 2, rows: 1 },
  { heading: "Tier", placeholder: "Draft (~12 cr, fast) or Hero (~55 cr, final)", required: true, minLength: 4, rows: 1 },
];

const AVATAR_UGC_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Avatar", placeholder: "Which Marketing Studio avatar to use (Clara, Maya, etc.)", required: true, minLength: 3, rows: 1 },
  { heading: "Product", placeholder: "Brand + what it does + 1-line value prop.", required: true, minLength: 20, rows: 2 },
  { heading: "Hook", placeholder: "First 3 seconds. What grabs attention?", required: true, minLength: 12, rows: 2 },
  { heading: "CTA", placeholder: "Specific action. URL or DM trigger.", required: true, minLength: 8, rows: 1 },
];

const VIRAL_REPLICATION_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Reference video URL", placeholder: "Drop the viral video URL here.", required: true, minLength: 12, rows: 1 },
  { heading: "What about it works", placeholder: "3 reasons (hook, pacing, structure, audio, etc.)", required: true, minLength: 30, rows: 3 },
  { heading: "Your brand / product", placeholder: "Brief context on what's replacing the original subject.", required: true, minLength: 20, rows: 2 },
  { heading: "Target output", placeholder: "9:16 reel, 6-15 seconds.", required: true, minLength: 8, rows: 1 },
];

const AD_VARIANTS_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Product", placeholder: "Name + 1-line description.", required: true, minLength: 12, rows: 1 },
  { heading: "Variant axes", placeholder: "Aspect ratios, settings, moods — fan-out criteria.", required: true, minLength: 30, rows: 4 },
  { heading: "Don't include", placeholder: "Words / icons / faces / brands that conflict.", required: false, rows: 2 },
];

const PRODUCT_360_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Subject", placeholder: "Product or service station to rotate.", required: true, minLength: 8, rows: 1 },
  { heading: "Background", placeholder: "Solid color (specify hex) or scene description.", required: true, minLength: 8, rows: 1 },
  { heading: "Lighting", placeholder: "Soft / dramatic / clinical / editorial.", required: true, minLength: 4, rows: 1 },
];

const PRESS_KIT_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Subject", placeholder: "Who or what is the hero of this press kit.", required: true, minLength: 8, rows: 1 },
  { heading: "Mood", placeholder: "Editorial. Magazine cover energy. NOT corporate headshot.", required: true, minLength: 20, rows: 2 },
  { heading: "Wardrobe / props", placeholder: "Specifics that tell the story.", required: true, minLength: 12, rows: 2 },
];

const GENERIC_SECTIONS: ProjectKindBriefSection[] = [
  { heading: "Goal", placeholder: "What outcome do you want from this project?", required: true, minLength: 12, rows: 2 },
  { heading: "Notes", placeholder: "Anything else to capture.", required: false, rows: 4 },
];

const STANDARD_STEPS_WITH_REFS: ProjectKindStep[] = [
  { id: "brief", label: "Brief", hint: "Fill in every required section so the orchestrator has what it needs." },
  { id: "refs", label: "References", hint: "Add reference images to anchor the visual style." },
  { id: "generate", label: "Generate", hint: "Run the orchestrator. Outputs land below as they complete." },
  { id: "review", label: "Review", hint: "Pick winners, regenerate weak shots, score against the Blueprint." },
  { id: "ship", label: "Ship", hint: "Download, push to Canvas / Calendar, or mark published." },
];

const STANDARD_STEPS_NO_REFS: ProjectKindStep[] = [
  { id: "brief", label: "Brief", hint: "Fill in every required section." },
  { id: "generate", label: "Generate", hint: "Run the orchestrator." },
  { id: "review", label: "Review", hint: "Pick winners, regenerate weak shots." },
  { id: "ship", label: "Ship", hint: "Download or mark published." },
];

const TEMPLATE_STEPS: ProjectKindStep[] = [
  { id: "brief", label: "Brief", hint: "Fill in the brief — this kind's full orchestrator ships soon." },
  { id: "ship", label: "Save", hint: "Save the brief for later, or use the brief content elsewhere." },
];

export const PROJECT_KIND_REGISTRY: Record<ProjectKind, ProjectKindDefinition> = {
  brand_launch: {
    kind: "brand_launch",
    label: "Brand launch",
    icon: "Rocket",
    group: "showcase",
    generationMode: { type: "orchestrator", endpoint: "generate-brand-kit" },
    refsMinimum: 1,
    steps: STANDARD_STEPS_WITH_REFS,
    expectedOutputs: [
      { label: "Hero stills", kind: "image", count: 3, blurb: "Nano Banana Pro · 16:9 · 2k" },
      { label: "Motion piece", kind: "video", count: 1, blurb: "Seedance · 10s · 16:9" },
      { label: "Social cutdown", kind: "video", count: 1, blurb: "Kling · 6s · 9:16" },
      { label: "Landing page", kind: "html", count: 1, blurb: "Claude · single-file HTML + Tailwind CDN" },
    ],
    briefSections: BRAND_LAUNCH_SECTIONS,
    generateCtaLabel: "Generate brand kit",
    generateBlurb: "One brief → 3 editorial hero stills, motion piece, 9:16 social cutdown, and a single-file landing page.",
  },
  chiropractic_explainer: {
    kind: "chiropractic_explainer",
    label: "Educational explainer",
    icon: "BookOpen",
    group: "brand",
    generationMode: { type: "orchestrator", endpoint: "generate-explainer" },
    refsMinimum: 0,
    steps: STANDARD_STEPS_NO_REFS,
    expectedOutputs: [
      { label: "Teaching shots", kind: "image", count: 4, blurb: "Nano Banana Pro · 9:16 · chiropractic-warm" },
      { label: "Hero motion", kind: "video", count: 1, blurb: "Kling · 5-7s · 9:16" },
      { label: "Script draft", kind: "text", count: 1, blurb: "Hook + voiceover + caption" },
    ],
    briefSections: BRAND_BRIEF_SECTIONS,
    generateCtaLabel: "Generate explainer",
    generateBlurb: "Hook + 4 teaching shots + hero motion + script draft for Format A reels.",
  },
  patient_story: {
    kind: "patient_story",
    label: "Patient story",
    icon: "Heart",
    group: "brand",
    generationMode: { type: "orchestrator", endpoint: "generate-patient-story" },
    refsMinimum: 0,
    steps: STANDARD_STEPS_NO_REFS,
    expectedOutputs: [
      { label: "Scene stills", kind: "image", count: 3, blurb: "Warm / candid / golden-hour" },
      { label: "Hero clip", kind: "video", count: 1, blurb: "Kling · 5s · 9:16 · with sound" },
      { label: "Caption draft", kind: "text", count: 1, blurb: "Anti-stock-photo, no emdashes" },
    ],
    briefSections: PATIENT_STORY_SECTIONS,
    generateCtaLabel: "Generate patient story",
    generateBlurb: "Testimonial-style scenes + 5s hero clip + caption that doesn't read AI.",
  },
  office_tour: {
    kind: "office_tour",
    label: "Office tour",
    icon: "Compass",
    group: "brand",
    generationMode: { type: "orchestrator", endpoint: "generate-explainer" },  // reuses explainer orchestrator
    refsMinimum: 0,
    steps: STANDARD_STEPS_NO_REFS,
    expectedOutputs: [
      { label: "Room shots", kind: "image", count: 4, blurb: "Warm, bright, inviting interiors" },
      { label: "Walkthrough", kind: "video", count: 1, blurb: "Seedance · 5-7s · 9:16" },
      { label: "VO script", kind: "text", count: 1, blurb: "Hook + room-by-room narration" },
    ],
    briefSections: OFFICE_TOUR_SECTIONS,
    generateCtaLabel: "Generate office tour",
    generateBlurb: "4 room stills + walkthrough motion + voiceover script.",
  },
  did_you_know: {
    kind: "did_you_know",
    label: "Did-you-know carousel",
    icon: "LayoutGrid",
    group: "brand",
    generationMode: { type: "orchestrator", endpoint: "generate-carousel" },
    refsMinimum: 0,
    steps: STANDARD_STEPS_NO_REFS,
    expectedOutputs: [
      { label: "Carousel slides", kind: "carousel", count: 7, blurb: "Cover + 5 facts + CTA · brand-templated" },
    ],
    briefSections: DID_YOU_KNOW_SECTIONS,
    generateCtaLabel: "Generate carousel",
    generateBlurb: "7-slide IG/LinkedIn carousel from the brief.",
  },
  holiday_variant: {
    kind: "holiday_variant",
    label: "Holiday variant",
    icon: "Gift",
    group: "showcase",
    generationMode: { type: "orchestrator", endpoint: "generate-holiday-variant" },
    refsMinimum: 1,
    steps: STANDARD_STEPS_WITH_REFS,
    expectedOutputs: [
      { label: "Themed variants", kind: "image", count: 3, blurb: "Nano Banana Pro · uses ref as start image" },
      { label: "Motion variant", kind: "video", count: 1, blurb: "Kling · 4s · 9:16" },
    ],
    briefSections: HOLIDAY_VARIANT_SECTIONS,
    generateCtaLabel: "Generate holiday variant",
    generateBlurb: "Re-theme an existing brand asset for the season. Drop the base asset in References.",
  },
  storytelling_reel: {
    kind: "storytelling_reel",
    label: "Storytelling reel",
    icon: "Film",
    group: "showcase",
    generationMode: { type: "route", surface: "storytelling-reel-modal" },
    refsMinimum: 0,
    steps: STANDARD_STEPS_NO_REFS,
    expectedOutputs: [
      { label: "Narrative reel", kind: "video", count: 1, blurb: "Full reel via Storytelling Reel Engine" },
    ],
    briefSections: STORYTELLING_REEL_SECTIONS,
    generateCtaLabel: "Open in Storytelling Reel Engine",
    generateBlurb: "This kind uses the full Storytelling Reel modal. Click to open it pre-filled.",
  },
  avatar_ugc: {
    kind: "avatar_ugc",
    label: "Avatar UGC ad",
    icon: "Mic",
    group: "showcase",
    generationMode: { type: "template_only", comingSoon: true },
    refsMinimum: 0,
    steps: TEMPLATE_STEPS,
    expectedOutputs: [
      { label: "UGC ad reel", kind: "video", count: 1, blurb: "Coming soon — Marketing Studio handoff" },
    ],
    briefSections: AVATAR_UGC_SECTIONS,
    generateCtaLabel: "Coming soon",
    generateBlurb: "Marketing Studio Avatar UGC integration ships next. For now, save the brief.",
  },
  viral_replication: {
    kind: "viral_replication",
    label: "Viral replication",
    icon: "Repeat2",
    group: "showcase",
    generationMode: { type: "template_only", comingSoon: true },
    refsMinimum: 0,
    steps: TEMPLATE_STEPS,
    expectedOutputs: [
      { label: "Rebuilt reel", kind: "video", count: 1, blurb: "Coming soon — Marketing Studio Ad Reference" },
    ],
    briefSections: VIRAL_REPLICATION_SECTIONS,
    generateCtaLabel: "Coming soon",
    generateBlurb: "Viral replication orchestrator is in the queue. For now, save the brief and we'll wire it up next.",
  },
  ad_variants: {
    kind: "ad_variants",
    label: "Ad variants pack",
    icon: "GitBranch",
    group: "showcase",
    generationMode: { type: "template_only", comingSoon: true },
    refsMinimum: 0,
    steps: TEMPLATE_STEPS,
    expectedOutputs: [
      { label: "Ad variants", kind: "image", count: 12, blurb: "Coming soon — fan-out generator" },
    ],
    briefSections: AD_VARIANTS_SECTIONS,
    generateCtaLabel: "Coming soon",
    generateBlurb: "100-variants overnight orchestrator is on the roadmap. Save the brief for now.",
  },
  product_360: {
    kind: "product_360",
    label: "Product 360",
    icon: "Wand2",
    group: "showcase",
    generationMode: { type: "template_only", comingSoon: true },
    refsMinimum: 0,
    steps: TEMPLATE_STEPS,
    expectedOutputs: [
      { label: "Turntable frames", kind: "image", count: 8, blurb: "Coming soon — 8-frame loop" },
    ],
    briefSections: PRODUCT_360_SECTIONS,
    generateCtaLabel: "Coming soon",
    generateBlurb: "8-frame turntable orchestrator coming soon.",
  },
  press_kit: {
    kind: "press_kit",
    label: "Press kit",
    icon: "Image",
    group: "showcase",
    generationMode: { type: "template_only", comingSoon: true },
    refsMinimum: 0,
    steps: TEMPLATE_STEPS,
    expectedOutputs: [
      { label: "Multi-aspect heroes", kind: "image", count: 4, blurb: "Coming soon — 1:1 / 4:5 / 16:9 / 9:16" },
    ],
    briefSections: PRESS_KIT_SECTIONS,
    generateCtaLabel: "Coming soon",
    generateBlurb: "Press-kit fan-out orchestrator coming soon.",
  },
  generic: {
    kind: "generic",
    label: "Generic project",
    icon: "FolderKanban",
    group: "showcase",
    generationMode: { type: "template_only" },
    refsMinimum: 0,
    steps: TEMPLATE_STEPS,
    expectedOutputs: [],
    briefSections: GENERIC_SECTIONS,
    generateCtaLabel: "Save",
    generateBlurb: "A blank workspace. Use this to capture briefs that don't fit a template.",
  },
};

/**
 * Friendly status labels for the header pill.
 */
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  drafting: "Draft",
  generating: "Generating…",
  ready: "Ready to ship",
  published: "Published",
  archived: "Archived",
};
