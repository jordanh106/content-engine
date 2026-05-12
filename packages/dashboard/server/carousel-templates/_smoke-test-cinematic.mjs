// Ad-hoc smoke test for the cinematic variant + mixed-media carousel.
// Run from /packages/dashboard/server/: node carousel-templates/_smoke-test-cinematic.mjs
// Outputs PNGs to /tmp/carousel-smoke-cinematic/.
import { renderCarousel } from "../lib/carousel-renderer.js";

const slides = [
  {
    templateName: "cover",
    variant: "cinematic",
    variables: {
      HOOK_LINE: "The chainsaw was invented to help with childbirth, not logging.",
      SUBTITLE: "A 240-year-old obstetric tool that quietly became the icon of the lumber industry.",
      TOTAL_SLIDES: "6",
      BG_IMAGE_URL: "/tmp/test_bg_1.jpg",
    },
  },
  {
    templateName: "content",
    variant: "cinematic",
    variables: {
      POINT_NUMBER: "1",
      POINT_TITLE: "Two Scottish doctors built it in the 1780s.",
      POINT_BODY: "John Aitken and James Jeffray needed a faster way to perform symphysiotomy. Their hand-cranked chain blade was the first version of what we still call a chainsaw today.",
      SLIDE_INDEX: "2",
      TOTAL_SLIDES: "6",
      BG_IMAGE_URL: "/tmp/test_bg_2.jpg",
    },
  },
  // Text-only slide in the middle to prove mixed-media works:
  {
    templateName: "content",
    variant: "editorial",
    variables: {
      POINT_NUMBER: "2",
      POINT_TITLE: "It was used to widen the pelvis, not cut wood.",
      POINT_BODY: "Surgeons cranked the chain through bone before caesarean sections existed. It was, by all accounts, exactly as grim as it sounds.",
      SLIDE_INDEX: "3",
      TOTAL_SLIDES: "6",
    },
  },
  {
    templateName: "content",
    variant: "cinematic",
    variables: {
      POINT_NUMBER: "3",
      POINT_TITLE: "Lumberjacks adopted it almost a century later.",
      POINT_BODY: "The first true logging chainsaw appeared in 1905. By the 1920s, it had completely replaced the obstetric origin in the public imagination.",
      SLIDE_INDEX: "4",
      TOTAL_SLIDES: "6",
      BG_IMAGE_URL: "/tmp/test_bg_3.jpg",
    },
  },
  {
    templateName: "content",
    variant: "editorial",
    variables: {
      POINT_NUMBER: "4",
      POINT_TITLE: "Most patients did not survive the procedure.",
      POINT_BODY: "Without antiseptic technique or anaesthesia, the mortality rate was brutal. Caesarean sections, once they were safer, replaced the practice entirely by the 1900s.",
      SLIDE_INDEX: "5",
      TOTAL_SLIDES: "6",
    },
  },
  {
    templateName: "cta",
    variant: "cinematic",
    variables: {
      CTA_HEADLINE: "Save this for your next dinner-party fact.",
      CTA_SUBHEAD: "More stories like this drop every week. Follow along for the small histories behind everyday objects.",
      CTA_BUTTON_TEXT: "SAVE THIS FACT",
      SLIDE_INDEX: "6",
      TOTAL_SLIDES: "6",
      BG_IMAGE_URL: "/tmp/test_bg_4.jpg",
    },
  },
];

const out = await renderCarousel({
  slides,
  variant: "cinematic",
  aspect: "1:1",
  outDir: "/tmp/carousel-smoke-cinematic",
  prefix: "smoke_",
});

console.log("Rendered slides:");
for (const r of out) console.log(`  ${r.filePath}`);
