// Framework-end-to-end smoke test: mocks the Haiku planner output for a 7-slide
// chainsaw carousel and renders every role through its mapped template/variant.
// Run from /packages/dashboard/server/:
//   node carousel-templates/_smoke-test-framework.mjs
import { renderCarousel } from "../lib/carousel-renderer.js";

// HOOK/BUILD_1/TENSION use placeholder bg images (in a real run these come from Higgsfield).
const HOOK_BG    = "/tmp/test_bg_1.jpg";  // dramatic chainsaw still
const BUILD_1_BG = "/tmp/test_bg_3.jpg";  // textural close-up
const TENSION_BG = "/tmp/test_bg_4.jpg";  // conceptual reframe

const slides = [
  // 1. HOOK — cinematic cover
  {
    templateName: "cover",
    variant: "cinematic",
    variables: {
      HOOK_LINE: "Chainsaws had a very different origin.",
      SUBTITLE: "Not lumber. Something far more medical.",
      TOTAL_SLIDES: "7",
      BG_IMAGE_URL: HOOK_BG,
    },
  },
  // 2. CONTEXT — minimal text
  {
    templateName: "content",
    variant: "minimal",
    variables: {
      POINT_NUMBER: "01",
      POINT_TITLE: "Before chainsaws cut trees.",
      POINT_BODY: "Two Scottish doctors invented one in 1786. Not for the forest. For the operating room.",
      SLIDE_INDEX: "2",
      TOTAL_SLIDES: "7",
    },
  },
  // 3. BUILD_1 — cinematic content
  {
    templateName: "content",
    variant: "cinematic",
    variables: {
      POINT_NUMBER: "02",
      POINT_TITLE: "It started as a surgical tool.",
      POINT_BODY: "Hand-cranked. Brass and dark steel. Designed to cut bone, not wood.",
      SLIDE_INDEX: "3",
      TOTAL_SLIDES: "7",
      BG_IMAGE_URL: BUILD_1_BG,
    },
  },
  // 4. BUILD_2 — editorial text
  {
    templateName: "content",
    variant: "editorial",
    variables: {
      POINT_NUMBER: "03",
      POINT_TITLE: "Used to widen the pelvis.",
      POINT_BODY: "Surgeons cranked the chain through bone before caesarean sections existed. Exactly as grim as it sounds.",
      SLIDE_INDEX: "4",
      TOTAL_SLIDES: "7",
    },
  },
  // 5. TENSION — cinematic content (the reframe)
  {
    templateName: "content",
    variant: "cinematic",
    variables: {
      POINT_NUMBER: "04",
      POINT_TITLE: "Then the lumberjacks claimed it.",
      POINT_BODY: "A century later, the chain blade moved from the operating theater into the forest. The medical origin was forgotten.",
      SLIDE_INDEX: "5",
      TOTAL_SLIDES: "7",
      BG_IMAGE_URL: TENSION_BG,
    },
  },
  // 6. PAYOFF — minimal text
  {
    templateName: "content",
    variant: "minimal",
    variables: {
      POINT_NUMBER: "05",
      POINT_TITLE: "Everyday objects have stranger histories.",
      POINT_BODY: "The chainsaw is one. The pap smear is another. Look around your house tonight.",
      SLIDE_INDEX: "6",
      TOTAL_SLIDES: "7",
    },
  },
  // 7. CTA — minimal text
  {
    templateName: "cta",
    variant: "minimal",
    variables: {
      CTA_HEADLINE: "Save this for your next dinner.",
      CTA_SUBHEAD: "More small histories every week. Follow along.",
      CTA_BUTTON_TEXT: "SAVE THIS FACT",
      SLIDE_INDEX: "7",
      TOTAL_SLIDES: "7",
    },
  },
];

const out = await renderCarousel({
  slides,
  variant: "cinematic",
  aspect: "1:1",
  outDir: "/tmp/carousel-smoke-framework",
  prefix: "fw_",
});

console.log("Rendered slides:");
for (const r of out) console.log(`  ${r.filePath}`);
