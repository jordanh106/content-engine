import { z } from "zod";
import { ThemeSchema } from "./theme";

const WalkthroughStepSchema = z.object({
  stepNumber: z.number(),
  label: z.string(),
  description: z.string(),
});

export const WalkthroughSchema = z.object({
  title: z.string(),
  hookText: z.string(),
  steps: z.array(WalkthroughStepSchema).min(2).max(8),
  reassuranceText: z.string(),
  ctaText: z.string(),
  theme: ThemeSchema,
});

export type WalkthroughProps = z.infer<typeof WalkthroughSchema>;
