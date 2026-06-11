// Ad-hoc smoke test for editorial carousel redesign.
// Run from /packages/dashboard/server/:  node carousel-templates/_smoke-test.mjs
// Outputs PNGs to /tmp/carousel-smoke/.
import { renderCarousel } from "../lib/carousel-renderer.js";

const slides = [
  {
    templateName: "cover",
    variables: {
      HOOK_LINE: "The chainsaw was invented to help with childbirth, not logging.",
      SUBTITLE: "A 240-year-old obstetric tool that quietly became the icon of the lumber industry.",
      TOTAL_SLIDES: "7",
    },
  },
  {
    templateName: "content",
    variables: {
      POINT_NUMBER: "1",
      POINT_TITLE: "Two Scottish doctors built it in the 1780s.",
      POINT_BODY: "John Aitken and James Jeffray needed a faster way to perform symphysiotomy. Their hand-cranked chain blade was the first version of what we still call a chainsaw today.",
      SLIDE_INDEX: "2",
      TOTAL_SLIDES: "7",
    },
  },
  {
    templateName: "content",
    variables: {
      POINT_NUMBER: "2",
      POINT_TITLE: "It was used to remove pelvic bone, not trees.",
      POINT_BODY: "When a baby could not pass through the birth canal, surgeons used the chainsaw to widen the pelvis. Caesarean sections eventually replaced the procedure entirely.",
      SLIDE_INDEX: "3",
      TOTAL_SLIDES: "7",
    },
  },
  {
    templateName: "cta",
    variables: {
      CTA_HEADLINE: "Save this for your next dinner-party fact.",
      CTA_SUBHEAD: "More stories like this drop every week. Follow along for the small histories behind everyday objects.",
      CTA_BUTTON_TEXT: "SAVE THIS FACT",
      SLIDE_INDEX: "7",
      TOTAL_SLIDES: "7",
    },
  },
];

const out = await renderCarousel({
  slides,
  variant: "editorial",
  aspect: "1:1",
  outDir: "/tmp/carousel-smoke",
  prefix: "smoke_",
});

console.log("Rendered slides:");
for (const r of out) console.log(`  ${r.filePath}`);
