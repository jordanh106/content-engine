import { z } from "zod";
import { ThemeSchema } from "./theme";

const SectionSchema = z.object({
  label: z.string(),
  text: z.string(),
  durationInSeconds: z.number().min(1).max(30),
});

export const ExplainerSchema = z.object({
  title: z.string(),
  hookText: z.string(),
  sections: z.array(SectionSchema).min(1).max(6),
  stat: z
    .object({
      value: z.string(),
      label: z.string(),
    })
    .optional(),
  ctaText: z.string(),
  theme: ThemeSchema,
});

export type ExplainerProps = z.infer<typeof ExplainerSchema>;
