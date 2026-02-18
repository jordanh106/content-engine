import { z } from "zod";
import { ThemeSchema } from "./theme";

const ChecklistItemSchema = z.object({
  number: z.number(),
  label: z.string(),
  description: z.string(),
});

export const ChecklistSchema = z.object({
  title: z.string(),
  hookText: z.string(),
  items: z.array(ChecklistItemSchema).min(2).max(7),
  closingText: z.string(),
  ctaText: z.string(),
  theme: ThemeSchema,
});

export type ChecklistProps = z.infer<typeof ChecklistSchema>;
