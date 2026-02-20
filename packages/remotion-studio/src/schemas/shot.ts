import { z } from "zod";
import { ThemeSchema } from "./theme";

// Shared base for all shot compositions
const ShotBase = z.object({
  durationInSeconds: z.number().min(2).max(15),
  theme: ThemeSchema,
});

export const ShotTitleCardSchema = ShotBase.extend({
  title: z.string(),
  subtitle: z.string().optional(),
});
export type ShotTitleCardProps = z.infer<typeof ShotTitleCardSchema>;

export const ShotStatCardSchema = ShotBase.extend({
  value: z.string(),
  label: z.string(),
});
export type ShotStatCardProps = z.infer<typeof ShotStatCardSchema>;

export const ShotSectionCardSchema = ShotBase.extend({
  label: z.string(),
  text: z.string(),
});
export type ShotSectionCardProps = z.infer<typeof ShotSectionCardSchema>;

export const ShotHookTextSchema = ShotBase.extend({
  text: z.string(),
});
export type ShotHookTextProps = z.infer<typeof ShotHookTextSchema>;

export const ShotChecklistSchema = ShotBase.extend({
  items: z
    .array(
      z.object({
        number: z.number(),
        label: z.string(),
        description: z.string(),
      }),
    )
    .min(1)
    .max(7),
});
export type ShotChecklistProps = z.infer<typeof ShotChecklistSchema>;

export const ShotMythTruthSchema = ShotBase.extend({
  text: z.string(),
  type: z.enum(["myth", "truth"]),
});
export type ShotMythTruthProps = z.infer<typeof ShotMythTruthSchema>;

export const ShotStepIndicatorSchema = ShotBase.extend({
  stepNumber: z.number(),
  totalSteps: z.number(),
  label: z.string(),
  description: z.string(),
});
export type ShotStepIndicatorProps = z.infer<typeof ShotStepIndicatorSchema>;

export const ShotFrequencyCardSchema = ShotBase.extend({
  frequency: z.string(),
  keyCue: z.string(),
});
export type ShotFrequencyCardProps = z.infer<typeof ShotFrequencyCardSchema>;

export const ShotCTASchema = ShotBase.extend({
  text: z.string(),
});
export type ShotCTAProps = z.infer<typeof ShotCTASchema>;

export const ShotChartCardSchema = ShotBase.extend({
  title: z.string().optional(),
  bars: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
        color: z.string().optional(),
      }),
    )
    .min(1)
    .max(8),
  maxValue: z.number().optional(),
});
export type ShotChartCardProps = z.infer<typeof ShotChartCardSchema>;

export const ShotQuoteCardSchema = ShotBase.extend({
  quote: z.string(),
  attribution: z.string(),
  role: z.string().optional(),
});
export type ShotQuoteCardProps = z.infer<typeof ShotQuoteCardSchema>;

export const ShotKineticTextSchema = ShotBase.extend({
  words: z
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
});
export type ShotKineticTextProps = z.infer<typeof ShotKineticTextSchema>;
