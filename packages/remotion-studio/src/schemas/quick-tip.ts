import { z } from "zod";
import { ThemeSchema } from "./theme";

export const QuickTipSchema = z.object({
  hookText: z.string(),
  tipWords: z
    .array(
      z.object({
        text: z.string(),
        delay: z.number().min(0).max(90),
        scale: z.number().min(0.5).max(3).optional(),
        color: z.string().optional(),
      }),
    )
    .min(1)
    .max(20),
  ctaText: z.string(),
  theme: ThemeSchema,
});

export type QuickTipProps = z.infer<typeof QuickTipSchema>;
