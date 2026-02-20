import { z } from "zod";
import { ThemeSchema } from "./theme";

export const PatientStorySchema = z.object({
  hookText: z.string(),
  quote: z.string(),
  attribution: z.string(),
  role: z.string().optional(),
  stat: z
    .object({
      value: z.string(),
      label: z.string(),
    })
    .optional(),
  ctaText: z.string(),
  theme: ThemeSchema,
});

export type PatientStoryProps = z.infer<typeof PatientStorySchema>;
