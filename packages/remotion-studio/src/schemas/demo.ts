import { z } from "zod";
import { ThemeSchema } from "./theme";

const StepSchema = z.object({
  instruction: z.string(),
});

export const DemoSchema = z.object({
  title: z.string(),
  hookText: z.string(),
  steps: z.array(StepSchema).min(1).max(8),
  keyCue: z.string(),
  frequency: z.string(),
  ctaText: z.string(),
  theme: ThemeSchema,
});

export type DemoProps = z.infer<typeof DemoSchema>;
