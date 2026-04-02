import { z } from "zod";
import { ThemeSchema, defaultTheme } from "./theme";

export const CarouselSlideType = z.enum(["cover", "content", "cta"]);
export const AccentObject = z.enum(["torus", "sphere", "octahedron", "icosahedron", "none"]);

export const CarouselSlide3DSchema = z.object({
  heading: z.string(),
  bodyText: z.string().optional(),
  slideType: CarouselSlideType,
  slideIndex: z.number().min(0),
  totalSlides: z.number().min(1),
  accentObject: AccentObject.optional(),
  durationInSeconds: z.number().min(1).default(4),
  theme: ThemeSchema,
});

export type CarouselSlide3DProps = z.infer<typeof CarouselSlide3DSchema>;

export const carouselSlide3DDefaults: CarouselSlide3DProps = {
  heading: "5 Signs Your Spine Needs Attention",
  bodyText: "Most people ignore these until it's too late. Here's what to watch for.",
  slideType: "cover",
  slideIndex: 0,
  totalSlides: 6,
  accentObject: "torus",
  durationInSeconds: 4,
  theme: defaultTheme,
};
