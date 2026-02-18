import { z } from "zod";
import { ThemeSchema } from "./theme";

export const MythBusterSchema = z.object({
  mythText: z.string(),
  truthText: z.string(),
  explanationText: z.string(),
  ctaText: z.string(),
  theme: ThemeSchema,
});

export type MythBusterProps = z.infer<typeof MythBusterSchema>;
